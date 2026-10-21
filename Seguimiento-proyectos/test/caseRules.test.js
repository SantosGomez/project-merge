import test from 'node:test'
import assert from 'node:assert/strict'

import { MAX_CLIENT_LENGTH, PRIORITIES, STATUSES } from '../src/utils/constants.js'
import {
  addCase,
  buildCase,
  casesByCounter,
  changePriority,
  changeStatus,
  countByStatus,
  validateNewCase,
} from '../src/utils/caseRules.js'

// Datos de apoyo: un caso completo del detalle de P-2 (RF-13).
const makeCase = (overrides = {}) => ({
  id: 'case-01',
  client: 'Panadería La Espiga',
  status: 'pendiente',
  priority: 'alta',
  counterId: 'c-02',
  ...overrides,
})

// Copia profunda para comprobar que ninguna función muta el arreglo original.
const snapshot = (cases) => JSON.parse(JSON.stringify(cases))

const NEXT_ID = 'case-99'

test('validateNewCase exige el cliente cuando llega vacío, nulo o solo con espacios', () => {
  const invalids = ['', '   ', '\t \n', null, undefined]

  for (const client of invalids) {
    assert.deepEqual(
      validateNewCase({ client, priority: 'alta' }),
      { valid: false, errorCode: 'client_required' },
      `el cliente ${JSON.stringify(client)} debe rechazarse por obligatorio (RF-22)`,
    )
  }
})

test('validateNewCase acepta 80 caracteres y rechaza 81, sin contar los espacios extremos', () => {
  const length80 = 'a'.repeat(MAX_CLIENT_LENGTH)
  const length81 = 'a'.repeat(MAX_CLIENT_LENGTH + 1)

  assert.deepEqual(
    validateNewCase({ client: length80, priority: 'alta' }),
    { valid: true, errorCode: null },
    'un cliente de 80 caracteres es válido (RF-24)',
  )

  assert.deepEqual(
    validateNewCase({ client: length81, priority: 'alta' }),
    { valid: false, errorCode: 'client_too_long' },
    'un cliente de 81 caracteres no es válido (RF-24)',
  )

  assert.deepEqual(
    validateNewCase({ client: `   ${length80}   `, priority: 'alta' }),
    { valid: true, errorCode: null },
    'los espacios al inicio y al final no cuentan para el límite (Definiciones: Cliente)',
  )

  assert.deepEqual(
    validateNewCase({ client: `  ${length81}`, priority: 'alta' }),
    { valid: false, errorCode: 'client_too_long' },
    'los 81 caracteres visibles siguen siendo inválidos con espacios extremos (RF-24)',
  )
})

test('validateNewCase exige la prioridad cuando no se eligió ninguna', () => {
  const invalids = [null, undefined, '', 'urgente', 'ALTA']

  for (const priority of invalids) {
    assert.deepEqual(
      validateNewCase({ client: 'Panadería La Espiga', priority }),
      { valid: false, errorCode: 'priority_required' },
      `la prioridad ${JSON.stringify(priority)} debe rechazarse por obligatoria (RF-23)`,
    )
  }

  for (const priority of PRIORITIES) {
    assert.deepEqual(
      validateNewCase({ client: 'Panadería La Espiga', priority }),
      { valid: true, errorCode: null },
      `la prioridad ${priority} es válida (RF-20)`,
    )
  }
})

test('validateNewCase no exige la prioridad si antes falta el cliente', () => {
  assert.deepEqual(validateNewCase({ client: '  ', priority: null }), {
    valid: false,
    errorCode: 'client_required',
  })
})

test('buildCase crea el caso en estado Pendiente, con el contador asignado y sin espacios extremos', () => {
  const oneCase = buildCase({
    client: '  Ferretería Los Pinos  ',
    priority: 'media',
    counterId: 'c-01',
    nextId: NEXT_ID,
  })

  assert.deepEqual(oneCase, {
    id: NEXT_ID,
    client: 'Ferretería Los Pinos',
    status: 'pendiente',
    priority: 'media',
    counterId: 'c-01',
  })
  assert.ok(STATUSES.includes(oneCase.status))
  assert.equal(
    oneCase.status,
    STATUSES[0],
    'el estado inicial de todo caso nuevo es Pendiente (RF-26)',
  )
})

