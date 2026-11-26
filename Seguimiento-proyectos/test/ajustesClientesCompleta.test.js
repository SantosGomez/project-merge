// Pestaña «Clientes» de Ajustes completa (rebanada 56c): servicio con escrituras, reglas de
// formulario, reglas de rol y pruebas de texto/estructura de la tabla y los dos diálogos.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import {
  EXPLICACION_PRINCIPAL,
  avisoPrincipalSinRolDocumentos,
  cambiosDeCliente,
  campoDeErrorCliente,
  crearAjustesService,
  opcionesDeContadores,
  validarClienteCatalogo,
} from '../src/services/ajustesService.js'
import { puedeAgregarClientes, puedeEditarClientes } from '../src/utils/modulos.js'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8').replace(/\r\n/g, '\n')

describe('Ajustes clientes: servicio de escrituras', () => {
  const apiFalsa = (respuesta) => {
    const llamadas = []
    const registrar = (metodo) => async (url, cuerpo) => {
      llamadas.push({ metodo, url, cuerpo })
      return { data: respuesta }
    }
    return {
      llamadas,
      get: registrar('get'),
      post: registrar('post'),
      patch: registrar('patch'),
      put: registrar('put'),
    }
  }

  it('crearCliente envía POST /ajustes/clientes con los datos limpios y los contadores', async () => {
    const api = apiFalsa({ cliente: { id: 9 } })
    const cliente = await crearAjustesService({ api }).crearCliente({
      clave: ' ab1 ',
      nombre: '  Cliente Uno  ',
      rfc: ' abc010101xy1 ',
      email: ' a@b.com ',
      telefono: ' 5512345678 ',
      contadores: [4, 2],
    })
    assert.deepEqual(cliente, { id: 9 })
    assert.deepEqual(api.llamadas, [
      {
        metodo: 'post',
        url: '/ajustes/clientes',
        cuerpo: {
          clave: 'AB1',
          nombre: 'Cliente Uno',
          rfc: 'ABC010101XY1',
          email: 'a@b.com',
          telefono: '5512345678',
          contadores: [4, 2],
        },
      },
    ])
  })

  it('crearCliente manda null en lo opcional que va vacío y lista vacía sin contadores', async () => {
    const api = apiFalsa({ cliente: { id: 1 } })
    await crearAjustesService({ api }).crearCliente({ clave: 'A', nombre: 'N' })
    assert.deepEqual(api.llamadas[0].cuerpo, {
      clave: 'A',
      nombre: 'N',
      rfc: null,
      email: null,
      telefono: null,
      contadores: [],
    })
  })

  it('editarCliente envía PATCH solo con los campos recibidos', async () => {
    const api = apiFalsa({ cliente: { id: 7 } })
    await crearAjustesService({ api }).editarCliente(7, { telefono: '55', activo: false })
    assert.deepEqual(api.llamadas, [
      { metodo: 'patch', url: '/ajustes/clientes/7', cuerpo: { telefono: '55', activo: false } },
    ])
  })

  it('reemplazarContadores envía PUT con la lista completa, en orden', async () => {
    const api = apiFalsa({ cliente: { id: 7 } })
    await crearAjustesService({ api }).reemplazarContadores(7, [3, 1])
    assert.deepEqual(api.llamadas, [
      { metodo: 'put', url: '/ajustes/clientes/7/contadores', cuerpo: { contadores: [3, 1] } },
    ])
  })

  it('listarContadoresElegibles pide GET /ajustes/contadores y valida la respuesta', async () => {
    const api = apiFalsa({ contadores: [{ id: 1, nombre: 'Ana', rol: 'contador' }] })
    const lista = await crearAjustesService({ api }).listarContadoresElegibles()
    assert.equal(api.llamadas[0].url, '/ajustes/contadores')
    assert.equal(lista.length, 1)
    await assert.rejects(
      () => crearAjustesService({ api: apiFalsa({}) }).listarContadoresElegibles(),
      (error) => error.estado === 'respuesta_inesperada' && /contadores/.test(error.mensaje),
    )
  })

  it('las escrituras rechazan una respuesta sin el cliente guardado', async () => {
    const servicio = crearAjustesService({ api: apiFalsa({}) })
    for (const llamar of [
      () => servicio.crearCliente({ clave: 'A', nombre: 'N' }),
      () => servicio.editarCliente(1, { activo: true }),
      () => servicio.reemplazarContadores(1, []),
    ]) {
      await assert.rejects(llamar, (error) => error.estado === 'respuesta_inesperada')
    }
  })
})

