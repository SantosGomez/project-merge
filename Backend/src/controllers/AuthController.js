const { validateLoginInput } = require('../utils/validationUtils');
const { generateAccessToken } = require('../utils/tokenUtils');
const UserModel = require('../models/UserModel');
const SessionModel = require('../models/SessionModel');
const { buildError } = require('../utils/errorUtils');
const { verifyPassword } = require('../utils/passwordUtils');
const { nowLocal } = require('../utils/dateUtils');

const JWT_SECRET = process.env.JWT_SECRET || 'delgrow_secret_cambiar_en_produccion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

/**
 * Inicio de sesión: valida credenciales, genera token JWT, registra sesión y devuelve token + rol + usuario.
 * RF-01, RF-02, RF-03, RF-06.
 * @param {Object} req - Petición Express con cuerpo { usuario, password }.
 * @param {Object} res - Respuesta Express.
 */
async function login(req, res) {
  const { usuario, password } = req.body;

  // 1. Validar credenciales (RF-02)
  const validacion = validateLoginInput(usuario, password);
  if (!validacion.valido) {
    return res.status(400).json(
      buildError('Faltan credenciales', 'usuario y/o contraseña', 'Ingrese usuario y contraseña')
    );
  }

  // 2. Buscar usuario y verificar contraseña (RF-03, mensaje genérico)
  const cuenta = await UserModel.findByUsername(usuario);
  if (!cuenta || !(await verifyPassword(password, cuenta.password_hash))) {
    return res.status(401).json(
      buildError('Credenciales no válidas', 'usuario o contraseña', 'Verifique sus datos e intente nuevamente')
    );
  }

  // 3. Generar token JWT (RF-01)
  const token = generateAccessToken(
    { id: cuenta.id, usuario: cuenta.usuario, rol: cuenta.rol },
    JWT_SECRET,
    JWT_EXPIRES_IN
  );

  // 4. Registrar sesión en la base de datos (RF-01)
  const ahora = nowLocal();
  await SessionModel.registrarSesion(token, cuenta.id, ahora);

  // 5. Responder 200 con token, rol y usuario (RF-01, RF-06)
  return res.status(200).json({ token, rol: cuenta.rol, usuario: cuenta.usuario });
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

  // 2. Revocar sesión (RF-26, RF-31)
  if (token) {
    await SessionModel.revocar(token);
  }

  // 3. Responder 200 (RF-26, RF-31)
  return res.status(200).json({ mensaje: 'Sesión cerrada correctamente' });
}

module.exports = { login, logout };
