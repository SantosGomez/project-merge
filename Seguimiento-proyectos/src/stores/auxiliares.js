// Store de auxiliares del contador (RF-AX-01 a RF-AX-06).
// No navega ni usa el router; expone estado y acciones para la página de auxiliares.
//
// Registro y quita de auxiliares: el servicio ya traduce la respuesta; el store
// reemplaza la lista local con la devuelta para que la pantalla quede al día.
// Inyección de dependencias: `crearAuxiliaresStore({ auxiliarService })` permite
// sustituir el servicio en las pruebas.

import { defineStore } from 'pinia'

import { ESTADOS_ERROR, crearErrorFrontend } from '../services/api.js'
import { QUE_HACER } from '../utils/mensajes.js'

const servicioPorDefecto = {
  listarAuxiliares: undefined,
  asignarAuxiliar: undefined,
  quitarAuxiliar: undefined,
  listarContadoresQueMeTienenComoAuxiliar: undefined,
  crearCasoComoAuxiliar: undefined,
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
        QUE_HACER.reintentar,
      )

// Igual, pero para un guardado: decir «obtener los datos» confundiría a quien acaba de guardar.
const normalizarErrorDeGuardado = (error, sobreQue) =>
  error && typeof error.mensaje === 'string'
    ? error
    : crearErrorFrontend(ESTADOS_ERROR.RED, 'No se pudo guardar en el servidor', sobreQue, QUE_HACER.reintentar)

/**
 * Crea la definición del store de auxiliares con dependencias inyectables.
 * @param {Object} [dependencias] - inyección para pruebas.
 * @returns {Function} hook `useAuxiliaresStore`.
 */
export const crearAuxiliaresStore = (dependencias = {}) => {
  const servicio = dependencias.auxiliarService ?? servicioPorDefecto

  // Versión interna para descartar respuestas o errores tardíos.
  let version = 0

  return defineStore('auxiliares', {
    state: () => ({
      /** Auxiliares del contador autenticado, ya traducidos. */
      auxiliares: [],
      /** Carga de la lista de auxiliares. */
      cargando: false,
      /** Asignación o quita en curso. */
      guardando: false,
      /** Error de la última lectura, o null. */
      error: null,
    }),

    getters: {
      /** Cantidad de auxiliares. */
      total: (state) => state.auxiliares.length,
    },

    actions: {
      /**
       * Carga los auxiliares del contador autenticado.
       * @param {number} contadorId - Id del contador.
       * @returns {Promise<{ ok: boolean, auxiliares?: Array, error?: Object }>}
       */
      async cargarAuxiliares(contadorId) {
        const versionActual = ++version

        this.cargando = true
        this.error = null
        this._ultimoContadorId = contadorId

        try {
          const auxiliares = await servicio.listarAuxiliares(contadorId)

          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          this.auxiliares = auxiliares
          this.cargando = false
          return { ok: true, auxiliares }
        } catch (error) {
          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          this.error = normalizarError(error, 'la carga de los auxiliares')
          this.cargando = false
          return { ok: false, error: this.error }
        }
      },

      /**
       * Asigna un auxiliar al contador.
       * @param {number} contadorId - Id del contador.
       * @param {number} auxiliarId - Id del auxiliar.
       * @returns {Promise<{ ok: boolean, error?: Object }>}
       */
      async asignarAuxiliar(contadorId, auxiliarId) {
        const versionActual = ++version

        this.guardando = true

        try {
          await servicio.asignarAuxiliar(contadorId, auxiliarId)

          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          // Recarga la lista para que quede al día
          await this.cargarAuxiliares(contadorId)

          this.guardando = false
          return { ok: true }
        } catch (error) {
          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          return { ok: false, error: normalizarErrorDeGuardado(error, 'la asignación del auxiliar') }
        } finally {
          if (versionActual === version) {
            this.guardando = false
          }
        }
      },

      /**
       * Quita un auxiliar del contador.
       * @param {number} contadorId - Id del contador.
       * @param {number} auxiliarId - Id del auxiliar.
       * @returns {Promise<{ ok: boolean, error?: Object }>}
       */
      async quitarAuxiliar(contadorId, auxiliarId) {
        const versionActual = ++version

        this.guardando = true

        try {
          await servicio.quitarAuxiliar(contadorId, auxiliarId)

          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          // Recarga la lista para que quede al día
          await this.cargarAuxiliares(contadorId)

          this.guardando = false
          return { ok: true }
        } catch (error) {
          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          return { ok: false, error: normalizarErrorDeGuardado(error, 'la quita del auxiliar') }
        } finally {
          if (versionActual === version) {
            this.guardando = false
          }
        }
      },

      /**
       * Crea un caso a nombre de un contador del que el autenticado es auxiliar.
       * @param {number} contadorId - Id del contador dueño del caso.
       * @param {Object} datos - Datos del caso { cliente, prioridad, fecha_inicio, fecha_vencimiento, descripcion, observaciones }.
       * @returns {Promise<{ ok: boolean, caso?: Object, error?: Object }>}
       */
      async crearCasoComoAuxiliar(contadorId, datos) {
        const versionActual = ++version

        this.guardando = true
        this.error = null

        try {
          const resultado = await servicio.crearCasoComoAuxiliar(contadorId, datos)

          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          this.guardando = false
          return { ok: true, caso: resultado.caso }
        } catch (error) {
          if (versionActual !== version) {
            return { ok: false, descartado: true }
          }

          this.error = normalizarErrorDeGuardado(error, 'la creación del caso')
          return { ok: false, error: this.error }
        } finally {
          if (versionActual === version) {
            this.guardando = false
          }
        }
      },

      /** Reintenta la carga de la lista de auxiliares del último contador consultado. */
      async reintentar() {
        return this.cargarAuxiliares(this._ultimoContadorId ?? 0)
      },

      /** Limpia todo al cerrar sesión: no quedan datos de otro perfil (RNF-05). */
      reiniciar() {
        version += 1
        this.auxiliares = []
        this.cargando = false
        this.guardando = false
        this.error = null
      },
    },
  })
}

/** Store de auxiliares con el servicio real. */
export const useAuxiliaresStore = crearAuxiliaresStore()
