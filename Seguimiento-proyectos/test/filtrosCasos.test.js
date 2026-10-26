// Pruebas de los filtros, el orden y la paginación de «Mis casos».
// Funciones puras: reciben los casos internos del store (estado `pendiente`, fechas del backend).

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FILTROS_INICIALES,
  esCasoVencido,
  hoyLocal,
  filtrarCasos,
  filtrarContadores,
  paginar,
} from '../src/utils/filtrosCasos.js'

const HOY = '2026-10-26'

const caso = (id, estado, vence, extra = {}) => ({
  id,
  cliente: `Cliente ${id}`,
  estado,
  prioridad: 'media',
  fecha_vencimiento: `${vence} 00:00:00`,
  importante: false,
  ...extra,
})

const CASOS = [
  caso(1, 'pendiente', '2026-11-09'),
  caso(2, 'en_proceso', '2026-10-20', { importante: true }),
  caso(3, 'finalizado', '2026-10-01', { importante: true }),
  caso(4, 'pendiente', '2026-10-25'),
  caso(5, 'en_proceso', '2026-10-26'),
]

const ids = (casos) => casos.map((c) => c.id)

test('al entrar se ven los abiertos, el vencimiento más cercano primero', () => {
  assert.deepEqual(FILTROS_INICIALES, { estado: 'abiertos', soloImportantes: false, soloVencidos: false })
  assert.deepEqual(ids(filtrarCasos(CASOS, FILTROS_INICIALES, HOY)), [2, 4, 5, 1])
})

test('filtra por cada estado y «todos» incluye los finalizados', () => {
  const con = (estado) => ids(filtrarCasos(CASOS, { ...FILTROS_INICIALES, estado }, HOY))
  assert.deepEqual(con('pendiente'), [4, 1])
  assert.deepEqual(con('en_proceso'), [2, 5])
  assert.deepEqual(con('finalizado'), [3])
  assert.deepEqual(con('todos'), [3, 2, 4, 5, 1])
})

test('solo importantes y solo vencidos se combinan con el estado', () => {
  assert.deepEqual(ids(filtrarCasos(CASOS, { estado: 'todos', soloImportantes: true, soloVencidos: false }, HOY)), [3, 2])
  assert.deepEqual(ids(filtrarCasos(CASOS, { estado: 'todos', soloImportantes: false, soloVencidos: true }, HOY)), [2, 4])
  assert.deepEqual(ids(filtrarCasos(CASOS, { estado: 'pendiente', soloImportantes: false, soloVencidos: true }, HOY)), [4])
  assert.deepEqual(ids(filtrarCasos(CASOS, { estado: 'abiertos', soloImportantes: true, soloVencidos: true }, HOY)), [2])
})

test('filtrarCasos no muta el arreglo que recibe', () => {
  const copia = [...CASOS]
  filtrarCasos(CASOS, { ...FILTROS_INICIALES, estado: 'todos' }, HOY)
  assert.deepEqual(CASOS, copia)
})

test('vencido: vence antes de hoy y no está finalizado (hoy todavía no vence)', () => {
  assert.equal(esCasoVencido(caso(1, 'pendiente', '2026-10-25'), HOY), true)
  assert.equal(esCasoVencido(caso(1, 'en_proceso', '2026-10-26'), HOY), false, 'vence hoy: aún no está vencido')
  assert.equal(esCasoVencido(caso(1, 'finalizado', '2026-10-01'), HOY), false, 'un finalizado nunca está vencido')
  assert.equal(esCasoVencido({ id: 1, estado: 'pendiente', fecha_vencimiento: null }, HOY), false, 'sin fecha no está vencido')
})

test('paginar entrega la página pedida y el texto «Mostrando»', () => {
  const lista = Array.from({ length: 24 }, (_, i) => i + 1)

  const segunda = paginar(lista, 2, 10)
  assert.deepEqual(segunda.elementos, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
  assert.equal(segunda.pagina, 2)
  assert.equal(segunda.totalPaginas, 3)
  assert.equal(segunda.texto, 'Mostrando 11–20 de 24 casos')

  assert.equal(paginar(lista, 3, 10).texto, 'Mostrando 21–24 de 24 casos')
  assert.equal(paginar(lista, 1, 50).totalPaginas, 1)
})

test('paginar ajusta una página que ya no existe (p. ej. tras filtrar)', () => {
  const resultado = paginar([1, 2, 3], 4, 10)
  assert.equal(resultado.pagina, 1)
  assert.deepEqual(resultado.elementos, [1, 2, 3])
  assert.equal(resultado.texto, 'Mostrando 1–3 de 3 casos')
})

test('paginar sin casos no muestra páginas', () => {
  const resultado = paginar([], 1, 10)
  assert.deepEqual(resultado.elementos, [])
  assert.equal(resultado.totalPaginas, 0)
  assert.equal(resultado.texto, 'Sin casos con estos filtros')
})

test('hoyLocal da la fecha local AAAA-MM-DD, sin pasar por UTC', () => {
  assert.equal(hoyLocal(new Date(2026, 9, 26, 23, 30)), '2026-10-26', 'de noche no salta al día siguiente')
  assert.equal(hoyLocal(new Date(2027, 0, 5, 0, 5)), '2027-01-05')
})

// --- búsqueda de contadores (dashboard del administrador) --------------------

const CONTADORES = [
  { id: 1, nombre: 'Ana López' },
  { id: 2, nombre: 'Luis Méndez' },
  { id: 3, nombre: 'Sofía Ruiz' },
]

test('filtrarContadores busca por nombre sin importar mayúsculas ni acentos', () => {
  assert.deepEqual(ids(filtrarContadores(CONTADORES, 'lopez')), [1])
  assert.deepEqual(ids(filtrarContadores(CONTADORES, 'SOFIA')), [3])
  assert.deepEqual(ids(filtrarContadores(CONTADORES, 'méndez')), [2])
  assert.deepEqual(ids(filtrarContadores(CONTADORES, 'u')), [2, 3], 'busca en cualquier parte del nombre')
})

test('filtrarContadores sin texto (o solo espacios) devuelve todos y no encuentra lo que no existe', () => {
  assert.deepEqual(ids(filtrarContadores(CONTADORES, '')), [1, 2, 3])
  assert.deepEqual(ids(filtrarContadores(CONTADORES, '   ')), [1, 2, 3])
  assert.deepEqual(ids(filtrarContadores(CONTADORES, null)), [1, 2, 3])
  assert.deepEqual(filtrarContadores(CONTADORES, 'pedro'), [])
})
