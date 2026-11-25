// Rebanada 46 (vuelta 2): las cuatro tarjetas son estados y comparten con el
// selector «Estado» un solo filtro.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const FUENTE = fs.readFileSync(new URL('./DashboardPage.vue', import.meta.url), 'utf8')
const SCRIPT = FUENTE.slice(FUENTE.indexOf('<script setup>'), FUENTE.indexOf('</script>'))
const TARJETAS = SCRIPT.slice(SCRIPT.indexOf('const tarjetas = computed'))

describe('Dashboard — tarjetas por estado y selector «Estado» como un solo filtro', () => {
  test('un solo valor de filtro: filtroEstado; no hay filtroMostrar ni tarjeta guardada', () => {
    assert.match(SCRIPT, /const filtroEstado = ref\('Todos'\)/)
    assert.doesNotMatch(FUENTE, /filtroMostrar|opcionesMostrar|tarjetaActiva/)
  })

  test('el selector vuelve a ser «Estado» con Todos y los cinco estados, sin grupos', () => {
    assert.match(FUENTE, /v-model="filtroEstado"[\S\s]{0,400}label="Estado"/)
    assert.match(FUENTE, /aria-label="Filtrar documentos por estado"/)
    assert.doesNotMatch(FUENTE, /encabezado|q-item-label v-if=[^>]*header/)
    assert.match(
      SCRIPT,
      /\['RECEPCIONADO', 'EN_PROCESO', 'PENDIENTE_CLIENTE', 'COMPLETADO', 'CANCELADO'\]/,
    )
  })

  test('hay cuatro tarjetas, una por estado, con el título de estiloDeEstadoDocumento', () => {
    for (const estado of ['RECEPCIONADO', 'EN_PROCESO', 'PENDIENTE_CLIENTE', 'COMPLETADO']) {
      assert.match(TARJETAS, new RegExp(`estado: '${estado}'`))
    }
    assert.doesNotMatch(TARJETAS, /estado: 'CANCELADO'/)
    assert.match(TARJETAS, /estiloDeEstadoDocumento\(t\.estado\)\.etiqueta/)
    assert.equal((TARJETAS.match(/estado: '/g) ?? []).length, 4)
  })

  test('ya no hay tarjetas de Recibidos (mes), En trámite ni Vencidos', () => {
    assert.doesNotMatch(FUENTE, /clave: 'recibidos'|clave: 'enTramite'|clave: 'vencidos'/)
    assert.doesNotMatch(FUENTE, /resumirDocumentos|coincideConTarjeta|En trámite/)
  })

  test('la cifra de cada tarjeta es la cuenta de su estado entre los documentos cargados', () => {
    assert.match(SCRIPT, /resumen = computed\(\(\) => contarPorEstado\(rows\.value\)\)/)
    assert.match(FUENTE, /resumen\[tarjeta\.estado\]/)
  })

  test('pulsar una tarjeta pone el selector en su estado; la activa regresa a «Todos»', () => {
    assert.match(
      SCRIPT,
      /alternarTarjeta = \(estado\) => \{\s*filtroEstado\.value = filtroEstado\.value === estado \? 'Todos' : estado\s*\}/,
    )
  })

  test('la tarjeta resaltada es la del estado elegido', () => {
    assert.match(FUENTE, /'tarjeta-activa': filtroEstado === tarjeta\.estado/)
    assert.match(FUENTE, /:aria-pressed="filtroEstado === tarjeta\.estado"/)
  })

  test('la tarjeta lleva tooltip y aria-label que dicen qué filtra', () => {
    assert.match(TARJETAS, /ayuda: `Mostrar solo los documentos en estado «\$\{titulo\}»`/)
    assert.match(FUENTE, /<q-tooltip>\{\{ tarjeta\.ayuda \}\}<\/q-tooltip>/)
    assert.match(
      FUENTE,
      /:aria-label="`\$\{tarjeta\.titulo\}: \$\{resumen\[tarjeta\.estado\]\}\. \$\{tarjeta\.ayuda\}`"/,
    )
  })

  test('los pies de Recibido y Completado dicen el mes de recepción', () => {
    assert.match(TARJETAS, /pie: `Recibidos en \$\{mes\} y pendientes anteriores`/)
    assert.match(TARJETAS, /pie: `Recibidos en \$\{mes\} y terminados`/)
  })

  test('sin chip «Solo: …»', () => {
    assert.doesNotMatch(FUENTE, /Solo: \{\{/)
  })

  test('lo vencido sigue marcado en la tabla con esVencido', () => {
    assert.match(SCRIPT, /esVencido = \(row\) => esDocumentoVencido\(row, hoy\.value\)/)
    assert.match(FUENTE, /esVencido\(props\.row\) \? 'text-negative text-weight-bold'/)
  })

  test('la tabla vacía considera el filtro de estado', () => {
    assert.match(SCRIPT, /filtroEstado\.value !== 'Todos'/)
  })

  test('el estilo del borde de la tarjeta de «Recibido» y «En proceso» usa la paleta', () => {
    assert.match(FUENTE, /\.border-left-info \{\s*border-left: 5px solid \$info;/)
  })
})

describe('Dashboard — píldoras de estado legibles (rebanada 48)', () => {
  test('todos los chips de estado usan la clase chip de estiloDeEstadoDocumento', () => {
    const usos = FUENTE.match(/estiloDeEstadoDocumento\([^)]*\)\.chip/g) ?? []
    assert.equal(usos.length, 3, 'tarjeta móvil, tabla y detalle')
    assert.doesNotMatch(FUENTE, /estiloDeEstadoDocumento\([^)]*\)\.texto/)
  })

  test('los puntos de color de los selectores siguen con el fondo del estado', () => {
    const puntos = FUENTE.match(/estiloDeEstadoDocumento\([^)]*\)\.fondo/g) ?? []
    assert.equal(puntos.length, 4)
  })
})