test('buildCase ignora cualquier estado que se le intente pasar', () => {
  const oneCase = buildCase({
    client: 'Clínica Santa Elena',
    priority: 'baja',
    counterId: 'c-01',
    nextId: NEXT_ID,
    status: 'finalizado',
  })

  assert.equal(
    oneCase.status,
    'pendiente',
    'el estado lo fija la maqueta, no el formulario (RF-19)',
  )
})

test('buildCase devuelve un objeto nuevo en cada llamada', () => {
  const first = buildCase({
    client: 'Hotelería del Lago',
    priority: 'alta',
    counterId: 'c-01',
    nextId: NEXT_ID,
  })
  const second = buildCase({
    client: 'Hotelería del Lago',
    priority: 'alta',
    counterId: 'c-01',
    nextId: NEXT_ID,
  })

  assert.notEqual(first, second)
  assert.deepEqual(first, second)
})

test('addCase agrega el caso al final y no muta el arreglo original', () => {
  const cases = [makeCase({ id: 'case-01' }), makeCase({ id: 'case-02', counterId: 'c-01' })]
  const before = snapshot(cases)

  const result = addCase(cases, {
    client: 'Mueblería Casa Nueva',
    priority: 'baja',
    counterId: 'c-01',
    nextId: NEXT_ID,
  })

  assert.equal(result.length, cases.length + 1)
  assert.notEqual(result, cases, 'addCase devuelve un arreglo nuevo')
  assert.deepEqual(result.at(-1), {
    id: NEXT_ID,
    client: 'Mueblería Casa Nueva',
    status: 'pendiente',
    priority: 'baja',
    counterId: 'c-01',
  })
  assert.deepEqual(cases, before, 'el arreglo original queda intacto')
})

test('addCase devuelve el único caso cuando parte de un arreglo vacío', () => {
  const result = addCase([], {
    client: 'Imprenta Gráfica Aurora',
    priority: 'alta',
    counterId: 'c-01',
    nextId: NEXT_ID,
  })

  assert.equal(result.length, 1)
  assert.equal(result[0].status, 'pendiente')
  assert.equal(result[0].counterId, 'c-01')
})

test('countByStatus siempre devuelve las tres claves, con 0 donde no hay casos', () => {
  assert.deepEqual(countByStatus([]), { pendiente: 0, en_proceso: 0, finalizado: 0 })

  const cases = [
    makeCase({ id: 'case-01', status: 'pendiente' }),
    makeCase({ id: 'case-02', status: 'pendiente' }),
    makeCase({ id: 'case-03', status: 'finalizado' }),
  ]
  const counts = countByStatus(cases)

  assert.deepEqual(counts, { pendiente: 2, en_proceso: 0, finalizado: 1 })
  assert.deepEqual(Object.keys(counts).sort(), [...STATUSES].sort())
})

test('countByStatus cuenta los casos de los tres estados', () => {
  const cases = [
    makeCase({ id: 'case-01', status: 'pendiente' }),
    makeCase({ id: 'case-02', status: 'en_proceso' }),
    makeCase({ id: 'case-03', status: 'en_proceso' }),
    makeCase({ id: 'case-04', status: 'finalizado' }),
  ]

  assert.deepEqual(countByStatus(cases), { pendiente: 1, en_proceso: 2, finalizado: 1 })
})

test('casesByCounter filtra por contador sin mutar el arreglo original', () => {
  const cases = [
    makeCase({ id: 'case-01', counterId: 'c-02' }),
    makeCase({ id: 'case-02', counterId: 'c-01' }),
    makeCase({ id: 'case-03', counterId: 'c-02' }),
  ]
  const before = snapshot(cases)

  const result = casesByCounter(cases, 'c-02')

  assert.deepEqual(
    result.map((oneCase) => oneCase.id),
    ['case-01', 'case-03'],
  )
  assert.notEqual(result, cases)
  assert.deepEqual(cases, before)
  assert.deepEqual(
    casesByCounter(cases, 'c-99'),
    [],
    'un contador sin casos devuelve un arreglo vacío',
  )
})

