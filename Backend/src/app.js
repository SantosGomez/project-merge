const express = require('express');
const cors = require('cors');
const { parseAllowedOrigins } = require('./utils/originUtils');
const { createOriginGuard, buildCorsOptions } = require('./middlewares/originMiddleware');
const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const counterRoutes = require('./routes/counterRoutes');
const userRoutes = require('./routes/userRoutes');

/**
 * Crea y configura la aplicación Express.
 * Solo configuración, middlewares globales, CORS y montaje de rutas.
 * No contiene lógica de negocio (Constitución: Estándar de Arquitectura del Backend).
 * RF-34: el backend solo acepta peticiones de los orígenes locales de desarrollo
 * del frontend web, y acepta las peticiones que no declaran origen (RF-04 sigue aplicando).
 * @param {{ origenesPermitidos?: string[] }} [opciones] - orígenes permitidos; si no se
 * pasan, se leen de la variable de entorno CORS_ORIGENES (con los de desarrollo por defecto).
 * @returns {import('express').Express} La aplicación Express configurada.
 */
function crearApp(opciones) {
  const app = express();
  const opcionesApp = opciones || {};
  const origenesPermitidos = opcionesApp.origenesPermitidos ?? parseAllowedOrigins(process.env.CORS_ORIGENES);

  // 1.º Rechaza las peticiones de orígenes no permitidos (RF-34)
  app.use(createOriginGuard(origenesPermitidos));

  // 2.º Añade las cabeceras CORS solo a los orígenes permitidos (RF-34)
  app.use(cors(buildCorsOptions(origenesPermitidos)));

  // Parsear cuerpos JSON de las peticiones entrantes
  app.use(express.json());

  // Montaje de rutas de la API
  app.use('/auth', authRoutes);
  app.use('/casos', caseRoutes);
  app.use('/contadores', counterRoutes);
  app.use('/usuarios', userRoutes);

  // Middleware 404: ruta no encontrada
  app.use((req, res) => {
    res.status(404).json({
      mensaje: 'Recurso no encontrado sobre el endpoint solicitado: verifique la URL y el método HTTP',
    });
  });

  // Middleware de errores internos 500
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({
      mensaje: 'Error interno del servidor sobre la petición: intente nuevamente o contacte al administrador',
    });
  });

  return app;
}

module.exports = { crearApp };
