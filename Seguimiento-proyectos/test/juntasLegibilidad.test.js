// «Mi Calendario», rebanada 32: legibilidad del calendario. Marcas «Privada» y «Solo tú», detalle de
// cada marca, bloque compacto, límite de elementos por día del Mes, iconos de vencimientos y verificación
// estática de los componentes `MarcaJunta` y `BloqueJunta`.

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  detalleDeMarca,
  esBloqueCompacto,
  limitarElementosDelDia,
  marcasDeJunta,
} from '../src/utils/juntas.js'
import { iconoDeVencimiento } from '../src/utils/vencimientosEnCalendario.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (texto) => texto.split('<script')[0]

describe('marcasDeJunta: «Privada» y «Solo tú»', () => {
  const conInvitado = [{ id: 8, respuesta: 'aceptada' }]

  it('una junta privada lleva «Privada»', () => {
    const junta = { estado: 'confirmada', privada: true, participantes: conInvitado }
    assert.deepEqual(marcasDeJunta(junta, 3), ['Privada'])
  })

  it('una junta sin invitados lleva «Solo tú»', () => {
    assert.deepEqual(marcasDeJunta({ estado: 'confirmada', participantes: [] }, 3), ['Solo tú'])
    assert.deepEqual(marcasDeJunta({ estado: 'confirmada' }, 3), ['Solo tú'])
  })

  it('las marcas van en orden: estado, respuesta, «Privada» y «Solo tú»', () => {
    const junta = { estado: 'cancelada', privada: true, participantes: [] }
    assert.deepEqual(marcasDeJunta(junta, 3), ['Cancelada', 'Privada', 'Solo tú'])
    const conRespuesta = {
      estado: 'por_confirmar',
      privada: true,
      participantes: [{ id: 3, respuesta: 'pendiente' }],
    }
    assert.deepEqual(marcasDeJunta(conRespuesta, 3), ['Por confirmar', 'Responder', 'Privada'])
  })

  it('un bloque «Ocupado» no lleva «Privada» aunque sea privado', () => {
    assert.deepEqual(marcasDeJunta({ ocupado: true, privada: true, participantes: [] }, 3), [])
  })

  it('una junta pública con invitados no lleva marcas', () => {
    const junta = { estado: 'confirmada', privada: false, participantes: conInvitado }
    assert.deepEqual(marcasDeJunta(junta, 3), [])
  })
})

describe('detalleDeMarca: icono y tono de cada marca', () => {
  it('«Responder» y sus variantes llevan el icono reply en acento', () => {
    for (const texto of ['Responder', 'Responder por Ana Pérez', 'Tu respuesta pendiente']) {
      assert.deepEqual(detalleDeMarca(texto), { icono: 'reply', tono: 'acento' }, texto)
    }
  })

  it('«Por confirmar» lleva schedule en aviso', () => {
    assert.deepEqual(detalleDeMarca('Por confirmar'), { icono: 'schedule', tono: 'aviso' })
  })

  it('«Cancelada», «Privada» y «Solo tú» van en neutro con su icono', () => {
    assert.deepEqual(detalleDeMarca('Cancelada'), { icono: 'event_busy', tono: 'neutro' })
    assert.deepEqual(detalleDeMarca('Privada'), { icono: 'lock', tono: 'neutro' })
    assert.deepEqual(detalleDeMarca('Solo tú'), { icono: 'person', tono: 'neutro' })
  })

  it('una marca desconocida se pinta neutra y sin icono', () => {
    assert.deepEqual(detalleDeMarca('Otra cosa'), { icono: '', tono: 'neutro' })
  })
})

describe('esBloqueCompacto: 45 px de alto o 120 px de ancho', () => {
  it('es compacto con 45 px de alto o menos', () => {
    assert.equal(esBloqueCompacto(30), true)
    assert.equal(esBloqueCompacto(45), true)
    assert.equal(esBloqueCompacto(46), false)
  })

  it('es compacto con 120 px de ancho o menos', () => {
    assert.equal(esBloqueCompacto(90, 120), true)
    assert.equal(esBloqueCompacto(90, 121), false)
  })

  it('sin ancho conocido solo cuenta el alto', () => {
    assert.equal(esBloqueCompacto(90), false)
    assert.equal(esBloqueCompacto(90, undefined), false)
  })
})

describe('limitarElementosDelDia: máximo 3 por día en el Mes', () => {
  it('con 3 o menos muestra todos y no oculta ninguno', () => {
    assert.deepEqual(limitarElementosDelDia(['a', 'b', 'c']), {
      visibles: ['a', 'b', 'c'],
      ocultos: 0,
    })
    assert.deepEqual(limitarElementosDelDia([]), { visibles: [], ocultos: 0 })
  })

  it('con 5 muestra los 3 primeros y cuenta 2 ocultos', () => {
    assert.deepEqual(limitarElementosDelDia(['a', 'b', 'c', 'd', 'e']), {
      visibles: ['a', 'b', 'c'],
      ocultos: 2,
    })
  })
})

describe('iconoDeVencimiento: flag para casos y fact_check para auditorías', () => {
  it('un caso lleva flag y una auditoría fact_check', () => {
    assert.equal(iconoDeVencimiento({ tipo: 'caso', prioridad: 'alta' }), 'flag')
    assert.equal(iconoDeVencimiento({ tipo: 'auditoria' }), 'fact_check')
  })
})

