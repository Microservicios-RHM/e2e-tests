import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import { config } from './config.ts';
import { describeResponse, request, type HttpResponse, type RequestOptions } from './http.ts';
import { esperarHastaQue } from './polling.ts';

export type Role = 'ADMIN' | 'USER';

export interface TestEmployee {
  readonly id: string;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly numeroEmpleado: string;
  readonly cargo: string;
  readonly area: string;
  readonly departamentoId: string;
  readonly fechaIngreso: string;
  password?: string;
}

export interface Notification {
  readonly id: string;
  readonly tipo: string;
  readonly destinatario: string;
  readonly mensaje: string;
  readonly fechaEnvio: string;
  readonly empleadoId: string;
}

// Identificador de esta ejecución de la suite: todo dato creado lleva este prefijo, así que dos
// ejecuciones (o dos escenarios) nunca chocan aunque la base conserve datos de corridas anteriores.
const RUN_ID = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase();
let sequence = 0;

export function uniqueSuffix(): string {
  sequence += 1;
  return `${RUN_ID}-${String(sequence).padStart(3, '0')}`;
}

/** Fecha ISO (AAAA-MM-DD) a N días de hoy, en UTC: la misma zona horaria de los contenedores. */
export function isoDateFromToday(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Contexto compartido entre los pasos de UN escenario ("World" de Cucumber).
 *
 * Cucumber crea una instancia nueva por escenario, de modo que el token, la última respuesta y los
 * datos creados nunca se filtran de un escenario a otro: esa es la base de la independencia.
 *
 * Hay dos identidades en juego:
 *  - el ACTOR (`actorToken`): quien ejecuta las acciones del escenario ("Cuando consulto...").
 *    Lo fija el paso "Dado que estoy autenticado como ..." y sus respuestas quedan en `lastResponse`.
 *  - el OBSERVADOR (token ADMIN interno): lo usan los pasos de preparación y de verificación
 *    ("eventualmente se registra una notificación..."). Nunca pisa `lastResponse`, así que observar
 *    el sistema no altera lo que el escenario está afirmando.
 */
export class RhmWorld extends World {
  actorToken: string | null = null;
  actorRole: Role | null = null;
  lastResponse: HttpResponse | null = null;

  employee: TestEmployee | null = null;
  activationToken: string | null = null;
  recoveryToken: string | null = null;
  vacationId: string | null = null;
  readonly vacationIds: string[] = [];
  notificationBaseline = 0;

  private observerToken: string | null = null;

  constructor(options: IWorldOptions) {
    super(options);
  }

  // ---- Peticiones ---------------------------------------------------------------------------

  /** Acción del actor del escenario: su respuesta es la que verifican los pasos "Entonces". */
  async send(method: string, path: string, options: RequestOptions = {}): Promise<HttpResponse> {
    const token = 'token' in options ? options.token : this.actorToken;
    this.lastResponse = await request(method, path, { ...options, token });
    return this.lastResponse;
  }

  /** Petición del observador ADMIN: para preparar o verificar estado sin tocar `lastResponse`. */
  async asObserver(method: string, path: string, body?: unknown): Promise<HttpResponse> {
    return request(method, path, { token: await this.observer(), body });
  }

  get response(): HttpResponse {
    assert.ok(this.lastResponse, 'El escenario todavía no ha realizado ninguna petición');
    return this.lastResponse;
  }

  get currentEmployee(): TestEmployee {
    assert.ok(this.employee, 'El escenario no ha creado ningún empleado');
    return this.employee;
  }

  // ---- Autenticación ------------------------------------------------------------------------

  async login(username: string, password: string): Promise<HttpResponse> {
    return request('POST', '/auth/login', { body: { username, password } });
  }

  async authenticateAs(role: Role): Promise<void> {
    if (role === 'ADMIN') {
      this.actorToken = await this.observer();
    } else {
      const employee = this.employee?.password ? this.employee : await this.provisionActiveEmployee();
      const response = await this.login(employee.email, employee.password!);
      assert.equal(response.status, 200, `No fue posible iniciar sesión como USER: ${describeResponse(response)}`);
      this.actorToken = response.body.data.accessToken;
    }
    this.actorRole = role;
  }

  private async observer(): Promise<string> {
    if (this.observerToken) return this.observerToken;
    const response = await this.login(config.admin.username, config.admin.password);
    assert.equal(
      response.status,
      200,
      `El ADMIN semilla no pudo iniciar sesión; revise E2E_ADMIN_USERNAME/E2E_ADMIN_PASSWORD. ${describeResponse(response)}`,
    );
    this.observerToken = response.body.data.accessToken as string;
    return this.observerToken;
  }

  // ---- Datos de prueba ----------------------------------------------------------------------

  async ensureDepartment(id: string, nombre: string): Promise<void> {
    const existing = await this.asObserver('GET', `/departamentos/${encodeURIComponent(id)}`);
    if (existing.status === 200) return;

    const created = await this.asObserver('POST', '/departamentos', {
      id,
      nombre,
      descripcion: `Departamento ${nombre} creado por la suite e2e`,
    });
    // DUPLICATE_DEPARTMENT_ID: otra ejecución lo creó entre el GET y el POST; también sirve.
    assert.ok(
      created.status === 201 || created.body?.error?.code === 'DUPLICATE_DEPARTMENT_ID',
      `No fue posible preparar el departamento ${id}: ${describeResponse(created)}`,
    );
  }

  newEmployeeData(overrides: Partial<TestEmployee> = {}): TestEmployee {
    const suffix = uniqueSuffix();
    return {
      id: `E2E-${suffix}`,
      nombre: 'Prueba',
      apellido: 'Automatizada',
      email: `e2e.${suffix.toLowerCase()}@rhm.test`,
      numeroEmpleado: `NUM-${suffix}`,
      cargo: 'Analista',
      area: 'Tecnología',
      departamentoId: 'IT',
      fechaIngreso: isoDateFromToday(0),
      ...overrides,
    };
  }

  /** Registra el empleado como ADMIN observador y lo deja como empleado del escenario. */
  async createEmployee(overrides: Partial<TestEmployee> = {}): Promise<TestEmployee> {
    await this.ensureDepartment('IT', 'Tecnología');
    const employee = this.newEmployeeData(overrides);
    const { password: _ignored, ...body } = employee;
    const response = await this.asObserver('POST', '/empleados', body);
    assert.equal(response.status, 201, `No fue posible crear el empleado de prueba: ${describeResponse(response)}`);
    this.employee = employee;
    return employee;
  }

  /**
   * Precondición compleja de vacaciones y offboarding: un empleado recién creado, con su cuenta
   * activada y una contraseña conocida. Se recrea desde cero en cada escenario (sin datos
   * precargados ni dependencias de otros escenarios), recorriendo el mismo flujo que un humano.
   */
  async provisionActiveEmployee(): Promise<TestEmployee> {
    const employee = await this.createEmployee();
    const token = await this.waitForResetToken(employee.id, 1);
    this.activationToken = token;

    const reset = await request('POST', '/auth/reset-password', {
      body: { token, nuevaPassword: config.userPassword },
    });
    assert.equal(reset.status, 200, `No fue posible activar la cuenta: ${describeResponse(reset)}`);
    employee.password = config.userPassword;
    return employee;
  }

  // ---- Observación del sistema (asincrónica) ------------------------------------------------

  async notificationsFor(empleadoId: string): Promise<Notification[]> {
    const response = await this.asObserver('GET', `/notificaciones/${encodeURIComponent(empleadoId)}`);
    if (response.status === 404) return [];
    assert.equal(response.status, 200, describeResponse(response));
    return [...(response.body.data as Notification[])].sort((a, b) => a.fechaEnvio.localeCompare(b.fechaEnvio));
  }

  async waitForNotification(empleadoId: string, tipo: string, minimum = 1): Promise<Notification> {
    return esperarHastaQue(`se registra una notificación ${tipo} para ${empleadoId}`, async () => {
      const ofType = (await this.notificationsFor(empleadoId)).filter((item) => item.tipo === tipo);
      return {
        done: ofType.length >= minimum,
        value: ofType.at(-1),
        observation: `${ofType.length} notificación(es) ${tipo}, se esperaban al menos ${minimum}`,
      };
    });
  }

  /**
   * El token de activación/recuperación viaja en usuario.creado / usuario.recuperacion, y
   * notificaciones-service lo registra como un enlace dentro de una notificación SEGURIDAD.
   * `ordinal` = cuántas notificaciones SEGURIDAD deben existir (1 = activación, 2 = 1.ª recuperación).
   */
  async waitForResetToken(empleadoId: string, ordinal: number): Promise<string> {
    const notification = await this.waitForNotification(empleadoId, 'SEGURIDAD', ordinal);
    const match = /[?&]token=([^\s&]+)/.exec(notification.mensaje);
    assert.ok(match, `La notificación SEGURIDAD no contiene un enlace con token: "${notification.mensaje}"`);
    return match[1]!;
  }
}

setWorldConstructor(RhmWorld);
