import assert from 'node:assert/strict';
import { Given as Dado, When as Cuando, Then as Entonces } from '@cucumber/cucumber';
import { config } from '../support/config.ts';
import { describeResponse, request } from '../support/http.ts';
import { decodeClaims } from '../support/jwt.ts';
import { confirmarQueSeMantiene, esperarHastaQue } from '../support/polling.ts';
import type { RhmWorld } from '../support/world.ts';

// Pasos sobre la cuenta de acceso del empleado: activación, login y recuperación de contraseña.

Entonces(
  'eventualmente el servicio de autenticación debe haber creado su cuenta con un enlace de activación',
  async function (this: RhmWorld) {
    this.activationToken = await this.waitForResetToken(this.currentEmployee.id, 1);
    const claims = decodeClaims(this.activationToken);
    assert.equal(claims.sub, this.currentEmployee.id, 'El token de activación no corresponde al empleado');
    assert.equal(claims.type, 'RESET_PASSWORD', 'El enlace no contiene un token de restablecimiento');
  },
);

Cuando('el empleado establece su contraseña con el enlace de activación', async function (this: RhmWorld) {
  assert.ok(this.activationToken, 'El escenario no obtuvo un token de activación');
  await this.send('POST', '/auth/reset-password', {
    token: null,
    body: { token: this.activationToken, nuevaPassword: config.userPassword },
  });
  if (this.response.status === 200) this.currentEmployee.password = config.userPassword;
});

Cuando('el empleado intenta establecer la contraseña {string}', async function (this: RhmWorld, password: string) {
  await this.send('POST', '/auth/reset-password', {
    token: null,
    body: { token: this.activationToken, nuevaPassword: password },
  });
});

// ---- Login ----------------------------------------------------------------------------------

async function loginAsEmployee(world: RhmWorld) {
  const employee = world.currentEmployee;
  return world.login(employee.email, employee.password ?? config.userPassword);
}

Dado('que el empleado puede iniciar sesión', async function (this: RhmWorld) {
  const response = await loginAsEmployee(this);
  assert.equal(response.status, 200, `Precondición incumplida: ${describeResponse(response)}`);
});

Entonces('el empleado todavía no puede iniciar sesión', async function (this: RhmWorld) {
  const response = await loginAsEmployee(this);
  assert.equal(response.status, 401, `Una cuenta sin activar no debería poder entrar. ${describeResponse(response)}`);
});

Entonces('el empleado puede iniciar sesión con su nueva contraseña', async function (this: RhmWorld) {
  this.lastResponse = await loginAsEmployee(this);
  assert.equal(this.response.status, 200, describeResponse(this.response));
  assert.ok(this.response.body?.data?.accessToken, 'El login no devolvió accessToken');
});

Entonces('su token de acceso lo identifica con el rol {string}', function (this: RhmWorld, role: string) {
  const claims = decodeClaims(this.response.body.data.accessToken);
  assert.equal(claims.sub, this.currentEmployee.id);
  assert.equal(claims.role, role);
});

/**
 * Polling sobre una condición "negativa" (el empleado deja de poder entrar). Para no confundir
 * "todavía no se procesó el evento" con "el sistema está mal", cada observación se clasifica:
 *   - 200                       → el evento aún no llega: seguir esperando
 *   - 401 con el código esperado → condición cumplida
 *   - cualquier otra cosa        → estado incorrecto: abortar de inmediato, sin agotar el timeout
 * Si se agota el timeout viendo solo 200, el mensaje dice que el evento nunca se procesó.
 */
Entonces(
  'eventualmente el empleado no puede iniciar sesión porque su cuenta está {estadoDeCuenta}',
  async function (this: RhmWorld, expectedCode: string) {
    await esperarHastaQue(`el login responda 401 ${expectedCode}`, async () => {
      const response = await loginAsEmployee(this);
      const code = response.body?.error?.code;
      return {
        done: response.status === 401 && code === expectedCode,
        fail: !(response.status === 200 || (response.status === 401 && code === expectedCode)),
        observation: response.status === 200 ? 'el login todavía responde 200 (evento sin procesar)' : describeResponse(response),
      };
    });
  },
);

Entonces(
  'el empleado sigue sin poder iniciar sesión porque su cuenta está {estadoDeCuenta}',
  async function (this: RhmWorld, expectedCode: string) {
    await confirmarQueSeMantiene(`el login siga respondiendo 401 ${expectedCode}`, async () => {
      const response = await loginAsEmployee(this);
      return { done: response.status === 401 && response.body?.error?.code === expectedCode, observation: describeResponse(response) };
    });
  },
);

Entonces('eventualmente el empleado puede iniciar sesión nuevamente', async function (this: RhmWorld) {
  await esperarHastaQue('el login vuelva a responder 200', async () => {
    const response = await loginAsEmployee(this);
    const code = response.body?.error?.code;
    return {
      done: response.status === 200,
      fail: !(response.status === 200 || code === 'ACCOUNT_SUSPENDED'),
      observation: describeResponse(response),
    };
  });
});

// ---- Recuperación de contraseña --------------------------------------------------------------

async function requestRecovery(email: string) {
  const response = await request('POST', '/auth/recover-password', { body: { email } });
  // La respuesta es deliberadamente la misma exista o no la cuenta (anti-enumeración de correos),
  // así que el código HTTP no prueba nada por sí solo: lo que se verifica es el efecto.
  assert.equal(response.status, 200, describeResponse(response));
}

Dado('que el empleado solicitó recuperar su contraseña y recibió el enlace', async function (this: RhmWorld) {
  await requestRecovery(this.currentEmployee.email);
  // 1.ª notificación SEGURIDAD = activación; la 2.ª es la de esta recuperación.
  this.recoveryToken = await this.waitForResetToken(this.currentEmployee.id, 2);
});

Entonces(
  'restablecer la contraseña con el enlace de recuperación es rechazado con el error {string}',
  async function (this: RhmWorld, code: string) {
    await this.send('POST', '/auth/reset-password', {
      token: null,
      body: { token: this.recoveryToken, nuevaPassword: 'OtraClave2026' },
    });
    assert.equal(this.response.status, 401, describeResponse(this.response));
    assert.equal(this.response.body?.error?.code, code, describeResponse(this.response));
  },
);

Entonces('una nueva solicitud de recuperación no le envía ningún enlace', async function (this: RhmWorld) {
  const countSecurity = async () =>
    (await this.notificationsFor(this.currentEmployee.id)).filter((item) => item.tipo === 'SEGURIDAD').length;

  const before = await countSecurity();
  await requestRecovery(this.currentEmployee.email);

  // auth-service decide de forma síncrona, dentro de la misma petición, no publicar el evento para
  // una cuenta desactivada; el paso anterior (login → ACCOUNT_DEACTIVATED) es la barrera que prueba
  // que la baja ya estaba aplicada. La ventana confirma que no llega ningún enlace nuevo.
  await confirmarQueSeMantiene('no se registre ninguna notificación SEGURIDAD nueva', async () => {
    const now = await countSecurity();
    return { done: now === before, observation: `${now - before} notificación(es) SEGURIDAD nueva(s)` };
  });
});