describe('Ajustes clientes: validaciones del formulario', () => {
  const valido = { clave: 'AB1', nombre: 'Cliente', rfc: '', email: '', telefono: '' }

  it('un formulario con clave y razón social es válido', () => {
    assert.deepEqual(validarClienteCatalogo(valido), { valido: true, errores: {} })
  })

  it('la clave es obligatoria, de hasta 4 caracteres y sin espacios', () => {
    assert.match(validarClienteCatalogo({ ...valido, clave: '  ' }).errores.clave, /clave/i)
    assert.ok(validarClienteCatalogo({ ...valido, clave: 'ABCDE' }).errores.clave)
    assert.ok(validarClienteCatalogo({ ...valido, clave: 'A B' }).errores.clave)
    assert.equal(validarClienteCatalogo({ ...valido, clave: 'abcd' }).valido, true)
  })

  it('con claveObligatoria en false acepta la clave vacía, pero sigue validando una escrita', () => {
    const sinClave = { ...valido, clave: '' }
    assert.equal(validarClienteCatalogo(sinClave, { claveObligatoria: false }).valido, true)
    assert.ok(
      validarClienteCatalogo({ ...valido, clave: 'ABCDE' }, { claveObligatoria: false }).errores
        .clave,
    )
    assert.ok(validarClienteCatalogo(sinClave).errores.clave)
  })

  it('la razón social es obligatoria y de hasta 150 caracteres', () => {
    assert.ok(validarClienteCatalogo({ ...valido, nombre: ' ' }).errores.nombre)
    assert.equal(validarClienteCatalogo({ ...valido, nombre: 'x'.repeat(150) }).valido, true)
    assert.ok(validarClienteCatalogo({ ...valido, nombre: 'x'.repeat(151) }).errores.nombre)
  })

  it('el RFC, el correo y el teléfono son opcionales pero se validan si se escriben', () => {
    assert.equal(validarClienteCatalogo({ ...valido, rfc: 'ABC010101XY1' }).valido, true)
    assert.equal(validarClienteCatalogo({ ...valido, rfc: 'abc010101xy1' }).valido, true)
    assert.ok(validarClienteCatalogo({ ...valido, rfc: 'ABC' }).errores.rfc)
    assert.ok(validarClienteCatalogo({ ...valido, email: 'sin-arroba' }).errores.email)
    assert.equal(validarClienteCatalogo({ ...valido, email: 'a@b.com' }).valido, true)
    assert.ok(validarClienteCatalogo({ ...valido, telefono: '1'.repeat(21) }).errores.telefono)
    assert.equal(validarClienteCatalogo({ ...valido, telefono: '1'.repeat(20) }).valido, true)
  })
})

