// Rebanada 11: cartera por tipo de actividad y lista del mes dentro de «Mis actividades».

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { crearActividadService } from '../src/services/actividadService.js'
import { crearTipoActividadService } from '../src/services/tipoActividadService.js'
import {
  agruparPorTipo,
  calcularCambiosDeCartera,
  diagnosticoVacio,
  esMesValido,
  etiquetaDeMes,
  mesActual,
  mesAnterior,
  mesSiguiente,
  totalesDelMes,
} from '../src/utils/actividades.js'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]

// Api falsa: registra cada llamada (el segundo argumento es el cuerpo o la configuración).
const crearApiFalsa = (responder) => {
  const llamadas = []
  const registrar = (metodo) => async (url, cuerpo) => {
    llamadas.push({ metodo, url, cuerpo })
    return responder(metodo, url, cuerpo)
  }
  return {
    llamadas,
    get: registrar('get'),
    post: registrar('post'),
    patch: registrar('patch'),
    put: registrar('put'),
  }
}

describe('meses (texto AAAA-MM, sin Date de texto)', () => {
  it('mesActual usa la hora local de la fecha recibida', () => {
    assert.equal(mesActual(new Date(2026, 10, 13)), '2026-11')
    assert.equal(mesActual(new Date(2027, 0, 1, 0, 5)), '2027-01')
    assert.equal(mesActual(new Date(2026, 11, 31, 23, 59)), '2026-12')
  })

  it('mesAnterior y mesSiguiente cruzan el cambio de año', () => {
    assert.equal(mesAnterior('2026-11'), '2026-10')
    assert.equal(mesAnterior('2026-01'), '2025-12')
    assert.equal(mesSiguiente('2026-11'), '2026-12')
    assert.equal(mesSiguiente('2026-12'), '2027-01')
  })

  it('esMesValido acepta solo AAAA-MM con mes de 01 a 12', () => {
    for (const bueno of ['2026-01', '2026-12', '1999-06']) assert.equal(esMesValido(bueno), true)
    for (const malo of [
      '2026-13',
      '2026-00',
      '2026-1',
      '2026-11-01',
      'noviembre',
      '',
      null,
      undefined,
      202611,
    ])
      assert.equal(esMesValido(malo), false, String(malo))
  })

  it('etiquetaDeMes escribe el mes en español', () => {
    assert.equal(etiquetaDeMes('2026-11'), 'Noviembre de 2026')
    assert.equal(etiquetaDeMes('2027-01'), 'Enero de 2027')
  })
})

const renglon = (tipo_id, tipo, cliente_id, cliente, hecha = false, extra = {}) => ({
  tipo_id,
  tipo,
  tipo_activo: true,
  cliente_id,
  cliente,
  cliente_activo: true,
  hecha,
  hecha_en: hecha ? '2026-11-05 10:00:00' : null,
  ...extra,
})

describe('agruparPorTipo y totalesDelMes', () => {
  const actividades = [
    renglon(1, 'Alfa', 10, 'Ana', true),
    renglon(1, 'Alfa', 11, 'Beto'),
    renglon(2, 'Beta', 10, 'Ana', true, { tipo_activo: false }),
  ]

  it('agrupa por tipo en el orden recibido y cuenta las hechas (lo pendiente va antes que lo hecho)', () => {
    const grupos = agruparPorTipo(actividades)
    assert.equal(grupos.length, 2)
    assert.deepEqual(
      grupos.map((g) => [g.tipo_id, g.tipo, g.hechas, g.total, g.tipo_activo]),
      [
        [1, 'Alfa', 1, 2, true],
        [2, 'Beta', 1, 1, false],
      ],
    )
    // Regla de la rebanada 12: dentro del grupo, primero lo pendiente y luego lo hecho.
    assert.deepEqual(
      grupos[0].renglones.map((r) => r.cliente),
      ['Beto', 'Ana'],
    )
  })

  it('totalesDelMes suma las hechas y el total de todos los grupos', () => {
    assert.deepEqual(totalesDelMes(agruparPorTipo(actividades)), { hechas: 2, total: 3 })
    assert.deepEqual(totalesDelMes([]), { hechas: 0, total: 0 })
    assert.deepEqual(agruparPorTipo([]), [])
  })

  it('no modifica la lista recibida', () => {
    const copia = JSON.parse(JSON.stringify(actividades))
    agruparPorTipo(actividades)
    assert.deepEqual(actividades, copia)
  })
})

