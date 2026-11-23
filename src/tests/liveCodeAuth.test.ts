import assert from 'node:assert/strict';
import {generateKeyPairSync, randomBytes, verify} from 'node:crypto';
import {test} from 'node:test';
import {grant, sessionStatus} from '../../server/live-code-auth';

test('issuer uses the existing cookie, a read-only lookup and a sealed, audience-bound grant', async () => {
  const privateKey = generateKeyPairSync('ed25519');
  const env = {
    VERCEL_ENV: 'production', LIVECODE_AUTH_ENABLED: '1', LIVECODE_PORTAL_ORIGIN: 'https://ieaum.ir',
    LIVECODE_AUTH_ISSUER: 'https://ieaum.ir', LIVECODE_HANDOFF_ORIGIN: 'https://backend.invalid-tail.ts.net',
    LIVECODE_SIGNING_PRIVATE_KEY: privateKey.privateKey.export({type: 'pkcs8', format: 'pem'}).toString(),
    LIVECODE_SIGNING_KID: 'prod-1234567890ab', LIVECODE_SESSION_SEAL_KEY: randomBytes(32).toString('base64url'),
    LIVECODE_INTROSPECT_SECRET: randomBytes(32).toString('base64url'),
    SUPABASE_URL: 'https://db.preview.test', SUPABASE_SECRET_KEY: 'fixture-only',
  };
  const originalEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  const oldFetch = globalThis.fetch;
  let valid = true;
  let dbReads = 0;
  let sharedCalls = 0;
  let sharedAllows = true;
  const profile = {
    id: '71000000-0000-4000-8000-000000000002', active: true, review_status: 'approved',
    username: 'fixture_user', first_name: 'کاربر', last_name: 'آزمایشی', student_number: '404000001', role: 'student',
  };
  const claims: any[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    if (url.origin === env.SUPABASE_URL) {
      if (url.pathname === '/rest/v1/rpc/portal_rate_limit') {
        assert.equal(init?.method, 'POST');
        const {p_bucket, p_limit} = JSON.parse(String(init?.body));
        assert.match(p_bucket, /^[0-9a-f]{64}$/);
        assert.equal(p_limit, 160);
        sharedCalls++;
        return Response.json(sharedAllows);
      }
      assert.equal(url.pathname, '/rest/v1/portal_sessions');
      assert.ok(!init?.method || init.method === 'GET');
      assert.match(url.searchParams.get('token_hash') ?? '', /^eq\.[0-9a-f]{64}$/);
      assert.equal(url.searchParams.get('portal_profiles.active'), 'eq.true');
      dbReads++;
      return Response.json(valid ? [{profile_id: profile.id, expires_at: new Date(Date.now() + 100_000).toISOString(), portal_profiles: profile}] : []);
    }
    assert.equal(url.href, env.LIVECODE_HANDOFF_ORIGIN + '/internal/handoff');
    assert.equal(init?.redirect, 'error');
    const {envelope} = JSON.parse(String(init?.body));
    const [header, payload, signature] = envelope.split('.');
    assert.equal(verify(null, Buffer.from(header + '.' + payload), privateKey.publicKey, Buffer.from(signature, 'base64url')), true);
    claims.push(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
    return Response.json({ok: true});
  }) as typeof fetch;

  const createRequest = (origin: string, cookie = true, host = 'https://numeralab.ieaum.ir') => new Request(host + '/api/live-code-grant', {
    method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin,
      ...(cookie ? {Cookie: '__Host-ieaum=' + 'a'.repeat(32)} : {})},
    body: JSON.stringify(Object.fromEntries(['transaction', 'boot', 'challenge'].map(field => [field, randomBytes(32).toString('base64url')]))),
  });
  const introspect = (binding: string, key = env.LIVECODE_INTROSPECT_SECRET) => sessionStatus(new Request('https://numeralab.ieaum.ir/api/live-code-session', {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + key}, body: JSON.stringify({binding}),
  }));

  try {
    assert.equal((await grant(createRequest('https://other.preview.test'))).status, 403);
    assert.equal((await grant(createRequest(env.LIVECODE_PORTAL_ORIGIN, true, 'https://other.preview.test'))).status, 503);
    process.env.VERCEL_ENV = 'preview';
    assert.equal((await grant(createRequest(env.LIVECODE_PORTAL_ORIGIN))).status, 503);
    process.env.VERCEL_ENV = 'production';
    process.env.LIVECODE_SIGNING_KID = 'preview-1234567890ab';
    assert.equal((await grant(createRequest(env.LIVECODE_PORTAL_ORIGIN))).status, 503);
    process.env.LIVECODE_SIGNING_KID = env.LIVECODE_SIGNING_KID;
    assert.equal((await grant(createRequest(env.LIVECODE_PORTAL_ORIGIN, false))).status, 401);
    assert.equal(dbReads, 0);
    for (let n = 0; n < 2; n++) {
      const result = await grant(createRequest(env.LIVECODE_PORTAL_ORIGIN));
      assert.equal(result.status, 200);
      assert.deepEqual(await result.json(), {ok: true});
      assert.equal(result.headers.get('cache-control'), 'no-store');
      assert.equal(result.headers.has('set-cookie'), false);
    }
    assert.equal(claims[0].aud, 'ieaum-live-code');
    assert.equal(claims[0].iss, env.LIVECODE_AUTH_ISSUER);
    assert.equal(claims[0].sub, profile.id);
    assert.equal(claims[0].exp - claims[0].iat, 60);
    assert.equal(claims[0].check, claims[1].check);
    assert.notDeepEqual(Buffer.from(claims[0].binding, 'base64url').subarray(0, 12), Buffer.from(claims[1].binding, 'base64url').subarray(0, 12));
    assert.equal((await introspect(claims[0].binding, 'wrong')).status, 403);
    const altered = (claims[0].binding[0] === 'z' ? 'a' : 'z') + claims[0].binding.slice(1);
    assert.deepEqual(await (await introspect(altered)).json(), {valid: false});
    assert.deepEqual(await (await introspect(claims[0].binding)).json(), {valid: true});
    valid = false;
    assert.deepEqual(await (await introspect(claims[0].binding)).json(), {valid: false});
    assert.equal((await grant(createRequest(env.LIVECODE_PORTAL_ORIGIN))).status, 401);
    const readsBeforeQuota = dbReads;
    const callsBeforeQuota = sharedCalls;
    sharedAllows = false;
    assert.equal((await grant(createRequest(env.LIVECODE_PORTAL_ORIGIN))).status, 429);
    assert.equal(dbReads, readsBeforeQuota);
    assert.equal(sharedCalls, callsBeforeQuota + 1);
    sharedAllows = true;
    for (let n = 0; n < 80; n++) {
      const request = createRequest(env.LIVECODE_PORTAL_ORIGIN);
      request.headers.set('cookie', '__Host-ieaum=' + randomBytes(24).toString('base64url'));
      const response = await grant(request);
      assert.ok(response.status === 401 || response.status === 429);
    }
    assert.equal(dbReads - readsBeforeQuota, 68);
    process.env.LIVECODE_AUTH_ENABLED = '0';
    assert.equal((await grant(createRequest(env.LIVECODE_PORTAL_ORIGIN))).status, 503);
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    globalThis.fetch = oldFetch;
  }
});
