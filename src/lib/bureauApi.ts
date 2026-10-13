import { getBureauToken } from './bureauSession';

export async function bureauFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getBureauToken();
  if (!token) {
    throw new Error('Session bureau expirée. Reconnectez-vous.');
  }
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return data as T;
}
