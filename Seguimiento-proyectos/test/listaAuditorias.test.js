// Pruebas de la lógica de la lista de auditorías (UI parte 1): conteo por semáforo,
// búsqueda por cliente o expediente y orden por urgencia.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  contarPorSemaforo,
  filtrarAuditorias,
  ordenarAuditorias,
  destinoVolverFicha,
  entregaEnTiempo,
  plazoDeEvento,
} from '../src/utils/listaAuditorias.js'

const auditoria = (id, extra = {}) => ({
  id,
  cliente: `Cliente ${id}`,
  noExpediente: `EXP-${id}`,
  estado: 'Pendiente',
  semaforo: 'En tiempo',
  diasParaVencer: null,
  ...extra,
})

test('contarPorSemaforo cuenta cada semáforo, con ceros incluidos', () => {
  const lista = [
    auditoria(1, { semaforo: 'Vencido' }),
    auditoria(2, { semaforo: 'Vencido' }),
    auditoria(3, { semaforo: 'Crítico' }),
    auditoria(4, { semaforo: 'Concluida' }),
  ]

  assert.deepEqual(contarPorSemaforo(lista), {
    Vencido: 2,
    Crítico: 1,
    Atención: 0,
    'En tiempo': 0,
    Concluida: 1,
  })
})

test('filtrarAuditorias busca en cliente y expediente sin importar mayúsculas ni acentos', () => {
  const lista = [
    auditoria(1, { cliente: 'Distribuidora Ñandú, S.A.' }),
    auditoria(2, { cliente: 'Comercial Pérez', noExpediente: 'VDM-0045/2026' }),
    auditoria(3, { cliente: 'Otra' }),
  ]

  assert.deepEqual(
    filtrarAuditorias(lista, { texto: 'nandu' }).map((a) => a.id),
    [1],
  )
  assert.deepEqual(
    filtrarAuditorias(lista, { texto: 'PEREZ' }).map((a) => a.id),
    [2],
  )
  assert.deepEqual(
    filtrarAuditorias(lista, { texto: ' vdm-0045 ' }).map((a) => a.id),
    [2],
  )
  assert.equal(filtrarAuditorias(lista, { texto: '' }).length, 3, 'sin texto no filtra')
})

test('filtrarAuditorias combina búsqueda, estado y semáforo', () => {
  const lista = [
    auditoria(1, { estado: 'En Proceso', semaforo: 'Crítico' }),
    auditoria(2, { estado: 'En Proceso', semaforo: 'En tiempo' }),
    auditoria(3, { estado: 'Pendiente', semaforo: 'Crítico' }),
  ]

  assert.deepEqual(
    filtrarAuditorias(lista, { estado: 'En Proceso', semaforo: 'Crítico' }).map((a) => a.id),
    [1],
  )
  assert.equal(filtrarAuditorias(lista, { estado: 'todos', semaforo: 'todos' }).length, 3)
})

test('ordenarAuditorias por urgencia: semáforo y luego los días que faltan', () => {
  const lista = [
    auditoria(1, { semaforo: 'En tiempo' }),
    auditoria(2, { semaforo: 'Crítico', diasParaVencer: 6 }),
    auditoria(3, { semaforo: 'Concluida' }),
    auditoria(4, { semaforo: 'Vencido', diasParaVencer: -1 }),
    auditoria(5, { semaforo: 'Crítico', diasParaVencer: 2 }),
    auditoria(6, { semaforo: 'Atención', diasParaVencer: null }),
    auditoria(7, { semaforo: 'Vencido', diasParaVencer: -9 }),
  ]

  assert.deepEqual(
    ordenarAuditorias(lista, 'urgencia').map((a) => a.id),
    [7, 4, 5, 2, 6, 1, 3],
  )
})

test('ordenarAuditorias por recientes y por cliente, sin modificar la lista original', () => {
  const lista = [
    auditoria(2, { cliente: 'Beta' }),
    auditoria(9, { cliente: 'álamo' }),
    auditoria(5, { cliente: 'Carta' }),
  ]

  assert.deepEqual(
    ordenarAuditorias(lista, 'recientes').map((a) => a.id),
    [9, 5, 2],
  )
  assert.deepEqual(
    ordenarAuditorias(lista, 'cliente').map((a) => a.id),
    [9, 2, 5],
  )
  assert.deepEqual(
    lista.map((a) => a.id),
    [2, 9, 5],
    'la lista recibida no cambia',
  )
})

