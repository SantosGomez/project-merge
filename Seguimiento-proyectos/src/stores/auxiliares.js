// Store de auxiliares del contador (RF-AX-01 a RF-AX-06).
// No navega ni usa el router; expone estado y acciones para la página de auxiliares.
//
// Registro y quita de auxiliares: el servicio ya traduce la respuesta; el store
// reemplaza la lista local con la devuelta para que la pantalla quede al día.
// Inyección de dependencias: `crearAuxiliaresStore({ auxiliarService })` permite
// sustituir el servicio en las pruebas.

import { defineStore } from 'pinia'

import { ESTADOS_ERROR, crearErrorFrontend } from '../services/api.js'
import {
  listarAuxiliares as listarAuxiliaresServicio,
  asignarAuxiliar as asignarAuxiliarServicio,
  quitarAuxiliar as quitarAuxiliarServicio,
  listarContadoresQueMeTienenComoAuxiliar as listarContadoresServicio,
  listarDisponibles as listarDisponiblesServicio,
  crearCasoComoAuxiliar as crearCasoComoAuxiliarServicio,
} from '../services/auxiliarService.js'
import { QUE_HACER } from '../utils/mensajes.js'

const servicioPorDefecto = {
  listarAuxiliares: listarAuxiliaresServicio,
  asignarAuxiliar: asignarAuxiliarServicio,
  quitarAuxiliar: quitarAuxiliarServicio,
  listarContadoresQueMeTienenComoAuxiliar: listarContadoresServicio,
  listarDisponibles: listarDisponiblesServicio,
  crearCasoComoAuxiliar: crearCasoComoAuxiliarServicio,
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
  // Versión independiente para la lista de contadores disponibles: se carga en paralelo.
  let versionDisponibles = 0

  return defineStore('auxiliares', {
    state: () => ({
      /** Auxiliares del contador autenticado, ya traducidos. */
      auxiliares: [],
      /** Contadores que puede asignar como auxiliares (sin uno mismo ni los ya asignados). */
      disponibles: [],
      /** Carga de la lista de auxiliares. */
      cargando: false,
      /** Carga de la lista de contadores disponibles. */
      cargandoDisponibles: false,
      /** Asignación o quita en curso. */
      guardando: false,
      /** Error de la última lectura, o null. */
      error: null,
      /** Error al leer los contadores disponibles, o null. */
      errorDisponibles: null,
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
       * Contadores para los que el usuario es auxiliar (selector «Registrar caso para» de «Mis casos»).
       * No guarda estado: la lista es de esa pantalla. Un fallo no lanza; devuelve el error.
       * @param {number} auxiliarId - Id del contador autenticado.
       * @returns {Promise<{ ok: boolean, contadores?: Array<{id: number, nombre: string}>, error?: Object }>}
       */
      async listarContadoresQueMeTienenComoAuxiliar(auxiliarId) {
        try {
          const contadores = await servicio.listarContadoresQueMeTienenComoAuxiliar(auxiliarId)
          return { ok: true, contadores }
        } catch (error) {
          return { ok: false, error: normalizarError(error, 'los contadores a los que apoyas') }
        }
      },

      /**
       * Carga los contadores que el contador autenticado puede asignar como auxiliares.
       * @param {number} contadorId - Id del contador.
       * @returns {Promise<{ ok: boolean, contadores?: Array, error?: Object }>}
       */
      async cargarDisponibles(contadorId) {
        const versionActual = ++versionDisponibles

        this.cargandoDisponibles = true
        this.errorDisponibles = null

        try {
          const disponibles = await servicio.listarDisponibles(contadorId)

          if (versionActual !== versionDisponibles) {
            return { ok: false, descartado: true }
          }

          this.disponibles = disponibles
          this.cargandoDisponibles = false
          return { ok: true, contadores: disponibles }
        } catch (error) {
          if (versionActual !== versionDisponibles) {
            return { ok: false, descartado: true }
          }

          this.errorDisponibles = normalizarError(error, 'la carga de los contadores disponibles')
          this.cargandoDisponibles = false
          return { ok: false, error: this.errorDisponibles }
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

          // Recarga las dos listas para que queden al día
          await Promise.all([
            this.cargarAuxiliares(contadorId),
            this.cargarDisponibles(contadorId),
          ])

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
       * Asigna varios auxiliares de una vez (diálogo «Agregar auxiliares»).
       * Si uno falla, los demás se asignan igual; al final recarga las listas una sola vez.
       * @param {number} contadorId - Id del contador.
       * @param {Array<number>} auxiliaresIds - Ids de los auxiliares marcados.
       * @returns {Promise<{ ok: boolean, asignados: number, fallidos: Array<{ id: number, error: Object }> }>}
       */
      async asignarVarios(contadorId, auxiliaresIds) {
        this.guardando = true
        const fallidos = []

        try {
          for (const auxiliarId of auxiliaresIds) {
            try {
              await servicio.asignarAuxiliar(contadorId, auxiliarId)
            } catch (error) {
              fallidos.push({ id: auxiliarId, error: normalizarErrorDeGuardado(error, 'la asignación del auxiliar') })
            }
          }

          await Promise.all([this.cargarAuxiliares(contadorId), this.cargarDisponibles(contadorId)])
          return { ok: fallidos.length === 0, asignados: auxiliaresIds.length - fallidos.length, fallidos }
        } finally {
          this.guardando = false
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

          // Recarga las dos listas para que queden al día
          await Promise.all([
            this.cargarAuxiliares(contadorId),
            this.cargarDisponibles(contadorId),
          ])

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

      /** Reintenta la carga de las listas del último contador consultado. */
      async reintentar() {
        const contadorId = this._ultimoContadorId ?? 0
        return Promise.all([
          this.cargarAuxiliares(contadorId),
          this.cargarDisponibles(contadorId),
        ])
      },

      /** Limpia todo al cerrar sesión: no quedan datos de otro perfil (RNF-05). */
      reiniciar() {
        version += 1
        versionDisponibles += 1
        this.auxiliares = []
        this.disponibles = []
        this.cargando = false
        this.cargandoDisponibles = false
        this.guardando = false
        this.error = null
        this.errorDisponibles = null
      },
    },
  })
}

/** Store de auxiliares con el servicio real. */
export const useAuxiliaresStore = crearAuxiliaresStore()
