/**
 * Destino de un aviso de la campana: el contador va a «Mis casos» con el caso indicado
 * (`?casoId=`), que la pantalla pone a la vista y resalta. Solo contadores y auxiliares reciben
 * avisos de casos; sin caso (p. ej. chat de auditoría) o en otro rol no hay enlace.
 * No se arrastra la consulta de la pantalla actual: un filtro previo podría ocultar el caso.
 * @param {{ casoId?: number|string|null }} aviso - aviso de `notificacionService`.
 * @param {string} rol - rol de la sesión.
 * @returns {{ name: string, query: { casoId: string } }|null}
 */
export const destinoDeAviso = (aviso, rol) => {
  const casoId = aviso?.casoId
  if (casoId === null || casoId === undefined || casoId === '' || !['contador', 'auxiliar'].includes(rol)) {
    return null
  }
  return { name: 'contador-casos', query: { casoId: String(casoId) } }
}
