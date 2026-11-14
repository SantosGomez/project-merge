// Store del cronómetro de «Mis actividades» (rebanada 14).
// Comparte el cronómetro en marcha entre la lista del mes, el calendario y el aviso fijo.
//
// El tiempo se calcula con la hora del servidor: cada respuesta trae `ahora`; los segundos al recibirla
// salen de `ahora - inicio` y desde entonces avanzan con el reloj local, que nunca decide la hora de inicio.
// El store no usa temporizadores (los pone `CronometroActivo.vue` con `actualizarReloj`) y no navega.
// Inyección de dependencias: `crearCronometroStore({ tiempoService, reloj })` permite probarlo sin red.

import { defineStore } from 'pinia'

import { ESTADOS_ERROR, crearErrorFrontend } from '../services/api.js'
import {
  detener as detenerServicio,
  iniciar as iniciarServicio,
  obtenerActivo as obtenerActivoServicio,
} from '../services/tiempoService.js'
import { QUE_HACER } from '../utils/mensajes.js'
import { segundosEntre } from '../utils/actividades.js'

const servicioPorDefecto = {
  obtenerActivo: obtenerActivoServicio,
  iniciar: iniciarServicio,
  detener: detenerServicio,
}

/** Más de estas horas en marcha se avisa que quizá se olvidó (36000 s = 10 h). */
const SEGUNDOS_PARA_AVISAR = 10 * 3600

// Si el servicio entrega un error normalizado se conserva; si no, se construye uno de tres partes.
const normalizarError = (error, sobreQue) =>
  error && typeof error.mensaje === 'string'
    ? error
    : crearErrorFrontend(
        ESTADOS_ERROR.RED,
        'No se pudo hablar con el servidor',
        sobreQue,
        QUE_HACER.reintentar,
      )

/**
 * Crea la definición del store del cronómetro con dependencias inyectables.
 * @param {Object} [dependencias] - inyección para pruebas.
 * @param {Object} [dependencias.tiempoService] - servicio de tiempo.
 * @param {Function} [dependencias.reloj] - devuelve los milisegundos actuales del equipo.
 * @returns {Function} hook `useCronometroStore`.
 */
export const crearCronometroStore = (dependencias = {}) => {
  const servicio = dependencias.tiempoService ?? servicioPorDefecto
  const reloj = dependencias.reloj ?? Date.now

  return defineStore('cronometro', {
    state: () => ({
      /** Bloque en marcha (con `cliente`, `tipo`, `mes` e `inicio`), o null. */
      activo: null,
      /** Segundos que llevaba en marcha cuando llegó la respuesta del servidor. */
      segundosBase: 0,
      /** Milisegundos del equipo en que llegó esa respuesta. */
      recibidoEn: 0,
      /** Milisegundos del equipo de la última actualización del reloj. */
      ahoraMs: 0,
      /** Sube cada vez que cambia el tiempo registrado: las listas lo vigilan para releerse. */
      cambios: 0,
    }),

    getters: {
      /** Segundos que lleva en marcha el cronómetro (0 si no hay ninguno). */
      segundos: (state) =>
        state.activo
          ? state.segundosBase + Math.max(0, Math.floor((state.ahoraMs - state.recibidoEn) / 1000))
          : 0,
      /** Si lleva más de 10 horas en marcha. */
      masDeDiezHoras() {
        return this.segundos > SEGUNDOS_PARA_AVISAR
      },
    },

    actions: {
      /** Toma la hora actual del equipo: refresca `segundos` sin pedir nada al servidor. */
      actualizarReloj() {
        this.ahoraMs = reloj()
      },

      // Guarda el bloque en marcha (o null) y fija el punto de partida con la hora del servidor.
      _fijarActivo(activo, ahora) {
        this.activo = activo
        this.segundosBase = activo ? segundosEntre(activo.inicio, ahora) : 0
        this.recibidoEn = reloj()
        this.ahoraMs = this.recibidoEn
      },

      /**
       * Lee del servidor el cronómetro en marcha. Un fallo no borra lo que ya se mostraba.
       * @returns {Promise<{ ok: boolean, error?: Object }>}
       */
      async cargarActivo() {
        try {
          const { activo, ahora } = await servicio.obtenerActivo()
          this._fijarActivo(activo, ahora)
          return { ok: true }
        } catch (error) {
          return { ok: false, error: normalizarError(error, 'tu cronómetro') }
        }
      },

      /**
       * Inicia el cronómetro de un renglón; el servidor detiene el anterior y lo informa.
       * @param {{ cliente_id: number, tipo_id: number, mes: string }} renglon
       * @returns {Promise<{ ok: boolean, detenido?: Object|null, error?: Object }>}
       */
      async iniciar(renglon) {
        try {
          const { activo, detenido, ahora } = await servicio.iniciar(renglon)
          this._fijarActivo(activo, ahora)
          this.cambios += 1
          return { ok: true, detenido }
        } catch (error) {
          return { ok: false, error: normalizarError(error, 'tu cronómetro') }
        }
      },

      /**
       * Detiene el cronómetro en marcha. Si el servidor dice que ya no había ninguno (404), se limpia
       * igual: seguramente se detuvo en otro dispositivo.
       * @returns {Promise<{ ok: boolean, bloque?: Object, error?: Object }>}
       */
      async detener() {
        try {
          const bloque = await servicio.detener()
          this._fijarActivo(null, null)
          this.cambios += 1
          return { ok: true, bloque }
        } catch (error) {
          if (error?.codigoHttp === 404) {
            this._fijarActivo(null, null)
            this.cambios += 1
          }
          return { ok: false, error: normalizarError(error, 'tu cronómetro') }
        }
      },

      /** Avisa a las listas que el tiempo registrado cambió (se agregó o borró un bloque). */
      registrarCambio() {
        this.cambios += 1
      },
    },
  })
}

export const useCronometroStore = crearCronometroStore()
