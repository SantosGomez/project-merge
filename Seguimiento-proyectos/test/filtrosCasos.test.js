// Pruebas de los filtros, el orden y la paginación de «Mis casos».
// Funciones puras: reciben los casos internos del store (estado `pendiente`, fechas del backend).

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  FILTROS_INICIALES,
  esCasoVencido,
  esCasoProximoAVencer,
  esCasoSinMovimiento,
  diasParaVencerCaso,
  agendaCasos,
  accionRapidaEstado,
  hoyLocal,
  filtrarCasos,
  filtrosDesdeConsulta,
  filtrarContadores,
  contadoresPorKpi,
  textoCifraKpi,
  filtrarUsuarios,
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
  assert.deepEqual(FILTROS_INICIALES, {
    estado: 'abiertos',
    soloImportantes: false,
    soloVencidos: false,
    soloAlta: false,
    soloProximos: false,
    soloSinMovimiento: false,
  })
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

test('solo prioridad Alta se combina con el estado y con vencidos', () => {
  const casos = [
    caso(1, 'pendiente', '2026-11-09', { prioridad: 'alta' }),
    caso(2, 'en_proceso', '2026-10-20', { prioridad: 'alta' }),
    caso(3, 'finalizado', '2026-10-01', { prioridad: 'alta' }),
    caso(4, 'pendiente', '2026-10-25'),
  ]
  const con = (cambio) => ids(filtrarCasos(casos, { ...FILTROS_INICIALES, ...cambio }, HOY))

  assert.deepEqual(con({ soloAlta: true }), [2, 1])
  assert.deepEqual(con({ soloAlta: true, estado: 'todos' }), [3, 2, 1])
  assert.deepEqual(con({ soloAlta: true, soloVencidos: true }), [2])
  assert.deepEqual(con({ soloAlta: false }), [2, 4, 1])
})

test('próximo a vencer: sin finalizar, sin vencer y vence de hoy a 3 días', () => {
  const proximo = (estado, vence, hoy = HOY) => esCasoProximoAVencer(caso(1, estado, vence), hoy)

  assert.equal(proximo('pendiente', '2026-10-26'), true, 'vence hoy')
  assert.equal(proximo('en_proceso', '2026-10-29'), true, 'vence en 3 días')
  assert.equal(proximo('pendiente', '2026-10-30'), false, 'vence en 4 días')
  assert.equal(proximo('pendiente', '2026-10-25'), false, 'ya venció: cuenta como vencido')
  assert.equal(proximo('finalizado', '2026-10-27'), false, 'finalizado')
  assert.equal(esCasoProximoAVencer({ estado: 'pendiente', fecha_vencimiento: null }, HOY), false)
  assert.equal(proximo('pendiente', '2027-01-02', '2026-12-30'), true, 'cruza de año')
  assert.equal(proximo('pendiente', '2026-03-02', '2026-02-27'), true, 'cruza de febrero')
})

test('solo próximos a vencer se combina con el estado', () => {
  const casos = [
    caso(1, 'pendiente', '2026-10-28'),
    caso(2, 'en_proceso', '2026-10-26'),
    caso(3, 'finalizado', '2026-10-27'),
    caso(4, 'pendiente', '2026-11-30'),
    caso(5, 'pendiente', '2026-10-20'),
  ]
  const con = (cambio) => ids(filtrarCasos(casos, { ...FILTROS_INICIALES, ...cambio }, HOY))

  assert.deepEqual(con({ soloProximos: true }), [2, 1])
  assert.deepEqual(con({ soloProximos: true, estado: 'pendiente' }), [1])
})

test('un caso abierto está sin movimiento si su último cambio fue hace 7 días o más', () => {
  const sinMovimiento = (estado, actualizado, hoy = HOY) =>
    esCasoSinMovimiento(caso(1, estado, '2026-12-01', { actualizado_en: actualizado }), hoy)

  assert.equal(sinMovimiento('pendiente', '2026-10-19 10:00:00'), true, 'hace 7 días')
  assert.equal(sinMovimiento('en_proceso', '2026-09-30 08:00:00'), true, 'hace casi un mes')
  assert.equal(sinMovimiento('pendiente', '2026-10-20 23:59:59'), false, 'hace 6 días')
  assert.equal(sinMovimiento('pendiente', '2026-10-26 09:00:00'), false, 'hoy')
  assert.equal(sinMovimiento('finalizado', '2026-09-01 08:00:00'), false, 'los finalizados no cuentan')
  assert.equal(sinMovimiento('pendiente', null), false, 'sin fecha de cambio')
  assert.equal(sinMovimiento('pendiente', '2026-10-25 12:00:00', '2026-11-01'), true, 'cruza de mes')
  assert.equal(sinMovimiento('pendiente', '2026-10-26 12:00:00', '2026-11-01'), false, 'cruza de mes, 6 días')
})

