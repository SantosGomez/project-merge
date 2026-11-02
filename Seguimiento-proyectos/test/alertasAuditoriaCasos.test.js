// Pruebas del componente AlertasAuditoria.vue (R3).
// Verifica estáticamente que el componente existe, usa props correctos y emite irFicha.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const archivo = path.resolve(__dirname, '../src/components/AlertasAuditoria.vue')
const contenido = fs.readFileSync(archivo, 'utf8')

test('AlertasAuditoria.vue existe y tiene estructura básica', () => {
  assert.ok(fs.existsSync(archivo), 'El archivo AlertasAuditoria.vue debe existir')
  assert.ok(contenido.includes('<template>'), 'Debe tener template')
  assert.ok(contenido.includes('<script'), 'Debe tener script')
})

test('AlertasAuditoria: define prop "auditorias" (Array) y emite "irFicha"', () => {
  // Busca defineProps con auditorias
  assert.ok(/defineProps\s*\(\s*\{[^}]*auditorias/.test(contenido), 'Debe definir prop "auditorias"')
  // Busca defineEmits con irFicha
  assert.ok(/defineEmits\s*\(\s*\[[^\]]*irFicha[^\]]*\]/.test(contenido), 'Debe emitir "irFicha"')
})

test('AlertasAuditoria: solo muestra auditorías con semáforo Vencido o Crítico', () => {
  // Debe filtrar por semáforo === 'vencido' || semaforo === 'critico'
  assert.ok(/semaforo\s*===?\s*['"]vencido['"]/.test(contenido) || /semáforo\s*===?\s*['"]vencido['"]/.test(contenido), 'Debe filtrar semáforo "vencido"')
  assert.ok(/semaforo\s*===?\s*['"]critico['"]/.test(contenido) || /semáforo\s*===?\s*['"]crítico['"]/.test(contenido), 'Debe filtrar semáforo "crítico" o "critico"')
})

test('AlertasAuditoria: cada alerta es clicable y llama a emit("irFicha", id)', () => {
  // @click="() => emit('irFicha', auditoria.id)" - el archivo está en una línea
  assert.ok(/@click\s*=\s*["']\(\)\s*=>\s*emit\(['"]irFicha['"]\s*,\s*auditoria\.id\)["']/.test(contenido), 'Debe tener @click que emite irFicha con el id')
})

test('AlertasAuditoria: usa clases de la paleta (dg-error, dg-aviso) y q-card/q-item', () => {
  assert.ok(/dg-error|dg-aviso|dg-alerta/.test(contenido), 'Debe usar colores de la paleta para alertas')
  assert.ok(/q-card|q-item|q-banner/.test(contenido), 'Debe usar componentes Quasar')
})

test('AlertasAuditoria: si no hay alertas, no renderiza nada (v-if)', () => {
  assert.ok(/v-if\s*=\s*["'][^"']*alertasFiltradas/.test(contenido) || /v-if\s*=\s*["'][^"']*tieneAlertas/.test(contenido), 'Debe ocultarse cuando no hay alertas')
})