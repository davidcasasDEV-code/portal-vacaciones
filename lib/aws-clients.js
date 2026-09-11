import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { resolveAwsCredentials } from "./aws-credentials.js";

const region = process.env.AWS_REGION || "us-east-1";

export const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region, credentials: resolveAwsCredentials() })
);
export const lambda = new LambdaClient({ region, credentials: resolveAwsCredentials() });

// Este passthrough generico es solo para las 2 paginas que quedaron FUERA de
// la migracion a Next.js (Reporte de Capacidad TI / Reporte MVP's, ver
// public/reporte_capacidad.html y public/reporte_mvp.html). Las tablas y
// funciones del modulo de Vacaciones (NAVE_Vacaciones,
// NAVE_Reporte_Usuarios_Web, NAVE_Recuperar_Cuenta, Send_Email,
// Send_Team_MSG, Obtener_Saldos_Beneficios) ya NO pasan por aqui: tienen sus
// propias rutas en app/api/{auth,vacaciones,usuarios,dashboard} con
// autorizacion por sesion (ver lib/permissions.js).
export const allowedTables = readAllowList(process.env.ALLOWED_TABLES, [
  "NAVE_Reporte_Capacidades",
  "NAVE_Reporte_General_MVPs"
]);

export const allowedFunctions = readAllowList(process.env.ALLOWED_LAMBDAS, []);

export function readAllowList(value, fallback) {
  if (!value) {
    return new Set(fallback);
  }

  return new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
}

export function ensureAllowed(value, allowedValues, resourceName) {
  if (!allowedValues.has(value)) {
    const error = new Error(`${resourceName} no permitido: ${value || "(vacio)"}`);
    error.statusCode = 403;
    throw error;
  }
}

export function apiError(error) {
  console.error(error);
  return Response.json(
    { message: error.message || "Error interno" },
    { status: error.statusCode || 500 }
  );
}
