import {createCipheriv, createDecipheriv, createHmac, createPrivateKey, hkdfSync, randomBytes, sign} from 'node:crypto';
import {cookieValue, digest, equalSecret, readBody, reply, setting, uuidPattern} from '@ieaum/platform/store';

const audience = 'ieaum-live-code';
const unavailable = 'این بخش توسط مدیر غیرفعال شده است.';
const nonce = /^[A-Za-z0-9_-]{43}$/;
const hash = /^[a-f0-9]{64}$/;
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const recentGrants = new Map<string, {count: number; expires: number}>();

function grantQuota(id: string) {
  const now = Date.now();
  for (const [key, entry] of recentGrants) if (entry.expires <= now) recentGrants.delete(key);
  const entry = recentGrants.get(id);
  if (entry) return ++entry.count <= 6;
  if (recentGrants.size >= 512) return false;
  recentGrants.set(id, {count: 1, expires: now + 60_000});
  return true;
}

function origin(name: string) {
  const input = setting(name);
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.origin !== input) throw new Error('Invalid Live Code origin');
  return input;
}

function sealKey() {
  const key = Buffer.from(setting('LIVECODE_SESSION_SEAL_KEY'), 'base64url');
  if (key.length !== 32) throw new Error('Invalid Live Code session key');
  return key;
}

type Binding = {hash: string; id: string; exp: number};
type Profile = {id: string; active: boolean; review_status: string; username: string; first_name: string; last_name: string; student_number: string | null; role: 'teacher' | 'student'};

function seal(binding: Binding, key: Buffer, issuer: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(audience + ':' + issuer));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(binding), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
function unseal(encoded: string, key: Buffer, issuer: string): Binding {
  if (!/^[A-Za-z0-9_-]{40,1000}$/.test(encoded)) throw new Error('Bad binding');
  const value = Buffer.from(encoded, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
  decipher.setAAD(Buffer.from(audience + ':' + issuer));
  decipher.setAuthTag(value.subarray(12, 28));
  const result = JSON.parse(Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8')) as Binding;
  if (!hash.test(result.hash) || !uuidPattern.test(result.id) || !Number.isSafeInteger(result.exp)) throw new Error('Bad binding');
  return result;
}

async function lookup(tokenHash: string, identity?: string, details = false) {
  const fields = details ? 'id,active,review_status,username,first_name,last_name,student_number,role' : 'id,active,review_status';
  const params = new URLSearchParams({
    token_hash: 'eq.' + tokenHash,
    expires_at: 'gt.' + new Date().toISOString(),
    'portal_profiles.active': 'eq.true',
    'portal_profiles.review_status': 'eq.approved',
    ...(identity ? {profile_id: 'eq.' + identity} : {}),
    select: `expires_at,profile_id,portal_profiles!inner(${fields})`,
    limit: '1',
  });
  const key = setting('SUPABASE_SECRET_KEY');
  const response = await fetch(setting('SUPABASE_URL').replace(/\/$/, '') + '/rest/v1/portal_sessions?' + params, {
    headers: {apikey: key, ...(key.startsWith('eyJ') ? {Authorization: 'Bearer ' + key} : {})},
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(1600),
  });
  if (!response.ok) throw new Error('Session lookup failed');
  const rows = (await response.json()) as {expires_at: string; profile_id: string; portal_profiles: Profile}[];
  const session = rows[0];
  return session?.portal_profiles?.active && session.portal_profiles.review_status === 'approved' ? session : null;
}

function signingKey() {
  const key = createPrivateKey(setting('LIVECODE_SIGNING_PRIVATE_KEY').replace(/\\n/g, '\n'));
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Invalid signing key');
  return key;
}

export async function grant(request: Request) {
  if (process.env.LIVECODE_AUTH_ENABLED !== '1') return reply({error: unavailable}, 503);
  if (request.method !== 'POST') return reply({error: 'درخواست معتبر نیست.'}, 405);
  try {
    if (request.headers.get('origin') !== origin('LIVECODE_PORTAL_ORIGIN')
        || request.headers.get('sec-fetch-site') === 'cross-site') return reply({error: 'درخواست معتبر نیست.'}, 403);
    const cookie = cookieValue(request);
    if (!cookie) return reply({error: 'ابتدا وارد حساب IEAUM شوید.'}, 401);
    const {transaction, boot, challenge} = await readBody(request, 2048);
    if (![transaction, boot, challenge].every(value => typeof value === 'string' && nonce.test(value))) {
      return reply({error: 'درخواست ورود معتبر نیست.'}, 400);
    }
    const tokenHash = digest(cookie);
    if (!grantQuota(tokenHash)) return reply({error: 'کمی صبر کنید و دوباره تلاش کنید.'}, 429);
    const session = await lookup(tokenHash, undefined, true);
    if (!session) return reply({error: 'نشست معتبر یا حساب فعال پیدا نشد.'}, 401);
    const profile = session.portal_profiles;
    const issuer = origin('LIVECODE_AUTH_ISSUER');
    if (issuer !== origin('LIVECODE_PORTAL_ORIGIN')) throw new Error('Wrong issuer environment');
    const backend = origin('LIVECODE_HANDOFF_ORIGIN');
    const key = sealKey();
    const now = Math.floor(Date.now() / 1000);
    const kid = setting('LIVECODE_SIGNING_KID');
    if (!/^[\w-]{1,40}$/.test(kid)) throw new Error('Invalid key identifier');
    const checkKey = Buffer.from(hkdfSync('sha256', key, '', 'ieaum-live-code/session-fingerprint', 32));
    const check = createHmac('sha256', checkKey).update(tokenHash).digest('base64url');
    const binding = seal({hash: tokenHash, id: profile.id, exp: Math.floor(Date.parse(session.expires_at) / 1000)}, key, issuer);
    const unsigned = b64({alg: 'EdDSA', typ: 'JWT', kid}) + '.' + b64({
      iss: issuer, aud: audience, iat: now, exp: now + 60, jti: randomBytes(32).toString('base64url'),
      transaction, boot, challenge, sub: profile.id, binding, check,
      name: `${profile.first_name} ${profile.last_name}`.trim(), username: profile.username,
      number: profile.student_number, role: profile.role,
    });
    const envelope = unsigned + '.' + sign(null, Buffer.from(unsigned), signingKey()).toString('base64url');
    const response = await fetch(backend + '/internal/handoff', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({envelope}),
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(2200),
    });
    if (!response.ok) return reply({error: unavailable}, 503);
    return reply({ok: true});
  } catch {
    return reply({error: unavailable}, 503);
  }
}

export async function sessionStatus(request: Request) {
  if (process.env.LIVECODE_AUTH_ENABLED !== '1') return reply({valid: false}, 503);
  if (request.method !== 'POST') return reply({valid: false}, 405);
  try {
    const credential = setting('LIVECODE_INTROSPECT_SECRET');
    if (credential.length < 43 || !equalSecret(request.headers.get('authorization') ?? '', 'Bearer ' + credential)) {
      return reply({valid: false}, 403);
    }
    const {binding} = await readBody(request, 2048);
    if (typeof binding !== 'string') return reply({valid: false}, 400);
    let record: Binding;
    try { record = unseal(binding, sealKey(), origin('LIVECODE_AUTH_ISSUER')); }
    catch { return reply({valid: false}); }
    if (record.exp <= Math.floor(Date.now() / 1000)) return reply({valid: false});
    return reply({valid: Boolean(await lookup(record.hash, record.id))});
  } catch {
    return reply({valid: false}, 503);
  }
}
