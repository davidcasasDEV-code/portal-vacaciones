// Todas las fechas de negocio son cadenas ISO 'YYYY-MM-DD' interpretadas en UTC,
// para que no dependan de la zona horaria del servidor o del navegador.
import { APP_TZ } from './config.mjs';

export function todayISO(tz = APP_TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const toDate = (iso) => new Date(`${iso}T00:00:00Z`);
const toISO = (d) => d.toISOString().slice(0, 10);

export function addDays(iso, n) {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export function eachDay(desde, hasta) {
  const out = [];
  for (let d = desde; d <= hasta; d = addDays(d, 1)) out.push(d);
  return out;
}

export const weekday = (iso) => toDate(iso).getUTCDay(); // 0 = domingo
export const isWeekend = (iso) => [0, 6].includes(weekday(iso));

// Días hábiles (lunes a viernes, sin festivos) dentro del rango.
export function workingDays(desde, hasta, holidaySet) {
  return eachDay(desde, hasta).filter((d) => !isWeekend(d) && !holidaySet.has(d));
}

export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { desde: `${ym}-01`, hasta: `${ym}-${String(last).padStart(2, '0')}` };
}

// Años y meses completos de antigüedad a la fecha `hoy`.
export function seniority(ingreso, hoy) {
  if (!ingreso) return { anios: 0, meses: 0, totalMeses: 0 };
  const [y1, m1, d1] = ingreso.split('-').map(Number);
  const [y2, m2, d2] = hoy.split('-').map(Number);
  let total = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) total -= 1;
  total = Math.max(0, total);
  return { anios: Math.floor(total / 12), meses: total % 12, totalMeses: total };
}

// Próxima ocurrencia (>= hoy) de un mes-día, p. ej. cumpleaños o aniversario.
export function nextOccurrence(iso, hoy) {
  if (!iso) return null;
  const md = iso.slice(5);
  const year = Number(hoy.slice(0, 4));
  let candidate = `${year}-${md}`;
  if (md === '02-29' && !isLeap(year)) candidate = `${year}-02-28`;
  if (candidate < hoy) {
    candidate = `${year + 1}-${md}`;
    if (md === '02-29' && !isLeap(year + 1)) candidate = `${year + 1}-02-28`;
  }
  return candidate;
}

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function diffDays(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86_400_000);
}
