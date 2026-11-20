// Rebanada 37: el contador registra un caso nuevo a nombre de su auxiliar.
// Servicio y store por comportamiento; la interfaz se comprueba leyendo las plantillas.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { createPinia, setActivePinia } from 'pinia'

const crearAuxiliarService = (await import('../src/services/auxiliarService.js'))
  .crearAuxiliarService
const crearAuxiliaresStore = (await import('../src/stores/auxiliares.js')).crearAuxiliaresStore

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]
const scriptDe = (fuente) => fuente.slice(fuente.indexOf('<script'), fuente.indexOf('<style'))

const formulario = leer('../src/components/CaseFormDialog.vue')
const myCases = leer('../src/pages/MyCasesPage.vue')
const miEquipo = leer('../src/components/MiEquipo.vue')

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('servicio crearCasoParaMiAuxiliar', () => {
  it('llama a POST /casos/para-mi-auxiliar con auxiliar_id y los datos del caso', async () => {
    let rutaEnviada = null
    let cuerpoEnviado = null
    const api = {
      post: async (ruta, cuerpo) => {
        rutaEnviada = ruta
        cuerpoEnviado = cuerpo
        return { data: { mensaje: 'Caso asignado correctamente', caso: { id: 9 } } }
      },
    }
    const servicio = crearAuxiliarService({ api })

    const resultado = await servicio.crearCasoParaMiAuxiliar(5, {
      cliente: 'zz_test cliente',
      prioridad: 'Alta',
      importante: true,
    })

    assert.strictEqual(rutaEnviada, '/casos/para-mi-auxiliar')
    assert.deepStrictEqual(cuerpoEnviado, {
      auxiliar_id: 5,
      cliente: 'zz_test cliente',
      prioridad: 'Alta',
      importante: true,
    })
    assert.strictEqual(resultado.mensaje, 'Caso asignado correctamente')
    assert.strictEqual(resultado.caso.id, 9)
  })
})

describe('store crearCasoParaMiAuxiliar', () => {
  it('crea el caso y deja de guardar', async () => {
    const store = crearAuxiliaresStore({
      auxiliarService: {
        crearCasoParaMiAuxiliar: async () => ({ mensaje: 'Ok.', caso: { id: 9 } }),
      },
    })()

    const resultado = await store.crearCasoParaMiAuxiliar(5, { cliente: 'zz_test' })

    assert.strictEqual(resultado.ok, true)
    assert.deepStrictEqual(resultado.caso, { id: 9 })
    assert.strictEqual(store.guardando, false)
  })

  it('si falla, devuelve un error de tres partes', async () => {
    const store = crearAuxiliaresStore({
      auxiliarService: {
        crearCasoParaMiAuxiliar: async () => {
          throw new Error('caída')
        },
      },
    })()

    const resultado = await store.crearCasoParaMiAuxiliar(5, { cliente: 'zz_test' })

    assert.strictEqual(resultado.ok, false)
    assert.match(store.error.mensaje, /Qué ocurrió:.*Sobre:.*Qué hacer:/s)
    assert.strictEqual(store.guardando, false)
  })
})

describe('formulario en modo «para mi auxiliar»', () => {
  it('recibe auxiliarDestino y cambia título, ayuda y botón', () => {
    const script = scriptDe(formulario)
    assert.match(script, /auxiliarDestino:\s*\{[^}]*type:\s*Object[^}]*default:\s*null/s)
    assert.match(script, /Registrar caso para \$\{nombre\}/)
    assert.match(script, /Asignar caso al auxiliar/)
    assert.match(script, /queda a su nombre y él recibe un aviso/)
  })

  it('guarda con el store de auxiliares y muestra «Caso importante» al contador', () => {
    assert.match(
      scriptDe(formulario),
      /auxiliares\.crearCasoParaMiAuxiliar\(props\.auxiliarDestino\.id/,
    )
    assert.match(plantillaDe(formulario), /v-if="!session\.esAuxiliar"[^>]*class="form-group"/)
  })

  it('no muestra «Contador asignado» con la contadora: el título ya dice para qué auxiliar es', () => {
    assert.match(
      plantillaDe(formulario),
      /<dl v-else-if="!modoAuxiliar && !modoParaMiAuxiliar" class="readonly-info">/,
    )
  })
})

describe('«Mis casos» y «Mi equipo»', () => {
  it('«Mis casos» ofrece «Registrar caso para» con los auxiliares y le pasa el destino al formulario', () => {
    const plantilla = plantillaDe(myCases)
    assert.match(plantilla, /v-if="misAuxiliares\.length > 0"/)
    assert.match(plantilla, /Registra el caso a nombre de este auxiliar y le avisa/)
    assert.match(plantilla, /:auxiliar-destino="auxiliarDestino"/)
    assert.match(scriptDe(myCases), /auxiliaresStore\.cargarAuxiliares\(/)
  })

  it('«Mi equipo» tiene un botón «Registrar caso» por auxiliar que abre el formulario con ese destino', () => {
    const plantilla = plantillaDe(miEquipo)
    assert.match(plantilla, /icon="add_circle"/)
    assert.match(plantilla, /label="Registrar caso"/)
    assert.match(plantilla, /<CaseFormDialog[^>]*:auxiliar-destino="auxiliarDestino"/s)
    assert.match(scriptDe(miEquipo), /refrescarEnSilencio\(\)/)
  })
})
