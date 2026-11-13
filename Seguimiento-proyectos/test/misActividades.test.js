// Rebanada 10: «Mi trabajo» con pestañas «Mis casos» y «Mis actividades», y en esta última
// los clientes y los tipos de actividad propios de cada contador o auxiliar.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { crearClienteService } from '../src/services/clienteService.js'
import { crearTipoActividadService } from '../src/services/tipoActividadService.js'
import {
  mezclarEnLista,
  normalizarRfc,
  validarDatosCliente,
  validarDatosTipo,
} from '../src/utils/actividades.js'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]

// Api falsa: registra cada llamada y responde con el manejador recibido.
const crearApiFalsa = (responder) => {
  const llamadas = []
  const registrar = (metodo) => async (url, cuerpo) => {
    llamadas.push({ metodo, url, cuerpo })
    return responder(metodo, url, cuerpo)
  }
  return { llamadas, get: registrar('get'), post: registrar('post'), patch: registrar('patch') }
}

describe('normalizarRfc', () => {
  it('recorta, pasa a mayúsculas y deja null lo vacío', () => {
    assert.equal(normalizarRfc('  abc010101xy1 '), 'ABC010101XY1')
    assert.equal(normalizarRfc('   '), null)
    assert.equal(normalizarRfc(''), null)
    assert.equal(normalizarRfc(null), null)
  })
})

describe('validarDatosCliente', () => {
  it('acepta un nombre solo y un RFC de 12 o 13 caracteres con forma de RFC', () => {
    assert.equal(validarDatosCliente({ nombre: 'Abarrotes', rfc: '' }).valido, true)
    assert.equal(validarDatosCliente({ nombre: 'Abarrotes', rfc: 'abc010101xy1' }).valido, true)
    assert.equal(validarDatosCliente({ nombre: 'Persona', rfc: 'GOMS800101AB1' }).valido, true)
  })

  it('exige el nombre y respeta el máximo de 150 sin contar espacios extremos', () => {
    assert.match(
      validarDatosCliente({ nombre: '   ', rfc: '' }).errores.nombre,
      /Escribe el nombre/,
    )
    assert.equal(validarDatosCliente({ nombre: ` ${'x'.repeat(150)} `, rfc: '' }).valido, true)
    assert.match(validarDatosCliente({ nombre: 'x'.repeat(151), rfc: '' }).errores.nombre, /150/)
  })

  it('rechaza un RFC con forma incorrecta y dice cómo corregirlo', () => {
    const { valido, errores } = validarDatosCliente({ nombre: 'A', rfc: 'ABC123' })
    assert.equal(valido, false)
    assert.match(errores.rfc, /12 o 13 caracteres/)
    assert.equal(errores.nombre, undefined)
  })
})

describe('validarDatosTipo', () => {
  it('exige el nombre y respeta el máximo de 120', () => {
    assert.equal(validarDatosTipo({ nombre: 'Revisión de facturas' }).valido, true)
    assert.match(validarDatosTipo({ nombre: ' ' }).errores.nombre, /Escribe el nombre/)
    assert.equal(validarDatosTipo({ nombre: 'x'.repeat(120) }).valido, true)
    assert.match(validarDatosTipo({ nombre: 'x'.repeat(121) }).errores.nombre, /120/)
  })
})

describe('mezclarEnLista', () => {
  it('reemplaza por id o agrega, y deja los activos primero y cada grupo por nombre sin acentos', () => {
    const lista = [
      { id: 1, nombre: 'Beta', activo: true },
      { id: 2, nombre: 'Zeta', activo: true },
      { id: 3, nombre: 'Alfa', activo: false },
    ]
    const conNuevo = mezclarEnLista(lista, { id: 4, nombre: 'Árbol', activo: true })
    assert.deepEqual(
      conNuevo.map((x) => x.id),
      [4, 1, 2, 3],
    )
    const reactivado = mezclarEnLista(lista, { id: 3, nombre: 'Alfa', activo: true })
    assert.deepEqual(
      reactivado.map((x) => x.id),
      [3, 1, 2],
    )
    const desactivado = mezclarEnLista(lista, { id: 1, nombre: 'Beta', activo: false })
    assert.deepEqual(
      desactivado.map((x) => x.id),
      [2, 3, 1],
    )
    assert.equal(lista.length, 3, 'no modifica la lista original')
  })
})

