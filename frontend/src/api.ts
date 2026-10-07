let currentUser = 'auditor';

export function setApiUser(id: string) {
  currentUser = id;
}

export class ApiError extends Error {}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  const data = text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
  if (!res.ok) throw new ApiError((data as { error?: string })?.error ?? `HTTP ${res.status}`);
  return data as T;
}
