import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { allowedTables, apiError, dynamo, ensureAllowed } from "../../../../lib/aws-clients.js";

export const runtime = "nodejs";

const commands = {
  get: GetCommand,
  scan: ScanCommand,
  update: UpdateCommand,
  put: PutCommand
};

export async function POST(request, context) {
  try {
    const { operation } = await context.params;
    const Command = commands[operation];

    if (!Command) {
      return Response.json({ message: `Operacion DynamoDB no soportada: ${operation}` }, { status: 404 });
    }

    const params = await request.json();
    ensureAllowed(params.TableName, allowedTables, "Tabla");

    const result = await dynamo.send(new Command(params));
    return Response.json(result);
  } catch (error) {
    return apiError(error);
  }
}
