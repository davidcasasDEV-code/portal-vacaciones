import { InvokeCommand } from "@aws-sdk/client-lambda";
import { allowedFunctions, apiError, ensureAllowed, lambda } from "../../../../lib/aws-clients.js";

export const runtime = "nodejs";

function encodePayload(payload) {
  if (!payload) {
    return undefined;
  }

  if (typeof payload === "string") {
    return Buffer.from(payload);
  }

  return Buffer.from(JSON.stringify(payload));
}

export async function POST(request) {
  try {
    const params = await request.json();
    ensureAllowed(params.FunctionName, allowedFunctions, "Lambda");

    const result = await lambda.send(new InvokeCommand({
      FunctionName: params.FunctionName,
      InvocationType: params.InvocationType,
      LogType: params.LogType,
      Payload: encodePayload(params.Payload)
    }));

    return Response.json({
      StatusCode: result.StatusCode,
      FunctionError: result.FunctionError,
      LogResult: result.LogResult,
      ExecutedVersion: result.ExecutedVersion,
      Payload: result.Payload ? Buffer.from(result.Payload).toString("utf8") : ""
    });
  } catch (error) {
    return apiError(error);
  }
}
