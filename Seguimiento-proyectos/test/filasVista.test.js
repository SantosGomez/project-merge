// Pruebas de las adaptaciones de datos para las vistas (RF-11, RF-12, RF-13, RNF-03).
// Funciones puras: los servicios entregan la forma del backend traducida a códigos
// internos y los componentes de la maqueta esperan otra forma; aquí se comprueba el puente.

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AYUDA_CONTEO,
  ayudaConteo,
  casoAFila,
  casosAFilas,
  contadorAFila,
  usuarioAFila,
  compararUltimoAcceso,
  tarjetasResumen,
  segmentosDona,
} from '../src/utils/filasVista.js'
import { STATUSES } from '../src/utils/constants.js'

test('contadorAFila usa el nombre del backend como nombre visible (RF-11)', () => {
  assert.deepEqual(contadorAFila({ id: 3, nombre: 'ana' }), { id: 3, name: 'ana' })
})

test('contadorAFila conserva el nombre largo completo, sin recortarlo (RNF-08)', () => {
  const largo = 'María de los Ángeles Fernández-Ñandú (turno de noche)'

  assert.equal(contadorAFila({ id: 7, nombre: largo }).name, largo)
})

test('contadorAFila no inventa datos si el contador no es un objeto', () => {
  assert.equal(contadorAFila(null), null)
  assert.equal(contadorAFila(undefined), null)
  assert.equal(contadorAFila(42), null)
})

test('casoAFila traduce los campos internos a los que espera CaseRow (RF-13)', () => {
  const fila = casoAFila({
    id: 9,
    cliente: 'Distribuidora Ñandú',
    estado: 'en_proceso',
    prioridad: 'alta',
    contador_id: 3,
    creado_en: '2026-01-01 10:00:00',
    actualizado_en: '2026-01-02 11:00:00',
  })

  assert.deepEqual(fila, {
    id: 9,
    client: 'Distribuidora Ñandú',
    status: 'en_proceso',
    priority: 'alta',
    counterId: 3,
    startDate: '',
    dueDate: '',
    description: '',
    important: false,
    inProgressSince: '',
  })
})

test('casoAFila muestra inicio y vencimiento en DD-MM-AAAA y la descripción', () => {
  const fila = casoAFila({
    id: 4,
    cliente: 'Gamesa',
    estado: 'pendiente',
    prioridad: 'media',
    fecha_inicio: '2026-12-31 00:00:00',
    fecha_vencimiento: '2027-01-14 00:00:00',
    descripcion: 'Declaración anual',
  })

  assert.equal(fila.startDate, '31-12-2026')
  assert.equal(fila.dueDate, '14-01-2027')
  assert.equal(fila.description, 'Declaración anual')
})

test('casoAFila conserva el cliente completo y no arrastra campos del backend (RNF-08)', () => {
  const cliente = 'Servicios Integrales del Norte, S.A. de C.V. — sucursal 12'
  const fila = casoAFila({ id: 1, cliente, estado: 'pendiente', prioridad: 'baja' })

  assert.equal(fila.client, cliente)
  assert.equal('cliente' in fila, false)
  assert.equal('estado' in fila, false)
  assert.equal('prioridad' in fila, false)
  assert.equal(fila.counterId, null, 'sin contador_id se informa null, no undefined')
})

test('casoAFila no inventa datos si el caso no es un objeto', () => {
  assert.equal(casoAFila(null), null)
  assert.equal(casoAFila(undefined), null)
  assert.equal(casoAFila('caso'), null)
})

test('casosAFilas adapta la lista completa y descarta los elementos inválidos', () => {
  const filas = casosAFilas([
    { id: 1, cliente: 'Ana', estado: 'pendiente', prioridad: 'alta' },
    null,
    { id: 2, cliente: 'Luis', estado: 'finalizado', prioridad: 'baja' },
  ])

  assert.deepEqual(
    filas.map((fila) => fila.id),
    [1, 2],
  )
})

test('casosAFilas sin lista devuelve una lista vacía, no un error', () => {
  assert.deepEqual(casosAFilas(), [])
  assert.deepEqual(casosAFilas(null), [])
  assert.deepEqual(casosAFilas([]), [])
})

