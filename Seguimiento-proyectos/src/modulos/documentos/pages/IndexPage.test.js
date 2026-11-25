/**
 * Oráculos de `pages/IndexPage.vue` para los defectos D1 a D4 y para el aviso que
 * deja la guardia de rutas (D6).
 *
 * Por qué son oráculos de fuente y no pruebas de comportamiento: montar un SFC de
 * Quasar exigiría `@vue/test-utils` y un DOM, y la constitución prohíbe añadir
 * vitest, jest, playwright o cypress. Un `.vue` no se puede importar en
 * `node --test`. Lo que sí se ata aquí es la forma en que la vista consume la
 * respuesta y el orden de las operaciones, comparando además lo que la vista lee
 * contra la respuesta real que produce `cliente.js` con un doble de `fetch`: si la
 * vista lee una clave que el servidor no devuelve, la prueba falla.
 */

import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { obtenerCatalogos, crearDocumento } from '../servicios/api.js'

const FUENTE = readFileSync(fileURLToPath(new URL('./IndexPage.vue', import.meta.url)), 'utf8')

/**
 * Quita los comentarios antes de buscar un símbolo: si no, el oráculo se cumple
 * con la frase que documenta la regla en lugar de con el código que la cumple.
 */
function soloCodigo(fuente) {
  return fuente
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Código del `<script setup>` sin la plantilla ni los estilos. */
const CODIGO = soloCodigo(FUENTE)

/** Cuerpo de `onSubmit`: desde su declaración hasta `resetForm`. */
function cuerpoDeOnSubmit() {
  const inicio = CODIGO.indexOf('const onSubmit')
  const fin = CODIGO.indexOf('const resetForm', inicio)
  assert.notEqual(inicio, -1, 'no se encontró `const onSubmit` en IndexPage.vue')
  assert.notEqual(fin, -1, 'no se encontró `const resetForm` en IndexPage.vue')
  return CODIGO.slice(inicio, fin)
}

/** Bloque donde `onMounted` lee los catálogos del servidor. */
function bloqueDeCatalogos() {
  const inicio = CODIGO.indexOf('await obtenerCatalogos()')
  assert.notEqual(inicio, -1, 'no se encontró la llamada a obtenerCatalogos()')
  const fin = CODIGO.indexOf('onMounted', inicio + 10)
  return CODIGO.slice(inicio, fin === -1 ? undefined : fin)
}

/** Claves que la vista lee del objeto que devuelve `obtenerCatalogos()`. */
function clavesLeidasDeLaRespuesta() {
  const bloque = bloqueDeCatalogos()
  return [...bloque.matchAll(/respuesta\??\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1])
}

/** Catálogos que devuelve hoy el endpoint, con la forma de `Backend/src/rutas/catalogos.js`. */
const CATALOGOS_DEL_SERVIDOR = {
  empresas: [
    { id: 1, nombre: 'DCA Consulting' },
    { id: 2, nombre: 'DCA Attorneys' },
  ],
  tiposDocumento: [
    { id: 1, nombre: 'Factura' },
    { id: 2, nombre: 'Recibo' },
    { id: 3, nombre: 'Estado de cuenta' },
    { id: 4, nombre: 'Comprobante de pago' },
    { id: 5, nombre: 'Contrato' },
  ],
  departamentos: [
    { id: 1, nombre: 'Contabilidad' },
    { id: 2, nombre: 'Legal' },
    { id: 3, nombre: 'Auditoría' },
    { id: 4, nombre: 'Recursos Humanos' },
  ],
  contadores: [],
  clientes: [{ id: 1, razonSocial: 'Constructora del Norte', rfc: 'CND010101ABC' }],
}

describe('D1 · los catálogos se descartaban y el formulario quedaba muerto', () => {
  afterEach(() => {
    delete globalThis.fetch
  })

  test('cliente.js devuelve el cuerpo pelado, sin envolver en status/body', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(CATALOGOS_DEL_SERVIDOR), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })

    const respuesta = await obtenerCatalogos()

    assert.equal(respuesta.status, undefined, 'el cuerpo no viene envuelto')
    assert.equal(respuesta.body, undefined, 'el cuerpo no viene envuelto')
    assert.equal(respuesta.empresas.length, 2)
    assert.equal(respuesta.tiposDocumento.length, 5)
    assert.equal(respuesta.departamentos.length, 4)
    assert.deepEqual(respuesta.contadores, [])
    assert.equal(respuesta.clientes.length, 1)
  })

  test('la vista no prueba `respuesta.status === 200 && respuesta.body`', async () => {
    assert.equal(
      /respuesta\.status\s*===\s*200/.test(CODIGO),
      false,
      'IndexPage no debe comprobar el status: cliente.js ya lanza en el error y devuelve el cuerpo pelado',
    )
    assert.equal(
      CODIGO.includes('respuesta.body'),
      false,
      'IndexPage no debe leer `respuesta.body`: la respuesta ES el cuerpo',
    )
  })

  test('cada clave que la vista lee existe en la respuesta real del servidor', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(CATALOGOS_DEL_SERVIDOR), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })

    const respuesta = await obtenerCatalogos()
    const claves = clavesLeidasDeLaRespuesta()

    assert.ok(claves.length > 0, 'la vista debe leer algo de la respuesta')
    for (const clave of claves) {
      assert.ok(
        Object.hasOwn(respuesta, clave),
        `la vista lee \`respuesta.${clave}\`, pero el servidor no devuelve esa clave`,
      )
    }
    assert.deepEqual([...new Set(claves)].sort(), [
      'clientes',
      'contadores',
      'departamentos',
      'empresas',
      'tiposDocumento',
    ])
  })
})

