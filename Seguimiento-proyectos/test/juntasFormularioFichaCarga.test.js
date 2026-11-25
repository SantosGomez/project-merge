// Rebanada 30: «Mi Calendario», formulario, ficha y respuesta inmediata. Utilidades puras para
// insertar, reemplazar y quitar juntas de la lista, y comprobaciones estáticas de la pantalla,
// el formulario, la ficha y el calendario.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { conJuntaGuardada, juntaCaeEnRango, sinJunta } from '../src/utils/juntas.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (texto) => texto.split('<script')[0]
const estilosDe = (texto) => texto.split('<style')[1] ?? ''

const junta = (id, inicio, fin = inicio) => ({
  id,
  titulo: `Junta ${id}`,
  inicio: `${inicio}:00`,
  fin: `${fin}:00`,
})
const SEMANA = { desde: '2026-11-16', hasta: '2026-11-22' }

describe('juntaCaeEnRango', () => {
  it('es verdadero si algún día de la junta cae dentro del rango', () => {
    assert.equal(juntaCaeEnRango(junta(1, '2026-11-18 09:00', '2026-11-18 10:00'), SEMANA), true)
    assert.equal(juntaCaeEnRango(junta(2, '2026-11-22 22:00', '2026-11-23 01:30'), SEMANA), true)
    assert.equal(juntaCaeEnRango(junta(3, '2026-11-15 22:00', '2026-11-16 01:30'), SEMANA), true)
  })

  it('es falso si cae antes o después del rango', () => {
    assert.equal(juntaCaeEnRango(junta(4, '2026-11-25 09:00', '2026-11-25 10:00'), SEMANA), false)
    assert.equal(juntaCaeEnRango(junta(5, '2026-11-10 09:00', '2026-11-10 10:00'), SEMANA), false)
  })
})

describe('conJuntaGuardada', () => {
  const enSemana = junta(1, '2026-11-18 09:00', '2026-11-18 10:00')

  it('agrega la junta nueva si cae en el rango, sin tocar la lista original', () => {
    const lista = [junta(2, '2026-11-19 09:00', '2026-11-19 10:00')]
    const resultado = conJuntaGuardada(lista, enSemana, SEMANA)
    assert.deepEqual(
      resultado.map((j) => j.id),
      [2, 1],
    )
    assert.equal(lista.length, 1)
  })

  it('reemplaza la junta que ya estaba por la versión de la API', () => {
    const editada = { ...enSemana, titulo: 'Nuevo título' }
    const resultado = conJuntaGuardada([enSemana, junta(2, '2026-11-19 09:00')], editada, SEMANA)
    assert.equal(resultado.length, 2)
    assert.equal(resultado.find((j) => j.id === 1).titulo, 'Nuevo título')
  })

  it('la quita de la lista si ahora cae fuera del rango', () => {
    const movida = junta(1, '2026-12-02 09:00', '2026-12-02 10:00')
    assert.deepEqual(conJuntaGuardada([enSemana], movida, SEMANA), [])
  })

  it('no agrega una junta nueva que cae fuera del rango', () => {
    assert.deepEqual(conJuntaGuardada([], junta(9, '2026-12-02 09:00'), SEMANA), [])
  })
})

describe('sinJunta', () => {
  it('quita la junta con ese id y conserva las demás', () => {
    const lista = [junta(1, '2026-11-18 09:00'), junta(2, '2026-11-19 09:00')]
    assert.deepEqual(
      sinJunta(lista, 1).map((j) => j.id),
      [2],
    )
    assert.equal(lista.length, 2)
  })
})

describe('formulario de la junta: pie fijo y ayudas junto a su campo', () => {
  const formulario = leer('../src/components/JuntaFormDialog.vue')
  const estilos = estilosDe(formulario)

  it('la tarjeta mide como máximo 85vh, en columna, con el cuerpo desplazable y el pie fijo', () => {
    assert.match(estilos, /\.junta-form\s*\{[^}]*max-height:\s*85vh/)
    assert.match(estilos, /\.junta-form\s*\{[^}]*display:\s*flex/)
    assert.match(estilos, /\.junta-form__body\s*\{[^}]*overflow-y:\s*auto/)
    assert.match(
      estilos,
      /\.junta-form__actions\s*\{[^}]*border-top:\s*1px solid var\(--dg-borde\)/,
    )
  })

  it('«Formato DD-MM-AAAA» y la ayuda de invitados van en la prop hint de su campo', () => {
    const plantilla = plantillaDe(formulario)
    assert.match(plantilla, /hint="Formato DD-MM-AAAA\."/)
    assert.match(plantilla, /:hint="textoAyudaInvitados"/)
    assert.doesNotMatch(plantilla, /id="junta-fecha-ayuda"/)
    assert.doesNotMatch(plantilla, /id="junta-invitados-ayuda"/)
  })

  it('avisa con `cerrada` cuando termina de cerrarse', () => {
    assert.match(plantillaDe(formulario), /@hide="alCerrar"/)
    assert.match(formulario, /emit\('cerrada'\)/)
  })
})

