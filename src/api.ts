import type { Attempt, Bank, Connection, Mode, PsuType } from '../shared/types';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/import${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `${response.status} ${response.statusText}`);
  return data as T;
}

export const api = {
  banks: (country: string) => request<Bank[]>('GET', `/connections/banks?country=${country}`),
  connections: () => request<Connection[]>('GET', '/connections'),
  addConnection: (input: { bank: string; country: string; psuType: PsuType; accountName?: string }) =>
    request<{ connection: Connection; authUrl: string }>('POST', '/connections', input),
  updateConnection: (id: string, patch: { accountName?: string; enabled?: boolean }) =>
    request<Connection>('PATCH', `/connections/${id}`, patch),
  deleteConnection: (id: string) => request<void>('DELETE', `/connections/${id}`),
  authorize: (id: string) => request<{ authUrl: string }>('POST', `/connections/${id}/authorize`, {}),
  fetch: (mode: Mode, connectionId?: string) => request<Attempt[]>('POST', '/fetch', { mode, connectionId }),
  attempts: (limit = 50) => request<Attempt[]>('GET', `/attempts?limit=${limit}`),
};
