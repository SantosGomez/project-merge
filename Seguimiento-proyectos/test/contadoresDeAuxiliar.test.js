// Rama experimento (2026-11-10): el despacho vincula al auxiliar con sus contadores al darlo de
// alta y después desde el directorio («Contadores que apoya»).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { calcularCambiosDeContadores, crearUserService } from '../src/services/userService.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

describe('servicio: contadores de un auxiliar', () => {
  it('el alta de un auxiliar envía los contadores elegidos; la de otro rol, no', async () => {
    const cuerpos = []
    const servicio = crearUserService({ api: { post: async (_r, cuerpo) => (cuerpos.push(cuerpo), { data: { mensaje: 'ok' } }) } })
    const base = { nombre: 'Ana', correo: 'ana@delgrow.mx', password: 'Segura1234' }

    await servicio.crearUsuario({ ...base, rol: 'auxiliar', contadores: [3, 7] })
    await servicio.crearUsuario({ ...base, rol: 'contador', contadores: [3] })

    assert.deepEqual(cuerpos[0].contadores, [3, 7])
    assert.equal('contadores' in cuerpos[1], false)
  })

  it('lee y guarda los contadores de un auxiliar', async () => {
    const llamadas = []
    const servicio = crearUserService({
      api: {
        get: async (ruta) => (llamadas.push(['GET', ruta]), { data: { contadores: [{ id: 3, nombre: 'Tres' }] } }),
        put: async (ruta, cuerpo) => (llamadas.push(['PUT', ruta, cuerpo]), { data: { contadores: [] } }),
      },
    })

    assert.deepEqual(await servicio.listarContadoresDeAuxiliar(9), [{ id: 3, nombre: 'Tres' }])
    await servicio.guardarContadoresDeAuxiliar(9, { agregar: [7], quitar: [3] })
    assert.deepEqual(llamadas, [
      ['GET', '/usuarios/9/contadores'],
      ['PUT', '/usuarios/9/contadores', { agregar: [7], quitar: [3] }],
    ])
  })
})

describe('cambios del despacho en los contadores de un auxiliar', () => {
  it('solo cuenta lo que el despacho marcó o desmarcó frente a lo que cargó', () => {
    assert.deepEqual(calcularCambiosDeContadores([3, 7], [7, 9]), { agregar: [9], quitar: [3] })
  })

  it('sin tocar nada no hay cambios, aunque el orden sea otro', () => {
    assert.deepEqual(calcularCambiosDeContadores([3, 7], [7, 3]), { agregar: [], quitar: [] })
  })
})

describe('pantallas: alta y directorio', () => {
  const alta = leer('../src/components/NewUserDialog.vue')
  const directorio = leer('../src/pages/CountersDirectoryPage.vue')
  const dialogo = leer('../src/components/ContadoresDeAuxiliarDialog.vue')

  it('el alta muestra «Contadores que apoya» solo con el rol auxiliar', () => {
    assert.match(alta, /v-if="rol === 'auxiliar'"[\s\S]*?>Contador que apoya \(opcional\)<\/label>/)
    assert.match(alta, /contadores: rol\.value === 'auxiliar' \? contadoresElegidos\.value : undefined/)
  })

  it('el directorio ofrece «Contadores que apoya» en las filas de auxiliares y pasa los contadores', () => {
    assert.equal(
      (directorio.match(/v-if="props\.row\.rolClave === 'auxiliar' && !session\.esRecepcionista"/g) ?? []).length,
      2,
      'tabla y tarjeta',
    )
    assert.match(directorio, /<ContadoresDeAuxiliarDialog/)
    assert.match(directorio, /<NewUserDialog[^>]*:contadores="contadores"/)
    assert.match(directorio, /<ContadoresDeAuxiliarDialog[^>]*:contadores="contadores"/)
  })

  it('el diálogo carga lo actual y guarda con el servicio', () => {
    assert.match(dialogo, /listarContadoresDeAuxiliar\(/)
    assert.match(dialogo, /guardarContadoresDeAuxiliar\(/)
    assert.match(dialogo, /transition-show="dialogo-entra"/)
  })

  it('el diálogo guarda la diferencia contra lo que cargó y no llama al servidor si no hay cambios', () => {
    assert.match(dialogo, /calcularCambiosDeContadores\(cargados\.value, elegidos\.value\)/)
    assert.match(dialogo, /if \(sinCambios\) \{\s*dialogoAbierto\.value = false\s*return/)
    assert.match(dialogo, /guardarContadoresDeAuxiliar\(props\.cuenta\.id, cambios\)/)
  })
})

// Regla del 2026-11-11: un auxiliar apoya a un solo contador (un contador puede tener varios auxiliares).
describe('un auxiliar apoya a un solo contador', () => {
  const fuente = (ruta) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), 'utf8')
  const plantilla = (ruta) => fuente(ruta).split('<script')[0]

  it('el directorio elige un solo contador, sin selección múltiple', () => {
    const dialogoUno = plantilla('../src/components/ContadoresDeAuxiliarDialog.vue')
    assert.match(dialogoUno, />Contador que apoya</)
    assert.doesNotMatch(dialogoUno, /\bmultiple\b/, 'sin selección múltiple')
    assert.match(dialogoUno, /v-model="elegido"[\s\S]*?clearable/, 'se puede dejar sin contador')
    assert.match(dialogoUno, /Un auxiliar solo puede apoyar a un contador\./)
    assert.match(dialogoUno, /cargados\.length > 1[\s\S]*?Al guardar quedará solo con el que elijas/, 'avisa de vínculos viejos')
  })

  it('el alta elige un solo contador y lo envía como lista', () => {
    const altaUno = fuente('../src/components/NewUserDialog.vue')
    assert.doesNotMatch(altaUno.split('<script')[0], /\bmultiple\b/, 'sin selección múltiple')
    assert.match(altaUno, /contadorElegido\.value === null \? \[\] : \[contadorElegido\.value\]/)
  })

  it('cambiar de contador envía el nuevo en agregar y el anterior en quitar', async () => {
    const { calcularCambiosDeContadores } = await import('../src/services/userService.js')
    assert.deepEqual(calcularCambiosDeContadores([3], [7]), { agregar: [7], quitar: [3] })
    assert.deepEqual(calcularCambiosDeContadores([3, 5], [3]), { agregar: [], quitar: [5] }, 'vínculos viejos: deja uno')
    assert.deepEqual(calcularCambiosDeContadores([3], []), { agregar: [], quitar: [3] })
  })

  it('«Agregar auxiliares» explica por qué no aparecen todos', () => {
    assert.match(
      plantilla('../src/components/AgregarAuxiliaresDialog.vue').replace(/\s+/g, ' '),
      /Solo aparecen los auxiliares que todavía no apoyan a otro contador\./,
    )
  })
})
