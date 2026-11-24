// La regla del semáforo (tarea T8 de la especificación 002, RF-8.2 y RF-8.3).
//
// Es LA REGLA DE NEGOCIO MÁS IMPORTANTE DEL PROYECTO: de ella sale el color de
// cada fila del directorio, así que vive en el servidor y no en la vista
// (principio 3). El navegador solo pinta el color que le llega ya calculado.
//
// ⚠️ EL ORDEN ES LA REGLA, no un detalle de redacción. Se evalúa paso a paso y
// se sale EN CUANTO uno se cumple:
//
//   0. ÁMBAR  · el guardián: algún estado no es de los cinco conocidos.
//   1. ROJO   · hay un cancelado, o hay uno SIN COMPLETAR con la fecha límite ya
//               pasada.
//   2. ÁMBAR  · hay alguno recibido, en proceso o pendiente con el cliente.
//   3. VERDE  · hay al menos uno y no se cumplió ninguno de los dos anteriores.
//   4. NEUTRO · no hay ningún documento en el periodo.
//
// POR QUÉ EL ROJO VA PRIMERO: es el único paso que avisa de algo que se está
// perdiendo, y tiene que ganarle a la lectura de "los demás están bien". Si el
// verde se evaluara antes, un cancelado junto a documentos completados caería en
// el paso 3 y el cliente aparecería al día teniendo un trámite cancelado; y si
// el ámbar se evaluara antes, un documento vencido saldría en ámbar, que es el
// color de "en proceso" y no el de "se pasó el plazo".
//
// Y POR QUÉ EL GUARDIÁN VA ANTES QUE TODO: falla hacia el lado seguro. Un estado
// que no es ninguno de los cinco no se cuenta como completado ni como activo, así
// que sin el paso 0 un dato raro dejaría al cliente en verde sin que nadie viera
// nada raro. Aquí sale en ámbar, que es el color de "esto hay que revisarlo".
//
// DOS COSAS QUE NO SON DE ESTE MÓDULO:
//
//   · `documentos` YA VIENE FILTRADO por periodo: lo hace la consulta de
//     `rutas/clientes.js`, con `documentos.periodo = periodo`. Aquí no se filtra
//     nada, porque el mismo semáforo tiene que valer para cualquier periodo que
//     el usuario elija.
//   · `documento.fechaLimite` es `documentos.fecha_limite_sla`, que CALCULÓ EL
//     CLIENTE y el servidor guardó sin recalcular (RNF-8). Es la desviación
//     declarada de §7, decisión 8 del plan: el semáforo es la regla del servidor
//     aplicada sobre un dato del cliente.
//
// El reloj es el del SERVIDOR, nunca el del navegador: por eso el día entra por
// parámetro. Ninguna función de aquí llama a `new Date()` sin argumentos.

import { aFechaLocal, aMedianoche } from './fechas.mjs'

/** Los cinco valores del ENUM `documentos.estado`. */
const ESTADOS_CONOCIDOS = [
  'RECEPCIONADO',
  'EN_PROCESO',
  'PENDIENTE_CLIENTE',
  'COMPLETADO',
  'CANCELADO'
]

/** Los tres estados de un documento que sigue vivo: dan ÁMBAR mientras dure. */
const ESTADOS_ACTIVOS = ['RECEPCIONADO', 'EN_PROCESO', 'PENDIENTE_CLIENTE']

/**
 * El semáforo de un cliente en el periodo consultado.
 *
 * Devuelve el estado como texto, con mayúscula y acento, porque es el mismo texto
 * que pinta la vista: `'ROJO'`, `'ÁMBAR'`, `'VERDE'` o `'NEUTRO'`. Aquí no se
 * decide ningún color; el color es del cliente (`semaforoVista.js`).
 *
 * ⚠️ Una `fechaLimite` ilegible NO pone a nadie en rojo. `aFechaLocal` devuelve
 * una fecha inválida en vez de inventar una, y una fecha inválida comparada con
 * otra da `false` en todas las comparaciones: es el fallo hacia el lado
 * contrario, y por eso es cosa de quien trae los datos revisarlo, no de esta
 * regla inventar una alerta.
 *
 * @param {Array<{estado: string, fechaLimite?: Date | string | null}>} documentos
 *   Los documentos del cliente YA filtrados por periodo.
 * @param {Date | string} hoy El día en el servidor, con o sin hora.
 * @returns {'ROJO' | 'ÁMBAR' | 'VERDE' | 'NEUTRO'} El semáforo del cliente.
 */
export const semaforoDe = (documentos, hoy) => {
  // El día se baja a medianoche UNA vez, aquí. A partir de ahí se comparan días
  // y no momentos: si no, las 01:00 de la fecha límite se leerían como un día
  // anterior al de hoy y un documento se pondría en rojo el mismo día del plazo.
  const hoyDe = aMedianoche(aFechaLocal(hoy))

  // 0. EL GUARDIÓN. Un estado que no es de los cinco no se perdona: ni como
  //    completado ni como activo. Falla hacia el lado seguro.
  for (const documento of documentos) {
    if (!ESTADOS_CONOCIDOS.includes(documento?.estado)) return 'ÁMBAR'
  }

  // 1. ROJO. Se evalúa primero y sale en cuanto se cumple. Son dos puertas, y
  //    basta con que se abra una: un cancelado, o un plazo vencido sin completar.
  for (const documento of documentos) {
    if (documento.estado === 'CANCELADO') return 'ROJO'

    if (documento.estado !== 'COMPLETADO' && documento.fechaLimite != null) {
      const limite = aMedianoche(aFechaLocal(documento.fechaLimite))
      if (limite < hoyDe) return 'ROJO'
    }
  }

  // 2. ÁMBAR. Solo se llega aquí si no era rojo: hay un documento vivo.
  for (const documento of documentos) {
    if (ESTADOS_ACTIVOS.includes(documento.estado)) return 'ÁMBAR'
  }

  // 3. VERDE. Solo si no era ni rojo ni ámbar, y hay al menos un documento. El
  //    `length` es lo que separa el verde del neutro: una lista vacía no está
  //    "al día", no tiene nada que mostrar.
  if (documentos.length > 0) return 'VERDE'

  // 4. NEUTRO.
  return 'NEUTRO'
}
