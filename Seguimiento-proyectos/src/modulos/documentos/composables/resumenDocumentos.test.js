// Pruebas del resumen que pintan las cuatro tarjetas del Dashboard (resumenDocumentos.js).
// Se ejecutan con `node --test` desde `Frontend/`, sin dependencias: el módulo
// es JavaScript puro y recibe "hoy" por parámetro.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { resumirDocumentos, coincideConTarjeta, textoDelPlazo } from './resumenDocumentos.js'

const HOY = new Date(2026, 9, 15, 10, 0, 0) // 15 de octubre de 2026, hora local

/** Documento con la forma de GET /documentos; solo importan estado y fecha límite. */
const doc = (estado, fechaLimite = null) => ({ estado, fechaLimite })

test('cuenta el total, los que están en trámite y los completados', () => {
  const documentos = [
    doc('RECEPCIONADO'),
    doc('EN_PROCESO'),
    doc('PENDIENTE_CLIENTE'),
    doc('COMPLETADO'),
    doc('COMPLETADO'),
    doc('CANCELADO'),
  ]

  // Los cancelados solo cuentan en el total.
  assert.deepEqual(resumirDocumentos(documentos, HOY), {
    total: 6,
    enTramite: 3,
    vencidos: 0,
    completados: 2,
  })
})

// Se compara por DÍA, como el semáforo: la fecha límite de hoy todavía está en
// plazo aunque su hora ya haya pasado. Un vencido sale de «en trámite».
test('vencidos: en trámite con la fecha límite de un día anterior a hoy', () => {
  const documentos = [
    doc('EN_PROCESO', '2026-10-14T18:00:00'), // ayer: vencido
    doc('PENDIENTE_CLIENTE', '2026-09-30T09:00:00'), // el mes pasado: vencido
    doc('RECEPCIONADO', '2026-10-15T08:00:00'), // hoy, hora ya pasada: en plazo
    doc('RECEPCIONADO', '2026-10-20T12:00:00'), // futuro: en plazo
    doc('RECEPCIONADO', null), // sin fecha límite: en plazo
    doc('COMPLETADO', '2026-10-01T12:00:00'), // terminado: nunca vencido
    doc('CANCELADO', '2026-10-01T12:00:00'), // cancelado: nunca vencido
  ]

  assert.deepEqual(resumirDocumentos(documentos, HOY), {
    total: 7,
    enTramite: 3,
    vencidos: 2,
    completados: 1,
  })
})

test('sin documentos, las cuatro cifras son cero', () => {
  assert.deepEqual(resumirDocumentos([], HOY), {
    total: 0,
    enTramite: 0,
    vencidos: 0,
    completados: 0,
  })
})

// --- Lo pendiente de meses anteriores (2026-11-04) ---------------------------
// GET /documentos trae lo recibido en el mes elegido MÁS lo que sigue en trámite
// de meses anteriores (2026-11-25: el mes se decide por la fecha de recepción,
// no por el periodo contable). Las tarjetas «Recibidos» y «Completados» son del
// mes de recepción; «En trámite» y «Vencidos» cuentan todo lo vivo.

/**
 * Documento recibido en `mes` (`AAAA-MM`). `fechaRecepcion` llega local sin Z.
 * El periodo contable es otro a propósito: no debe influir.
 */
const docDe = (mes, estado, fechaLimite = null) => ({
  fechaRecepcion: `${mes}-10T09:00:00`,
  periodo: '2026-01',
  estado,
  fechaLimite,
})

test('con periodo: recibidos y completados son del mes; en trámite y vencidos, de todo lo vivo', () => {
  const documentos = [
    docDe('2026-10', 'RECEPCIONADO', '2026-10-20T12:00:00'), // del mes, en plazo
    docDe('2026-10', 'COMPLETADO', '2026-10-01T12:00:00'), // del mes, terminado
    docDe('2026-09', 'EN_PROCESO', '2026-09-30T12:00:00'), // arrastrado y vencido
    docDe('2026-09', 'PENDIENTE_CLIENTE', '2026-10-25T12:00:00'), // arrastrado, en plazo
  ]

  assert.deepEqual(resumirDocumentos(documentos, HOY, '2026-10'), {
    total: 2,
    enTramite: 2,
    vencidos: 1,
    completados: 1,
  })
})

