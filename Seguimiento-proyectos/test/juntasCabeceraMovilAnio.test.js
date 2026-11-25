// «Mi Calendario»: cabecera, móvil y vista Año (rebanada 33). Las reglas puras se prueban con sus entradas
// y salidas; la pantalla y los componentes, con verificación estática de los archivos, como las demás
// pruebas de pantallas.

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  accionesDeAtendidos,
  diaInicialDelAnio,
  intensidadDeJuntas,
  marcasDeDiasConJuntas,
  moverDiaEnAnio,
  textoGuiaCalendario,
} from '../src/utils/juntas.js'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8')
const plantillaDe = (texto) => texto.split('<script')[0]
const estilosDe = (texto) => texto.slice(texto.indexOf('<style'))

describe('textoGuiaCalendario', () => {
  it('en tu agenda, Semana y Día invitan a pulsar un hueco libre', () => {
    assert.equal(textoGuiaCalendario('semana', null), 'Pulsa un hueco libre para crear una junta')
    assert.equal(textoGuiaCalendario('dia', null), 'Pulsa un hueco libre para crear una junta')
  })

  it('en tu agenda, Mes y Año invitan a pulsar un día', () => {
    assert.equal(textoGuiaCalendario('mes', null), 'Pulsa un día para verlo')
    assert.equal(textoGuiaCalendario('anio', null), 'Pulsa un día para verlo')
  })

  it('en la agenda de otra persona dice de quién es, en cualquier vista', () => {
    for (const vista of ['anio', 'mes', 'semana', 'dia']) {
      assert.equal(
        textoGuiaCalendario(vista, 'Ana Pérez'),
        'Estás viendo la agenda de Ana Pérez',
        vista,
      )
    }
  })
})

describe('accionesDeAtendidos', () => {
  const ana = { id: 7, nombre: 'Ana' }
  const beto = { id: 9, nombre: 'Beto' }

  it('con un solo administrador y otra agenda, ofrece «Ver su agenda»', () => {
    assert.deepEqual(accionesDeAtendidos([ana], null), [
      { id: '7', texto: 'Ver su agenda', ayuda: 'Abre la agenda de Ana para administrarla.' },
    ])
  })

  it('con varios administradores ofrece una acción por cada uno', () => {
    assert.deepEqual(
      accionesDeAtendidos([ana, beto], null).map((accion) => [accion.id, accion.texto]),
      [
        ['7', 'Ver agenda de Ana'],
        ['9', 'Ver agenda de Beto'],
      ],
    )
  })

  it('si ya ves la agenda de uno de ellos, la acción es «Volver a mi agenda»', () => {
    assert.deepEqual(accionesDeAtendidos([ana], '7'), [
      { id: null, texto: 'Volver a mi agenda', ayuda: 'Vuelve a tu propia agenda.' },
    ])
    assert.deepEqual(
      accionesDeAtendidos([ana, beto], '9').map((accion) => accion.texto),
      ['Volver a mi agenda'],
    )
  })

  it('si ves la agenda de alguien que no atiendes, sigue ofreciendo ver las suyas', () => {
    assert.equal(accionesDeAtendidos([ana], '99')[0].texto, 'Ver su agenda')
  })

  it('sin administradores atendidos no hay acciones', () => {
    assert.deepEqual(accionesDeAtendidos([], null), [])
    assert.deepEqual(accionesDeAtendidos(undefined, null), [])
  })
})

describe('moverDiaEnAnio (flechas de la vista Año)', () => {
  it('← y → mueven un día, también entre meses', () => {
    assert.equal(moverDiaEnAnio('2026-11-18', 'ArrowRight'), '2026-11-19')
    assert.equal(moverDiaEnAnio('2026-11-18', 'ArrowLeft'), '2026-11-17')
    assert.equal(moverDiaEnAnio('2026-11-30', 'ArrowRight'), '2026-12-01')
    assert.equal(moverDiaEnAnio('2026-03-01', 'ArrowLeft'), '2026-02-28')
  })

  it('↑ y ↓ mueven una semana', () => {
    assert.equal(moverDiaEnAnio('2026-11-18', 'ArrowDown'), '2026-11-25')
    assert.equal(moverDiaEnAnio('2026-11-18', 'ArrowUp'), '2026-11-11')
    assert.equal(moverDiaEnAnio('2026-11-28', 'ArrowDown'), '2026-12-05')
  })

  it('Inicio y Fin van al primer y al último día del mes', () => {
    assert.equal(moverDiaEnAnio('2026-11-18', 'Home'), '2026-11-01')
    assert.equal(moverDiaEnAnio('2026-11-18', 'End'), '2026-11-30')
    assert.equal(moverDiaEnAnio('2028-02-10', 'End'), '2028-02-29')
  })

  it('no sale del año: en los extremos se queda donde está', () => {
    assert.equal(moverDiaEnAnio('2026-01-01', 'ArrowLeft'), '2026-01-01')
    assert.equal(moverDiaEnAnio('2026-01-03', 'ArrowUp'), '2026-01-03')
    assert.equal(moverDiaEnAnio('2026-12-31', 'ArrowRight'), '2026-12-31')
    assert.equal(moverDiaEnAnio('2026-12-30', 'ArrowDown'), '2026-12-30')
  })

  it('cualquier otra tecla no mueve nada', () => {
    assert.equal(moverDiaEnAnio('2026-11-18', 'a'), null)
    assert.equal(moverDiaEnAnio('2026-11-18', 'Enter'), null)
  })
})

