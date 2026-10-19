# language: es
@onboarding
Característica: Onboarding de empleados
  Como administrador de recursos humanos
  Quiero registrar a los nuevos empleados
  Para que se les cree automáticamente su cuenta de acceso y reciban sus notificaciones

  Antecedentes:
    Dado que existe un departamento "IT" con nombre "Tecnología"
    Y que estoy autenticado como "ADMIN"

  Escenario: Registrar un empleado le crea una cuenta de acceso
    Cuando registro un empleado nuevo en el departamento "IT"
    Entonces la respuesta debe tener código 201
    Y el empleado sigue en estado "ACTIVO"
    Y eventualmente el servicio de autenticación debe haber creado su cuenta con un enlace de activación

  Escenario: Registrar un empleado le envía una notificación de bienvenida
    Cuando registro un empleado nuevo en el departamento "IT"
    Entonces la respuesta debe tener código 201
    Y eventualmente se debe registrar una notificación de tipo "BIENVENIDA" para el empleado

  Escenario: El nuevo empleado establece su contraseña e inicia sesión
    Dado que registré un empleado nuevo en el departamento "IT"
    Y eventualmente el servicio de autenticación debe haber creado su cuenta con un enlace de activación
    Pero el empleado todavía no puede iniciar sesión
    Cuando el empleado establece su contraseña con el enlace de activación
    Entonces la respuesta debe tener código 200
    Y el empleado puede iniciar sesión con su nueva contraseña
    Y su token de acceso lo identifica con el rol "USER"
    Y eventualmente se debe registrar una notificación de tipo "CUENTA" para el empleado

  Escenario: La contraseña nueva debe cumplir la política de seguridad
    Dado que registré un empleado nuevo en el departamento "IT"
    Y eventualmente el servicio de autenticación debe haber creado su cuenta con un enlace de activación
    Cuando el empleado intenta establecer la contraseña "corta"
    Entonces la respuesta debe tener código 400
    Y el código de error debe ser "WEAK_PASSWORD"

  Escenario: No se puede registrar dos veces el mismo correo
    Dado que registré un empleado nuevo en el departamento "IT"
    Cuando registro otro empleado con el mismo correo
    Entonces la respuesta debe tener código 400
    Y el código de error debe ser "DUPLICATE_EMAIL"

  Esquema del escenario: Se rechaza el registro con datos inválidos (<caso>)
    Cuando registro un empleado nuevo con el campo "<campo>" igual a "<valor>"
    Entonces la respuesta debe tener código 400
    Y el código de error debe ser "<codigo>"
    Y el empleado no queda registrado

    Ejemplos:
      | caso                       | campo          | valor          | codigo               |
      | departamento inexistente   | departamentoId | NO-EXISTE      | DEPARTMENT_NOT_FOUND |
      | correo faltante            | email          |                | VALIDATION_ERROR     |
      | correo con formato inválido | email         | no-es-un-email | VALIDATION_ERROR     |
      | nombre faltante            | nombre         |                | VALIDATION_ERROR     |
      | fecha de ingreso inválida  | fechaIngreso   | 2026-13-45     | VALIDATION_ERROR     |
