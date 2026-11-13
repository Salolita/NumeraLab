import { equalSecret, reply, setting, supabase } from '../server/portal-store.js';

const callback = 'https://numeralab.ieaum.ir/api/portal?telegram=1';

async function telegram(method: string, body?: object) {
  const response = await fetch(`https://api.telegram.org/bot${setting('TELEGRAM_BOT_TOKEN')}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(6000),
  });
  const data = await response.json();
  if (!response.ok || data.ok !== true) throw new Error(method);
  return data.result;
}

export default {
  async fetch(request: Request) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (request.method !== 'POST' || !secret ||
      !equalSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return reply({}, 404);

    const status: Record<string, unknown> = {};
    try {
      const [auth, admins] = await Promise.all([
        supabase<{ disable_signup: boolean }>('/auth/v1/settings', 'GET', undefined, true),
        supabase<unknown[]>('/rest/v1/portal_profiles?select=id&limit=1'),
      ]);
      status.database = Array.isArray(admins);
      status.publicSignupDisabled = auth.disable_signup === true;
      status.adminIdsValid = /^\d+(?:\s*,\s*\d+)*$/.test(setting('TELEGRAM_ADMIN_IDS'));
    } catch { return reply({ ...status, stage: 'supabase' }, 502); }
    if (!Object.values(status).every(Boolean)) return reply(status, 422);

    try {
      const bot = await telegram('getMe');
      status.botVerified = bot.username?.toLowerCase() === 'ieaumbot';
      if (!status.botVerified) return reply(status, 422);
      const before = await telegram('getWebhookInfo');
      status.webhook = before.url === callback ? 'current' : before.url ? 'another-url' : 'empty';
      if (before.url && before.url !== callback) return reply(status, 409);
      if (new URL(request.url).searchParams.get('install') !== '1') return reply(status);
      const installed = await telegram('setWebhook', { url: callback, secret_token: secret, allowed_updates: ['message'] });
      const after = await telegram('getWebhookInfo');
      status.webhook = installed === true && after.url === callback ? 'verified' : 'unverified';
      status.pendingUpdates = after.pending_update_count;
      return reply(status, status.webhook === 'verified' ? 200 : 502);
    } catch { return reply({ ...status, stage: 'telegram' }, 502); }
  },
};
