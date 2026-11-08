import assert from 'node:assert/strict';
import { Given as Dado, When as Cuando, Then as Entonces } from '@cucumber/cucumber';
import { describeResponse } from '../support/http.ts';
import { esperarHastaQue } from '../support/polling.ts';
import type { RhmWorld, TestEmployee } from '../support/world.ts';

async function waitForProfile(world: RhmWorld, employee: TestEmployee) {
  return esperarHastaQue(`el perfil de ${employee.id} exista`, async () => {
    const response = await world.asObserver('GET', `/perfiles/${encodeURIComponent(employee.id)}`);
    return {
      done: response.status === 200,
      value: response,
      fail: response.status !== 200 && response.status !== 404,
      observation: describeResponse(response),
    };
  });
}

Cuando(
  'actualizo mi perfil con teléfono {string} y ciudad {string}',
  async function (this: RhmWorld, telefono: string, ciudad: string) {
    await waitForProfile(this, this.currentEmployee);
    await this.send('PUT', `/perfiles/${encodeURIComponent(this.currentEmployee.id)}`, {
      body: { telefono, ciudad },
    });
  },
);

Entonces(
  'mi perfil conserva el teléfono {string} y la ciudad {string}',
  function (this: RhmWorld, telefono: string, ciudad: string) {
    assert.equal(this.response.body?.data?.telefono, telefono, describeResponse(this.response));
    assert.equal(this.response.body?.data?.ciudad, ciudad, describeResponse(this.response));
  },
);

Dado('que existe otro empleado con perfil disponible', async function (this: RhmWorld) {
  const owner = this.currentEmployee;
  const other = await this.createEmployee();
  await waitForProfile(this, other);
  this.otherEmployee = other;
  this.employee = owner;
});

Cuando('intento actualizar el perfil del otro empleado', async function (this: RhmWorld) {
  assert.ok(this.otherEmployee, 'El escenario no preparó el segundo empleado');
  await this.send('PUT', `/perfiles/${encodeURIComponent(this.otherEmployee.id)}`, {
    body: { ciudad: 'Bogotá' },
  });
});
