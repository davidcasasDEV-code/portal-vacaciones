# Portal de Vacaciones NAVE

Portal interno de solicitudes, aprobaciones y reportes de vacaciones, construido con
Next.js 15 (App Router) siguiendo el mismo stack de Go PulsarX Suite: sesión propia
(JWT + cookie httpOnly, sin Cognito), Tailwind CSS y AWS SDK v3 del lado servidor.
Los datos siguen viviendo en las mismas tablas DynamoDB de siempre.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
# Genera un SESSION_TOKEN_SECRET (>= 32 caracteres):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Completa AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY con credenciales personales
# con acceso de lectura/escritura a las tablas NAVE_* y a los Lambdas NAVE.
npm run dev
```

Abre `http://localhost:3000`.

## Arquitectura

- `app/(auth)/*` — login, registro, recuperar cuenta (paginas publicas).
- `app/(portal)/*` — dashboard, vacaciones, mis solicitudes, aprobaciones,
  reportes (solo Admin) y días extra. Protegidas por sesión (`lib/context.js`).
- `app/api/*` — rutas server-side que hablan con DynamoDB/Lambda. Cada una valida
  la sesión y el rol antes de tocar datos (`lib/permissions.js`).
- `lib/*` — auth (JWT/bcrypt), acceso a DynamoDB, reglas de negocio de vacaciones,
  festivos MX, notificaciones (Send_Email/Send_Team_MSG existentes).

## Seguridad

- Las credenciales AWS nunca se cargan en el navegador; todo el acceso a
  DynamoDB/Lambda ocurre en rutas `app/api/*` ejecutadas en el servidor.
- La sesión vive en una cookie httpOnly firmada (JWT), no en `localStorage`. El
  rol y la autorización se validan en cada request contra esa sesión, nunca
  contra datos que mande el navegador.
- Las contraseñas se validan con bcrypt; las cuentas con el hash legado
  (SHA-256, del portal anterior) se migran a bcrypt automáticamente en su
  siguiente login exitoso.

Ver `docs/amplify-migration.md` para el despliegue en Amplify Hosting.