describe('calcularCambiosDeCartera', () => {
  it('devuelve solo la diferencia entre lo cargado y lo elegido', () => {
    assert.deepEqual(calcularCambiosDeCartera([1, 2, 3], [2, 3, 4, 5]), {
      agregar: [4, 5],
      quitar: [1],
    })
    assert.deepEqual(calcularCambiosDeCartera([1, 2], [1, 2]), { agregar: [], quitar: [] })
    assert.deepEqual(calcularCambiosDeCartera([], [7]), { agregar: [7], quitar: [] })
    assert.deepEqual(calcularCambiosDeCartera([7], []), { agregar: [], quitar: [7] })
  })
})

describe('diagnosticoVacio', () => {
  const cliente = (activo = true) => ({ id: 1, nombre: 'A', activo })
  const tipo = (total_clientes = 0, activo = true) => ({
    id: 1,
    nombre: 'T',
    activo,
    total_clientes,
  })

  it('sin clientes activos, pide agregar clientes', () => {
    assert.equal(diagnosticoVacio({ clientes: [], tipos: [tipo(1)] }), 'sin-clientes')
    assert.equal(diagnosticoVacio({ clientes: [cliente(false)], tipos: [tipo(1)] }), 'sin-clientes')
  })

  it('sin tipos activos, pide agregar tipos', () => {
    assert.equal(diagnosticoVacio({ clientes: [cliente()], tipos: [] }), 'sin-tipos')
    assert.equal(diagnosticoVacio({ clientes: [cliente()], tipos: [tipo(2, false)] }), 'sin-tipos')
  })

  it('con catálogos pero sin clientes en ningún tipo activo, explica el botón «Clientes»', () => {
    assert.equal(diagnosticoVacio({ clientes: [cliente()], tipos: [tipo(0)] }), 'sin-cartera')
  })

  it('con cartera pero sin renglones, es un mes sin actividades', () => {
    assert.equal(diagnosticoVacio({ clientes: [cliente()], tipos: [tipo(2)] }), 'sin-renglones')
  })
})

describe('actividadService', () => {
  it('listarActividades pide GET /actividades con el mes y devuelve mes y renglones', async () => {
    const api = crearApiFalsa(() => ({
      data: { mes: '2026-11', actividades: [{ cliente_id: 1 }] },
    }))
    const resultado = await crearActividadService({ api }).listarActividades('2026-11')
    assert.deepEqual(api.llamadas, [
      { metodo: 'get', url: '/actividades', cuerpo: { params: { mes: '2026-11' } } },
    ])
    assert.deepEqual(resultado, { mes: '2026-11', actividades: [{ cliente_id: 1 }] })
  })

  it('listarActividades falla con error de tres partes si la respuesta no trae la lista', async () => {
    const api = crearApiFalsa(() => ({ data: {} }))
    await assert.rejects(crearActividadService({ api }).listarActividades('2026-11'), (error) => {
      assert.equal(error.estado, 'respuesta_inesperada')
      return true
    })
  })

  it('guardarEstado envía PUT /actividades/estado y devuelve la actividad', async () => {
    const api = crearApiFalsa((metodo, url, cuerpo) => ({ data: { actividad: { ...cuerpo } } }))
    const actividad = await crearActividadService({ api }).guardarEstado({
      cliente_id: 3,
      tipo_id: 4,
      mes: '2026-11',
      hecha: true,
    })
    assert.deepEqual(api.llamadas[0], {
      metodo: 'put',
      url: '/actividades/estado',
      cuerpo: { cliente_id: 3, tipo_id: 4, mes: '2026-11', hecha: true },
    })
    assert.equal(actividad.hecha, true)
  })

  it('guardarEstado falla si la respuesta no trae la actividad', async () => {
    const api = crearApiFalsa(() => ({ data: {} }))
    await assert.rejects(
      crearActividadService({ api }).guardarEstado({
        cliente_id: 1,
        tipo_id: 1,
        mes: '2026-11',
        hecha: false,
      }),
    )
  })
})