test('cada tarjeta filtra exactamente los documentos que cuenta', () => {
  const documentos = [
    docDe('2026-10', 'RECEPCIONADO', '2026-10-20T12:00:00'),
    docDe('2026-10', 'COMPLETADO'),
    docDe('2026-10', 'CANCELADO'),
    docDe('2026-09', 'EN_PROCESO', '2026-09-30T12:00:00'),
    docDe('2026-09', 'PENDIENTE_CLIENTE', '2026-10-25T12:00:00'),
  ]
  const resumen = resumirDocumentos(documentos, HOY, '2026-10')
  const cuantos = (tarjeta) =>
    documentos.filter((d) => coincideConTarjeta(d, tarjeta, HOY, '2026-10')).length

  assert.equal(cuantos('recibidos'), resumen.total)
  assert.equal(cuantos('enTramite'), resumen.enTramite)
  assert.equal(cuantos('vencidos'), resumen.vencidos)
  assert.equal(cuantos('completados'), resumen.completados)
})

test('un completado recibido en el mes con otro periodo contable cuenta y sale al pulsar «Completados»', () => {
  // Caso real: recibido en noviembre con periodo contable 2026-01
  const completado = {
    fechaRecepcion: '2026-11-25T09:00:00',
    periodo: '2026-01',
    estado: 'COMPLETADO',
    fechaLimite: null,
  }
  const hoy = new Date(2026, 10, 25, 10, 0, 0)

  assert.equal(coincideConTarjeta(completado, 'completados', hoy, '2026-11'), true)
  assert.equal(coincideConTarjeta(completado, 'recibidos', hoy, '2026-11'), true)
  assert.equal(resumirDocumentos([completado], hoy, '2026-11').completados, 1)
})

test('un completado recibido en otro mes no cuenta aunque su periodo contable sea el elegido', () => {
  const completado = {
    fechaRecepcion: '2026-10-31T23:59:59',
    periodo: '2026-11',
    estado: 'COMPLETADO',
    fechaLimite: null,
  }
  const hoy = new Date(2026, 10, 25, 10, 0, 0)

  assert.equal(coincideConTarjeta(completado, 'completados', hoy, '2026-11'), false)
  assert.equal(coincideConTarjeta(completado, 'recibidos', hoy, '2026-11'), false)
})

test('sin tarjeta elegida no se filtra nada', () => {
  assert.equal(coincideConTarjeta(docDe('2026-09', 'COMPLETADO'), null, HOY, '2026-10'), true)
})

describe('textoDelPlazo', () => {
  test('cuenta los días por fecha, no por horas', () => {
    assert.equal(textoDelPlazo(doc('EN_PROCESO', '2026-10-14T23:00:00'), HOY), 'Venció hace 1 día')
    assert.equal(textoDelPlazo(doc('EN_PROCESO', '2026-10-07T12:00:00'), HOY), 'Venció hace 8 días')
    assert.equal(textoDelPlazo(doc('RECEPCIONADO', '2026-10-15T08:00:00'), HOY), 'Vence hoy')
    assert.equal(textoDelPlazo(doc('RECEPCIONADO', '2026-10-16T08:00:00'), HOY), 'Vence mañana')
    assert.equal(textoDelPlazo(doc('RECEPCIONADO', '2026-10-20T12:00:00'), HOY), 'Faltan 5 días')
  })

  test('cruza el fin de mes sin perder días', () => {
    assert.equal(
      textoDelPlazo(doc('EN_PROCESO', '2026-09-30T12:00:00'), HOY),
      'Venció hace 15 días',
    )
  })

  test('lo terminado o cancelado no tiene plazo que contar', () => {
    assert.equal(textoDelPlazo(doc('COMPLETADO', '2026-10-01T12:00:00'), HOY), '')
    assert.equal(textoDelPlazo(doc('CANCELADO', '2026-10-01T12:00:00'), HOY), '')
  })

  test('sin fecha límite lo dice', () => {
    assert.equal(textoDelPlazo(doc('RECEPCIONADO', null), HOY), 'Sin fecha límite')
  })
})
