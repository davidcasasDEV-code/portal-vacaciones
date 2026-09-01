# Portal de Vacaciones NAVE

Version Next.js del portal de vacaciones.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000/login.html`.

## Variables

Copia `.env.example` a `.env.local` y configura `AWS_REGION`. Para desarrollo local puedes usar `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`; en Amplify es mejor usar un rol IAM limitado.

## Seguridad

Las credenciales AWS no se cargan en el navegador. El frontend usa `/api/dynamodb/*` y `/api/lambda/invoke`; esas rutas ejecutan AWS SDK v3 del lado servidor.
