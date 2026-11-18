// Servicio de avisos dentro de la app: el contador los recibe cuando el administrador
// cambia la prioridad de uno de sus casos. Sin Vue: la api se puede inyectar para probarlo.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'

/** 'AAAA-MM-DD HH:mm:ss' (hora local del backend) → 'DD-MM-AAAA HH:mm'. */
const fechaVisible = (texto) => {
  const [fecha = '', hora = ''] = String(texto ?? '').split(' ')
  const [anio, mes, dia] = fecha.split('-')
  return anio && mes && dia ? `${dia}-${mes}-${anio} ${hora.slice(0, 5)}`.trim() : ''
}

/**
 * Crea el servicio de avisos con la api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {{ getNotificaciones: Function, marcarLeidas: Function }}
 */
export const crearNotificacionService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  /**
   * GET /notificaciones: avisos de la cuenta, del más reciente al más antiguo.
   * @returns {Promise<{ avisos: Array<{ id: number, casoId: number|null, juntaId?: number, juntaInicio?: string|null, mensaje: string, leida: boolean, fecha: string }>, noLeidas: number }>}
   */
  const getNotificaciones = async () => {
    const { data } = await api.get('/notificaciones')
    if (!data || !Array.isArray(data.notificaciones)) {
      throw crearErrorInesperado('los avisos')
    }

    return {
      avisos: data.notificaciones.map((aviso) => ({
        id: aviso.id,
        casoId: aviso.caso_id ?? null,
        // Solo los avisos de una junta traen estos campos; los de casos conservan su forma.
        ...(aviso.junta_id
          ? { juntaId: aviso.junta_id, juntaInicio: aviso.junta_inicio ?? null }
          : {}),
        mensaje: aviso.mensaje ?? '',
        leida: aviso.leida === true,
        fecha: fechaVisible(aviso.creado_en),
      })),
      noLeidas: Number(data.no_leidas) || 0,
    }
  }

  /** PATCH /notificaciones/leidas: marca como leídos los avisos de la cuenta. */
  const marcarLeidas = async () => {
    await api.patch('/notificaciones/leidas')
  }

  return { getNotificaciones, marcarLeidas }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearNotificacionService()

export const getNotificaciones = servicioPorDefecto.getNotificaciones
export const marcarLeidas = servicioPorDefecto.marcarLeidas
