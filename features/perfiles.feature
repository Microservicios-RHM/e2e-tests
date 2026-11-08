# language: es
@perfiles
Característica: Gestión segura de perfiles
  Como empleado autenticado
  Quiero actualizar únicamente mi propio perfil
  Para mantener mis datos de contacto sin obtener permisos administrativos

  Antecedentes:
    Dado que existe un empleado activo con credenciales establecidas
    Y que estoy autenticado como "USER"

  Escenario: Un empleado actualiza su propio perfil
    Cuando actualizo mi perfil con teléfono "3001234567" y ciudad "Armenia"
    Entonces la respuesta debe tener código 200
    Y mi perfil conserva el teléfono "3001234567" y la ciudad "Armenia"

  Escenario: Un empleado no puede actualizar el perfil de otra persona
    Dado que existe otro empleado con perfil disponible
    Cuando intento actualizar el perfil del otro empleado
    Entonces la respuesta debe tener código 403
    Y el código de error debe ser "FORBIDDEN"