test('cada conteo tiene texto de ayuda propio (RNF-03)', () => {
  assert.deepEqual(Object.keys(AYUDA_CONTEO).sort(), [...STATUSES].sort())

  for (const estado of STATUSES) {
    assert.equal(typeof ayudaConteo(estado), 'string')
    assert.ok(ayudaConteo(estado).length > 20, `la ayuda de ${estado} explica qué cuenta`)
  }

  // Cada ayuda es distinta: no se repite el mismo texto para los tres conteos.
  assert.equal(new Set(STATUSES.map((estado) => ayudaConteo(estado))).size, STATUSES.length)
})

test('ayudaConteo devuelve null para un conteo desconocido', () => {
  assert.equal(ayudaConteo('archivado'), null)
  assert.equal(ayudaConteo(null), null)
})

// --- usuarioAFila (directorio de usuarios, rebanada 1) ---------------------

test('usuarioAFila arma la fila con nombre, correo, rol legible y último acceso', () => {
  const fila = usuarioAFila({
    id: 7,
    nombre: 'Ana Karen Ramírez',
    correo: 'kramirez@delgrow.mx',
    rol: 'administrador',
    ultimo_acceso_en: '2026-10-26 09:05:00',
  })

  assert.deepEqual(fila, {
    id: 7,
    nombre: 'Ana Karen Ramírez',
    correo: 'kramirez@delgrow.mx',
    rol: 'Administrador',
    rolClave: 'administrador',
    ultimoAcceso: '2026-10-26 09:05:00',
    puedeVerCasos: false,
  })
})

test('usuarioAFila muestra «Nunca» si la cuenta no ha iniciado sesión', () => {
  const fila = usuarioAFila({ id: 8, nombre: 'Luis', correo: 'l@delgrow.mx', rol: 'contador', ultimo_acceso_en: null })

  assert.equal(fila.ultimoAcceso, 'Nunca')
})

test('usuarioAFila solo permite ver casos a los contadores', () => {
  for (const [rol, esperado] of [
    ['contador', true],
    ['administrador', false],
    ['usuarios_de_sistema', false],
  ]) {
    assert.equal(usuarioAFila({ id: 1, nombre: 'x', correo: 'x@y.mx', rol, ultimo_acceso_en: null }).puedeVerCasos, esperado, rol)
  }
})

test('usuarioAFila conserva el nombre y el correo largos completos y no inventa datos', () => {
  const largo = 'María de los Ángeles Fernández-Ñandú (turno de noche) con un nombre larguísimo'
  assert.equal(usuarioAFila({ id: 9, nombre: largo, correo: 'm@d.mx', rol: 'contador', ultimo_acceso_en: null }).nombre, largo)
  assert.equal(usuarioAFila(null), null)
  assert.equal(usuarioAFila(undefined), null)
  assert.equal(usuarioAFila(42), null)
})

test('compararUltimoAcceso ordena por fecha y trata «Nunca» como el acceso más antiguo', () => {
  const accesos = ['2026-10-26 09:05:00', 'Nunca', '2025-01-02 23:59:59', '2026-10-26 18:30:00']

  assert.deepEqual([...accesos].sort(compararUltimoAcceso), [
    'Nunca',
    '2025-01-02 23:59:59',
    '2026-10-26 09:05:00',
    '2026-10-26 18:30:00',
  ])
  assert.equal(compararUltimoAcceso('Nunca', 'Nunca'), 0)
})

test('tarjetasResumen arma las 3 tarjetas KPI del dashboard con su número, desglose y ayuda', () => {
  const tarjetas = tarjetasResumen({
    pendiente: 3,
    en_proceso: 2,
    finalizado: 7,
    abiertos: 5,
    vencidos: 1,
    alta_abiertos: 4,
  })

  assert.deepEqual(
    tarjetas.map(({ clave, titulo, valor, detalle }) => ({ clave, titulo, valor, detalle })),
    [
      { clave: 'vencidos', titulo: 'Vencidos', valor: 1, detalle: 'Sin finalizar y con la fecha de vencimiento ya pasada' },
      { clave: 'abiertos', titulo: 'Abiertos', valor: 5, detalle: 'Pendientes: 3 · En proceso: 2' },
      { clave: 'alta_abiertos', titulo: 'Prioridad Alta abierta', valor: 4, detalle: 'Casos de prioridad Alta sin finalizar' },
    ],
  )
  for (const tarjeta of tarjetas) {
    assert.ok(tarjeta.ayuda.length > 20, `«${tarjeta.titulo}» explica cómo se cuenta`)
  }
})

