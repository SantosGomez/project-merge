// Servicio de casos del contador autenticado (RF-15, RF-18 a RF-22, RF-27 a RF-31, RF-36).
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.
//
// Traducción: las pantallas usan códigos internos (`pendiente`, `alta`, ...) y
// el backend usa `Pendiente`, `Alta`, ... Las funciones de actualización aceptan
// el código interno (contrato del plan) y también la forma del backend, por si
// la pantalla ya tradujo antes de llamar; cualquier otro valor produce un error
// de tres partes sin llegar a enviar la petición.
// Las respuestas se traducen con `casoDeBackend`; si no se pueden traducir, se
// lanza el error de tres partes (valor desconocido = respuesta inesperada).

import {
  ESTADOS_ERROR,
  api as apiPorDefecto,
  crearErrorFrontend,
  crearErrorInesperado,
} from './api.js'
import {
  casoDeBackend,
  estadoABackend,
  estadoDeBackend,
  prioridadABackend,
  prioridadDeBackend,
} from '../utils/traduccionBackend.js'
import { fechaADominioBackend } from '../utils/fechasCaso.js'

// Acepta el código interno y la forma del backend; null si no es válido.
const aFormaBackend = (valor, aBackend, deBackend) => {
  const traducido = aBackend(valor)
  if (traducido !== null) {
    return traducido
  }
  return deBackend(valor) === null ? null : valor
}

const prioridadParaEnviar = (prioridad) =>
  aFormaBackend(prioridad, prioridadABackend, prioridadDeBackend)

const estadoParaEnviar = (estado) => aFormaBackend(estado, estadoABackend, estadoDeBackend)

// Lee el caso de la respuesta o lanza el error de tres partes.
const leerCaso = (datos, sobreQue) => {
  const caso = casoDeBackend(datos && datos.caso)
  if (caso === null) {
    throw crearErrorInesperado(sobreQue)
  }
  return caso
}

const errorDePrioridadInvalida = () =>
  crearErrorFrontend(
    ESTADOS_ERROR.DATOS_INVALIDOS,
    'La prioridad no es válida',
    'la prioridad del caso',
    'Seleccione una prioridad válida: Alta, Media o Baja',
  )

const errorDeEstadoInvalido = () =>
  crearErrorFrontend(
    ESTADOS_ERROR.DATOS_INVALIDOS,
    'El estado no es válido',
    'el estado del caso',
    'Use uno de los siguientes: Pendiente, En proceso, Finalizado',
  )

const errorDeFechaInvalida = () =>
  crearErrorFrontend(
    ESTADOS_ERROR.DATOS_INVALIDOS,
    'La fecha de inicio no es válida',
    'la fecha de inicio del caso',
    'Use una fecha real con formato DD-MM-AAAA',
  )

/**
 * Crea el servicio de casos con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de casos.
 */
export const crearCaseService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  /**
   * GET /casos/mis-casos: casos del contador autenticado, ya traducidos (RF-15, RF-27).
   * @returns {Promise<Array<Object>>}
   */
  const getMisCasos = async () => {
    const { data } = await api.get('/casos/mis-casos')
    const casos = data && data.casos
    if (!Array.isArray(casos)) {
      throw crearErrorInesperado('la lista de casos')
    }
    return casos.map((caso) => {
      const traducido = casoDeBackend(caso)
      if (traducido === null) {
        throw crearErrorInesperado('los casos del contador')
      }
      return traducido
    })
  }

  /**
   * POST /casos: registra un caso con `cliente` y `prioridad` (RF-18 a RF-21).
   * El cliente llega ya recortado desde P-4 (4.5 del plan).
   * @param {string} cliente
   * @param {string} prioridad - código interno (`alta`) o forma del backend (`Alta`).
   * @returns {Promise<Object>} caso registrado con estado `pendiente`.
   */
  const crearCaso = async (cliente, prioridad, fechaInicio, descripcion, observaciones) => {
    const prioridadBackend = prioridadParaEnviar(prioridad)
    if (prioridadBackend === null) {
      throw errorDePrioridadInvalida()
    }

    // Cuerpo base: cliente y prioridad (siempre enviados)
    const cuerpo = { cliente, prioridad: prioridadBackend }

    // Campos opcionales: solo se envían si vienen definidos.
    // La fecha se traduce aquí (único lugar): el formulario usa DD-MM-AAAA y la API AAAA-MM-DD.
    if (fechaInicio !== undefined) {
      const fechaBackend = fechaADominioBackend(fechaInicio)
      if (fechaBackend === null) {
        throw errorDeFechaInvalida()
      }
      cuerpo.fecha_inicio = fechaBackend
    }
    if (descripcion !== undefined) cuerpo.descripcion = descripcion
    if (observaciones !== undefined) cuerpo.observaciones = observaciones

    const { data } = await api.post('/casos', cuerpo)
    return leerCaso(data, 'el caso registrado')
  }

  /**
   * PATCH /casos/:id: edita un caso propio. Solo se envían los campos editables que vengan
   * informados: estado, prioridad, cliente, fecha_inicio (DD-MM-AAAA), descripcion y observaciones.
   * Cualquier otra clave se ignora; si no queda ningún cambio, no se llama al backend.
   * @param {number|string} id - identificador del caso.
   * @param {{ estado?: string, prioridad?: string, cliente?: string, fecha_inicio?: string,
   *   descripcion?: string, observaciones?: string }} cambios
   * @returns {Promise<Object>} caso actualizado, ya traducido.
   */
  const actualizarCaso = async (id, cambios = {}) => {
    const { estado, prioridad, cliente, fecha_inicio: fechaInicio, descripcion, observaciones } = cambios
    const cuerpo = {}

    if (estado !== undefined) {
      const estadoBackend = estadoParaEnviar(estado)
      if (estadoBackend === null) {
        throw errorDeEstadoInvalido()
      }
      cuerpo.estado = estadoBackend
    }

    if (prioridad !== undefined) {
      const prioridadBackend = prioridadParaEnviar(prioridad)
      if (prioridadBackend === null) {
        throw errorDePrioridadInvalida()
      }
      cuerpo.prioridad = prioridadBackend
    }

    if (fechaInicio !== undefined) {
      const fechaBackend = fechaADominioBackend(fechaInicio)
      if (fechaBackend === null) {
        throw errorDeFechaInvalida()
      }
      cuerpo.fecha_inicio = fechaBackend
    }

    if (cliente !== undefined) cuerpo.cliente = cliente
    if (descripcion !== undefined) cuerpo.descripcion = descripcion
    if (observaciones !== undefined) cuerpo.observaciones = observaciones

    if (Object.keys(cuerpo).length === 0) {
      throw crearErrorFrontend(
        ESTADOS_ERROR.DATOS_INVALIDOS,
        'No se indicó qué cambiar del caso',
        'el caso a actualizar',
        'Cambie al menos un dato del caso antes de guardar',
      )
    }

    const { data } = await api.patch(`/casos/${id}`, cuerpo)
    return leerCaso(data, 'el caso actualizado')
  }

  return { getMisCasos, crearCaso, actualizarCaso }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearCaseService()

export const getMisCasos = servicioPorDefecto.getMisCasos
export const crearCaso = servicioPorDefecto.crearCaso
export const actualizarCaso = servicioPorDefecto.actualizarCaso
