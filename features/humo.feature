# language: es
@humo
Característica: Verificación del sistema
  Para saber si tiene sentido ejecutar el resto de la suite
  Como equipo de desarrollo
  Quiero confirmar que la plataforma está desplegada y responde

  Escenario: El sistema responde correctamente
    Dado que el sistema está desplegado y operativo
    Entonces la respuesta debe tener código 200
