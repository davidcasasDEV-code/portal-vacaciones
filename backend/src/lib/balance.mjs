// Cálculo de saldos por beneficio.
// Vacaciones según el art. 76 de la Ley Federal del Trabajo (reforma 2023):
//   año 1 = 12, 2 = 14, 3 = 16, 4 = 18, 5 = 20, 6–10 = 22, 11–15 = 24, 16–20 = 26 ...
import { seniority } from './dates.mjs';

export const ACTIVE_STATUSES = ['Pendiente', 'Aprobado'];

export function lftDaysForYear(year, base = 12) {
  if (year <= 0) return 0;
  if (year <= 5) return base + 2 * (year - 1);
  return base + 8 + 2 * Math.ceil((year - 5) / 5);
}

export function lftTable(base = 12, upTo = 35) {
  const rows = [];
  for (let y = 1; y <= 5; y++) rows.push({ desde: y, hasta: y, dias: lftDaysForYear(y, base) });
  for (let y = 6; y <= upTo; y += 5) rows.push({ desde: y, hasta: y + 4, dias: lftDaysForYear(y, base) });
  return rows;
}

// Suma años a una fecha ISO; el 29-feb cae en 28-feb en años no bisiestos.
const addYears = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y + n, m, 0)).getUTCDate();
  return new Date(Date.UTC(y + n, m - 1, Math.min(d, lastDay))).toISOString().slice(0, 10);
};

export function vacationEntitlement(user, beneficio, hoy) {
  const base = Number(beneficio.dias) || 12;
  const ingreso = user.fecha_ingreso;
  const ant = seniority(ingreso, hoy);
  const minimo = Number(beneficio.minimo_meses ?? 6);
  const anticipo = Number(beneficio.anticipo_dias ?? 6);
  const acumulable = beneficio.acumulable !== false;

  const desglose = [];
  for (let y = 1; y <= ant.anios; y++) {
    desglose.push({ anio_servicio: y, dias: lftDaysForYear(y, base), fecha: addYears(ingreso, y) });
  }

  let otorgado;
  let periodoDesde = null;
  if (ant.anios === 0) {
    otorgado = ingreso && ant.totalMeses >= minimo ? anticipo : 0;
  } else if (acumulable) {
    otorgado = desglose.reduce((s, r) => s + r.dias, 0);
  } else {
    otorgado = lftDaysForYear(ant.anios, base);
    periodoDesde = addYears(ingreso, ant.anios);
  }

  const proximo = ingreso
    ? { anio_servicio: ant.anios + 1, dias: lftDaysForYear(ant.anios + 1, base), fecha: addYears(ingreso, ant.anios + 1) }
    : null;

  return { otorgado, periodoDesde, antiguedad: ant, desglose, proximo, acumulable };
}

const appliesTo = (b, genero) => b.activo !== false && (!b.genero || b.genero === 'Todos' || b.genero === genero);

export function applicableBenefits(beneficios, user) {
  return beneficios.filter((b) => appliesTo(b, user.genero)).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
}

/**
 * @param user        registro de Go_Productivity_Usuarios
 * @param beneficios  catálogo completo
 * @param solicitudes solicitudes del usuario (cualquier estatus)
 * @param adicionales saldo adicional del usuario
 * @param hoy         'YYYY-MM-DD'
 */
export function computeBalance(user, beneficios, solicitudes, adicionales, hoy) {
  const year = hoy.slice(0, 4);
  const byKey = Object.fromEntries(beneficios.map((b) => [b.clave, b]));
  const result = {};
  let vacationInfo = null;

  for (const b of applicableBenefits(beneficios, user)) {
    if (b.descuenta_de) continue; // se reporta dentro del beneficio del que descuenta
    const entry = {
      clave: b.clave,
      nombre: b.nombre,
      color: b.color,
      periodo: b.periodo,
      ilimitado: b.periodo === 'ilimitado',
      otorgado: 0,
      adicional: 0,
      usado: 0,
      agendado: 0,
      pendiente: 0,
      disponible: null,
    };
    let periodoDesde = null;
    if (b.periodo === 'lft') {
      vacationInfo = vacationEntitlement(user, b, hoy);
      entry.otorgado = vacationInfo.otorgado;
      periodoDesde = vacationInfo.periodoDesde;
    } else if (b.periodo === 'anual') {
      const ant = seniority(user.fecha_ingreso, hoy);
      entry.otorgado = ant.totalMeses >= Number(b.minimo_meses || 0) ? Number(b.dias) || 0 : 0;
      periodoDesde = `${year}-01-01`;
    }
    entry.adicional = adicionales
      .filter((a) => a.tipo === b.clave && (b.periodo === 'lft' || String(a.anio) === year))
      .reduce((s, a) => s + Number(a.cantidad || 0), 0);
    result[b.clave] = { entry, periodoDesde };
  }

  for (const s of solicitudes) {
    if (!ACTIVE_STATUSES.includes(s.estatus)) continue;
    const b = byKey[s.tipo];
    if (!b) continue;
    const target = result[b.descuenta_de || b.clave];
    if (!target) continue;
    const factor = Number(b.factor ?? 1);
    for (const f of s.fechas || []) {
      if (target.periodoDesde && f < target.periodoDesde) continue;
      if (target.entry.periodo === 'anual' && f.slice(0, 4) !== year) continue;
      if (s.estatus === 'Pendiente') target.entry.pendiente += factor;
      else if (f < hoy) target.entry.usado += factor;
      else target.entry.agendado += factor;
    }
  }

  const saldos = Object.values(result).map(({ entry }) => {
    if (!entry.ilimitado) {
      entry.disponible = round(entry.otorgado + entry.adicional - entry.usado - entry.agendado - entry.pendiente);
    }
    ['usado', 'agendado', 'pendiente'].forEach((k) => (entry[k] = round(entry[k])));
    return entry;
  });

  return { saldos, vacaciones: vacationInfo };
}

const round = (n) => Math.round(n * 100) / 100;

// Días que consume una solicitud del saldo de su beneficio (o del que descuenta).
export function consumption(beneficio, fechas) {
  return round(fechas.length * Number(beneficio.factor ?? 1));
}

export function balanceKeyFor(beneficio) {
  return beneficio.descuenta_de || beneficio.clave;
}
