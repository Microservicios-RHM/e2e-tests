import assert from 'node:assert/strict';
import { When as Cuando } from '@cucumber/cucumber';
import { forgeAdminToken } from '../support/jwt.ts';
import type { InvalidTokenKind } from '../support/parameter-types.ts';
import type { RhmWorld } from '../support/world.ts';

Cuando('consulto la lista de empleados', async function (this: RhmWorld) {
  await this.send('GET', '/empleados');
});

Cuando('consulto la lista de empleados sin token de autenticación', async function (this: RhmWorld) {
  await this.send('GET', '/empleados', { token: null });
});

Cuando('consulto la lista de empleados con un token {tipoDeToken}', async function (this: RhmWorld, kind: InvalidTokenKind) {
  switch (kind) {
    case 'malformado':
      await this.send('GET', '/empleados', { token: 'esto-no-es-un-jwt' });
      break;
    case 'firmado con una clave ajena':
      await this.send('GET', '/empleados', { token: forgeAdminToken() });
      break;
    case 'válido pero sin el esquema Bearer': {
      // Un token ADMIN legítimo, enviado sin el prefijo "Bearer ": la cabecera no cumple el esquema.
      await this.authenticateAs('ADMIN');
      await this.send('GET', '/empleados', { authorization: this.actorToken! });
      break;
    }
  }
});

Cuando(
  'consulto la lista de empleados usando el token de activación como token de acceso',
  async function (this: RhmWorld) {
    assert.ok(this.activationToken, 'El escenario no obtuvo un token de activación');
    await this.send('GET', '/empleados', { token: this.activationToken });
  },
);
