// Crea o actualiza la Lambda Go_Productivity_Vacaciones_API, su rol IAM y su Function URL.
import path from 'node:path';
import {
  IAMClient,
  GetRoleCommand,
  CreateRoleCommand,
  PutRolePolicyCommand,
  AttachRolePolicyCommand,
} from '@aws-sdk/client-iam';
import {
  LambdaClient,
  GetFunctionCommand,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  GetFunctionUrlConfigCommand,
  CreateFunctionUrlConfigCommand,
  UpdateFunctionUrlConfigCommand,
  AddPermissionCommand,
  waitUntilFunctionUpdatedV2,
  waitUntilFunctionActiveV2,
} from '@aws-sdk/client-lambda';
import { S, T, ROOT, log, websiteEndpoint } from './settings.mjs';
import { zipDirectory } from './zip.mjs';

const iam = new IAMClient({});
const lambda = new LambdaClient({});

async function ensureRole() {
  try {
    const r = await iam.send(new GetRoleCommand({ RoleName: S.roleName }));
    return { arn: r.Role.Arn, created: false };
  } catch (e) {
    if (e.name !== 'NoSuchEntityException') throw e;
  }
  const r = await iam.send(
    new CreateRoleCommand({
      RoleName: S.roleName,
      Description: 'Rol de ejecución de Go_Productivity_Vacaciones_API',
      AssumeRolePolicyDocument: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }],
      }),
      Tags: [{ Key: 'proyecto', Value: 'portal-vacaciones' }],
    }),
  );
  log(`Rol IAM creado: ${S.roleName}`);
  return { arn: r.Role.Arn, created: true };
}

async function putRolePolicy(roleArn) {
  const account = roleArn.split(':')[4];
  const tableArns = Object.values(T).flatMap((t) => [`arn:aws:dynamodb:${S.region}:${account}:table/${t}`, `arn:aws:dynamodb:${S.region}:${account}:table/${t}/index/*`]);
  await iam.send(
    new PutRolePolicyCommand({
      RoleName: S.roleName,
      PolicyName: 'Go_Productivity_Vacaciones_Access',
      PolicyDocument: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'DynamoTablasPortal',
            Effect: 'Allow',
            Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan', 'dynamodb:BatchGetItem', 'dynamodb:BatchWriteItem'],
            Resource: tableArns,
          },
          {
            Sid: 'CorreoSES',
            Effect: 'Allow',
            Action: ['ses:SendEmail', 'ses:SendRawEmail'],
            Resource: '*',
          },
        ],
      }),
    }),
  );
  await iam.send(new AttachRolePolicyCommand({ RoleName: S.roleName, PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole' }));
}

const environment = { Variables: { TABLE_PREFIX: S.prefix, APP_TIMEZONE: S.timezone, SES_FROM: S.sesFrom, NODE_OPTIONS: '--enable-source-maps' } };

async function deployFunction(roleArn, zip) {
  let exists = true;
  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: S.lambdaName }));
  } catch (e) {
    if (e.name !== 'ResourceNotFoundException') throw e;
    exists = false;
  }
  if (!exists) {
    // El rol recién creado tarda unos segundos en propagarse en IAM.
    for (let i = 0; ; i++) {
      try {
        await lambda.send(
          new CreateFunctionCommand({
            FunctionName: S.lambdaName,
            Runtime: 'nodejs22.x',
            Architectures: ['arm64'],
            Handler: 'index.handler',
            Role: roleArn,
            Code: { ZipFile: zip },
            MemorySize: 512,
            Timeout: 20,
            Description: 'API del Portal de Vacaciones Go Productivity',
            Environment: environment,
            Tags: { proyecto: 'portal-vacaciones' },
          }),
        );
        break;
      } catch (e) {
        if (e.name === 'InvalidParameterValueException' && i < 10) {
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        throw e;
      }
    }
    await waitUntilFunctionActiveV2({ client: lambda, maxWaitTime: 120 }, { FunctionName: S.lambdaName });
    log(`Lambda creada: ${S.lambdaName}`);
  } else {
    await lambda.send(new UpdateFunctionCodeCommand({ FunctionName: S.lambdaName, ZipFile: zip, Architectures: ['arm64'] }));
    await waitUntilFunctionUpdatedV2({ client: lambda, maxWaitTime: 120 }, { FunctionName: S.lambdaName });
    await lambda.send(new UpdateFunctionConfigurationCommand({ FunctionName: S.lambdaName, Environment: environment, Runtime: 'nodejs22.x', MemorySize: 512, Timeout: 20 }));
    await waitUntilFunctionUpdatedV2({ client: lambda, maxWaitTime: 120 }, { FunctionName: S.lambdaName });
    log(`Lambda actualizada: ${S.lambdaName}`);
  }
}

export async function ensureFunctionUrl(extraOrigins = []) {
  const Cors = {
    AllowOrigins: [...new Set([`http://${websiteEndpoint()}`, 'http://localhost:5173', 'http://127.0.0.1:5173', ...extraOrigins])],
    AllowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    AllowHeaders: ['content-type', 'authorization'],
    MaxAge: 86400,
  };
  try {
    const r = await lambda.send(new GetFunctionUrlConfigCommand({ FunctionName: S.lambdaName }));
    // Conserva orígenes agregados antes (p. ej. el dominio de CloudFront).
    Cors.AllowOrigins = [...new Set([...Cors.AllowOrigins, ...(r.Cors?.AllowOrigins || [])])];
    await lambda.send(new UpdateFunctionUrlConfigCommand({ FunctionName: S.lambdaName, AuthType: 'NONE', Cors }));
    return r.FunctionUrl;
  } catch (e) {
    if (e.name !== 'ResourceNotFoundException') throw e;
  }
  const r = await lambda.send(new CreateFunctionUrlConfigCommand({ FunctionName: S.lambdaName, AuthType: 'NONE', Cors }));
  // Acceso público a la URL (la autenticación la hace la propia API con el token de sesión).
  await lambda.send(new AddPermissionCommand({ FunctionName: S.lambdaName, StatementId: 'FunctionUrlPublic', Action: 'lambda:InvokeFunctionUrl', Principal: '*', FunctionUrlAuthType: 'NONE' }));
  await lambda
    .send(new AddPermissionCommand({ FunctionName: S.lambdaName, StatementId: 'FunctionUrlPublicInvoke', Action: 'lambda:InvokeFunction', Principal: '*', InvokedViaFunctionUrl: true }))
    .catch((e) => log(`(aviso) permiso InvokeFunction: ${e.message}`));
  log(`Function URL creada: ${r.FunctionUrl}`);
  return r.FunctionUrl;
}

if (process.argv[1]?.endsWith('deploy-api.mjs')) {
  const role = await ensureRole();
  await putRolePolicy(role.arn);
  if (role.created) await new Promise((r) => setTimeout(r, 10000));
  const zip = zipDirectory(path.join(ROOT, 'backend', 'src'));
  log(`Paquete: ${(zip.length / 1024).toFixed(1)} KB`);
  await deployFunction(role.arn, zip);
  const url = await ensureFunctionUrl((process.env.EXTRA_ORIGINS || '').split(',').filter(Boolean));
  log(`API: ${url}`);
}
