import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";

export const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
export const lambda = new LambdaClient({ region });

export const allowedTables = readAllowList(process.env.ALLOWED_TABLES, [
  "NAVE_Vacaciones",
  "NAVE_Reporte_Usuarios_Web",
  "NAVE_Recuperar_Cuenta",
  "NAVE_Reporte_Capacidades",
  "NAVE_Reporte_General_MVPs"
]);

export const allowedFunctions = readAllowList(process.env.ALLOWED_LAMBDAS, [
  "Send_Email",
  "Send_Team_MSG",
  "Obtener_Saldos_Beneficios"
]);

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
