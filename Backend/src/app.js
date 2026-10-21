const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const counterRoutes = require('./routes/counterRoutes');
const userRoutes = require('./routes/userRoutes');

/**
 * Crea y configura la aplicación Express.
 * Solo configuración, middlewares globales, CORS y montaje de rutas.
 * No contiene lógica de negocio (Constitución: Estándar de Arquitectura del Backend).
 * RF-24: el backend declara y aplica CORS.
 * @returns {import('express').Express} La aplicación Express configurada.
 */
function crearApp() {
  const app = express();

  // CORS habilitado para permitir peticiones del frontend (RF-24)
  app.use(cors());

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