test('solo sin movimiento se combina con el estado', () => {
  const casos = [
    caso(1, 'pendiente', '2026-11-10', { actualizado_en: '2026-10-01 09:00:00' }),
    caso(2, 'en_proceso', '2026-11-05', { actualizado_en: '2026-10-10 09:00:00' }),
    caso(3, 'finalizado', '2026-11-01', { actualizado_en: '2026-10-01 09:00:00' }),
    caso(4, 'pendiente', '2026-11-02', { actualizado_en: '2026-10-25 09:00:00' }),
  ]
  const con = (cambio) => ids(filtrarCasos(casos, { ...FILTROS_INICIALES, ...cambio }, HOY))

  assert.deepEqual(con({ soloSinMovimiento: true }), [2, 1])
  assert.deepEqual(con({ soloSinMovimiento: true, estado: 'pendiente' }), [1])
})

test('diasParaVencerCaso cuenta los días de hoy al vencimiento, en hora local', () => {
  assert.equal(diasParaVencerCaso(caso(1, 'pendiente', '2026-10-26'), HOY), 0)
  assert.equal(diasParaVencerCaso(caso(1, 'pendiente', '2026-10-29'), HOY), 3)
  assert.equal(diasParaVencerCaso(caso(1, 'pendiente', '2026-10-20'), HOY), -6)
  assert.equal(diasParaVencerCaso(caso(1, 'pendiente', '2026-11-02'), HOY), 7, 'cruza de mes')
  assert.equal(diasParaVencerCaso(caso(1, 'pendiente', '2026-11-02'), '2026-10-31'), 2, 'sin desfase por horario de verano')
  assert.equal(diasParaVencerCaso({ estado: 'pendiente', fecha_vencimiento: null }, HOY), null)
})

test('agendaCasos: los abiertos que vencen antes, vencidos primero, hasta el límite', () => {
  const casos = [
    caso(1, 'pendiente', '2026-11-20'),
    caso(2, 'finalizado', '2026-10-01'),
    caso(3, 'en_proceso', '2026-10-27'),
    caso(4, 'pendiente', '2026-10-10'),
    caso(5, 'pendiente', '2026-12-01'),
    caso(6, 'en_proceso', '2026-10-26'),
    caso(7, 'pendiente', '2026-11-01'),
  ]

  assert.deepEqual(ids(agendaCasos(casos, HOY)), [4, 6, 3, 7, 1], 'cinco por defecto, sin finalizados')
  assert.deepEqual(ids(agendaCasos(casos, HOY, 2)), [4, 6])
  assert.deepEqual(agendaCasos([], HOY), [])
})

test('accionRapidaEstado: Pendiente pasa a En proceso, En proceso a Finalizado y Finalizado no tiene acción', () => {
  assert.deepEqual(
    [accionRapidaEstado('pendiente').estado, accionRapidaEstado('pendiente').etiqueta],
    ['en_proceso', 'Empezar'],
  )
  assert.deepEqual(
    [accionRapidaEstado('en_proceso').estado, accionRapidaEstado('en_proceso').etiqueta],
    ['finalizado', 'Finalizar'],
  )
  assert.match(accionRapidaEstado('pendiente').ayuda, /En proceso/)
  assert.match(accionRapidaEstado('en_proceso').ayuda, /Finalizado/)
  assert.equal(accionRapidaEstado('finalizado'), null)
  assert.equal(accionRapidaEstado('otro'), null)
})

test('filtrosDesdeConsulta abre «Mis casos» con el filtro de cada tarjeta o estado de «Mi resumen»', () => {
  const con = (cambio) => ({ ...FILTROS_INICIALES, ...cambio })

  assert.deepEqual(filtrosDesdeConsulta('vencidos'), con({ soloVencidos: true }))
  assert.deepEqual(filtrosDesdeConsulta('abiertos'), con({}))
  assert.deepEqual(filtrosDesdeConsulta('alta_abiertos'), con({ soloAlta: true }))
  assert.deepEqual(filtrosDesdeConsulta('proximosAVencer'), con({ soloProximos: true }))
  assert.deepEqual(filtrosDesdeConsulta('sinMovimiento'), con({ soloSinMovimiento: true }))
  assert.deepEqual(filtrosDesdeConsulta('pendiente'), con({ estado: 'pendiente' }))
  assert.deepEqual(filtrosDesdeConsulta('en_proceso'), con({ estado: 'en_proceso' }))
  assert.deepEqual(filtrosDesdeConsulta('finalizado'), con({ estado: 'finalizado' }))
})

