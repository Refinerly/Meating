export interface ApiRecord {
  id: string;
  [key: string]: unknown;
}

const apiBase = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export const api = {
  me: () => request<{ user: { email: string; name: string | null }; profile: Record<string, unknown> | null }>('me'),
  list: <T extends ApiRecord = ApiRecord>(collection: string, params?: Record<string, string>) => {
    const query = new URLSearchParams(params);
    return request<{ items: T[] }>(`${collection}${query.size ? `?${query}` : ''}`).then(result => result.items);
  },
  create: <T extends ApiRecord = ApiRecord>(collection: string, data: Record<string, unknown>) =>
    request<T>(collection, { method: 'POST', body: JSON.stringify(data) }),
  update: <T extends ApiRecord = ApiRecord>(collection: string, id: string, data: Record<string, unknown>) =>
    request<T>(`${collection}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (collection: string, id: string) =>
    request<{ ok: boolean }>(`${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  profile: (data: Record<string, unknown>) =>
    request<{ profile: Record<string, unknown> }>('profile', { method: 'PATCH', body: JSON.stringify(data) }),
  settings: () => request<{ settings: Record<string, unknown> }>('settings'),
  saveSettings: (data: Record<string, unknown>) =>
    request<{ settings: Record<string, unknown> }>('settings', { method: 'PUT', body: JSON.stringify(data) }),
  health: (date: string) => request<{ item: ApiRecord | null }>(`health-logs/${encodeURIComponent(date)}`),
  saveHealth: (date: string, data: Record<string, unknown>) =>
    request<ApiRecord>(`health-logs/${encodeURIComponent(date)}`, { method: 'PUT', body: JSON.stringify(data) }),
  reset: () => request<{ ok: boolean }>('reset', { method: 'POST' }),
  estimateCalories: (mealName: string) => request<{ calories: number; notes: string }>('estimate-calories', { method: 'POST', body: JSON.stringify({ mealName }) }),
};

export function currentUser() {
  return fetch('/cdn-cgi/access/get-identity')
    .then(response => response.ok ? response.json() : null)
    .then((identity: any) => {
      const email = typeof identity?.email === 'string' ? identity.email : identity?.id?.email;
      const name = typeof identity?.name === 'string' ? identity.name : identity?.id?.name;
      return typeof email === 'string' ? { email, name: typeof name === 'string' ? name : undefined } : null;
    })
    .catch(() => null) as Promise<{ email?: string; name?: string } | null>;
}
