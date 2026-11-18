const jwt = require('jsonwebtoken');
const { validateLoginInput, validarPasswordNueva } = require('../utils/validationUtils');
const { generateAccessToken, verifyAccessToken } = require('../utils/tokenUtils');
const {
  NOMBRE_COOKIE_SESION,
  leerCookie,
  construirCookieSesion,
  construirCookieBorrada,
  esPeticionSegura,
} = require('../utils/cookieSesion');
const UserModel = require('../models/UserModel');
const SessionModel = require('../models/SessionModel');
const { buildError } = require('../utils/errorUtils');
const { hashPassword, verifyPassword, verificarContraHashFicticio } = require('../utils/passwordUtils');
const { nowLocal, formatLocalDate } = require('../utils/dateUtils');
const { eventos } = require('../utils/eventos');
const bitacora = require('../utils/bitacoraSeguridad');
const { usuarioTieneActividades } = require('../config/modulos');
const { JWT_SECRET, JWT_EXPIRES_IN, JWT_EXPIRES_IN_PERSISTENTE } = require('../config/jwt');

/**
 * Inicio de sesión con correo: valida credenciales, genera token JWT, registra sesión,
 * guarda el último acceso y devuelve token, rol, id, nombre, correo y si la sesión es persistente.
 * Con `mantener_sesion: true` la sesión aguanta 7 días sin uso y el token dura 30 días.
 * RF-01, RF-02, RF-03, RF-06.
 * @param {Object} req - Petición Express con cuerpo { correo, password, mantener_sesion? }.
 * @param {Object} res - Respuesta Express.
 */
async function login(req, res) {
  const { correo, password, mantener_sesion: mantenerSesion } = req.body;

  // «Mantener sesión iniciada» es opcional, pero si viene debe ser un booleano real
  if (mantenerSesion !== undefined && typeof mantenerSesion !== 'boolean') {
    return res.status(400).json(buildError('Dato inválido', 'mantener sesión', 'Envía mantener_sesion como true o false'));
  }
  const persistente = mantenerSesion === true;

  // 1. Validar credenciales (RF-02, RF-37)
  const validacion = validateLoginInput(correo, password, 'correo');
  if (validacion.tipoInvalido.length > 0) {
    return res.status(400).json(
      buildError('Dato inválido', validacion.tipoInvalido.join(' y '), 'debe enviarse como texto')
    );
  }
  if (!validacion.valido) {
    return res.status(400).json(
      buildError('Faltan credenciales', 'correo y/o contraseña', 'Escribe tu correo y tu contraseña')
    );
  }

  // Textos más largos que cualquier cuenta real no llegan a la base ni a Argon2id
  if (correo.trim().length > 150 || password.length > 128) {
    return res.status(401).json(
      buildError('Credenciales no válidas', 'correo o contraseña', 'Revisa tus datos y vuelve a intentarlo')
    );
  }

  // 2. Buscar la cuenta por correo y verificar contraseña (RF-03, mensaje genérico).
  //    Sin cuenta se verifica contra un hash ficticio: el tiempo no revela qué correos existen.
  const cuenta = await UserModel.findByCorreo(correo);
  const contrasenaValida = cuenta
    ? await verifyPassword(password, cuenta.password_hash)
    : await verificarContraHashFicticio(password);
  if (!cuenta || !contrasenaValida) {
    bitacora.registrar('login_fallido', req, { correo, motivo: 'credenciales' }, 'warn');
    return res.status(401).json(
      buildError('Credenciales no válidas', 'correo o contraseña', 'Revisa tus datos y vuelve a intentarlo')
    );
  }

  // 3. Generar token JWT (RF-01)
  const token = generateAccessToken(
    { id: cuenta.id, rol: cuenta.rol },
    JWT_SECRET,
    persistente ? JWT_EXPIRES_IN_PERSISTENTE : JWT_EXPIRES_IN
  );

  // 4. Registrar la sesión con el jti propio del token (RF-01, RF-41);
  //    sin sesión registrada no se entrega token (RF-38)
  const ahora = nowLocal();
  try {
    await SessionModel.registrarSesion(jwt.decode(token).jti, cuenta.id, ahora, persistente);
  } catch (err) {
    return res.status(503).json(
      buildError('No se pudo registrar la sesión', 'inicio de sesión', 'Vuelve a intentarlo en unos momentos')
    );
  }

  // 5. Guardar el último acceso; es informativo, así que un fallo no impide entrar.
  try {
    await UserModel.registrarUltimoAcceso(cuenta.id, ahora);
  } catch (err) {
    // La sesión ya quedó registrada: se responde igual.
  }

  bitacora.registrar('login_exitoso', { ip: req.ip, user: { id: cuenta.id, rol: cuenta.rol } }, { persistente });

  // 6. Si la petición traía una sesión previa en la cookie, se revoca (RF-10): iniciar sesión
  //    con otra cuenta en el mismo navegador no deja la anterior viva. Es de mejor esfuerzo.
  const tokenPrevio = leerCookie(req.headers && req.headers.cookie, NOMBRE_COOKIE_SESION);
  const previo = tokenPrevio ? verifyAccessToken(tokenPrevio, JWT_SECRET) : null;
  if (previo && previo.valido) {
    try {
      await SessionModel.revocar(previo.payload.jti);
      eventos.cerrarSesion(previo.payload.jti);
    } catch (err) {
      // La nueva sesión ya quedó registrada: se responde igual.
    }
  }

  // 7. Entregar el token en una cookie HttpOnly (S8): el JavaScript de la página no puede leerla.
  //    El cuerpo conserva `token` por compatibilidad con pruebas y herramientas; el frontend lo ignora.
  res.setHeader('Set-Cookie', construirCookieSesion(token, { persistente, seguro: esPeticionSegura(req) }));

  // 8. Responder 200 con token, rol, id, nombre y correo (RF-01, RF-06), si debe crear su contraseña
  //    y si la sesión es persistente
  return res.status(200).json({
    token,
    rol: cuenta.rol,
    id: cuenta.id,
    nombre: cuenta.nombre,
    correo: cuenta.correo,
    debe_cambiar_contrasena: Boolean(cuenta.debe_cambiar_contrasena),
    sesion_persistente: persistente,
    // El frontend muestra «Mis actividades» solo si el módulo está habilitado para esta cuenta
    actividades_habilitadas: usuarioTieneActividades(cuenta.id),
  });
}

