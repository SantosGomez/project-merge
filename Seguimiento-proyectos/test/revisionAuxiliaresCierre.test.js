// Rebanada 7: cierre de los huecos de las rebanadas 2 y 5.
// A: el servicio pide los contadores disponibles.
// B: el store usa el servicio real y mantiene la lista de disponibles.
// C: la página de auxiliares deja de tener la lista vacía y entrega ids, no objetos.
// TDD: las pruebas fallan primero porque nada de esto existe o está cableado.

import { describe, it, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { createPinia, setActivePinia } from 'pinia'

const { crearAuxiliarService } = await import('../src/services/auxiliarService.js')
const { crearAuxiliaresStore, useAuxiliaresStore } = await import('../src/stores/auxiliares.js')
const { api } = await import('../src/services/api.js')

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const pagina = leer('../src/pages/ContadorAuxiliaresPage.vue')
const plantilla = pagina.split('<script')[0]
const estilos = pagina.slice(pagina.indexOf('<style'))
const misCasos = leer('../src/pages/MyCasesPage.vue')

const montarStore = (servicio) => {
  const useStore = crearAuxiliaresStore({ auxiliarService: servicio })
  return useStore()
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('Grupo A: servicio de auxiliares', () => {
  it('listarDisponibles pide los contadores asignables del contador', async () => {
    let rutaEnviada = null
    const apiFalsa = {
      get: async (ruta) => {
        rutaEnviada = ruta
        return { data: { contadores: [{ id: 4, nombre: 'Contador Cuatro' }] } }
      },
    }
    const servicio = crearAuxiliarService({ api: apiFalsa })

    const contadores = await servicio.listarDisponibles(3)

    assert.strictEqual(rutaEnviada, '/contadores/3/auxiliares-disponibles')
    assert.deepStrictEqual(contadores, [{ id: 4, nombre: 'Contador Cuatro' }])
  })
})

describe('Grupo B: store de auxiliares', () => {
  it('cargarDisponibles llena la lista y apaga la carga', async () => {
    const store = montarStore({
      listarDisponibles: async () => [{ id: 4, nombre: 'Contador Cuatro' }],
    })

    const resultado = await store.cargarDisponibles(3)

    assert.strictEqual(resultado.ok, true)
    assert.strictEqual(store.cargandoDisponibles, false)
    assert.deepStrictEqual(store.disponibles, [{ id: 4, nombre: 'Contador Cuatro' }])
    assert.strictEqual(store.errorDisponibles, null)
  })

  it('si falla la carga de disponibles, guarda un error de tres partes', async () => {
    const store = montarStore({
      listarDisponibles: async () => {
        throw new Error('caída')
      },
    })

    const resultado = await store.cargarDisponibles(3)

    assert.strictEqual(resultado.ok, false)
    assert.strictEqual(store.cargandoDisponibles, false)
    assert.ok(store.errorDisponibles.mensaje.includes('Qué ocurrió'))
    assert.ok(store.errorDisponibles.mensaje.includes('Sobre:'))
    assert.ok(store.errorDisponibles.mensaje.includes('Qué hacer:'))
  })

  it('al asignar, recarga auxiliares y disponibles', async () => {
    let disponiblesLlamados = 0
    const servicio = {
      asignarAuxiliar: async () => ({ mensaje: 'Ok.' }),
      listarAuxiliares: async () => [{ id: 4, nombre: 'Contador Cuatro' }],
      listarDisponibles: async () => {
        disponiblesLlamados += 1
        return []
      },
    }
    const store = montarStore(servicio)

    const resultado = await store.asignarAuxiliar(3, 4)

    assert.strictEqual(resultado.ok, true)
    assert.strictEqual(disponiblesLlamados, 1, 'la lista de disponibles se actualiza tras asignar')
  })

  it('el store por defecto usa el servicio real', async () => {
    const adaptadorAnterior = api.defaults.adapter
    const rutas = []
    api.defaults.adapter = async (config) => {
      rutas.push(config.url)
      return {
        data: config.url.includes('disponibles')
          ? { contadores: [{ id: 4, nombre: 'Contador Cuatro' }] }
          : { auxiliares: [{ id: 4, nombre: 'Contador Cuatro' }] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }

    try {
      const store = useAuxiliaresStore()
      const auxiliares = await store.cargarAuxiliares(3)
      const disponibles = await store.cargarDisponibles(3)

      assert.strictEqual(auxiliares.ok, true, 'la carga real no truena')
      assert.strictEqual(disponibles.ok, true)
      assert.deepStrictEqual(rutas, [
        '/contadores/3/auxiliares',
        '/contadores/3/auxiliares-disponibles',
      ])
    } finally {
      api.defaults.adapter = adaptadorAnterior
    }
  })
})

describe('Grupo C: página de gestión de auxiliares', () => {
  it('no tiene la lista de contadores vacía de relleno', () => {
    assert.doesNotMatch(pagina, /contadoresDisponibles/)
    assert.doesNotMatch(pagina, /return \[\]/)
  })

  // Desde el rediseño (2026-11-10) los disponibles se eligen en AgregarAuxiliaresDialog.vue.
  const dialogoAgregar = leer('../src/components/AgregarAuxiliaresDialog.vue')

  it('carga los auxiliares disponibles desde el store', () => {
    assert.match(dialogoAgregar, /cargarDisponibles/)
    assert.match(dialogoAgregar, /auxiliares\.disponibles/)
  })

  it('entrega el id del auxiliar, no la opción completa', () => {
    assert.match(dialogoAgregar, /<q-checkbox v-model="seleccionados" :val="auxiliar\.id"/)
  })

  it('compara los ids como números', () => {
    assert.match(dialogoAgregar, /Number\(session\.id\)/)
    assert.match(pagina, /Number\(session\.id\)/)
  })

  it('usa clases propias para los campos, no etiquetas de Quasar', () => {
    assert.match(dialogoAgregar, /class="input-moderno"/)
    assert.doesNotMatch(estilos, /\.auxiliares-page__\w+ q-(input|select)/)
  })

  it('el selector «Registrar caso para» de Mis casos también entrega el id', () => {
    const bloque = misCasos.slice(misCasos.indexOf('Registrar caso para') - 900, misCasos.indexOf('Registrar caso para'))
    assert.match(bloque, /emit-value/)
    assert.match(bloque, /map-options/)
  })
})

// 2026-11-10: «Mis casos» llamaba a esta acción, pero nunca existió en el store; el selector
// «Registrar caso para» del auxiliar no cargaba (TypeError en la consola).
describe('Grupo D: contadores a los que apoya el auxiliar («Registrar caso para»)', () => {
  it('el store pide al servicio los contadores que tienen al usuario como auxiliar', async () => {
    let idEnviado = null
    const store = montarStore({
      listarContadoresQueMeTienenComoAuxiliar: async (id) => {
        idEnviado = id
        return [{ id: 7, nombre: 'Contadora Dueña' }]
      },
    })

    const resultado = await store.listarContadoresQueMeTienenComoAuxiliar(5)

    assert.strictEqual(idEnviado, 5)
    assert.deepStrictEqual(resultado, { ok: true, contadores: [{ id: 7, nombre: 'Contadora Dueña' }] })
  })

  it('si falla, no lanza: devuelve un error de tres partes', async () => {
    const store = montarStore({
      listarContadoresQueMeTienenComoAuxiliar: async () => {
        throw new Error('caída')
      },
    })

    const resultado = await store.listarContadoresQueMeTienenComoAuxiliar(5)

    assert.strictEqual(resultado.ok, false)
    assert.match(resultado.error.mensaje, /\S/)
  })

  it('«Mis casos» usa la lista de contadores que devuelve el store', () => {
    assert.match(misCasos, /auxiliaresStore\.listarContadoresQueMeTienenComoAuxiliar\(/)
    assert.match(misCasos, /contadoresQueMeTienenComoAuxiliar\.value = resultado\.contadores/)
  })
})

describe('Grupo E: tras registrar para otro contador, el caso se ve sin recargar', () => {
  it('alRegistrar refresca la lista cuando el caso fue para el contador al que apoyas', () => {
    const cuerpo = misCasos.slice(misCasos.indexOf('const alRegistrar'), misCasos.indexOf('const retry'))
    assert.match(cuerpo, /if \(contadorSeleccionadoParaRegistro\.value !== null\)[\s\S]*?cases\.refrescarEnSilencio\(\)/)
    assert.ok(
      cuerpo.indexOf('refrescarEnSilencio') < cuerpo.indexOf('contadorSeleccionadoParaRegistro.value = null'),
      'refresca antes de limpiar el selector',
    )
  })
})

// 2026-11-10: la plantilla leía el store como si fuera la lista (`auxiliares.length`), así que
// los asignados nunca se mostraban aunque se guardaran.
describe('Grupo F: «Mis auxiliares» muestra a los asignados', () => {
  it('la lista recorre auxiliares.auxiliares, no el store', () => {
    assert.match(plantilla, /<q-list\s+v-if="auxiliares\.auxiliares\.length > 0"/)
    assert.match(plantilla, /v-for="auxiliar in auxiliares\.auxiliares"/)
    assert.doesNotMatch(plantilla, /v-if="auxiliares\.length/)
  })
})

// 2026-11-10: rediseño de la vinculación (decisión del usuario): botón «Agregar auxiliar» que abre
// un diálogo con todos los disponibles (filtro opcional, se marcan uno o varios) y confirmación al quitar.
describe('Grupo G: asignar varios auxiliares desde el diálogo', () => {
  it('asigna cada uno y recarga las listas una sola vez', async () => {
    const asignados = []
    let recargas = 0
    const store = montarStore({
      asignarAuxiliar: async (contadorId, auxiliarId) => asignados.push([contadorId, auxiliarId]),
      listarAuxiliares: async () => {
        recargas += 1
        return [{ id: 7, nombre: 'Siete' }, { id: 8, nombre: 'Ocho' }]
      },
      listarDisponibles: async () => [],
    })

    const resultado = await store.asignarVarios(3, [7, 8])

    assert.deepStrictEqual(asignados, [[3, 7], [3, 8]])
    assert.strictEqual(recargas, 1, 'una sola recarga al final')
    assert.deepStrictEqual(resultado, { ok: true, asignados: 2, fallidos: [] })
    assert.deepStrictEqual(store.auxiliares.map((a) => a.id), [7, 8])
    assert.strictEqual(store.guardando, false)
  })

  it('si uno falla, los demás se asignan y se informa cuál falló', async () => {
    const store = montarStore({
      asignarAuxiliar: async (_contadorId, auxiliarId) => {
        if (auxiliarId === 8) throw { mensaje: 'Qué ocurrió: La cuenta no es un auxiliar.' }
      },
      listarAuxiliares: async () => [{ id: 7, nombre: 'Siete' }],
      listarDisponibles: async () => [],
    })

    const resultado = await store.asignarVarios(3, [7, 8])

    assert.strictEqual(resultado.ok, false)
    assert.strictEqual(resultado.asignados, 1)
    assert.deepStrictEqual(resultado.fallidos.map((f) => f.id), [8])
    assert.match(resultado.fallidos[0].error.mensaje, /no es un auxiliar/)
    assert.strictEqual(store.guardando, false)
  })
})

describe('Grupo H: «Mis auxiliares» rediseñada', () => {
  const dialogo = leer('../src/components/AgregarAuxiliaresDialog.vue')
  const plantillaDialogo = dialogo.split('<script')[0]

  it('la pantalla abre el diálogo con «Agregar auxiliar» y ya no tiene el buscador de dos pasos', () => {
    assert.match(plantilla, /label="Agregar auxiliar"[\s\S]*?@click="dialogoAgregarAbierto = true"/)
    assert.match(plantilla, /<AgregarAuxiliaresDialog[\s\S]*?v-model="dialogoAgregarAbierto"/)
    assert.match(plantilla, /action-label="Agregar auxiliar"[\s\S]*?@action="dialogoAgregarAbierto = true"/)
    assert.doesNotMatch(plantilla, /Buscar un auxiliar para asignarlo/)
  })

  it('las filas de la lista no fingen ser clicables y quitar pide confirmación', () => {
    assert.doesNotMatch(plantilla, /class="q-item--nav auxiliar-item"/)
    assert.match(pagina, /\$q\.dialog\(\{[\s\S]*?title: '¿Quitar auxiliar\?'[\s\S]*?\.onOk\(/)
  })

  it('el diálogo lista a todos los disponibles con casilla, filtro opcional y «Asignar (n)»', () => {
    assert.match(plantillaDialogo, /transition-show="dialogo-entra"/)
    assert.match(plantillaDialogo, /<q-checkbox/)
    assert.match(plantillaDialogo, /placeholder="Filtrar por nombre"/)
    assert.match(plantillaDialogo, /:label="`Asignar \(\$\{seleccionados\.length\}\)`"/)
    assert.match(plantillaDialogo, /:disable="seleccionados\.length === 0 \|\| guardando"/)
  })

  it('el diálogo muestra el error de carga de disponibles con «Reintentar» y explica quién da de alta', () => {
    assert.match(plantillaDialogo, /auxiliares\.errorDisponibles/)
    assert.match(plantillaDialogo, /label="Reintentar"/)
    assert.match(dialogo, /usuario de sistema/)
  })
})
