const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { parseAllowedOrigins } = require('./utils/originUtils');
const { createOriginGuard, buildCorsOptions } = require('./middlewares/originMiddleware');
const authRoutes = require('./routes/authRoutes');
const caseRoutes = require('./routes/caseRoutes');
const counterRoutes = require('./routes/counterRoutes');
const userRoutes = require('./routes/userRoutes');
const notificacionRoutes = require('./routes/notificacionRoutes');
const eventosRoutes = require('./routes/eventosRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const tipoActividadRoutes = require('./routes/tipoActividadRoutes');
const actividadRoutes = require('./routes/actividadRoutes');
const tiempoRoutes = require('./routes/tiempoRoutes');
const jornadaRoutes = require('./routes/jornadaRoutes');
const informeRoutes = require('./routes/informeRoutes');
const { buildError } = require('./utils/errorUtils');

/**
 * Crea y configura la aplicación Express.
 * Solo configuración, middlewares globales, CORS y montaje de rutas.
 * No contiene lógica de negocio (Constitución: Estándar de Arquitectura del Backend).
 * RF-34: el backend solo acepta peticiones de los orígenes locales de desarrollo
 * del frontend web, y acepta las peticiones que no declaran origen (RF-04 sigue aplicando).
 * @param {{ origenesPermitidos?: string[], limitarLogin?: boolean }} [opciones] - orígenes
 * permitidos (si no se pasan, se leen de CORS_ORIGENES) y si se limita el inicio de sesión
 * (por defecto sí; las pruebas lo apagan porque inician sesión muchas veces).
 * @returns {import('express').Express} La aplicación Express configurada.
 */
function crearApp(opciones) {
  const app = express();
  const opcionesApp = opciones || {};
  const origenesPermitidos = opcionesApp.origenesPermitidos ?? parseAllowedOrigins(process.env.CORS_ORIGENES);
  const limitarLogin = opcionesApp.limitarLogin ?? true;

  // Cabeceras de seguridad; helmet también quita x-powered-by, se deja explícito
  app.disable('x-powered-by');
  app.use(helmet());

  // Detrás de Nginx: confiar en el primer proxy para que el límite de login vea la IP real
  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  // 1.º Rechaza las peticiones de orígenes no permitidos (RF-34)
  app.use(createOriginGuard(origenesPermitidos));

  // 2.º Añade las cabeceras CORS solo a los orígenes permitidos (RF-34)
  app.use(cors(buildCorsOptions(origenesPermitidos)));

  // Parsear cuerpos JSON de las peticiones entrantes
  app.use(express.json());

  // Máximo 10 intentos fallidos de inicio de sesión por IP cada 15 minutos (los exitosos no cuentan)
  if (limitarLogin) {
    app.use(
      '/auth/login',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        skipSuccessfulRequests: true,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: buildError(
          'Demasiados intentos fallidos',
          'inicio de sesión',
          'Espera 15 minutos antes de volver a intentarlo'
        ),
      })
    );
  }

  // Montaje de rutas de la API
  app.use('/auth', authRoutes);
  app.use('/casos', caseRoutes);
  app.use('/contadores', counterRoutes);
  app.use('/usuarios', userRoutes);
  app.use('/notificaciones', notificacionRoutes);
  app.use('/eventos', eventosRoutes);
  app.use('/auditorias', auditoriaRoutes);
  app.use('/clientes', clienteRoutes);
  app.use('/tipos-actividad', tipoActividadRoutes);
  app.use('/actividades', actividadRoutes);
  app.use('/tiempo', tiempoRoutes);
  app.use('/jornadas', jornadaRoutes);
  app.use('/informes', informeRoutes);

  // Middleware 404: ruta no encontrada
  app.use((req, res) => {
    res.status(404).json({
      mensaje: 'Recurso no encontrado sobre el endpoint solicitado: revisa la dirección e inténtalo de nuevo',
    });
  });

  // Middleware global de errores: entrada inválida → 400, fallo interno → 503 (RF-37, RF-47, RNF-8)
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    // express.json() marca el JSON mal formado con status 400 y type 'entity.parse.failed'
    if (err.status === 400 || err.type === 'entity.parse.failed') {
      return res.status(400).json(
        buildError('Cuerpo de la petición no válido', 'cuerpo JSON', 'Envía un cuerpo bien formado como JSON')
      );
    }
    return res.status(503).json(
      buildError('Fallo interno del servidor', 'operación solicitada', 'Vuelve a intentarlo en unos momentos')
    );
  });

  return app;
}

module.exports = { crearApp };
