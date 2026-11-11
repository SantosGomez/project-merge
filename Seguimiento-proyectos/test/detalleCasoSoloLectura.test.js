// Pruebas estáticas: ficha de solo lectura «Ver» en «Mis casos».
// No hay campos editables; abre desde «Mis casos» con botón «Ver» en CasoItem.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]
const scriptDe = (fuente) => fuente.slice(fuente.indexOf('<script'), fuente.indexOf('<style'))
const estilosDe = (fuente) => fuente.slice(fuente.indexOf('<style'))

const casoItem = leer('../src/components/CasoItem.vue')
const myCases = leer('../src/pages/MyCasesPage.vue')
const detalle = leer('../src/components/CasoDetalleDialog.vue')

describe('Grupo A: botón «Ver» en CasoItem', () => {
  it('emite ver y no emite estado ni edición', () => {
    const plantilla = plantillaDe(casoItem)
    const script = scriptDe(casoItem)
    assert.match(script, /defineEmits\(\[[\s\S]*?'ver'/, 'emit "ver" declarado')
    // El botón Ver debe emitir 'ver', no 'editar' ni 'cambiar-estado'
    const bloqueVer = plantilla.slice(
      plantilla.indexOf('label="Ver"'),
      plantilla.indexOf('</q-btn>', plantilla.indexOf('label="Ver"')),
    )
    assert.match(bloqueVer, /@click="emit\('ver'\)"/, 'emite ver')
    assert.doesNotMatch(
      bloqueVer,
      /@click="emit\('cambiar-estado'\)"/,
      'no dispara cambio de estado',
    )
    assert.doesNotMatch(bloqueVer, /@click="emit\('editar'\)"/, 'no dispara edición')
  })

  it('solo aparece en ramas editables (no en soloLectura ni soloCambiaEstado)', () => {
    const plantilla = plantillaDe(casoItem)
    // Busca el botón Ver en toda la plantilla; debe estar en la rama v-else (editable/soloEstado)
    assert.match(plantilla, /label="Ver"/, 'botón Ver presente en plantilla')
    assert.match(plantilla, /icon="visibility"/, 'icono visibility')
    assert.match(plantilla, /flat/, 'botón plano (secundario)')
    assert.match(plantilla, /control-touch/, 'área táctil 44 px')
    assert.match(plantilla, /boton-presionable/, 'feedback al presionar')
    assert.match(
      plantilla,
      /Abre la ficha del caso en modo consulta\./,
      'tooltip aclara que es solo consulta',
    )
    // No debe estar en la rama soloLectura (admin)
    const bloqueSoloLectura = plantilla.slice(
      plantilla.indexOf('<q-item-section v-if="soloLectura" side class="caso-item__acciones">'),
      plantilla.indexOf(
        '</q-item-section>',
        plantilla.indexOf('<q-item-section v-if="soloLectura" side class="caso-item__acciones">'),
      ),
    )
    assert.doesNotMatch(bloqueSoloLectura, /label="Ver"/, 'no hay botón Ver en soloLectura')
  })

  it('NO aparece en la rama soloLectura (vista admin)', () => {
    const plantilla = plantillaDe(casoItem)
    const bloqueSoloLectura = plantilla.slice(
      plantilla.indexOf('<q-item-section v-if="soloLectura" side class="caso-item__acciones">'),
      plantilla.indexOf(
        '</q-item-section>',
        plantilla.indexOf('<q-item-section v-if="soloLectura" side class="caso-item__acciones">'),
      ),
    )
    assert.doesNotMatch(bloqueSoloLectura, /label="Ver"/, 'no hay botón Ver en soloLectura')
  })
})

describe('Grupo B: CasoDetalleDialog.vue — ficha de solo lectura', () => {
  it('existe el componente', () => {
    assert.ok(detalle.includes('<template>'), 'archivo creado')
  })

  it('no contiene formularios ni campos editables', () => {
    const plantilla = plantillaDe(detalle)
    assert.doesNotMatch(plantilla, /<q-form/, 'sin q-form')
    assert.doesNotMatch(plantilla, /<q-input/, 'sin q-input')
    assert.doesNotMatch(plantilla, /<q-select/, 'sin q-select')
    assert.doesNotMatch(plantilla, /<q-toggle/, 'sin q-toggle')
    assert.doesNotMatch(plantilla, /<q-btn[^>]*type="submit"/, 'sin botón submit')
  })

  it('usa q-dialog con transiciones estándar y no es persistente', () => {
    const plantilla = plantillaDe(detalle)
    assert.match(plantilla, /transition-show="dialogo-entra"/, 'entrada estándar')
    assert.match(plantilla, /transition-hide="dialogo-sale"/, 'salida estándar')
    assert.match(plantilla, /:transition-duration="220"/, '220 ms')
    assert.doesNotMatch(plantilla, /:persistent=/, 'no persistente: no hay datos que perder')
  })

  it('muestra cliente, prioridad, estado, contador, fechas, descripción y observaciones', () => {
    const plantilla = plantillaDe(detalle)
    const script = scriptDe(detalle)
    for (const campo of [
      'cliente',
      'prioridad',
      'estado',
      'nombre_contador',
      'fecha_inicio',
      'fecha_vencimiento',
      'descripcion',
      'observaciones',
    ]) {
      assert.ok(plantilla.includes(campo) || script.includes(campo), `campo ${campo} presente`)
    }
    // Las fechas del store vienen en AAAA-MM-DD: la ficha las pasa a DD-MM-AAAA.
    assert.match(script, /fechaParaFormulario\(props\.caso\.fecha_inicio\)/, 'inicio formateado')
    assert.match(
      script,
      /fechaParaFormulario\(props\.caso\.fecha_vencimiento\)/,
      'vencimiento formateado',
    )
    // Etiqueta de prioridad
    assert.match(plantilla, /<PriorityTag/, 'prioridad con PriorityTag')
    // Estado como texto (no selector)
    assert.match(plantilla, /class="detalle-estado"/, 'estado como texto visible')
  })

  it('textos explícitos cuando descripción u observaciones están vacías', () => {
    const plantilla = plantillaDe(detalle)
    assert.match(
      plantilla,
      /Sin descripción|sin descripción/i,
      'texto explícito para descripción vacía',
    )
    assert.match(
      plantilla,
      /Sin observaciones|sin observaciones/i,
      'texto explícito para observaciones vacías',
    )
  })

  it('respeta saltos de línea y no usa colores hexadecimales', () => {
    const estilos = estilosDe(detalle)
    assert.match(estilos, /white-space:\s*pre-line|pre-wrap/, 'saltos de línea respetados')
    assert.doesNotMatch(estilos, /#[0-9a-fA-F]{3,6}\b/, 'sin hexadecimales en estilos')
  })

  it('cierra con botón, Esc y clic fuera', () => {
    const plantilla = plantillaDe(detalle)
    assert.match(plantilla, /label="Cerrar"/, 'botón Cerrar')
    // q-dialog por defecto cierra con Esc y clic fuera si no es persistent
  })
})

describe('Grupo C: MyCasesPage.vue — integración', () => {
  it('define refs para el diálogo de detalle y función abrirDetalle', () => {
    const script = scriptDe(myCases)
    assert.match(script, /const detalleAbierto = ref\(false\)/, 'ref detalleAbierto')
    assert.match(script, /const casoEnDetalle = ref\(null\)/, 'ref casoEnDetalle')
    assert.match(script, /const abrirDetalle = \(caseId\) => \{/, 'función abrirDetalle')
    assert.match(script, /cases\.casos\.find/, 'busca el caso del store')
    assert.match(script, /detalleAbierto\.value = casoEnDetalle\.value !== null/, 'abre el diálogo')
  })

  it('cablea @ver en CasoItem', () => {
    const plantilla = plantillaDe(myCases)
    assert.match(plantilla, /@ver="abrirDetalle\(item\.id\)"/, 'manejador @ver')
  })

  it('incluye CasoDetalleDialog en la plantilla', () => {
    const plantilla = plantillaDe(myCases)
    assert.match(plantilla, /<CasoDetalleDialog/, 'diálogo presente')
    assert.match(plantilla, /v-model="detalleAbierto"/, 'v-model conectado')
    assert.match(plantilla, /:caso="casoEnDetalle"/, 'caso pasado como prop')
  })
})

describe('Grupo D: rediseño moderno de CasoDetalleDialog', () => {
  it('usa iconos en todos los campos', () => {
    const plantilla = plantillaDe(detalle)
    for (const icono of [
      'flag',
      'tune',
      'star',
      'person',
      'event',
      'schedule',
      'play_circle_outline',
      'description',
      'sticky_note_2',
      'visibility',
    ]) {
      assert.match(plantilla, new RegExp(`name="${icono}"`), `icono ${icono} presente`)
    }
  })

  it('agrupa los campos en secciones separadas', () => {
    const plantilla = plantillaDe(detalle)
    const estilos = estilosDe(detalle)
    assert.match(plantilla, /class="detalle-seccion"/, 'secciones presentes')
    assert.match(estilos, /\.detalle-seccion \+ \.detalle-seccion/, 'regla de separador')
    assert.match(
      estilos,
      /border-top:\s*1px solid var\(--dg-borde\)/,
      'separador con borde de paleta',
    )
  })

  it('usa radius 12 px y ancho 1080', () => {
    const estilos = estilosDe(detalle)
    assert.match(estilos, /border-radius:\s*12px/, 'radius 12 px')
    assert.match(estilos, /min\(1080px,\s*calc\(100vw - 32px\)\)/, 'ancho 1080')
  })

  it('limita la altura de los textos largos con scroll', () => {
    const estilos = estilosDe(detalle)
    assert.match(estilos, /\.detalle-texto[\s\S]*?max-height:\s*120px/, 'max-height 120')
    assert.match(estilos, /\.detalle-texto[\s\S]*?overflow-y:\s*auto/, 'scroll interno')
  })

  it('pinta el punto de color del estado con COLOR_ESTADO', () => {
    const plantilla = plantillaDe(detalle)
    const script = scriptDe(detalle)
    assert.match(plantilla, /punto-estado-sm/, 'punto de estado pequeño')
    assert.match(script, /COLOR_ESTADO/, 'importa COLOR_ESTADO')
  })

  it('muestra «Tú» para el caso propio y usa la sesión', () => {
    const script = scriptDe(detalle)
    assert.match(script, /useSessionStore/, 'usa la sesión')
    assert.match(script, /'Tú'/, 'texto «Tú»')
    assert.match(script, /contador_id/, 'compara contador_id')
  })

  it('mantiene la cabecera con icono visibility', () => {
    const plantilla = plantillaDe(detalle)
    assert.match(plantilla, /name="visibility"/, 'icono en el encabezado')
  })
})

describe('Grupo E: correcciones de la revisión de la ficha', () => {
  it('el vencimiento lleva texto «Vencido» o «Vence pronto»: el color no es el único aviso', () => {
    const plantilla = plantillaDe(detalle)
    const script = scriptDe(detalle)
    assert.match(plantilla, /v-if="vencido"[^>]*>[\s\S]*?Vencido/, 'etiqueta Vencido con texto')
    assert.match(
      plantilla,
      /v-else-if="proximo"[^>]*>[\s\S]*?Vence pronto/,
      'etiqueta Vence pronto',
    )
    assert.match(
      script,
      /esCasoProximoAVencer\(props\.caso, hoyLocal\(\)\)/,
      'usa la regla de la lista',
    )
  })

  it('la ayuda no menciona «Editar» cuando el caso solo permite cambiar el estado', () => {
    const plantilla = plantillaDe(detalle)
    const script = scriptDe(detalle)
    assert.match(script, /props\.caso\.solo_estado === true/, 'lee solo_estado del backend')
    assert.match(script, /solo puedes cambiar su estado desde la lista/, 'ayuda del caso ajeno')
    assert.match(plantilla, /\{\{ textoAyuda \}\}/, 'la plantilla usa la ayuda calculada')
  })

  it('las etiquetas caben en una línea en escritorio y el cliente largo no desborda', () => {
    const estilos = estilosDe(detalle)
    assert.match(
      estilos,
      /grid-template-columns:\s*170px minmax\(0, 1fr\)/,
      'columna de etiqueta de 170 px',
    )
    assert.match(
      estilos,
      /\.detalle-caso__title \{[^}]*overflow-wrap:\s*anywhere/,
      'título con corte',
    )
  })
})

describe('Grupo F: la ficha se actualiza mientras está abierta', () => {
  const base = {
    id: 7,
    cliente: 'Cliente',
    estado: 'pendiente',
    prioridad: 'media',
    importante: false,
    contador_id: 3,
    fecha_inicio: '2026-11-01',
    fecha_vencimiento: '2026-11-20',
    en_proceso_en: null,
    descripcion: null,
    observaciones: '',
  }

  it('camposActualizadosDelCaso dice qué campos cambiaron, en el orden de la ficha', async () => {
    const { camposActualizadosDelCaso } = await import('../src/utils/caseRules.js')
    assert.deepEqual(camposActualizadosDelCaso(base, { ...base }), [], 'sin cambios')
    assert.deepEqual(
      camposActualizadosDelCaso(base, {
        ...base,
        estado: 'en_proceso',
        en_proceso_en: '2026-11-11 10:00:00',
        fecha_vencimiento: '2026-11-25',
        observaciones: 'Nueva nota',
      }),
      ['estado', 'fecha_vencimiento', 'en_proceso_en', 'observaciones'],
    )
  })

  it('no cuenta como cambio una hora distinta, un vacío equivalente ni 0/false', async () => {
    const { camposActualizadosDelCaso } = await import('../src/utils/caseRules.js')
    assert.deepEqual(
      camposActualizadosDelCaso(base, {
        ...base,
        fecha_inicio: '2026-11-01 00:00:00',
        descripcion: '',
        observaciones: null,
        importante: 0,
        contador_id: '3',
      }),
      [],
    )
    assert.deepEqual(camposActualizadosDelCaso(null, base), [], 'sin caso anterior no hay cambios')
  })

  it('la página sigue al caso del store mientras la ficha está abierta', () => {
    const script = scriptDe(myCases)
    assert.match(
      script,
      /watch\(\s*\(\) => cases\.casos\.find\([^\n]*casoEnDetalle\.value\?\.id/,
      'vigila el caso',
    )
    assert.match(script, /detalleAbierto\.value && nuevo/, 'solo con la ficha abierta')
  })

  it('la ficha avisa con texto qué cambió y lo anuncia a lectores de pantalla', () => {
    const plantilla = plantillaDe(detalle)
    const script = scriptDe(detalle)
    assert.match(script, /camposActualizadosDelCaso\(anterior, nuevo\)/, 'compara el caso anterior')
    assert.match(plantilla, /role="status"/, 'aviso anunciado')
    assert.match(plantilla, /Este caso se actualizó mientras lo veías/, 'texto del aviso')
    assert.match(plantilla, /detalle-campo--actualizado/, 'campo cambiado resaltado')
  })
})

describe('Grupo G: «Importante» solo como chip', () => {
  it('el chip va junto al cliente y no hay fila «Importante» con «No»', () => {
    const plantilla = plantillaDe(detalle)
    const cabecera = plantilla.slice(0, plantilla.indexOf('detalle-caso__body'))
    assert.match(
      cabecera,
      /v-if="caso\.importante"[^>]*class="detalle-importante"/,
      'chip en la cabecera',
    )
    const cuerpo = plantilla.slice(plantilla.indexOf('detalle-caso__body'))
    assert.doesNotMatch(cuerpo, /Importante/, 'sin fila Importante en el cuerpo')
    assert.doesNotMatch(cuerpo, />No</, 'sin valor «No»')
  })
})
