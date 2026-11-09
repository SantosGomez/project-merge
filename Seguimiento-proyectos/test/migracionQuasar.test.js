// Migración a componentes de Quasar (plan en MEMORY.md, regla en AGENTS.md): cada rebanada agrega
// aquí los archivos que ya migró. Un archivo migrado no usa colores hexadecimales sueltos (salen de
// la paleta $dg-colores) ni los elementos nativos que Quasar ya resuelve (listas y botones).

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const leer = (ruta) => readFileSync(new URL(`../src/${ruta}`, import.meta.url), 'utf8')

const MIGRADOS = [
  // Rebanada 2: etiqueta de prioridad, botón del logo y listas de ayuda
  'components/PriorityTag.vue',
  'components/AccessDenied.vue',
  'components/AvisoSesionCaducada.vue',
  'pages/LoginPage.vue',
  'layouts/MaquetaLayout.vue',
  // Rebanada 3: avisos de vacío y de error de carga
  'components/EmptyState.vue',
  'components/ErrorState.vue',
  // Rebanada 4: filas de contadores, tarjetas del resumen y dona
  'components/CounterCountsRow.vue',
  'components/ResumenEquipo.vue',
  'components/DonaEstados.vue',
  // Rebanada 5: formularios
  'components/CaseFormDialog.vue',
  'components/NewUserDialog.vue',
  'components/ResetPasswordDialog.vue',
]

describe('Archivos migrados a Quasar', () => {
  for (const ruta of MIGRADOS) {
    it(`${ruta} toma los colores de la paleta, sin hexadecimales sueltos`, () => {
      const hexadecimales = leer(ruta).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? []
      assert.deepEqual(hexadecimales, [], 'usar var(--dg-*), text-dg-*/bg-dg-* o color="dg-..."')
    })

    it(`${ruta} usa q-list, q-item y q-btn en vez de ul, li y button nativos`, () => {
      const plantilla = leer(ruta).split('<script')[0]
      assert.doesNotMatch(plantilla, /<(ul|ol|li|button)[\s>]/)
    })
  }
})

describe('Rebanada 2: piezas pequeñas', () => {
  it('PriorityTag es un q-chip con los colores de la paleta de cada prioridad', () => {
    const etiqueta = leer('components/PriorityTag.vue')
    assert.match(etiqueta, /<q-chip/)
    assert.match(etiqueta, /`dg-prioridad-\$\{props\.priority\}`/, 'texto de la prioridad')
    assert.match(etiqueta, /`dg-prioridad-\$\{props\.priority\}-fondo`/, 'fondo de la prioridad')
    assert.match(etiqueta, /var\(--dg-prioridad-(alta|media|baja)-borde\)/, 'borde de la prioridad')
    assert.match(etiqueta, /tabindex="0"/, 'recibe foco para leer su ayuda con teclado')
    assert.match(etiqueta, /:aria-label="etiquetaAccesible"/)
    assert.match(etiqueta, /<q-tooltip v-if="tooltip">/)
  })

  // Revisión de UI, rebanada 1: acceso denegado quedó con dos puntos al quitar los textos de la
  // maqueta, y sesión caducada dejó la lista porque repetía su propio mensaje.
  it('la ayuda de acceso denegado es un q-list con un q-item por punto', () => {
    const plantilla = leer('components/AccessDenied.vue').split('<script')[0]
    assert.match(plantilla, /<q-list[^>]*dense/, 'lista de Quasar')
    assert.equal((plantilla.match(/<q-item[\s>]/g) ?? []).length, 2, 'los puntos de ayuda')
  })
})

