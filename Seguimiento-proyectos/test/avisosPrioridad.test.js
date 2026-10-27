// Pruebas estáticas: el administrador cambia la prioridad desde el detalle del contador
// y el contador ve los avisos en una campanita (rebanada 2).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => (existsSync(ruta(relativa)) ? readFileSync(ruta(relativa), 'utf8') : '')
const plantillaDe = (texto) => texto.split('<script')[0]

describe('El administrador cambia la prioridad desde el detalle del contador', () => {
  const casoItem = leer('../src/components/CasoItem.vue')
  const detalle = leer('../src/components/DetalleContador.vue')
  const dashboard = leer('../src/pages/AdminDashboardPage.vue')

  it('CasoItem muestra un selector de prioridad solo con puedeCambiarPrioridad', () => {
    const plantilla = plantillaDe(casoItem)
    assert.match(casoItem, /puedeCambiarPrioridad: \{\s*type: Boolean,\s*default: false/)
    assert.match(plantilla, /<q-select[^>]*v-if="puedeCambiarPrioridad"[^>]*:model-value="caso\.priority"/)
    assert.match(plantilla, /:aria-label="`Cambiar la prioridad del caso de \$\{caso\.client\}`"/)
    assert.match(plantilla, /@update:model-value="\(prioridad\) => emit\('cambiar-prioridad', prioridad\)"/)
    assert.match(casoItem, /defineEmits\(\[[^\]]*'cambiar-prioridad'/)
  })

  it('DetalleContador lo activa y pasa el aviso hacia la página', () => {
    assert.match(detalle, /<CasoItem[^>]*solo-lectura[^>]*puede-cambiar-prioridad/)
    assert.match(detalle, /@cambiar-prioridad="\(prioridad\) => emit\('cambiar-prioridad', caso, prioridad\)"/)
    assert.doesNotMatch(detalle, /no permite cambiar\s+el estado ni la prioridad/, 'el texto de ayuda ya no dice que es solo consulta')
    assert.match(detalle, /Puedes cambiar la prioridad/)
  })

  it('el dashboard pide confirmación, guarda, avisa y actualiza el detalle y el resumen', () => {
    assert.equal((plantillaDe(dashboard).match(/@cambiar-prioridad="cambiarPrioridad"/g) ?? []).length, 2, 'escritorio y celular')
    assert.match(dashboard, /\$q\s*\.dialog\(\{[\s\S]*?Cambiar prioridad[\s\S]*?\}\)\s*\.onOk\(/)
    assert.match(dashboard, /se recalculará la fecha de vencimiento/)
    assert.match(dashboard, /cambiarPrioridadComoAdmin\(caso\.id, prioridad\)/)
    assert.match(dashboard, /contadoresStore\.reemplazarCasoDetalle\(/)
    assert.match(dashboard, /cargarResumen\(\)/)
    assert.match(dashboard, /type: 'positive'[\s\S]*?Ahora vence el/)
    assert.match(dashboard, /type: 'negative'/)
  })
})

describe('Campanita de avisos del contador', () => {
  const campana = leer('../src/components/CampanaAvisos.vue')
  const layout = leer('../src/layouts/MaquetaLayout.vue')

  it('existe y muestra cuántos avisos faltan por leer', () => {
    const plantilla = plantillaDe(campana)
    assert.ok(campana, 'existe components/CampanaAvisos.vue')
    assert.match(plantilla, /icon="notifications"/)
    assert.match(plantilla, /<q-badge[^>]*v-if="noLeidas > 0"/)
    assert.match(plantilla, /:aria-label="noLeidas > 0 \? `Avisos: \$\{noLeidas\} sin leer` : 'Avisos'"/)
  })

  it('la lista se abre en un q-menu y al abrirla se marcan como leídos', () => {
    const plantilla = plantillaDe(campana)
    assert.match(plantilla, /<q-menu[^>]*@show="alAbrir"/)
    assert.match(plantilla, /No tienes avisos\./)
    assert.match(campana, /marcarLeidas\(\)/)
  })

  it('se actualiza cada minuto y deja de hacerlo al salir', () => {
    assert.match(campana, /setInterval\(cargar, 60 \* 1000\)/)
    assert.match(campana, /onBeforeUnmount\(\(\) => clearInterval\(/)
  })

  it('el layout la muestra solo al contador, en el encabezado del celular y en el de escritorio', () => {
    assert.match(layout, /import CampanaAvisos from '\.\.\/components\/CampanaAvisos\.vue'/)
    assert.equal((plantillaDe(layout).match(/<CampanaAvisos v-if="session\.esContador"/g) ?? []).length, 2)
  })
})
