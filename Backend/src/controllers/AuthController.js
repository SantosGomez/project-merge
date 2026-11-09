const jwt = require('jsonwebtoken');
const { validateLoginInput, validarCampoTexto } = require('../utils/validationUtils');
const { generateAccessToken } = require('../utils/tokenUtils');
const UserModel = require('../models/UserModel');
const SessionModel = require('../models/SessionModel');
const { buildError } = require('../utils/errorUtils');
const { hashPassword, verifyPassword, verificarContraHashFicticio } = require('../utils/passwordUtils');
const { nowLocal } = require('../utils/dateUtils');
const { eventos } = require('../utils/eventos');
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

  // 2. Buscar la cuenta por correo y verificar contraseña (RF-03, mensaje genérico).
  //    Sin cuenta se verifica contra un hash ficticio: el tiempo no revela qué correos existen.
  const cuenta = await UserModel.findByCorreo(correo);
  const contrasenaValida = cuenta
    ? await verifyPassword(password, cuenta.password_hash)
    : await verificarContraHashFicticio(password);
  if (!cuenta || !contrasenaValida) {
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

  // 6. Responder 200 con token, rol, id, nombre y correo (RF-01, RF-06), si debe crear su contraseña
  //    y si la sesión es persistente (el frontend decide dónde guardarla)
  return res.status(200).json({
    token,
    rol: cuenta.rol,
    id: cuenta.id,
    nombre: cuenta.nombre,
    correo: cuenta.correo,
    debe_cambiar_contrasena: Boolean(cuenta.debe_cambiar_contrasena),
    sesion_persistente: persistente,
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

  // 1. La nueva sigue la misma regla que el alta: texto de al menos 8 caracteres (RF-37, RF-44)
  const { password } = req.body;
  const campo = validarCampoTexto(password, 'contraseña');
  if (campo.estado === 'tipo_invalido') {
    return res.status(400).json(
      buildError('Contraseña inválida', 'contraseña', 'La contraseña debe enviarse como texto')
    );
  }
  if (campo.estado !== 'valido' || password.length < 8) {
    return res.status(400).json(
      buildError('Contraseña inválida', 'contraseña', 'La contraseña debe tener al menos 8 caracteres')
    );
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
  return res.status(200).json({ mensaje: 'Contraseña actualizada correctamente' });
}

/**
 * Cierre de sesión: revoca el token de forma persistente en la base de datos.
 * RF-26, RF-31.
 * @param {Object} req - Petición Express con cabecera Authorization: Bearer <token>.
 * @param {Object} res - Respuesta Express.
 */
async function logout(req, res) {
  // 1. Extraer token de Authorization: Bearer <token>
  const authHeader = req.headers && req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Revocar la sesión por su jti (RF-26, RF-31, RF-41); si no se pudo revocar,
  //    no se confirma el cierre (RF-39). El token ya fue validado por authenticateToken.
  if (token) {
    try {
      await SessionModel.revocar(jwt.decode(token).jti);
      // La conexión de tiempo real de esta sesión también se cierra
      eventos.cerrarSesion(jwt.decode(token).jti);
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

  // 3. Responder 200 (RF-26, RF-31)
  return res.status(200).json({ mensaje: 'Sesión cerrada correctamente' });
}

module.exports = { login, logout, cambiarContrasena };
