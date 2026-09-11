import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "nave_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 horas

function getSecretKey() {
  const secret = process.env.SESSION_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_TOKEN_SECRET no esta configurado (o es demasiado corto). Define una variable de al menos 32 caracteres."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken({ correo, nombre, apellido, rol }) {
  return new SignJWT({ correo, nombre, apellido, rol })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token) {
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(response, token) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS
  });
}

export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

function legacySha256Hex(password) {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

function looksLikeLegacyHash(hash) {
  return typeof hash === "string" && /^[0-9a-f]{64}$/i.test(hash);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

// Verifica la contrasena contra el hash guardado. Soporta el hash legado
// (SHA-256 sin salt, calculado antes en el navegador) para no forzar un
// reset masivo de contrasenas: si el hash guardado es del formato legado y
// coincide, se marca needsRehash para que el caller lo regrabe con bcrypt.
export async function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return { valid: false, needsRehash: false };
  }

  if (looksLikeLegacyHash(storedHash)) {
    const valid = legacySha256Hex(password) === storedHash;
    return { valid, needsRehash: valid };
  }

  const valid = await bcrypt.compare(password, storedHash);
  return { valid, needsRehash: false };
}
