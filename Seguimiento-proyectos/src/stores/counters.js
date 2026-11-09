// Store de contadores para el dashboard del administrador (RF-11 a RF-16, RF-24,
// RF-34 a RF-36). No navega ni usa el router; expone estado y acciones para P-2 y P-3.
//
// Carga (contrato 2/4.7): primero `GET /contadores` y después las N peticiones
// `GET /contadores/:id/conteos` en paralelo con `Promise.all`. Si cualquiera falla,
// el error es completo y no se conservan conteos parciales (RF-36).
//
// Inyección de dependencias: `crearCountersStore({ counterService })` permite
// sustituir el servicio en las pruebas. El hook por defecto usa el servicio real.

import { defineStore } from 'pinia'

import { ESTADOS_ERROR, crearErrorFrontend } from '../services/api.js'
import {
  getCasosPorContador as getCasosPorContadorPorDefecto,
  getConteosPorEstado as getConteosPorEstadoPorDefecto,
  listCounters as listCountersPorDefecto,
} from '../services/counterService.js'
import { QUE_HACER } from '../utils/mensajes.js'
import { screenState } from '../utils/screenState.js'

const contadoresPorDefecto = {
  listCounters: listCountersPorDefecto,
  getConteosPorEstado: getConteosPorEstadoPorDefecto,
  getCasosPorContador: getCasosPorContadorPorDefecto,
}

const CONTEO_EN_CERO = Object.freeze({ pendiente: 0, en_proceso: 0, finalizado: 0 })

// El dashboard del administrador muestra por contador solo sus casos importantes.
const SOLO_IMPORTANTES = Object.freeze({ soloImportantes: true })

/** Conteos con las tres claves y valores numéricos (RF-12: el cero se muestra). */
const normalizarConteos = (conteos) => ({
  pendiente: Number(conteos?.pendiente) || 0,
  en_proceso: Number(conteos?.en_proceso) || 0,
  finalizado: Number(conteos?.finalizado) || 0,
})

// Si el servicio entrega un error normalizado se conserva; si no, se construye
// uno de tres partes para que la pantalla nunca muestre un mensaje vacío (RNF-01).
const normalizarError = (error, sobreQue) =>
  error && typeof error.mensaje === 'string'
    ? error
    : crearErrorFrontend(
        ESTADOS_ERROR.RED,
        'No se pudieron obtener los datos del servidor',
        sobreQue,
        QUE_HACER.reintentar,
      )

/**
 * Crea la definición del store de contadores con dependencias inyectables.
 * @param {Object} [dependencias] - inyección para pruebas.
 * @returns {Function} hook `useCountersStore`.
 */