/**
 * La persona reemplaza la contraseña que le asignó el administrador por una propia.
 * Solo funciona mientras la cuenta tiene el cambio pendiente: así una sesión abierta
 * no puede cambiar la contraseña en cualquier momento sin pedir la actual.
 * @param {Object} req - Petición Express con cuerpo { password }.
 * @param {Object} res - Respuesta Express.
 */
async function cambiarContrasena(req, res) {
  if (!req.debeCambiarContrasena) {
    return res.status(403).json(
      buildError('No hay un cambio de contraseña pendiente', 'contraseña', 'Pide al administrador que la restablezca')
    );
  }

  // 1. La nueva sigue la misma regla que el alta: al menos 12 caracteres y no común (RF-37, RF-44)
  const { password } = req.body;
  const politica = validarPasswordNueva(password);
  if (!politica.valida) {
    return res.status(400).json(politica.error);
  }

  // 2. Debe ser distinta a la que asignó el administrador
  const cuenta = await UserModel.findById(req.user.id);
  if (await verifyPassword(password, cuenta.password_hash)) {
    return res.status(400).json(
      buildError(
        'La contraseña nueva es igual a la asignada',
        'contraseña',
        'Escribe una contraseña distinta a la que te dio el administrador'
      )
    );
  }

  // 3. Guardar con Argon2id y quitar la marca; la sesión actual sigue abierta (RNF-1)
  await UserModel.updatePassword(cuenta.id, await hashPassword(password), false);
  bitacora.registrar('password_cambiada_asignada', req);
  return res.status(200).json({ mensaje: 'Contraseña actualizada correctamente' });
}

/**
 * La persona cambia su contraseña por voluntad propia escribiendo la actual.
 * La sesión actual sigue abierta; las demás sesiones se revocan.
 * @param {Object} req - Petición Express con cuerpo { password_actual, password }.
 * @param {Object} res - Respuesta Express.
 */
