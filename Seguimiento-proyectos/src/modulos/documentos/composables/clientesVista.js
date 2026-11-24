// Cómo se muestran y se buscan los clientes en los formularios.
//
// La clave (`0001`…) es la de la carpeta del cliente en `##RECEPCION DE
// PAPELERIA_CLIENTES`; va delante de la razón social porque es como el personal
// identifica cada carpeta. El RFC es opcional desde la migración 004.
//
// La normalización es la misma que usa el servidor al buscar clientes: un solo
// módulo para los dos lados (sin imports, se puede cargar en el navegador).

import { normalizarParaBuscar, normalizarRfc } from '../logica/normalizar.js'

/**
 * Opciones de `q-select` (`{ value, label }`, con `emit-value` y `map-options`),
 * ordenadas por clave; los clientes sin clave van al final, por razón social.
 */
export const opcionesDeClientes = (clientes) =>
  [...(clientes ?? [])]
    .sort((a, b) => {
      if (a.clave && b.clave) return a.clave.localeCompare(b.clave)
      if (a.clave) return -1
      if (b.clave) return 1
      return a.razonSocial.localeCompare(b.razonSocial, 'es')
    })
    .map((c) => ({
      value: c.id,
      label: c.clave ? `${c.clave} · ${c.razonSocial}` : c.razonSocial,
      clave: c.clave ?? null,
      razonSocial: c.razonSocial,
      rfc: c.rfc ?? null,
    }))

/** Filtra las opciones por clave, razón social o RFC. Sin término, las devuelve todas. */
export const filtrarOpcionesClientes = (opciones, termino) => {
  const buscado = normalizarParaBuscar(termino)
  if (!buscado) return opciones
  const rfcBuscado = normalizarRfc(termino)
  return opciones.filter(
    (o) =>
      normalizarParaBuscar(o.label).includes(buscado) ||
      (rfcBuscado.length > 0 && normalizarRfc(o.rfc).includes(rfcBuscado)),
  )
}

/** Tarjetas por página en el selector de cliente: la cuadrícula de 4 × 5 en escritorio. */
export const CLIENTES_POR_PAGINA = 20

/**
 * La página pedida de la lista. Una página fuera de rango se lleva a la más
 * cercana que existe (al buscar, la lista se encoge y la página en curso puede
 * dejar de existir). Sin elementos sigue habiendo una página, vacía.
 */
export const paginarClientes = (opciones, pagina) => {
  const totalPaginas = Math.max(1, Math.ceil(opciones.length / CLIENTES_POR_PAGINA))
  const pedida = Number.isInteger(pagina) ? pagina : 1
  const actual = Math.min(Math.max(pedida, 1), totalPaginas)
  const inicio = (actual - 1) * CLIENTES_POR_PAGINA
  return {
    pagina: actual,
    totalPaginas,
    elementos: opciones.slice(inicio, inicio + CLIENTES_POR_PAGINA),
  }
}

/** El RFC para mostrarlo en pantalla: si falta, lo dice en vez de pintar «null». */
export const textoRfc = (rfc) => (rfc ? rfc : 'Sin registrar')
