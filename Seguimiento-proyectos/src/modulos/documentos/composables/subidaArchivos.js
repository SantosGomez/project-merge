// Subida de los archivos de una recepción (adjuntos y acuse) a la carpeta del
// cliente. El documento ya quedó registrado cuando esto corre: si un archivo
// falla no se pierde el registro, pero tampoco se calla. Lo que no subió vuelve
// como pendiente, con su motivo, para avisarlo y poder reintentarlo.

/**
 * Sube los elementos de uno en uno, en orden, y sigue aunque alguno falle.
 *
 * @param {Array<{nombre: string}>} elementos - Lo que hay que subir. Cada uno
 *   conserva lo necesario para reintentarlo (el archivo, el blob…).
 * @param {(elemento: object) => Promise<unknown>} subir - Sube un elemento; lanza si falla.
 * @returns {Promise<Array<object>>} Los que fallaron, con `motivo`. Vacío si todo subió.
 */
export const subirEnOrden = async (elementos, subir) => {
  const pendientes = []
  for (const elemento of elementos) {
    try {
      await subir(elemento)
    } catch (error) {
      pendientes.push({ ...elemento, motivo: error?.message || 'Error desconocido' })
    }
  }
  return pendientes
}

/** Texto del aviso con los archivos que no se guardaron. */
export const textoArchivosPendientes = (pendientes) => {
  const nombres = pendientes.map((p) => p.nombre).join(', ')
  return pendientes.length === 1
    ? `No se pudo guardar 1 archivo en la carpeta del cliente: ${nombres}.`
    : `No se pudieron guardar ${pendientes.length} archivos en la carpeta del cliente: ${nombres}.`
}
