// Alertas de auditorías de «Mi resumen»: las vencidas y críticas del contador, las más urgentes primero.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { alertasAuditoria } from '../src/utils/listaAuditorias.js'

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')

const auditoria = (id, semaforo, diasParaVencer) => ({
  id,
  cliente: `Cliente ${id}`,
  semaforo,
  diasParaVencer,
})

test('alertasAuditoria deja solo las vencidas y críticas, las más urgentes primero', () => {
  const lista = [
    auditoria(1, 'Crítico', 6),
    auditoria(2, 'En tiempo', 90),
    auditoria(3, 'Vencido', -1),
    auditoria(4, 'Atención', 15),
    auditoria(5, 'Crítico', 2),
    auditoria(6, 'Concluida', null),
    auditoria(7, 'Vencido', -10),
  ]

  assert.deepEqual(
    alertasAuditoria(lista).map((a) => a.id),
    [7, 3, 5, 1],
  )
})

test('alertasAuditoria sin auditorías urgentes (o sin lista) entrega una lista vacía', () => {
  assert.deepEqual(alertasAuditoria([auditoria(1, 'En tiempo', 30)]), [])
  assert.deepEqual(alertasAuditoria(undefined), [])
})

test('AlertasAuditoria.vue usa la lista calculada, los campos reales y los colores del semáforo', () => {
  const componente = leer('../src/components/AlertasAuditoria.vue')
  const tablero = leer('../src/components/TableroAuditorias.vue')

  assert.ok(
    componente.split('\n').length > 20,
    'el componente tiene formato normal, no una sola línea',
  )
  assert.match(componente, /alertasAuditoria\(props\.auditorias\)/)
  assert.match(
    componente,
    /from '\.\.\/utils\/semaforoAuditoria\.js'/,
    'usa las utilidades reales del semáforo',
  )
  assert.match(componente, /alerta\.noExpediente/)
  assert.match(componente, /textoDiasPlazo\(alerta\.diasParaVencer\)/)
  assert.match(
    componente,
    /semaforo-etiqueta/,
    'la etiqueta usa los colores del semáforo de app.scss',
  )
  assert.match(componente, /emit\('irFicha', alerta\.id\)/)
  assert.match(componente, /v-if="alertas\.length > 0"/, 'sin alertas no se muestra nada')
  assert.doesNotMatch(componente, /#[0-9a-f]{3,6}\b/i, 'sin colores sueltos')

  assert.match(
    tablero,
    /<AlertasAuditoria\s+v-if="propias"[\s\S]*?:auditorias="auditorias"[\s\S]*?@ir-ficha="verFicha"/,
  )
})
