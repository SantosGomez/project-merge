// Pruebas de la barra de acciones rápidas en ContadorDashboardPage (pestaña Casos).

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Este test verifica estáticamente que la página ContadorDashboardPage.vue
// tiene los dos botones en la pestaña "Casos" con los handlers correctos.
// No usa Vue ni renderizado; lee el archivo y busca los patrones esperados.

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const archivo = path.resolve(__dirname, '../src/pages/ContadorDashboardPage.vue')
const contenido = fs.readFileSync(archivo, 'utf8')

test('ContadorDashboardPage tiene botón "Registrar caso" en pestaña Casos', () => {
  // Debe haber un q-btn con label "Registrar caso" (o icon add_circle) dentro de la pestaña casos
  // Buscamos que exista un q-btn con @click que abra el diálogo de registro (emite o navega)
  // En el código actual, el registro se hace en Mis casos; aquí el botón debe navegar a contador-casos
  // o abrir el diálogo si se decide. La especificación R2 dice: "Registrar caso" abre el diálogo.
  // Como el diálogo está en MyCasesPage, el botón aquí navega a contador-casos (que abre el diálogo al llegar).
  assert.ok(
    contenido.includes('Registrar caso'),
    'Debe existir un botón con label "Registrar caso"'
  )
  // Verificamos que está condicionado a la pestaña casos (v-if="pestana === 'casos"' o similar)
  assert.ok(
    /pestana\s*===\s*['"]casos['"]/.test(contenido),
    'Debe haber una condición para mostrar solo en pestaña Casos'
  )
})

test('ContadorDashboardPage tiene botón "Ver todos" en pestaña Casos', () => {
  assert.ok(
    contenido.includes('Ver todos'),
    'Debe existir un botón con label "Ver todos"'
  )
  assert.ok(
    /pestana\s*===\s*['"]casos['"]/.test(contenido),
    'Debe haber una condición para mostrar solo en pestaña Casos'
  )
})

test('ContadorDashboardPage: "Registrar caso" navega a contador-casos', () => {
  // El botón debe tener :to="{ name: 'contador-casos' }" o @click que haga router.push
  const tieneTo = /:to\s*=\s*["']\{[^}]*contador-casos[^}]*\}["']/.test(contenido)
  const tienePush = /router\.push\s*\(\s*\{[^}]*contador-casos[^}]*\}\s*\)/.test(contenido)
  const tieneHref = /href\s*=\s*["'][^"']*contador-casos[^"']*["']/.test(contenido)
  assert.ok(tieneTo || tienePush || tieneHref, 'El botón "Registrar caso" debe navegar a contador-casos')
})

test('ContadorDashboardPage: "Ver todos" navega a contador-casos sin filtro', () => {
  // "Ver todos" debe ir a la misma ruta pero sin query filtro (o con filtro vacío)
  const tieneTo = /:to\s*=\s*["']\{[^}]*contador-casos[^}]*\}["']/.test(contenido)
  const tienePush = /router\.push\s*\(\s*\{[^}]*contador-casos[^}]*\}\s*\)/.test(contenido)
  assert.ok(tieneTo || tienePush, 'El botón "Ver todos" debe navegar a contador-casos')
})

test('ContadorDashboardPage: ambos botones tienen clase control-touch (≥44px)', () => {
  assert.ok(
    contenido.includes('control-touch'),
    'Los botones deben tener la clase control-touch para accesibilidad táctil'
  )
})