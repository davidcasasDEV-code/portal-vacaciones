import './styles/app.css';
import { session } from './state.js';
import { get } from './api.js';
import { html, mount, toast, topScrollbar } from './ui/dom.js';
import { renderShell, setActiveNav, setTitle, refreshBadges } from './layout.js';

// Rutas: el módulo de cada página se carga bajo demanda.
const routes = {
  '/login': { title: 'Iniciar sesión', public: true, load: () => import('./pages/auth.js').then((m) => m.login) },
  '/recuperar': { title: 'Recuperar acceso', public: true, load: () => import('./pages/auth.js').then((m) => m.recover) },
  '/cambiar-password': { title: 'Cambiar contraseña', bare: true, load: () => import('./pages/auth.js').then((m) => m.forceChange) },
  '/': { title: 'Inicio', load: () => import('./pages/inicio.js') },
  '/calendario': { title: 'Calendario', load: () => import('./pages/calendario.js') },
  '/solicitudes': { title: 'Mis solicitudes', load: () => import('./pages/solicitudes.js') },
  '/saldos': { title: 'Mis saldos y beneficios', load: () => import('./pages/saldos.js') },
  '/equipo': { title: 'Mapa del equipo', load: () => import('./pages/equipo.js') },
  '/aprobaciones': { title: 'Aprobaciones', roles: ['Admin', 'Aprobador'], load: () => import('./pages/aprobaciones.js') },
  '/reportes': { title: 'Reportes', roles: ['Admin', 'Aprobador'], load: () => import('./pages/reportes.js') },
  '/admin/usuarios': { title: 'Usuarios', roles: ['Admin'], load: () => import('./pages/admin-usuarios.js') },
  '/admin/torres': { title: 'Torres de servicio', roles: ['Admin'], load: () => import('./pages/admin-torres.js') },
  '/admin/festivos': { title: 'Días festivos', roles: ['Admin'], load: () => import('./pages/admin-festivos.js') },
  '/admin/beneficios': { title: 'Beneficios y ajustes', roles: ['Admin'], load: () => import('./pages/admin-beneficios.js') },
  '/admin/config': { title: 'Configuración', roles: ['Admin'], load: () => import('./pages/admin-config.js') },
  '/perfil': { title: 'Mi perfil', load: () => import('./pages/perfil.js') },
};

const app = document.getElementById('app');
let cleanup = null;
let booted = false;

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export const navigate = (to) => {
  if (location.hash === `#${to}`) render();
  else location.hash = to;
};

export async function loadCatalogos(force = false) {
  if (session.catalogos && !force) return session.catalogos;
  const c = await get('/catalogos');
  c.beneficiosMap = Object.fromEntries(c.beneficios.map((b) => [b.clave, b]));
  c.festivosMap = Object.fromEntries(c.festivos.map((f) => [f.fecha, f]));
  session.catalogos = c;
  return c;
}

async function bootSession() {
  const me = await get('/me');
  session.set({ user: me.user });
  session.esAprobador = me.es_aprobador;
  session.aprobadores = me.aprobadores;
  booted = true;
}

async function render() {
  const { path, query } = parseHash();
  const route = routes[path];
  if (!route) return navigate('/');

  if (!route.public && !session.token) return navigate('/login');
  if (route.public && session.token && path === '/login') return navigate('/');

  if (!route.public && !booted) {
    try {
      mount(app, html`<div class="auth-panel" style="min-height:100dvh"><div class="skeleton" style="width:220px;height:22px"></div></div>`);
      await bootSession();
    } catch (e) {
      if (e.status !== 401) toast(e.message, 'bad');
      return;
    }
  }

  const u = session.user;
  if (!route.public) {
    if (u?.debe_cambiar_password && path !== '/cambiar-password') return navigate('/cambiar-password');
    if (!u?.debe_cambiar_password && u?.perfil_incompleto?.length && path !== '/perfil' && path !== '/cambiar-password') {
      return navigate('/perfil?completar=1');
    }
    if (route.roles && !route.roles.includes(u.rol)) {
      toast('No tienes acceso a esa sección', 'bad');
      return navigate('/');
    }
  }

  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  document.title = `${route.title} · Vacaciones Go Productivity`;

  let target = app;
  if (!route.public && !route.bare) {
    target = renderShell(app);
    setActiveNav(path);
    setTitle(path, route.title);
  }
  // Contenedor nuevo por navegación: los listeners delegados de la página anterior se descartan.
  const pageEl = document.createElement('div');
  target.replaceChildren(pageEl);
  target = pageEl;
  mount(target, html`<div class="loading-page"><div class="skeleton" style="height:120px"></div><div class="grid cols-3"><div class="skeleton" style="height:140px"></div><div class="skeleton" style="height:140px"></div><div class="skeleton" style="height:140px"></div></div></div>`);
  try {
    const page = await route.load();
    const fn = page.default || page;
    cleanup = await fn(target, { query, navigate, render });
    target.querySelector('h1')?.setAttribute('tabindex', '-1');
    if (!route.public && !route.bare) refreshBadges();
  } catch (e) {
    console.error(e);
    if (e.status === 401) return;
    mount(target, html`<div class="alert bad"><div><b>No pudimos cargar esta sección.</b><br>${e.message}</div></div>`);
  }
}

export function resetBoot() {
  booted = false;
}

// Toda tabla con desplazamiento horizontal recibe también una barra arriba.
new MutationObserver(() => app.querySelectorAll('.table-wrap, .map-wrap').forEach(topScrollbar)).observe(app, { childList: true, subtree: true });

window.addEventListener('hashchange', render);
render();