describe('diaInicialDelAnio (el único día con tabindex 0)', () => {
  it('es la fecha elegida si cae en ese año', () => {
    assert.equal(diaInicialDelAnio(2026, '2026-11-18', '2026-05-02'), '2026-11-18')
  })

  it('si no, es hoy cuando cae en ese año', () => {
    assert.equal(diaInicialDelAnio(2026, '2027-01-04', '2026-05-02'), '2026-05-02')
    assert.equal(diaInicialDelAnio(2026, '', '2026-05-02'), '2026-05-02')
  })

  it('si tampoco, es el 1 de enero', () => {
    assert.equal(diaInicialDelAnio(2030, '2026-11-18', '2026-05-02'), '2030-01-01')
  })
})

describe('intensidadDeJuntas', () => {
  it('0 es sin juntas; 1, 2–3 y 4 o más son tres niveles', () => {
    assert.equal(intensidadDeJuntas(0), 0)
    assert.equal(intensidadDeJuntas(undefined), 0)
    assert.equal(intensidadDeJuntas(1), 1)
    assert.equal(intensidadDeJuntas(2), 2)
    assert.equal(intensidadDeJuntas(3), 2)
    assert.equal(intensidadDeJuntas(4), 3)
    assert.equal(intensidadDeJuntas(12), 3)
  })
})

describe('marcasDeDiasConJuntas (tira de la semana en celular)', () => {
  const juntas = [
    { id: 1, inicio: '2026-11-18 09:00:00', fin: '2026-11-18 10:00:00' },
    { id: 2, inicio: '2026-11-20 22:00:00', fin: '2026-11-21 01:30:00' },
  ]

  it('marca como «junta» solo los días que tocan juntas, también las que cruzan la medianoche', () => {
    assert.deepEqual(
      marcasDeDiasConJuntas(juntas, ['2026-11-17', '2026-11-18', '2026-11-20', '2026-11-21']),
      { '2026-11-18': 'junta', '2026-11-20': 'junta', '2026-11-21': 'junta' },
    )
  })

  it('sin juntas no marca nada', () => {
    assert.deepEqual(marcasDeDiasConJuntas([], ['2026-11-18']), {})
  })
})

describe('BarraPeriodo.vue', () => {
  const barra = leer('../src/components/BarraPeriodo.vue')
  const plantilla = plantillaDe(barra)
  const estilos = estilosDe(barra)

  it('existe y la pantalla la usa en lugar de la cabecera suelta', () => {
    assert.ok(existsSync(ruta('../src/components/BarraPeriodo.vue')))
    const pagina = leer('../src/pages/JuntasPage.vue')
    assert.match(pagina, /import BarraPeriodo from '\.\.\/components\/BarraPeriodo\.vue'/)
    assert.match(plantillaDe(pagina), /<BarraPeriodo/)
    assert.doesNotMatch(plantillaDe(pagina), /juntas-page__periodo|juntas-page__barra/)
  })

  it('el periodo va en un h2 grande (1.5 rem, peso 700) con aria-live="polite"', () => {
    assert.match(plantilla, /<h2[^>]*aria-live="polite"/)
    assert.match(estilos, /font-size:\s*1\.5rem/)
    assert.match(estilos, /font-weight:\s*700/)
  })

  it('la navegación es ‹ Hoy › con botones de 44 px y tooltips con retraso de 500 ms en las flechas', () => {
    assert.match(plantilla, /icon="chevron_left"/)
    assert.match(plantilla, /label="Hoy"/)
    assert.match(plantilla, /icon="chevron_right"/)
    assert.ok((plantilla.match(/class="[^"]*control-touch/g) ?? []).length >= 3)
    // «Hoy» lleva su texto visible, así que no necesita tooltip.
    for (const texto of ['Va al periodo anterior.', 'Va al periodo siguiente.']) {
      const posicion = plantilla.indexOf(texto)
      assert.ok(posicion >= 0, texto)
      const apertura = plantilla.lastIndexOf('<q-tooltip', posicion)
      assert.match(plantilla.slice(apertura, posicion), /:delay="500"/, texto)
      assert.match(plantilla.slice(apertura, posicion), /max-width="320px"/, texto)
    }
  })

  it('tiene el selector de vista y los espacios para las acciones y las opciones', () => {
    assert.match(plantilla, /<q-btn-toggle/)
    assert.match(plantilla, /<slot name="acciones"/)
    assert.match(plantilla, /<slot name="opciones"/)
  })

  it('en menos de 600 px oculta la guía y pliega las opciones en «Opciones de la vista»', () => {
    assert.match(plantilla, /<q-expansion-item[\s\S]{0,200}label="Opciones de la vista"/)
    assert.match(barra, /\$q\.screen\.lt\.sm|screen\.lt\.sm/)
    assert.match(plantilla, /v-if="guia && !compacto"/)
  })

  it('no lleva tooltips dentro del calendario ni colores sueltos', () => {
    assert.doesNotMatch(barra, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })
})

