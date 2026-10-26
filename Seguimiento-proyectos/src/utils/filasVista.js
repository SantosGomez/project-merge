// Adaptación de los datos que entregan los servicios a la forma que esperan los
// componentes de vista de la maqueta (RF-11, RF-12, RF-13, RNF-03, RNF-08).
// Los servicios devuelven casos ya traducidos a códigos internos con la forma
// `{ id, cliente, estado, prioridad, contador_id, creado_en, actualizado_en }`
// y contadores con la forma `{ id, nombre }`; `CounterCountsRow.vue` y
// `CaseRow.vue` esperan `{ id, name }` y `{ id, client, status, priority, counterId }`.
// Funciones puras, síncronas, sin Vue y sin efectos secundarios.

import { PROFILES } from './constants.js'
import { formatearRol } from './formateadores.js'

/** Texto de ayuda de cada conteo: qué está contando (RNF-03). */
export const AYUDA_CONTEO = Object.freeze({
  pendiente: 'Cuenta los casos de este contador en estado Pendiente: todavía no se han empezado.',
  en_proceso: 'Cuenta los casos de este contador en estado En proceso: están siendo atendidos.',
  finalizado: 'Cuenta los casos de este contador en estado Finalizado: ya están terminados.',
})

/**
 * Ayuda contextual de un conteo por estado.
 * Un estado desconocido devuelve `null`: no se inventa una explicación.
 * @param {string} estado - código interno del estado (`pendiente`, `en_proceso`, `finalizado`).
 * @returns {string|null}
 */
export const ayudaConteo = (estado) => AYUDA_CONTEO[estado] ?? null

/**
 * Adapta un contador del backend a la fila de `CounterCountsRow.vue`.
 * El nombre visible es el nombre de la cuenta; nunca se recorta (RNF-08).
 * @param {Object} contador - `{ id, nombre }` de `GET /contadores`.
 * @returns {{ id: number|string, name: string }|null}
 */
export const contadorAFila = (contador) => {
  if (contador === null || typeof contador !== 'object') {
    return null
  }

  return {
    id: contador.id ?? null,
    name: contador.nombre ?? '',
  }
}

/**
 * Adapta una cuenta de `GET /usuarios` a la fila de la tabla del directorio.
 * El rol sale con su nombre legible, el último acceso como llega (hora local) o «Nunca», y solo
 * los contadores tienen casos que ver.
 * @param {Object} usuario - `{ id, nombre, correo, rol, ultimo_acceso_en }` del backend.
 * @returns {{ id: number|string|null, nombre: string, correo: string, rol: string, ultimoAcceso: string, puedeVerCasos: boolean }|null}
 */
export const usuarioAFila = (usuario) => {
  if (usuario === null || typeof usuario !== 'object') {
    return null
  }

  return {
    id: usuario.id ?? null,
    nombre: usuario.nombre ?? '',
    correo: usuario.correo ?? '',
    rol: formatearRol(usuario.rol),
    ultimoAcceso: usuario.ultimo_acceso_en ?? 'Nunca',
    puedeVerCasos: usuario.rol === PROFILES.contador,
  }
}

/**
 * Comparador para ordenar la columna «Último acceso»: las fechas van en orden cronológico
 * (el texto `YYYY-MM-DD HH:mm:ss` ya se ordena bien) y «Nunca» cuenta como el acceso más antiguo.
 * @param {string} a - último acceso de una fila.
 * @param {string} b - último acceso de otra fila.
 * @returns {number} negativo, cero o positivo, como `Array.prototype.sort`.
 */
export const compararUltimoAcceso = (a, b) => {
  const valor = (acceso) => (acceso === 'Nunca' ? '' : acceso)
  return valor(a).localeCompare(valor(b))
}

/**
 * Adapta un caso interno a la fila de `CaseRow.vue`.
 * Solo se copian los campos que el componente muestra: cliente completo, estado y prioridad.
 * @param {Object} caso - caso interno del servicio.
 * @returns {{ id: number|string|null, client: string, status: string, priority: string, counterId: number|string|null }|null}
 */
export const casoAFila = (caso) => {
  if (caso === null || typeof caso !== 'object') {
    return null
  }

  return {
    id: caso.id ?? null,
    client: caso.cliente ?? '',
    status: caso.estado ?? '',
    priority: caso.prioridad ?? '',
    counterId: caso.contador_id ?? null,
  }
}

/**
 * Adapta una lista de casos internos a filas de `CaseRow.vue`, descartando los
 * elementos que no son casos válidos.
 * @param {Array<Object>} [casos] - casos internos del servicio.
 * @returns {Array<Object>}
 */
export const casosAFilas = (casos = []) => {
  if (!Array.isArray(casos)) {
    return []
  }

  return casos.map(casoAFila).filter((fila) => fila !== null)
}
