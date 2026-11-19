// Responder invitaciones y avisos de juntas (rebanada 22): servicios, utilidades puras, enlace de la
// campana y comprobaciones estáticas de la pantalla, la ficha y el calendario.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { crearJuntaService } from '../src/services/juntaService.js'
import { crearNotificacionService } from '../src/services/notificacionService.js'
import { destinoDeAviso } from '../src/utils/avisos.js'
import { etiquetaEstadoJunta, marcasDeJunta, miRespuestaEnJunta } from '../src/utils/juntas.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (texto) => texto.split('<script')[0]

const crearApiFalsa = (respuestas = {}) => {
  const llamadas = []
  const responder = async (metodo, url, segundo) => {
    llamadas.push({ metodo, url, segundo })
    return { data: respuestas[metodo] }
  }
  return {
    llamadas,
    get: (url, config) => responder('GET', url, config),
    patch: (url, cuerpo) => responder('PATCH', url, cuerpo),
  }
}

const junta = (estado, participantes = []) => ({
  id: 5,
  titulo: 'Revisión',
  inicio: '2026-11-18 09:00:00',
  fin: '2026-11-18 10:00:00',
  estado,
  participantes,
})

describe('juntaService.responder', () => {
  it('envía PATCH /juntas/:id/respuesta y devuelve la junta actualizada', async () => {
    const respuesta = junta('confirmada')
    const api = crearApiFalsa({ PATCH: { junta: respuesta } })
    assert.deepEqual(await crearJuntaService({ api }).responder(5, 'aceptada'), respuesta)
    assert.deepEqual(api.llamadas, [
      { metodo: 'PATCH', url: '/juntas/5/respuesta', segundo: { respuesta: 'aceptada' } },
    ])
  })

  it('con enNombreDe envía en_nombre_de en el cuerpo de la respuesta', async () => {
    const api = crearApiFalsa({ PATCH: { junta: junta('confirmada') } })
    await crearJuntaService({ api }).responder(5, 'rechazada', 9)
    assert.deepEqual(api.llamadas, [
      {
        metodo: 'PATCH',
        url: '/juntas/5/respuesta',
        segundo: { respuesta: 'rechazada', en_nombre_de: 9 },
      },
    ])
  })

  it('rechaza una respuesta sin junta con tres partes', async () => {
    const api = crearApiFalsa({ PATCH: { otra: 1 } })
    await assert.rejects(crearJuntaService({ api }).responder(5, 'rechazada'), (error) => {
      assert.equal(error.estado, 'respuesta_inesperada')
      assert.match(error.mensaje, /Qué ocurrió:/)
      return true
    })
  })
})

describe('notificacionService: avisos de juntas', () => {
  const base = {
    id: 4,
    caso_id: null,
    mensaje: 'Ana te invitó',
    leida: false,
    creado_en: '2026-11-18 08:00:00',
  }

  it('un aviso de junta trae juntaId y juntaInicio; uno de caso no cambia de forma', async () => {
    const api = crearApiFalsa({
      GET: {
        notificaciones: [
          { ...base, junta_id: 7, junta_inicio: '2026-12-01 09:00:00' },
          { ...base, id: 5, caso_id: 9, junta_id: null, junta_inicio: null },
        ],
        no_leidas: 2,
      },
    })
    const { avisos } = await crearNotificacionService({ api }).getNotificaciones()
    assert.equal(avisos[0].juntaId, 7)
    assert.equal(avisos[0].juntaInicio, '2026-12-01 09:00:00')
    assert.deepEqual(Object.keys(avisos[1]).sort(), ['casoId', 'fecha', 'id', 'leida', 'mensaje'])
  })
})

