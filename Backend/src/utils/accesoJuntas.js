const { parseCounterId } = require('./validationUtils');
const { administradorEsAtendido } = require('../config/recepcion');

/**
 * Reglas de acceso de la recepcionista como secretaria de los administradores (puro, sin base de datos).
 * Es la única fuente de estas reglas: el modelo y el controlador de juntas la consultan, no la repiten.
 * La secretaria solo actúa sobre los «administradores atendidos»: los de ADMINISTRADORES_DE_RECEPCION
 * (ver `config/recepcion.js`). Con cualquier otro administrador se comporta como un tercero.
 */

const ROL_SECRETARIA = 'recepcionista';
const ROL_ADMINISTRADOR = 'administrador';

/**
 * Indica si la cuenta actúa como secretaria de los administradores.
 * @param {{ rol: string }} usuario - Cuenta que actúa.
 * @returns {boolean}
 */
function esSecretaria(usuario) {
  return usuario.rol === ROL_SECRETARIA;
}

/**
 * Indica si una cuenta es un administrador atendido por la recepción.
 * @param {{ id: number, rol: string }} cuenta - Cuenta a comprobar.
 * @returns {boolean}
 */
function esAdministradorAtendido(cuenta) {
  return cuenta.rol === ROL_ADMINISTRADOR && administradorEsAtendido(cuenta.id);
}

/**
 * Permisos de la cuenta sobre una junta, además de los de organizador e invitado.
 * - `puede_editar`: organiza la junta, o es secretaria y la organiza un administrador atendido.
 * - `responder_por`: los administradores atendidos invitados por los que puede responder; vacío salvo para la secretaria.
 * @param {{ id: number, rol: string }} usuario - Cuenta que consulta.
 * @param {{ organizadorId: number, organizadorRol: string, participantes: Array<{ id: number, nombre: string, rol: string, respuesta: string }> }} junta - Organizador e invitados de la junta.
 * @returns {{ puede_editar: boolean, responder_por: Array<{ id: number, nombre: string, respuesta: string }> }}
 */
function permisosDeJunta(usuario, { organizadorId, organizadorRol, participantes }) {
  const secretaria = esSecretaria(usuario);
  return {
    puede_editar: organizadorId === usuario.id ||
      (secretaria && esAdministradorAtendido({ id: organizadorId, rol: organizadorRol })),
    responder_por: secretaria
      ? participantes
          .filter(esAdministradorAtendido)
          .map(({ id, nombre, respuesta }) => ({ id, nombre, respuesta }))
      : [],
  };
}

/**
 * Indica si la cuenta ve el detalle completo de una junta ya armada: la organiza, está invitada
 * o, siendo secretaria, es una junta de un administrador atendido (la organiza o lo invitó).
 * @param {{ id: number }} usuario - Cuenta que consulta.
 * @param {{ soy_organizador: boolean, participantes: Array<{ id: number }>, puede_editar: boolean, responder_por: Array<Object> }} junta - Junta con sus permisos.
 * @returns {boolean}
 */
function puedeVerCompleta(usuario, junta) {
  return (
    junta.soy_organizador ||
    junta.participantes.some((p) => p.id === usuario.id) ||
    junta.puede_editar ||
    junta.responder_por.length > 0
  );
}

/**
 * Indica si, al consultar la agenda de una cuenta, se ven completas todas sus juntas:
 * solo la secretaria que consulta la agenda de un administrador atendido.
 * @param {{ rol: string }} usuario - Cuenta que consulta.
 * @param {{ id: number, rol: string }} dueno - Cuenta cuya agenda se consulta.
 * @returns {boolean}
 */
function veAgendaCompleta(usuario, dueno) {
  return esSecretaria(usuario) && esAdministradorAtendido(dueno);
}

/**
 * Indica si la secretaria puede agendar una junta a nombre de esa cuenta: debe ser un administrador atendido.
 * @param {{ id: number, rol: string }} cuenta - Cuenta elegida como organizadora.
 * @returns {boolean}
 */
function puedeAgendarANombreDe(cuenta) {
  return esAdministradorAtendido(cuenta);
}

/**
 * Decide a quién se atribuye una respuesta enviada con `en_nombre_de`.
 * @param {{ rol: string }} usuario - Cuenta que responde.
 * @param {Array<{ id: number, rol: string }>} participantes - Invitados de la junta.
 * @param {*} enNombreDe - Valor recibido de `en_nombre_de`.
 * @returns {{ participante: Object }|{ error: 'prohibido'|'invalido'|'no_invitado' }}
 *   `prohibido`: no es secretaria; `invalido`: no es un id; `no_invitado`: no es un administrador atendido invitado.
 */
function resolverRespuestaEnNombre(usuario, participantes, enNombreDe) {
  if (!esSecretaria(usuario)) return { error: 'prohibido' };
  const id = typeof enNombreDe === 'string' || typeof enNombreDe === 'number' ? parseCounterId(enNombreDe) : null;
  if (id === null) return { error: 'invalido' };
  const participante = participantes.find((p) => p.id === id && esAdministradorAtendido(p));
  return participante ? { participante } : { error: 'no_invitado' };
}

module.exports = {
  esSecretaria,
  esAdministradorAtendido,
  puedeAgendarANombreDe,
  permisosDeJunta,
  puedeVerCompleta,
  veAgendaCompleta,
  resolverRespuestaEnNombre,
};
