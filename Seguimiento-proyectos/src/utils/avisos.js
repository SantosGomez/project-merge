const ROLES_CALENDARIO = ['administrador', 'contador', 'auxiliar', 'recepcionista']

/**
 * Destino de un aviso de la campana.
 * - Aviso de una junta: «Juntas» en el periodo de la junta (`?fecha=`) y con su ficha abierta
 *   (`?juntaId=`), para los 4 roles del calendario.
 * - Aviso de un caso: el contador va a «Mis casos» con el caso indicado (`?casoId=`), que la pantalla
 *   pone a la vista y resalta. Solo contadores y auxiliares reciben avisos de casos; sin caso (p. ej.
 *   chat de auditoría) o en otro rol no hay enlace.
 * No se arrastra la consulta de la pantalla actual: un filtro previo podría ocultar el caso.
 * @param {{ casoId?: number|string|null, juntaId?: number|string|null, juntaInicio?: string|null }} aviso - aviso de `notificacionService`.
 * @param {string} rol - rol de la sesión.
 * @returns {{ name: string, query: Object }|null}
 */
export const destinoDeAviso = (aviso, rol) => {
  const juntaId = aviso?.juntaId
  if (juntaId !== null && juntaId !== undefined && juntaId !== '') {
    if (!ROLES_CALENDARIO.includes(rol)) return null
    const fecha = typeof aviso.juntaInicio === 'string' ? aviso.juntaInicio.slice(0, 10) : ''
    return {
      name: 'juntas',
      query: fecha ? { fecha, juntaId: String(juntaId) } : { juntaId: String(juntaId) },
    }
  }
  const casoId = aviso?.casoId
  if (
    casoId === null ||
    casoId === undefined ||
    casoId === '' ||
    !['contador', 'auxiliar'].includes(rol)
  ) {
    return null
  }
  return { name: 'contador-casos', query: { casoId: String(casoId) } }
}
