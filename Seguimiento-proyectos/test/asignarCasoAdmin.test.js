// Pruebas estáticas: el administrador asigna un caso a un contador desde su dashboard
// con el mismo diálogo del registro, eligiendo al contador en un q-select.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (texto) => texto.split('<script')[0]

describe('El administrador asigna un caso a un contador', () => {
  const dialogo = leer('../src/components/CaseFormDialog.vue')
  const dashboard = leer('../src/pages/AdminDashboardPage.vue')

  it('CaseFormDialog recibe la lista de contadores y con ella muestra un q-select obligatorio', () => {
    const plantilla = plantillaDe(dialogo)
    assert.match(dialogo, /contadores: \{\s*type: Array,\s*default: null/)
    assert.match(plantilla, /v-if="modoAsignacion"[^>]*>[\s\S]*?<q-select[^>]*v-model="contadorId"/)
    assert.match(plantilla, /:options="opcionesContador"/)
    assert.match(dialogo, /code: 'contador_required'/)
    assert.match(dialogo, /Elige el contador que atenderá el caso\./)
  })

  it('en modo asignación guarda con cases.asignarCaso y usa textos de asignación', () => {
    assert.match(dialogo, /cases\.asignarCaso\(\s*contadorId\.value,/)
    assert.match(dialogo, /titulo: 'Asignar caso'/)
    assert.match(dialogo, /errorGuardado: 'No se pudo asignar el caso'/)
  })

  it('el dashboard abre el diálogo con los contadores, avisa y refresca el resumen y el contador', () => {
    const plantilla = plantillaDe(dashboard)
    assert.match(dashboard, /import CaseFormDialog from '\.\.\/components\/CaseFormDialog\.vue'/)
    assert.match(plantilla, /<CaseFormDialog[^>]*v-model="dialogoAsignarAbierto"[^>]*:contadores="contadores"[^>]*@registrado="alAsignar"/)
    assert.match(plantilla, /label="Asignar caso"[\s\S]*?@click="dialogoAsignarAbierto = true"/)
    assert.doesNotMatch(dashboard, /casoEnEdicion|cases\.reintentar/)
    assert.match(dashboard, /type: 'positive'[\s\S]*?Caso asignado\. Se avisó a/)
    assert.match(dashboard, /contadoresStore\.refrescarEnSilencio\(caso\.contador_id\)/)
  })
})
