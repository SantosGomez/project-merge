// Regla pura del estado de una pantalla: carga, error, vacío o contenido.
// Sin Vue, sin navegador y sin efectos secundarios.

/** Valores que puede devolver `screenState` (RF-35, RF-36, RF-37). */
export const SCREEN_STATES = {
  loading: 'cargando',
  error: 'error',
  empty: 'vacio',
  content: 'contenido',
}

/**
 * Decide qué debe mostrar una pantalla con datos.
 * Prioridad: error sobre carga y contenido; carga sobre contenido;
 * sin filas se muestra el vacío.
 */
export const screenState = ({ loading, error, rows } = {}) => {
  if (error) {
    return SCREEN_STATES.error
  }

  if (loading) {
    return SCREEN_STATES.loading
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return SCREEN_STATES.empty
  }

  return SCREEN_STATES.content
}
