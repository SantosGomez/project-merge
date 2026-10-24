const { esCorreoValido, validarCampoTexto, validateRol } = require('../utils/validationUtils');
const { hashPassword } = require('../utils/passwordUtils');
const UserModel = require('../models/UserModel');
const SessionModel = require('../models/SessionModel');
const { buildError } = require('../utils/errorUtils');

/** Máximo de caracteres del nombre y del correo (columnas VARCHAR(150)). */
const MAX_NOMBRE_Y_CORREO = 150;

/**
 * Alta de cuenta protegida (solo administrador o usuarios_de_sistema), con nombre y correo.
 * RF-28, RF-29, RF-30.
 * @param {Object} req - Petición Express con cuerpo { nombre, correo, password, rol }.
 * @param {Object} res - Respuesta Express.
 */
async function createUser(req, res) {
  const { nombre, correo, password, rol } = req.body;

  // 1. RF-37: se indica cada dato enviado con un tipo distinto de texto
  const campos = [
    validarCampoTexto(nombre, 'nombre'),
    validarCampoTexto(correo, 'correo'),
    validarCampoTexto(password, 'contraseña'),
  ];
  const tipoInvalido = campos.filter((campo) => campo.estado === 'tipo_invalido').map((campo) => campo.campo);
  if (tipoInvalido.length > 0) {
    return res.status(400).json(buildError('Dato inválido', tipoInvalido.join(' y '), 'debe enviarse como texto'));
  }

  // 2. Nombre y correo obligatorios, con su máximo; el correo se guarda recortado y en minúsculas
  const nombreLimpio = (nombre ?? '').trim();
  const correoLimpio = (correo ?? '').trim().toLowerCase();
  if (!nombreLimpio) {
    return res.status(400).json(buildError('Falta el nombre', 'nombre', 'Escriba el nombre de la persona'));
  }
  if (!correoLimpio) {
    return res.status(400).json(buildError('Falta el correo', 'correo', 'Escriba el correo de la cuenta'));
  }
  if (nombreLimpio.length > MAX_NOMBRE_Y_CORREO) {
    return res.status(400).json(
      buildError('El nombre supera el máximo de caracteres', 'nombre', 'El nombre debe tener máximo 150 caracteres')
    );
  }
  if (correoLimpio.length > MAX_NOMBRE_Y_CORREO) {
    return res.status(400).json(
      buildError('El correo supera el máximo de caracteres', 'correo', 'El correo debe tener máximo 150 caracteres')
    );
  }
  if (!esCorreoValido(correoLimpio)) {
    return res.status(400).json(
      buildError('Correo no válido', 'correo', 'Escriba un correo como nombre@delgrow.mx')
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

  // 3. Verificar que no exista otra cuenta con ese correo, sin distinguir mayúsculas (RF-30, RF-45)
  if (await UserModel.findByCorreo(correoLimpio)) {
    return res.status(400).json(
      buildError('El correo ya existe', 'correo', 'Use otro correo o restablezca la contraseña de esa cuenta')
    );
  }

  // 4. Hashear contraseña con Argon2id (RNF-1) y crear la cuenta (RF-28)
  const passwordHash = await hashPassword(password);
  await UserModel.createConCorreo({ nombre: nombreLimpio, correo: correoLimpio, passwordHash, rol });

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
