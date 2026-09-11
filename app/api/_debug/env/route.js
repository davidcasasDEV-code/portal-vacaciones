// Endpoint de diagnostico TEMPORAL. Solo reporta booleanos (nunca valores),
// para confirmar si las variables de entorno llegan al runtime SSR. Borrar
// despues de diagnosticar el problema de credenciales.
export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    hasNaveAccessKeyId: Boolean(process.env.NAVE_AWS_ACCESS_KEY_ID),
    hasNaveSecretAccessKey: Boolean(process.env.NAVE_AWS_SECRET_ACCESS_KEY),
    hasSessionTokenSecret: Boolean(process.env.SESSION_TOKEN_SECRET),
    naveAccessKeyIdLength: (process.env.NAVE_AWS_ACCESS_KEY_ID || "").length,
    region: process.env.AWS_REGION || null,
    nodeEnv: process.env.NODE_ENV || null
  });
}