describe('clienteService', () => {
  it('listarClientes pide GET /clientes y devuelve la lista', async () => {
    const api = crearApiFalsa(() => ({ data: { clientes: [{ id: 1, nombre: 'A' }] } }))
    const lista = await crearClienteService({ api }).listarClientes()
    assert.deepEqual(api.llamadas, [{ metodo: 'get', url: '/clientes', cuerpo: undefined }])
    assert.deepEqual(lista, [{ id: 1, nombre: 'A' }])
  })

  it('listarClientes falla con un error de tres partes si la respuesta no trae la lista', async () => {
    const api = crearApiFalsa(() => ({ data: {} }))
    await assert.rejects(crearClienteService({ api }).listarClientes(), (error) => {
      assert.equal(error.estado, 'respuesta_inesperada')
      return true
    })
  })

  it('crearCliente envía nombre recortado y RFC en mayúsculas (null si va vacío)', async () => {
    const api = crearApiFalsa((metodo, url, cuerpo) => ({
      data: { cliente: { id: 7, ...cuerpo } },
    }))
    const servicio = crearClienteService({ api })
    const cliente = await servicio.crearCliente({ nombre: '  Abarrotes ', rfc: ' abc010101xy1 ' })
    assert.deepEqual(api.llamadas[0], {
      metodo: 'post',
      url: '/clientes',
      cuerpo: { nombre: 'Abarrotes', rfc: 'ABC010101XY1' },
    })
    assert.equal(cliente.id, 7)
    await servicio.crearCliente({ nombre: 'Sin RFC', rfc: '  ' })
    assert.deepEqual(api.llamadas[1].cuerpo, { nombre: 'Sin RFC', rfc: null })
  })

  it('actualizarCliente envía PATCH /clientes/:id solo con los cambios recibidos', async () => {
    const api = crearApiFalsa(() => ({ data: { cliente: { id: 3, activo: false } } }))
    const servicio = crearClienteService({ api })
    const cliente = await servicio.actualizarCliente(3, { activo: false })
    assert.deepEqual(api.llamadas[0], {
      metodo: 'patch',
      url: '/clientes/3',
      cuerpo: { activo: false },
    })
    assert.equal(cliente.activo, false)
    await servicio.actualizarCliente(3, { nombre: ' Nuevo ', rfc: ' xyz020202ab3' })
    assert.deepEqual(api.llamadas[1].cuerpo, { nombre: 'Nuevo', rfc: 'XYZ020202AB3' })
  })

  it('crearCliente falla si la respuesta no trae el cliente', async () => {
    const api = crearApiFalsa(() => ({ data: {} }))
    await assert.rejects(crearClienteService({ api }).crearCliente({ nombre: 'A', rfc: '' }))
  })
})

