// Configuración de Cucumber.js. `npm test` la toma por defecto.
//
// Formatos de salida (contrato con el pipeline del Reto 7):
//   reports/junit.xml      → resultados máquina-legibles (Jenkins `junit`)
//   reports/cucumber.json  → reporte estructurado (plugin Cucumber Reports)
//   reports/cucumber.html  → reporte navegable para humanos (HTML Publisher)
// La consola usa el formateador "pretty", que imprime cada paso en Gherkin.
export default {
  paths: ['features/**/*.feature'],
  import: ['support/**/*.ts', 'step_definitions/**/*.ts'],
  format: [
    'pretty',
    'html:reports/cucumber.html',
    'json:reports/cucumber.json',
    'junit:reports/junit.xml',
  ],
  formatOptions: {
    junit: { suiteName: 'e2e-tests (BDD)' },
  },
  // Los escenarios son independientes entre sí; aun así se ejecutan en serie para que la carga
  // sobre el broker sea predecible y los tiempos de polling se mantengan estables.
  parallel: 0,
  strict: true,
};
