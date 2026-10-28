// Siembra la configuración, el catálogo de beneficios y los días festivos.
// Es idempotente: no sobrescribe registros existentes (los admin pueden editarlos
// desde el portal). Uso: node infra/seed-config.mjs [--app-url=https://...]
import crypto from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { T, S, log } from './settings.mjs';

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });

async function putIfMissing(TableName, Item, keyName) {
  const exists = await doc.send(new GetCommand({ TableName, Key: { [keyName]: Item[keyName] } }));
  if (exists.Item) return false;
  await doc.send(new PutCommand({ TableName, Item }));
  return true;
}

export async function setConfig(clave, valor) {
  await doc.send(new PutCommand({ TableName: T.config, Item: { clave, valor } }));
}

export const BENEFICIOS = [
  { clave: 'vacaciones', nombre: 'Vacaciones', abreviatura: 'V', periodo: 'lft', dias: 12, minimo_meses: 6, anticipo_dias: 6, acumulable: true, genero: 'Todos', requiere_saldo: true, requiere_backup: true, color: '#1E6FD9', orden: 1, descripcion: 'Días de vacaciones según la Ley Federal del Trabajo (art. 76) de acuerdo con tu antigüedad. A los 6 meses se otorga un anticipo.' },
  { clave: 'dia_personal', nombre: 'Día personal', abreviatura: 'DP', periodo: 'anual', dias: 2, minimo_meses: 0, genero: 'Todos', requiere_saldo: true, requiere_backup: true, color: '#7C5CD6', orden: 2, descripcion: 'Días personales por año calendario. No son acumulables.' },
  { clave: 'medio_dia', nombre: 'Medio día', abreviatura: 'MD', periodo: 'anual', descuenta_de: 'dia_personal', factor: 0.5, un_solo_dia: true, genero: 'Todos', requiere_saldo: true, requiere_backup: false, color: '#A78BFA', orden: 3, descripcion: 'Medio día que descuenta 0.5 de tus días personales.' },
  { clave: 'cumpleanos', nombre: 'Cumpleaños', abreviatura: 'C', periodo: 'anual', dias: 1, minimo_meses: 0, genero: 'Todos', requiere_saldo: true, requiere_backup: true, color: '#E8A33D', orden: 4, descripcion: 'Un día libre por tu cumpleaños cada año.' },
  { clave: 'enfermedad', nombre: 'Enfermedad', abreviatura: 'E', periodo: 'ilimitado', genero: 'Todos', requiere_saldo: false, requiere_backup: false, permite_retroactivo: true, color: '#E05A5A', orden: 5, descripcion: 'Ausencia por enfermedad. No descuenta saldo y puede registrarse en fechas pasadas.' },
  { clave: 'permiso', nombre: 'Permiso sin goce de sueldo', abreviatura: 'P', periodo: 'ilimitado', genero: 'Todos', requiere_saldo: false, requiere_backup: true, color: '#6B7A8F', orden: 6, descripcion: 'Permiso sin goce de sueldo, sujeto a aprobación.' },
  { clave: 'paternidad', nombre: 'Licencia por nacimiento y/o adopción (padre)', abreviatura: 'PT', periodo: 'anual', dias: 5, minimo_meses: 0, genero: 'Hombre', requiere_saldo: true, requiere_backup: true, color: '#2BA59B', orden: 7, descripcion: 'Licencia de paternidad por nacimiento o adopción de hijos (art. 132 LFT).' },
  { clave: 'maternidad', nombre: 'Licencia por maternidad (madre)', abreviatura: 'MT', periodo: 'anual', dias: 84, minimo_meses: 0, genero: 'Mujer', requiere_saldo: true, requiere_backup: true, color: '#D6619E', orden: 8, descripcion: 'Licencia por maternidad (art. 170 LFT).' },
  { clave: 'adopcion_madre', nombre: 'Licencia por adopción (madre)', abreviatura: 'AD', periodo: 'anual', dias: 42, minimo_meses: 0, genero: 'Mujer', requiere_saldo: true, requiere_backup: true, color: '#C77DBA', orden: 9, descripcion: 'Licencia por adopción (art. 170 LFT).' },
  { clave: 'fallecimiento', nombre: 'Fallecimiento de familiar', abreviatura: 'F', periodo: 'anual', dias: 3, minimo_meses: 0, genero: 'Todos', requiere_saldo: true, requiere_backup: false, permite_retroactivo: true, color: '#4A4E69', orden: 10, descripcion: 'Días por fallecimiento de un familiar directo.' },
];

