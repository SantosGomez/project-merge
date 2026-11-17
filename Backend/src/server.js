require('dotenv').config();
const { crearApp } = require('./app');
const { seedDatabase } = require('./utils/seed');

const PUERTO = parseInt(process.env.PORT || '3000', 10);

/**
 * Inicializa el servidor: ejecuta el seed de datos maestros y arranca Express.
 * Solo inicialización y escucha (Constitución: Estándar de Arquitectura del Backend).
 * RF-27: seed de datos maestros al iniciar el servidor.
 */
async function iniciar() {
  // Ejecutar seed de datos maestros al arrancar (crea tablas y cuentas iniciales si faltan)
  await seedDatabase();

  const app = crearApp();
  app.listen(PUERTO, () => {
    // eslint-disable-next-line no-console
    console.log(`Servidor DelGrow Estado Contadores escuchando en el puerto ${PUERTO}`);
  });
}

iniciar().catch((err) => {
  require('./utils/bitacoraSeguridad').registrarError(err);
  process.exit(1);
});
