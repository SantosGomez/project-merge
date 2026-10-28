const { verifyAccessToken } = require('../utils/tokenUtils');
const { isSessionInactive } = require('../utils/dateUtils');
const { buildError } = require('../utils/errorUtils');
const SessionModel = require('../models/SessionModel');
const { JWT_SECRET } = require('../config/jwt');

const INACTIVIDAD_MINUTOS = 30;
// «Mantener sesión iniciada»: la sesión se cierra tras 7 días sin uso
const INACTIVIDAD_PERSISTENTE_MINUTOS = 7 * 24 * 60;

/**
 * Indica si una sesión pasó su límite sin actividad (30 min, o 7 días si es persistente).
 * @param {Object} sesion - fila de `sesiones` (ultima_actividad, persistente).
 * @param {Date} ahora - momento de la comprobación.
 * @returns {boolean}
 */
function sesionInactiva(sesion, ahora) {
  const limiteMinutos = sesion.persistente ? INACTIVIDAD_PERSISTENTE_MINUTOS : INACTIVIDAD_MINUTOS;
  return isSessionInactive(sesion.ultima_actividad, ahora, limiteMinutos);
}

/**
 * Middleware de autenticación. Verifica el token de acceso, la sesión en BD,
 * la inactividad y adjunta req.user (RF-04, RF-05, RF-06, RF-07, RF-25).
 * @param {Object} req - Objeto de petición Express (o mock en tests).
 * @param {Object} res - Objeto de respuesta Express (o mock en tests).
 * @param {Function} next - Función siguiente del middleware.
 * @param {boolean} permitirCambioPendiente - si deja pasar a una cuenta que aún debe crear su contraseña.
 */
async function autenticar(req, res, next, permitirCambioPendiente) {
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

  // 2. Verificar firma y expiración del JWT (RF-04, RF-05, criterio 30)
  const resultado = verifyAccessToken(token, JWT_SECRET);

  if (!resultado.valido) {
    if (resultado.error === 'expirado') {
      // Token expirado por su campo exp
      res.status(401).json(
        buildError('Sesión caducada', 'token de acceso', 'Inicie sesión nuevamente')
      );
      return;
    }
    // Valor fijo, inventado o mal formado: no es una credencial (criterio 30)
    res.status(401).json(
      buildError('Token no válido', 'token de acceso', 'Inicie sesión nuevamente')
    );
    return;
  }

  // 3. La sesión debe existir en la tabla `sesiones` y no estar revocada
  //    (RF-04, RF-07): solo el inicio de sesión registra sesiones.
  //    Un fallo de la base de datos no es «sesión caducada» ni invalida la sesión (RF-40, RNF-4).
  //    La sesión se identifica por el jti propio del token (RF-41).
  const { jti } = resultado.payload;
  let sesion;
  try {
    sesion = await SessionModel.obtenerSesion(jti);
  } catch (err) {
    res.status(503).json(
      buildError('Fallo interno al consultar la sesión', 'token de acceso', 'Inténtelo nuevamente en unos momentos')
    );
    return;
  }
  if (!sesion || sesion.revocado) {
    res.status(401).json(
      buildError('Sesión caducada', 'token de acceso', 'Inicie sesión nuevamente')
    );
    return;
  }

  // 4. Verificar inactividad de la sesión (RF-25); la persistente tiene un límite mayor
  const ahora = new Date();
  if (sesionInactiva(sesion, ahora)) {
    try {
      await SessionModel.revocar(jti);
    } catch (err) {
      res.status(503).json(
        buildError('Fallo interno al cerrar la sesión inactiva', 'token de acceso', 'Inténtelo nuevamente en unos momentos')
      );
      return;
    }
    res.status(401).json(
      buildError('Sesión caducada por inactividad', 'última actividad', 'Inicie sesión nuevamente')
    );
    return;
  }

  // 5. Actualizar última actividad en cada petición válida (RF-25); un fallo no invalida la sesión (RF-40)
  try {
    await SessionModel.tocarActividad(jti, ahora);
  } catch (err) {
    res.status(503).json(
      buildError('Fallo interno al renovar la sesión', 'token de acceso', 'Inténtelo nuevamente en unos momentos')
    );
    return;
  }

  // 6. Con la contraseña que asignó el administrador solo se puede crear la propia o cerrar sesión
  if (sesion.debe_cambiar_contrasena && !permitirCambioPendiente) {
    res.status(403).json(
      buildError('Debe cambiar su contraseña', 'contraseña asignada', 'Cree su propia contraseña para continuar')
    );
    return;
  }

  // 7. Adjuntar datos del usuario al request
  req.user = {
    id: resultado.payload.id,
    rol: resultado.payload.rol,
  };
  // jti de la sesión, disponible para el cierre de sesión (RF-41)
  req.jti = jti;
  req.debeCambiarContrasena = Boolean(sesion.debe_cambiar_contrasena);

  // 8. Continuar al siguiente middleware o controlador
  next();
}

/** Autenticación de todas las rutas: bloquea a quien aún debe crear su contraseña. */
async function authenticateToken(req, res, next) {
  return autenticar(req, res, next, false);
}

/** Autenticación del cierre de sesión y del cambio de contraseña: deja pasar el cambio pendiente. */
async function autenticarConCambioPendiente(req, res, next) {
  return autenticar(req, res, next, true);
}

module.exports = { authenticateToken, autenticarConCambioPendiente, sesionInactiva };