describe('Ajustes clientes: cambios y errores del backend', () => {
  const actual = {
    clave: 'AB1',
    nombre: 'Cliente',
    rfc: 'ABC010101XY1',
    email: 'a@b.com',
    telefono: '55',
  }

  it('cambiosDeCliente devuelve solo lo que cambió, ya normalizado', () => {
    assert.deepEqual(cambiosDeCliente(actual, { ...actual }), {})
    assert.deepEqual(cambiosDeCliente(actual, { ...actual, clave: ' ab2 ', telefono: '56' }), {
      clave: 'AB2',
      telefono: '56',
    })
  })

  it('un opcional que se vacía va como null y uno que ya estaba vacío no cuenta como cambio', () => {
    assert.deepEqual(cambiosDeCliente(actual, { ...actual, rfc: '', email: ' ' }), {
      rfc: null,
      email: null,
    })
    const sinDatos = { clave: 'A', nombre: 'N', rfc: null, email: null, telefono: null }
    assert.deepEqual(
      cambiosDeCliente(sinDatos, { clave: 'A', nombre: 'N', rfc: '', email: '', telefono: '' }),
      {},
    )
  })

  it('campoDeErrorCliente lee la parte «sobre X» del mensaje del backend', () => {
    const ejemplo = (sobre) => `Ya existe algo sobre ${sobre}: Usa otro dato`
    assert.equal(campoDeErrorCliente(ejemplo('nombre')), 'nombre')
    assert.equal(campoDeErrorCliente(ejemplo('clave')), 'clave')
    assert.equal(campoDeErrorCliente(ejemplo('rfc')), 'rfc')
    assert.equal(campoDeErrorCliente(ejemplo('correo')), 'email')
    assert.equal(campoDeErrorCliente(ejemplo('teléfono')), 'telefono')
    assert.equal(campoDeErrorCliente(ejemplo('contadores')), 'contadores')
    assert.equal(campoDeErrorCliente(ejemplo('cliente solicitado')), null)
    assert.equal(campoDeErrorCliente('Sin formato'), null)
    assert.equal(campoDeErrorCliente(undefined), null)
  })
})

describe('Ajustes clientes: contadores elegibles', () => {
  const elegibles = [
    { id: 1, nombre: 'Ana', rol: 'contador', contador_documentos: true },
    { id: 2, nombre: 'Beto', rol: 'auxiliar', contador_documentos: false },
  ]

  it('opcionesDeContadores lista a los elegibles y conserva al que ya no lo es', () => {
    const opciones = opcionesDeContadores(elegibles, [
      { id: 2, nombre: 'Beto' },
      { id: 9, nombre: 'Carla' },
    ])
    assert.deepEqual(
      opciones.map((o) => [o.value, o.label, o.sinRolDocumentos, o.yaNoElegible]),
      [
        [1, 'Ana', false, false],
        [2, 'Beto', true, false],
        [9, 'Carla', true, true],
      ],
    )
  })

  it('avisa solo si el principal (el primero) no es Contador en Documentos', () => {
    const opciones = opcionesDeContadores(elegibles, [])
    assert.equal(avisoPrincipalSinRolDocumentos([1, 2], opciones), null)
    assert.equal(avisoPrincipalSinRolDocumentos([], opciones), null)
    const aviso = avisoPrincipalSinRolDocumentos([2, 1], opciones)
    assert.match(aviso, /Beto/)
    assert.match(aviso, /Recepción no lo propondrá/)
  })

  it('la ayuda del principal dice dónde aparece sugerido', () => {
    assert.equal(EXPLICACION_PRINCIPAL, 'El principal es quien aparece sugerido en Recepción.')
  })
})

describe('Ajustes clientes: reglas de rol', () => {
  it('el alta la hacen administrador, sistemas y recepcionista', () => {
    for (const rol of ['administrador', 'usuarios_de_sistema', 'recepcionista']) {
      assert.equal(puedeAgregarClientes(rol), true, rol)
    }
    for (const rol of ['contador', 'auxiliar', null, undefined]) {
      assert.equal(puedeAgregarClientes(rol), false, String(rol))
    }
  })

  it('editar, activar y asignar contadores es solo de administrador y sistemas', () => {
    for (const rol of ['administrador', 'usuarios_de_sistema']) {
      assert.equal(puedeEditarClientes(rol), true, rol)
    }
    for (const rol of ['recepcionista', 'contador', 'auxiliar', null]) {
      assert.equal(puedeEditarClientes(rol), false, String(rol))
    }
  })
})

