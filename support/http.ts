import { config } from './config.ts';

export interface HttpResponse {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  // El cuerpo del envelope del ecosistema: { success, message, data, error? }.
  readonly body: any;
}

export interface RequestOptions {
  readonly token?: string | null;
  readonly body?: unknown;
  /** Cabecera Authorization literal (para probar tokens malformados). Tiene prioridad sobre token. */
  readonly authorization?: string;
}

/**
 * Cliente HTTP mínimo sobre fetch nativo (Node ≥ 22). Nunca lanza por códigos 4xx/5xx: el código
 * de estado es parte de lo que los escenarios verifican, no una excepción.
 */
export async function request(method: string, path: string, options: RequestOptions = {}): Promise<HttpResponse> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.authorization !== undefined) headers.Authorization = options.authorization;
  else if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(config.requestTimeoutMs),
  });

  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Respuesta no JSON (p. ej. un HTML de error de un proxy): se conserva como texto.
  }
  return { method, path, status: response.status, body };
}

/** Resumen corto de una respuesta para los mensajes de error de las aserciones. */
export function describeResponse(response: HttpResponse): string {
  const body = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
  return `${response.method} ${response.path} → ${response.status} ${body?.slice(0, 400) ?? ''}`;
}
