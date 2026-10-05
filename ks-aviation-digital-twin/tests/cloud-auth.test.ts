import assert from 'node:assert/strict';
import { CloudStore, CloudConflict } from '../src/cloud-store';
import { CloudError, cloudErrorMessage, providerError, validateNewPassword } from '../src/cloud-errors';
import { takeAuthCallback, authRedirectUrl } from '../src/auth-callback';
import { validateScene, newEntity } from '../src/scene-data';

const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) } as Storage;
};
const key = 'KS_ADT_CLOUD_AUTH_V1';
const site = 'https://ks-aviation-digital-twin.onrender.com/';
const password = 'test-only-long-password';
const newPassword = 'different-test-only-password';
let calls: { path: string; body: any; headers: Record<string, string> }[] = [];
let confirmed = false, registered = false, currentPassword = password, revision = 0, payload: any;
const user = { id: 'fake-account', email: 'test@example.test' };
const session = () => ({ access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600, user });
let forceError: { status: number; body: any } | undefined;
const transport = (async (input: string, init?: RequestInit) => {
  if (input === '/cloud-config.json') return Response.json({ url: 'https://test.supabase.co', anonKey: 'sb_publishable_test' });
  const url = new URL(input), path = url.pathname;
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  const headers = init?.headers as Record<string, string>;
  calls.push({ path, body, headers });
  assert.equal(headers.apikey, 'sb_publishable_test');
  if (forceError) return Response.json(forceError.body, { status: forceError.status });
  if (['/auth/v1/signup', '/auth/v1/resend', '/auth/v1/recover'].includes(path)) {
    assert.equal(headers.Authorization, undefined, 'publishable keys must not become bearer tokens');
    assert.equal(url.searchParams.get('redirect_to'), site, 'all email links return to this site');
    assert.equal(body.email, user.email);
    if (path.endsWith('/signup')) { registered = true; assert.equal(body.password, password); return Response.json({ ...user, identities: [] }); }
    if (path.endsWith('/resend')) assert.equal(body.type, 'signup');
    if (path.endsWith('/recover')) assert.deepEqual(body, { email: user.email });
    return Response.json({});
  }
  if (path === '/auth/v1/token') {
    assert.equal(headers.Authorization, undefined);
    if (url.searchParams.get('grant_type') === 'refresh_token') return Response.json(session());
    if (!registered || body.password !== currentPassword) return Response.json({ error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, { status: 400 });
    if (!confirmed) return Response.json({ error_code: 'email_not_confirmed', msg: 'Email not confirmed' }, { status: 400 });
    return Response.json(session());
  }
  if (path === '/auth/v1/user') {
    assert.equal(headers.Authorization, 'Bearer test-access');
    if (init?.method === 'PUT') { assert.equal(body.password, newPassword); currentPassword = body.password; }
    return Response.json(user);
  }
  assert.equal(headers.Authorization, 'Bearer test-access');
  if (path.endsWith('/ks_adt_save_scene')) {
    if (body.p_expected_revision !== revision) return Response.json({ code: '40001', message: 'private database diagnostic' }, { status: 409 });
    revision++; payload = body.p_payload; return Response.json({ revision, updated_at: new Date().toISOString() });
  }
  return Response.json(revision ? [{ revision, payload, updated_at: new Date().toISOString() }] : []);
}) as typeof fetch;

// Registration is blocked before a network call until the new passwords match and meet policy.
const pcStorage = storage(), phoneStorage = storage();
pcStorage.setItem('KS_DIGITAL_TWIN_ADB_V1', 'existing-scene');
pcStorage.setItem('KS_ADT_CLOUD_BASE_V1', 'existing-base');
const pc = new CloudStore(transport, pcStorage); await pc.init();
const before = calls.length;
await assert.rejects(() => pc.signUp(user.email, password, 'different', site), { code: 'password_mismatch' });
await assert.rejects(() => pc.signUp(user.email, 'short', 'short', site), { code: 'weak_password' });
assert.equal(calls.length, before);
assert.equal(await pc.signUp(user.email, password, password, site), false);
assert.equal(pc.session, undefined, 'unverified signup is not a logged-in session');
await assert.rejects(() => pc.signIn(user.email, password), { code: 'email_not_confirmed' });
await pc.resendVerification(user.email, site);
assert.equal(pcStorage.getItem('KS_DIGITAL_TWIN_ADB_V1'), 'existing-scene');
assert.equal(pcStorage.getItem('KS_ADT_CLOUD_BASE_V1'), 'existing-base');

// Confirmation/reset callback consumes and removes URL credentials before the scene opens.
function callback(type: 'signup' | 'recovery') {
  let cleaned = '';
  const result = takeAuthCallback({ href: site + '?keep=1#access_token=test-access&refresh_token=test-refresh&type=' + type + '&expires_in=3600&token_type=bearer' }, {
    state: { preserve: true }, replaceState: (state, _title, url) => { assert.deepEqual(state, { preserve: true }); cleaned = String(url); },
  });
  assert.equal(cleaned, '/?keep=1');
  return result!;
}
confirmed = true;
const verificationClient = new CloudStore(transport, phoneStorage); await verificationClient.init(callback('signup'));
assert.equal(verificationClient.userId, user.id); assert.equal(verificationClient.recovering, false);
assert.equal(calls.at(-1)!.path, '/auth/v1/user', 'Auth verifies the token instead of trusting URL/JWT claims');
await pc.signIn(user.email, password);
const stored = JSON.parse(phoneStorage.getItem(key)!); assert.equal(stored.user.id, user.id);

// Real CloudStore API boundaries with two independent device stores, including a saved route.
const truck = newEntity('R14', 0, 0); truck.id = 'test-truck';
const scene = validateScene({ schema: 'KS_DIGITAL_TWIN_V1', airport: 'ADB', entities: [truck], groups: [], source: 'auth-test', routes: [{ id: 'test-route', name: 'PC / phone route', vehicleId: truck.id, points: [[0, 0], [0, -80]], speedKmh: 8, approachKmh: 2, approachDistance: 10 }] });
await pc.save(scene);
const cloudScene = (await verificationClient.read())!; verificationClient.revision = cloudScene.revision;
assert.deepEqual(cloudScene.payload, scene);
await verificationClient.save(scene);
await assert.rejects(() => pc.save(scene), CloudConflict);
assert.equal(revision, 2);

// Recovery email does not change the current session/password. Reloading a recovery retains its mode.
const previousSession = phoneStorage.getItem(key);
await verificationClient.requestPasswordReset(user.email, site);
assert.equal(phoneStorage.getItem(key), previousSession); assert.equal(currentPassword, password);
const recovery = new CloudStore(transport, phoneStorage); await recovery.init(callback('recovery'));
assert.equal(recovery.recovering, true);
const reloaded = new CloudStore(transport, phoneStorage); await reloaded.init(); assert.equal(reloaded.recovering, true);
const beforeUpdate = calls.length;
await assert.rejects(() => reloaded.updatePassword(newPassword, password), { code: 'password_mismatch' });
assert.equal(calls.length, beforeUpdate); assert.equal(currentPassword, password);
await reloaded.updatePassword(newPassword, newPassword); assert.equal(reloaded.recovering, false);
reloaded.signOut(); await assert.rejects(() => reloaded.signIn(user.email, password), { code: 'invalid_credentials' });
await reloaded.signIn(user.email, newPassword); assert.equal(reloaded.userId, user.id);
assert.deepEqual((await reloaded.read())!.payload, scene); assert.equal(revision, 2, 'password reset never writes scenes');
await assert.rejects(() => pc.updatePassword(newPassword, newPassword), { code: 'recovery_required' });

// Failed/expired callbacks do not replace an existing account session or touch scene storage.
const goodSession = pcStorage.getItem(key);
forceError = { status: 401, body: { error_code: 'bad_jwt', message: 'sensitive diagnostic' } };
const failed = new CloudStore(transport, pcStorage); await assert.rejects(() => failed.init(callback('recovery')), CloudError);
assert.equal(pcStorage.getItem(key), goodSession);
assert.equal(pcStorage.getItem('KS_DIGITAL_TWIN_ADB_V1'), 'existing-scene'); forceError = undefined;
let scrubbed = '';
const errorCallback = takeAuthCallback({ href: site + '#error=access_denied&error_code=otp_expired&error_description=SECRET' }, { state: null, replaceState: (_, __, url) => { scrubbed = String(url); } });
assert.deepEqual(errorCallback, { error: 'otp_expired' }); assert.equal(scrubbed, '/');
assert.equal(takeAuthCallback({ href: site + '#home' }, { state: null, replaceState: () => assert.fail('normal URLs must remain unchanged') }), undefined);
assert.equal(authRedirectUrl(site + '?arbitrary=1#anything'), site);

// Friendly errors in both languages; neither raw text nor unknown provider messages escape.
for (const code of ['invalid_credentials', 'email_not_confirmed', 'over_email_send_rate_limit', 'email_address_not_authorized', 'same_password', 'otp_expired', 'signup_disabled', 'refresh_token_not_found']) {
  const e = providerError({ error_code: code, message: 'SECRET RAW MESSAGE' }, 400);
  for (const lang of ['tr', 'en'] as const) { const text = cloudErrorMessage(e, lang); assert.ok(text.length > 15); assert.ok(!text.includes('SECRET')); assert.ok(!text.includes('Invalid login credentials')); }
}
assert.equal(providerError({ msg: 'Invalid login credentials' }, 400).code, 'invalid_credentials');
assert.equal(providerError({ message: 'Error sending recovery email' }, 500).code, 'email_delivery');
assert.equal(providerError({ error_code: 'unknown', message: 'SECRET' }, 429).code, 'over_request_rate_limit');
assert.ok(!cloudErrorMessage(new Error('SECRET'), 'tr').includes('SECRET'));
assert.throws(() => validateNewPassword('short', 'short'), { code: 'weak_password' });
console.log('PASS: signup/confirmation/resend/sign-in/recovery/update; callback token validation and URL cleanup; two isolated cloud clients; account/data preservation; TR/EN error mapping.');
