import { After, Status, setDefaultTimeout } from '@cucumber/cucumber';
import { config } from './config.ts';
import { describeResponse } from './http.ts';
import type { RhmWorld } from './world.ts';

// Un paso con polling puede tardar hasta maxIntentos × intervalo; el preparatorio de un empleado
// activo encadena varias esperas. El timeout por paso deja margen sobre el peor caso del polling,
// para que un fallo se reporte como PollingTimeoutError (descriptivo) y no como timeout genérico.
setDefaultTimeout(config.polling.maxAttempts * config.polling.intervalMs * 3 + 10_000);

// Si un escenario falla, se adjunta al reporte la última respuesta HTTP del actor: en el HTML de
// Cucumber aparece junto al paso rojo, y basta para diagnosticar sin volver a ejecutar.
After(function (this: RhmWorld, { result }) {
  if (result?.status !== Status.FAILED || !this.lastResponse) return;
  this.attach(`Última respuesta HTTP:\n${describeResponse(this.lastResponse)}`, 'text/plain');
});
