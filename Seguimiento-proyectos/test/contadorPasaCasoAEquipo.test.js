// Rebanada 38: el contador pasa un caso existente dentro de su equipo.
// Utilidad, servicio y store por comportamiento; la interfaz se comprueba leyendo las plantillas.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { createPinia, setActivePinia } from 'pinia'

const { armarEquipoParaPasar, destinosParaPasar, textoDestino } =
  await import('../src/utils/pasarCaso.js')
const { crearCaseService } = await import('../src/services/caseService.js')
const { crearCasesStore } = await import('../src/stores/cases.js')

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]
const scriptDe = (fuente) => fuente.slice(fuente.indexOf('<script'), fuente.indexOf('<style'))

const casoItem = leer('../src/components/CasoItem.vue')
const myCases = leer('../src/pages/MyCasesPage.vue')
const miEquipo = leer('../src/components/MiEquipo.vue')

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('equipo y destinos para pasar un caso', () => {
  const auxiliares = [
    { id: 11, nombre: 'Ana' },
    { id: 12, nombre: 'Beto' },
  ]

  it('sin auxiliares no hay equipo: la acción no se ofrece', () => {
    assert.deepStrictEqual(armarEquipoParaPasar(3, []), [])
    assert.deepStrictEqual(armarEquipoParaPasar(3, undefined), [])
  })

  it('el equipo es el contador («A mí») y sus auxiliares', () => {
    const equipo = armarEquipoParaPasar(3, auxiliares)
    assert.deepStrictEqual(
      equipo.map((p) => [p.id, p.esPropio]),
      [
        [3, true],
        [11, false],
        [12, false],
      ],
    )
  })

  it('los destinos excluyen al dueño actual', () => {
    const equipo = armarEquipoParaPasar(3, auxiliares)
    assert.deepStrictEqual(
      destinosParaPasar(equipo, 3).map((p) => p.id),
      [11, 12],
    )
    assert.deepStrictEqual(
      destinosParaPasar(equipo, 11).map((p) => p.id),
      [3, 12],
    )
  })

  it('si el dueño no es del equipo (caso del contador al que apoyas) no hay destinos', () => {
    const equipo = armarEquipoParaPasar(3, auxiliares)
    assert.deepStrictEqual(destinosParaPasar(equipo, 99), [])
    assert.deepStrictEqual(destinosParaPasar(equipo, null), [])
  })

  it('el texto del destino dice «tu lista» para el propio contador', () => {
    const equipo = armarEquipoParaPasar(3, auxiliares)
    assert.strictEqual(textoDestino(equipo[0]), 'tu lista')
    assert.strictEqual(textoDestino(equipo[1]), 'Ana')
  })
})

describe('servicio pasarCaso', () => {
  it('llama a PATCH /casos/:id/responsable con responsable_id y traduce el caso', async () => {
    let enviado = null
    const api = {
      patch: async (ruta, cuerpo) => {
        enviado = { ruta, cuerpo }
        return {
          data: {
            mensaje: 'Caso pasado correctamente',
            caso: {
              id: 9,
              cliente: 'zz_test',
              estado: 'Pendiente',
              prioridad: 'Alta',
              contador_id: 11,
            },
          },
        }
      },
    }
    const caso = await crearCaseService({ api }).pasarCaso(9, 11)
    assert.deepStrictEqual(enviado, {
      ruta: '/casos/9/responsable',
      cuerpo: { responsable_id: 11 },
    })
    assert.strictEqual(caso.contador_id, 11)
    assert.strictEqual(caso.estado, 'pendiente')
  })

  it('una respuesta sin caso lanza un error de tres partes', async () => {
    const api = { patch: async () => ({ data: {} }) }
    await assert.rejects(crearCaseService({ api }).pasarCaso(9, 11), (e) => {
      assert.match(e.mensaje, /Qué ocurrió:.*Sobre:.*Qué hacer:/s)
      return true
    })
  })
})

