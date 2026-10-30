// Pruebas de la lógica de los formularios de auditoría y bitácora (UI parte 3):
// sugerencias al escribir, fase propuesta, días permitidos y error junto al campo.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  TIPOS_AUDITORIA,
  campoConError,
  diaNoAnterior,
  faseSugerida,
  filtrarSugerencias,
} from '../src/utils/formularioAuditoria.js'

test('los tipos sugeridos son los del boceto', () => {
  assert.deepEqual(TIPOS_AUDITORIA, [
    'Revisión de Gabinete',
    'Revisión Electrónica',
    'Visita Domiciliaria',
    'Auditoría Estatal',
  ])
})

test('filtrarSugerencias busca sin mayúsculas ni acentos y sin texto devuelve todo', () => {
  assert.deepEqual(filtrarSugerencias(TIPOS_AUDITORIA, 'revision'), ['Revisión de Gabinete', 'Revisión Electrónica'])
  assert.deepEqual(filtrarSugerencias(TIPOS_AUDITORIA, 'VISITA'), ['Visita Domiciliaria'])
  assert.equal(filtrarSugerencias(TIPOS_AUDITORIA, '').length, 4)
  assert.deepEqual(filtrarSugerencias(TIPOS_AUDITORIA, 'imss'), [])
})

test('faseSugerida propone la fase de un evento conocido y nada para texto libre', () => {
  assert.equal(faseSugerida('Orden de visita domiciliaria (inicio)'), 1)
  assert.equal(faseSugerida('requerimiento adicional de informacion'), 2)
  assert.equal(faseSugerida('Última acta parcial'), 3)
  assert.equal(faseSugerida('Autocorrección (pago de contribuciones omitidas)'), 4)
  assert.equal(faseSugerida('Oficio de conclusión de la revisión'), 5)
  assert.equal(faseSugerida('Recurso de revocación interpuesto'), 6)
  assert.equal(faseSugerida('Notificación de multa formal'), null, 'la multa puede llegar en cualquier fase')
  assert.equal(faseSugerida('Llamada con el auditor'), null)
})

test('diaNoAnterior bloquea en el calendario los días antes de otra fecha del formulario', () => {
  // q-date entrega los días como AAAA/MM/DD; el formulario guarda DD-MM-AAAA.
  assert.equal(diaNoAnterior('2026/02/14', '15-02-2026'), false)
  assert.equal(diaNoAnterior('2026/02/15', '15-02-2026'), true, 'el mismo día se permite')
  assert.equal(diaNoAnterior('2026/03/01', '15-02-2026'), true)
  assert.equal(diaNoAnterior('2020/01/01', ''), true, 'sin fecha de referencia no bloquea nada')
  assert.equal(diaNoAnterior('2020/01/01', '15-02'), true, 'una fecha a medio escribir no bloquea')
})

test('campoConError reconoce el campo en los mensajes del servidor y del formulario', () => {
  assert.equal(campoConError('Falta un dato obligatorio sobre cliente: Ingrese cliente'), 'cliente')
  assert.equal(campoConError('Texto demasiado largo sobre no. de expediente: Use máximo 100 caracteres'), 'noExpediente')
  assert.equal(campoConError('Falta un dato obligatorio sobre tipo de auditoría: Ingrese tipo de auditoría'), 'tipoAud')
  assert.equal(
    campoConError('Periodo no válido sobre fin del periodo: Debe ser igual o posterior al inicio del periodo'),
    'periodoFinal',
  )
  assert.equal(campoConError('Fecha no válida sobre inicio del periodo: Use una fecha real'), 'periodoInicio')
  assert.equal(
    campoConError('Fecha no válida sobre fecha de vencimiento: Debe ser igual o posterior a la fecha de inicio'),
    'fechaVencimiento',
  )
  assert.equal(campoConError('Fecha no válida sobre fecha de inicio: Use una fecha real'), 'fechaInicio')
  assert.equal(campoConError('Contador no válido sobre contadores: Seleccione solo cuentas con rol de contador'), 'contadores')
  assert.equal(campoConError('Qué ocurrió: La fecha no es válida\nSobre: el fin del periodo\nQué hacer: …'), 'periodoFinal')
  assert.equal(campoConError('No se pudo conectar con el servidor'), null)
  assert.equal(campoConError(undefined), null)
})
