// API client. In demo mode the acting user travels in x-user-id; in OIDC mode
// every call carries the signed-in user's bearer token.
let demoUser = 'auditor';
let tokenProvider: (() => Promise<string | null>) | null = null;

export function setApiUser(id: string) {
  demoUser = id;
}

export function setTokenProvider(fn: (() => Promise<string | null>) | null) {
  tokenProvider = fn;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function headers(json = true): Promise<Record<string, string>> {
  const h: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {};
  if (tokenProvider) {
    const token = await tokenProvider();
    if (token) h.Authorization = `Bearer ${token}`;
  } else {
    h['x-user-id'] = demoUser;
  }
  return h;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    headers: await headers(),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  const data = text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
  if (!res.ok) throw new ApiError((data as { error?: string })?.error ?? `HTTP ${res.status}`, res.status);
  return data as T;
}

/** Authenticated file download (report, CSV export). */
export async function download(path: string, filename: string) {
  const res = await fetch(`/api${path}`, { headers: await headers(false) });
  if (!res.ok) throw new ApiError(`Download failed (HTTP ${res.status})`, res.status);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
