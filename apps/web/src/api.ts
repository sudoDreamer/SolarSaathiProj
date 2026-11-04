export interface Viewer {
  id: string;
  displayName: string;
  role: 'USER' | 'ANALYST' | 'ADMIN';
  mobileMasked: string;
  preferredLang: string;
}
let token: string | null = null;
let refreshPromise: Promise<Viewer | null> | null = null;
let onSession: (user: Viewer | null) => void = () => undefined;
export function bindSession(callback: typeof onSession) {
  onSession = callback;
}
export function acceptSession(data: { accessToken: string; user: Viewer }) {
  token = data.accessToken;
  onSession(data.user);
}
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function refreshSession(): Promise<Viewer | null> {
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
    const data = (await res.json()) as { accessToken: string; user: Viewer };
    acceptSession(data);
    return data.user;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
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
  const data = (await res.json()) as T & {
    error?: string;
    message?: string;
    attemptsLeft?: number;
  };
  if (res.status === 401 && data.error === 'TOKEN_EXPIRED' && retry && (await refreshSession()))
    return api<T>(path, options, false);
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
export const post = <T>(path: string, data: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data) });
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