async function cambiarMiContrasena(req, res) {
  const { password_actual: actual, password } = req.body;

  // 1. La actual es obligatoria y debe ser texto
  if (typeof actual !== 'string' || actual === '') {
    return res.status(400).json(
      buildError('Falta la contraseña actual', 'contraseña actual', 'Escribe tu contraseña actual')
    );
  }

  // 2. La nueva sigue la misma regla que el alta: al menos 12 caracteres y no común
  const politica = validarPasswordNueva(password);
  if (!politica.valida) {
    return res.status(400).json(politica.error);
  }

  // 3. La actual debe ser la guardada
  const cuenta = await UserModel.findById(req.user.id);
  if (!cuenta || !(await verifyPassword(actual, cuenta.password_hash))) {
    return res.status(400).json(
      buildError('La contraseña actual no es correcta', 'contraseña actual', 'Revisa que la escribiste igual e inténtalo de nuevo')
    );
  }

  // 4. Debe ser distinta a la actual
  if (password === actual) {
    return res.status(400).json(
      buildError('La contraseña nueva es igual a la actual', 'contraseña', 'Escribe una contraseña distinta a la actual')
    );
  }

  // 5. Guardar con Argon2id; la sesión actual sigue abierta y las demás se revocan (también su tiempo real)
  await UserModel.updatePassword(cuenta.id, await hashPassword(password), false);
  await SessionModel.revocarSesionesDeUsuario(cuenta.id, req.jti);
  eventos.cerrarSesionesDeUsuario(cuenta.id, req.jti);
  bitacora.registrar('password_cambiada_propia', req);
  return res.status(200).json({ mensaje: 'Contraseña actualizada correctamente' });
}

/**
 * Cierre de sesión: revoca el token de forma persistente en la base de datos y borra la cookie.
 * RF-26, RF-31.
 * @param {Object} req - Petición Express ya autenticada (Bearer o cookie; req.jti).
 * @param {Object} res - Respuesta Express.
 */
async function logout(req, res) {
  // 1. La sesión a cerrar es la que identificó el middleware (Bearer o cookie), por su jti
  const jti = req.jti;

  // 2. Revocar la sesión (RF-26, RF-31, RF-41); si no se pudo revocar,
  //    no se confirma el cierre (RF-39). El token ya fue validado por el middleware.
  if (jti) {
    try {
      await SessionModel.revocar(jti);
      // La conexión de tiempo real de esta sesión también se cierra
      eventos.cerrarSesion(jti);
    } catch (err) {
      return res.status(503).json(
        buildError(
          'No se pudo cerrar la sesión',
          'cierre de sesión',
          'La sesión sigue abierta; vuelve a intentarlo en unos momentos'
        )
      );
    }
  }

  bitacora.registrar('logout', req);
  // 3. Borrar la cookie de sesión del navegador (S8)
  res.setHeader('Set-Cookie', construirCookieBorrada(esPeticionSegura(req)));

  // 3. Responder 200 (RF-26, RF-31)
  return res.status(200).json({ mensaje: 'Sesión cerrada correctamente' });
}

/**
 * Datos de la cuenta de la sesión para la vista «Mi perfil». Nunca incluye el hash
 * de la contraseña ni datos de otra cuenta; las fechas salen en hora local.
 * @param {Object} req - Petición Express ya autenticada (req.user.id).
 * @param {Object} res - Respuesta Express.
 */
async function obtenerPerfil(req, res) {
  const cuenta = await UserModel.findById(req.user.id);
  if (!cuenta) {
    return res.status(404).json(
      buildError('Cuenta no encontrada', 'perfil', 'Vuelve a iniciar sesión')
    );
  }
  return res.status(200).json({
    id: cuenta.id,
    nombre: cuenta.nombre,
    correo: cuenta.correo,
    rol: cuenta.rol,
    actividades_habilitadas: usuarioTieneActividades(cuenta.id),
    creado_en: cuenta.creado_en ? formatLocalDate(cuenta.creado_en) : null,
    ultimo_acceso_en: cuenta.ultimo_acceso_en ? formatLocalDate(cuenta.ultimo_acceso_en) : null,
  });
}

module.exports = { login, logout, cambiarContrasena, cambiarMiContrasena, obtenerPerfil };
