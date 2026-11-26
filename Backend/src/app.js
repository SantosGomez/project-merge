const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { limitarIntentosPorCuenta } = require('./middlewares/limiteCuentaMiddleware');
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
const juntaRoutes = require('./routes/juntaRoutes');
const ajustesRoutes = require('./routes/ajustesRoutes');
const documentoRoutes = require('./routes/documentoRoutes');
const { buildError } = require('./utils/errorUtils');
const bitacora = require('./utils/bitacoraSeguridad');

// Topes por IP en una ventana de un minuto: general y, más estricto, para escrituras
const LIMITES_PETICIONES = { global: 300, escritura: 60 };
const VENTANA_PETICIONES_MS = 60 * 1000;
const METODOS_DE_LECTURA = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Crea y configura la aplicación Express.
 * Solo configuración, middlewares globales, CORS y montaje de rutas.
 * No contiene lógica de negocio (Constitución: Estándar de Arquitectura del Backend).
 * RF-34: el backend solo acepta peticiones de los orígenes locales de desarrollo
 * del frontend web, y acepta las peticiones que no declaran origen (RF-04 sigue aplicando).
 * @param {{ origenesPermitidos?: string[], limitarLogin?: boolean, limitarPeticiones?: boolean,
 * limitesPeticiones?: { global?: number, escritura?: number } }} [opciones] - orígenes
 * permitidos (si no se pasan, se leen de CORS_ORIGENES), si se limita el inicio de sesión
 * (por defecto sí; las pruebas lo apagan porque inician sesión muchas veces) y si se limitan
 * las peticiones por IP (por defecto sí; `limitesPeticiones` cambia los topes por minuto).
 * @returns {import('express').Express} La aplicación Express configurada.
 */
function crearApp(opciones) {
  const app = express();
  const opcionesApp = opciones || {};
  const origenesPermitidos = opcionesApp.origenesPermitidos ?? parseAllowedOrigins(process.env.CORS_ORIGENES);
  const limitarLogin = opcionesApp.limitarLogin ?? true;
  const limitarPeticiones = opcionesApp.limitarPeticiones ?? true;
  const limitesPeticiones = { ...LIMITES_PETICIONES, ...(opcionesApp.limitesPeticiones || {}) };

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

  // Bitácora: registra cada 403 (rol o propiedad) al terminar la respuesta
  app.use(bitacora.vigilarAccesoDenegado());

  // Límite de peticiones por IP: uno general y otro más estricto para escrituras (POST/PUT/PATCH/DELETE)
  if (limitarPeticiones) {
    const comunes = { windowMs: VENTANA_PETICIONES_MS, standardHeaders: 'draft-7', legacyHeaders: false };
    app.use(
      rateLimit({
        ...comunes,
        limit: limitesPeticiones.global,
        handler: bitacora.manejadorLimite('rate_limit_global'),
        message: buildError('Demasiadas peticiones', 'tu conexión', 'Espera un minuto antes de volver a intentarlo'),
      })
    );
    app.use(
      rateLimit({
        ...comunes,
        limit: limitesPeticiones.escritura,
        skip: (req) => METODOS_DE_LECTURA.includes(req.method),
        handler: bitacora.manejadorLimite('rate_limit_global', { motivo: 'escritura' }),
        message: buildError('Demasiadas escrituras', 'tu conexión', 'Espera un minuto antes de volver a guardar cambios'),
      })
    );
  }

  // Módulo de documentos: va antes del parser de 100 kb porque lleva su propio parser (firmas de
  // hasta 2 MiB) y recibe archivos en crudo.
  app.use('/doc', documentoRoutes);

  // Parsear cuerpos JSON de las peticiones entrantes (tope explícito de 100 kb)
  app.use(express.json({ limit: '100kb' }));

  // Máximo 10 intentos fallidos de inicio de sesión por IP cada 15 minutos (los exitosos no cuentan)
  if (limitarLogin) {
    app.use(
      '/auth/login',
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        skipSuccessfulRequests: true,
        handler: bitacora.manejadorLimite('login_bloqueado', { motivo: 'ip' }),
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: buildError(
          'Demasiados intentos fallidos',
          'inicio de sesión',
          'Espera 15 minutos antes de volver a intentarlo'
        ),
      })
    );
    // Además, máximo 5 intentos fallidos por correo cada 15 minutos (exista o no la cuenta)
    app.use('/auth/login', limitarIntentosPorCuenta());
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
  app.use('/juntas', juntaRoutes);
  app.use('/ajustes', ajustesRoutes);

  // Middleware 404: ruta no encontrada
  app.use((req, res) => {
    res.status(404).json({
      mensaje: 'Recurso no encontrado sobre el endpoint solicitado: revisa la dirección e inténtalo de nuevo',
    });
  });

  // Middleware global de errores: entrada inválida → 400, fallo interno → 503 (RF-37, RF-47, RNF-8)
  app.use((err, req, res, next) => {
    bitacora.registrarError(err, req);
    // Cuerpo mayor al límite de express.json()
    if (err.type === 'entity.too.large') {
      return res.status(413).json(
        buildError('Cuerpo de la petición demasiado grande', 'cuerpo JSON', 'Envía un cuerpo de máximo 100 kb')
      );
    }
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
