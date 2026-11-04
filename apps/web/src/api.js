let token = null;
let refreshPromise = null;
let onSession = () => undefined;
export function bindSession(callback) {
  onSession = callback;
}
export function acceptSession(data) {
  token = data.accessToken;
  onSession(data.user);
}
export class ApiError extends Error {
  code;
  status;
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export async function refreshSession() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-SS-Client': 'web' },
      body: '{}',
    });
    if (!res.ok) {
      token = null;
      onSession(null);
      return null;
    }
    const data = await res.json();
    acceptSession(data);
    return data.user;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
export async function api(path, options = {}, retry = true) {
  const res = await fetch('/api/v1' + path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-SS-Client': 'web',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (res.status === 401 && data.error === 'TOKEN_EXPIRED' && retry && (await refreshSession()))
    return api(path, options, false);
  if (!res.ok)
    throw new ApiError(
      data.error ?? 'REQUEST_FAILED',
      data.message ??
        (data.error === 'OTP_INVALID'
          ? `Incorrect code. ${data.attemptsLeft ?? 0} attempts left.`
          : (data.error?.replaceAll('_', ' ').toLowerCase() ?? 'Please retry.')),
      res.status,
    );
  return data;
}
export const post = (path, data) => api(path, { method: 'POST', body: JSON.stringify(data) });
export async function signOut() {
  await post('/auth/logout', {});
  token = null;
  onSession(null);
  new BroadcastChannel('solarsaathi-auth').postMessage('logout');
}
export function clearSession() {
  token = null;
  onSession(null);
}
