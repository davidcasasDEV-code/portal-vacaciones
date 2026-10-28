// Go_Productivity_Vacaciones_API — punto de entrada de la Lambda (Function URL).
import { getConfig, TABLES } from './lib/config.mjs';
import { getItem } from './lib/db.mjs';
import { json, parseBody, HttpError, unauthorized, forbidden } from './lib/http.mjs';
import { verifyToken, requireRole } from './lib/auth.mjs';
import { createRepo } from './lib/repo.mjs';
import * as auth from './routes/auth.mjs';
import * as me from './routes/me.mjs';
import * as sol from './routes/solicitudes.mjs';
import * as admin from './routes/admin.mjs';

const PUBLIC = 'public';
const ANY = ['Admin', 'Aprobador', 'Usuario'];
const APPROVERS = ['Admin', 'Aprobador'];
const ADMIN = ['Admin'];

// [método, ruta, handler, roles]
const routes = [
  ['POST', '/auth/login', auth.login, PUBLIC],
  ['POST', '/auth/recuperar', auth.recoverRequest, PUBLIC],
  ['POST', '/auth/recuperar/confirmar', auth.recoverConfirm, PUBLIC],
  ['POST', '/auth/cambiar-password', auth.changePassword, ANY, { allowPasswordChange: true }],

  ['GET', '/me', me.getMe, ANY, { allowPasswordChange: true }],
  ['PUT', '/me', me.updateMe, ANY],
  ['GET', '/catalogos', me.getCatalogos, ANY],
  ['GET', '/dashboard', me.getDashboard, ANY],
  ['GET', '/saldo', me.getSaldo, ANY],

  ['GET', '/solicitudes', sol.mine, ANY],
  ['POST', '/solicitudes/preview', sol.preview, ANY],
  ['POST', '/solicitudes', sol.create, ANY],
  ['POST', '/solicitudes/:id/cancelar', sol.cancel, ANY],
  ['GET', '/equipo/calendario', sol.teamCalendar, ANY],

  ['GET', '/aprobaciones', sol.approvals, APPROVERS],
  ['POST', '/aprobaciones/:id', sol.decide, APPROVERS],
  ['GET', '/reportes/solicitudes', admin.report, APPROVERS],
  ['GET', '/reportes/saldos', admin.balancesReport, APPROVERS],

  ['GET', '/admin/usuarios', admin.listUsers, ADMIN],
  ['POST', '/admin/usuarios', admin.createUser, ADMIN],
  ['PUT', '/admin/usuarios/:correo', admin.updateUser, ADMIN],
  ['DELETE', '/admin/usuarios/:correo', admin.deleteUser, ADMIN],
  ['POST', '/admin/usuarios/:correo/password', admin.resetPassword, ADMIN],
  ['GET', '/admin/aprobadores', admin.getApprovers, ADMIN],
  ['PUT', '/admin/aprobadores', admin.updateApprovers, ADMIN],
  ['GET', '/admin/torres', admin.listTorres, ADMIN],
  ['POST', '/admin/torres', admin.createTorre, ADMIN],
  ['PUT', '/admin/torres/:id', admin.updateTorre, ADMIN],
  ['DELETE', '/admin/torres/:id', admin.deleteTorre, ADMIN],
  ['GET', '/admin/festivos', admin.listFestivos, ADMIN],
  ['POST', '/admin/festivos', admin.upsertFestivo, ADMIN],
  ['PUT', '/admin/festivos/:fecha', admin.upsertFestivo, ADMIN],
  ['DELETE', '/admin/festivos/:fecha', admin.deleteFestivo, ADMIN],
  ['GET', '/admin/beneficios', admin.listBeneficios, ADMIN],
  ['PUT', '/admin/beneficios/:clave', admin.updateBeneficio, ADMIN],
  ['GET', '/admin/saldo-adicional', admin.listAdicional, ADMIN],
  ['POST', '/admin/saldo-adicional', admin.createAdicional, ADMIN],
  ['DELETE', '/admin/saldo-adicional/:id', admin.deleteAdicional, ADMIN],
  ['GET', '/admin/config', admin.getConfigPublic, ADMIN],
  ['PUT', '/admin/config', admin.updateConfig, ADMIN],
].map(([method, path, handler, roles, opts = {}]) => {
  const keys = [];
  const re = new RegExp(`^${path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)'))}/?$`);
  return { method, re, keys, handler, roles, opts };
});

function match(method, path) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

async function authenticate(event) {
  const header = event.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw unauthorized();
  const { jwt_secret } = await getConfig();
  const payload = verifyToken(token, jwt_secret);
  const user = await getItem(TABLES.usuarios, { correo: payload.sub });
  if (!user || user.activo === false || (user.token_version || 0) !== (payload.v || 0)) throw unauthorized();
  return user;
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = (event.rawPath || event.path || '/').replace(/^\/api/, '') || '/';
  if (method === 'OPTIONS') return json(204, {});
  if (path === '/health') return json(200, { ok: true, servicio: 'Go_Productivity_Vacaciones_API' });

  const found = match(method, path);
  if (!found) return json(404, { error: 'Ruta no encontrada' });
  const { route, params } = found;

  try {
    const ctx = { params, query: event.queryStringParameters || {}, body: parseBody(event), repo: createRepo() };
    if (route.roles !== PUBLIC) {
      ctx.user = await authenticate(event);
      requireRole(ctx.user, ...route.roles);
      if (ctx.user.debe_cambiar_password && !route.opts.allowPasswordChange) {
        throw forbidden('Debes cambiar tu contraseña antes de continuar');
      }
    }
    const result = await route.handler(ctx);
    return json(200, result);
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message, ...(err.extra || {}) });
    console.error('Unhandled', { method, path, message: err.message, stack: err.stack });
    return json(500, { error: 'Ocurrió un error inesperado. Intenta de nuevo en un momento.' });
  }
}
