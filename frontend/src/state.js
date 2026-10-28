// Estado de sesión. El token vive en sessionStorage (o localStorage con "Recordarme")
// y expira en el servidor; la autorización real siempre la valida la API.
const KEY = 'gp-session';

const storage = {
  read() {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || 'null');
    } catch {
      return null;
    }
  },
  write(v, remember) {
    try {
      const s = JSON.stringify(v);
      (remember ? localStorage : sessionStorage).setItem(KEY, s);
      (remember ? sessionStorage : localStorage).removeItem(KEY);
    } catch {}
  },
  clear() {
    try {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
    } catch {}
  },
};

const saved = storage.read();

export const session = {
  token: saved?.token || null,
  user: saved?.user || null,
  remember: Boolean(saved?.remember),
  esAprobador: false,
  catalogos: null,
  set({ token, user }, remember = this.remember) {
    if (token) this.token = token;
    if (user) this.user = user;
    this.remember = remember;
    storage.write({ token: this.token, user: this.user, remember }, remember);
  },
  clear() {
    this.token = null;
    this.user = null;
    this.catalogos = null;
    storage.clear();
  },
  get isAdmin() {
    return this.user?.rol === 'Admin';
  },
  get isApprover() {
    return this.user?.rol === 'Admin' || this.user?.rol === 'Aprobador';
  },
};

// Tema claro/oscuro
export function currentTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('gp-theme', next);
  } catch {}
  window.dispatchEvent(new CustomEvent('themechange'));
  return next;
}
