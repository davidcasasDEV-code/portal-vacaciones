import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const lambda = new LambdaClient({ region });

const allowedTables = readList(process.env.ALLOWED_TABLES, [
    "NAVE_Vacaciones",
    "NAVE_Reporte_Usuarios_Web",
    "NAVE_Recuperar_Cuenta",
    "NAVE_Reporte_Capacidades",
    "NAVE_Reporte_General_MVPs"
]);

const allowedFunctions = readList(process.env.ALLOWED_LAMBDAS, [
    "Send_Email",
    "Send_Team_MSG",
    "Obtener_Saldos_Beneficios"
]);

function readList(value, fallback) {
    if (!value) {
        return new Set(fallback);
    }
    return new Set(value.split(",").map((item) => item.trim()).filter(Boolean));
}

function corsOrigin(event) {
    const requestOrigin = event.headers?.origin || event.headers?.Origin || "";
    const configured = readList(process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN, ["*"]);
    if (configured.has("*")) {
        return "*";
    }
    if (requestOrigin && configured.has(requestOrigin)) {
        return requestOrigin;
    }
    return [...configured][0] || "";
}

function response(event, statusCode, body) {
    return {
        statusCode,
        headers: {
            "Access-Control-Allow-Origin": corsOrigin(event),
            "Access-Control-Allow-Headers": "content-type,authorization,x-nave-user",
            "Access-Control-Allow-Methods": "OPTIONS,POST",
            "Content-Type": "application/json",
            "Vary": "Origin"
        },
        body: JSON.stringify(body)
    };
}

function parseBody(event) {
    const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString("utf8")
        : event.body || "{}";
    return JSON.parse(rawBody || "{}");
}

function normalizedPath(event) {
    const path = event.rawPath || event.path || "/";
    const dynamoIndex = path.indexOf("/dynamodb/");
    if (dynamoIndex >= 0) {
        return path.slice(dynamoIndex);
    }
    const lambdaIndex = path.indexOf("/lambda/");
    if (lambdaIndex >= 0) {
        return path.slice(lambdaIndex);
    }
    return path;
}

function ensureAllowed(value, allowedValues, resourceName) {
    if (!allowedValues.has(value)) {
        const error = new Error(`${resourceName} no permitido: ${value}`);
        error.statusCode = 403;
        throw error;
    }
}

async function handleDynamo(path, params) {
    ensureAllowed(params.TableName, allowedTables, "Tabla");

    const commands = {
        "/dynamodb/get": GetCommand,
        "/dynamodb/scan": ScanCommand,
        "/dynamodb/update": UpdateCommand,
        "/dynamodb/put": PutCommand
    };
    const Command = commands[path];
    if (!Command) {
        const error = new Error(`Operacion DynamoDB no soportada: ${path}`);
        error.statusCode = 404;
        throw error;
    }

    return dynamo.send(new Command(params));
}

function encodeLambdaPayload(payload) {
    if (!payload) {
        return undefined;
    }
    if (typeof payload === "string") {
        return Buffer.from(payload);
    }
    return Buffer.from(JSON.stringify(payload));
}

async function handleLambda(params) {
    ensureAllowed(params.FunctionName, allowedFunctions, "Lambda");

    const result = await lambda.send(new InvokeCommand({
        FunctionName: params.FunctionName,
        InvocationType: params.InvocationType,
        LogType: params.LogType,
        Payload: encodeLambdaPayload(params.Payload)
    }));

    return {
        StatusCode: result.StatusCode,
        FunctionError: result.FunctionError,
        LogResult: result.LogResult,
        ExecutedVersion: result.ExecutedVersion,
        Payload: result.Payload ? Buffer.from(result.Payload).toString("utf8") : ""
    };
}

export async function handler(event) {
    if (event.requestContext?.http?.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
        return response(event, 200, {});
    }

    try {
        const path = normalizedPath(event);
        const params = parseBody(event);

        if (path.startsWith("/dynamodb/")) {
            return response(event, 200, await handleDynamo(path, params));
        }
        if (path === "/lambda/invoke") {
            return response(event, 200, await handleLambda(params));
        }

        return response(event, 404, { message: `Ruta no soportada: ${path}` });
    } catch (error) {
        console.error(error);
        return response(event, error.statusCode || 500, {
            message: error.message || "Error interno"
        });
    }
}
