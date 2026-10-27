// Pruebas del servicio de avisos dentro de la app (prioridad cambiada por el administrador).
// Sin red: se inyecta una api falsa.

import test from 'node:test'
import assert from 'node:assert/strict'

import { crearNotificacionService } from '../src/services/notificacionService.js'

const crearApiFalsa = ({ datos, error } = {}) => {
  const llamadas = []
  const responder = async (metodo, url) => {
    llamadas.push({ metodo, url })
    if (error) {
      throw error
    }
    return { data: datos }
  }
  return { llamadas, get: (url) => responder('GET', url), patch: (url) => responder('PATCH', url) }
}

const AVISO = {
  id: 4,
  caso_id: 9,
  mensaje: 'Alejandro cambió la prioridad de «Gamesa» de Media a Alta. Ahora vence el 09-11-2026.',
  leida: false,
  creado_en: '2026-10-27 18:05:00',
}

test('getNotificaciones lee GET /notificaciones y devuelve los avisos y cuántos faltan por leer', async () => {
  const api = crearApiFalsa({ datos: { notificaciones: [AVISO], no_leidas: 1 } })
  const servicio = crearNotificacionService({ api })

  const resultado = await servicio.getNotificaciones()

  assert.deepEqual(api.llamadas, [{ metodo: 'GET', url: '/notificaciones' }])
  assert.deepEqual(resultado, {
    avisos: [{ id: 4, casoId: 9, mensaje: AVISO.mensaje, leida: false, fecha: '27-10-2026 18:05' }],
    noLeidas: 1,
  })
})

test('getNotificaciones rechaza con tres partes si la respuesta no trae la lista', async () => {
  const servicio = crearNotificacionService({ api: crearApiFalsa({ datos: { no_leidas: 0 } }) })

  await assert.rejects(
    () => servicio.getNotificaciones(),
    (error) => error.estado === 'respuesta_inesperada' && error.mensaje.includes('Qué ocurrió:'),
  )
})

test('marcarLeidas hace PATCH /notificaciones/leidas', async () => {
  const api = crearApiFalsa({ datos: { mensaje: 'Avisos marcados como leídos' } })

  await crearNotificacionService({ api }).marcarLeidas()

  assert.deepEqual(api.llamadas, [{ metodo: 'PATCH', url: '/notificaciones/leidas' }])
})

test('los errores de la api se propagan tal cual', async () => {
  const error = { estado: 'red', mensaje: 'Qué ocurrió: sin conexión.' }
  const servicio = crearNotificacionService({ api: crearApiFalsa({ error }) })

  await assert.rejects(() => servicio.getNotificaciones(), error)
  await assert.rejects(() => servicio.marcarLeidas(), error)
})
