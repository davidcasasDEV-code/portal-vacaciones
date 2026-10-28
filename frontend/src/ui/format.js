import { html } from './dom.js';

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const DIAS_C = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DIAS_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const d = (iso) => new Date(`${iso}T00:00:00Z`);
export const dow = (iso) => d(iso).getUTCDay();
export const isWeekend = (iso) => [0, 6].includes(dow(iso));

export function fmtDate(iso, { year = true, weekday = false } = {}) {
  if (!iso) return '—';
  const [y, m, dd] = iso.slice(0, 10).split('-');
  const base = `${Number(dd)} ${MESES_C[Number(m) - 1]}${year ? ` ${y}` : ''}`;
  return weekday ? `${DIAS_C[dow(iso.slice(0, 10))]} ${base}` : base;
}

export function fmtRange(a, b) {
  if (!a) return '—';
  if (a === b || !b) return fmtDate(a, { weekday: true });
  if (a.slice(0, 7) === b.slice(0, 7)) return `${Number(a.slice(8))}–${fmtDate(b)}`;
  if (a.slice(0, 4) === b.slice(0, 4)) return `${fmtDate(a, { year: false })} – ${fmtDate(b)}`;
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}

export function fmtDateTime(isoTs) {
  if (!isoTs) return '—';
  const dt = new Date(isoTs);
  return dt.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function addDays(iso, n) {
  const x = d(iso);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function eachDay(a, b) {
  const out = [];
  for (let x = a; x <= b; x = addDays(x, 1)) out.push(x);
  return out;
}

export function monthDays(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
}

export function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1 + n, 1));
  return x.toISOString().slice(0, 7);
}

export const monthLabel = (ym) => `${MESES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export const num = (n) => (n === null || n === undefined ? '—' : Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

export const plural = (n, one, many) => `${num(n)} ${Number(n) === 1 ? one : many}`;

export function relDays(n) {
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  return `En ${n} días`;
}

export const statusBadge = (s) => html`<span class="badge ${s}">${s}</span>`;

export function tipoChip(tipo, beneficios) {
  const b = beneficios?.[tipo];
  return html`<span class="tag"><span class="dot" style="background:${b?.color || '#999'}"></span>${b?.nombre || tipo}</span>`;
}

// Color de texto legible sobre un fondo dado.
export function inkFor(hex) {
  const n = parseInt(String(hex || '#000').slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#10233b' : '#ffffff';
}

export function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
