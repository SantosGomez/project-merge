import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const FUENTE = fs.readFileSync(new URL('./DashboardPage.vue', import.meta.url), 'utf8')

// El mes del Dashboard se decide por la fecha de recepción, no por el periodo
// contable (rebanada 45): los textos del selector y de las tarjetas lo dicen.
describe('Dashboard — textos del mes de recepción', () => {
  test('el selector se llama «Mes de recepción», no «Periodo»', () => {
    assert.match(FUENTE, /label="Mes de recepción"/)
    assert.match(FUENTE, /aria-label="Seleccionar el mes de recepción de los documentos"/)
    assert.doesNotMatch(FUENTE, /label="Periodo"/)
  })

  test('el subtítulo habla de lo recibido en el mes', () => {
    assert.match(FUENTE, /Documentos recibidos en el mes elegido y todo lo que sigue pendiente/)
  })

  // Vuelta 2 de la rebanada 46: «Recibidos» y «Completados» dejaron de ser tarjetas
  // del mes; ahora son «Recibido» y «Completado» (por estado) y sus pies dicen el mes.
  test('los pies de «Recibido» y «Completado» dicen «recibidos en» el mes', () => {
    assert.match(FUENTE, /pie: `Recibidos en \$\{mes\} y pendientes anteriores`/)
    assert.match(FUENTE, /pie: `Recibidos en \$\{mes\} y terminados`/)
  })

  test('la tabla vacía dice «recibidos en» el mes', () => {
    assert.match(FUENTE, /No hay documentos recibidos en \$\{formatearMesAnio\(periodo\.value\)\}/)
  })
})