describe('tipoActividadService', () => {
  it('listarTipos pide GET /tipos-actividad y devuelve la lista', async () => {
    const api = crearApiFalsa(() => ({ data: { tipos: [{ id: 1, nombre: 'A' }] } }))
    const lista = await crearTipoActividadService({ api }).listarTipos()
    assert.deepEqual(api.llamadas, [{ metodo: 'get', url: '/tipos-actividad', cuerpo: undefined }])
    assert.deepEqual(lista, [{ id: 1, nombre: 'A' }])
  })

  it('listarTipos falla si la respuesta no trae la lista', async () => {
    const api = crearApiFalsa(() => ({ data: { clientes: [] } }))
    await assert.rejects(crearTipoActividadService({ api }).listarTipos())
  })

  it('crearTipo envía nombre recortado y cobrable', async () => {
    const api = crearApiFalsa((metodo, url, cuerpo) => ({ data: { tipo: { id: 9, ...cuerpo } } }))
    const tipo = await crearTipoActividadService({ api }).crearTipo({
      nombre: ' Declaración ',
      cobrable: true,
    })
    assert.deepEqual(api.llamadas[0], {
      metodo: 'post',
      url: '/tipos-actividad',
      cuerpo: { nombre: 'Declaración', cobrable: true },
    })
    assert.equal(tipo.id, 9)
  })

  it('actualizarTipo envía PATCH /tipos-actividad/:id con los cambios', async () => {
    const api = crearApiFalsa(() => ({ data: { tipo: { id: 4, activo: true } } }))
    const servicio = crearTipoActividadService({ api })
    await servicio.actualizarTipo(4, { activo: true })
    assert.deepEqual(api.llamadas[0], {
      metodo: 'patch',
      url: '/tipos-actividad/4',
      cuerpo: { activo: true },
    })
    await servicio.actualizarTipo(4, { nombre: ' Otro ', cobrable: false })
    assert.deepEqual(api.llamadas[1].cuerpo, { nombre: 'Otro', cobrable: false })
  })
})

describe('menú y pestañas de «Mi trabajo»', () => {
  const menu = leer('../src/layouts/MaquetaLayout.vue')
  const pagina = leer('../src/pages/MyCasesPage.vue')
  const rutas = leer('../src/router/index.js')

  it('el ítem del menú de contador y auxiliar dice «Mi trabajo» y sigue yendo a la misma ruta', () => {
    assert.match(menu, /<q-item-label>Mi trabajo<\/q-item-label>/)
    assert.doesNotMatch(menu, /<q-item-label>Mis casos<\/q-item-label>/)
    assert.match(menu, /:to="\{ name: 'contador-casos' \}"/)
    assert.match(rutas, /path: 'contador\/casos',\s+name: 'contador-casos'/, 'la ruta no cambia')
    assert.match(rutas, /titulo: 'Mis casos'/, 'el título de ruta no cambia')
  })

  it('la página tiene q-tabs «Mis casos» y «Mis actividades» y la pestaña va en ?tab=', () => {
    const plantilla = plantillaDe(pagina)
    assert.match(plantilla, /<q-tabs/)
    assert.match(plantilla, /<q-tab\s+name="casos"[^>]*label="Mis casos"/)
    assert.match(plantilla, /<q-tab\s+name="actividades"[^>]*label="Mis actividades"/)
    assert.match(plantilla, /<q-tab-panel\s+name="actividades"/)
    assert.match(plantilla, /<MisActividades\s*\/>/)
    assert.match(pagina, /route\.query\.tab/)
    assert.match(pagina, /\['casos', 'actividades'\]/)
    assert.match(pagina, /router\.replace\(\{ query: \{ \.\.\.route\.query, tab: valor \} \}\)/)
  })

  it('el contenido de «Mis casos» sigue dentro de su pestaña', () => {
    const plantilla = plantillaDe(pagina)
    const panelCasos = plantilla.slice(
      plantilla.indexOf('<q-tab-panel name="casos"'),
      plantilla.indexOf('<q-tab-panel name="actividades"'),
    )
    assert.ok(panelCasos.length > 100, 'el panel de «Mis casos» existe')
    assert.match(panelCasos, /Registrar caso/)
    assert.match(panelCasos, /<CasoItem/)
    assert.match(panelCasos, /<CaseFormDialog/)
    assert.match(panelCasos, /<CasoDetalleDialog/)
  })
})

