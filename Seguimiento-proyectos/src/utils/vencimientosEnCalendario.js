// Vencimientos de casos en el calendario de juntas (rebanada 25): qué casos se marcan, cómo se
// nombran, a dónde llevan y cómo se recuerda el interruptor «Mostrar vencimientos de casos».
// Sin Vue y sin Quasar. La fecha de vencimiento es una DATE AAAA-MM-DD: se compara como texto y
// nunca se le pasa a `Date`, porque se leería como UTC y se desplazaría un día.

import { PRIORITY_LABELS } from './constants.js'
import { parsearFechaISO, textoDiaDelMes } from './juntas.js'

const ROLES_CON_VENCIMIENTOS = ['administrador', 'contador', 'auxiliar']

const PREFIJO_CLAVE_MOSTRAR = 'delgrow_juntas_vencimientos_'

/** Solo administrador, contador y auxiliar ven los vencimientos; la recepcionista no. */
export const puedeVerVencimientos = (rol) => ROLES_CON_VENCIMIENTOS.includes(rol)

/**
 * Casos que se marcan en el calendario: los que no están finalizados y tienen una fecha de
 * vencimiento real.
 * @param {Array<Object>|undefined} casos - casos traducidos (`GET /casos/mis-casos` o
 *   `GET /contadores/casos-importantes`).
 * @returns {Array<{ clave: string, casoId: number, cliente: string, prioridad: string, importante: boolean, vence: string }>}
 */
export const vencimientosDeCasos = (casos) =>
  (casos ?? []).flatMap((caso) => {
    const vence =
      typeof caso.fecha_vencimiento === 'string' ? caso.fecha_vencimiento.slice(0, 10) : ''
    if (caso.estado === 'finalizado' || !parsearFechaISO(vence)) return []
    return [
      {
        clave: `vence-${caso.id}`,
        casoId: caso.id,
        cliente: caso.cliente,
        prioridad: caso.prioridad,
        importante: Boolean(caso.importante),
        vence,
      },
    ]
  })

/** Lo que vence ese día, por nombre del cliente. */
export const vencimientosDelDia = (vencimientos, iso) =>
  vencimientos
    .filter((vencimiento) => vencimiento.vence === iso)
    .sort((a, b) => a.cliente.localeCompare(b.cliente, 'es', { sensitivity: 'base' }))

/** Texto visible de la etiqueta: «Vence: {cliente}». */
export const textoDeVencimiento = (vencimiento) => `Vence: ${vencimiento.cliente}`

const etiquetaDePrioridad = (prioridad) => PRIORITY_LABELS[prioridad] ?? prioridad

/** Textos que acompañan a la etiqueta: la prioridad y, si lo es, «Importante». */
export const marcasDeVencimiento = (vencimiento) => [
  etiquetaDePrioridad(vencimiento.prioridad),
  ...(vencimiento.importante ? ['Importante'] : []),
]

/** Nombre accesible de la etiqueta: el día, el cliente, la prioridad y a dónde lleva al activarla. */
export const nombreAccesibleDeVencimiento = (vencimiento, rol) => {
  const destino =
    rol === 'administrador' ? 'Abre ese día en tu resumen.' : 'Abre el caso en «Mis casos».'
  const importante = vencimiento.importante ? ', importante' : ''
  return `Vence el ${textoDiaDelMes(vencimiento.vence)}: ${vencimiento.cliente}, prioridad ${etiquetaDePrioridad(vencimiento.prioridad)}${importante}. ${destino}`
}

/**
 * Ruta a la que lleva el clic: «Mis casos» con `?casoId=` para contador y auxiliar; el resumen del
 * administrador con `?dia=AAAA-MM-DD`. null si el rol no ve vencimientos.
 */
export const destinoDeVencimiento = (vencimiento, rol) => {
  if (rol === 'contador' || rol === 'auxiliar') {
    return { name: 'contador-casos', query: { casoId: String(vencimiento.casoId) } }
  }
  if (rol === 'administrador') {
    return { name: 'admin-dashboard', query: { dia: vencimiento.vence } }
  }
  return null
}

/**
 * localStorage del equipo, o null si el navegador lo bloquea o no existe (Node).
 * @returns {Object|null}
 */
const obtenerAlmacenLocal = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * Indica si el interruptor «Mostrar vencimientos de casos» está encendido para esa persona.
 * Sin preferencia guardada, o si el almacenamiento falla, queda encendido.
 * @param {number|string} usuarioId
 * @param {Object|null} [almacen] - almacén del equipo (inyectable en pruebas).
 * @returns {boolean}
 */
export const leerMostrarVencimientos = (usuarioId, almacen = obtenerAlmacenLocal()) => {
  try {
    return almacen?.getItem(`${PREFIJO_CLAVE_MOSTRAR}${usuarioId}`) !== 'false'
  } catch {
    return true
  }
}

/**
 * Guarda el interruptor de esa persona. Si el almacenamiento está bloqueado no se interrumpe la interfaz.
 * @param {number|string} usuarioId
 * @param {boolean} mostrar
 * @param {Object|null} [almacen] - almacén del equipo (inyectable en pruebas).
 */
export const guardarMostrarVencimientos = (usuarioId, mostrar, almacen = obtenerAlmacenLocal()) => {
  try {
    almacen?.setItem(`${PREFIJO_CLAVE_MOSTRAR}${usuarioId}`, String(mostrar))
  } catch {
    // La preferencia no es crítica: si no se puede guardar, el interruptor sigue encendido.
  }
}
