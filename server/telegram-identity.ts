import { createHmac } from 'node:crypto';
import { equalSecret, PortalError, setting } from './portal-store.js';

export function telegramIdentity(initData: string, now = Date.now()) {
  const invalid = () => new PortalError(401, 'فرم را دوباره از دکمهٔ ثبت‌نام داخل ربات باز کنید.');
  if (!initData || initData.length > 8192) throw invalid();
  const data = new URLSearchParams(initData);
  if (new Set(data.keys()).size !== [...data.keys()].length) throw invalid();
  const signature = data.get('hash') ?? '';
  const issuedAt = Number(data.get('auth_date'));
  const age = now / 1000 - issuedAt;
  if (!/^[a-f0-9]{64}$/.test(signature) || !Number.isSafeInteger(issuedAt) || age < -30 || age > 900) throw invalid();

  data.delete('hash');
  data.sort();
  const check = [...data].map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(setting('TELEGRAM_BOT_TOKEN')).digest();
  if (!equalSecret(signature, createHmac('sha256', secret).update(check).digest('hex'))) throw invalid();

  let id: unknown;
  try { id = JSON.parse(data.get('user') ?? 'null')?.id; }
  catch { throw invalid(); }
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) throw invalid();
  return String(id);
}
