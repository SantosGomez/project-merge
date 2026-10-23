// Preferencia «menú fijado» (historia #8): se recuerda por equipo, no por cuenta.
// Sin Vue y sin efectos: el almacén se inyecta en las pruebas.

const CLAVE_MENU_FIJADO = 'delgrow_menu_fijado'

/**
 * localStorage del equipo, o null si el navegador lo bloquea o no existe (Node).
 * @returns {Object|null} almacén con getItem/setItem, o null.
 */
const obtenerAlmacenLocal = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * Indica si el menú quedó fijado abierto en este equipo.
 * @param {Object|null} [almacen] - almacén del equipo (inyectable en pruebas).
 * @returns {boolean} true solo si la preferencia guardada es «true».
 */
export const leerMenuFijado = (almacen = obtenerAlmacenLocal()) => {
  try {
    return almacen?.getItem(CLAVE_MENU_FIJADO) === 'true'
  } catch {
    return false
  }
}

/**
 * Guarda si el menú queda fijado abierto en este equipo.
 * Si el almacenamiento está bloqueado no se interrumpe la interfaz.
 * @param {boolean} fijado - estado elegido por el usuario.
 * @param {Object|null} [almacen] - almacén del equipo (inyectable en pruebas).
 */
export const guardarMenuFijado = (fijado, almacen = obtenerAlmacenLocal()) => {
  try {
    almacen?.setItem(CLAVE_MENU_FIJADO, String(fijado))
  } catch {
    // La preferencia no es crítica: si no se puede guardar, el menú sigue compacto.
  }
}
