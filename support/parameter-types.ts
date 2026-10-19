import { defineParameterType } from '@cucumber/cucumber';
import { isoDateFromToday } from './world.ts';

/**
 * {fecha}: fechas relativas a hoy, en lenguaje natural, para que los escenarios no caduquen.
 * Una fecha fija ("2026-11-02") pasaría hoy y fallaría como "fecha en el pasado" dentro de un mes.
 */
defineParameterType({
  name: 'fecha',
  regexp: /hoy|mañana|ayer|dentro de \d+ días?|hace \d+ días?/,
  transformer(text: string): string {
    if (text === 'hoy') return isoDateFromToday(0);
    if (text === 'mañana') return isoDateFromToday(1);
    if (text === 'ayer') return isoDateFromToday(-1);
    const days = Number.parseInt(/\d+/.exec(text)![0], 10);
    return isoDateFromToday(text.startsWith('hace') ? -days : days);
  },
});

export const INVALID_TOKEN_KINDS = [
  'malformado',
  'firmado con una clave ajena',
  'válido pero sin el esquema Bearer',
] as const;

export type InvalidTokenKind = (typeof INVALID_TOKEN_KINDS)[number];

/** {tipoDeToken}: las variantes de token inválido del Esquema del escenario de seguridad. */
defineParameterType({
  name: 'tipoDeToken',
  regexp: new RegExp(INVALID_TOKEN_KINDS.join('|')),
  transformer: (text: string) => text as InvalidTokenKind,
});

/** {estadoDeCuenta}: estado de una cuenta bloqueada, traducido al código de error de auth-service. */
defineParameterType({
  name: 'estadoDeCuenta',
  regexp: /suspendida|desactivada/,
  transformer: (text: string) => (text === 'suspendida' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_DEACTIVATED'),
});