test('changeStatus permite pasar de Finalizado a cualquier otro estado', () => {
  const cases = [
    makeCase({ id: 'case-01', status: 'finalizado' }),
    makeCase({ id: 'case-02', status: 'pendiente' }),
  ]
  const before = snapshot(cases)

  const toPending = changeStatus(cases, 'case-01', 'pendiente')

  assert.equal(toPending[0].status, 'pendiente', 'un caso Finalizado se puede reabrir (RF-32)')
  assert.equal(toPending[1].status, 'pendiente', 'los demás casos no cambian')
  assert.notEqual(toPending, cases)
  assert.deepEqual(cases, before, 'el arreglo original queda intacto')

  const toInProgress = changeStatus(cases, 'case-01', 'en_proceso')
  assert.equal(toInProgress[0].status, 'en_proceso', 'también se puede pasar a En proceso (RF-32)')
})

test('changeStatus no toca los demás campos del caso', () => {
  const cases = [makeCase({ id: 'case-01', status: 'pendiente', priority: 'alta' })]

  const result = changeStatus(cases, 'case-01', 'finalizado')

  assert.deepEqual(result[0], {
    id: 'case-01',
    client: 'Panadería La Espiga',
    status: 'finalizado',
    priority: 'alta',
    counterId: 'c-02',
  })
})

test('changeStatus ignora un identificador o un estado que no existen', () => {
  const cases = [makeCase({ id: 'case-01', status: 'pendiente' })]
  const before = snapshot(cases)

  assert.deepEqual(changeStatus(cases, 'case-99', 'finalizado'), cases)
  assert.deepEqual(changeStatus(cases, 'case-01', 'archivado'), cases)
  assert.deepEqual(cases, before)
})

test('changePriority permite cambiar la prioridad de un caso Finalizado', () => {
  const cases = [
    makeCase({ id: 'case-01', status: 'finalizado', priority: 'baja' }),
    makeCase({ id: 'case-02', priority: 'media' }),
  ]
  const before = snapshot(cases)

  const result = changePriority(cases, 'case-01', 'alta')

  assert.equal(
    result[0].priority,
    'alta',
    'la prioridad es independiente del estado (RF-31, RF-32)',
  )
  assert.equal(result[0].status, 'finalizado', 'el estado no cambia al cambiar la prioridad')
  assert.equal(result[1].priority, 'media', 'los demás casos no cambian')
  assert.notEqual(result, cases)
  assert.deepEqual(cases, before, 'el arreglo original queda intacto')
})

test('changePriority ignora un identificador o una prioridad que no existen', () => {
  const cases = [makeCase({ id: 'case-01', priority: 'alta' })]
  const before = snapshot(cases)

  assert.deepEqual(changePriority(cases, 'case-99', 'baja'), cases)
  assert.deepEqual(changePriority(cases, 'case-01', 'urgente'), cases)
  assert.deepEqual(cases, before)
})

test('los cambios se reflejan en los conteos de P-2 (RF-30)', () => {
  const cases = [
    makeCase({ id: 'case-01', status: 'pendiente' }),
    makeCase({ id: 'case-02', status: 'finalizado' }),
  ]

  assert.deepEqual(countByStatus(cases), { pendiente: 1, en_proceso: 0, finalizado: 1 })

  const changed = changeStatus(cases, 'case-02', 'en_proceso')

  assert.deepEqual(countByStatus(changed), { pendiente: 1, en_proceso: 1, finalizado: 0 })
  assert.deepEqual(
    countByStatus(changed),
    { pendiente: 1, en_proceso: 1, finalizado: 0 },
    'los conteos se recalculan con el arreglo devuelto, sin tocar el original',
  )
})

test('ninguna función muta el arreglo de entrada', () => {
  const cases = [
    makeCase({ id: 'case-01', status: 'pendiente', priority: 'alta' }),
    makeCase({ id: 'case-02', status: 'finalizado', priority: 'baja', counterId: 'c-01' }),
  ]
  const before = snapshot(cases)

  addCase(cases, {
    client: 'Distribuidora AgroSur',
    priority: 'media',
    counterId: 'c-01',
    nextId: NEXT_ID,
  })
  countByStatus(cases)
  casesByCounter(cases, 'c-01')
  changeStatus(cases, 'case-01', 'finalizado')
  changePriority(cases, 'case-02', 'alta')

  assert.deepEqual(
    cases,
    before,
    'el arreglo original sigue igual después de todas las operaciones',
  )
})
