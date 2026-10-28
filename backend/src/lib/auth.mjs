import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { unauthorized, forbidden, badRequest } from './http.mjs';

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${key.toString('base64')}`;
}

// Soporta el hash del portal anterior (SHA-256 hex sin sal) para migrarlo en el
// siguiente login exitoso. Devuelve { ok, legacy }.
export async function verifyPassword(password, stored) {
  if (!stored || !password) return { ok: false };
  if (stored.startsWith('scrypt$')) {
    const [, N, saltB64, keyB64] = stored.split('$');
    const expected = Buffer.from(keyB64, 'base64');
    const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: SCRYPT.r, p: SCRYPT.p });
    return { ok: crypto.timingSafeEqual(key, expected) };
  }
  if (/^[0-9a-f]{64}$/.test(stored)) {
    const h = crypto.createHash('sha256').update(password).digest();
    return { ok: crypto.timingSafeEqual(h, Buffer.from(stored, 'hex')), legacy: true };
  }
  return { ok: false };
}

export function validatePasswordPolicy(pw) {
  if (typeof pw !== 'string' || pw.length < 8) throw badRequest('La contraseña debe tener al menos 8 caracteres');
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw badRequest('La contraseña debe incluir letras y números');
  if (pw.length > 128) throw badRequest('La contraseña es demasiado larga');
}

export function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5)}${crypto.randomInt(10)}`;
}

export function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

// --- Token de sesión (JWT HS256) ---
const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function signToken(payload, secret, ttlSeconds = 60 * 60 * 10) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token, secret) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) throw unauthorized();
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw unauthorized();
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw unauthorized();
  return payload;
}

// --- Roles ---
export const ROLES = ['Admin', 'Aprobador', 'Usuario'];

export function requireRole(user, ...roles) {
  if (!roles.includes(user.rol)) throw forbidden();
}
