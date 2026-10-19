import assert from 'node:assert/strict';
import { Given as Dado, When as Cuando, Then as Entonces } from '@cucumber/cucumber';
import { describeResponse } from '../support/http.ts';
import { esperarHastaQue } from '../support/polling.ts';
import { isoDateFromToday, type RhmWorld } from '../support/world.ts';

async function schedule(world: RhmWorld, fechaInicio: string, fechaFin: string) {
  const response = await world.send('POST', '/vacaciones', {
    body: { empleadoId: world.currentEmployee.id, fechaInicio, fechaFin },
  });
  if (response.status === 201) {
    world.vacationId = response.body.data.id;
    world.vacationIds.push(response.body.data.id);
  }
  return response;
}

async function forceTransition(world: RhmWorld, transition: 'forzar-inicio' | 'forzar-fin') {
  assert.ok(world.vacationId, 'El escenario no tiene un período de vacaciones programado');
  const response = await world.asObserver('POST', `/vacaciones/${encodeURIComponent(world.vacationId)}/${transition}`);
  assert.equal(response.status, 200, `No fue posible ${transition} el período: ${describeResponse(response)}`);
}

Cuando('programo vacaciones para el empleado desde {fecha} hasta {fecha}', async function (this: RhmWorld, inicio: string, fin: string) {
  await schedule(this, inicio, fin);
});

Dado(
  'que el empleado tiene vacaciones programadas desde {fecha} hasta {fecha}',
  async function (this: RhmWorld, inicio: string, fin: string) {
    const response = await schedule(this, inicio, fin);
    assert.equal(response.status, 201, `Precondición incumplida: ${describeResponse(response)}`);
  },
);

Entonces('el período queda en estado {string}', async function (this: RhmWorld, estado: string) {
  const response = await this.asObserver('GET', `/vacaciones/${encodeURIComponent(this.vacationId!)}`);
  assert.equal(response.body?.data?.estado, estado, describeResponse(response));
});

Entonces('la respuesta indica el período con el que se cruza', function (this: RhmWorld) {
  const conflict = this.response.body?.error?.conflictingPeriod;
  assert.ok(conflict, `La respuesta no incluye el período en conflicto. ${describeResponse(this.response)}`);
  assert.equal(conflict.id, this.vacationIds[0], describeResponse(this.response));
});

/**
 * Control del tiempo. El período se programa a partir de MAÑANA (UTC) y se inicia con el disparo
 * manual del Reto 5 (POST /vacaciones/{id}/forzar-inicio), que ejecuta la misma transición y publica
 * el mismo evento que el scheduler. Programarlo para mañana garantiza que el scheduler nunca lo
 * toque (solo inicia períodos con fechaInicio <= hoy), así que la prueba no depende de su
 * frecuencia ni compite con él: no hay espera por el reloj ni 409 intermitentes.
 */
Cuando('programo un período de vacaciones que inicia de inmediato', async function (this: RhmWorld) {
  const response = await schedule(this, isoDateFromToday(1), isoDateFromToday(5));
  assert.equal(response.status, 201, describeResponse(response));
  await forceTransition(this, 'forzar-inicio');
});

Cuando('el período de vacaciones finaliza', async function (this: RhmWorld) {
  await forceTransition(this, 'forzar-fin');
});

Dado('que el empleado está de vacaciones con la cuenta suspendida', async function (this: RhmWorld) {
  const response = await schedule(this, isoDateFromToday(1), isoDateFromToday(5));
  assert.equal(response.status, 201, describeResponse(response));
  await forceTransition(this, 'forzar-inicio');

  const employee = this.currentEmployee;
  await esperarHastaQue('la cuenta quede suspendida por las vacaciones', async () => {
    const login = await this.login(employee.email, employee.password!);
    return {
      done: login.status === 401 && login.body?.error?.code === 'ACCOUNT_SUSPENDED',
      observation: describeResponse(login),
    };
  });
});
