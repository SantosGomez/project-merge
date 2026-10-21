const { validateLoginInput, validateRol } = require('../utils/validationUtils');
const { hashPassword } = require('../utils/passwordUtils');
const UserModel = require('../models/UserModel');
const { buildError } = require('../utils/errorUtils');

/**
 * Alta de usuario protegida (solo administrador o usuarios_de_sistema).
 * RF-28, RF-29, RF-30.
 * @param {Object} req - Petición Express con cuerpo { usuario, password, rol }.
 * @param {Object} res - Respuesta Express.
 */
async function createUser(req, res) {
  const { usuario, password, rol } = req.body;

  // 1. Validar campos con validateLoginInput y contraseña >= 8 caracteres (RF-30)
  const validacion = validateLoginInput(usuario, password);
  if (!validacion.valido) {
    return res.status(400).json(
      buildError('Datos inválidos', 'usuario/contraseña', 'Corrija el dato indicado e intente nuevamente')
    );
  }

  if (!password || password.length < 8) {
    return res.status(400).json(
      buildError('Contraseña inválida', 'contraseña', 'La contraseña debe tener al menos 8 caracteres')
    );
  }

  // Validar que el rol sea uno de los permitidos (RF-30)
  if (!rol || !validateRol(rol)) {
    return res.status(400).json(
      buildError('Rol no válido', 'rol', 'Use uno de los siguientes: administrador, contador o usuarios_de_sistema')
    );
  }

  // 2. Verificar que no exista un usuario con ese nombre (RF-30)
  const existe = await UserModel.findByUsername(usuario);
  if (existe) {
    return res.status(400).json(
      buildError('El usuario ya existe', 'usuario', 'Elija otro nombre de usuario')
    );
  }

  // 3. Hashear contraseña con Argon2id (RNF-1)
  const hash = await hashPassword(password);

  // 4. Crear usuario (RF-28)
  await UserModel.create(usuario, hash, rol);

  // 5. Responder 201 con mensaje de alta exitosa (RF-28)
  return res.status(201).json({ mensaje: 'Usuario dado de alta correctamente' });
}

module.exports = { createUser };