describe('componentes nuevos MarcaJunta y BloqueJunta', () => {
  it('existen', () => {
    assert.ok(existsSync(new URL('../src/components/MarcaJunta.vue', import.meta.url)))
    assert.ok(existsSync(new URL('../src/components/BloqueJunta.vue', import.meta.url)))
  })

  const marca = leer('../src/components/MarcaJunta.vue')
  const bloque = leer('../src/components/BloqueJunta.vue')
  const calendario = leer('../src/components/CalendarioJuntas.vue')
  const pagina = leer('../src/pages/JuntasPage.vue')

  it('MarcaJunta es una píldora con icono y, en modo solo-icono, conserva el texto en el aria-label', () => {
    assert.match(marca, /soloIcono/)
    assert.match(marca, /detalleDeMarca\(/)
    assert.match(marca, /aria-label/)
    assert.match(marca, /<q-icon/)
    assert.match(marca, /var\(--dg-acento\)/)
    assert.match(marca, /var\(--dg-superficie\)/)
  })

  it('BloqueJunta usa MarcaJunta, la nota de recorte y el modo compacto', () => {
    assert.match(bloque, /import MarcaJunta/)
    assert.match(bloque, /<MarcaJunta/)
    assert.match(bloque, /esBloqueCompacto\(/)
    assert.match(bloque, /junta-bloque__nota/)
    assert.match(bloque, /@container/)
    assert.match(bloque, /data-junta-id/)
    assert.match(bloque, /junta--resaltada/)
    assert.match(bloque, /No estás invitado a esta junta/)
  })

  it('el calendario usa BloqueJunta en lugar del marcado repetido y conserva claveDeJunta', () => {
    assert.match(calendario, /import BloqueJunta/)
    assert.match(calendario, /<BloqueJunta/)
    assert.match(calendario, /claveDeJunta\(/)
    assert.doesNotMatch(plantillaDe(calendario), /junta-bloque__titulo|junta-etiqueta__hora/)
  })

  it('cancelada es neutra, por confirmar va rayado y ocupado lleva rayado neutro con candado', () => {
    assert.match(bloque, /junta-bloque--cancelada[\s\S]{0,300}var\(--dg-neutro-fondo\)/)
    assert.match(bloque, /var\(--dg-neutro-borde\)/)
    assert.match(bloque, /var\(--dg-texto-tenue\)/)
    assert.match(bloque, /repeating-linear-gradient\(\s*135deg/)
    assert.match(bloque, /var\(--dg-aviso-fondo\)/)
    assert.match(bloque, /name="lock"/)
    assert.doesNotMatch(bloque, /var\(--dg-error/)
    assert.doesNotMatch(bloque, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
    assert.doesNotMatch(marca, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })

  it('el foco es un solo anillo --dg-foco de 2 px con desplazamiento de 2 px y el bloque enfocado sube', () => {
    assert.match(bloque, /:focus-visible/)
    assert.match(bloque, /outline:\s*2px solid var\(--dg-foco\)/)
    assert.match(bloque, /outline-offset:\s*2px/)
    assert.match(bloque, /:focus-visible[\s\S]{0,200}z-index/)
    assert.match(
      calendario,
      /vencimiento-etiqueta:focus-visible[\s\S]{0,200}outline:\s*2px solid var\(--dg-foco\)/,
    )
  })

  it('el Mes limita a 3 elementos por día con «+N más» que abre el día', () => {
    assert.match(calendario, /limitarElementosDelDia\(/)
    assert.match(calendario, /más/)
    assert.match(calendario, /flat/)
    assert.match(calendario, /vista: 'dia'/)
  })

  it('los vencimientos llevan icono, título en 2 líneas y la prioridad en su píldora', () => {
    assert.match(calendario, /iconoDeVencimiento\(/)
    assert.match(calendario, /-webkit-line-clamp:\s*2/)
    assert.match(calendario, /vencimiento-etiqueta__prioridad/)
    assert.doesNotMatch(calendario, /border-left-width:\s*4px/)
  })

  it('el bloque público de otra agenda pone «organiza {nombre}» en su propia línea', () => {
    assert.match(bloque, /junta-bloque__organiza/)
  })

  it('ni el calendario ni los componentes nuevos llevan tooltips', () => {
    assert.doesNotMatch(plantillaDe(calendario), /q-tooltip/)
    assert.doesNotMatch(plantillaDe(bloque), /q-tooltip/)
    assert.doesNotMatch(plantillaDe(marca), /q-tooltip/)
  })

  it('los tooltips de la cabecera tienen max-width de 320px y los de Anterior, Hoy y Siguiente un retraso de 500 ms', () => {
    // Desde la rebanada 33 la navegación vive en BarraPeriodo; la pantalla conserva el resto de la cabecera.
    const barra = leer('../src/components/BarraPeriodo.vue')
    const tooltips = [...plantillaDe(pagina + barra).matchAll(/<q-tooltip[^>]*>/g)].map(([t]) => t)
    assert.ok(tooltips.length >= 7)
    for (const tooltip of tooltips) assert.match(tooltip, /max-width="320px"/, tooltip)
    for (const texto of [
      'Va al periodo anterior.',
      'Vuelve al día de hoy.',
      'Va al periodo siguiente.',
    ]) {
      const posicion = barra.indexOf(texto)
      const apertura = barra.lastIndexOf('<q-tooltip', posicion)
      assert.match(barra.slice(apertura, posicion), /:delay="500"/, texto)
    }
  })
})
