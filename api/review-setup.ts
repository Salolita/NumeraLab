import { digest, equalSecret, reply, setting } from '../server/portal-store.js';

export default {
  async fetch(request: Request) {
    const supplied = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (request.method !== 'POST' || !supplied || !equalSecret(digest(supplied), '25e27303ce1a3ed46a5445f4b219d896bfc5468aa77b43f6dccaa1a99cd8e848')) return reply({}, 404);
    try {
      const root = `https://api.telegram.org/bot${setting('TELEGRAM_BOT_TOKEN')}/`;
      const url = setting('PORTAL_ORIGIN') + '/api/portal?telegram=1';
      const requestTelegram = async (method: string, body: object = {}) => {
        const response = await fetch(root + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(6000) });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(method);
        return data.result;
      };
      const before = await requestTelegram('getWebhookInfo');
      if (before.url !== url) return reply({ configured: false }, 409);
      await requestTelegram('setWebhook', { url, secret_token: setting('TELEGRAM_WEBHOOK_SECRET'), allowed_updates: [...new Set([...(before.allowed_updates ?? ['message']), 'message', 'callback_query'])] });
      const after = await requestTelegram('getWebhookInfo');
      return reply({ configured: after.url === url && after.allowed_updates.includes('callback_query') });
    } catch { return reply({ configured: false }, 502); }
  },
};
