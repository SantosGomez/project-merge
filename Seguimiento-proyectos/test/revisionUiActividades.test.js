// Revisión de UI/UX de «Mi trabajo / Mis actividades» (impeccable + emil): textos, orden estable de la
// lista, estados de carga, cronómetro siempre a la vista y tooltips que no tapan lo que importa.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { agruparPorTipo, posicionesDeRenglones } from '../src/utils/actividades.js'
import { resumenDeJornada } from '../src/utils/jornada.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]
const componente = (nombre) => leer(`../src/components/${nombre}.vue`)

const renglon = (cliente_id, extra = {}) => ({
  tipo_id: 1,
  tipo: 'Contabilidad',
  tipo_activo: true,
  cliente_id,
  cliente: `Cliente ${cliente_id}`,
  hecha: false,
  vence: null,
  minutos: 0,
  ...extra,
})

describe('textos con concordancia', () => {
  it('el resumen de la jornada no dice «1 min trabajadas» ni «5 h trabajados»', () => {
    const dia = { entrada: '09:00', salida_descanso: null, regreso_descanso: null, salida: null }
    assert.equal(resumenDeJornada(dia, 1), 'Entrada 09:00 · llevas 1 min de trabajo')
    assert.equal(
      resumenDeJornada({ ...dia, salida_descanso: '14:00' }, 300),
      'En descanso desde las 14:00 · llevas 5 h de trabajo',
    )
    assert.doesNotMatch(leer('../src/utils/jornada.js'), /trabajad[oa]s`/)
  })

  it('«Mis tipos de actividad» habla de «las actividades»: «Solo tú las ves»', () => {
    const plantilla = plantillaDe(componente('MisTiposActividad'))
    assert.match(plantilla, /Solo tú las ves/)
    assert.doesNotMatch(plantilla, /Solo tú los ves/)
  })

  it('la pestaña «Mis actividades» describe lo que hoy contiene', () => {
    const plantilla = plantillaDe(leer('../src/pages/MyCasesPage.vue'))
    const pestana = plantilla.slice(plantilla.indexOf('name="actividades"'))
    const ayuda = pestana.slice(0, pestana.indexOf('</q-tab>'))
    assert.match(ayuda, /jornada/)
    assert.match(ayuda, /mes/)
    assert.match(ayuda, /informes/)
  })
})

describe('lista del mes: el renglón no salta al marcar «Hecha»', () => {
  it('con las posiciones de la carga, marcar un renglón no lo manda al final del grupo', () => {
    const actividades = [renglon(1), renglon(2), renglon(3)]
    const posiciones = posicionesDeRenglones(agruparPorTipo(actividades))
    actividades[0].hecha = true

    const sinPosiciones = agruparPorTipo(actividades)[0].renglones.map((r) => r.cliente_id)
    assert.deepEqual(sinPosiciones, [2, 3, 1], 'al cargar, lo hecho va al final')

    const conPosiciones = agruparPorTipo(actividades, posiciones)[0]
    assert.deepEqual(
      conPosiciones.renglones.map((r) => r.cliente_id),
      [1, 2, 3],
    )
    assert.equal(conPosiciones.hechas, 1, 'los conteos sí se actualizan')
  })

  it('un renglón que no estaba en la carga entra después de los conocidos', () => {
    const posiciones = posicionesDeRenglones(agruparPorTipo([renglon(2), renglon(3)]))
    const grupos = agruparPorTipo([renglon(1), renglon(2), renglon(3)], posiciones)
    assert.deepEqual(
      grupos[0].renglones.map((r) => r.cliente_id),
      [2, 3, 1],
    )
  })

  it('la lista fija el orden al cargar y no al releer en silencio por el cronómetro', () => {
    const fuente = componente('ListaDelMes')
    assert.match(fuente, /agruparPorTipo\(actividades\.value, posiciones\.value\)/)
    assert.match(fuente, /posicionesDeRenglones\(/)
    assert.match(fuente, /conservarOrden/)
  })

  it('lo hecho se distingue también por el texto atenuado del cliente (además de la casilla)', () => {
    const fuente = componente('ListaDelMes')
    assert.match(plantillaDe(fuente), /'lista-mes__fila--hecha': renglon\.hecha/)
    assert.match(fuente, /\.lista-mes__fila--hecha \.lista-mes__cliente/)
  })
})

describe('lista del mes: cifras del mes', () => {
  const fuente = componente('ListaDelMes')
  const plantilla = plantillaDe(fuente)

  it('las cifras van en su propia línea, fuera del párrafo de ayuda', () => {
    const totales = plantilla.indexOf('lista-mes__totales')
    const ayuda = plantilla.indexOf('class="lista-mes__ayuda"')
    assert.ok(totales > 0 && totales < ayuda, 'primero las cifras, luego la explicación')
    const parrafo = plantilla.slice(ayuda, plantilla.indexOf('</p>', ayuda))
    assert.doesNotMatch(parrafo, /totales\.hechas/)
  })

  it('al cambiar de mes no se ven las cifras del mes anterior mientras carga', () => {
    const inicio = plantilla.indexOf('lista-mes__totales')
    const etiqueta = plantilla.slice(
      plantilla.lastIndexOf('<', inicio),
      plantilla.indexOf('>', inicio),
    )
    assert.match(etiqueta, /v-if="estado === SCREEN_STATES\.content"/)
  })

  it('«Hoy» explica por qué está apagado cuando ya estás en el mes actual', () => {
    assert.match(plantilla, /Ya estás en el mes actual/)
  })
})

describe('conmutador de vistas en celular', () => {
  const fuente = componente('MisActividades')

  it('a menos de 600 px las cuatro vistas van en cuadrícula de 2 × 2 con el rótulo en una línea', () => {
    const estilos = fuente.slice(fuente.indexOf('<style'))
    const movil = estilos.slice(estilos.indexOf('@media (max-width: 599px)'))
    assert.match(movil, /\.mis-actividades__conmutador\s*\{[^}]*display: grid/)
    assert.match(movil, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
    assert.match(estilos, /white-space: nowrap/)
  })
})

describe('cronómetro en marcha siempre a la vista', () => {
  const fuente = componente('CronometroActivo')
  const plantilla = plantillaDe(fuente)

  it('cuando el aviso sale de la pantalla aparece una barra fija con el tiempo y «Detener»', () => {
    assert.match(plantilla, /<q-page-sticky/)
    assert.match(plantilla, /v-if="cronometro\.activo && !avisoALaVista"/)
    const barra = plantilla.slice(plantilla.indexOf('<q-page-sticky'))
    assert.match(barra, /formatearCronometro\(cronometro\.segundos\)/)
    assert.match(barra, /label="Detener"/)
    assert.match(barra, /control-touch boton-presionable/)
    assert.match(fuente, /IntersectionObserver/)
  })

  it('la barra entra con la curva de la app y sin desplazamiento si se pide menos movimiento', () => {
    assert.match(fuente, /var\(--dg-curva-salida\)/)
    assert.match(fuente, /prefers-reduced-motion: reduce/)
    assert.doesNotMatch(fuente, /transition: all/)
  })

  it('la barra fija no repite el anuncio a los lectores de pantalla', () => {
    const barra = plantilla.slice(plantilla.indexOf('<q-page-sticky'))
    assert.doesNotMatch(barra, /role="timer"/)
  })
})

describe('informes: cambiar un filtro avisa que se está actualizando', () => {
  const fuente = componente('InformesActividades')
  const plantilla = plantillaDe(fuente)

  it('muestra una barra de progreso y marca el contenido como ocupado', () => {
    assert.match(plantilla, /aria-label="Actualizando el informe"/)
    assert.match(plantilla, /:aria-busy="actualizando"/)
    assert.match(plantilla, /'informes__resultado--actualizando': actualizando/)
    assert.match(fuente, /const actualizando = computed\(/)
  })
})

describe('tooltips de los campos: no tapan el error ni lo que está debajo', () => {
  const casos = [
    ['TiempoRegistradoDialog', 'tiempo-minutos', 'erroresCampo.minutos'],
    ['TipoActividadFormDialog', 'tipo-dia', 'erroresCampo.dia_del_mes'],
    ['TipoActividadFormDialog', 'tipo-nombre', 'erroresCampo.nombre'],
    ['ClienteFormDialog', 'cliente-nombre', 'erroresCampo.nombre'],
    ['ClienteFormDialog', 'cliente-rfc', 'erroresCampo.rfc'],
  ]
  for (const [archivo, campo, error] of casos) {
    it(`${archivo}: el tooltip de ${campo} sale arriba y se quita si hay error`, () => {
      const plantilla = plantillaDe(componente(archivo))
      // La etiqueta y el campo llevan el mismo `for`: el último es el del q-input.
      const inicio = plantilla.lastIndexOf(`for="${campo}"`)
      const entrada = plantilla.slice(inicio, plantilla.indexOf('</q-input>', inicio))
      const tooltip = entrada.slice(entrada.lastIndexOf('<q-tooltip'))
      assert.match(tooltip, new RegExp(`v-if="!${error.replace('.', '\\.')}"`))
      assert.match(tooltip, /anchor="top middle"/)
      assert.match(tooltip, /self="bottom middle"/)
    })
  }
})

describe('«Corregir horas»: cambiar de día no descarta lo escrito sin preguntar', () => {
  const fuente = componente('JornadaFormDialog')

  it('pregunta antes de cargar otro día si hay horas sin guardar y deja volver al día anterior', () => {
    assert.match(fuente, /¿Cambiar de día\?/)
    assert.match(fuente, /Seguir en este día/)
    assert.match(fuente, /fechaCargada/)
    const guarda = fuente.slice(fuente.indexOf('const alCambiarFecha'))
    assert.match(guarda, /hayDatosSinGuardar\.value/)
    assert.match(guarda, /form\.fecha = fechaParaFormulario\(fechaCargada\.value\)/)
  })

  it('el icono del calendario muestra el foco del teclado', () => {
    assert.match(fuente, /\.jornada-form__calendario:focus-visible/)
  })
})

describe('detalles de los renglones', () => {
  it('«Iniciar» y el tiempo acumulado tienen aire a los lados aunque sean compactos', () => {
    const fuente = componente('RenglonActividad')
    assert.match(fuente, /\.renglon-tiempo__boton\s*\{[^}]*padding: 0 12px/)
  })

  it('la etiqueta «Hecha» usa un color de texto de la paleta', () => {
    for (const nombre of ['ListaDelMes', 'CalendarioActividades']) {
      assert.match(
        componente(nombre),
        /:deep\(\.q-checkbox__label\)\s*\{[^}]*color: var\(--dg-texto-secundario\)/,
        nombre,
      )
    }
  })

  it('la jornada es compacta en celular: las cuatro horas no ocupan media pantalla', () => {
    const fuente = componente('JornadaDeHoy')
    assert.match(plantillaDe(fuente), /<q-item v-for="paso in PASOS" :key="paso" dense/)
  })
})