describe('D2 · el primer clic se rechazaba por "faltan las firmas"', () => {
  test('el lienzo se lee antes de armar el payload', () => {
    const cuerpo = cuerpoDeOnSubmit()

    const posLectura = cuerpo.indexOf('toDataURL()')
    const posPayload = cuerpo.indexOf('const datos = {')
    const posEnvio = cuerpo.indexOf('await crearDocumento(')

    assert.notEqual(posLectura, -1, 'no se lee ningún lienzo en onSubmit')
    assert.notEqual(posPayload, -1, 'no se arma el payload en onSubmit')
    assert.notEqual(posEnvio, -1, 'onSubmit no llama a crearDocumento')
    assert.ok(
      posLectura < posPayload,
      'la firma debe leerse del lienzo ANTES de armar `datos`, no 29 líneas después',
    )
    assert.ok(posPayload < posEnvio, 'el payload se arma antes de enviarlo')
  })

  test('el payload lleva la lectura del lienzo, no la referencia que aún estaba vacía', () => {
    const cuerpo = cuerpoDeOnSubmit()

    for (const [campo, lienzo] of [
      ['firmaCliente', 'canvasCliente'],
      ['firmaRecep', 'canvasRecepcion'],
    ]) {
      const identificador = cuerpo.match(new RegExp(`${campo}: ([A-Za-z_$][\\w$]*)`))?.[1]
      assert.ok(
        identificador,
        `\`${campo}\` debe apuntar a una variable con la firma leída, no a una referencia de la vista`,
      )
      assert.match(
        cuerpo,
        new RegExp(`const ${identificador} = ${lienzo}\\.value\\.toDataURL\\(\\)`),
        `\`${campo}\` debe valer lo que devuelve \`${lienzo}.toDataURL()\``,
      )
    }
  })
})

