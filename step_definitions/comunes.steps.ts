import assert from 'node:assert/strict';
import { Given as Dado, Then as Entonces } from '@cucumber/cucumber';
import { describeResponse, request } from '../support/http.ts';
import { esperarHastaQue } from '../support/polling.ts';
import type { Role, RhmWorld } from '../support/world.ts';

// Pasos transversales: estado del sistema, autenticación y verificación de la respuesta. Los usan
// todas las características.

Dado('que el sistema está desplegado y operativo', async function (this: RhmWorld) {
  // Justo después de `docker compose up -d` el Gateway puede tardar unos segundos en aceptar
  // conexiones: se espera con polling a que /health responda, en vez de fallar el primer escenario.
  this.lastResponse = await esperarHastaQue('el API Gateway responda en /health', async () => {
    const response = await request('GET', '/health');
    return { done: response.status === 200, value: response, observation: describeResponse(response) };
  });
});

Dado('que estoy autenticado como {string}', async function (this: RhmWorld, role: string) {
  assert.ok(role === 'ADMIN' || role === 'USER', `Rol no soportado por la suite: ${role}`);
  await this.authenticateAs(role as Role);
});

Dado('que existe un departamento {string} con nombre {string}', async function (this: RhmWorld, id: string, nombre: string) {
  await this.ensureDepartment(id, nombre);
});

Entonces('la respuesta debe tener código {int}', function (this: RhmWorld, expected: number) {
  assert.equal(
    this.response.status,
    expected,
    `Se esperaba el código ${expected} y se obtuvo ${this.response.status}.\n${describeResponse(this.response)}`,
  );
});

Entonces('el código de error debe ser {string}', function (this: RhmWorld, expected: string) {
  assert.equal(
    this.response.body?.error?.code,
    expected,
    `Se esperaba el código de error ${expected}.\n${describeResponse(this.response)}`,
  );
});

Entonces(
  'eventualmente se debe registrar una notificación de tipo {string} para el empleado',
  async function (this: RhmWorld, tipo: string) {
    const notification = await this.waitForNotification(this.currentEmployee.id, tipo);
    assert.equal(notification.destinatario, this.currentEmployee.email);
  },
);
