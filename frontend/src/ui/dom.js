import { icon } from './icons.js';

// Plantillas HTML con escape automático. Usa raw() solo para HTML ya confiable.
const RAW = Symbol('raw');
export const raw = (s) => ({ [RAW]: String(s ?? '') });
export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function serialize(v) {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(serialize).join('');
  if (typeof v === 'object' && RAW in v) return v[RAW];
  return esc(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => (out += serialize(v) + strings[i + 1]));
  return raw(out);
}

// Acepta html``, arreglos de html`` o texto plano (que se escapa).
export const toStr = (h) => serialize(h);

export function mount(el, h) {
  el.innerHTML = toStr(h);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function on(root, event, selector, handler) {
  root.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}

// ---------- Toasts ----------
export function toast(message, type = 'info', ms = 5000) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = toStr(html`${icon(type === 'ok' ? 'check-circle' : type === 'bad' ? 'alert' : 'info')}<div>${message}</div>`);
  box.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- Modal accesible ----------
export function openModal({ title, body, footer, size = '', onClose } = {}) {
  const prevFocus = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const id = `m${Math.random().toString(36).slice(2, 8)}`;
  backdrop.innerHTML = toStr(html`
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <div class="modal-head">
        <h2 id="${id}">${title}</h2>
        <button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button>
      </div>
      <div class="modal-body">${body || ''}</div>
      ${footer ? html`<div class="modal-foot">${footer}</div>` : ''}
    </div>`);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  const modal = backdrop.querySelector('.modal');

  const close = (result) => {
    backdrop.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    prevFocus?.focus?.();
    onClose?.(result);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) (e.preventDefault(), f.at(-1).focus());
      else if (!e.shiftKey && document.activeElement === f.at(-1)) (e.preventDefault(), f[0].focus());
    }
  };
  document.addEventListener('keydown', onKey);
  backdrop.addEventListener('mousedown', (e) => e.target === backdrop && close());
  on(backdrop, 'click', '[data-close]', () => close());
  setTimeout(() => (modal.querySelector('[autofocus]') || modal.querySelector('input,select,textarea,button:not([data-close])'))?.focus(), 30);
  return { el: modal, body: modal.querySelector('.modal-body'), foot: modal.querySelector('.modal-foot'), close };
}

export function confirmDialog({ title = '¿Confirmas?', message, confirmText = 'Confirmar', danger = false, input = null }) {
  return new Promise((resolve) => {
    const m = openModal({
      title,
      size: 'sm',
      body: html`<p>${message}</p>${input
        ? html`<div class="field" style="margin-top:14px"><label for="cd-input">${input.label}</label><textarea class="input" id="cd-input" placeholder="${input.placeholder || ''}"></textarea></div>`
        : ''}`,
      footer: html`<button class="btn secondary" data-close>Cancelar</button><button class="btn ${danger ? 'danger' : ''}" data-ok>${confirmText}</button>`,
      onClose: (r) => resolve(r ?? null),
    });
    m.el.querySelector('[data-ok]').addEventListener('click', () => {
      const value = input ? m.el.querySelector('#cd-input').value.trim() : true;
      if (input?.required && !value) {
        m.el.querySelector('#cd-input').focus();
        toast(input.requiredMessage || 'Este campo es obligatorio', 'bad');
        return;
      }
      m.close(input ? { value } : true);
    });
  });
}

export function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = toStr(html`${icon('loader', 'spin')}<span>${label || 'Procesando…'}</span>`);
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

export const formData = (form) => Object.fromEntries(new FormData(form).entries());

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

// Agrega una barra de desplazamiento horizontal arriba de un contenedor con scroll,
// sincronizada con la de abajo. Solo se muestra cuando el contenido no cabe.
export function topScrollbar(wrap) {
  if (!wrap || wrap.previousElementSibling?.classList.contains('scroll-top')) return;
  const bar = document.createElement('div');
  bar.className = 'scroll-top';
  bar.setAttribute('aria-hidden', 'true');
  const inner = document.createElement('div');
  bar.appendChild(inner);
  wrap.before(bar);
  const sync = () => {
    inner.style.width = `${wrap.scrollWidth}px`;
    bar.classList.toggle('hidden', wrap.scrollWidth <= wrap.clientWidth + 1);
    bar.scrollLeft = wrap.scrollLeft;
  };
  // Solo se asigna si difiere, así el evento reflejado no genera un ciclo.
  const link = (from, to) =>
    from.addEventListener('scroll', () => {
      if (Math.abs(to.scrollLeft - from.scrollLeft) > 1) to.scrollLeft = from.scrollLeft;
    });
  link(bar, wrap);
  link(wrap, bar);
  new ResizeObserver(sync).observe(wrap);
  if (wrap.firstElementChild) new ResizeObserver(sync).observe(wrap.firstElementChild);
  sync();
}

export const emptyState =(text, ic = 'inbox') => html`<div class="empty">${icon(ic)}<div>${text}</div></div>`;