const O = 'Oficial';
const E = 'Empresa';
export const FESTIVOS = [
  ['2024-01-01', 'Año Nuevo', O], ['2024-02-05', 'Día de la Constitución', O], ['2024-03-18', 'Natalicio de Benito Juárez', O],
  ['2024-05-01', 'Día del Trabajo', O], ['2024-09-16', 'Día de la Independencia', O], ['2024-11-18', 'Revolución Mexicana', O], ['2024-12-25', 'Navidad', O],
  ['2025-01-01', 'Año Nuevo', O], ['2025-02-03', 'Día de la Constitución', O], ['2025-03-17', 'Natalicio de Benito Juárez', O],
  ['2025-04-17', 'Jueves Santo', E], ['2025-04-18', 'Viernes Santo', E], ['2025-05-01', 'Día del Trabajo', O], ['2025-09-16', 'Día de la Independencia', O],
  ['2025-11-17', 'Revolución Mexicana', O], ['2025-12-24', 'Nochebuena', E], ['2025-12-25', 'Navidad', O], ['2025-12-31', 'Último día del año', E],
  ['2026-01-01', 'Año Nuevo', O], ['2026-02-02', 'Día de la Constitución', O], ['2026-03-16', 'Natalicio de Benito Juárez', O],
  ['2026-04-02', 'Jueves Santo', E], ['2026-04-03', 'Viernes Santo', E], ['2026-05-01', 'Día del Trabajo', O], ['2026-09-16', 'Día de la Independencia', O],
  ['2026-11-16', 'Revolución Mexicana', O], ['2026-12-24', 'Nochebuena', E], ['2026-12-25', 'Navidad', O], ['2026-12-31', 'Último día del año', E],
  ['2027-01-01', 'Año Nuevo', O], ['2027-02-01', 'Día de la Constitución', O], ['2027-03-15', 'Natalicio de Benito Juárez', O],
  ['2027-03-25', 'Jueves Santo', E], ['2027-03-26', 'Viernes Santo', E], ['2027-05-01', 'Día del Trabajo', O], ['2027-09-16', 'Día de la Independencia', O],
  ['2027-11-15', 'Revolución Mexicana', O], ['2027-12-24', 'Nochebuena', E], ['2027-12-25', 'Navidad', O], ['2027-12-31', 'Último día del año', E],
];

export async function seed({ appUrl } = {}) {
  // jwt_secret se genera una sola vez y vive únicamente en DynamoDB.
  if (await putIfMissing(T.config, { clave: 'jwt_secret', valor: crypto.randomBytes(48).toString('base64url') }, 'clave')) log('jwt_secret generado');
  for (const [clave, valor] of [
    ['ses_from', S.sesFrom],
    ['ses_from_name', 'Go Productivity · Vacaciones'],
    ['app_name', 'Portal de Vacaciones'],
    ['notificar_backup', 'si'],
    ['folio_seq', 0],
  ]) {
    if (await putIfMissing(T.config, { clave, valor }, 'clave')) log(`config ${clave}`);
  }
  if (appUrl) {
    await setConfig('app_url', appUrl);
    log(`config app_url = ${appUrl}`);
  }
  let n = 0;
  for (const b of BENEFICIOS) n += (await putIfMissing(T.beneficios, { ...b, activo: true }, 'clave')) ? 1 : 0;
  log(`beneficios nuevos: ${n}`);
  n = 0;
  for (const [fecha, nombre, tipo] of FESTIVOS) n += (await putIfMissing(T.festivos, { fecha, nombre, tipo, anio: fecha.slice(0, 4) }, 'fecha')) ? 1 : 0;
  log(`festivos nuevos: ${n}`);
}

if (process.argv[1]?.endsWith('seed-config.mjs')) {
  const appUrl = process.argv.find((a) => a.startsWith('--app-url='))?.split('=')[1];
  await seed({ appUrl });
}
