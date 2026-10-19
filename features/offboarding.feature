# language: es
@offboarding
Característica: Offboarding de empleados
  Como administrador de recursos humanos
  Quiero desvincular a los empleados que se retiran
  Para que pierdan el acceso de forma definitiva y quede registro para auditoría

  Antecedentes:
    Dado que existe un empleado activo con credenciales establecidas
    Y que estoy autenticado como "ADMIN"

  Escenario: Desvinculación completa de un empleado
    Cuando retiro al empleado
    Entonces la respuesta debe tener código 200
    Y el empleado sigue en estado "RETIRADO"
    Y el empleado tiene registrada su fecha de retiro
    Y eventualmente se debe registrar una notificación de tipo "DESVINCULACION" para el empleado

  Escenario: Un empleado retirado no puede iniciar sesión
    Dado que el empleado puede iniciar sesión
    Cuando retiro al empleado
    Entonces eventualmente el empleado no puede iniciar sesión porque su cuenta está desactivada

  Escenario: La recuperación de contraseña falla para un empleado retirado
    Dado que el empleado solicitó recuperar su contraseña y recibió el enlace
    Cuando retiro al empleado
    Y eventualmente el empleado no puede iniciar sesión porque su cuenta está desactivada
    Entonces restablecer la contraseña con el enlace de recuperación es rechazado con el error "ACCOUNT_DEACTIVATED"
    Y una nueva solicitud de recuperación no le envía ningún enlace

  Escenario: El empleado retirado aparece en la consulta de auditoría
    Cuando retiro al empleado
    Y consulto los empleados con estado "RETIRADO"
    Entonces la respuesta debe tener código 200
    Y el empleado aparece en el resultado

  Escenario: Retirar a un empleado de vacaciones impide que su cuenta se reactive al terminarlas
    Dado que el empleado está de vacaciones con la cuenta suspendida
    Cuando retiro al empleado
    Y el período de vacaciones finaliza
    Entonces eventualmente el empleado no puede iniciar sesión porque su cuenta está desactivada
    Y el empleado sigue sin poder iniciar sesión porque su cuenta está desactivada
