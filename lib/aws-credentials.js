// El compute de Amplify Hosting (SSR) para esta app no expone un rol IAM al
// runtime (el SDK responde "Could not load credentials from any providers"
// aunque el service role de la app este configurado). Como respaldo, se
// permite pasar credenciales explicitas via variables de entorno CON NOMBRE
// PROPIO (no AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY, que son nombres
// reservados por Lambda y no siempre se pueden fijar). Solo viven aqui, del
// lado servidor: nunca se mandan al navegador ni se guardan en el repo.
export function resolveAwsCredentials() {
  const accessKeyId = process.env.NAVE_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.NAVE_AWS_SECRET_ACCESS_KEY;

  if (accessKeyId && secretAccessKey) {
    return { accessKeyId, secretAccessKey };
  }

  // Sin estas variables, se deja que el SDK use su cadena de credenciales
  // por defecto (util en local con AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY,
  // o si en el futuro el rol de servicio de Amplify si queda disponible).
  return undefined;
}