describe('tipoActividadService: clientes del tipo', () => {
  it('listarClientesDeTipo pide GET /tipos-actividad/:id/clientes y devuelve los ids', async () => {
    const api = crearApiFalsa(() => ({ data: { cliente_ids: [1, 2] } }))
    const ids = await crearTipoActividadService({ api }).listarClientesDeTipo(4)
    assert.deepEqual(api.llamadas, [
      { metodo: 'get', url: '/tipos-actividad/4/clientes', cuerpo: undefined },
    ])
    assert.deepEqual(ids, [1, 2])
  })

  it('guardarClientesDeTipo envía PUT con agregar y quitar y devuelve los ids que quedan', async () => {
    const api = crearApiFalsa(() => ({ data: { cliente_ids: [2, 3] } }))
    const ids = await crearTipoActividadService({ api }).guardarClientesDeTipo(4, {
      agregar: [3],
      quitar: [1],
    })
    assert.deepEqual(api.llamadas[0], {
      metodo: 'put',
      url: '/tipos-actividad/4/clientes',
      cuerpo: { agregar: [3], quitar: [1] },
    })
    assert.deepEqual(ids, [2, 3])
  })

  it('falla si la respuesta no trae los ids', async () => {
    const api = crearApiFalsa(() => ({ data: {} }))
    const servicio = crearTipoActividadService({ api })
    await assert.rejects(servicio.listarClientesDeTipo(1))
    await assert.rejects(servicio.guardarClientesDeTipo(1, { agregar: [], quitar: [] }))
  })
})

