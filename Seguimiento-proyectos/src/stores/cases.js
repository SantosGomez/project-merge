// Store de casos propios del contador (RF-15, RF-18 a RF-22, RF-27 a RF-33, RF-36).
// No navega ni usa el router; expone estado y acciones para P-4 y P-5.
//
// Registro y actualización: los servicios ya traducen la respuesta al código
// interno; el store reemplaza el caso en la lista local con el caso devuelto para
// que la pantalla quede al día durante la sesión activa (RF-24, RF-29, RF-30).
//
// Inyección de dependencias: `crearCasesStore({ caseService })` permite sustituir
// el servicio en las pruebas. El hook por defecto usa el servicio real.

import { defineStore } from 'pinia'

import { ESTADOS_ERROR, crearErrorFrontend } from '../services/api.js'
import {
  actualizarCaso as actualizarCasoPorDefecto,
  crearCaso as crearCasoPorDefecto,
  getMisCasos as getMisCasosPorDefecto,
} from '../services/caseService.js'
import { screenState } from '../utils/screenState.js'

const casosPorDefecto = {
  getMisCasos: getMisCasosPorDefecto,
  crearCaso: crearCasoPorDefecto,
  actualizarCaso: actualizarCasoPorDefecto,
}

// Si el servicio entrega un error normalizado se conserva; si no, se construye
// uno de tres partes para que la pantalla nunca muestre un mensaje vacío (RNF-01).
const normalizarError = (error, sobreQue) =>
  error && typeof error.mensaje === 'string'
    ? error
    : crearErrorFrontend(
        ESTADOS_ERROR.RED,
        'No se pudieron obtener los datos del servidor',
        sobreQue,
        'Reintente la operación; si el problema continúa, avise al administrador',
      )

/**
 * Crea la definición del store de casos con dependencias inyectables.
 * @param {Object} [dependencias] - inyección para pruebas.
 * @returns {Function} hook `useCasesStore`.
 */
export const crearCasesStore = (dependencias = {}) => {
  const servicio = dependencias.caseService ?? casosPorDefecto

  // Versión interna para descartar respuestas o errores tardíos (cierre de sesión,
  // cambio de carga) sin tocar el estado de la operación nueva.
  let version = 0

  return defineStore('cases', {
    state: () => ({
      /** Casos asignados al contador autenticado, ya traducidos (RF-27). */
      casos: [],
      /** Carga de la lista de casos (RF-34). */
      cargando: false,
      /** Registro o actualización en curso (RF-36). */
      guardando: false,
      /** Error de la última lectura, o null (RF-36). */
      error: null,
    }),

    getters: {
      /** Cantidad de casos propios. */
      total: (state) => state.casos.length,
      /** Estado de la pantalla P-5 según carga, error y filas (RF-33 a RF-36). */
      estadoPantalla: (state) =>
        screenState({ loading: state.cargando, error: state.error, rows: state.casos }),
    },

    actions: {
      /**
       * Carga los casos del contador autenticado (RF-27, RF-32, RF-34).
       * No conserva la lista anterior mientras carga ni tras un error.
       * @returns {Promise<{ ok: boolean, casos?: Array, error?: Object }>}
       */
      async cargarCasos() {
        const versionActual = ++version

        this.cargando = true
        this.error = null
        this.casos = []

        try {
          const casos = await servicio.getMisCasos()

          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          this.casos = casos
          this.cargando = false
          return { ok: true, casos }
        } catch (error) {
          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          this.error = normalizarError(error, 'la carga de sus casos')
          this.cargando = false
          return { ok: false, error: this.error }
        }
      },

      /**
       * Registra un caso propio y lo agrega a la lista local (RF-18 a RF-24).
       * El error de registro se devuelve para que P-4 muestre el ErrorState; no
       * se guarda como error de lectura de P-5.
       * @param {string} cliente - cliente ya recortado por P-4.
       * @param {string} prioridad - código interno o forma del backend.
       * @returns {Promise<{ ok: boolean, caso?: Object, error?: Object }>}
       */
      /**
   * Registra un caso propio y lo agrega a la lista local (RF-18 a RF-24).
   * El error de registro se devuelve para que P-4 muestre el ErrorState; no
   * se guarda como error de lectura de P-5.
   * @param {string} cliente - cliente ya recortado por P-4.
   * @param {string} prioridad - código interno (`alta`) o forma del backend.
   * @param {string} [fechaInicio] - fecha de inicio en DD-MM-YYYY (opcional, hoy por defecto).
   * @param {string} [descripcion] - descripción del caso (opcional, máx. 1000 chars).
   * @param {string} [observaciones] - observaciones del caso (opcional, máx. 2000 chars).
   * @param {boolean} [importante] - si el caso se marca como importante (opcional).
   * @param {string} [fechaVencimiento] - vencimiento en DD-MM-AAAA que captura el contador.
   * @returns {Promise<{ ok: boolean, caso?: Object, error?: Object }>}
   */
      async crearCaso(cliente, prioridad, fechaInicio, descripcion, observaciones, importante, fechaVencimiento) {
        const versionActual = ++version

        this.guardando = true

        try {
          const caso = await servicio.crearCaso(cliente, prioridad, fechaInicio, descripcion, observaciones, importante, fechaVencimiento)

          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          this.casos = [...this.casos, caso]
          return { ok: true, caso }
        } catch (error) {
          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          return { ok: false, error: normalizarError(error, 'el registro del caso') }
        } finally {
          if (versionActual === version) {
            this.guardando = false
          }
        }
      },

      /**
       * Actualiza estado y/o prioridad de un caso y reemplaza la fila local con
       * el caso devuelto (RF-29 a RF-31, RF-37).
       * @param {number|string} id - identificador del caso.
       * @param {{ estado?: string, prioridad?: string }} cambios
       * @returns {Promise<{ ok: boolean, caso?: Object, error?: Object }>}
       */
      async actualizarCaso(id, cambios) {
        const versionActual = ++version

        this.guardando = true

        try {
          const caso = await servicio.actualizarCaso(id, cambios)

          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          const existe = this.casos.some((uno) => String(uno.id) === String(id))

          this.casos = existe
            ? this.casos.map((uno) => (String(uno.id) === String(id) ? caso : uno))
            : [...this.casos, caso]

          return { ok: true, caso }
        } catch (error) {
          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          return { ok: false, error: normalizarError(error, 'el cambio del caso') }
        } finally {
          if (versionActual === version) {
            this.guardando = false
          }
        }
      },

      /** Reintenta la carga de P-5 tras un error (RF-36). */
      async reintentar() {
        return this.cargarCasos()
      },

      /** Limpia todo al cerrar sesión: no quedan datos de otro perfil (RNF-05). */
      reiniciar() {
        version += 1
        this.casos = []
        this.cargando = false
        this.guardando = false
        this.error = null
      },
    },
  })
}

/** Store de casos con el servicio real. */
export const useCasesStore = crearCasesStore()