describe('destinoDeAviso con juntas', () => {
  const aviso = { juntaId: 7, juntaInicio: '2026-12-01 09:00:00' }

  it('lleva a «Mi Calendario» con la fecha de la junta y su id para los 4 roles del calendario', () => {
    for (const rol of ['administrador', 'contador', 'auxiliar', 'recepcionista']) {
      assert.deepEqual(destinoDeAviso(aviso, rol), {
        name: 'juntas',
        query: { fecha: '2026-12-01', juntaId: '7' },
      })
    }
  })

  it('el usuario de sistema no tiene enlace', () => {
    assert.equal(destinoDeAviso(aviso, 'usuarios_de_sistema'), null)
  })

  it('un aviso de caso conserva su comportamiento', () => {
    assert.deepEqual(destinoDeAviso({ casoId: 42 }, 'contador'), {
      name: 'contador-casos',
      query: { casoId: '42' },
    })
    assert.equal(destinoDeAviso({ casoId: 42 }, 'administrador'), null)
    assert.equal(destinoDeAviso({ casoId: 42 }, 'recepcionista'), null)
  })

  it('un aviso de junta borrada (sin junta) no lleva a ningún lado', () => {
    assert.equal(destinoDeAviso({ juntaId: null, casoId: null }, 'contador'), null)
  })
})

describe('campana de la recepcionista', () => {
  const almacen = leer('../src/stores/session.js')
  const veCampana = (rol) => {
    const coincidencia = almacen.match(/veCampana:\s*(\(state\)\s*=>\s*[^\n]+?),?\r?\n/)
    assert.ok(coincidencia, 'el store define veCampana')
    return new Function(`return (${coincidencia[1]})`)()({ rol })
  }

  it('la ven los 4 roles del calendario y no el usuario de sistema', () => {
    for (const rol of ['administrador', 'contador', 'auxiliar', 'recepcionista']) {
      assert.equal(veCampana(rol), true, rol)
    }
    assert.equal(veCampana('usuarios_de_sistema'), false)
  })
})

describe('utilidades de estado y respuesta', () => {
  it('etiquetaEstadoJunta da texto para cada estado', () => {
    assert.equal(etiquetaEstadoJunta('confirmada'), 'Confirmada')
    assert.equal(etiquetaEstadoJunta('por_confirmar'), 'Por confirmar')
    assert.equal(etiquetaEstadoJunta('cancelada'), 'Cancelada')
  })

  it('miRespuestaEnJunta devuelve mi respuesta, o null si organizo o no estoy invitado', () => {
    const j = junta('confirmada', [
      { id: 3, respuesta: 'aceptada' },
      { id: 4, respuesta: 'pendiente' },
    ])
    assert.equal(miRespuestaEnJunta(j, '3'), 'aceptada')
    assert.equal(miRespuestaEnJunta(j, 4), 'pendiente')
    assert.equal(miRespuestaEnJunta(j, 9), null)
    assert.equal(miRespuestaEnJunta(j, null), null)
  })

  it('marcasDeJunta: «Por confirmar», «Cancelada» y «Responder» solo con mi respuesta pendiente', () => {
    const invitados = [{ id: 3, respuesta: 'pendiente' }]
    assert.deepEqual(marcasDeJunta(junta('confirmada', invitados), 3), ['Responder'])
    assert.deepEqual(marcasDeJunta(junta('por_confirmar', invitados), 3), [
      'Por confirmar',
      'Responder',
    ])
    assert.deepEqual(marcasDeJunta(junta('cancelada', invitados), 3), ['Cancelada', 'Responder'])
    assert.deepEqual(marcasDeJunta(junta('por_confirmar', [{ id: 3, respuesta: 'aceptada' }]), 3), [
      'Por confirmar',
    ])
    assert.deepEqual(marcasDeJunta(junta('confirmada', invitados), 8), [])
    assert.deepEqual(marcasDeJunta(junta('cancelada', invitados), 8), ['Cancelada'])
  })
})

