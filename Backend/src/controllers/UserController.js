const { esCorreoValido, validarCampoTexto, validateRol, parseListaDeIds } = require('../utils/validationUtils');
const { hashPassword } = require('../utils/passwordUtils');
const UserModel = require('../models/UserModel');
const AuxiliarModel = require('../models/AuxiliarModel');
const { avisarNuevosVinculos, ERROR_LISTA_CONTADORES } = require('./AuxiliarController');
const SessionModel = require('../models/SessionModel');
const { buildError } = require('../utils/errorUtils');
const { formatLocalDate } = require('../utils/dateUtils');

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
    return res.status(400).json(buildError('Falta el nombre', 'nombre', 'Escribe el nombre de la persona'));
  }
  if (!correoLimpio) {
    return res.status(400).json(buildError('Falta el correo', 'correo', 'Escribe el correo de la cuenta'));
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
      buildError('Correo no válido', 'correo', 'Escribe un correo como nombre@delgrow.mx')
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
      buildError('Rol no válido', 'rol', 'Usa uno de estos: administrador, contador, auxiliar o usuario de sistema')
    );
  }

  // 3. Verificar que no exista otra cuenta con ese correo, sin distinguir mayúsculas (RF-30, RF-45)
  if (await UserModel.findByCorreo(correoLimpio)) {
    return res.status(400).json(
      buildError('El correo ya existe', 'correo', 'Usa otro correo o restablece la contraseña de esa cuenta')
    );
  }

  // Un auxiliar puede quedar vinculado con sus contadores en el mismo paso; se valida antes de crear
  const contadoresIds = rol === 'auxiliar' && req.body.contadores !== undefined ? parseListaDeIds(req.body.contadores) : [];
  if (!contadoresIds) return res.status(400).json(ERROR_LISTA_CONTADORES);
  for (const contadorId of contadoresIds) {
    if (!(await UserModel.findCounterById(contadorId))) {
      return res.status(400).json(
        buildError('La cuenta no es un contador', 'contadores', 'Elige solo cuentas con rol de contador')
      );
    }
  }

  // 4. Hashear contraseña con Argon2id (RNF-1) y crear la cuenta (RF-28);
  //    la contraseña la eligió el administrador, así que la persona creará la suya al entrar
  const passwordHash = await hashPassword(password);
  const id = await UserModel.create({ nombre: nombreLimpio, correo: correoLimpio, passwordHash, rol, debeCambiarContrasena: true });
  if (contadoresIds.length > 0) {
    await avisarNuevosVinculos(id, await AuxiliarModel.reemplazarContadoresDeAuxiliar(id, contadoresIds));
  }

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
  const { correo, password } = req.body;

  // 0. El correo es obligatorio y debe llegar como texto, con los mismos avisos que el alta (RF-37)
  const campoCorreo = validarCampoTexto(correo, 'correo');
  if (campoCorreo.estado === 'tipo_invalido') {
    return res.status(400).json(buildError('Dato inválido', 'correo', 'debe enviarse como texto'));
  }
  if (campoCorreo.estado === 'faltante') {
    return res.status(400).json(buildError('Falta el correo', 'correo', 'Escribe el correo de la cuenta'));
  }

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

  // 2. La cuenta se identifica por su correo de acceso, como en el login (RF-43, historia 9b)
  const cuenta = await UserModel.findByCorreo(correo);
  if (!cuenta) {
    return res.status(404).json(
      buildError('No se encontró una cuenta con ese correo', 'correo', 'Revisa que el correo esté bien escrito')
    );
  }

  // 3. Guardar la contraseña nueva con Argon2id e invalidar todas sus sesiones (RNF-1, RF-42);
  //    al entrar con ella, la persona deberá crear la suya
  const hash = await hashPassword(password);
  await UserModel.updatePassword(cuenta.id, hash, true);
  await SessionModel.revocarSesionesDeUsuario(cuenta.id);

  // 4. Aviso de éxito sin ningún dato de acceso (RF-33); `cuentaPropia` avisa al frontend que su sesión ya se revocó
  return res.status(200).json({
    mensaje: 'Contraseña restablecida correctamente',
    cuentaPropia: cuenta.id === req.user.id,
  });
}

/**
 * Lista las cuentas con sus datos públicos para el directorio de usuarios
 * (solo administrador o usuarios_de_sistema). Nunca incluye el hash de la contraseña.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listUsers(req, res) {
  const cuentas = await UserModel.findAllPublic();
  // El último acceso sale como texto en hora local YYYY-MM-DD HH:mm:ss; null si la cuenta nunca entró (RNF-2).
  const usuarios = cuentas.map((cuenta) => ({
    ...cuenta,
    ultimo_acceso_en: cuenta.ultimo_acceso_en ? formatLocalDate(cuenta.ultimo_acceso_en) : null,
  }));
  return res.status(200).json({ usuarios });
}

module.exports = { createUser, resetPassword, listUsers };
