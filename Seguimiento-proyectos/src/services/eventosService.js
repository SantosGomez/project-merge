// Servicio de tiempo real: escucha los avisos del servidor (Server-Sent Events) para que
// las pantallas se actualicen sin recargar. Sin Vue: la api, EventSource y los temporizadores
// se pueden inyectar para probarlo sin red ni navegador.
//
// - `conectar()` pide un pase (POST /eventos/pase) y abre GET /eventos?pase=…; el token
//   nunca va en la URL.
// - Si la conexión se cae, se reconecta con un pase nuevo esperando 5, 10, 20, 40 y 60 s.
//   Al volver avisa «reconectado» para que cada pantalla recupere lo que se perdió.
// - `escuchar(nombre, funcion)` devuelve la función para dejar de escuchar.

import { ESTADOS_ERROR, URL_BASE_API, api as apiPorDefecto } from './api.js'

/** Avisos que manda el servidor y se reenvían a quien los escuche. */
const AVISOS_DEL_SERVIDOR = ['caso-actualizado', 'aviso-nuevo', 'auditoria-actualizada']

const ESPERA_INICIAL_MS = 5000
const ESPERA_MAXIMA_MS = 60 * 1000

/**
 * Crea el servicio de tiempo real con dependencias inyectables.
 * @param {Object} [opciones] - inyección para pruebas.
 * @returns {{ conectar: Function, desconectar: Function, escuchar: Function }}
 */
export const crearEventosService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto
  const EventSourceClase = opciones.EventSourceClase ?? globalThis.EventSource
  const programar = opciones.programar ?? ((funcion, ms) => globalThis.setTimeout(funcion, ms))
  const cancelar = opciones.cancelar ?? ((id) => globalThis.clearTimeout(id))
  const urlBase = opciones.urlBase ?? URL_BASE_API

  const oyentes = new Map()
  let fuente = null
  let reintento = null
  let activo = false
  let intentos = 0
  let yaConecto = false

  const emitir = (nombre, datos) => {
    for (const funcion of oyentes.get(nombre) ?? []) funcion(datos)
  }

  const cerrarFuente = () => {
    if (fuente) {
      fuente.close()
      fuente = null
    }
  }

  const programarReintento = () => {
    if (!activo) return
    const espera = Math.min(ESPERA_INICIAL_MS * 2 ** intentos, ESPERA_MAXIMA_MS)
    intentos += 1
    reintento = programar(abrir, espera)
  }

  async function abrir() {
    reintento = null
    if (!activo) return

    let pase
    try {
      const { data } = await api.post('/eventos/pase')
      pase = data.pase
    } catch (error) {
      // Sin sesión no tiene caso reintentar: la api ya avisó que la sesión caducó
      if (error?.estado === ESTADOS_ERROR.SIN_SESION) {
        activo = false
        return
      }
      programarReintento()
      return
    }
    if (!activo) return

    fuente = new EventSourceClase(`${urlBase}/eventos?pase=${encodeURIComponent(pase)}`)
    fuente.addEventListener('conectado', () => {
      intentos = 0
      if (yaConecto) emitir('reconectado', {})
      yaConecto = true
    })
    for (const nombre of AVISOS_DEL_SERVIDOR) {
      fuente.addEventListener(nombre, (evento) => emitir(nombre, JSON.parse(evento.data)))
    }
    fuente.addEventListener('sesion-cerrada', () => {
      activo = false
      cerrarFuente()
      emitir('sesion-cerrada', {})
    })
    // EventSource reintentaría con el mismo pase (ya usado): se cierra y se pide uno nuevo
    fuente.onerror = () => {
      cerrarFuente()
      programarReintento()
    }
  }

  /** Abre la conexión (una sola aunque se llame varias veces). */
  const conectar = () => {
    if (activo) return
    activo = true
    intentos = 0
    yaConecto = false
    abrir()
  }

  /** Cierra la conexión y cancela cualquier reintento pendiente. */
  const desconectar = () => {
    activo = false
    if (reintento !== null) {
      cancelar(reintento)
      reintento = null
    }
    cerrarFuente()
  }

  /**
   * Escucha un aviso: 'caso-actualizado', 'aviso-nuevo', 'auditoria-actualizada', 'reconectado' o
   * 'sesion-cerrada'.
   * @returns {Function} deja de escuchar.
   */
  const escuchar = (nombre, funcion) => {
    if (!oyentes.has(nombre)) oyentes.set(nombre, new Set())
    oyentes.get(nombre).add(funcion)
    return () => oyentes.get(nombre).delete(funcion)
  }

  return { conectar, desconectar, escuchar }
}

// Servicio único de la app con la api, EventSource y temporizadores reales.
export const eventos = crearEventosService()