describe('ficha de la junta', () => {
  const ficha = leer('../src/components/JuntaDetalleDialog.vue')
  const plantilla = plantillaDe(ficha)
  const estilos = estilosDe(ficha)

  it('en menos de 600 px va en una columna y sin el scroll interno de la descripción', () => {
    const movil = estilos.slice(estilos.indexOf('@media (max-width: 599px)'))
    assert.match(movil, /\.detalle-campo\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/)
    assert.match(movil, /\.detalle-texto\s*\{[^}]*max-height:\s*none/)
    assert.match(movil, /\.detalle-texto\s*\{[^}]*overflow-y:\s*visible/)
  })

  it('el nombre de «Responder por» conserva sus mayúsculas', () => {
    assert.match(plantilla, /Responder por\s*<span class="detalle-seccion__nombre">/)
    assert.match(estilos, /\.detalle-seccion__nombre\s*\{[^}]*text-transform:\s*none/)
  })

  it('anuncia la respuesta en una región aria-live y avisa con `cerrada` al cerrarse', () => {
    assert.match(plantilla, /class="sr-only"\s+role="status"\s+aria-live="polite"/)
    assert.match(plantilla, /@hide="emit\('cerrada'\)"/)
  })

  it('el pie queda fijo con un borde superior', () => {
    assert.match(
      estilos,
      /\.junta-detalle__actions\s*\{[^}]*border-top:\s*1px solid var\(--dg-borde\)/,
    )
  })
})

describe('pantalla: carga, guardado y resaltado', () => {
  const pagina = leer('../src/pages/JuntasPage.vue')
  const plantilla = plantillaDe(pagina)
  const estilos = estilosDe(pagina)

  it('el ScreenLoader solo sale en la primera carga', () => {
    assert.match(plantilla, /<ScreenLoader v-if="cargando && !cargadoUnaVez"/)
    assert.match(plantilla, /<ErrorState v-else-if="errorCarga && !cargadoUnaVez"/)
  })

  it('después de la primera carga el calendario se queda con aria-busy y una barra de 2 px', () => {
    assert.match(plantilla, /:aria-busy="cargando"/)
    assert.match(plantilla, /<q-linear-progress[^>]*indeterminate[^>]*size="2px"/)
    assert.match(estilos, /juntas-page__contenido--cargando\s*\{[^}]*opacity/)
    assert.match(estilos, /transition:\s*opacity 150ms/)
    assert.match(estilos, /prefers-reduced-motion: reduce/)
  })

  it('si una carga falla después de la primera, avisa con «Reintentar» sin quitar el calendario', () => {
    assert.match(
      plantilla,
      /v-if="errorCarga"\s+dense\s+rounded\s+class="juntas-page__aviso-carga"/,
    )
    assert.match(plantilla, /@click="cargar\(\)"/)
  })

  it('el aviso «No tienes juntas» va sobre la tarjeta, sin empujar el calendario', () => {
    assert.match(estilos, /\.juntas-page__vacio\s*\{[^}]*position:\s*absolute/)
  })

  it('guardar y borrar actualizan la lista al instante y después reconcilian en silencio', () => {
    assert.match(pagina, /conJuntaGuardada\(juntas\.value, guardada, rango\.value\)/)
    assert.match(pagina, /sinJunta\(juntas\.value, junta\.id\)/)
    assert.match(pagina, /cargar\(\{ silencioso: true \}\)/)
  })

  it('si la junta guardada cae fuera de lo que se ve, navega a su fecha y la resalta unos 3 s', () => {
    assert.match(pagina, /juntaCaeEnRango\(guardada, rango\.value\)/)
    assert.match(pagina, /irA\(vista\.value, guardada\.inicio\.slice\(0, 10\)\)/)
    assert.match(pagina, /resaltar\(guardada\.id\)/)
    assert.match(pagina, /\}, 3000\)/)
    assert.match(plantilla, /:resaltada-id="juntaResaltadaId"/)
  })

  it('«Editar» desde la ficha abre el formulario cuando la ficha termina de cerrarse', () => {
    assert.match(plantilla, /@cerrada="alCerrarFicha"/)
    assert.match(plantilla, /@cerrada="alCerrarFormulario"/)
    assert.match(pagina, /edicionPendiente/)
  })

  it('responder ya no notifica «Respuesta guardada.»', () => {
    assert.doesNotMatch(pagina, /Respuesta guardada/)
  })
})