describe('«Mis actividades»: conmutador de vistas', () => {
  const fuente = leer('../src/components/MisActividades.vue')
  const plantilla = plantillaDe(fuente)

  it('tiene el conmutador «Lista del mes» | «Clientes y tipos» y la vista va en ?vista=catalogos', () => {
    assert.match(plantilla, /<q-btn-toggle/)
    assert.match(plantilla, /Lista del mes/)
    assert.match(plantilla, /Clientes y tipos/)
    assert.match(plantilla, /<ListaDelMes/)
    assert.match(plantilla, /<MisClientes\s*\/>/)
    assert.match(plantilla, /<MisTiposActividad\s*\/>/)
    assert.match(fuente, /route\.query\.vista/)
    assert.match(fuente, /catalogos/)
    assert.match(fuente, /\.\.\.route\.query/, 'conserva los demás parámetros de la dirección')
    assert.match(fuente, /router\.replace\(/)
  })

  it('el conmutador tiene tooltip y es táctil', () => {
    assert.match(plantilla, /<q-tooltip>/)
    assert.match(plantilla, /control-touch/)
  })
})

describe('«Lista del mes» y diálogo de clientes del tipo', () => {
  const archivos = [
    '../src/components/ListaDelMes.vue',
    '../src/components/ClientesDeTipoDialog.vue',
    '../src/components/MisTiposActividad.vue',
    '../src/components/MisActividades.vue',
  ]

  it('existen los componentes de la rebanada', () => {
    for (const archivo of archivos) assert.ok(existsSync(ruta(archivo)), archivo)
  })

  it('la lista del mes agrupa por tipo, marca hecha y cambia de mes', () => {
    const fuente = leer('../src/components/ListaDelMes.vue')
    const plantilla = plantillaDe(fuente)
    assert.match(plantilla, /<q-expansion-item/)
    assert.match(plantilla, /<q-checkbox/)
    assert.match(plantilla, /Hecha/)
    assert.match(plantilla, /Mes anterior/)
    assert.match(plantilla, /Mes siguiente/)
    assert.match(plantilla, /Hoy/)
    assert.match(plantilla, /hechas de|de \{\{ grupo\.total \}\}|grupo\.total/)
    assert.match(plantilla, /<ScreenLoader/)
    assert.match(plantilla, /<ErrorState/)
    assert.match(plantilla, /<EmptyState/)
    assert.match(plantilla, /Reintentar|@retry/)
    assert.match(plantilla, /<q-tooltip>/)
    assert.match(fuente, /route\.query\.mes/)
    assert.match(fuente, /visibilitychange/)
    assert.match(fuente, /removeEventListener\('visibilitychange'/)
    assert.match(fuente, /guardarEstado/)
  })

  it('la lista del mes revierte la casilla y avisa si el guardado falla', () => {
    const fuente = leer('../src/components/ListaDelMes.vue')
    assert.match(fuente, /type: 'negative'/)
    assert.match(fuente, /No se pudo guardar/)
  })

  it('los estados vacíos guían hacia «Clientes y tipos» y explican el botón «Clientes»', () => {
    const fuente = leer('../src/components/ListaDelMes.vue')
    assert.match(fuente, /diagnosticoVacio/)
    assert.match(fuente, /Clientes y tipos/)
    assert.match(fuente, /«Clientes»/)
  })

  it('el diálogo de clientes sigue las convenciones del proyecto', () => {
    const fuente = leer('../src/components/ClientesDeTipoDialog.vue')
    assert.match(fuente, /:persistent="guardando \|\| hayDatosSinGuardar"/)
    assert.match(fuente, /@shake="pedirDescartar"/)
    assert.match(fuente, /¿Descartar los cambios\?/)
    assert.match(fuente, /dialogo-entra/)
    assert.match(fuente, /dialogo-sale/)
    assert.match(fuente, /<q-checkbox/)
    assert.match(fuente, /filtrarContadores/)
    assert.match(fuente, /calcularCambiosDeCartera/)
    assert.match(fuente, /guardarClientesDeTipo/)
    assert.match(fuente, /<q-tooltip>/)
    assert.match(fuente, /Reintentar|@retry/)
  })

  it('«Mis tipos de actividad» tiene el botón «Clientes» y muestra cuántos clientes tiene cada tipo', () => {
    const fuente = leer('../src/components/MisTiposActividad.vue')
    const plantilla = plantillaDe(fuente)
    assert.match(plantilla, /label="Clientes"/)
    assert.match(plantilla, /total_clientes/)
    assert.match(plantilla, /<ClientesDeTipoDialog/)
  })

  it('cada grupo plegable y cada casilla del diálogo dicen a qué tipo o cliente pertenecen', () => {
    const lista = plantillaDe(leer('../src/components/ListaDelMes.vue'))
    const grupo = lista.slice(
      lista.indexOf('<q-expansion-item'),
      lista.indexOf('<template #header>'),
    )
    // Sin esto, Quasar nombra todas las cabeceras «Colapsar» y el lector de pantalla no distingue el grupo.
    assert.match(grupo, /:toggle-aria-label="[^"]*grupo\.tipo[^"]*grupo\.hechas[^"]*grupo\.total/)

    const dialogo = plantillaDe(leer('../src/components/ClientesDeTipoDialog.vue'))
    const casilla = dialogo.slice(dialogo.indexOf('<q-checkbox'))
    assert.match(casilla.slice(0, casilla.indexOf('/>')), /:aria-label="[^"]*cliente\.nombre/)
  })

  it('usan componentes de Quasar y colores de la paleta, sin hexadecimales ni cubic-bezier, y hablan de tú', () => {
    for (const archivo of archivos) {
      const fuente = leer(archivo)
      assert.doesNotMatch(fuente, /#[0-9a-fA-F]{3,8}\b/, `${archivo}: hexadecimal suelto`)
      assert.doesNotMatch(fuente, /cubic-bezier/, archivo)
      assert.doesNotMatch(plantillaDe(fuente), /\busted\b|\bpodés\b|\bescribí\b/i, archivo)
    }
  })
})
