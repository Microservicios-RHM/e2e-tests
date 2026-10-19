# e2e-tests — pruebas funcionales BDD de la plataforma RHM

Suite de extremo a extremo del Reto 6. Describe en Gherkin, en español, los flujos de negocio de la
plataforma (seguridad, onboarding, vacaciones y offboarding) y los verifica con peticiones HTTP
reales contra el sistema completo desplegado con Docker Compose.

Es un proyecto independiente: no importa código de ningún microservicio. Las pruebas unitarias y de
integración de cada servicio viven junto a su código (ver [Estrategia de pruebas](#estrategia-de-pruebas-del-ecosistema)).

## Estrategia de pruebas del ecosistema

### La pirámide de pruebas

```text
        ╱╲          E2E / BDD (este repo)   pocos escenarios, lentos: el sistema completo
       ╱──╲
      ╱    ╲        Integración             el servicio contra su PostgreSQL real
     ╱──────╲
    ╱        ╲      Unitarias               muchas, en milisegundos: reglas de dominio aisladas
   ╱──────────╲
```

| Nivel | Dónde | Qué cubre | Cuántas |
|---|---|---|---|
| Unitarias | `ms-vacation/spec/{domain,application,infrastructure}`, `ms-employees/tests/{unit,*.test.ts}` | Solapamiento de vacaciones (tabla de 12 casos borde), las cuatro validaciones de `POST /vacaciones` y su orden, disparo manual de transiciones, unicidad de email/número/id, transición a `RETIRADO` y su carácter terminal, actualización, API HTTP con dobles | 88 (vacaciones, Ruby) + 58 (empleados, TypeScript) |
| Integración | `ms-vacation/spec/integration`, `ms-employees/tests/integration` | Repositorios reales contra PostgreSQL 17 desechable: migraciones, mapeo de columnas, índices únicos, CHECK de estados, la regla de solapamiento escrita en SQL | 20 + 9 |
| E2E / BDD | `e2e-tests/features` | Flujos de negocio completos a través del Gateway, incluidos los eventos asíncronos | 29 escenarios (209 pasos) |

Ninguna prueba unitaria necesita Docker: base de datos, cliente HTTP a departamentos y publicador
de eventos se sustituyen por dobles en memoria. Las de integración sí lo necesitan (levantan su
propio PostgreSQL) y se pueden excluir con `rspec --tag ~integration` / `npm run test:unit`.

## Tabla de reportes (contrato con el Reto 7)

El pipeline de Jenkins leerá **exactamente** estas rutas, relativas a la raíz de cada repositorio.

| Suite | Comando | Reporte de resultados | Reporte de cobertura |
|---|---|---|---|
| `ms-employees` (unitarias + integración) | `npm ci && npm run test:ci` | `ms-employees/reports/junit.xml` | `ms-employees/reports/lcov.info` |
| `ms-vacation` (unitarias + integración) | `bundle install && bundle exec rspec` | `ms-vacation/reports/junit.xml` | `ms-vacation/reports/coverage.xml` (Cobertura) |
| `e2e-tests` (BDD) | `npm ci && npm test` (con el sistema arriba) | `e2e-tests/reports/junit.xml` | — |
| `e2e-tests` (BDD, navegable) | (el mismo comando) | `e2e-tests/reports/cucumber.json`, `e2e-tests/reports/cucumber.html` | — |

Los tres comandos devuelven un código de salida distinto de cero si una prueba falla **o** si la
cobertura cae por debajo del 70 % (umbral configurado en la herramienta, no revisado a mano).

Cobertura medida al cierre del Reto 6: **93,7 %** de líneas en `ms-employees` y **90,6 %** en
`ms-vacation`.

La base es ancha a propósito. Si la regla de solapamiento se rompe, la falla aparece como
`Domain::VacationPeriod#overlaps? detecta solapamiento cuando el nuevo período empieza el mismo día
en que termina el otro`, no como un escenario E2E que dice "algo se rompió en algún lado".

### ¿Por qué BDD?

En un sistema distribuido las pruebas unitarias no alcanzan para saber si el negocio funciona: el
alta de un empleado atraviesa cinco servicios y un broker. BDD describe esos flujos en el lenguaje
del negocio (Dado / Cuando / Entonces), de modo que el `.feature` es a la vez la especificación y
la prueba: **documentación viva**. Si el escenario pasa, lo que dice es cierto hoy.

## Herramientas

| Herramienta | Uso | Por qué |
|---|---|---|
| Cucumber.js 13 | Runner BDD | Implementación oficial de Cucumber para Node; genera JUnit XML, JSON y HTML de forma nativa |
| TypeScript (sin compilar) | Step definitions | Mismo lenguaje que Gateway, empleados y auth; Node ≥ 22.18 ejecuta `.ts` directamente, así que no hay paso de build |
| `fetch` nativo de Node | Cliente HTTP | Sin dependencias extra; el cliente nunca lanza por 4xx/5xx porque el código de estado es lo que se verifica |
| `@cucumber/pretty-formatter` | Salida de consola | Imprime cada paso en Gherkin, coloreado |

## Prerrequisitos

- Node.js ≥ 22.18 (probado con 22.18 y 24) y npm ≥ 10.
- Docker y Docker Compose v2, para levantar el sistema.
- El stack de `rhm-database-infrastructure` en la rama del Reto 5 o posterior (auth-service + JWT en el Gateway).

## Ejecución paso a paso

### 1. Levantar el sistema

```bash
cd ../rhm-database-infrastructure
docker compose up --build -d --wait
```

`--wait` espera a que todos los healthchecks estén en verde. Aun así, el primer paso de la suite
(`Dado que el sistema está desplegado y operativo`) hace polling sobre `/health` antes de empezar.

### 2. Configurar las variables de entorno

```bash
cd ../e2e-tests
npm ci
cp .env.example .env     # opcional: sin .env se usan las variables del entorno
```

| Variable | Por defecto | Descripción |
|---|---|---|
| `BASE_URL` | `http://localhost:8080` | URL del API Gateway |
| `E2E_ADMIN_USERNAME` | — (obligatoria) | Usuario del ADMIN semilla (`ADMIN_USERNAME` del compose) |
| `E2E_ADMIN_PASSWORD` | — (obligatoria) | Contraseña del ADMIN semilla (`ADMIN_PASSWORD` del compose) |
| `E2E_USER_PASSWORD` | `Clave2026segura` | Contraseña con la que la suite activa las cuentas USER que crea |
| `E2E_POLL_MAX_ATTEMPTS` / `E2E_POLL_INTERVAL_MS` | `15` / `2000` | Polling de eventos asíncronos |
| `E2E_QUIET_ATTEMPTS` / `E2E_QUIET_INTERVAL_MS` | `3` / `2000` | Ventana de confirmación de condiciones negativas |

Ninguna URL ni credencial está escrita en los pasos.

### 3. Ejecutar la suite

```bash
npm test                 # suite completa
npm run test:smoke       # solo el escenario de humo (@humo)
npx cucumber-js --tags @vacaciones   # una característica
```

`npm test` devuelve un código de salida **distinto de cero** si algún escenario falla o queda
indefinido (`strict: true`), que es lo que hace fallar el pipeline del Reto 7.

#### Alternativa: como contenedor

Sin instalar Node, uniéndose a la red del stack:

```bash
docker compose run --rm --build bdd-tests
```

El directorio `reports/` está montado como volumen, así que los reportes quedan en el host.

### 4. Interpretar los resultados

La consola muestra cada escenario con sus pasos. Un paso fallido incluye qué se esperaba y qué se
obtuvo, por ejemplo:

```text
✘ Entonces la respuesta debe tener código 403
    AssertionError: Se esperaba el código 403 y se obtuvo 201.
    POST /empleados → 201 {"success":true,"message":"Empleado registrado", ...}
```

## Reportes

| Archivo | Formato | Para qué |
|---|---|---|
| `reports/junit.xml` | JUnit XML | Jenkins (`junit`): hace fallar el build y alimenta la tendencia |
| `reports/cucumber.json` | Cucumber JSON | Plugin *Cucumber Reports* de Jenkins |
| `reports/cucumber.html` | HTML | Reporte navegable por característica, escenario y paso; adjunta la última respuesta HTTP de cada escenario fallido |

Los tres se regeneran en cada ejecución y están en `.gitignore`.

## Escenarios implementados

| Característica | Escenarios | Qué verifica |
|---|---|---|
| `humo.feature` | 1 | El Gateway está arriba y responde `200` en `/health` |
| `seguridad.feature` | 7 | Sin token → 401; token malformado, firmado con otra clave o sin esquema Bearer → 401 (Esquema con 3 ejemplos); un token de activación no sirve como token de acceso; USER consulta (200) pero no registra ni retira (403); ADMIN registra, consulta y retira |
| `onboarding.feature` | 10 | El alta crea la cuenta en auth-service (evento → enlace de activación); notificación de BIENVENIDA; el empleado no entra antes de activar, establece su contraseña, entra con rol USER y recibe la notificación CUENTA; política de contraseñas; correo duplicado; datos inválidos (Esquema con 5 ejemplos) |
| `vacaciones.feature` | 6 | Programación exitosa + notificación VACACIONES; fin anterior, fin igual o inicio en el pasado (Esquema); solapamiento con el período en conflicto; **ciclo completo**: la cuenta se suspende al iniciar las vacaciones y se reactiva al terminar |
| `offboarding.feature` | 5 | Retiro + estado RETIRADO con fecha + notificación DESVINCULACION; el retirado no puede entrar; la recuperación de contraseña falla; aparece en `GET /empleados?estado=RETIRADO`; retirado durante las vacaciones: la cuenta **no** se reactiva al terminarlas |

## Decisiones técnicas

### Contexto compartido (World)

`support/world.ts` define `RhmWorld`. Cucumber crea **una instancia nueva por escenario**, así que
nada se filtra entre escenarios. Guarda:

- `actorToken`: el token de quien ejecuta el escenario. Lo fija `Dado que estoy autenticado como "ADMIN"|"USER"`; los pasos `Cuando` lo reutilizan sin volver a autenticarse.
- `lastResponse`: la última respuesta del actor, que verifican los pasos `Entonces`.
- Un **token de observador** ADMIN, separado del actor, para preparar datos y verificar efectos
  asíncronos (`eventualmente se debe registrar una notificación…`). Observar el sistema nunca pisa
  `lastResponse`: un escenario USER puede verificar notificaciones sin cambiar de identidad.
- La URL base y las credenciales salen de `support/config.ts` (variables de entorno).

La autenticación en `Antecedentes` es un paso más (`Y que estoy autenticado como "ADMIN"`): se
ejecuta antes de cada escenario del archivo y deja el token en el World de ese escenario.

### Aislamiento de datos

- Cada ejecución genera un `RUN_ID` y cada dato creado lleva un sufijo único
  (`E2E-<RUN_ID>-<n>`, `e2e.<run_id>-<n>@rhm.test`). Dos ejecuciones nunca chocan, aunque la base
  conserve datos de corridas anteriores, y no hace falta limpiar entre ejecuciones.
- Las precondiciones complejas (empleado con cuenta activa) se **recrean desde cero** en cada
  escenario recorriendo el flujo real: alta → espera del enlace de activación → `reset-password`.
  No hay datos precargados en la base ni escenarios que dependan de otros.
- El único dato compartido es el departamento `IT`, que se crea solo si no existe (idempotente).

### Polling

`support/polling.ts` implementa `esperarHastaQue` según el pseudocódigo del enunciado: consulta
hasta que la condición se cumple o se agotan los intentos, con pausa **solo entre intentos**. No hay
ningún `sleep` fijo en la suite.

| Parámetro | Valor | Justificación |
|---|---|---|
| Máximo de intentos | 15 | Holgura amplia frente a lo observado |
| Intervalo | 2 s | No satura al Gateway con consultas, y sigue siendo fino frente al tiempo típico de propagación |
| Timeout total | ≈ 30 s | Límite del enunciado; un evento que tarda más indica un problema real |

Calibración: en el entorno local los eventos se procesan en menos de 1 s, así que la mayoría de
las esperas terminan en el primer o segundo intento. Los 30 s cubren un arranque en frío del broker
o una máquina de CI cargada sin volver la suite lenta cuando todo va bien.

### Polling sobre condiciones negativas

"Eventualmente el empleado **no** puede entrar" es distinto de "eventualmente aparece algo". Para
distinguir "el evento aún no se procesó" de "el sistema está mal", cada observación se clasifica:

| Observación del login | Interpretación | Acción |
|---|---|---|
| `200` | El evento todavía no llega a auth-service | Seguir esperando |
| `401` con el código esperado (`ACCOUNT_SUSPENDED` / `ACCOUNT_DEACTIVATED`) | Condición cumplida | Terminar |
| Cualquier otra cosa (p. ej. `401 INVALID_CREDENTIALS`, `500`) | Estado incorrecto | **Abortar de inmediato** |

Si se agota el timeout viendo solo `200`, el mensaje dice explícitamente que el evento nunca se
procesó.

Para ausencias puras ("no llega ningún enlace de recuperación") se usa `confirmarQueSeMantiene`:
primero una **barrera** (un hecho positivo que prueba que el sistema ya procesó lo anterior, como
el login que ya responde `ACCOUNT_DEACTIVATED`) y después una ventana corta en la que la condición
debe seguir siendo cierta en cada observación.

### Control del tiempo en vacaciones

El scheduler del Reto 5 corre cada 60 s y solo inicia períodos con `fechaInicio <= hoy`. Para no
depender de él:

1. El período se programa a partir de **mañana** (UTC, la zona de los contenedores). El scheduler
   nunca lo toca, así que no compite con la prueba ni provoca un `409` intermitente.
2. El inicio y el fin se provocan con los endpoints de disparo manual del Reto 5
   (`POST /vacaciones/{id}/forzar-inicio` y `/forzar-fin`, solo ADMIN). Ejecutan la misma transición
   y publican el mismo evento que el scheduler.
3. Lo que se verifica con polling es el **efecto** del evento (el login), no la transición.

Así la prueba no queda acoplada a la frecuencia del scheduler: funciona igual con 60 s, 5 s o con
el scheduler apagado.

Se descartó bajar `SCHEDULER_INTERVAL_SECONDS`: haría la suite dependiente de la configuración del
despliegue y obligaría a usar fechas de "hoy", que el Reto 4 rechaza para la fecha de fin.

### Recuperación de contraseña de un empleado retirado

`POST /auth/recover-password` responde lo mismo exista o no la cuenta, para impedir la enumeración
de correos. El código HTTP no demuestra nada, así que el escenario verifica el **efecto**:

1. Antes del retiro, el empleado pide recuperar la contraseña y la suite obtiene el enlace.
2. Tras el retiro (barrera: el login ya responde `ACCOUNT_DEACTIVATED`), usar ese enlace es
   rechazado con `401 ACCOUNT_DEACTIVATED`.
3. Una nueva solicitud no genera ningún enlace (ventana de confirmación).

### Reutilización de pasos

Los pasos se escribieron parametrizados desde el principio y se comparten entre características:

| Paso | Lo usan |
|---|---|
| `la respuesta debe tener código {int}` / `el código de error debe ser {string}` | Todas |
| `que estoy autenticado como {string}` | Seguridad, onboarding, vacaciones, offboarding |
| `que existe un empleado activo con credenciales establecidas` | Vacaciones, offboarding |
| `eventualmente se debe registrar una notificación de tipo {string} para el empleado` | Onboarding, vacaciones, offboarding |
| `eventualmente el empleado no puede iniciar sesión porque su cuenta está {estadoDeCuenta}` | Vacaciones (`suspendida`), offboarding (`desactivada`) |
| `el período de vacaciones finaliza` | Vacaciones, offboarding |
| `retiro al empleado` / `intento retirar al empleado` | Seguridad, offboarding |

`{fecha}` es un tipo de parámetro propio (`hoy`, `mañana`, `dentro de 30 días`, `hace 3 días`), para
que los escenarios no caduquen: una fecha fija pasaría a ser "pasada" dentro de un mes.

## Estructura

```text
e2e-tests/
├── features/              ← archivos .feature (Gherkin en español)
├── step_definitions/      ← implementación de los pasos, por tema
├── support/
│   ├── world.ts           ← contexto compartido por escenario (World)
│   ├── polling.ts         ← esperarHastaQue / confirmarQueSeMantiene
│   ├── http.ts            ← cliente HTTP sobre fetch
│   ├── config.ts          ← variables de entorno
│   ├── parameter-types.ts ← {fecha}, {tipoDeToken}, {estadoDeCuenta}
│   ├── jwt.ts             ← lectura de claims y token falsificado para seguridad
│   └── hooks.ts           ← timeout por paso y adjunto de diagnóstico en fallos
├── cucumber.mjs           ← rutas, formatos y reportes
├── Dockerfile / docker-compose.yml  ← ejecución opcional como contenedor
└── package.json
```