describe('calendario: resalta la junta guardada y permite devolverle el foco', () => {
  const calendario = leer('../src/components/CalendarioJuntas.vue')

  it('recibe `resaltadaId` y marca los bloques y etiquetas de esa junta con un anillo de acento', () => {
    const bloque = leer('../src/components/BloqueJunta.vue')
    assert.match(calendario, /resaltadaId:/)
    assert.match(calendario, /:resaltada="esResaltada\(/)
    assert.match(bloque, /junta--resaltada/)
    assert.match(bloque, /box-shadow:\s*0 0 0 2px var\(--dg-acento\)/)
    assert.match(bloque, /'data-junta-id'/)
  })

  it('sigue sin tooltips', () => {
    assert.doesNotMatch(plantillaDe(calendario), /q-tooltip/)
  })
})

describe('cliente, modalidad y lugar (rebanada 43)', () => {
  const formulario = leer('../src/components/JuntaFormDialog.vue')
  const plantillaForm = plantillaDe(formulario)
  const ficha = leer('../src/components/JuntaDetalleDialog.vue')
  const plantillaFicha = plantillaDe(ficha)

  it('el formulario tiene los tres campos, sin asterisco, en el orden pedido', () => {
    const orden = ['junta-titulo', 'junta-fecha', 'CAMPOS_HORA', 'junta-cliente']
    const posiciones = [...orden, 'junta-modalidad', 'junta-lugar', 'junta-invitados'].map((id) =>
      plantillaForm.indexOf(id),
    )
    assert.ok(
      posiciones.every((p) => p >= 0),
      'faltan campos',
    )
    assert.deepEqual(
      [...posiciones].sort((a, b) => a - b),
      posiciones,
    )
    assert.doesNotMatch(
      plantillaForm,
      /for="junta-(cliente|modalidad|lugar)"[^>]*>[^<]*<span[^>]*required-mark/,
    )
    assert.match(plantillaForm, /:maxlength="MAX_CLIENTE"/)
    assert.match(plantillaForm, /:maxlength="MAX_LUGAR"/)
  })

  it('«Elegir de mis clientes» solo se ofrece con «Mis actividades» y la lista sale de listarClientes', () => {
    assert.match(plantillaForm, /Elegir de mis clientes/)
    assert.match(plantillaForm, /v-if="puedeElegirClientes"/)
    assert.match(formulario, /session\.actividadesHabilitadas/)
    assert.match(formulario, /listarClientes/)
    assert.match(formulario, /Aún no tienes clientes activos en tu cartera\./)
    assert.match(plantillaForm, /Reintentar/)
  })

  it('la modalidad es Presencial / Virtual y el lugar cambia de ejemplo según ella', () => {
    assert.match(plantillaForm, /<q-btn-toggle/)
    assert.match(plantillaForm, /clearable/)
    assert.match(formulario, /Por ejemplo: Sala de juntas o dirección/)
    assert.match(formulario, /Por ejemplo: enlace de Teams o Meet/)
    assert.match(formulario, /Dónde será la junta/)
  })

  it('los tres campos entran en la foto del formulario, se precargan y se envían', () => {
    const foto = formulario.slice(
      formulario.indexOf('const fotoDelFormulario'),
      formulario.indexOf('const hayDatosSinGuardar'),
    )
    for (const campo of ['cliente.value', 'modalidad.value', 'lugar.value']) {
      assert.ok(foto.includes(campo), `${campo} no está en la foto`)
    }
    assert.match(formulario, /cliente\.value = j\?\.cliente \?\? ''/)
    assert.match(formulario, /modalidad\.value = j\?\.modalidad \?\? null/)
    assert.match(formulario, /lugar\.value = j\?\.lugar \?\? ''/)
    assert.match(formulario, /cliente: 'cliente'/)
    assert.match(formulario, /modalidad: 'modalidad'/)
    assert.match(formulario, /lugar: 'lugar'/)
  })

  it('la ficha muestra Cliente, Modalidad y Lugar con sus textos vacíos y el enlace seguro', () => {
    for (const texto of [
      'Sin cliente',
      'Sin indicar',
      'Sin lugar',
      '>Cliente<',
      '>Modalidad<',
      '>Lugar<',
    ]) {
      assert.ok(plantillaFicha.includes(texto), `falta ${texto}`)
    }
    assert.match(plantillaFicha, /target="_blank"/)
    assert.match(plantillaFicha, /rel="noopener noreferrer"/)
    assert.match(plantillaFicha, /enlaceDeLugar\(junta\)/)
  })
})
