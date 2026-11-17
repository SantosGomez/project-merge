const { esCorreoValido, validarCampoTexto, validarPasswordNueva, validateRol, parseListaDeIds, parseCounterId } = require('../utils/validationUtils');
const { hashPassword } = require('../utils/passwordUtils');
const UserModel = require('../models/UserModel');
const AuxiliarModel = require('../models/AuxiliarModel');
const { avisarNuevosVinculos, avisarVinculosQuitados, ERROR_LISTA_CONTADORES } = require('./AuxiliarController');
const SessionModel = require('../models/SessionModel');
const { buildError } = require('../utils/errorUtils');
const { eventos } = require('../utils/eventos');
const bitacora = require('../utils/bitacoraSeguridad');
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

  const politica = validarPasswordNueva(password);
  if (!politica.valida) {
    return res.status(400).json(politica.error);
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

  // Un auxiliar puede quedar vinculado con su contador en el mismo paso; se valida antes de crear
  const contadoresIds = rol === 'auxiliar' && req.body.contadores !== undefined ? parseListaDeIds(req.body.contadores) : [];
  if (!contadoresIds) return res.status(400).json(ERROR_LISTA_CONTADORES);
  // Un auxiliar apoya a un solo contador
  if (contadoresIds.length > 1) {
    return res.status(400).json(
      buildError('Un auxiliar solo puede apoyar a un contador', 'contadores', 'Elige un solo contador')
    );
  }
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
    const { agregados } = await AuxiliarModel.ajustarContadoresDeAuxiliar(id, { agregar: contadoresIds, quitar: [] });
    await avisarNuevosVinculos(id, agregados);
  }

  bitacora.registrar('usuario_creado', req, { usuarioNuevoId: id, rolNuevo: rol });

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
  const politica = validarPasswordNueva(password);
  if (!politica.valida) {
    return res.status(400).json(politica.error);
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
  eventos.cerrarSesionesDeUsuario(cuenta.id);
  bitacora.registrar('password_restablecida', req, { objetivoId: cuenta.id }, 'warn');

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

/** Roles que trabajan casos: solo ellos pueden conservar los casos de una cuenta. */
const ROLES_CON_CASOS = ['contador', 'auxiliar'];

/**
 * Valida nombre, correo y rol con las mismas reglas y avisos que el alta.
 * @param {{ nombre: *, correo: *, rol: * }} datos - Datos recibidos en el cuerpo.
 * @returns {{ error: Object } | { nombre: string, correo: string, rol: string }} El error a responder (400)
 *   o los datos limpios (nombre recortado, correo recortado y en minúsculas).
 */
function validarDatosDeCuenta({ nombre, correo, rol }) {
  const tipoInvalido = [validarCampoTexto(nombre, 'nombre'), validarCampoTexto(correo, 'correo')]
    .filter((campo) => campo.estado === 'tipo_invalido')
    .map((campo) => campo.campo);
  if (tipoInvalido.length > 0) {
    return { error: buildError('Dato inválido', tipoInvalido.join(' y '), 'debe enviarse como texto') };
  }

  const nombreLimpio = (nombre ?? '').trim();
  const correoLimpio = (correo ?? '').trim().toLowerCase();
  if (!nombreLimpio) return { error: buildError('Falta el nombre', 'nombre', 'Escribe el nombre de la persona') };
  if (!correoLimpio) return { error: buildError('Falta el correo', 'correo', 'Escribe el correo de la cuenta') };
  if (nombreLimpio.length > MAX_NOMBRE_Y_CORREO) {
    return {
      error: buildError('El nombre supera el máximo de caracteres', 'nombre', 'El nombre debe tener máximo 150 caracteres'),
    };
  }
  if (correoLimpio.length > MAX_NOMBRE_Y_CORREO) {
    return {
      error: buildError('El correo supera el máximo de caracteres', 'correo', 'El correo debe tener máximo 150 caracteres'),
    };
  }
  if (!esCorreoValido(correoLimpio)) {
    return { error: buildError('Correo no válido', 'correo', 'Escribe un correo como nombre@delgrow.mx') };
  }

  if (validarCampoTexto(rol, 'rol').estado === 'tipo_invalido') {
    return { error: buildError('Dato inválido', 'rol', 'El rol debe enviarse como texto') };
  }
  if (!rol || !validateRol(rol)) {
    return {
      error: buildError('Rol no válido', 'rol', 'Usa uno de estos: administrador, contador, auxiliar o usuario de sistema'),
    };
  }
  return { nombre: nombreLimpio, correo: correoLimpio, rol };
}

/**
 * Edita una cuenta existente desde el directorio (solo administrador o usuarios_de_sistema):
 * nombre, correo, rol y, si es auxiliar, el contador que apoya. Nunca cambia la contraseña
 * (para eso está el restablecimiento).
 * Reglas del rol: nadie cambia el suyo; un contador con auxiliares no deja de ser contador;
 * una cuenta con casos solo puede ser contador o auxiliar; un auxiliar que deja de serlo
 * pierde su vínculo (se avisa a los dos); y al cambiar el rol se cierran sus sesiones,
 * porque el rol viaja en el token.
 * @param {Object} req - Petición Express con params.id y cuerpo { nombre, correo, rol, contadores? }.
 * @param {Object} res - Respuesta Express.
 */
async function updateUser(req, res) {
  const noEncontrada = buildError('No se encontró la cuenta', 'cuenta', 'Actualiza el directorio y vuelve a intentarlo');
  const id = parseCounterId(req.params.id);
  if (!id) return res.status(404).json(noEncontrada);
  const cuenta = await UserModel.findById(id);
  if (!cuenta) return res.status(404).json(noEncontrada);

  const datos = validarDatosDeCuenta(req.body);
  if (datos.error) return res.status(400).json(datos.error);
  const { nombre, correo, rol } = datos;
  const cambiaRol = rol !== cuenta.rol;

  if (cambiaRol && id === req.user.id) {
    return res.status(400).json(
      buildError('No puedes cambiar tu propio rol', 'rol', 'Pide a otro usuario de sistema que lo cambie')
    );
  }

  const otraCuenta = await UserModel.findByCorreo(correo);
  if (otraCuenta && otraCuenta.id !== id) {
    return res.status(400).json(
      buildError('El correo ya existe', 'correo', 'Usa otro correo o restablece la contraseña de esa cuenta')
    );
  }

  if (cambiaRol) {
    const { casos, auxiliares } = await UserModel.contarCasosYAuxiliares(id);
    if (cuenta.rol === 'contador' && auxiliares > 0) {
      return res.status(409).json(
        buildError('El contador tiene auxiliares', 'rol', 'Cambia primero el contador que apoya cada uno de sus auxiliares')
      );
    }
    if (casos > 0 && !ROLES_CON_CASOS.includes(rol)) {
      return res.status(409).json(
        buildError('La cuenta tiene casos', 'rol', 'Elige contador o auxiliar, o reasigna sus casos antes de cambiar el rol')
      );
    }
  }

  // El contador que apoya (solo si queda como auxiliar y el campo llega); mismas reglas que el alta
  let contadoresIds = null;
  if (rol === 'auxiliar' && req.body.contadores !== undefined) {
    contadoresIds = parseListaDeIds(req.body.contadores);
    if (!contadoresIds) return res.status(400).json(ERROR_LISTA_CONTADORES);
    if (contadoresIds.length > 1) {
      return res.status(400).json(
        buildError('Un auxiliar solo puede apoyar a un contador', 'contadores', 'Elige un solo contador')
      );
    }
    for (const contadorId of contadoresIds) {
      if (contadorId === id || !(await UserModel.findCounterById(contadorId))) {
        return res.status(400).json(
          buildError('La cuenta no es un contador', 'contadores', 'Elige solo cuentas con rol de contador')
        );
      }
    }
  }

  // Un auxiliar que deja de serlo se desvincula antes de cambiar el rol (el modelo exige rol auxiliar)
  const actuales = cuenta.rol === 'auxiliar' ? await AuxiliarModel.idsDeContadoresDe(id) : [];
  if (cuenta.rol === 'auxiliar' && rol !== 'auxiliar' && actuales.length > 0) {
    const { quitados } = await AuxiliarModel.ajustarContadoresDeAuxiliar(id, { agregar: [], quitar: actuales });
    await avisarVinculosQuitados(id, quitados);
  }

  try {
    await UserModel.update(id, { nombre, correo, rol });
  } catch (error) {
    // Otra alta o edición tomó el mismo correo un instante antes
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(400).json(
        buildError('El correo ya existe', 'correo', 'Usa otro correo o restablece la contraseña de esa cuenta')
      );
    }
    throw error;
  }

  if (contadoresIds) {
    const agregar = contadoresIds.filter((contadorId) => !actuales.includes(contadorId));
    const quitar = actuales.filter((contadorId) => !contadoresIds.includes(contadorId));
    const { agregados, quitados } = await AuxiliarModel.ajustarContadoresDeAuxiliar(id, { agregar, quitar });
    await avisarVinculosQuitados(id, quitados);
    await avisarNuevosVinculos(id, agregados);
  }

  if (cambiaRol) await SessionModel.revocarSesionesDeUsuario(id);
  if (cambiaRol) bitacora.registrar('usuario_rol_cambiado', req, { objetivoId: id, rolAnterior: cuenta.rol, rolNuevo: rol }, 'warn');
  if (String(correo).trim().toLowerCase() !== String(cuenta.correo).toLowerCase()) bitacora.registrar('usuario_correo_cambiado', req, { objetivoId: id }, 'warn');

  return res.status(200).json({ mensaje: 'Usuario actualizado correctamente', usuario: { id, nombre, correo, rol } });
}

module.exports = { createUser, resetPassword, listUsers, updateUser };