describe('pantalla «Mi Calendario»', () => {
  const pagina = leer('../src/pages/JuntasPage.vue')
  const plantilla = plantillaDe(pagina)

  it('el texto de guía sale de textoGuiaCalendario, no de un párrafo fijo', () => {
    assert.match(pagina, /textoGuiaCalendario\(/)
    assert.doesNotMatch(plantilla, /Consulta tus juntas por año, mes, semana o día/)
    assert.match(plantilla, /:guia="textoGuia"/)
  })

  it('el h2 «Agenda de …» ya no está duplicado', () => {
    assert.doesNotMatch(plantilla, /juntas-page__agenda-titulo/)
  })

  it('en menos de 600 px «Nueva junta» es un botón flotante con aria-label', () => {
    assert.match(plantilla, /<q-page-sticky[^>]*v-if="\$q\.screen\.lt\.sm"/)
    assert.match(plantilla, /<q-btn[^>]*\bfab\b[^>]*aria-label="Nueva junta"/)
    assert.match(plantilla, /<template v-else #acciones>|#acciones/)
  })

  it('las opciones de «Ver agenda de» llevan el nombre y debajo el rol, y lo seleccionado solo el nombre', () => {
    assert.match(plantilla, /#option="\{ itemProps, opt \}"/)
    assert.match(plantilla, /#selected-item="\{ opt \}"/)
    assert.match(pagina, /Tú la administras/)
    assert.doesNotMatch(pagina, /\(lo administras\)/)
    assert.doesNotMatch(pagina, /\$\{p\.nombre\} \(\$\{formatearRol\(p\.rol\)\}\)/)
  })

  it('«Ver agenda de» esconde su tooltip mientras la lista está abierta (en celular tapaba las opciones)', () => {
    assert.match(plantilla, /@popup-show="selectorAbierto = true"/)
    assert.match(plantilla, /@popup-hide="selectorAbierto = false"/)
    assert.match(plantilla, /<q-tooltip v-if="!selectorAbierto"[^>]*>[\s\S]*?Elige a otra persona/)
  })

  it('la franja de la recepcionista es un q-banner dense de una línea con acciones en línea', () => {
    assert.match(
      plantilla,
      /<q-banner[^>]*v-if="session\.esRecepcionista"[^>]*inline-actions[^>]*class="juntas-page__atiende"/,
    )
    assert.match(pagina, /accionesDeAtendidos\(atendidos\.value, agendaId\.value\)/)
    assert.match(plantilla, /v-for="accion in accionesDeRecepcion"/)
  })

  it('pasa la fecha a la vista Año y atiende el día elegido de la tira de semana y del mes compacto', () => {
    assert.match(plantilla, /<AnioJuntas[^>]*:fecha="fecha"/)
    assert.match(plantilla, /@elegir-dia="fijarDia"/)
  })
})

describe('CalendarioJuntas.vue en celular', () => {
  const calendario = leer('../src/components/CalendarioJuntas.vue')
  const plantilla = plantillaDe(calendario)

  it('Semana reutiliza la tira de SemanaCalendario, sin su cabecera «Ver mes»', () => {
    assert.match(calendario, /import SemanaCalendario from '\.\/SemanaCalendario\.vue'/)
    assert.match(plantilla, /<SemanaCalendario[\s\S]{0,300}:con-cabecera="false"/)
  })

  it('Mes compacto es una cuadrícula con el número de juntas por día y debajo la agenda del día elegido', () => {
    assert.match(plantilla, /calendario-juntas__mes-compacto/)
    assert.match(calendario, /juntasPorDia/)
    assert.match(calendario, /emit\('elegir-dia'/)
  })

  it('sigue sin tooltips ni scroll horizontal obligatorio en celular', () => {
    assert.doesNotMatch(plantilla, /q-tooltip/)
    assert.match(calendario, /screen\.lt\.sm/)
  })
})

describe('SemanaCalendario.vue', () => {
  const semana = leer('../src/components/SemanaCalendario.vue')

  it('la cabecera «Ver mes» es opcional y por defecto se muestra, como en el dashboard', () => {
    assert.match(semana, /conCabecera:\s*\{\s*type:\s*Boolean,\s*default:\s*true\s*\}/)
    assert.match(plantillaDe(semana), /v-if="conCabecera"[^>]*class="semana__cabecera"/)
    assert.match(plantillaDe(semana), /Ver mes/)
  })

  it('tiene la marca «junta» con texto y color de la paleta', () => {
    assert.match(semana, /junta:\s*'con juntas'/)
    assert.match(estilosDe(semana), /semana__marca--junta\s*\{[^}]*var\(--dg-acento\)/)
  })
})

describe('AnioJuntas.vue (teclado, tamaño y peso visual)', () => {
  const anio = leer('../src/components/AnioJuntas.vue')
  const plantilla = plantillaDe(anio)
  const estilos = estilosDe(anio)

  it('foco itinerante: solo un día con tabindex 0 y flechas que mueven el foco', () => {
    assert.match(plantilla, /:tabindex="dia === diaConFoco \? 0 : -1"/)
    assert.match(plantilla, /@keydown="alTeclear"/)
    assert.match(anio, /moverDiaEnAnio\(/)
    assert.match(anio, /diaInicialDelAnio\(/)
    assert.match(anio, /event\.preventDefault\(\)|evento\.preventDefault\(\)/)
  })

  it('al abrir lleva el mes de la fecha elegida a la vista, sin animación', () => {
    assert.match(anio, /scrollIntoView\(/)
    assert.doesNotMatch(anio, /behavior:\s*'smooth'/)
  })

  it('los días miden al menos 44 px también en escritorio', () => {
    const base = estilos.slice(
      estilos.indexOf('.anio-dia {'),
      estilos.indexOf('}', estilos.indexOf('.anio-dia {')),
    )
    assert.match(base, /min-height:\s*44px/)
  })

  it('los días sin juntas van tenues y en peso 400; con juntas llevan tinte por intensidad', () => {
    assert.match(estilos, /\.anio-dia\s*\{[^}]*font-weight:\s*400/)
    assert.match(estilos, /\.anio-dia\s*\{[^}]*color:\s*var\(--dg-texto-tenue\)/)
    for (const nivel of [1, 2, 3]) {
      assert.match(estilos, new RegExp(`anio-dia--nivel-${nivel}\\s*\\{`))
    }
    assert.match(plantilla, /anio-dia--nivel-\$\{intensidadDeJuntas\(cuentas\[dia\]\)\}/)
  })

  it('hoy lleva un anillo de 2 px en --dg-foco y el número de juntas sigue en el aria-label', () => {
    assert.match(estilos, /\.anio-dia--hoy\s*\{[^}]*0 0 0 2px var\(--dg-foco\)/)
    assert.match(anio, /textoDiaConJuntas/)
    assert.match(plantilla, /:aria-label="nombreAccesible\(dia\)"/)
  })

  it('no escribe colores sueltos', () => {
    assert.doesNotMatch(anio, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })
})

describe('movimiento reducido (app.scss)', () => {
  const css = leer('../src/css/app.scss')
  const bloques = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
    .map(([, cuerpo]) => cuerpo)
    .join('\n')

  it('quita el desplazamiento de jump-down y jump-up y deja solo el fundido', () => {
    for (const nombre of [
      'q-transition--jump-down-enter-from',
      'q-transition--jump-down-leave-to',
      'q-transition--jump-up-enter-from',
      'q-transition--jump-up-leave-to',
    ]) {
      assert.match(bloques, new RegExp(`\\.${nombre}`), nombre)
    }
    assert.match(bloques, /\.q-transition--jump-up-leave-to[^{]*\{[^}]*transform:\s*none/)
  })

  it('desactiva el shake de los diálogos persistent', () => {
    assert.match(bloques, /\.q-animate--scale\s*\{[^}]*animation:\s*none/)
  })

  it('conserva las reglas de movimiento que ya había', () => {
    assert.match(bloques, /\.q-transition--dialogo-entra-enter-from/)
    assert.match(bloques, /\.boton-presionable/)
  })
})