test('tarjetasResumen habla del equipo por defecto y de «tus casos» con propios', () => {
  const ayudas = (opciones) => tarjetasResumen({}, opciones).map((t) => t.ayuda)

  for (const ayuda of ayudas()) {
    assert.match(ayuda, /todo el equipo/)
    assert.doesNotMatch(ayuda, /Toca/, 'sin seleccionable la tarjeta no hace nada al tocarla')
  }
  for (const ayuda of ayudas({ seleccionable: true })) {
    assert.match(ayuda, /todo el equipo/)
    assert.match(ayuda, /Toca la tarjeta para ver solo a los contadores que tienen estos casos\.$/)
  }
  for (const ayuda of ayudas({ propios: true, seleccionable: true })) {
    assert.match(ayuda, /^Tus casos/)
    assert.doesNotMatch(ayuda, /equipo/)
    assert.match(ayuda, /Toca la tarjeta para verlos en «Mis casos»\.$/)
  }
})

test('tarjetasResumen marca «Vencidos» como alerta solo cuando hay alguno', () => {
  const alerta = (resumen) => tarjetasResumen(resumen).find((t) => t.clave === 'vencidos').alerta
  assert.equal(alerta({ vencidos: 2 }), true)
  assert.equal(alerta({ vencidos: 0 }), false)
})

test('tarjetasResumen muestra 0 cuando falta un dato', () => {
  const tarjetas = tarjetasResumen({})
  assert.deepEqual(tarjetas.map((t) => t.valor), [0, 0, 0])
  assert.equal(tarjetas[1].detalle, 'Pendientes: 0 · En proceso: 0')
})

test('segmentosDona reparte la dona por estado: arcos en porcentaje y desplazamiento acumulado', () => {
  const dona = segmentosDona({ pendiente: 3, en_proceso: 1, finalizado: 4 })

  assert.equal(dona.total, 8)
  assert.deepEqual(
    dona.segmentos.map(({ clave, etiqueta, valor, arco, desplazamiento }) => ({ clave, etiqueta, valor, arco, desplazamiento })),
    [
      { clave: 'pendiente', etiqueta: 'Pendiente', valor: 3, arco: 37.5, desplazamiento: 0 },
      { clave: 'en_proceso', etiqueta: 'En proceso', valor: 1, arco: 12.5, desplazamiento: 37.5 },
      { clave: 'finalizado', etiqueta: 'Finalizado', valor: 4, arco: 50, desplazamiento: 50 },
    ],
  )
  assert.deepEqual(
    dona.segmentos.map((s) => s.color),
    ['#b45309', '#1f5f99', '#2f855a'],
    'ámbar, azul y verde',
  )
})

test('segmentosDona redondea los porcentajes de la leyenda para que sumen 100', () => {
  const porcentajes = (resumen) => segmentosDona(resumen).segmentos.map((s) => s.porcentaje)
  assert.deepEqual(porcentajes({ pendiente: 3, en_proceso: 1, finalizado: 4 }), [38, 12, 50])
  assert.deepEqual(porcentajes({ pendiente: 1, en_proceso: 1, finalizado: 1 }), [34, 33, 33])
  assert.deepEqual(porcentajes({ pendiente: 0, en_proceso: 0, finalizado: 5 }), [0, 0, 100])
})

test('segmentosDona sin casos devuelve total 0 y arcos vacíos (la vista muestra «Sin casos registrados»)', () => {
  const dona = segmentosDona({})
  assert.equal(dona.total, 0)
  assert.deepEqual(dona.segmentos.map((s) => [s.valor, s.arco, s.porcentaje]), [[0, 0, 0], [0, 0, 0], [0, 0, 0]])
})

test('casoAFila marca el caso importante y muestra desde cuándo está en proceso (DD-MM-AAAA)', () => {
  const fila = casoAFila({
    id: 5,
    cliente: 'Gamesa',
    estado: 'en_proceso',
    prioridad: 'alta',
    importante: true,
    en_proceso_en: '2026-10-23 10:03:40',
  })

  assert.equal(fila.important, true)
  assert.equal(fila.inProgressSince, '23-10-2026')
})