test('plazoDeEvento: pendiente con fecha límite, sin entrega y sin cerrar', () => {
  const hoy = new Date(2026, 9, 30)
  const evento = (extra) => ({ fechaLimite: '', fechaEntrega: '', estado: 'Pendiente', ...extra })

  assert.deepEqual(plazoDeEvento(evento({ fechaLimite: '02-11-2026' }), hoy), {
    pendiente: true,
    dias: 3,
    semaforo: 'Crítico',
  })
  assert.deepEqual(plazoDeEvento(evento({ fechaLimite: '28-10-2026' }), hoy), {
    pendiente: true,
    dias: -2,
    semaforo: 'Vencido',
  })
  assert.equal(plazoDeEvento(evento({ fechaLimite: '15-11-2026' }), hoy).semaforo, 'Atención')
  assert.equal(plazoDeEvento(evento({ fechaLimite: '30-12-2026' }), hoy).semaforo, 'En tiempo')
  assert.equal(plazoDeEvento(evento({}), hoy).pendiente, false, 'sin fecha límite no hay plazo')
  assert.equal(
    plazoDeEvento(evento({ fechaLimite: '02-11-2026', fechaEntrega: '01-11-2026' }), hoy).pendiente,
    false,
  )
  assert.equal(
    plazoDeEvento(evento({ fechaLimite: '02-11-2026', estado: 'Completado' }), hoy).pendiente,
    false,
  )
  assert.equal(
    plazoDeEvento(evento({ fechaLimite: '02-11-2026', estado: 'Rechazado' }), hoy).pendiente,
    false,
  )
})

test('entregaEnTiempo: Sí, No o — según la fecha límite y la entrega', () => {
  const hoy = new Date(2026, 9, 30)
  const evento = (extra) => ({ fechaLimite: '', fechaEntrega: '', estado: 'Pendiente', ...extra })

  assert.equal(
    entregaEnTiempo(evento({ fechaLimite: '02-11-2026', fechaEntrega: '02-11-2026' }), hoy),
    'Sí',
  )
  assert.equal(
    entregaEnTiempo(evento({ fechaLimite: '02-11-2026', fechaEntrega: '01-11-2026' }), hoy),
    'Sí',
  )
  assert.equal(
    entregaEnTiempo(evento({ fechaLimite: '02-11-2026', fechaEntrega: '03-11-2026' }), hoy),
    'No',
  )
  // Se compara la fecha completa, no solo el día: 01-12 es después de 30-11.
  assert.equal(
    entregaEnTiempo(evento({ fechaLimite: '30-11-2026', fechaEntrega: '01-12-2026' }), hoy),
    'No',
  )
  assert.equal(
    entregaEnTiempo(evento({ fechaLimite: '28-10-2026' }), hoy),
    'No',
    'venció sin entrega',
  )
  assert.equal(entregaEnTiempo(evento({ fechaLimite: '02-11-2026' }), hoy), '—', 'aún en plazo')
  assert.equal(
    entregaEnTiempo(evento({ fechaLimite: '30-10-2026' }), hoy),
    '—',
    'vence hoy: aún en plazo',
  )
  assert.equal(
    entregaEnTiempo(evento({ fechaEntrega: '01-11-2026' }), hoy),
    '—',
    'sin fecha límite',
  )
  assert.equal(
    entregaEnTiempo(evento({ fechaLimite: '28-10-2026', estado: 'Completado' }), hoy),
    '—',
    'cerrado sin fecha de entrega',
  )
})

test('destinoVolverFicha: vuelve al tablero si se llegó desde el dashboard; si no, a la lista', () => {
  const desdeTablero = destinoVolverFicha({
    name: 'admin-dashboard',
    fullPath: '/admin/dashboard?tab=auditorias&vista=kanban',
  })
  assert.deepEqual(desdeTablero, {
    etiqueta: 'Volver al tablero',
    ayuda: 'Regresa al tablero de auditorías del dashboard, en la misma vista.',
    destino: '/admin/dashboard?tab=auditorias&vista=kanban',
  })

  const aLaLista = {
    etiqueta: 'Volver a auditorías',
    ayuda: 'Regresa a la lista de auditorías.',
    destino: { name: 'auditorias' },
  }
  assert.deepEqual(destinoVolverFicha({ name: 'auditorias', fullPath: '/auditorias' }), aLaLista)
  assert.deepEqual(
    destinoVolverFicha(null),
    aLaLista,
    'sin página anterior (enlace directo o recarga)',
  )
})
