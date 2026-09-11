import { GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { allowedTables, apiError, dynamo, ensureAllowed } from "../../../../lib/aws-clients.js";
import { requireAuth } from "../../../../lib/permissions.js";

export const runtime = "nodejs";

const commands = {
  get: GetCommand,
  scan: ScanCommand,
  update: UpdateCommand,
  put: PutCommand
};

// Solo para Reporte de Capacidad TI / Reporte MVP's (fuera de esta
// migracion). Requiere sesion valida, pero no autorizacion fina por rol -
// mismo alcance que tenian estas 2 paginas antes.
export async function POST(request, context) {
  try {
    await requireAuth(request);
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
