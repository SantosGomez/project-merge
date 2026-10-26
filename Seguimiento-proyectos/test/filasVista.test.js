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
  })
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