describe('Rebanada 3: avisos de vacío y de error', () => {
  it('EmptyState es un q-card plano que se anuncia como estado, con su título enlazado', () => {
    const plantilla = leer('components/EmptyState.vue').split('<script')[0]
    assert.match(plantilla, /<q-card[^>]*\bflat\b/)
    assert.match(plantilla, /<q-card[^>]*role="status"/)
    assert.match(plantilla, /<q-card[^>]*:aria-labelledby="titleId"/)
    assert.match(plantilla, /<q-card-section/)
  })

  it('ErrorState es un q-banner que se anuncia como alerta, con el reintento en su ranura de acción', () => {
    const plantilla = leer('components/ErrorState.vue').split('<script')[0]
    assert.match(plantilla, /<q-banner[^>]*role="alert"/)
    assert.match(plantilla, /<q-banner[^>]*:aria-labelledby="titleId"/)
    assert.match(plantilla, /<template #action>[\s\S]*@click="emit\('retry'\)"/)
  })
})

describe('Rebanada 4: filas de contadores, tarjetas del resumen y dona', () => {
  it('cada fila de contador es un q-item de lista con q-btn para el nombre y para cada conteo', () => {
    const plantilla = leer('components/CounterCountsRow.vue').split('<script')[0]
    assert.match(plantilla, /<q-item[^>]*tag="li"/, 'conserva la semántica de lista')
    assert.match(plantilla, /<q-btn[^>]*class="counter-row__select[\s\S]*?:aria-pressed="selected"[\s\S]*?@click="emit\('select'\)"/)
    assert.match(plantilla, /<q-btn[\s\S]*?v-for="status in STATUSES"[\s\S]*?:aria-pressed=[\s\S]*?@click="emit\('filtrar', status\)"/)
    assert.match(plantilla, /<q-tooltip v-if="ayudaConteo\(status\)">/)
  })

  it('la lista de contadores del dashboard es un q-list que se lee como lista', () => {
    const plantilla = leer('pages/AdminDashboardPage.vue').split('<script')[0]
    assert.match(plantilla, /<q-list[^>]*tag="ul"[^>]*class="counter-list"/)
  })

  it('las tarjetas del resumen son q-card dentro de un q-list, con foco para leer su ayuda', () => {
    const plantilla = leer('components/ResumenEquipo.vue').split('<script')[0]
    assert.match(plantilla, /<q-list[^>]*tag="ul"[^>]*class="resumen-equipo__tarjetas"/)
    assert.match(plantilla, /<q-card[^>]*tag="li"[^>]*v-for="tarjeta in tarjetas"[\s\S]*?tabindex="0"/)
    assert.match(plantilla, /<q-card-section/)
  })

  it('la dona es un SVG dentro de un q-card (excepción acordada) y su leyenda es un q-list', () => {
    const plantilla = leer('components/DonaEstados.vue').split('<script')[0]
    assert.match(plantilla, /<q-card[^>]*tag="figure"[\s\S]*<svg/)
    assert.match(plantilla, /<q-list[^>]*tag="ul"[^>]*class="dona-estados__leyenda"[\s\S]*?<q-item[^>]*tag="li"/)
  })
})

describe('Rebanada 5: formularios', () => {
  const FORMULARIOS = [
    'pages/LoginPage.vue',
    'components/CaseFormDialog.vue',
    'components/NewUserDialog.vue',
    'components/ResetPasswordDialog.vue',
  ]

  for (const ruta of FORMULARIOS) {
    it(`${ruta} usa q-form (sin <form> nativo) y envía con @submit`, () => {
      const plantilla = leer(ruta).split('<script')[0]
      assert.doesNotMatch(plantilla, /<form[\s>]/)
      assert.match(plantilla, /<q-form[^>]*\bnovalidate\b[^>]*@submit="/)
    })
  }

  it('el login muestra la falta de correo y de contraseña con error-message de cada campo', () => {
    const plantilla = leer('pages/LoginPage.vue').split('<script')[0]
    assert.doesNotMatch(plantilla, /login-form__error/)
    assert.match(plantilla, /:error="missing\.username"[\s\S]*?error-message="Falta el correo\. Escríbelo para iniciar sesión\."/)
    assert.match(plantilla, /:error="missing\.password"[\s\S]*?error-message="Falta la contraseña\. Escríbela para iniciar sesión\."/)
  })

  it('el formulario de caso muestra cada error bajo su campo con error-message, sin párrafos aparte', () => {
    const componente = leer('components/CaseFormDialog.vue')
    const plantilla = componente.split('<script')[0]
    assert.doesNotMatch(plantilla, /class="form-error"/)
    for (const codigos of [
      "'client_required', 'client_too_long'",
      "'priority_required'",
      "'fecha_inicio_invalido'",
      "'descripcion_demasiado_largo'",
      "'observaciones_demasiado_largo'",
    ]) {
      assert.ok(plantilla.includes(`:error-message="errorDeCampo(${codigos})"`), `error-message de ${codigos}`)
    }
    // Revisión de UI, rebanada 3: varios errores a la vez, uno por campo.
    assert.match(componente, /codigos\.map\(\(codigo\) => erroresCampo\.value\[codigo\]\)\.find\(Boolean\) \?\? null/)
  })
})
