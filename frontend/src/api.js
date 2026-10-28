import { session } from './state.js';

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  if (!BASE) throw new ApiError(0, 'Falta configurar VITE_API_URL');
  const headers = { 'content-type': 'application/json' };
  if (auth && session.token) headers.authorization = `Bearer ${session.token}`;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'No pudimos conectar con el servidor. Revisa tu conexión a internet.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth) {
      session.clear();
      location.hash = '#/login';
    }
    if (res.status === 403 && /cambiar tu contraseña/.test(data.error || '')) location.hash = '#/cambiar-password';
    throw new ApiError(res.status, data.error || 'Ocurrió un error', data);
  }
  return data;
}

export const get = (p) => api(p);
export const post = (p, body) => api(p, { method: 'POST', body });
export const put = (p, body) => api(p, { method: 'PUT', body });
export const del = (p) => api(p, { method: 'DELETE' });
