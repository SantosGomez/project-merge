// Reglas para cambiar el estado de un documento (acordadas el 2026-11-04).
//
// Vive en el servidor, que es quien las hace cumplir (`rutaCambiarEstado`), y el
// Dashboard importa este mismo archivo para ofrecer solo los cambios
// permitidos: una sola copia de la regla (principio 3). Por eso no importa nada.
//
//   · De «Recepcionado» a «En proceso» solo se pasa en Direccionamiento, con la
//     entrega firmada: así el contador tiene de verdad los documentos. Desde el
//     Dashboard un recepcionado no cambia (ni se cancela).
//   · Cambia el estado el contador asignado AL DOCUMENTO (`documentos.contador_id`,
//     que pone la entrega), o un Administrador o Sistemas. Un cliente puede tener
//     varios contadores: cada documento sabe cuál lo lleva.
//   · Se puede reabrir un completado y reactivar un cancelado: vuelven a «En proceso».
//   · Nada vuelve a «Recepcionado»: desharía la entrega firmada.

/** Roles que pueden cambiar cualquier documento sin estar asignados a él. */
const ROLES_SIN_ASIGNACION = Object.freeze(['Administrador', 'Sistemas']);

/** A qué estados se puede pasar desde cada uno. */
const TRANSICIONES = Object.freeze({
  RECEPCIONADO: Object.freeze([]),
  EN_PROCESO: Object.freeze(['PENDIENTE_CLIENTE', 'COMPLETADO', 'CANCELADO']),
  PENDIENTE_CLIENTE: Object.freeze(['EN_PROCESO', 'COMPLETADO', 'CANCELADO']),
  COMPLETADO: Object.freeze(['EN_PROCESO', 'CANCELADO']),
  CANCELADO: Object.freeze(['EN_PROCESO']),
});

/**
 * ¿Puede esta persona cambiar el estado de este documento?
 *
 * @param {{contadorId: number|string|null}} documento
 * @param {{id: number|string, rol: string}} usuario La sesión.
 * @returns {boolean}
 */
export const esResponsable = (documento, usuario) => {
  if (ROLES_SIN_ASIGNACION.includes(usuario?.rol)) return true;
  return (
    usuario?.rol === 'Contador' &&
    documento?.contadorId != null &&
    Number(documento.contadorId) === Number(usuario.id)
  );
};

/**
 * Por qué no se permite pasar de un estado a otro, o `null` si se permite.
 *
 * @param {string} desde El estado actual.
 * @param {string} hacia El estado pedido.
 * @returns {string|null} El motivo, para mostrarlo tal cual.
 */
export const motivoTransicionInvalida = (desde, hacia) => {
  if (desde === hacia) return 'El documento ya tiene ese estado. Elige uno distinto.';
  if (hacia === 'RECEPCIONADO') {
    return 'Un documento no puede volver a «Recepcionado»: desharía la entrega firmada al contador.';
  }
  if (desde === 'RECEPCIONADO') {
    return 'Este documento todavía no se entrega a un contador: pásalo a «En proceso» desde Direccionamiento, con las firmas.';
  }
  if (!(TRANSICIONES[desde] ?? []).includes(hacia)) {
    return 'Ese cambio de estado no está permitido para este documento.';
  }
  return null;
};

/**
 * Los estados a los que esta persona puede pasar este documento. Vacío si no
 * es responsable o si desde su estado no se puede cambiar.
 *
 * @param {{estado: string, contadorId: number|string|null}} documento
 * @param {{id: number|string, rol: string}} usuario
 * @returns {string[]} Una copia: quien llame no puede alterar la regla.
 */
export const estadosPermitidos = (documento, usuario) =>
  esResponsable(documento, usuario) ? [...(TRANSICIONES[documento?.estado] ?? [])] : [];
