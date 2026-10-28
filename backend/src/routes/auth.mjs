import { TABLES, getConfig } from '../lib/config.mjs';
import { getItem, patchItem, putItem, deleteItem } from '../lib/db.mjs';
import { badRequest, unauthorized, email, str, HttpError } from '../lib/http.mjs';
import { verifyPassword, hashPassword, validatePasswordPolicy, signToken, generateCode, sha256 } from '../lib/auth.mjs';
import { sendRecoveryCode } from '../lib/email.mjs';
import { publicUser, indexBy } from '../lib/repo.mjs';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

async function issueSession(user, repo) {
  const cfg = await getConfig();
  const token = signToken({ sub: user.correo, rol: user.rol, v: user.token_version || 0 }, cfg.jwt_secret);
  const torres = indexBy(await repo.torres(), 'id');
  return { token, user: publicUser(user, torres) };
}

export async function login({ body, repo }) {
  const correo = email(body.correo);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!correo || !password) throw badRequest('Escribe tu correo y contraseña');

  const user = await getItem(TABLES.usuarios, { correo });
  const generic = new HttpError(401, 'Correo o contraseña incorrectos');
  if (!user || user.activo === false) throw generic;
  if (!user.password_hash) throw new HttpError(401, 'Tu cuenta aún no tiene contraseña. Usa "¿Primera vez u olvidaste tu contraseña?" para crearla.');
  if (user.bloqueado_hasta && user.bloqueado_hasta > new Date().toISOString()) {
    throw new HttpError(429, `Demasiados intentos fallidos. Intenta de nuevo en unos minutos o restablece tu contraseña.`);
  }

  const { ok, legacy } = await verifyPassword(password, user.password_hash);
  if (!ok) {
    const fallidos = (user.intentos_fallidos || 0) + 1;
    await patchItem(TABLES.usuarios, { correo }, {
      intentos_fallidos: fallidos >= MAX_FAILED ? 0 : fallidos,
      bloqueado_hasta: fallidos >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null,
    });
    throw generic;
  }

  const updated = await patchItem(TABLES.usuarios, { correo }, {
    intentos_fallidos: 0,
    bloqueado_hasta: null,
    ultimo_acceso: new Date().toISOString(),
    // Migración transparente del hash SHA-256 heredado a scrypt con sal
    password_hash: legacy ? await hashPassword(password) : undefined,
  });
  return issueSession(updated, repo);
}

export async function recoverRequest({ body }) {
  const correo = email(body.correo);
  if (!correo) throw badRequest('Escribe tu correo');
  const user = await getItem(TABLES.usuarios, { correo });
  // Respuesta idéntica exista o no la cuenta, para no revelar qué correos están registrados.
  const response = { ok: true, mensaje: 'Si el correo está registrado, recibirás un código de 6 dígitos en unos momentos.' };
  if (!user || user.activo === false) return response;

  const prev = await getItem(TABLES.recuperar, { correo });
  if (prev?.creado && Date.now() - Date.parse(prev.creado) < 60_000) {
    throw new HttpError(429, 'Ya enviamos un código hace menos de un minuto. Revisa tu bandeja (y spam).');
  }
  const codigo = generateCode();
  await putItem(TABLES.recuperar, {
    correo,
    codigo_hash: sha256(`${correo}:${codigo}`),
    intentos: 0,
    creado: new Date().toISOString(),
    expira: Math.floor(Date.now() / 1000) + 15 * 60, // TTL de DynamoDB
  });
  await sendRecoveryCode(correo, user.nombre, codigo);
  return response;
}

export async function recoverConfirm({ body, repo }) {
  const correo = email(body.correo);
  const codigo = str(body.codigo, 10);
  const password = body.password;
  if (!correo || !codigo) throw badRequest('Escribe tu correo y el código que te enviamos');
  validatePasswordPolicy(password);

  const rec = await getItem(TABLES.recuperar, { correo });
  const invalid = badRequest('Código incorrecto o vencido. Solicita uno nuevo.');
  if (!rec || rec.expira < Math.floor(Date.now() / 1000)) throw invalid;
  if (rec.intentos >= 5) {
    await deleteItem(TABLES.recuperar, { correo });
    throw invalid;
  }
  if (rec.codigo_hash !== sha256(`${correo}:${codigo}`)) {
    await patchItem(TABLES.recuperar, { correo }, { intentos: (rec.intentos || 0) + 1 });
    throw invalid;
  }
  const user = await getItem(TABLES.usuarios, { correo });
  if (!user || user.activo === false) throw invalid;

  await deleteItem(TABLES.recuperar, { correo });
  const updated = await patchItem(TABLES.usuarios, { correo }, {
    password_hash: await hashPassword(password),
    debe_cambiar_password: false,
    intentos_fallidos: 0,
    bloqueado_hasta: null,
    token_version: (user.token_version || 0) + 1,
    ultimo_acceso: new Date().toISOString(),
  });
  return issueSession(updated, repo);
}

export async function changePassword({ body, user, repo }) {
  const { actual, nueva } = body;
  validatePasswordPolicy(nueva);
  const { ok } = await verifyPassword(actual || '', user.password_hash);
  if (!ok) throw badRequest('Tu contraseña actual no es correcta');
  if (actual === nueva) throw badRequest('La nueva contraseña debe ser diferente a la actual');
  const updated = await patchItem(TABLES.usuarios, { correo: user.correo }, {
    password_hash: await hashPassword(nueva),
    debe_cambiar_password: false,
    token_version: (user.token_version || 0) + 1,
  });
  return issueSession(updated, repo);
}

export { issueSession, unauthorized };