describe('D3 · doble clic guardaba dos documentos', () => {
  test('existe la bandera de envío en curso', () => {
    assert.match(
      CODIGO,
      /const guardando = ref\(false\)/,
      'falta la bandera reactiva que apaga el botón mientras se guarda',
    )
  })

  test('onSubmit corta la reentrada antes de llamar al servidor', () => {
    const cuerpo = cuerpoDeOnSubmit()

    const posGuarda = cuerpo.indexOf('if (guardando.value) return')
    const posEnvio = cuerpo.indexOf('await crearDocumento(')

    assert.notEqual(posGuarda, -1, 'falta la guarda `if (guardando.value) return`')
    assert.ok(posGuarda < posEnvio, 'la guarda de reentrada debe ir antes de la llamada')
  })

  test('la bandera se enciende antes de enviar y se apaga al terminar', () => {
    const cuerpo = cuerpoDeOnSubmit()

    const posEnciende = cuerpo.indexOf('guardando.value = true')
    const posEnvio = cuerpo.indexOf('await crearDocumento(')
    const posApaga = cuerpo.lastIndexOf('guardando.value = false')

    assert.ok(posEnciende !== -1, 'nunca se enciende `guardando`')
    assert.ok(posEnciende < posEnvio, '`guardando` debe encenderse antes de enviar')
    assert.ok(posApaga > posEnvio, '`guardando` debe apagarse después de terminar la llamada')
    assert.match(cuerpo, /finally \{/)
  })

  test('el botón de guardar se deshabilita mientras se guarda', () => {
    assert.match(
      FUENTE,
      /:disable="formularioBloqueado \|\| guardando"/,
      'el botón de enviar tiene que apagarse con `guardando`, no solo con `formularioBloqueado`',
    )
  })
})

describe('D4 · el chip "Folio actual" mostraba un folio inventado', () => {
  test('no se inventa el folio con números aleatorios', () => {
    assert.equal(
      CODIGO.includes('Math.random()'),
      false,
      'el folio lo asigna el servidor al guardar (T26); el formulario no puede inventarlo',
    )
    assert.equal(CODIGO.includes('form.folio'), false, 'el formulario ya no lleva un folio propio')
  })

  test('el chip dice que el folio se asigna al guardar', () => {
    assert.match(FUENTE, /Se asigna al guardar/)
  })
})

// D6 (aviso de acceso denegado en el layout): en la app unida lo da el layout de status-conta
// (AccessDenied en MaquetaLayout), con sus propias pruebas.

/**
 * Cuerpo que devuelve hoy `POST /api/documentos`, con la forma de
 * `Backend/src/rutas/documentos.js:136-149`. Los `firmas` son booleanos fijos: el
 * servidor guarda las imágenes pero no las devuelve.
 */
const ACUSE_DEL_SERVIDOR = {
  id: 12,
  folio: 'DCA-2026-0012',
  periodo: '2026-10',
  fechaRecepcion: '2026-10-16T09:30:00.000',
  fechaLimite: '2026-10-20',
  firmas: { cliente: true, recepcionista: true },
}

/** Bloque del diálogo del acuse, sin comentarios. */
function dialogoDelAcuse() {
  // Con varios atributos Prettier parte la etiqueta en líneas: se busca con `\s+`.
  const inicio = FUENTE.search(/<q-dialog\s+v-model="mostrarAcuse"/)
  assert.notEqual(inicio, -1, 'no se encontró el diálogo del acuse en IndexPage.vue')
  const fin = FUENTE.indexOf('</q-dialog>', inicio)
  assert.notEqual(fin, -1, 'el diálogo del acuse no se cierra')
  return soloCodigo(FUENTE.slice(inicio, fin))
}

/** Cuerpo de `resetForm`: desde su declaración hasta el cierre del `<script>`. */
function cuerpoDeResetForm() {
  const inicio = CODIGO.indexOf('const resetForm')
  assert.notEqual(inicio, -1, 'no se encontró `const resetForm` en IndexPage.vue')
  const fin = CODIGO.indexOf('</script>', inicio)
  return CODIGO.slice(inicio, fin === -1 ? undefined : fin)
}

describe('D7 · el acuse decía "Sin firma dibujada" con las firmas ya guardadas', () => {
  afterEach(() => {
    delete globalThis.fetch
  })

  test('el servidor no devuelve las imágenes, así que el acuse no puede pintarse desde la respuesta', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(ACUSE_DEL_SERVIDOR), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })

    const cuerpo = await crearDocumento({
      firmaCliente: 'data:image/png;base64,AAAA',
      firmaRecep: 'data:image/png;base64,BBBB',
    })

    assert.deepEqual(cuerpo.firmas, { cliente: true, recepcionista: true })
    assert.equal(
      JSON.stringify(cuerpo).match(/data:image\//g)?.length ?? 0,
      0,
      'la respuesta de /documentos no debe traer data URLs: por eso el acuse usa la lectura del lienzo',
    )
  })

  test('los recuadros del acuse se pintan con los datos del acuse, no con los refs del formulario', () => {
    const dialogo = dialogoDelAcuse()

    for (const destino of ['acuseData.firmaClienteUrl', 'acuseData.firmaRecepcionUrl']) {
      assert.match(
        dialogo,
        new RegExp(`v-if="${destino.replace('.', '\\.')}"`),
        `el recuadro debe condicionarse a \`${destino}\``,
      )
      assert.match(
        dialogo,
        new RegExp(`:src="${destino.replace('.', '\\.')}"`),
        `el \`<img>\` debe tomar su \`src\` de \`${destino}\``,
      )
    }

    // `resetForm()` vacía los refs justo antes de que el modal se pinte: si el
    // diálogo los leyera, siempre caería en el "Sin firma dibujada".
    const refsDelFormulario = [
      ...dialogo.matchAll(/(?<!acuseData\.)\bfirma(?:Cliente|Recepcion)Url\b/g),
    ]
    assert.equal(
      refsDelFormulario.length,
      0,
      'el diálogo del acuse no debe leer `firmaClienteUrl`/`firmaRecepcionUrl`: son los refs del formulario y `resetForm()` los vacía',
    )
  })

  test('el acuse guarda la misma lectura del lienzo que se envió en el payload', () => {
    const cuerpo = cuerpoDeOnSubmit()

    for (const [campo, destino] of [
      ['firmaCliente', 'acuseData.firmaClienteUrl'],
      ['firmaRecep', 'acuseData.firmaRecepcionUrl'],
    ]) {
      const identificador = cuerpo.match(new RegExp(`${campo}: ([A-Za-z_$][\\w$]*)`))?.[1]
      assert.ok(
        identificador,
        `\`${campo}\` debe apuntar a una variable con la firma leída, no a una referencia de la vista`,
      )
      assert.match(
        cuerpo,
        new RegExp(`${destino.replace('.', '\\.')} = ${identificador}\\b`),
        `el acuse debe guardar la misma variable \`${identificador}\` que se envió como \`${campo}\`, para comprobante y registro coincidan`,
      )
    }
  })

  test('las firmas se copian al acuse ANTES de limpiar el formulario', () => {
    const cuerpo = cuerpoDeOnSubmit()

    const posCopia = cuerpo.indexOf('acuseData.firmaClienteUrl =')
    const posLimpieza = cuerpo.indexOf('resetForm()')

    assert.notEqual(posCopia, -1, 'onSubmit no copia la firma del cliente al acuse')
    assert.notEqual(posLimpieza, -1, 'onSubmit debe seguir limpiando el formulario tras guardar')
    assert.ok(
      posCopia < posLimpieza,
      'el acuse debe copiar las firmas antes de que `resetForm()` vacíe los refs del formulario',
    )
  })

  test('el arreglo no es dejar el formulario sucio: `resetForm` sigue limpiando', () => {
    const reset = cuerpoDeResetForm()

    assert.match(
      reset,
      /firmaClienteUrl\.value = ''/,
      '`resetForm()` debe seguir vaciando el ref de la firma del cliente',
    )
    assert.match(
      reset,
      /firmaRecepcionUrl\.value = ''/,
      '`resetForm()` debe seguir vaciando el ref de la firma de recepción',
    )
  })
})

