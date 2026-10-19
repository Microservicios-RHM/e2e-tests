import { existsSync } from 'node:fs';

// Toda la configuración llega por variables de entorno: ninguna URL ni credencial está escrita en
// los pasos. Un .env local (ver .env.example) es opcional y nunca se versiona.
if (existsSync('.env')) process.loadEnvFile('.env');

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revise e2e-tests/.env.example`);
  }
  return value;
}

function integer(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`La variable ${name} debe ser un entero positivo (valor actual: "${raw}")`);
  }
  return value;
}

export interface PollingSettings {
  readonly maxAttempts: number;
  readonly intervalMs: number;
}

export const config = {
  baseUrl: (process.env.BASE_URL?.trim() || 'http://localhost:8080').replace(/\/+$/, ''),

  admin: {
    username: required('E2E_ADMIN_USERNAME'),
    password: required('E2E_ADMIN_PASSWORD'),
  },

  // Contraseña con la que la suite activa las cuentas USER que crea en cada escenario. Debe cumplir
  // la política de auth-service (≥ 8 caracteres, al menos una letra y un dígito).
  userPassword: process.env.E2E_USER_PASSWORD?.trim() || 'Clave2026segura',

  polling: {
    maxAttempts: integer('E2E_POLL_MAX_ATTEMPTS', 15),
    intervalMs: integer('E2E_POLL_INTERVAL_MS', 2000),
  } satisfies PollingSettings,

  // Ventana durante la cual una condición negativa ("no llega ninguna notificación") debe
  // mantenerse para darla por cierta. Ver README, sección "Polling sobre condiciones negativas".
  quietWindow: {
    maxAttempts: integer('E2E_QUIET_ATTEMPTS', 3),
    intervalMs: integer('E2E_QUIET_INTERVAL_MS', 2000),
  } satisfies PollingSettings,

  requestTimeoutMs: integer('E2E_REQUEST_TIMEOUT_MS', 10_000),
} as const;