test('filtrosDesdeConsulta sin filtro o con uno desconocido usa los filtros de siempre', () => {
  for (const filtro of [undefined, null, '', 'todos', 'otro', ['vencidos']]) {
    assert.deepEqual(filtrosDesdeConsulta(filtro), FILTROS_INICIALES)
  }
  assert.notEqual(filtrosDesdeConsulta('x'), FILTROS_INICIALES, 'entrega una copia que la página puede cambiar')
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

test('contadoresPorKpi deja solo a quien tiene casos de esa tarjeta, de más a menos y luego por nombre', () => {
  const contadores = [
    { id: 1, nombre: 'Zoe' },
    { id: 2, nombre: 'Ana' },
    { id: 3, nombre: 'Beto' },
    { id: 4, nombre: 'Carla' },
  ]
  const porContador = {
    1: { vencidos: 2, pendiente: 0 },
    2: { vencidos: 2, pendiente: 1 },
    3: { vencidos: 5, pendiente: 0 },
  }

  assert.deepEqual(
    contadoresPorKpi(contadores, porContador, 'vencidos').map((c) => c.nombre),
    ['Beto', 'Ana', 'Zoe'],
    'Carla no está en el resumen y cuenta como 0',
  )
  assert.deepEqual(contadoresPorKpi(contadores, porContador, 'pendiente').map((c) => c.nombre), ['Ana'])
})

test('contadoresPorKpi sin filtro devuelve la misma lista sin tocarla', () => {
  const contadores = [{ id: 2, nombre: 'Beto' }, { id: 1, nombre: 'Ana' }]
  assert.equal(contadoresPorKpi(contadores, {}, null), contadores)
  assert.deepEqual(contadoresPorKpi(contadores, undefined, 'vencidos'), [])
})

test('textoCifraKpi dice la cifra de cada tarjeta en singular o plural', () => {
  assert.equal(textoCifraKpi('vencidos', 1), '1 vencido')
  assert.equal(textoCifraKpi('vencidos', 3), '3 vencidos')
  assert.equal(textoCifraKpi('abiertos', 2), '2 abiertos')
  assert.equal(textoCifraKpi('alta_abiertos', 1), '1 de prioridad Alta')
  assert.equal(textoCifraKpi('pendiente', 4), '4 pendientes')
  assert.equal(textoCifraKpi('en_proceso', 1), '1 en proceso')
  assert.equal(textoCifraKpi('finalizado', 1), '1 finalizado')
})

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

// --- filtrarUsuarios (directorio de usuarios) ------------------------------

const USUARIOS = [
  { id: 1, nombre: 'Ana Karen Ramírez', correo: 'kramirez@delgrow.mx', rolClave: 'administrador' },
  { id: 2, nombre: 'Luis Méndez', correo: 'lmendez@delgrow.mx', rolClave: 'contador' },
  { id: 3, nombre: 'Sofía Ortiz', correo: 'sortiz@delgrow.mx', rolClave: 'contador' },
  { id: 4, nombre: 'Sistemas', correo: 'soporte@delgrow.mx', rolClave: 'usuarios_de_sistema' },
]

test('filtrarUsuarios busca en nombre y correo sin importar mayúsculas ni acentos', () => {
  assert.deepEqual(ids(filtrarUsuarios(USUARIOS, { texto: 'ramirez', rol: null })), [1])
  assert.deepEqual(ids(filtrarUsuarios(USUARIOS, { texto: 'MÉNDEZ', rol: null })), [2])
  assert.deepEqual(ids(filtrarUsuarios(USUARIOS, { texto: 'soporte@', rol: null })), [4], 'busca en el correo')
  assert.deepEqual(ids(filtrarUsuarios(USUARIOS, { texto: '  sofia  ', rol: null })), [3], 'ignora espacios extremos')
})

test('filtrarUsuarios filtra por rol y combina el rol con el texto', () => {
  assert.deepEqual(ids(filtrarUsuarios(USUARIOS, { texto: '', rol: 'contador' })), [2, 3])
  assert.deepEqual(ids(filtrarUsuarios(USUARIOS, { texto: 'sofia', rol: 'contador' })), [3])
  assert.deepEqual(ids(filtrarUsuarios(USUARIOS, { texto: 'sofia', rol: 'administrador' })), [])
})

test('filtrarUsuarios sin filtros devuelve todos en el mismo orden y no modifica la lista', () => {
  const copia = USUARIOS.map((usuario) => ({ ...usuario }))
  const resultado = filtrarUsuarios(USUARIOS, { texto: null, rol: null })
  assert.deepEqual(ids(resultado), [1, 2, 3, 4])
  assert.notEqual(resultado, USUARIOS, 'arreglo nuevo')
  assert.deepEqual(USUARIOS, copia)
})