export const crearCountersStore = (dependencias = {}) => {
  const servicio = dependencias.counterService ?? contadoresPorDefecto

  // Versión interna: cada operación anota la vigente al empezar y reiniciar() la
  // incrementa. Una respuesta o error tardío solo se aplica si la versión sigue
  // siendo la misma (respuestas tardías tras cerrar sesión o cambiar de carga).
  let version = 0

  return defineStore('counters', {
    state: () => ({
      /** Contadores registrados: `{ id, nombre }` (RF-11, RF-16). */
      contadores: [],
      /** Conteos por estado de cada contador, indexados por id (RF-12). */
      conteosPorId: {},
      /** Contador cuyo detalle se muestra en P-2 (RF-13, RF-17). */
      contadorSeleccionadoId: null,
      /** Casos del contador seleccionado, ya traducidos por el servicio (RF-13). */
      casosDetalle: [],
      /** Carga de la lista y los conteos (RF-34). */
      cargando: false,
      /** Carga del detalle del contador seleccionado (RF-34). */
      cargandoDetalle: false,
      /** Error de tres partes de la última operación, o null (RF-36). */
      error: null,
      /** Error de la carga del detalle: se muestra solo en el detalle, la lista sigue a la vista. */
      errorDetalle: null,
    }),

    getters: {
      /** Contador seleccionado completo, o null si no hay selección. */
      contadorSeleccionado: (state) =>
        state.contadores.find((contador) => contador.id === state.contadorSeleccionadoId) ?? null,
      /** Conteos de un contador con ceros incluidos (RF-12). */
      conteosDe: (state) => (id) => state.conteosPorId[id] ?? { ...CONTEO_EN_CERO },
      /** Estado de la pantalla P-2 según carga, error y filas (RF-34 a RF-36). */
      estadoPantalla: (state) =>
        screenState({ loading: state.cargando, error: state.error, rows: state.contadores }),
      /** Estado del detalle del contador seleccionado (RF-14, RF-34 a RF-36). */
      estadoDetalle: (state) =>
        screenState({
          loading: state.cargandoDetalle,
          error: state.errorDetalle,
          rows: state.casosDetalle,
        }),
    },

    actions: {
      /** Deja la pantalla en error sin datos parciales (RF-36). */
      registrarError(error, sobreQue) {
        this.error = normalizarError(error, sobreQue)
        this.contadores = []
        this.conteosPorId = {}
        this.casosDetalle = []
        this.contadorSeleccionadoId = null
        this.cargando = false
        this.cargandoDetalle = false
      },

      /**
       * Carga la lista de contadores y sus conteos (RF-11, RF-12, RF-34).
       * Las N peticiones de conteos se lanzan en paralelo tras completar la lista.
       * @returns {Promise<{ ok: boolean, contadores?: Array, error?: Object }>}
       */
      async cargarContadores() {
        const versionActual = ++version

        this.cargando = true
        this.cargandoDetalle = false
        this.error = null
        this.contadores = []
        this.conteosPorId = {}
        this.contadorSeleccionadoId = null
        this.casosDetalle = []

        try {
          const lista = await servicio.listCounters()

          // Respuesta tardía: se descarta sin tocar el estado.
          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          const conteos = await Promise.all(
            lista.map((contador) => servicio.getConteosPorEstado(contador.id, SOLO_IMPORTANTES)),
          )

          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          const mapa = {}
          lista.forEach((contador, indice) => {
            mapa[contador.id] = normalizarConteos(conteos[indice])
          })

          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          this.contadores = lista
          this.conteosPorId = mapa
          this.cargando = false
          return { ok: true, contadores: lista }
        } catch (error) {
          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          this.registrarError(error, 'la carga de contadores y conteos')
          return { ok: false, error: this.error }
        }
      },

      /**
       * Selecciona un contador y carga su detalle (RF-13, RF-15, RF-17).
       * Al cambiar de contador, el detalle anterior se descarta de inmediato.
       * Si la carga falla, se conserva la selección y el error queda en `errorDetalle`.
       * @param {number|string|null} id - identificador del contador.
       * @returns {Promise<{ ok: boolean, casos?: Array, error?: Object, descartado?: boolean }>}
       */
      async seleccionarContador(id) {
        if (id === null || id === undefined) {
          this.limpiarSeleccion()
          return { ok: true, casos: [] }
        }

        const versionActual = ++version

        this.contadorSeleccionadoId = id
        this.casosDetalle = []
        this.cargandoDetalle = true
        this.errorDetalle = null

        try {
          const casos = await servicio.getCasosPorContador(id, SOLO_IMPORTANTES)

          // Respuesta tardía o selección más reciente: se descarta sin tocar el estado.
          if (versionActual !== version || this.contadorSeleccionadoId !== id) {
            return { ok: false, descartado: true }
          }

          this.casosDetalle = casos
          this.cargandoDetalle = false
          return { ok: true, casos }
        } catch (error) {
          if (versionActual !== version || this.contadorSeleccionadoId !== id) {
            return { ok: false, descartado: true }
          }

          // Se conserva la selección para que el detalle ofrezca reintentar sin tumbar la lista.
          this.errorDetalle = normalizarError(error, 'el detalle del contador')
          this.casosDetalle = []
          this.cargandoDetalle = false
          return { ok: false, error: this.errorDetalle }
        }
      },

      /**
       * Pone en el detalle el caso que devolvió el backend tras cambiar su prioridad,
       * sin volver a pedir el detalle. Un caso que no está en el detalle no se agrega.
       * @param {Object} casoActualizado - caso traducido (con `id`).
       */
      reemplazarCasoDetalle(casoActualizado) {
        this.casosDetalle = this.casosDetalle.map((caso) =>
          caso.id === casoActualizado.id ? casoActualizado : caso,
        )
      },

      /**
       * Tiempo real: vuelve a pedir los conteos (y el detalle, si es el contador seleccionado)
       * sin pasar por «cargando» ni vaciar la pantalla. Sin id refresca todos los contadores.
       * Un fallo se ignora: la pantalla sigue como estaba y el siguiente aviso lo reintenta.
       * @param {number|string|null} [contadorId] - contador que cambió.
       */
      async refrescarEnSilencio(contadorId = null) {
        const versionActual = version
        const ids = contadorId === null ? this.contadores.map((contador) => contador.id) : [contadorId]
        const seleccionado = this.contadorSeleccionadoId
        const conDetalle = seleccionado !== null && ids.includes(seleccionado)

        try {
          const [conteos, casos] = await Promise.all([
            Promise.all(ids.map((id) => servicio.getConteosPorEstado(id, SOLO_IMPORTANTES))),
            conDetalle ? servicio.getCasosPorContador(seleccionado, SOLO_IMPORTANTES) : null,
          ])
          // Cerró sesión o recargó todo mientras tanto: no se aplica
          if (versionActual !== version) return

          const mapa = { ...this.conteosPorId }
          ids.forEach((id, indice) => {
            mapa[id] = normalizarConteos(conteos[indice])
          })
          this.conteosPorId = mapa
          if (conDetalle && this.contadorSeleccionadoId === seleccionado) {
            this.casosDetalle = casos
          }
        } catch {
          // Silencioso a propósito: no se interrumpe lo que la persona está viendo
        }
      },

      /** Quita la selección y su detalle sin tocar la lista (RF-36). */
      limpiarSeleccion() {
        this.contadorSeleccionadoId = null
        this.casosDetalle = []
        this.cargandoDetalle = false
        this.errorDetalle = null
      },

      /** Reintenta la carga completa de P-2 tras un error (RF-36). */
      async reintentar() {
        return this.cargarContadores()
      },

      /** Limpia todo al cerrar sesión: no quedan datos de otro perfil (RNF-05). */
      reiniciar() {
        version += 1
        this.contadores = []
        this.conteosPorId = {}
        this.contadorSeleccionadoId = null
        this.casosDetalle = []
        this.cargando = false
        this.cargandoDetalle = false
        this.error = null
      },
    },
  })
}

/** Store de contadores con el servicio real. */
export const useCountersStore = crearCountersStore()