describe('pantalla «Juntas»: abrir la ficha desde un aviso', () => {
  const pagina = leer('../src/pages/JuntasPage.vue')

  it('lee ?juntaId=, abre la ficha con obtener() y avisa si ya no está disponible', () => {
    assert.match(pagina, /route\.query\.juntaId/)
    assert.match(pagina, /obtener\(/)
    assert.match(pagina, /Esa junta ya no está disponible/)
  })

  it('reacciona si la URL cambia estando ya en la pantalla y limpia juntaId después', () => {
    assert.match(pagina, /watch\(\s*\(\) => route\.query\.juntaId/)
    assert.match(pagina, /delete resto\.juntaId/)
  })

  it('al limpiar juntaId conserva la vista y la fecha en la URL', () => {
    assert.match(
      pagina,
      /router\.replace\(\{ query: \{ \.\.\.resto, vista: vista\.value, fecha: fecha\.value \} \}\)/,
    )
  })

  it('al responder actualiza la ficha y recarga el calendario, sin avisar (el botón marcado confirma)', () => {
    assert.match(plantillaDe(pagina), /@respondida="alResponder"/)
    assert.doesNotMatch(pagina, /Respuesta guardada/)
    assert.match(pagina, /juntaSeleccionada\.value = junta/)
  })
})

describe('ficha de la junta: estado y respuesta', () => {
  const ficha = leer('../src/components/JuntaDetalleDialog.vue')
  const plantilla = plantillaDe(ficha)

  it('muestra el chip de estado con texto', () => {
    assert.match(plantilla, /etiquetaEstadoJunta\(junta\.estado\)/)
  })

  it('el invitado ve «Aceptar» y «Rechazar» con su respuesta marcada; el organizador no', () => {
    assert.match(plantilla, /v-if="miRespuesta !== null"/)
    assert.match(ficha, /props\.junta\.soy_organizador \? null/)
    assert.match(plantilla, /label="Aceptar"/)
    assert.match(plantilla, /label="Rechazar"/)
    assert.match(plantilla, /aria-pressed/)
    assert.match(ficha, /responder\(props\.junta\.id, respuesta\)/)
    assert.match(ficha, /emit\('respondida'/)
  })

  it('un fallo se muestra en tres partes y deja la ficha como estaba', () => {
    assert.match(ficha, /errorRespuesta/)
    assert.match(ficha, /Qué ocurrió: No se guardó tu respuesta\. Sobre: /)
  })
})

describe('calendario: marcas de estado', () => {
  const calendario = leer('../src/components/CalendarioJuntas.vue')

  it('pinta las marcas con texto y tacha el título de una junta cancelada', () => {
    assert.match(calendario, /marcasDeJunta\(/)
    assert.match(calendario, /junta-etiqueta--cancelada/)
    assert.match(calendario, /junta-bloque--cancelada/)
    assert.match(calendario, /text-decoration: line-through/)
  })

  it('no usa colores hexadecimales sueltos en lo nuevo', () => {
    assert.doesNotMatch(calendario, /#[0-9a-fA-F]{3,6}\b/)
  })
})

describe('rebanada 29: calendario y campana', () => {
  const calendario = leer('../src/components/CalendarioJuntas.vue')
  const pagina = leer('../src/pages/JuntasPage.vue')
  const campana = leer('../src/components/CampanaAvisos.vue')

  it('las juntas fuera de 8:00 a 19:00 salen en la franja de arriba del día, junto a los vencimientos', () => {
    const arriba = calendario.slice(
      calendario.indexOf('#head-day-event'),
      calendario.indexOf('#day-body'),
    )
    assert.match(arriba, /juntasFueraDeHorario\(/)
    assert.match(arriba, /abrir-junta/)
    assert.match(calendario, /notaDeRecorte\(/)
  })

  it('el mes usa horaEnElDia y la semana decide sus días con la prop conFinDeSemana', () => {
    assert.match(calendario, /horaEnElDia\(junta, scope\.timestamp\.date\)/)
    assert.match(calendario, /vista === 'semana' && !conFinDeSemana/)
    assert.match(pagina, /:con-fin-de-semana="conFinDeSemana"/)
    assert.match(pagina, /:agenda-id="agendaId"/)
  })

  it('el hover no pisa el color del estado y solo se aplica con mouse', () => {
    assert.match(calendario, /@media \(hover: hover\) and \(pointer: fine\)/)
    assert.match(calendario, /\.junta-etiqueta--por-confirmar:hover/)
    assert.match(calendario, /\.junta-bloque--cancelada:hover/)
  })

  it('la campana relee los avisos al cambiar de ruta (no de consulta) y no pone su propio scroll', () => {
    assert.match(campana, /watch\(\(\) => route\.path, cargar\)/)
    assert.doesNotMatch(campana, /route\.fullPath/)
    assert.doesNotMatch(campana, /max-height/)
  })
})
