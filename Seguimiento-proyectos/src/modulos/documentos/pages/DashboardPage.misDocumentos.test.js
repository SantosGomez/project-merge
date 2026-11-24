import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const FUENTE_DASHBOARD = fs.readFileSync(new URL('./DashboardPage.vue', import.meta.url), 'utf8')
const FUENTE_API = fs.readFileSync(new URL('../servicios/api.js', import.meta.url), 'utf8')

describe('Dashboard — rebanada D.3: filtro «Mis documentos» para rol Contador', () => {
  test('api.js: obtenerDocumentos acepta opciones con misDocumentos', () => {
    assert.match(
      FUENTE_API,
      /obtenerDocumentos\s*\(\s*periodo\s*,\s*opciones\s*=\s*\{\}\s*\)/,
      'obtenerDocumentos debe aceptar opciones',
    )
    assert.match(
      FUENTE_API,
      /misDocumentos/,
      'obtenerDocumentos debe incluir parámetro misDocumentos',
    )
  })

  test('DashboardPage.vue: toggle de «Mis documentos» condicionado a rol Contador', () => {
    assert.match(
      FUENTE_DASHBOARD,
      /<q-toggle\b[^>]*v-model="soloMisDocumentos"[^>]*>/,
      'Debe existir un q-toggle vinculado a soloMisDocumentos',
    )
    assert.match(
      FUENTE_DASHBOARD,
      /v-if="esContador"/,
      'El toggle debe estar condicionado a esContador',
    )
    assert.match(
      FUENTE_DASHBOARD,
      /esContador\s*=\s*computed\(\(\)\s*=>\s*puedeCambiarEstado\.value\s*&&\s*!puedeRecepcionar\.value\)/,
      'esContador debe derivarse de permisos sin hardcodear el nombre de rol',
    )
  })

  test('DashboardPage.vue: recarga al cambiar soloMisDocumentos y envía la opción a la API', () => {
    assert.match(
      FUENTE_DASHBOARD,
      /watch\(\s*\[\s*periodo\s*,\s*soloMisDocumentos\s*\]\s*,\s*cargarDocumentos\s*\)/,
      'watch debe observar periodo y soloMisDocumentos',
    )
    assert.match(
      FUENTE_DASHBOARD,
      /obtenerDocumentos\(\s*periodo\.value\s*,\s*\{\s*misDocumentos:\s*soloMisDocumentos\.value,?\s*\}\s*\)/,
      'cargarDocumentos debe pasar misDocumentos a obtenerDocumentos',
    )
  })
})
