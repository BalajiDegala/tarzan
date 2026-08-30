const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:5173/api';
const email = `m1.${Date.now()}@example.test`;
const password = 'StrongPass1';

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

function report(label, actual, expected) {
  const passed = actual === expected;
  console.log(`${label}=${passed ? 'PASS' : `FAIL (${String(actual)})`}`);

  if (!passed) {
    process.exitCode = 1;
  }
}

const registerResponse = await request('/auth/register', {
  body: JSON.stringify({ email, name: 'M1 Test User', password }),
  headers: { 'Content-Type': 'application/json' },
  method: 'POST',
});
const registerBody = await registerResponse.json();
const setCookie = registerResponse.headers.get('set-cookie') ?? '';
const cookie = setCookie.split(';', 1)[0];

report('REGISTER_STATUS', registerResponse.status, 201);
report('REGISTER_USER', registerBody.user?.email, email);
report('COOKIE_HTTP_ONLY', setCookie.includes('HttpOnly'), true);
report('COOKIE_SAMESITE_LAX', setCookie.includes('SameSite=Lax'), true);

const meResponse = await request('/auth/me', {
  headers: { Cookie: cookie },
});
const meBody = await meResponse.json();
report('ME_STATUS', meResponse.status, 200);
report('ME_USER', meBody.user?.email, email);

const logoutResponse = await request('/auth/logout', {
  headers: { Cookie: cookie },
  method: 'POST',
});
report('LOGOUT_STATUS', logoutResponse.status, 204);

const staleSessionResponse = await request('/auth/me', {
  headers: { Cookie: cookie },
});
report('STALE_SESSION_REJECTED', staleSessionResponse.status, 401);

const loginResponse = await request('/auth/login', {
  body: JSON.stringify({ email, password }),
  headers: { 'Content-Type': 'application/json' },
  method: 'POST',
});
report('LOGIN_STATUS', loginResponse.status, 200);
