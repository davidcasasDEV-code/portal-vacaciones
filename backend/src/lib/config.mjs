// Configuración de la API.
// - Nombres de tablas y región: variables de entorno de la Lambda.
// - Secretos y parámetros de negocio (firma de sesión, remitente SES, URL del portal):
//   tabla Go_Productivity_Config, nunca en código.
import { getItem, scanAll } from './db.mjs';

const PREFIX = process.env.TABLE_PREFIX || 'Go_Productivity_';

export const TABLES = {
  usuarios: `${PREFIX}Usuarios`,
  solicitudes: `${PREFIX}Solicitudes`,
  beneficios: `${PREFIX}Beneficios`,
  torres: `${PREFIX}Torres`,
  festivos: `${PREFIX}Dias_Festivos`,
  adicional: `${PREFIX}Saldo_Adicional`,
  recuperar: `${PREFIX}Recuperar_Cuenta`,
  config: `${PREFIX}Config`,
};

export const APP_TZ = process.env.APP_TIMEZONE || 'America/Monterrey';

// Claves de Config que el panel de administración puede ver/editar (nunca secretos).
export const PUBLIC_CONFIG_KEYS = ['ses_from', 'ses_from_name', 'app_url', 'app_name', 'notificar_backup'];

let cache = null;
let cacheAt = 0;

export async function getConfig() {
  if (cache && Date.now() - cacheAt < 60_000) return cache;
  const items = await scanAll(TABLES.config);
  const cfg = Object.fromEntries(items.map((i) => [i.clave, i.valor]));
  cfg.ses_from ||= process.env.SES_FROM;
  cfg.app_url ||= process.env.APP_URL;
  cfg.app_name ||= 'Portal de Vacaciones';
  cfg.ses_from_name ||= 'Go Productivity · Vacaciones';
  if (!cfg.jwt_secret) throw new Error('Falta jwt_secret en la tabla de configuración');
  cache = cfg;
  cacheAt = Date.now();
  return cfg;
}

export function clearConfigCache() {
  cache = null;
}

export async function getConfigValue(clave) {
  const item = await getItem(TABLES.config, { clave });
  return item?.valor;
}
