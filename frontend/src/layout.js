import { session, toggleTheme, currentTheme } from './state.js';
import { html, mount, $, $$, initials, on } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { get } from './api.js';

const NAV = [
  { group: 'Mi espacio' },
  { href: '/', label: 'Inicio', icon: 'home' },
  { href: '/calendario', label: 'Calendario y solicitud', icon: 'calendar-plus' },
  { href: '/solicitudes', label: 'Mis solicitudes', icon: 'list' },
  { href: '/saldos', label: 'Saldos y beneficios', icon: 'wallet' },
  { href: '/equipo', label: 'Mapa del equipo', icon: 'users' },
  { group: 'Gestión', roles: ['Admin', 'Aprobador'] },
  { href: '/aprobaciones', label: 'Aprobaciones', icon: 'check-square', roles: ['Admin', 'Aprobador'], badge: 'aprobaciones' },
  { href: '/reportes', label: 'Reportes', icon: 'chart', roles: ['Admin', 'Aprobador'] },
  { group: 'Administración', roles: ['Admin'] },
  { href: '/admin/usuarios', label: 'Usuarios', icon: 'user', roles: ['Admin'] },
  { href: '/admin/torres', label: 'Torres de servicio', icon: 'building', roles: ['Admin'] },
  { href: '/admin/festivos', label: 'Días festivos', icon: 'flag', roles: ['Admin'] },
  { href: '/admin/beneficios', label: 'Beneficios y ajustes', icon: 'sliders', roles: ['Admin'] },
  { href: '/admin/config', label: 'Configuración', icon: 'settings', roles: ['Admin'] },
];

const allowed = (item) => !item.roles || item.roles.includes(session.user?.rol);

function themeIcon() {
  return icon(currentTheme() === 'dark' ? 'sun' : 'moon');
}

export function renderShell(app) {
  // Se reconstruye si cambió algo visible del usuario (nombre, rol, torre, si aprueba).
  const u = session.user;
  const sig = JSON.stringify([u?.correo, u?.nombre_corto, u?.rol, u?.torre, session.esAprobador]);
  const existing = $('#content', app);
  if (existing && app.dataset.sig === sig) return existing;
  app.dataset.sig = sig;
  const mobileFifth = session.isApprover ? { href: '/aprobaciones', label: 'Aprobar', icon: 'check-square' } : { href: '/saldos', label: 'Saldos', icon: 'wallet' };

  mount(
    app,
    html`
    <div class="shell" id="shell">
      <aside class="sidebar" id="sidebar" aria-label="Menú principal">
        <a class="brand" href="#/">
          <img src="./favicon.svg" alt="" width="40" height="40" />
          <div><b>GO PRODUCTIVITY</b><span>Portal de Vacaciones</span></div>
        </a>
        <nav class="nav">
          ${NAV.filter(allowed).map((item) =>
            item.group
              ? html`<div class="nav-title">${item.group}</div>`
              : html`<a href="#${item.href}" data-path="${item.href}">${icon(item.icon)}<span>${item.label}</span>${item.badge ? html`<span class="badge-count hidden" data-badge="${item.badge}"></span>` : ''}</a>`,
          )}
        </nav>
        <div class="sidebar-foot">© ${new Date().getFullYear()} Go Productivity</div>
      </aside>
      <div class="scrim" data-close-nav></div>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" data-open-nav aria-label="Abrir menú">${icon('menu')}</button>
          <div class="page-title grow" id="page-title"></div>
          <button class="icon-btn" id="theme-btn" aria-label="Cambiar entre modo claro y oscuro" title="Modo claro / oscuro">${themeIcon()}</button>
          <div style="position:relative">
            <button class="user-chip" id="user-btn" aria-haspopup="menu" aria-expanded="false">
              <span class="avatar">${initials(u?.nombre_completo)}</span>
              <span class="user-name small"><b>${u?.nombre_corto}</b><br /><span class="muted xs">${u?.rol}${u?.torre ? ` · ${u.torre}` : ''}</span></span>
              ${icon('chevron-down')}
            </button>
            <div class="menu hidden" id="user-menu" role="menu">
              <a href="#/perfil" role="menuitem">${icon('user')}Mi perfil</a>
              <a href="#/saldos" role="menuitem">${icon('wallet')}Mis saldos</a>
              <hr />
              <button role="menuitem" data-logout>${icon('log-out')}Cerrar sesión</button>
            </div>
          </div>
        </header>
        <main class="content" id="content" tabindex="-1"></main>
      </div>
      <nav class="bottom-nav" aria-label="Navegación rápida">
        ${[
          { href: '/', label: 'Inicio', icon: 'home' },
          { href: '/calendario', label: 'Solicitar', icon: 'calendar-plus' },
          { href: '/solicitudes', label: 'Mis días', icon: 'list' },
          { href: '/equipo', label: 'Equipo', icon: 'users' },
          mobileFifth,
        ].map((i) => html`<a href="#${i.href}" data-path="${i.href}">${icon(i.icon)}<span>${i.label}</span></a>`)}
      </nav>
    </div>`,
  );

  const shell = $('#shell', app);
  const menu = $('#user-menu', app);
  const userBtn = $('#user-btn', app);
  on(shell, 'click', '[data-open-nav]', () => shell.classList.add('nav-open'));
  on(shell, 'click', '[data-close-nav], .nav a', () => shell.classList.remove('nav-open'));
  $('#theme-btn', app).addEventListener('click', (e) => {
    toggleTheme();
    mount(e.currentTarget, themeIcon());
  });
  userBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle('hidden') === false;
    userBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', () => {
    menu.classList.add('hidden');
    userBtn.setAttribute('aria-expanded', 'false');
  });
  on(shell, 'click', '[data-logout]', () => {
    session.clear();
    location.hash = '#/login';
    location.reload();
  });
  return $('#content', app);
}

export function setActiveNav(path) {
  $$('[data-path]').forEach((a) => {
    const match = a.dataset.path === path || (a.dataset.path !== '/' && path.startsWith(a.dataset.path));
    if (match) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// Título del encabezado como ruta: "Gestión → Aprobaciones"
export function setTitle(path, title) {
  const el = $('#page-title');
  if (!el) return;
  let group = null;
  let label = title;
  for (const item of NAV.filter(allowed)) {
    if (item.group) group = item.group;
    else if (item.href === path) {
      label = item.label;
      break;
    }
  }
  if (!NAV.some((i) => i.href === path)) group = null;
  mount(el, group ? html`<span class="muted" style="font-weight:600">${group}</span> <span class="muted" aria-hidden="true">→</span> ${label}` : label);
}

export async function refreshBadges() {
  if (!session.isApprover) return;
  try {
    const r = await get('/aprobaciones?estatus=Pendiente');
    $$('[data-badge="aprobaciones"]').forEach((b) => {
      b.textContent = r.pendientes;
      b.classList.toggle('hidden', !r.pendientes);
    });
  } catch {}
}
