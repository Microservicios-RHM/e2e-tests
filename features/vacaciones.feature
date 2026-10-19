# language: es
@vacaciones
Característica: Vacaciones y suspensión temporal de la cuenta
  Como administrador de recursos humanos
  Quiero programar los períodos de vacaciones de los empleados
  Para que el sistema valide las fechas y suspenda su acceso mientras están de vacaciones

  Antecedentes:
    Dado que existe un empleado activo con credenciales establecidas
    Y que estoy autenticado como "ADMIN"

  Escenario: Programación exitosa de un período de vacaciones
    Cuando programo vacaciones para el empleado desde dentro de 30 días hasta dentro de 40 días
    Entonces la respuesta debe tener código 201
    Y el período queda en estado "PROGRAMADA"
    Y eventualmente se debe registrar una notificación de tipo "VACACIONES" para el empleado

  Esquema del escenario: Se rechazan períodos con fechas incoherentes (<caso>)
    Cuando programo vacaciones para el empleado desde <inicio> hasta <fin>
    Entonces la respuesta debe tener código 400
    Y el código de error debe ser "<codigo>"

    Ejemplos:
      | caso                           | inicio            | fin               | codigo             |
      | la fecha de fin es anterior    | dentro de 20 días | dentro de 10 días | INVALID_DATE_RANGE |
      | la fecha de fin es igual       | dentro de 20 días | dentro de 20 días | INVALID_DATE_RANGE |
      | el período inicia en el pasado | hace 3 días       | dentro de 5 días  | DATE_IN_THE_PAST   |

  Escenario: Se rechaza un período que se solapa con otro ya programado
    Dado que el empleado tiene vacaciones programadas desde dentro de 30 días hasta dentro de 40 días
    Cuando programo vacaciones para el empleado desde dentro de 40 días hasta dentro de 45 días
    Entonces la respuesta debe tener código 400
    Y el código de error debe ser "VACATION_OVERLAP"
    Y la respuesta indica el período con el que se cruza

  Escenario: La cuenta se suspende al iniciar las vacaciones y se reactiva al terminar
    Dado que el empleado puede iniciar sesión
    Cuando programo un período de vacaciones que inicia de inmediato
    Entonces eventualmente el empleado no puede iniciar sesión porque su cuenta está suspendida
    Cuando el período de vacaciones finaliza
    Entonces eventualmente el empleado puede iniciar sesión nuevamente
