const jwt = require('jsonwebtoken');
const { validateLoginInput } = require('../utils/validationUtils');
const { generateAccessToken } = require('../utils/tokenUtils');
const UserModel = require('../models/UserModel');
const SessionModel = require('../models/SessionModel');
const { buildError } = require('../utils/errorUtils');
const { verifyPassword } = require('../utils/passwordUtils');
const { nowLocal } = require('../utils/dateUtils');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');

/**
 * Inicio de sesión con correo: valida credenciales, genera token JWT, registra sesión,
 * guarda el último acceso y devuelve token, rol, id, nombre y correo.
 * RF-01, RF-02, RF-03, RF-06.
 * @param {Object} req - Petición Express con cuerpo { correo, password }.
 * @param {Object} res - Respuesta Express.
 */
async function login(req, res) {
  const { correo, password } = req.body;

  // 1. Validar credenciales (RF-02, RF-37)
  const validacion = validateLoginInput(correo, password, 'correo');
  if (validacion.tipoInvalido.length > 0) {
    return res.status(400).json(
      buildError('Dato inválido', validacion.tipoInvalido.join(' y '), 'debe enviarse como texto')
    );
  }
  if (!validacion.valido) {
    return res.status(400).json(
      buildError('Faltan credenciales', 'correo y/o contraseña', 'Ingrese correo y contraseña')
    );
  }

  // 2. Buscar la cuenta por correo y verificar contraseña (RF-03, mensaje genérico)
  const cuenta = await UserModel.findByCorreo(correo);
  if (!cuenta || !(await verifyPassword(password, cuenta.password_hash))) {
    return res.status(401).json(
      buildError('Credenciales no válidas', 'correo o contraseña', 'Verifique sus datos e intente nuevamente')
    );
  }

  // 3. Generar token JWT (RF-01)
  const token = generateAccessToken(
    { id: cuenta.id, rol: cuenta.rol },
    JWT_SECRET,
    JWT_EXPIRES_IN
  );

  // 4. Registrar la sesión con el jti propio del token (RF-01, RF-41);
  //    sin sesión registrada no se entrega token (RF-38)
  const ahora = nowLocal();
  try {
    await SessionModel.registrarSesion(jwt.decode(token).jti, cuenta.id, ahora);
  } catch (err) {
    return res.status(503).json(
      buildError('No se pudo registrar la sesión', 'inicio de sesión', 'Inténtelo nuevamente en unos momentos')
    );
  }

  // 5. Guardar el último acceso; es informativo, así que un fallo no impide entrar.
  try {
    await UserModel.registrarUltimoAcceso(cuenta.id, ahora);
  } catch (err) {
    // La sesión ya quedó registrada: se responde igual.
  }

  // 6. Responder 200 con token, rol, id, nombre y correo (RF-01, RF-06)
  return res.status(200).json({
    token,
    rol: cuenta.rol,
    id: cuenta.id,
    nombre: cuenta.nombre,
    correo: cuenta.correo,
  });
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
    } catch (err) {
      return res.status(503).json(
        buildError(
          'No se pudo cerrar la sesión',
          'cierre de sesión',
          'La sesión sigue abierta; inténtelo nuevamente en unos momentos'
        )
      );
    }
  }

  // 3. Responder 200 (RF-26, RF-31)
  return res.status(200).json({ mensaje: 'Sesión cerrada correctamente' });
}

module.exports = { login, logout };
