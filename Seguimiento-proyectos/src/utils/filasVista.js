// Adaptación de los datos que entregan los servicios a la forma que esperan los
// componentes de vista de la maqueta (RF-11, RF-12, RF-13, RNF-03, RNF-08).
// Los servicios devuelven casos ya traducidos a códigos internos con la forma
// `{ id, cliente, estado, prioridad, contador_id, creado_en, actualizado_en }`
// y contadores con la forma `{ id, nombre }`; `CounterCountsRow.vue` y
// `CasoItem.vue` esperan `{ id, name }` y `{ id, client, status, priority, counterId }`.
// Funciones puras, síncronas, sin Vue y sin efectos secundarios.

import { PROFILES, STATUSES, STATUS_LABELS } from './constants.js'
import { fechaParaFormulario } from './fechasCaso.js'
import { formatearRol } from './formateadores.js'

/** Texto de ayuda de cada conteo: qué está contando (RNF-03). */
export const AYUDA_CONTEO = Object.freeze({
  pendiente: 'Casos importantes de este contador en estado Pendiente: todavía no se han empezado. Tócalo para ver solo esos casos.',
  en_proceso: 'Casos importantes de este contador en estado En proceso: están siendo atendidos. Tócalo para ver solo esos casos.',
  finalizado: 'Casos importantes de este contador en estado Finalizado: ya están terminados. Tócalo para ver solo esos casos.',
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
 * Adapta un caso interno a la fila de `CasoItem.vue`.
 * Solo se copian los campos que el componente muestra: cliente completo, estado, prioridad,
 * fechas de inicio y vencimiento (DD-MM-AAAA), descripción, si es importante y desde cuándo está en proceso.
 * @param {Object} caso - caso interno del servicio.
 * @returns {{ id: number|string|null, client: string, status: string, priority: string, counterId: number|string|null,
 *   startDate: string, dueDate: string, description: string, important: boolean, inProgressSince: string }|null}
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
    startDate: fechaParaFormulario(caso.fecha_inicio),
    dueDate: fechaParaFormulario(caso.fecha_vencimiento),
    description: caso.descripcion ?? '',
    important: Boolean(caso.importante),
    inProgressSince: fechaParaFormulario(caso.en_proceso_en),
  }
}

/**
 * Adapta una lista de casos internos a filas de `CasoItem.vue`, descartando los
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

/**
 * Tarjetas KPI del dashboard a partir del resumen del equipo (`GET /contadores/resumen`).
 * Cada tarjeta trae su número, una línea de desglose y la ayuda del tooltip que explica cómo se cuenta.
 * Un dato que falte cuenta como 0.
 * @param {Object} resumen - `{ pendiente, en_proceso, finalizado, abiertos, vencidos, alta_abiertos }`.
 * @returns {Array<{ clave: string, titulo: string, valor: number, detalle: string, ayuda: string, alerta: boolean }>}
 */
export const tarjetasResumen = (resumen) => {
  const dato = (campo) => Number(resumen?.[campo]) || 0
  const vencidos = dato('vencidos')

  return [
    {
      clave: 'vencidos',
      titulo: 'Vencidos',
      valor: vencidos,
      detalle: 'Sin finalizar y con la fecha de vencimiento ya pasada',
      ayuda:
        'Casos de todo el equipo cuya fecha de vencimiento es anterior a hoy y que todavía no están en estado Finalizado.',
      alerta: vencidos > 0,
    },
    {
      clave: 'abiertos',
      titulo: 'Abiertos',
      valor: dato('abiertos'),
      detalle: `Pendientes: ${dato('pendiente')} · En proceso: ${dato('en_proceso')}`,
      ayuda: 'Casos de todo el equipo que no están finalizados: la suma de los Pendientes y los En proceso.',
      alerta: false,
    },
    {
      clave: 'alta_abiertos',
      titulo: 'Prioridad Alta abierta',
      valor: dato('alta_abiertos'),
      detalle: 'Casos de prioridad Alta sin finalizar',
      ayuda: 'Casos de todo el equipo con prioridad Alta que todavía no están en estado Finalizado.',
      alerta: false,
    },
  ]
}

/** Color de cada estado en la dona del dashboard: ámbar (en espera), azul (en curso) y verde (listo). */
export const COLOR_ESTADO = Object.freeze({
  pendiente: '#b45309',
  en_proceso: '#1f5f99',
  finalizado: '#2f855a',
})

/**
 * Geometría de la dona «Casos por estado» a partir del resumen del equipo.
 * Los arcos van en porcentaje del círculo (el SVG usa `pathLength="100"`) y `desplazamiento`
 * es lo que ya ocupan los estados anteriores. Los porcentajes de la leyenda se redondean por
 * el método del mayor residuo para que siempre sumen 100. Un dato que falte cuenta como 0.
 * @param {Object} resumen - `{ pendiente, en_proceso, finalizado }`.
 * @returns {{ total: number, segmentos: Array<{ clave: string, etiqueta: string, valor: number, arco: number, desplazamiento: number, porcentaje: number, color: string }> }}
 */
export const segmentosDona = (resumen) => {
  const valores = STATUSES.map((clave) => Number(resumen?.[clave]) || 0)
  const total = valores.reduce((suma, valor) => suma + valor, 0)
  const exactos = valores.map((valor) => (total === 0 ? 0 : (valor * 100) / total))

  // Mayor residuo: cada uno recibe su parte entera y los puntos que faltan van a los mayores restos.
  const porcentajes = exactos.map(Math.floor)
  const faltan = total === 0 ? 0 : 100 - porcentajes.reduce((suma, p) => suma + p, 0)
  exactos
    .map((exacto, indice) => ({ indice, resto: exacto - Math.floor(exacto) }))
    .sort((a, b) => b.resto - a.resto)
    .slice(0, faltan)
    .forEach(({ indice }) => {
      porcentajes[indice] += 1
    })

  let acumulado = 0
  const segmentos = STATUSES.map((clave, indice) => {
    const segmento = {
      clave,
      etiqueta: STATUS_LABELS[clave],
      valor: valores[indice],
      arco: exactos[indice],
      desplazamiento: acumulado,
      porcentaje: porcentajes[indice],
      color: COLOR_ESTADO[clave],
    }
    acumulado += exactos[indice]
    return segmento
  })

  return { total, segmentos }
}
