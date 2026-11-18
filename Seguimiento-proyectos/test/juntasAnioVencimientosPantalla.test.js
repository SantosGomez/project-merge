// Vista de año y vencimientos de casos en «Juntas» (rebanada 25): verificación estática de la
// pantalla y de los componentes, como las demás pruebas de pantallas.

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8')

const pagina = leer('../src/pages/JuntasPage.vue')
const calendario = leer('../src/components/CalendarioJuntas.vue')

describe('vista Año', () => {
  it('el selector es Año | Mes | Semana | Día', () => {
    const opciones = pagina.slice(
      pagina.indexOf('const OPCIONES_DE_VISTA'),
      pagina.indexOf(']', pagina.indexOf('const OPCIONES_DE_VISTA')),
    )
    const etiquetas = [...opciones.matchAll(/label: '([^']+)'/g)].map(([, etiqueta]) => etiqueta)
    assert.deepEqual(etiquetas, ['Año', 'Mes', 'Semana', 'Día'])
    assert.match(opciones, /value: 'anio'/)
  })

  it('existe AnioJuntas.vue y la pantalla lo muestra solo en la vista de año', () => {
    assert.ok(existsSync(ruta('../src/components/AnioJuntas.vue')))
    assert.match(pagina, /import AnioJuntas from '\.\.\/components\/AnioJuntas\.vue'/)
    assert.match(pagina, /<AnioJuntas[\s\S]{0,300}@elegir-dia=/)
  })

  it('al elegir un día pasa a la vista Día de esa fecha', () => {
    assert.match(pagina, /irA\('dia', dia\)/)
  })

  it('los días con juntas llevan su cantidad y un nombre accesible, y los meses van de lunes a domingo', () => {
    const anio = leer('../src/components/AnioJuntas.vue')
    assert.match(anio, /textoDiaConJuntas/)
    assert.match(anio, /juntasPorDia/)
    assert.match(anio, /mesesDelAnio/)
    assert.match(anio, /<q-btn/)
    assert.match(anio, /:aria-label=/)
    assert.match(anio, /emit\('elegir-dia'/)
  })

  it('hasta 600 px se ven 1 o 2 meses por fila, sin scroll horizontal', () => {
    const anio = leer('../src/components/AnioJuntas.vue')
    assert.match(anio, /@media \(max-width: 600px\)/)
    assert.match(anio, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
    assert.doesNotMatch(anio, /overflow-x:\s*(auto|scroll)/)
  })

  it('no escribe colores sueltos ni lee fechas con new Date(texto)', () => {
    for (const archivo of [
      '../src/components/AnioJuntas.vue',
      '../src/utils/vencimientosEnCalendario.js',
    ]) {
      assert.doesNotMatch(leer(archivo), /#[0-9a-fA-F]{3,8}\b|rgba?\(/, archivo)
      assert.doesNotMatch(leer(archivo), /new Date\(\s*['"`]/, archivo)
    }
  })
})

describe('vencimientos de casos', () => {
  it('la pantalla trae los casos del contador y auxiliar con getMisCasos y los del administrador con getCasosImportantesCalendario', () => {
    assert.match(pagina, /getMisCasos/)
    assert.match(pagina, /getCasosImportantesCalendario/)
    assert.match(pagina, /vencimientosDeCasos\(/)
  })

  it('el interruptor «Mostrar vencimientos de casos» solo lo ven quienes pueden y no en la agenda de otra persona', () => {
    assert.match(pagina, /Mostrar vencimientos de casos/)
    assert.match(pagina, /<q-toggle/)
    assert.match(pagina, /puedeVerVencimientos\(/)
    assert.match(pagina, /leerMostrarVencimientos\(/)
    assert.match(pagina, /guardarMostrarVencimientos\(/)
    assert.match(pagina, /!agendaId\.value/)
  })

  it('si falla la carga avisa «No se pudieron cargar los vencimientos» con «Reintentar» y el calendario sigue', () => {
    assert.match(pagina, /No se pudieron cargar los vencimientos\./)
    assert.match(pagina, /Reintentar/)
    const aviso = pagina.indexOf('No se pudieron cargar los vencimientos.')
    const calendarioEnPagina = pagina.indexOf('<CalendarioJuntas')
    assert.ok(aviso >= 0 && calendarioEnPagina >= 0)
    assert.doesNotMatch(
      pagina.slice(
        pagina.indexOf('<ErrorState'),
        pagina.indexOf('</template>', calendarioEnPagina),
      ),
      /errorVencimientos/,
      'el error de vencimientos no sustituye al calendario',
    )
  })

  it('el clic lleva al destino del rol con router.push', () => {
    assert.match(pagina, /destinoDeVencimiento\(/)
    assert.match(pagina, /router\.push\(/)
  })

  it('el calendario pinta los vencimientos en Mes, Semana y Día con «Vence:», prioridad e «Importante»', () => {
    assert.match(calendario, /vencimientos/)
    assert.match(calendario, /vencimientosDelDia\(/)
    assert.match(calendario, /textoDeVencimiento\(/)
    assert.match(calendario, /marcasDeVencimiento\(/)
    assert.match(calendario, /#head-day-event/)
    assert.match(calendario, /emit\('abrir-vencimiento'/)
    assert.match(calendario, /vencimiento-etiqueta--\$\{/)
  })

  it('los colores del vencimiento salen de la paleta de prioridades', () => {
    assert.match(calendario, /var\(--dg-prioridad-alta-fondo\)/)
    assert.match(calendario, /var\(--dg-prioridad-media-fondo\)/)
    assert.match(calendario, /var\(--dg-prioridad-baja-fondo\)/)
    assert.doesNotMatch(calendario, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })
})
