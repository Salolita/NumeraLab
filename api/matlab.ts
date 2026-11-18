import { currentProfile, limit, PortalError, readBody, reply, setting } from '../server/portal-store.js';
import { isInterpolationInput } from '../src/utils/interpolation.js';

export default {
  async fetch(request: Request) {
    try {
      const enabled = process.env.PORTAL_ENABLED === 'true' && Boolean(process.env.MATLAB_INTERPOLATION_URL && process.env.MATLAB_API_TOKEN);
      if (request.method === 'GET') return reply({ enabled });
      if (!enabled) throw new PortalError(503, 'سرویس اجرای MATLAB هنوز فعال نشده است.');
      if (request.method !== 'POST' || request.headers.get('origin') !== setting('PORTAL_ORIGIN')) {
        throw new PortalError(403, 'درخواست معتبر نیست.');
      }
      const endpoint = new URL(setting('MATLAB_INTERPOLATION_URL'));
      if (endpoint.protocol !== 'https:') throw new PortalError(503, 'نشانی سرویس MATLAB باید HTTPS باشد.');
      const profile = await currentProfile(request);
      if (!profile) throw new PortalError(401, 'برای اجرای MATLAB وارد پنل شوید.');
      await limit(`matlab:${profile.id}`, 10);
      const { x, y, t } = await readBody(request, 8000);
      if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length > 30
        || typeof t !== 'number' || !isInterpolationInput(x.map((value, i) => ({ x: value, y: y[i] })), t)) {
        throw new PortalError(422, 'داده‌های درون‌یابی معتبر نیست.');
      }
      const response = await fetch(endpoint, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${setting('MATLAB_API_TOKEN')}` },
        body: JSON.stringify({ rhs: [x, y, t], nargout: 2, outputFormat: { mode: 'small', nanInfFormat: 'string' } }),
      });
      if (!response.ok) throw new PortalError(502, 'سرویس MATLAB خطای اجرا برگرداند.');
      const { lhs } = await response.json();
      const result = Array.isArray(lhs?.[0]) ? lhs[0][0] : lhs?.[0];
      const terms = Array.isArray(lhs?.[1]?.[0]) ? lhs[1][0] : lhs?.[1];
      if (!Number.isFinite(result) || !Array.isArray(terms) || terms.length !== x.length || terms.some((term) => !Number.isFinite(term))) {
        throw new PortalError(502, 'خروجی MATLAB در قالب مورد انتظار نبود.');
      }
      return reply({ value: result, terms });
    } catch (error) {
      return error instanceof PortalError ? reply({ error: error.message }, error.status) : reply({ error: 'اجرای MATLAB کامل نشد.' }, 502);
    }
  },
};
