const { validarCampoTexto, validateLoginInput, validateRol } = require('../utils/validationUtils');
const { hashPassword } = require('../utils/passwordUtils');
const UserModel = require('../models/UserModel');
const SessionModel = require('../models/SessionModel');
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
  if (validacion.tipoInvalido.length > 0) {
    // RF-37: se indica el dato enviado con un tipo distinto de texto
    return res.status(400).json(
      buildError('Dato inválido', validacion.tipoInvalido.join(' y '), 'debe enviarse como texto')
    );
  }
  if (!validacion.valido) {
    return res.status(400).json(
      buildError('Datos inválidos', 'usuario/contraseña', 'Corrija el dato indicado e intente nuevamente')
    );
  }

  // RF-30: el máximo se comprueba aquí para que la base de datos nunca reciba un nombre más largo
  if (usuario.length > 100) {
    return res.status(400).json(
      buildError('El usuario supera el máximo de caracteres', 'usuario', 'El usuario debe tener máximo 100 caracteres')
    );
  }

  if (!password || password.length < 8) {
    return res.status(400).json(
      buildError('Contraseña inválida', 'contraseña', 'La contraseña debe tener al menos 8 caracteres')
    );
  }

  // RF-37: un rol que no es texto se indica como tal
  if (validarCampoTexto(rol, 'rol').estado === 'tipo_invalido') {
    return res.status(400).json(buildError('Dato inválido', 'rol', 'El rol debe enviarse como texto'));
  }

  // Validar que el rol sea uno de los permitidos (RF-30)
  if (!rol || !validateRol(rol)) {
    return res.status(400).json(
      buildError('Rol no válido', 'rol', 'Use uno de los siguientes: administrador, contador o usuarios_de_sistema')
    );
  }

  // 2. Verificar que no exista un usuario con ese nombre, sin distinguir mayúsculas (RF-30, RF-45)
  const existe = await UserModel.usuarioExisteIgnoreCase(usuario);
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

/**
 * Restablece la contraseña de una cuenta existente (solo administrador o usuarios_de_sistema).
 * No exige la contraseña anterior e invalida todas las sesiones de la cuenta.
 * RF-42, RF-43, RF-44, RF-05.
 * @param {Object} req - Petición Express con params.usuario y cuerpo { password }.
 * @param {Object} res - Respuesta Express.
 */
async function resetPassword(req, res) {
  const { usuario } = req.params;
  const { password } = req.body;

  // 1. La contraseña nueva sigue la misma regla que el alta (RF-44, RF-37)
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

  // 2. La cuenta se identifica por su nombre exacto (RF-36, RF-43)
  const cuenta = await UserModel.findByUsername(usuario);
  if (!cuenta) {
    return res.status(404).json(
      buildError('No se encontró el usuario', 'usuario solicitado', 'Verifique el nombre de usuario exacto')
    );
  }

  // 3. Guardar la contraseña nueva con Argon2id e invalidar todas sus sesiones (RNF-1, RF-42)
  const hash = await hashPassword(password);
  await UserModel.updatePassword(cuenta.id, hash);
  await SessionModel.revocarSesionesDeUsuario(cuenta.id);

  // 4. Aviso de éxito sin ningún dato de acceso (RF-33)
  return res.status(200).json({ mensaje: 'Contraseña restablecida correctamente' });
}

module.exports = { createUser, resetPassword };
