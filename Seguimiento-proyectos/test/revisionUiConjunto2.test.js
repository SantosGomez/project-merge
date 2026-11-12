/*
 * Revisión de UI del 2026-11-12 (rama revision-ui): verificación estática de los defectos
 * corregidos en la segunda revisión de conjunto. Cada prueba exige el comportamiento nuevo;
 * con el código anterior fallaba.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const componente = (nombre) => leer(`../src/components/${nombre}.vue`)
const pagina = (nombre) => leer(`../src/pages/${nombre}.vue`)
const appScss = leer('../src/css/app.scss')

describe('Revisión de UI (2026-11-12): bugs', () => {
  it('«Contador asignado» muestra al dueño del caso al editar y no aparece al registrar para otro', () => {
    const formulario = componente('CaseFormDialog')
    assert.match(formulario, /modoEdicion\.value && props\.caso\?\.nombre_contador\) return props\.caso\.nombre_contador/)
    assert.match(formulario, /<dl v-else-if="!modoAuxiliar" class="readonly-info">/)
  })

  it('el diálogo «Contador que apoya» descarta la respuesta de una carga anterior', () => {
    const dialogo = componente('ContadoresDeAuxiliarDialog')
    assert.match(dialogo, /const actual = \+\+peticion/)
    assert.match(dialogo, /if \(actual !== peticion\) return\s+cargados\.value = ids/)
  })

  it('registrar la entrega de un evento abierto en edición cierra el formulario', () => {
    assert.match(
      componente('BitacoraAuditoria'),
      /if \(eventoEnEdicion\.value\?\.id === ev\.id\) cerrarFormulario\(\)\s+\$q\.notify\(\{ type: 'positive', message: `Entrega registrada/,
    )
  })

  it('un guardado descartado en «Mis casos» no se avisa como fallo', () => {
    assert.match(pagina('MyCasesPage'), /\} else if \(!resultado\.descartado\) \{/)
  })

  it('«Mis casos» y «Mi resumen» releen la lista al volver a la ventana', () => {
    for (const nombre of ['MyCasesPage', 'ContadorDashboardPage']) {
      assert.match(
        pagina(nombre),
        /const actualizarHoy = \(\) => \{[\s\S]*?hoy\.value = hoyLocal\(\)[\s\S]*?cases\.refrescarEnSilencio\(\)\s+\}/,
        nombre,
      )
    }
  })

  it('el botón de la agenda no se cruza con otro guardado y su error ofrece «Reintentar»', () => {
    const resumen = pagina('ContadorDashboardPage')
    assert.match(resumen, /const cambiarEstado = async \(casoId, estado\) => \{[\s\S]*?if \(casoCambiando\.value !== null\) return/)
    assert.match(resumen, /handler: \(\) => cambiarEstado\(casoId, estado\)/)
  })

  it('los botones de acción de la tabla de auditorías van en un renglón', () => {
    assert.match(
      componente('AuditoriasTabla'),
      /\.auditorias-tabla :deep\(td\.auditorias-tabla__acciones\)\s*\{\s*white-space:\s*nowrap/,
    )
  })

  it('la cifra de la dona no se parte y baja entera cuando la leyenda es angosta', () => {
    const dona = componente('DonaEstados')
    assert.match(dona, /\.dona-estados__cifra\s*\{[^}]*white-space:\s*nowrap/)
    assert.match(dona, /container-type:\s*inline-size/)
    assert.match(dona, /@container \(max-width: 200px\)/)
  })
})

describe('Revisión de UI (2026-11-12): accesibilidad, textos y paleta', () => {
  it('las confirmaciones que descartan o borran enfocan primero el botón que no pierde nada', () => {
    for (const nombre of ['ResetPasswordDialog', 'CambiarContrasenaDialog', 'NewUserDialog', 'BitacoraAuditoria']) {
      assert.match(componente(nombre), /label: 'Descartar'[^\n]*\n\s*focus: 'cancel'/, nombre)
    }
    assert.match(componente('BitacoraAuditoria'), /label: 'Borrar evento'[^\n]*\n\s*focus: 'cancel'/)
    assert.match(pagina('ContadorAuxiliaresPage'), /label: 'Quitar'[^\n]*\n\s*focus: 'cancel'/)
  })

  it('los iconos con nombre accesible del acceso no quedan ocultos al lector de pantalla', () => {
    assert.match(pagina('LoginPage'), /aria-hidden="false"\s+aria-label="Ayuda sobre el campo correo"/)
    assert.equal(pagina('CambiarContrasenaPage').match(/aria-hidden="false"\s+aria-label="Las contraseñas coinciden"/g)?.length, 2)
  })

  it('el formulario de auditoría dice «En proceso», como el resto de la app', () => {
    const formulario = componente('AuditoriaFormDialog')
    assert.match(formulario, /:option-label="etiquetaEstado"/)
    assert.match(formulario, /<q-item-label>\{\{ etiquetaEstado\(opt\) \}\}<\/q-item-label>/)
  })

  it('los textos nombran las pantallas como las ve el usuario', () => {
    assert.doesNotMatch(pagina('CountersDirectoryPage'), /en el dashboard/)
    assert.match(pagina('ContadorDashboardPage'), /Abre «Mi perfil», donde agregas o quitas a los auxiliares que te apoyan\./)
    assert.doesNotMatch(pagina('ContadorAuxiliaresPage'), /coincide con "\{\{/)
    assert.match(componente('NewUserDialog'), /Los campos con \* son obligatorios\./)
  })

  it('los encabezados no heredan el alto de línea ni el peso fino de Quasar', () => {
    assert.match(appScss, /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{\s*font-weight:\s*600;\s*line-height:\s*1\.3;\s*letter-spacing:\s*normal;/)
  })

  it('ninguna vista usa el `white` genérico ni `text-primary` para texto', () => {
    for (const ruta of ['../src/pages/MyCasesPage.vue', '../src/components/ChatAuditoria.vue', '../src/layouts/MaquetaLayout.vue']) {
      assert.doesNotMatch(leer(ruta), /color: 'white'/, ruta)
    }
    assert.doesNotMatch(componente('CaseFormDialog'), /text-primary/)
  })

  it('el hover del enlace a «Mi perfil» del menú solo aplica con ratón', () => {
    assert.match(
      leer('../src/layouts/MaquetaLayout.vue'),
      /@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*\.drawer-usuario__fila--enlace:hover/,
    )
  })
})
