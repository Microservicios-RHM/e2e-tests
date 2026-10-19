# language: es
@seguridad
Característica: Seguridad y control de acceso
  Como sistema de autenticación
  Quiero controlar el acceso a los recursos
  Para garantizar que solo los usuarios autorizados realicen operaciones

  Antecedentes:
    Dado que el sistema está desplegado y operativo
    Y que existe un departamento "IT" con nombre "Tecnología"

  Escenario: Acceso denegado sin token de autenticación
    Cuando consulto la lista de empleados sin token de autenticación
    Entonces la respuesta debe tener código 401
    Y el código de error debe ser "UNAUTHORIZED"

  Esquema del escenario: Acceso denegado con un token <tipo>
    Cuando consulto la lista de empleados con un token <tipo>
    Entonces la respuesta debe tener código 401
    Y el código de error debe ser "UNAUTHORIZED"

    Ejemplos:
      | tipo                                |
      | malformado                          |
      | firmado con una clave ajena         |
      | válido pero sin el esquema Bearer   |

  Escenario: Un token de activación de cuenta no sirve como token de acceso
    Dado que registré un empleado nuevo en el departamento "IT"
    Y eventualmente el servicio de autenticación debe haber creado su cuenta con un enlace de activación
    Cuando consulto la lista de empleados usando el token de activación como token de acceso
    Entonces la respuesta debe tener código 401

  Escenario: Un usuario con rol USER puede consultar pero no modificar
    Dado que estoy autenticado como "USER"
    Cuando consulto la lista de empleados
    Entonces la respuesta debe tener código 200
    Cuando intento registrar un empleado nuevo en el departamento "IT"
    Entonces la respuesta debe tener código 403
    Y el código de error debe ser "FORBIDDEN"
    Cuando intento retirar al empleado
    Entonces la respuesta debe tener código 403
    Y el empleado sigue en estado "ACTIVO"

  Escenario: Un usuario con rol ADMIN puede realizar todas las operaciones
    Dado que estoy autenticado como "ADMIN"
    Cuando registro un empleado nuevo en el departamento "IT"
    Entonces la respuesta debe tener código 201
    Cuando consulto la lista de empleados
    Entonces la respuesta debe tener código 200
    Cuando retiro al empleado
    Entonces la respuesta debe tener código 200
    Y el empleado sigue en estado "RETIRADO"
