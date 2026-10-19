import { createHmac, randomBytes } from 'node:crypto';

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/** Lee los claims de un JWT sin verificar la firma (solo para aserciones sobre su contenido). */
export function decodeClaims(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  if (!payload) throw new Error(`No es un JWT: ${token.slice(0, 20)}…`);
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

/**
 * Un JWT bien formado, con los mismos claims que emitiría auth-service para un ADMIN, pero firmado
 * con una clave aleatoria. Si el Gateway lo aceptara, cualquiera podría fabricarse un token ADMIN.
 */
export function forgeAdminToken(): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({ sub: 'ADMIN', role: 'ADMIN', iss: 'auth-service', iat: now, exp: now + 3600 }),
  );
  const signature = createHmac('sha256', randomBytes(32)).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}
