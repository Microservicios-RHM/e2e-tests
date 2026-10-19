import { setTimeout as delay } from 'node:timers/promises';
import { config, type PollingSettings } from './config.ts';

/**
 * Error de timeout del polling. Incluye la última observación, para que el reporte diga qué se
 * esperaba y qué se vio realmente, no solo "se agotó el tiempo".
 */
export class PollingTimeoutError extends Error {
  constructor(description: string, attempts: number, lastObservation: string) {
    super(
      `Condición no cumplida después de ${attempts} intentos: ${description}.\n` +
        `Última observación: ${lastObservation}`,
    );
    this.name = 'PollingTimeoutError';
  }
}

/**
 * Resultado de una sonda: si la condición ya se cumple y qué se observó (para el diagnóstico).
 *
 * `fail` distingue "todavía no se procesó el evento" de "el sistema está mal": la sonda lo marca
 * cuando observa un estado que no es ni el de antes del evento ni el esperado (p. ej. un 401 con
 * un código de error distinto). En ese caso no tiene sentido seguir esperando y se aborta ya.
 */
export interface Probe<T> {
  readonly done: boolean;
  readonly value?: T;
  readonly observation: string;
  readonly fail?: boolean;
}

class PollingAbortedError extends Error {
  constructor(description: string, observation: string) {
    super(`Estado inesperado mientras se esperaba que ${description}: ${observation}`);
    this.name = 'PollingAbortedError';
  }
}

/**
 * esperarHastaQue: consulta repetidamente hasta que la condición se cumpla o se agoten los intentos.
 *
 * - Termina en cuanto la condición se cumple: si el evento se procesa en 300 ms, la prueba no
 *   espera más. Esa es la ventaja frente a un sleep fijo.
 * - La pausa ocurre solo ENTRE intentos (nunca antes del primero ni después del último).
 * - Un error de la sonda (p. ej. 404 porque el recurso aún no existe, o un fallo de red) cuenta
 *   como "todavía no", no aborta la espera; queda registrado como última observación.
 */
export async function esperarHastaQue<T>(
  description: string,
  probe: () => Promise<Probe<T>>,
  settings: PollingSettings = config.polling,
): Promise<T> {
  let lastObservation = 'sin observaciones';

  for (let attempt = 1; attempt <= settings.maxAttempts; attempt += 1) {
    let result: Probe<T>;
    try {
      result = await probe();
    } catch (error) {
      result = { done: false, observation: `error: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (result.done) return result.value as T;
    if (result.fail) throw new PollingAbortedError(description, result.observation);
    lastObservation = result.observation;
    if (attempt < settings.maxAttempts) await delay(settings.intervalMs);
  }

  throw new PollingTimeoutError(description, settings.maxAttempts, lastObservation);
}

/**
 * confirmarQueSeMantiene: verifica que una condición negativa siga siendo cierta durante toda una
 * ventana de observación. Falla en cuanto se viola (no espera al final), y solo tiene sentido
 * después de una "barrera": un hecho positivo que prueba que el sistema ya procesó lo anterior.
 */
export async function confirmarQueSeMantiene(
  description: string,
  probe: () => Promise<Probe<unknown>>,
  settings: PollingSettings = config.quietWindow,
): Promise<void> {
  for (let attempt = 1; attempt <= settings.maxAttempts; attempt += 1) {
    const result = await probe();
    if (!result.done) {
      throw new Error(`Se esperaba que se mantuviera: ${description}.\nPero se observó: ${result.observation}`);
    }
    if (attempt < settings.maxAttempts) await delay(settings.intervalMs);
  }
}
