import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { TIPOS_RECEPCION, CAMPOS_AUTOLLENADO, PLANTILLAS, aplicarPlantilla } from './autollenado.js'

const formVacio = () => ({
  empresaDca: null,
  cliente: null,
  asunto: '',
  departamento: null,
  tipoDocumento: null,
  periodo: '2026-11',
  prioridad: 'MEDIA',
  fechaLimiteSla: '2026-11-20',
  contadorAsignado: null,
  viaEntrega: 'Digital',
  notificarCorreo: false,
  archivos: ['doc.pdf'],
  observaciones: '',
})

describe('autollenado — tipos de recepción', () => {
  test('son los cinco acordados para el MVP', () => {
    assert.deepEqual(TIPOS_RECEPCION, ['Mensual', 'Trimestral', 'Anual', 'Eventual', 'Otro'])
  })

  test('cada tipo tiene una plantilla', () => {
    for (const tipo of TIPOS_RECEPCION) {
      assert.ok(PLANTILLAS[tipo], `falta la plantilla de ${tipo}`)
    }
  })
})

describe('autollenado — campos que se llenan', () => {
  test('nunca incluye periodo, firmas ni archivos', () => {
    for (const excluido of ['periodo', 'archivos', 'firmaCliente', 'firmaRecepcion']) {
      assert.equal(
        CAMPOS_AUTOLLENADO.includes(excluido),
        false,
        `${excluido} no puede estar en el autollenado`,
      )
    }
  })

  test('incluye la empresa, el asunto y los demás datos de clasificación', () => {
    for (const campo of [
      'empresaDca',
      'asunto',
      'departamento',
      'tipoDocumento',
      'prioridad',
      'contadorAsignado',
      'viaEntrega',
      'notificarCorreo',
      'observaciones',
    ]) {
      assert.equal(CAMPOS_AUTOLLENADO.includes(campo), true, `falta ${campo}`)
    }
  })
})

describe('aplicarPlantilla', () => {
  test('llena el formulario sin tocar periodo, archivos ni firmas', () => {
    const form = formVacio()
    const periodoAntes = form.periodo
    const archivosAntes = form.archivos

    const aplicado = aplicarPlantilla('Mensual', form)

    assert.equal(aplicado, true)
    assert.equal(form.empresaDca, PLANTILLAS.Mensual.empresaDca)
    assert.equal(form.asunto, PLANTILLAS.Mensual.asunto)
    assert.equal(form.departamento, PLANTILLAS.Mensual.departamento)
    assert.equal(form.tipoDocumento, PLANTILLAS.Mensual.tipoDocumento)
    assert.equal(form.prioridad, PLANTILLAS.Mensual.prioridad)
    assert.equal(form.viaEntrega, PLANTILLAS.Mensual.viaEntrega)
    assert.equal(form.notificarCorreo, PLANTILLAS.Mensual.notificarCorreo)
    assert.equal(form.observaciones, PLANTILLAS.Mensual.observaciones)

    assert.equal(form.periodo, periodoAntes, 'el periodo no se autollena')
    assert.equal(form.archivos, archivosAntes, 'los archivos no se autollenan')
    assert.equal('firmaCliente' in form, false)
    assert.equal('firmaRecepcion' in form, false)
  })

  test('un tipo desconocido no toca el formulario y devuelve false', () => {
    const form = formVacio()
    const copia = JSON.parse(JSON.stringify(form))

    const aplicado = aplicarPlantilla('Inexistente', form)

    assert.equal(aplicado, false)
    assert.deepEqual(form, copia)
  })
})
