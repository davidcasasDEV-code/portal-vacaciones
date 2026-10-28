import { html, mount, $, toast, setBusy, formData, on } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { api, post } from '../api.js';
import { session, toggleTheme, currentTheme } from '../state.js';
import { resetBoot } from '../main.js';

function authLayout(card) {
  return html`
  <div class="auth">
    <section class="auth-art" aria-hidden="true">
      <span class="orb a"></span><span class="orb b"></span><span class="orb c"></span>
      <div class="row" style="gap:12px">
        <img src="./favicon.svg" alt="" width="44" height="44" style="background:#fff;border-radius:12px;padding:5px" />
        <div><b style="letter-spacing:.08em">GO PRODUCTIVITY</b><div class="small" style="opacity:.8">Portal de Vacaciones</div></div>
      </div>
      <div>
        <h1>Tus días de descanso, claros y en un solo lugar.</h1>
        <p>Solicita vacaciones, consulta tu saldo según la ley, revisa quién está fuera y da seguimiento a tus aprobaciones.</p>
        <div class="features">
          <div>${icon('calendar-plus')}Solicita en segundos desde el calendario</div>
          <div>${icon('scale')}Saldo calculado según la Ley Federal del Trabajo</div>
          <div>${icon('users')}Mapa del equipo, festivos y cumpleaños</div>
        </div>
      </div>
      <div class="small" style="opacity:.7">© ${new Date().getFullYear()} Go Productivity</div>
    </section>
    <section class="auth-panel">
      <button class="icon-btn auth-theme" id="auth-theme" aria-label="Cambiar entre modo claro y oscuro">${icon(currentTheme() === 'dark' ? 'sun' : 'moon')}</button>
      <div class="auth-card">${card}</div>
    </section>
  </div>`;
}

function wireTheme(el) {
  $('#auth-theme', el).addEventListener('click', (e) => {
    toggleTheme();
    mount(e.currentTarget, icon(currentTheme() === 'dark' ? 'sun' : 'moon'));
  });
  on(el, 'click', '[data-toggle-pass]', (e, btn) => {
    const input = btn.parentElement.querySelector('input');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    mount(btn, icon(show ? 'eye-off' : 'eye'));
  });
}

const passwordField = (id, label, autocomplete, hint) => html`
  <div class="field">
    <label for="${id}">${label}</label>
    <div class="input-icon">
      <input class="input" id="${id}" name="${id}" type="password" autocomplete="${autocomplete}" required minlength="${id === 'password' && autocomplete === 'current-password' ? 1 : 8}" />
      <button type="button" class="icon-btn" data-toggle-pass aria-label="Mostrar contraseña">${icon('eye')}</button>
    </div>
    ${hint ? html`<span class="hint">${hint}</span>` : ''}
  </div>`;

function afterLogin(r, remember, navigate) {
  session.set(r, remember);
  resetBoot();
  navigate(r.user.debe_cambiar_password ? '/cambiar-password' : '/');
}

export async function login(el, { navigate, query }) {
  mount(
    el,
    authLayout(html`
      <img class="logo" src="./logo-go-productivity.png" alt="Go Productivity" width="120" height="114" />
      <h2>Bienvenido</h2>
      <p class="sub">Inicia sesión con tu correo de trabajo</p>
      <div id="login-msg"></div>
      <form id="login-form" class="stack" novalidate>
        <div class="field">
          <label for="correo">Correo electrónico</label>
          <input class="input" id="correo" name="correo" type="email" autocomplete="username" required value="${query.correo || ''}" autofocus />
        </div>
        ${passwordField('password', 'Contraseña', 'current-password')}
        <div class="row between">
          <label class="check"><input type="checkbox" name="recordar" /> Recordarme en este equipo</label>
        </div>
        <button class="btn block" type="submit">${icon('lock')}Entrar</button>
      </form>
      <a class="btn ghost block" href="#/recuperar">¿Primera vez u olvidaste tu contraseña?</a>
    `),
  );
  wireTheme(el);
  $('#login-form', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    const msg = $('#login-msg', el);
    if (!f.correo || !f.password) {
      mount(msg, html`<div class="alert bad">${icon('alert')}<div>Escribe tu correo y contraseña.</div></div>`);
      return;
    }
    setBusy(btn, true, 'Entrando…');
    try {
      const r = await api('/auth/login', { method: 'POST', body: { correo: f.correo, password: f.password }, auth: false });
      afterLogin(r, Boolean(f.recordar), navigate);
    } catch (err) {
      mount(msg, html`<div class="alert bad" role="alert">${icon('alert')}<div>${err.message}</div></div>`);
      setBusy(btn, false);
    }
  });
}