describe('store pasarCaso', () => {
  const casoDe = (id, duenio, nombre = 'Yo') => ({
    id,
    cliente: `Cliente ${id}`,
    estado: 'pendiente',
    prioridad: 'alta',
    contador_id: duenio,
    nombre_contador: nombre,
  })

  it('mueve el caso de dueño en la lista sin recargar y conserva sus datos', async () => {
    let listados = 0
    const servicio = {
      getMisCasos: async () => {
        listados += 1
        return [casoDe(1, 3), casoDe(2, 3)]
      },
      pasarCaso: async (id, responsableId) => ({
        ...casoDe(id, responsableId),
        nombre_contador: '',
      }),
    }
    const store = crearCasesStore({ caseService: servicio })()
    await store.cargarCasos()

    const resultado = await store.pasarCaso(1, 11, 'Ana')

    assert.strictEqual(resultado.ok, true)
    assert.strictEqual(listados, 1, 'no recarga la lista')
    const movido = store.casos.find((c) => c.id === 1)
    assert.strictEqual(movido.contador_id, 11)
    assert.strictEqual(movido.nombre_contador, 'Ana')
    assert.strictEqual(store.casos.find((c) => c.id === 2).contador_id, 3, 'los demás no cambian')
    assert.strictEqual(store.guardando, false)
  })

  it('si falla, la lista no cambia y devuelve un error de tres partes', async () => {
    const servicio = {
      getMisCasos: async () => [casoDe(1, 3)],
      pasarCaso: async () => {
        throw new Error('caída')
      },
    }
    const store = crearCasesStore({ caseService: servicio })()
    await store.cargarCasos()

    const resultado = await store.pasarCaso(1, 11, 'Ana')

    assert.strictEqual(resultado.ok, false)
    assert.match(resultado.error.mensaje, /Qué ocurrió:.*Sobre:.*Qué hacer:/s)
    assert.strictEqual(store.casos[0].contador_id, 3)
    assert.strictEqual(store.guardando, false)
  })
})

describe('interfaz de «Pasar a…»', () => {
  it('CasoItem ofrece el botón con menú, tooltip y animación de 180 ms, solo con destinos', () => {
    const plantilla = plantillaDe(casoItem)
    assert.match(plantilla, /icon="swap_horiz"/)
    assert.match(plantilla, /label="Pasar a…"/)
    assert.match(plantilla, /Pasa este caso a otra persona de tu equipo/)
    assert.match(
      plantilla,
      /<q-menu[^>]*transition-show="jump-down"[^>]*:transition-duration="180"/s,
    )
    assert.match(plantilla, /v-if="destinosPasar\.length > 0"/)
    assert.match(plantilla, /A mí/)
    assert.match(
      scriptDe(casoItem),
      /equipoParaPasar:\s*\{[^}]*type:\s*Array[^}]*default:\s*\(\) => \[\]/s,
    )
    assert.match(
      scriptDe(casoItem),
      /destinosParaPasar\(props\.equipoParaPasar, props\.caso\.counterId\)/,
    )
    assert.match(scriptDe(casoItem), /'pasar'/)
  })

  it('el botón no sale en la vista de solo lectura ni en casos de solo estado', () => {
    assert.match(scriptDe(casoItem), /props\.soloLectura \|\| soloCambiaEstado\.value/)
  })

  it('«Mis casos» arma el equipo solo para el contador y confirma antes de guardar', () => {
    const plantilla = plantillaDe(myCases)
    assert.match(plantilla, /:equipo-para-pasar="equipoParaPasar"/)
    assert.match(plantilla, /@pasar="\(destino\) => pedirPasarCaso\(item\.id, destino\)"/)
    const script = scriptDe(myCases)
    assert.match(script, /session\.esContador \? armarEquipoParaPasar\(/)
    assert.match(script, /¿Pasar «\$\{cliente\}» a \$\{textoDestino\(destino\)\}\?/)
    assert.match(script, /cases\.pasarCaso\(/)
    assert.match(script, /Caso pasado a \$\{textoDestino\(destino\)\}/)
  })

  it('«Mi equipo» también confirma y guarda con el store', () => {
    const plantilla = plantillaDe(miEquipo)
    assert.match(plantilla, /:equipo-para-pasar="equipoParaPasar"/)
    const script = scriptDe(miEquipo)
    assert.match(script, /¿Pasar «\$\{cliente\}» a \$\{textoDestino\(destino\)\}\?/)
    assert.match(script, /cases\.pasarCaso\(/)
  })
})

describe('mientras se pasa un caso y ante un conflicto', () => {
  it('«Mis casos» deshabilita la fila mientras se guarda y relee en silencio ante un 409', () => {
    const script = scriptDe(myCases)
    const cuerpo = script.slice(script.indexOf('const pedirPasarCaso'))
    assert.match(cuerpo, /guardandoId\.value = caseId/)
    assert.match(cuerpo, /guardandoId\.value = null/)
    assert.match(cuerpo, /codigoHttp === 409[\s\S]*refrescarEnSilencio\(\)/)
  })

  it('«Mi equipo» deshabilita la fila mientras se guarda y relee en silencio ante un 409', () => {
    assert.match(plantillaDe(miEquipo), /guardandoId === caso\.id \|\| pasandoId === caso\.id/)
    const script = scriptDe(miEquipo)
    const cuerpo = script.slice(script.indexOf('const pedirPasarCaso'))
    assert.match(cuerpo, /pasandoId\.value = caso\.id/)
    assert.match(cuerpo, /pasandoId\.value = null/)
    assert.match(cuerpo, /codigoHttp === 409[\s\S]*refrescarEnSilencio\(\)/)
  })
})
