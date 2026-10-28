// Compila el frontend, lo publica en el bucket S3 (sitio estático público) y lo
// sirve por CloudFront con HTTPS. Idempotente.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  S3Client,
  PutPublicAccessBlockCommand,
  PutBucketWebsiteCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import {
  CloudFrontClient,
  ListDistributionsCommand,
  CreateDistributionCommand,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront';
import { LambdaClient, GetFunctionUrlConfigCommand } from '@aws-sdk/client-lambda';
import { S, ROOT, log, websiteEndpoint } from './settings.mjs';
import { ensureFunctionUrl } from './deploy-api.mjs';
import { setConfig } from './seed-config.mjs';

const s3 = new S3Client({});
const cf = new CloudFrontClient({ region: 'us-east-1' });
const lambda = new LambdaClient({});
const FRONT = path.join(ROOT, 'frontend');
const DIST = path.join(FRONT, 'dist');

// 1) URL de la API → variable de entorno de compilación (sin hardcode en el código)
const { FunctionUrl } = await lambda.send(new GetFunctionUrlConfigCommand({ FunctionName: S.lambdaName }));
fs.writeFileSync(path.join(FRONT, '.env.production.local'), `VITE_API_URL=${FunctionUrl.replace(/\/$/, '')}\n`);
log(`API: ${FunctionUrl}`);

// 2) Build
execFileSync(process.execPath, [path.join(FRONT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: FRONT, stdio: 'inherit' });

// 3) Bucket como sitio web público (lectura de objetos únicamente)
await s3.send(new PutPublicAccessBlockCommand({ Bucket: S.bucket, PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: false, RestrictPublicBuckets: false } }));
await s3.send(new PutBucketWebsiteCommand({ Bucket: S.bucket, WebsiteConfiguration: { IndexDocument: { Suffix: 'index.html' }, ErrorDocument: { Key: 'index.html' } } }));
await s3.send(
  new PutBucketPolicyCommand({
    Bucket: S.bucket,
    Policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [{ Sid: 'PublicReadWebsite', Effect: 'Allow', Principal: '*', Action: 's3:GetObject', Resource: `arn:aws:s3:::${S.bucket}/*` }],
    }),
  }),
);

// 4) Subida: assets con hash = caché larga; index.html sin caché
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const files = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name))));
walk(DIST);
const keys = new Set();
for (const f of files) {
  const Key = path.relative(DIST, f).split(path.sep).join('/');
  if (Key.includes('.tmp.')) continue; // nunca publicar archivos temporales de desarrollo
  keys.add(Key);
  await s3.send(
    new PutObjectCommand({
      Bucket: S.bucket,
      Key,
      Body: fs.readFileSync(f),
      ContentType: TYPES[path.extname(f)] || 'application/octet-stream',
      CacheControl: Key.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    }),
  );
}
log(`Subidos ${keys.size} archivos a s3://${S.bucket}`);

// Limpia assets de compilaciones anteriores
const existing = await s3.send(new ListObjectsV2Command({ Bucket: S.bucket, Prefix: 'assets/' }));
const stale = (existing.Contents || []).filter((o) => !keys.has(o.Key)).map((o) => ({ Key: o.Key }));
if (stale.length) {
  await s3.send(new DeleteObjectsCommand({ Bucket: S.bucket, Delete: { Objects: stale } }));
  log(`Eliminados ${stale.length} assets obsoletos`);
}

// 5) CloudFront (HTTPS) frente al endpoint de sitio web de S3
const list = await cf.send(new ListDistributionsCommand({}));
let dist = (list.DistributionList?.Items || []).find((d) => d.Comment === S.cfComment);
if (!dist) {
  const r = await cf.send(
    new CreateDistributionCommand({
      DistributionConfig: {
        CallerReference: `gp-vacaciones-${Date.now()}`,
        Comment: S.cfComment,
        Enabled: true,
        DefaultRootObject: 'index.html',
        HttpVersion: 'http2and3',
        PriceClass: 'PriceClass_100',
        Origins: {
          Quantity: 1,
          Items: [
            {
              Id: 's3-website',
              DomainName: websiteEndpoint(),
              CustomOriginConfig: { HTTPPort: 80, HTTPSPort: 443, OriginProtocolPolicy: 'http-only', OriginSslProtocols: { Quantity: 1, Items: ['TLSv1.2'] } },
            },
          ],
        },
        DefaultCacheBehavior: {
          TargetOriginId: 's3-website',
          ViewerProtocolPolicy: 'redirect-to-https',
          Compress: true,
          AllowedMethods: { Quantity: 2, Items: ['GET', 'HEAD'], CachedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] } },
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // Managed-CachingOptimized (respeta Cache-Control)
          ResponseHeadersPolicyId: '67f7725c-6f97-4210-82d7-5512b31e9d03', // Managed-SecurityHeadersPolicy
        },
      },
    }),
  );
  dist = r.Distribution;
  log(`CloudFront creado: ${dist.Id} (tarda ~5-10 min en propagarse)`);
} else {
  await cf.send(new CreateInvalidationCommand({ DistributionId: dist.Id, InvalidationBatch: { CallerReference: `inv-${Date.now()}`, Paths: { Quantity: 2, Items: ['/index.html', '/'] } } }));
  log(`CloudFront ${dist.Id}: invalidación enviada`);
}
const httpsUrl = `https://${dist.DomainName}/`;

// 6) CORS de la API y URL del portal para los correos
await ensureFunctionUrl([`https://${dist.DomainName}`]);
await setConfig('app_url', httpsUrl);

log(`Portal (HTTPS):  ${httpsUrl}`);
log(`Portal (S3):     http://${websiteEndpoint()}/`);
