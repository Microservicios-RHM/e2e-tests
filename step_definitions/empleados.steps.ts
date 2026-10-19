import assert from 'node:assert/strict';
import { Given as Dado, When as Cuando, Then as Entonces } from '@cucumber/cucumber';
import { describeResponse } from '../support/http.ts';
import type { RhmWorld, TestEmployee } from '../support/world.ts';

function employeeBody(employee: TestEmployee): Omit<TestEmployee, 'password'> {
  const { password: _ignored, ...body } = employee;
  return body;
}

// ---- Registro ------------------------------------------------------------------------------

// "registro" (el actor lo hace) e "intento registrar" (se espera que falle) son el mismo paso: la
// diferencia está en lo que afirma el "Entonces" siguiente, no en la acción.
Cuando(/^(?:registro|intento registrar) un empleado nuevo en el departamento "([^"]*)"$/, async function (this: RhmWorld, departamentoId: string) {
  const employee = this.newEmployeeData({ departamentoId });
  this.employee ??= employee;
  await this.send('POST', '/empleados', { body: employeeBody(employee) });
  if (this.response.status === 201) this.employee = employee;
});

Dado('que registré un empleado nuevo en el departamento {string}', async function (this: RhmWorld, departamentoId: string) {
  await this.ensureDepartment(departamentoId, departamentoId);
  await this.createEmployee({ departamentoId });
});

Cuando('registro otro empleado con el mismo correo', async function (this: RhmWorld) {
  const duplicate = this.newEmployeeData({ email: this.currentEmployee.email.toUpperCase() });
  await this.send('POST', '/empleados', { body: employeeBody(duplicate) });
});

Cuando(
  'registro un empleado nuevo con el campo {string} igual a {string}',
  async function (this: RhmWorld, field: string, value: string) {
    const employee = this.newEmployeeData();
    const body: Record<string, unknown> = employeeBody(employee);
    // Una celda vacía en la tabla de Ejemplos significa "el campo no se envía".
    if (value === '') delete body[field];
    else body[field] = value;

    this.employee = employee;
    await this.send('POST', '/empleados', { body });
  },
);

Dado('que existe un empleado activo con credenciales establecidas', async function (this: RhmWorld) {
  await this.provisionActiveEmployee();
});

// ---- Retiro ---------------------------------------------------------------------------------

Cuando(/^(?:retiro|intento retirar) al empleado$/, async function (this: RhmWorld) {
  await this.send('DELETE', `/empleados/${encodeURIComponent(this.currentEmployee.id)}`);
});

Cuando('consulto los empleados con estado {string}', async function (this: RhmWorld, estado: string) {
  await this.send('GET', `/empleados?estado=${encodeURIComponent(estado)}`);
});

// ---- Verificaciones sobre el registro del empleado ------------------------------------------

async function fetchEmployee(world: RhmWorld) {
  const response = await world.asObserver('GET', `/empleados/${encodeURIComponent(world.currentEmployee.id)}`);
  return response;
}

Entonces('el empleado sigue en estado {string}', async function (this: RhmWorld, estado: string) {
  const response = await fetchEmployee(this);
  assert.equal(response.status, 200, describeResponse(response));
  assert.equal(response.body.data.estado, estado, `Estado inesperado. ${describeResponse(response)}`);
});

Entonces('el empleado tiene registrada su fecha de retiro', async function (this: RhmWorld) {
  const response = await fetchEmployee(this);
  const fechaRetiro = response.body?.data?.fechaRetiro;
  assert.ok(fechaRetiro, `El empleado retirado no tiene fechaRetiro. ${describeResponse(response)}`);
  const retiredAt = Date.parse(fechaRetiro);
  assert.ok(Math.abs(Date.now() - retiredAt) < 10 * 60_000, `fechaRetiro (${fechaRetiro}) no corresponde a este retiro`);
});

Entonces('el empleado no queda registrado', async function (this: RhmWorld) {
  const response = await fetchEmployee(this);
  assert.equal(response.status, 404, `El registro rechazado quedó persistido. ${describeResponse(response)}`);
});

Entonces('el empleado aparece en el resultado', function (this: RhmWorld) {
  const ids = (this.response.body?.data ?? []).map((employee: { id: string }) => employee.id);
  assert.ok(ids.includes(this.currentEmployee.id), `${this.currentEmployee.id} no aparece entre ${ids.length} empleados`);
  for (const employee of this.response.body.data) assert.equal(employee.estado, 'RETIRADO');
});
