// Parámetros de infraestructura. Todos se pueden sobrescribir con variables de
// entorno (ver .env.example); no hay credenciales aquí: los scripts usan el perfil
// de AWS CLI/SDK de quien despliega.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Carga .env de la raíz si existe (sin dependencias).
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const env = (k, d) => process.env[k] || d;

export const S = {
  region: env('AWS_REGION', 'us-east-1'),
  prefix: env('TABLE_PREFIX', 'Go_Productivity_'),
  lambdaName: env('LAMBDA_NAME', 'Go_Productivity_Vacaciones_API'),
  roleName: env('LAMBDA_ROLE_NAME', 'Go_Productivity_Vacaciones_Lambda_Role'),
  bucket: env('WEB_BUCKET', 'go-productivity-vacaciones'),
  sesFrom: env('SES_FROM', 'david.casas@go-productivity.com.mx'),
  cfComment: env('CLOUDFRONT_COMMENT', 'Go_Productivity_Vacaciones_Web'),
  timezone: env('APP_TIMEZONE', 'America/Monterrey'),
};
process.env.AWS_REGION ||= S.region;

export const T = {
  usuarios: `${S.prefix}Usuarios`,
  solicitudes: `${S.prefix}Solicitudes`,
  beneficios: `${S.prefix}Beneficios`,
  torres: `${S.prefix}Torres`,
  festivos: `${S.prefix}Dias_Festivos`,
  adicional: `${S.prefix}Saldo_Adicional`,
  recuperar: `${S.prefix}Recuperar_Cuenta`,
  config: `${S.prefix}Config`,
};

export const websiteEndpoint = () => `${S.bucket}.s3-website-${S.region}.amazonaws.com`;

export const log = (...a) => console.log('›', ...a);
