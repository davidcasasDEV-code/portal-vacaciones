import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lftDaysForYear, computeBalance, vacationEntitlement } from '../src/lib/balance.mjs';
import { workingDays, seniority, nextOccurrence } from '../src/lib/dates.mjs';

const BENEFICIOS = [
  { clave: 'vacaciones', nombre: 'Vacaciones', periodo: 'lft', dias: 12, minimo_meses: 6, anticipo_dias: 6, acumulable: true },
  { clave: 'dia_personal', nombre: 'Día personal', periodo: 'anual', dias: 2 },
  { clave: 'medio_dia', nombre: 'Medio día', periodo: 'anual', descuenta_de: 'dia_personal', factor: 0.5 },
  { clave: 'maternidad', nombre: 'Maternidad', periodo: 'anual', dias: 84, genero: 'Mujer' },
  { clave: 'enfermedad', nombre: 'Enfermedad', periodo: 'ilimitado' },
];

test('tabla LFT 2023', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 21, 26, 31].map((y) => lftDaysForYear(y)), [12, 14, 16, 18, 20, 22, 22, 24, 24, 26, 28, 30, 32]);
});

test('antigüedad y acumulado', () => {
  assert.deepEqual(seniority('2024-05-20', '2026-10-28'), { anios: 2, meses: 5, totalMeses: 29 });
  assert.equal(seniority('2024-10-29', '2026-10-28').anios, 1);
  const b = BENEFICIOS[0];
  assert.equal(vacationEntitlement({ fecha_ingreso: '2026-06-01' }, b, '2026-10-28').otorgado, 0); // 4 meses
  assert.equal(vacationEntitlement({ fecha_ingreso: '2026-04-01' }, b, '2026-10-28').otorgado, 6); // 6 meses: anticipo
  assert.equal(vacationEntitlement({ fecha_ingreso: '2024-05-20' }, b, '2026-10-28').otorgado, 12 + 14);
  // 10 años: 12+14+16+18+20 + 22*5
  assert.equal(vacationEntitlement({ fecha_ingreso: '2016-10-24' }, b, '2026-10-28').otorgado, 190);
  // No acumulable: solo el año de servicio en curso
  assert.equal(vacationEntitlement({ fecha_ingreso: '2016-10-24' }, { ...b, acumulable: false }, '2026-10-28').otorgado, 22);
});

test('saldo: usado, agendado, pendiente, medio día y género', () => {
  const user = { correo: 'a@x.com', genero: 'Hombre', fecha_ingreso: '2024-05-20' };
  const sol = [
    { tipo: 'vacaciones', estatus: 'Aprobado', fechas: ['2026-01-05', '2026-01-06'] },
    { tipo: 'vacaciones', estatus: 'Aprobado', fechas: ['2026-12-01'] },
    { tipo: 'vacaciones', estatus: 'Pendiente', fechas: ['2026-12-02', '2026-12-03'] },
    { tipo: 'vacaciones', estatus: 'Rechazado', fechas: ['2026-12-04'] },
    { tipo: 'medio_dia', estatus: 'Aprobado', fechas: ['2026-03-02'] },
    { tipo: 'dia_personal', estatus: 'Aprobado', fechas: ['2025-03-02'] }, // otro año: no cuenta
  ];
  const { saldos } = computeBalance(user, BENEFICIOS, sol, [{ tipo: 'dia_personal', cantidad: 1, anio: '2026' }], '2026-10-28');
  const v = saldos.find((s) => s.clave === 'vacaciones');
  assert.deepEqual([v.otorgado, v.usado, v.agendado, v.pendiente, v.disponible], [26, 2, 1, 2, 21]);
  const p = saldos.find((s) => s.clave === 'dia_personal');
  assert.deepEqual([p.otorgado, p.adicional, p.usado, p.disponible], [2, 1, 0.5, 2.5]);
  assert.equal(saldos.some((s) => s.clave === 'maternidad'), false);
  assert.equal(saldos.find((s) => s.clave === 'enfermedad').disponible, null);
});

test('días hábiles sin fines de semana ni festivos', () => {
  // 13 al 20 nov 2026: festivo el lunes 16
  assert.deepEqual(workingDays('2026-11-13', '2026-11-20', new Set(['2026-11-16'])), ['2026-11-13', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
});

test('próxima ocurrencia de cumpleaños', () => {
  assert.equal(nextOccurrence('1990-11-02', '2026-10-28'), '2026-11-02');
  assert.equal(nextOccurrence('1990-01-15', '2026-10-28'), '2027-01-15');
  assert.equal(nextOccurrence('1992-02-29', '2026-10-28'), '2027-02-28');
});
