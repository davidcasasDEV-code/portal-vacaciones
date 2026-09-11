import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { resolveAwsCredentials } from "./aws-credentials.js";

const region = process.env.AWS_REGION || "us-east-1";

export const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region, credentials: resolveAwsCredentials() })
);

export const TABLES = {
  USUARIOS: "NAVE_Reporte_Usuarios_Web",
  VACACIONES: "NAVE_Vacaciones",
  RECUPERAR_CUENTA: "NAVE_Recuperar_Cuenta"
};

export async function scanAll(command, ExclusiveStartKeyParam) {
  const items = [];
  let ExclusiveStartKey = ExclusiveStartKeyParam;

  do {
    const page = await command(ExclusiveStartKey);
    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}