describe('D8 · el cliente se elige en un modal con búsqueda y cuadrícula', () => {
  const PLANTILLA = FUENTE.replace(/<!--[\s\S]*?-->/g, '')
  const SELECTOR = readFileSync(
    fileURLToPath(new URL('../components/SelectorClienteDialogo.vue', import.meta.url)),
    'utf8',
  )

  /** La etiqueta de apertura del componente del modal en la plantilla. */
  function etiquetaSelector() {
    const inicio = PLANTILLA.indexOf('<SelectorClienteDialogo')
    assert.notEqual(inicio, -1, 'IndexPage no usa SelectorClienteDialogo')
    return PLANTILLA.slice(inicio, PLANTILLA.indexOf('/>', inicio))
  }

  test('las opciones salen de opcionesDeClientes (clave delante de la razón social)', () => {
    assert.match(CODIGO, /opcionesDeClientes\(catalogos\.clientes\)/)
  })

  test('ya no hay desplegable de cliente: el q-select se sustituyó por el modal', () => {
    assert.doesNotMatch(PLANTILLA, /<q-select[^>]*v-model="form\.cliente"/)
  })

  test('el modal recibe las opciones y el cliente elegido, y avisa al elegir', () => {
    const etiqueta = etiquetaSelector()
    assert.match(etiqueta, /v-model="mostrarSelectorCliente"/)
    assert.match(etiqueta, /:clientes="opcionesClientes"/)
    assert.match(etiqueta, /:seleccionado="form\.cliente"/)
    assert.match(etiqueta, /@elegir="elegirCliente"/)
  })

  test('elegir guarda el id en el formulario', () => {
    assert.match(CODIGO, /const elegirCliente = (async )?\(id\) =>[\s\S]*?form\.cliente = id/)
  })

  test('el botón que abre el modal tiene aria-label y tooltip', () => {
    const inicio = PLANTILLA.indexOf('aria-label="Buscar y elegir cliente"')
    assert.notEqual(inicio, -1, 'falta el aria-label del botón de elegir cliente')
    const fin = PLANTILLA.indexOf('</q-btn>', inicio)
    assert.match(PLANTILLA.slice(inicio, fin), /<q-tooltip>/)
  })

  test('el cliente se busca por id, nunca por razón social', () => {
    assert.match(CODIGO, /catalogos\.clientes\.find\(\(c\) => c\.id === form\.cliente\)/)
    assert.doesNotMatch(CODIGO, /c\.razonSocial === form\.cliente/)
  })

  test('el acuse muestra la razón social, no el id', () => {
    assert.match(CODIGO, /acuseData\.cliente = clienteSel\?\.razonSocial/)
  })

  test('la cuadrícula se adapta: 1, 2, 3 y 4 columnas según el ancho', () => {
    assert.match(SELECTOR, /class="col-12 col-sm-6 col-md-4 col-lg-3"/)
    assert.match(SELECTOR, /:maximized="\$q\.screen\.lt\.sm"/)
  })

  test('la cuadrícula se pagina con paginarClientes y filtra con filtrarOpcionesClientes', () => {
    assert.match(SELECTOR, /paginarClientes\(/)
    assert.match(SELECTOR, /filtrarOpcionesClientes\(/)
  })
})

describe('D9 · los archivos que no se guardan se avisan y se pueden reintentar', () => {
  const PLANTILLA = FUENTE.replace(/<!--[\s\S]*?-->/g, '')

  test('la vista no arma su propio PDF: usa el del componente del acuse', () => {
    assert.doesNotMatch(CODIGO, /import html2pdf/)
    assert.match(CODIGO, /acuseComp\.value\?\.generarPdf\(\)/)
  })

  test('el acuse se genera cuando el diálogo ya se mostró (@show), no antes', () => {
    assert.match(PLANTILLA, /<q-dialog[^>]*@show="guardarAcuseEnCarpeta"/)
  })

  test('las subidas pasan por subirEnOrden y lo pendiente se guarda', () => {
    assert.match(CODIGO, /subirEnOrden\(/)
    assert.match(CODIGO, /archivosPendientes\.value = /)
  })

  test('una falla ya no se queda solo en la consola', () => {
    assert.doesNotMatch(CODIGO, /console\.warn\('No se pudo subir/)
  })

  test('hay aviso con el texto de lo pendiente y botón Reintentar con tooltip', () => {
    assert.match(PLANTILLA, /textoArchivosPendientes\(archivosPendientes\)/)
    const inicio = PLANTILLA.indexOf('label="Reintentar"')
    assert.notEqual(inicio, -1, 'falta el botón Reintentar')
    assert.match(PLANTILLA.slice(inicio, PLANTILLA.indexOf('</q-btn>', inicio)), /<q-tooltip[\s>]/)
  })

  test('reintentar no se dispara dos veces (bandera de reentrada)', () => {
    assert.match(
      CODIGO,
      /const reintentarPendientes = async \(\) => \{\s*if \(reintentando\.value\) return/,
    )
  })
})

describe('Campos sin tooltip redundante', () => {
  const PLANTILLA = FUENTE.replace(/<!--[\s\S]*?-->/g, '')

  test('el campo Cliente muestra el nombre elegido sin repetirlo en un tooltip', () => {
    const marca = PLANTILLA.indexOf('class="campo-cliente selector-moderno"')
    const inicio = PLANTILLA.lastIndexOf('<q-input', marca)
    const fin = PLANTILLA.indexOf('</q-input>', marca)
    const campo = PLANTILLA.slice(inicio, fin)

    assert.match(campo, /:model-value="etiquetaCliente"/, 'el campo muestra el cliente elegido')
    assert.doesNotMatch(
      campo,
      /<q-tooltip[^>]*>\{\{\s*etiquetaCliente\s*\}\}<\/q-tooltip>/,
      'no repite el nombre en un tooltip',
    )
  })

  test('el selector de tipo muestra la opción elegida sin repetirla en un tooltip', () => {
    const inicio = PLANTILLA.indexOf('v-model="form.tipoDocumento"')
    const fin = PLANTILLA.indexOf('</q-select>', inicio)
    const selector = PLANTILLA.slice(inicio, fin)

    assert.match(
      selector,
      /\{\{\s*scope\.opt\?\.label \?\? scope\.opt\s*\}\}/,
      'el selector muestra el tipo elegido',
    )
    assert.doesNotMatch(selector, /q-tooltip/, 'no repite el tipo en un tooltip')
  })
})
