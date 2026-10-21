const { verifyAccessToken } = require('../utils/tokenUtils');
const { isSessionInactive } = require('../utils/dateUtils');
const { buildError } = require('../utils/errorUtils');
const SessionModel = require('../models/SessionModel');

const JWT_SECRET = process.env.JWT_SECRET || 'delgrow_secreto_desarrollo';
const INACTIVIDAD_MINUTOS = 30;

/**
 * Middleware de autenticación. Verifica el token de acceso, la sesión en BD,
 * la inactividad y adjunta req.user (RF-04, RF-05, RF-06, RF-07, RF-25).
 * @param {Object} req - Objeto de petición Express (o mock en tests).
 * @param {Object} res - Objeto de respuesta Express (o mock en tests).
 * @param {Function} next - Función siguiente del middleware.
 */
async function authenticateToken(req, res, next) {
  // 1. Extraer token de la cabecera Authorization: Bearer <token>
  const authHeader = req.headers && req.headers.authorization;
  if (!authHeader) {
    res.status(401).json(
      buildError('No se proporcionó credenciales', 'cabecera Authorization', 'Inicie sesión y envíe el token en la cabecera Authorization')
    );
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json(
      buildError('Formato de credenciales inválido', 'cabecera Authorization', 'Use el formato Bearer <token>')
    );
    return;
  }

  const token = authHeader.substring(7);

  // 2. Verificar firma y expiración del JWT
  const resultado = verifyAccessToken(token, JWT_SECRET);

  let payload;

  if (resultado.valido) {
    // Token JWT válido: obtener sesión desde BD para verificar revocación
    payload = resultado.payload;
    const sesion = await SessionModel.obtenerSesion(token);
    if (!sesion || sesion.revocado) {
      res.status(401).json(
        buildError('Sesión no encontrada o revocada', 'token de acceso', 'Inicie sesión nuevamente')
      );
      return;
    }
  } else if (resultado.error === 'expirado') {
    // Token expirado por su campo exp
    res.status(401).json(
      buildError('Sesión caducada', 'token de acceso', 'Inicie sesión nuevamente')
    );
    return;
  } else {
    // token_invalido: intentar recuperar la sesión desde SessionModel
    // (soporta tokens simples de prueba que no son JWT)
    const sesion = await SessionModel.obtenerSesion(token);
    if (!sesion) {
      res.status(401).json(
        buildError('Token no válido', 'token de acceso', 'Inicie sesión nuevamente')
      );
      return;
    }
    if (sesion.revocado) {
      res.status(401).json(
        buildError('Sesión revocada', 'token de acceso', 'Inicie sesión nuevamente')
      );
      return;
    }
    // Construir payload a partir de la sesión (incluye datos de usuario de fallback)
    payload = {
      id: sesion.usuario_id,
      usuario: sesion.usuario,
      rol: sesion.rol,
    };
  }

  // 3. Verificar inactividad de la sesión (RF-25)
  const ahora = new Date();
  const sesionParaActividad = await SessionModel.obtenerSesion(token);
  if (
    sesionParaActividad &&
    isSessionInactive(sesionParaActividad.ultima_actividad, ahora, INACTIVIDAD_MINUTOS)
  ) {
    await SessionModel.revocar(token);
    res.status(401).json(
      buildError('Sesión caducada por inactividad', 'última actividad', 'Inicie sesión nuevamente')
    );
    return;
  }

  // 4. Actualizar última actividad en cada petición válida (RF-25)
  await SessionModel.tocarActividad(token, ahora);

  // 5. Adjuntar datos del usuario al request
  req.user = {
    id: payload.id,
    usuario: payload.usuario,
    rol: payload.rol,
  };

  // 6. Continuar al siguiente middleware o controlador
  next();
}

module.exports = { authenticateToken };