export async function recover(el, { navigate, query }) {
  let correo = query.correo || '';
  const step1 = () => html`
    <h2>Crear o recuperar contraseña</h2>
    <p class="sub">Te enviaremos un código de 6 dígitos a tu correo de trabajo.</p>
    <div id="msg"></div>
    <form id="f1" class="stack" novalidate>
      <div class="field">
        <label for="correo">Correo electrónico</label>
        <input class="input" id="correo" name="correo" type="email" autocomplete="username" required value="${correo}" autofocus />
      </div>
      <button class="btn block" type="submit">${icon('mail')}Enviar código</button>
    </form>
    <a class="btn ghost block" href="#/login">${icon('chevron-left')}Volver a iniciar sesión</a>`;
  const step2 = () => html`
    <h2>Revisa tu correo</h2>
    <p class="sub">Enviamos un código a <b>${correo}</b>. Puede tardar un minuto; revisa también tu carpeta de spam.</p>
    <div id="msg"></div>
    <form id="f2" class="stack" novalidate>
      <div class="field">
        <label for="codigo">Código de verificación</label>
        <input class="input mono" id="codigo" name="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required style="font-size:1.4rem;letter-spacing:.4em;text-align:center" autofocus />
      </div>
      ${passwordField('password', 'Nueva contraseña', 'new-password', 'Mínimo 8 caracteres, con letras y números.')}
      ${passwordField('password2', 'Confirma tu contraseña', 'new-password')}
      <button class="btn block" type="submit">${icon('check')}Guardar contraseña y entrar</button>
    </form>
    <button class="btn ghost block" id="resend">¿No llegó? Enviar otro código</button>`;

  const show = (view) => {
    mount(el, authLayout(view()));
    wireTheme(el);
    bind();
  };
  const bind = () => {
    $('#f1', el)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      correo = formData(e.target).correo.trim();
      const btn = e.target.querySelector('button');
      setBusy(btn, true, 'Enviando…');
      try {
        const r = await api('/auth/recuperar', { method: 'POST', body: { correo }, auth: false });
        toast(r.mensaje, 'ok');
        show(step2);
      } catch (err) {
        mount($('#msg', el), html`<div class="alert bad">${icon('alert')}<div>${err.message}</div></div>`);
        setBusy(btn, false);
      }
    });
    $('#f2', el)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = formData(e.target);
      const msg = $('#msg', el);
      if (f.password !== f.password2) {
        mount(msg, html`<div class="alert bad">${icon('alert')}<div>Las contraseñas no coinciden.</div></div>`);
        return;
      }
      const btn = e.target.querySelector('button[type=submit]');
      setBusy(btn, true, 'Guardando…');
      try {
        const r = await api('/auth/recuperar/confirmar', { method: 'POST', body: { correo, codigo: f.codigo, password: f.password }, auth: false });
        toast('¡Listo! Tu contraseña quedó guardada.', 'ok');
        afterLogin(r, false, navigate);
      } catch (err) {
        mount(msg, html`<div class="alert bad" role="alert">${icon('alert')}<div>${err.message}</div></div>`);
        setBusy(btn, false);
      }
    });
    $('#resend', el)?.addEventListener('click', async (e) => {
      setBusy(e.currentTarget, true, 'Enviando…');
      try {
        const r = await api('/auth/recuperar', { method: 'POST', body: { correo }, auth: false });
        toast(r.mensaje, 'ok');
      } catch (err) {
        toast(err.message, 'bad');
      }
      setBusy(e.currentTarget, false);
    });
  };
  show(step1);
}

export async function forceChange(el, { navigate }) {
  const forced = session.user?.debe_cambiar_password;
  mount(
    el,
    authLayout(html`
      <h2>${forced ? 'Actualiza tu contraseña' : 'Cambiar contraseña'}</h2>
      <p class="sub">${forced ? 'Por seguridad necesitas definir una nueva contraseña antes de continuar.' : 'Elige una contraseña segura.'}</p>
      <div id="msg"></div>
      <form id="fc" class="stack" novalidate>
        ${passwordField('actual', forced ? 'Contraseña temporal o actual' : 'Contraseña actual', 'current-password')}
        ${passwordField('nueva', 'Nueva contraseña', 'new-password', 'Mínimo 8 caracteres, con letras y números.')}
        ${passwordField('nueva2', 'Confirma la nueva contraseña', 'new-password')}
        <button class="btn block" type="submit">${icon('check')}Guardar</button>
      </form>
      ${forced
        ? html`<button class="btn ghost block" data-out>${icon('log-out')}Cerrar sesión</button>`
        : html`<a class="btn ghost block" href="#/perfil">${icon('chevron-left')}Volver</a>`}
    `),
  );
  wireTheme(el);
  on(el, 'click', '[data-out]', () => {
    session.clear();
    location.hash = '#/login';
    location.reload();
  });
  $('#fc', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const msg = $('#msg', el);
    if (f.nueva !== f.nueva2) {
      mount(msg, html`<div class="alert bad">${icon('alert')}<div>Las contraseñas nuevas no coinciden.</div></div>`);
      return;
    }
    const btn = e.target.querySelector('button[type=submit]');
    setBusy(btn, true, 'Guardando…');
    try {
      const r = await post('/auth/cambiar-password', { actual: f.actual, nueva: f.nueva });
      session.set(r);
      resetBoot();
      toast('Contraseña actualizada', 'ok');
      navigate('/');
    } catch (err) {
      mount(msg, html`<div class="alert bad" role="alert">${icon('alert')}<div>${err.message}</div></div>`);
      setBusy(btn, false);
    }
  });
}