describe('«Mis actividades»', () => {
  const archivos = [
    '../src/components/MisActividades.vue',
    '../src/components/MisClientes.vue',
    '../src/components/MisTiposActividad.vue',
    '../src/components/ClienteFormDialog.vue',
    '../src/components/TipoActividadFormDialog.vue',
  ]

  it('existen los componentes de la rebanada', () => {
    for (const archivo of archivos) assert.ok(existsSync(ruta(archivo)), archivo)
  })

  it('tiene las secciones «Mis clientes» y «Mis tipos de actividad» con alta, edición y desactivar/reactivar', () => {
    const actividades = plantillaDe(leer('../src/components/MisActividades.vue'))
    assert.match(actividades, /<MisClientes\s*\/>/)
    assert.match(actividades, /<MisTiposActividad\s*\/>/)

    const clientes = plantillaDe(leer('../src/components/MisClientes.vue'))
    assert.match(clientes, /Mis clientes/)
    assert.match(clientes, /Agregar cliente/)
    assert.match(clientes, /Editar/)
    assert.match(clientes, /Desactivar/)
    assert.match(clientes, /Reactivar/)
    assert.match(clientes, /Reintentar|@retry/, 'estado de error con reintentar')
    assert.match(clientes, /<ScreenLoader/)
    assert.match(clientes, /<EmptyState/)

    const tipos = plantillaDe(leer('../src/components/MisTiposActividad.vue'))
    assert.match(tipos, /Mis tipos de actividad/)
    assert.match(tipos, /Agregar tipo/)
    assert.match(tipos, /Editar/)
    assert.match(tipos, /Desactivar/)
    assert.match(tipos, /Reactivar/)
    assert.match(tipos, /<ScreenLoader/)
    assert.match(tipos, /<EmptyState/)
    assert.match(tipos, /@retry/)
  })

  it('los diálogos siguen las convenciones del proyecto', () => {
    for (const archivo of [
      '../src/components/ClienteFormDialog.vue',
      '../src/components/TipoActividadFormDialog.vue',
    ]) {
      const fuente = leer(archivo)
      assert.match(fuente, /:persistent="guardando \|\| hayDatosSinGuardar"/, archivo)
      assert.match(fuente, /@shake="pedirDescartar"/, archivo)
      assert.match(fuente, /¿Descartar los cambios\?/, archivo)
      assert.match(fuente, /enfocarPrimerError/, archivo)
      assert.match(fuente, /erroresCampo/, archivo)
      assert.match(fuente, /dialogo-entra/, archivo)
      assert.match(fuente, /dialogo-sale/, archivo)
      assert.match(fuente, /<label for="[\w-]+"/, archivo)
      assert.match(fuente, /<span aria-hidden="true" class="required-mark">/, archivo)
      assert.match(fuente, /<q-tooltip>/, archivo)
      assert.match(fuente, /ya existe/i, `${archivo}: el nombre repetido se muestra junto al campo`)
    }
  })

  it('el interruptor «Cobrable» del tipo explica su efecto con tooltip', () => {
    const fuente = plantillaDe(leer('../src/components/TipoActividadFormDialog.vue'))
    assert.match(fuente, /<q-toggle/)
    assert.match(fuente, /Cobrable/)
  })

  it('usan componentes de Quasar y colores de la paleta, sin hexadecimales sueltos ni cubic-bezier', () => {
    for (const archivo of archivos) {
      const fuente = leer(archivo)
      assert.doesNotMatch(fuente, /#[0-9a-fA-F]{3,8}\b/, `${archivo}: hexadecimal suelto`)
      assert.doesNotMatch(fuente, /cubic-bezier/, archivo)
    }
    for (const archivo of archivos.slice(1)) {
      const plantilla = plantillaDe(leer(archivo))
      assert.match(plantilla, /<q-(btn|card|list|dialog)/, archivo)
    }
  })

  it('los textos de la interfaz van en tú, sin voseo ni usted', () => {
    for (const archivo of archivos) {
      const plantilla = plantillaDe(leer(archivo))
      assert.doesNotMatch(plantilla, /\busted\b|\bpodés\b|\bescribí\b/i, archivo)
    }
  })
})
