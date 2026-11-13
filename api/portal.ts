import {
  cookieValue, currentProfile, digest, field, internalEmail, limit, PortalError,
  query, readBody, reply, rpc, setting, studentNumber, supabase, token, write,
} from '../server/portal-store.js';
import { eligibleStudent, telegramWebhook } from '../server/portal-bot.js';
import { quizAction } from '../server/portal-quizzes.js';
import { telegramIdentity } from '../server/telegram-identity.js';

export default {
  async fetch(request: Request) {
    try {
      if (request.method === 'GET') {
        const enabled = process.env.PORTAL_ENABLED === 'true';
        return reply({ profile: enabled ? await currentProfile(request) : null, enabled });
      }
      if (request.method !== 'POST') return reply({ error: 'درخواست معتبر نیست.' }, 405);
      const url = new URL(request.url);
      if (setting('PORTAL_ENABLED') !== 'true') throw new PortalError(503, 'سامانهٔ حساب‌ها هنوز راه‌اندازی نشده است.');
      if (url.searchParams.get('telegram') === '1') return await telegramWebhook(request);
      if (request.headers.get('origin') !== setting('PORTAL_ORIGIN')) throw new PortalError(403, 'درخواست معتبر نیست.');
      const body = await readBody(request);
      const action = field(body, 'action');
      if (action === 'logout') {
        const session = cookieValue(request);
        if (session) await write('portal_sessions', 'DELETE', undefined, { token_hash: `eq.${digest(session)}` });
        return reply({ ok: true }, 200, null);
      }
      if (action.startsWith('quiz:')) {
        const profile = await currentProfile(request);
        if (!profile) throw new PortalError(401, 'ابتدا وارد پنل شوید.');
        return reply(await quizAction(action, body, profile));
      }
      if (action !== 'register' && action !== 'login') throw new PortalError(400, 'درخواست معتبر نیست.');

      const username = field(body, 'username').trim().toLowerCase();
      const password = field(body, 'password');
      if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username) || password.length < 12 || new TextEncoder().encode(password).length > 72) {
        throw new PortalError(422, 'نام کاربری باید ۳ تا ۳۲ نویسهٔ انگلیسی و رمز عبور ۱۲ نویسه تا ۷۲ بایت باشد.');
      }

      if (action === 'register') {
        const telegram = telegramIdentity(field(body, 'telegramInitData'));
        const role = field(body, 'role');
        if (role !== 'student' && role !== 'teacher') throw new PortalError(400, 'نوع حساب معتبر نیست.');
        await limit(`register:telegram:${telegram}`, 8);
        const [invite] = await query<{ code_hash: string; student_number: string | null }[]>('portal_invites', {
          telegram_id: `eq.${telegram}`, role: `eq.${role}`, select: 'code_hash,student_number', used_at: 'is.null',
          expires_at: `gt.${new Date().toISOString()}`, order: 'expires_at.desc', limit: '1',
        });
        if (!invite) throw new PortalError(403, 'دعوت فعال برای این حساب تلگرام پیدا نشد. اگر قبلاً ثبت‌نام کرده‌اید، از سایت وارد شوید.');
        const first = field(body, 'firstName').trim();
        const last = field(body, 'lastName').trim();
        const number = studentNumber(field(body, 'studentNumber'));
        const date = field(body, 'birthDate');
        const parsedDate = new Date(date + 'T00:00:00Z');
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsedDate.getTime())
          && parsedDate.toISOString().slice(0, 10) === date && date >= '1900-01-01' && date < new Date().toISOString().slice(0, 10);
        if (!first || !last || first.length > 80 || last.length > 80 ||
          (role === 'student' && (!eligibleStudent(number) || number !== invite.student_number || !validDate))) {
          throw new PortalError(422, 'مشخصات ثبت‌نام معتبر نیست. اطلاعات و شرایط دعوت را بررسی کنید.');
        }
        const ticket = digest(token());
        const claimedRole = await rpc<string | null>('portal_claim_invite', {
          p_code: invite.code_hash, p_telegram: telegram, p_ticket: ticket,
        });
        if (claimedRole !== role) throw new PortalError(409, 'این دعوت دیگر قابل استفاده نیست.');
        await supabase('/auth/v1/admin/users', 'POST', {
          email: internalEmail(username), password, email_confirm: true,
          app_metadata: { portal_signup: {
            ticket, username, first_name: first, last_name: last,
            student_number: role === 'student' ? number : null, birth_date: role === 'student' ? date : null,
          } },
        });
        return reply({ registered: true });
      }

      const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      await limit(`login:ip:${ip}`, 35);
      await limit(`login:username:${username}`, 10);
      const invalid = 'نام کاربری یا رمز عبور معتبر نیست.';
      const auth = await supabase<{ user: { id: string }; access_token: string }>('/auth/v1/token?grant_type=password', 'POST', {
        email: internalEmail(username), password,
      }, true);
      // Supabase Auth verifies the password. The portal issues its own revocable session.
      // End the upstream session so its refresh token does not remain usable.
      await supabase('/auth/v1/logout?scope=local', 'POST', undefined, true, auth.access_token);
      const [expected] = await query<{ id: string }[]>('portal_profiles', {
        id: `eq.${auth.user.id}`, username: `eq.${username}`, active: 'eq.true', select: 'id', limit: '1',
      });
      if (!expected) throw new PortalError(401, invalid);
      const session = token();
      await write('portal_sessions', 'POST', { token_hash: digest(session), profile_id: expected.id });
      const previous = cookieValue(request);
      if (previous) await write('portal_sessions', 'DELETE', undefined, { token_hash: `eq.${digest(previous)}` });
      return reply({ loggedIn: true }, 200, session);
    } catch (error) {
      if (error instanceof PortalError) return reply({ error: error.message }, error.status);
      return reply({ error: 'درخواست انجام نشد. دوباره تلاش کنید.' }, 503);
    }
  },
};
