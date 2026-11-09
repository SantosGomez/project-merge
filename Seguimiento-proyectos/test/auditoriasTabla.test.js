/*
 * Auditorías (UI parte 4) — verificación estática: tabla en escritorio y botón flotante en móvil.
 * No monta Vue; comprueba cadenas clave de la página y del componente de la tabla.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const ruta = (p) => fileURLToPath(new URL(p, import.meta.url))
const read = (p) => readFileSync(ruta(p), 'utf8')

describe('Auditorías: tabla en escritorio (≥ 1024 px)', () => {
  const pagina = read('../src/pages/AuditoriasPage.vue')

  it('la página usa la tabla en escritorio y las tarjetas en el resto', () => {
    assert.ok(existsSync(ruta('../src/components/AuditoriasTabla.vue')), 'existe AuditoriasTabla.vue')
    assert.match(pagina, /import AuditoriasTabla from '\.\.\/components\/AuditoriasTabla\.vue'/)
    assert.match(pagina, /const vistaTabla = computed\(\(\) => \$q\.screen\.width >= 1024\)/)
    assert.match(pagina, /<AuditoriasTabla[\s\S]*?v-else-if="vistaTabla"[\s\S]*?:auditorias="auditoriasFiltradas"/)
    assert.match(pagina, /<div v-else class="auditorias-page__lista">\s*<AuditoriaItem/)
  })

  it('la tabla muestra las columnas acordadas y no ordena por encabezado', () => {
    const tabla = read('../src/components/AuditoriasTabla.vue')
    const etiquetas = [...tabla.matchAll(/label: '([^']+)'/g)].map((m) => m[1])
    assert.deepEqual(etiquetas, [
      'Semáforo',
      'Cliente y expediente',
      'Tipo',
      'Estado',
      'Fase',
      'Próximo plazo',
      'Contadores',
      'Acciones',
    ])
    assert.doesNotMatch(tabla, /sortable: true/, 'el orden lo da «Ordenar por»')
    assert.match(tabla, /<q-table/)
    assert.match(tabla, /@row-click=/, 'clic en la fila abre la ficha')
    assert.match(tabla, /emit\('ver-detalle'/)
    assert.match(tabla, /emit\('editar'/)
    assert.match(tabla, /@click\.stop=/, 'los botones no disparan también el clic de la fila')
  })
})

describe('Auditorías: botón flotante en móvil (< 600 px)', () => {
  const pagina = read('../src/pages/AuditoriasPage.vue')

  it('en móvil el registro va en un FAB y se oculta el botón del encabezado', () => {
    assert.match(pagina, /class="auditorias-page__register-btn control-touch gt-xs[^"]*"/)
    assert.match(pagina, /<q-page-sticky[\s\S]*?class="lt-sm"[\s\S]*?position="bottom-right"/)
    assert.match(pagina, /<q-btn[\s\S]*?fab[\s\S]*?icon="add"[\s\S]*?aria-label="Registrar auditoría"[\s\S]*?@click="abrirRegistro"/)
  })
})
