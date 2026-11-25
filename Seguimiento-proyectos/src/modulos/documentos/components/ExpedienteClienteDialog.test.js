import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const COMPONENTE = fs.readFileSync(
  fileURLToPath(new URL('./ExpedienteClienteDialog.vue', import.meta.url)),
  'utf8',
)
const PLANTILLA = COMPONENTE.replace(/<!--[\s\S]*?-->/g, '')

describe('ExpedienteClienteDialog — ficha de solo lectura del cliente', () => {
  test('es un diálogo con v-model, animación de 220 ms y pantalla completa en móvil', () => {
    assert.match(PLANTILLA, /<q-dialog/)
    assert.match(COMPONENTE, /defineModel\(\{ type: Boolean/)
    assert.match(PLANTILLA, /transition-show="dialogo-entra"/)
    assert.match(PLANTILLA, /transition-hide="dialogo-sale"/)
    assert.match(PLANTILLA, /:transition-duration="220"/)
    assert.match(PLANTILLA, /:maximized="\$q\.screen\.lt\.sm"/)
  })

  test('carga el expediente con obtenerExpedienteCliente', () => {
    assert.match(COMPONENTE, /obtenerExpedienteCliente\(props\.clienteId\)/)
  })

  test('muestra los datos del cliente con «Sin capturar» para los vacíos', () => {
    for (const texto of [
      'Razón social',
      'Clave de carpeta',
      'RFC',
      'Correo',
      'Teléfono',
      'Contador asignado',
      'Estado',
      'Fecha de alta',
    ]) {
      assert.ok(PLANTILLA.includes(texto), `falta la etiqueta ${texto}`)
    }
    assert.match(COMPONENTE, /Sin capturar/)
  })

  test('el estado se ve con texto Activo o Inactivo, no solo con color', () => {
    assert.match(COMPONENTE, /'Activo'/)
    assert.match(COMPONENTE, /'Inactivo'/)
  })

  test('lista las recepciones con el chip de estado y el total', () => {
    assert.match(COMPONENTE, /estiloDeEstadoDocumento/)
    assert.match(PLANTILLA, /<q-chip/)
    assert.match(PLANTILLA, /totalRecepciones/)
    assert.match(PLANTILLA, /Este cliente aún no tiene recepciones registradas\./)
  })

  test('«Editar» solo con el permiso crear_cliente y abre el formulario con el cliente', () => {
    assert.match(COMPONENTE, /hayAcceso\(sesion\.usuario\.value\?\.rol, 'crear_cliente'\)/)
    assert.match(PLANTILLA, /v-if="puedeEditar && expediente"/)
    assert.match(PLANTILLA, /<NuevoClienteDialog[^>]*:cliente="expediente\.cliente"/)
  })

  test('al guardar avisa «Cambios guardados», recarga y avisa a la tabla', () => {
    assert.match(COMPONENTE, /Cambios guardados/)
    assert.match(COMPONENTE, /emit\('actualizado'\)/)
  })

  test('los botones son táctiles, llevan tooltip y las fechas no se leen con new Date', () => {
    assert.match(PLANTILLA, /control-touch/)
    assert.match(PLANTILLA, /<q-tooltip>/)
    assert.ok(!/new Date\(/.test(COMPONENTE.replace(/<!--[\s\S]*?-->/g, '')))
  })

  test('sin hexadecimales sueltos de color', () => {
    assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(COMPONENTE))
  })

  test('nunca muestra la ficha de otro cliente: carga antes de mostrar y vacía al cerrar', () => {
    assert.match(PLANTILLA, /@before-show="cargar"/)
    assert.match(PLANTILLA, /@hide="vaciar"/)
    assert.match(
      COMPONENTE,
      /function vaciar\(\) \{\s*expediente\.value = null\s*error\.value = ''/,
    )
    assert.match(COMPONENTE, /watch\(\s*\(\) => props\.clienteId/)
  })

  test('el alto máximo solo aplica cuando no está maximizado', () => {
    assert.match(PLANTILLA, /:class="\{ 'expediente-dialog--ajustado': !\$q\.screen\.lt\.sm \}"/)
    assert.match(COMPONENTE, /\.expediente-dialog--ajustado \{[^}]*max-height: 90vh/)
    assert.ok(!/\.expediente-dialog \{[^}]*max-height/.test(COMPONENTE))
  })
})