describe('Ajustes clientes: AjustesPage muestra «Clientes» a la recepcionista', () => {
  const pagina = leer('../src/pages/AjustesPage.vue')

  it('veClientes incluye a la recepcionista', () => {
    assert.match(
      pagina,
      /veClientes = computed\(\s*\(\) =>\s*session\.esAdministrador \|\| session\.esUsuarioSistema \|\| session\.esRecepcionista/,
    )
  })

  it('el tooltip de la pestaña ya no dice que es solo consulta', () => {
    assert.doesNotMatch(pagina, /Consulta el catálogo de clientes/)
    assert.match(
      pagina,
      /<q-tab v-if="veClientes" name="clientes"[\s\S]*?<q-tooltip>[^<]+<\/q-tooltip>/,
    )
  })
})

describe('Ajustes clientes: tabla con acciones por rol', () => {
  const lista = leer('../src/components/AjustesClientes.vue')

  it('la ayuda de la cabecera ya no dice que es solo de consulta', () => {
    assert.doesNotMatch(lista, /solo de consulta/)
    assert.doesNotMatch(lista, /no se agregan ni se editan/)
  })

  it('«Nuevo cliente» solo para quien puede dar de alta y abre el diálogo', () => {
    const inicio = lista.indexOf('v-if="puedeAgregar"')
    assert.ok(inicio >= 0)
    const bloque = lista.slice(inicio, lista.indexOf('</q-btn>', inicio))
    assert.match(bloque, /label="Nuevo cliente"/)
    assert.match(bloque, /aria-haspopup="dialog"/)
    assert.match(bloque, /boton-presionable/)
    assert.match(bloque, /<q-tooltip>[^<]+<\/q-tooltip>/)
    assert.match(lista, /puedeAgregar = computed\(\(\) => puedeAgregarClientes\(session\.rol\)\)/)
    assert.match(lista, /puedeEditar = computed\(\(\) => puedeEditarClientes\(session\.rol\)\)/)
  })

  it('las acciones por fila tienen tooltip y aria-label y solo se ven si puede editar', () => {
    for (const texto of ['Editar datos', 'Contadores']) {
      assert.match(lista, new RegExp(`<q-tooltip>${texto}`), texto)
      assert.match(lista, new RegExp(`aria-label="\\\`${texto}`), texto)
    }
    assert.match(lista, /Desactivar/)
    assert.match(lista, /Activar/)
    assert.match(lista, /name: 'acciones'/)
    assert.match(lista, /v-if="puedeEditar"/)
    assert.match(lista, /puedeEditar\.value\s*\?\s*\[\s*\{\s*name: 'acciones'/)
  })

  it('desactivar y activar piden confirmación y desactivar avisa de Recepción', () => {
    assert.match(lista, /\$q\.dialog\(/)
    assert.match(lista, /ya no admitirá documentos nuevos en Recepción/)
    assert.match(lista, /¿Desactivar a/)
    assert.match(lista, /¿Activar a/)
    assert.match(lista, /dialogo-entra/)
    assert.match(lista, /boton-presionable/)
  })

  it('cada acción tiene bandera de reentrada y manda solo el campo activo', () => {
    assert.match(lista, /if \(cambiandoId\.value !== null\) return/)
    assert.match(lista, /editarCliente\(fila\.id, \{ activo: !fila\.activo \}\)/)
  })

  it('avisos de éxito, recarga en silencio y foco de vuelta al botón que abrió el diálogo', () => {
    for (const aviso of [
      'Cliente agregado',
      'Cambios guardados',
      'Cliente desactivado',
      'Contadores actualizados',
    ]) {
      assert.match(lista, new RegExp(aviso), aviso)
    }
    assert.match(lista, /silencioso/)
    assert.match(lista, /\.focus\(/)
    assert.match(lista, /@hide=|alCerrarDialogo/)
  })

  it('la columna «Contador» muestra el principal y «+N» con tooltip, y las tarjetas listan a todos', () => {
    assert.match(lista, /\+\{\{ props\.row\.otrosContadores \}\}|`\+\$\{/)
    assert.match(lista, /props\.row\.contadoresTexto|contadoresTexto/)
    assert.match(lista, /Contadores:/)
    assert.match(lista, /Sin contador/)
  })

  it('en pantallas chicas las acciones van en un menú «⋮» y la tabla no desborda', () => {
    assert.match(lista, /icon="more_vert"/)
    assert.match(lista, /\$q\.screen\.lt\.md/)
    assert.match(lista, /text-overflow: ellipsis/)
    assert.match(lista, /classes: 'gt-sm'/)
    assert.match(lista, /no-data-label="/)
    assert.match(lista, /no-results-label="/)
    assert.match(lista, /:grid="\$q\.screen\.lt\.sm"/)
  })

  it('monta los dos diálogos y usa los servicios de Ajustes', () => {
    assert.match(lista, /<ClienteCatalogoDialog/)
    assert.match(lista, /<ContadoresClienteDialog/)
    assert.match(lista, /editarCliente/)
    assert.match(lista, /session\.rol/)
  })

  it('sin hexadecimales sueltos ni transition: all y con foco visible y movimiento reducido', () => {
    assert.doesNotMatch(lista, /#[0-9a-fA-F]{3,8}\b/)
    assert.doesNotMatch(lista, /transition:\s*all/)
    assert.doesNotMatch(lista, /outline:[^;]*--dg-anillo-foco/)
  })
})

describe('Ajustes clientes: diálogo de alta y edición', () => {
  it('existe y sigue el patrón de diálogo de formulario de la app', () => {
    assert.ok(existsSync(ruta('../src/components/ClienteCatalogoDialog.vue')))
    const dialogo = leer('../src/components/ClienteCatalogoDialog.vue')
    assert.match(dialogo, /<q-dialog/)
    assert.match(dialogo, /:persistent="guardando \|\| hayDatosSinGuardar"/)
    assert.match(dialogo, /@shake="pedirDescartar"/)
    assert.match(dialogo, /¿Descartar los cambios\?/)
    assert.match(dialogo, /transition-show="dialogo-entra"/)
    assert.match(dialogo, /transition-hide="dialogo-sale"/)
    assert.match(dialogo, /:transition-duration="220"/)
    assert.match(dialogo, /<q-form/)
    assert.match(dialogo, /novalidate/)
    assert.match(dialogo, /erroresCampo/)
    assert.match(dialogo, /enfocarPrimerError/)
    assert.match(dialogo, /if \(guardando\.value\) return/)
    assert.match(dialogo, /boton-presionable/)
    assert.match(dialogo, /control-touch/)
  })

  it('tiene solo los campos de la tabla clientes, cada uno con label for, y asterisco aria-hidden', () => {
    const dialogo = leer('../src/components/ClienteCatalogoDialog.vue')
    for (const campo of ['clave', 'nombre', 'rfc', 'email', 'telefono']) {
      assert.match(dialogo, new RegExp(`for="catalogo-cliente-${campo}"`), campo)
      assert.match(dialogo, new RegExp(`v-model="form\\.${campo}"`), campo)
    }
    assert.match(dialogo, /aria-hidden="true" class="required-mark">\*/)
    assert.match(dialogo, /maxlength="4"/)
    assert.match(dialogo, /maxlength="150"/)
    assert.match(dialogo, /Razón social/)
    assert.match(dialogo, /Clave de carpeta/)
    assert.doesNotMatch(dialogo, /v-model="form\.(activo|direccion|contacto|notas)"/)
  })

  it('la clave se escribe en mayúsculas y los campos tienen tooltip', () => {
    const dialogo = leer('../src/components/ClienteCatalogoDialog.vue')
    assert.match(dialogo, /uppercase/)
    assert.ok((dialogo.match(/<q-tooltip/g) ?? []).length >= 7)
  })

  it('en el alta ofrece contadores (opcional) con selección múltiple, chips y «Principal»', () => {
    const dialogo = leer('../src/components/ClienteCatalogoDialog.vue')
    assert.match(dialogo, /<q-select/)
    assert.match(dialogo, /multiple/)
    assert.match(dialogo, /use-chips/)
    assert.match(dialogo, /v-if="!esEdicion"/)
    assert.match(dialogo, /Principal/)
    assert.match(dialogo, /EXPLICACION_PRINCIPAL/)
    assert.match(dialogo, /listarContadoresElegibles/)
    assert.match(dialogo, /avisoPrincipalSinRolDocumentos/)
    assert.match(dialogo, /emit-value/)
    assert.match(dialogo, /map-options/)
    assert.match(dialogo, /transition-show="jump-down"/)
  })

  it('al editar solo envía lo que cambió y marca el campo con el error del backend', () => {
    const dialogo = leer('../src/components/ClienteCatalogoDialog.vue')
    assert.match(dialogo, /cambiosDeCliente\(/)
    assert.match(dialogo, /editarCliente\(props\.cliente\.id, cambios\)/)
    assert.match(dialogo, /crearCliente\(/)
    assert.match(dialogo, /campoDeErrorCliente\(/)
    assert.match(dialogo, /validarClienteCatalogo\(/)
    assert.match(dialogo, /emit\('guardado'/)
  })

  it('sin hexadecimales sueltos ni transition: all', () => {
    const dialogo = leer('../src/components/ClienteCatalogoDialog.vue')
    assert.doesNotMatch(dialogo, /#[0-9a-fA-F]{3,8}\b/)
    assert.doesNotMatch(dialogo, /transition:\s*all/)
  })
})

describe('Ajustes clientes: diálogo de contadores', () => {
  const ruta56 = '../src/components/ContadoresClienteDialog.vue'

  it('existe y sigue el patrón de diálogo de formulario de la app', () => {
    assert.ok(existsSync(ruta(ruta56)))
    const dialogo = leer(ruta56)
    assert.match(dialogo, /:persistent="guardando \|\| hayDatosSinGuardar"/)
    assert.match(dialogo, /@shake="pedirDescartar"/)
    assert.match(dialogo, /¿Descartar los cambios\?/)
    assert.match(dialogo, /transition-show="dialogo-entra"/)
    assert.match(dialogo, /if \(guardando\.value\) return/)
    assert.match(dialogo, /boton-presionable/)
    assert.match(dialogo, /control-touch/)
  })

  it('lista a los elegibles con búsqueda y selección múltiple, y marca al principal', () => {
    const dialogo = leer(ruta56)
    assert.match(dialogo, /<q-select/)
    assert.match(dialogo, /multiple/)
    assert.match(dialogo, /use-chips/)
    assert.match(dialogo, /use-input/)
    assert.match(dialogo, /@filter=/)
    assert.match(dialogo, /Principal/)
    assert.match(dialogo, /EXPLICACION_PRINCIPAL/)
    assert.match(dialogo, /listarContadoresElegibles/)
    assert.match(dialogo, /opcionesDeContadores/)
  })

  it('avisa si el principal no es Contador en Documentos y permite dejarlo sin contadores', () => {
    const dialogo = leer(ruta56)
    assert.match(dialogo, /avisoPrincipalSinRolDocumentos/)
    assert.match(dialogo, /role="status"|q-banner/)
    assert.match(dialogo, /reemplazarContadores\(props\.cliente\.id, seleccion\.value\)/)
    assert.doesNotMatch(dialogo, /seleccion\.value\.length === 0\)\s*return/)
    assert.match(dialogo, /Sin contadores|sin contadores/)
  })

  it('muestra el error del backend junto al campo de contadores', () => {
    const dialogo = leer(ruta56)
    assert.match(dialogo, /:error="!!errorContadores"/)
    assert.match(dialogo, /campoDeErrorCliente\(/)
  })

  it('sin hexadecimales sueltos ni transition: all', () => {
    const dialogo = leer(ruta56)
    assert.doesNotMatch(dialogo, /#[0-9a-fA-F]{3,8}\b/)
    assert.doesNotMatch(dialogo, /transition:\s*all/)
  })
})
