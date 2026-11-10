// Revisión de UI, rebanada 3: casos en conjunto (contador con auxiliares).
// A: casoAFila incluye el nombre del contador dueño.
// B: MyCasesPage pasa el contador autenticado a CasoItem; CasoItem muestra «de …».
// TDD: las pruebas fallan primero porque casoAFila no trae contadorNombre y CasoItem/MyCasesPage no lo muestran.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) =>
  readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const filasVista = leer('../src/utils/filasVista.js')
const myCases = leer('../src/pages/MyCasesPage.vue')
const casoItem = leer('../src/components/CasoItem.vue')

describe('Grupo A: casoAFila incluye nombre del contador dueño', () => {
  it('casoAFila devuelve contadorNombre cuando el caso trae nombre_contador', () => {
    assert.match(filasVista, /contadorNombre/)
    assert.match(
      filasVista,
      /contadorNombre: caso\.nombre_contador \?\? ''/
    )
  })
})

describe('Grupo B: MyCasesPage y CasoItem muestran el dueño del caso', () => {
  it('MyCasesPage pasa el contador autenticado a CasoItem', () => {
    assert.match(myCases, /:contador-autenticado-id="contadorAutenticadoId"/)
    assert.match(myCases, /contadorAutenticadoId/)
  })
  it('CasoItem muestra «de …» cuando el caso es de un auxiliar', () => {
    assert.match(casoItem, /caso\.contadorNombre/)
    assert.match(casoItem, /contadorAutenticadoId/)
    assert.match(casoItem, /contador-dueño/)
  })
})
