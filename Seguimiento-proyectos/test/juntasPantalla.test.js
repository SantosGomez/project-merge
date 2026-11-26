// Pantalla «Juntas» (rebanada 21b): dependencia, ruta, menú, pantalla principal de la recepcionista
// y reglas de estilo. Verificación estática de los archivos, como las demás pruebas de pantallas.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { decidirAcceso, PANTALLA_PRINCIPAL_POR_ROL } from '../src/utils/accessRules.js'
import { PROFILES, RUTA_PRINCIPAL_POR_ROL } from '../src/utils/constants.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const router = leer('../src/router/index.js')
const layout = leer('../src/layouts/MaquetaLayout.vue')
const paquete = JSON.parse(leer('../package.json'))

// Bloque de la ruta `juntas` y roles de su `meta.perfil`.
const bloqueRuta = () => {
  const inicio = router.indexOf("name: 'juntas'")
  assert.ok(inicio >= 0, 'falta la ruta «juntas»')
  return router.slice(router.lastIndexOf('{', inicio), router.indexOf('\n      },', inicio))
}
const perfilesDeLaRuta = () =>
  [...bloqueRuta().matchAll(/PROFILES\.(\w+)/g)].map(([, clave]) => PROFILES[clave])

describe('dependencia QCalendar', () => {
  it('está fijada sin ^ ni ~ en package.json', () => {
    assert.match(paquete.dependencies['@quasar/quasar-ui-qcalendar'], /^\d+\.\d+\.\d+$/)
  })

  it('no es plugin global: ni boot ni quasar.config la cargan, solo la pantalla de juntas', () => {
    assert.doesNotMatch(leer('../quasar.config.js'), /qcalendar/i)
    assert.doesNotMatch(leer('../src/App.vue'), /qcalendar/i)
    assert.match(
      leer('../src/components/CalendarioJuntas.vue'),
      /@quasar\/quasar-ui-qcalendar\/QCalendarDay/,
    )
    assert.match(
      leer('../src/components/CalendarioJuntas.vue'),
      /@quasar\/quasar-ui-qcalendar\/QCalendarMonth/,
    )
  })
})

describe('ruta /juntas', () => {
  it('se llama «juntas», muestra JuntasPage con el título «Mi Calendario» y pide sesión', () => {
    const ruta = bloqueRuta()
    assert.match(ruta, /path: 'juntas'/)
    assert.match(ruta, /component: JuntasPage/)
    assert.match(ruta, /titulo: 'Mi Calendario'/)
    assert.match(ruta, /requiereSesion: true/)
    assert.match(router, /import JuntasPage from '\.\.\/pages\/JuntasPage\.vue'/)
  })

  it('admite a administrador, contador, auxiliar y recepcionista, y niega al usuario de sistema', () => {
    assert.deepEqual(
      [...perfilesDeLaRuta()].sort(),
      [PROFILES.administrador, PROFILES.auxiliar, PROFILES.contador, PROFILES.recepcionista].sort(),
    )
    const acceso = (rol) =>
      decidirAcceso({
        ruta: { requiereSesion: true, perfil: perfilesDeLaRuta() },
        sesion: { autenticado: true, rol },
      }).accion
    for (const rol of ['administrador', 'contador', 'auxiliar', 'recepcionista']) {
      assert.equal(acceso(rol), 'permitir', rol)
    }
    assert.equal(acceso('usuarios_de_sistema'), 'denegar')
  })

  it('la pantalla principal de la recepcionista es «Juntas»; los demás perfiles no cambian', () => {
    assert.equal(RUTA_PRINCIPAL_POR_ROL.recepcionista, '/juntas')
    assert.equal(PANTALLA_PRINCIPAL_POR_ROL.recepcionista, 'juntas')
    assert.equal(RUTA_PRINCIPAL_POR_ROL.administrador, '/admin/dashboard')
    assert.equal(RUTA_PRINCIPAL_POR_ROL.contador, '/contador/casos')
    assert.equal(RUTA_PRINCIPAL_POR_ROL.usuarios_de_sistema, '/ajustes')
  })
})

describe('menú lateral: ítem «Mi Calendario»', () => {
  // Cada sección empieza en su <template v-if> y termina en el </template> que la cierra.
  const seccion = (condicion) => {
    const inicio = layout.indexOf(`<template v-if="${condicion}">`)
    assert.ok(inicio >= 0, `falta la sección ${condicion}`)
    return layout.slice(inicio, layout.indexOf('\n          </template>', inicio))
  }

  for (const [nombre, condicion] of [
    ['Administración', 'session.esAdministrador'],
    ['Mi trabajo', 'session.trabajaCasos'],
    ['Recepción', 'session.esRecepcionista'],
  ]) {
    it(`la sección «${nombre}» tiene «Mi Calendario» con su subtítulo y sin tooltip`, () => {
      const cuerpo = seccion(condicion)
      assert.match(cuerpo, /:to="\{ name: 'juntas' \}"/)
      assert.match(cuerpo, /<q-item-label>Mi Calendario<\/q-item-label>/)
      assert.match(cuerpo, /<q-item-label caption>Juntas y vencimientos<\/q-item-label>/)
      assert.equal((cuerpo.match(/name: 'juntas'/g) ?? []).length, 1)
      assert.doesNotMatch(cuerpo, /q-tooltip/)
    })
  }

  it('el usuario de sistema no ve «Mi Calendario» (ni tiene sección en este menú)', () => {
    assert.doesNotMatch(layout, /<template v-if="session\.esUsuarioSistema">/)
  })
})

describe('archivos nuevos: estilo del proyecto', () => {
  const ARCHIVOS = [
    '../src/pages/JuntasPage.vue',
    '../src/components/CalendarioJuntas.vue',
    '../src/components/JuntaFormDialog.vue',
    '../src/components/JuntaDetalleDialog.vue',
  ]

  it('no escriben colores hexadecimales ni rgb sueltos: usan la paleta --dg-*', () => {
    for (const ruta of ARCHIVOS) {
      assert.doesNotMatch(leer(ruta), /#[0-9a-fA-F]{3,8}\b|rgba?\(/, ruta)
    }
  })

  it('no leen fechas con new Date(texto)', () => {
    for (const ruta of [...ARCHIVOS, '../src/utils/juntas.js', '../src/services/juntaService.js']) {
      assert.doesNotMatch(leer(ruta), /new Date\(\s*['"`]/, ruta)
      assert.doesNotMatch(leer(ruta), /new Date\(\s*\w*(fecha|iso|texto)\w*\s*\)/i, ruta)
    }
  })

  it('el calendario usa el idioma es-MX y el horario de 8:00 a 19:00', () => {
    const calendario = leer('../src/components/CalendarioJuntas.vue')
    assert.match(calendario, /locale="es-MX"/)
    assert.match(calendario, /HORA_INICIO_VISTA/)
  })
})

describe('privacidad y agenda de otros (rebanada 23)', () => {
  it('el formulario tiene el interruptor «Junta privada» con su ayuda', () => {
    const formulario = leer('../src/components/JuntaFormDialog.vue')
    assert.match(formulario, /<q-toggle/)
    assert.match(formulario, /Junta privada/)
    assert.match(formulario, /Quien no esté invitado solo verá «Ocupado» en las agendas/)
    assert.match(formulario, /privada: privada\.value/)
  })

  it('la ficha muestra el chip «Privada» solo si la junta es privada', () => {
    assert.match(
      leer('../src/components/JuntaDetalleDialog.vue'),
      /v-if="junta\.privada"[\s\S]{0,400}Privada/,
    )
  })

  it('la pantalla tiene el selector «Ver agenda de» con «Mi agenda» y lo guarda en ?agenda=', () => {
    const pagina = leer('../src/pages/JuntasPage.vue')
    assert.match(pagina, /Ver agenda de/)
    assert.match(pagina, /Mi agenda/)
    assert.match(pagina, /query.agenda = id/)
    assert.match(pagina, /Agenda de \$\{/)
    assert.match(pagina, /agendaDe\(/)
  })

  it('en la agenda de otro, «Nueva junta» y los huecos invitan a esa persona', () => {
    const pagina = leer('../src/pages/JuntasPage.vue')
    assert.match(pagina, /:invitado-inicial=/)
    assert.match(leer('../src/components/JuntaFormDialog.vue'), /invitadoInicial/)
  })

  it('el calendario no abre ficha de los bloques ajenos y aclara «No estás invitado a esta junta»', () => {
    const bloque = leer('../src/components/BloqueJunta.vue')
    assert.match(bloque, /No estás invitado a esta junta/)
    assert.match(bloque, /esJuntaOcupada/)
    assert.match(bloque, /tabindex: 0/)
    assert.match(bloque, /if \(!ocupada\.value\) emit\('abrir'/)
  })
})

describe('recepcionista como secretaria del administrador (rebanada 27)', () => {
  const plantillaDe = (texto) => texto.split('<script')[0]
  const pagina = leer('../src/pages/JuntasPage.vue')
  const formulario = leer('../src/components/JuntaFormDialog.vue')
  const ficha = leer('../src/components/JuntaDetalleDialog.vue')

  it('la pantalla pasa el organizador al formulario y deja de invitar al administrador de la agenda', () => {
    assert.match(plantillaDe(pagina), /:invitado-inicial="invitadoInicial"/)
    assert.match(plantillaDe(pagina), /:organizador="organizadorDeLaJunta"/)
    assert.match(
      pagina,
      /organizadorDeAlta\(session\.rol, personaDeLaAgenda\.value, atendidos\.value\)/,
    )
    assert.match(
      pagina,
      /invitadoInicialDeAlta\(session\.rol, personaDeLaAgenda\.value, atendidos\.value\)/,
    )
  })

  it('el formulario muestra «Organiza: {nombre}» en texto de solo lectura y crea con organizadorId', () => {
    assert.match(plantillaDe(formulario), /v-if="organizadorNombre"[\s\S]{0,300}Organiza:/)
    assert.match(formulario, /organizador: \{ type: Object, default: null \}/)
    assert.match(formulario, /organizadorId: props\.organizador\.id/)
    assert.match(formulario, /persona\.id !== organizadorAjeno\.value\?\.id/)
  })

  it('la ficha edita y borra con puede_editar y trae «Responder por» con Aceptar y Rechazar', () => {
    const plantilla = plantillaDe(ficha)
    assert.match(plantilla, /<template v-if="puedeEditar">/)
    assert.match(ficha, /props\.junta\.puede_editar === true/)
    assert.match(ficha, /props\.junta\.responder_por \?\? \[\]/)
    assert.match(
      plantilla,
      /Responder por\s*<span class="detalle-seccion__nombre">\{\{ administrador\.nombre \}\}/,
    )
    assert.match(plantilla, /v-for="administrador in respondePor"/)
    assert.match(plantilla, /responderPorAdministrador\(administrador, 'aceptada'\)/)
    assert.match(plantilla, /responderPorAdministrador\(administrador, 'rechazada'\)/)
    assert.match(ficha, /responder\(props\.junta\.id, respuesta, administrador\.id\)/)
  })

  it('el calendario sigue sin tooltips', () => {
    assert.doesNotMatch(leer('../src/components/CalendarioJuntas.vue'), /q-tooltip/)
  })
})

describe('administrador que atiende la recepcionista (rebanada 28)', () => {
  const plantillaDe = (texto) => texto.split('<script')[0]
  const pagina = leer('../src/pages/JuntasPage.vue')
  const plantilla = plantillaDe(pagina)

  it('muestra el aviso de a quién administra, con «Ver su agenda» o «Volver a mi agenda», solo a la recepcionista', () => {
    assert.match(pagina, /const atendidos = computed\(\(\) => session\.administradoresAtendidos\)/)
    assert.match(
      plantilla,
      /<q-banner[^>]*v-if="session\.esRecepcionista"[^>]*class="juntas-page__atiende"/,
    )
    assert.match(plantilla, /\{\{ textoAviso \}\}/)
    assert.match(pagina, /textoAdministradoresAtendidos\(atendidos\.value\)/)
    // Los textos «Ver su agenda» y «Volver a mi agenda» salen de accionesDeAtendidos (rebanada 33).
    assert.match(pagina, /accionesDeAtendidos\(atendidos\.value, agendaId\.value\)/)
    assert.match(plantilla, /v-for="accion in accionesDeRecepcion"/)
    assert.match(plantilla, /@click="cambiarAgenda\(accion\.id\)"/)
  })

  it('al entrar sin agenda, con un solo administrador abre la agenda de él', () => {
    assert.match(pagina, /agendaInicialDeRecepcion\(session\.rol, atendidos\.value, route\.query\)/)
  })

  it('«Ver agenda de» marca con «Tú la administras» al administrador que atiende', () => {
    assert.match(pagina, /administraAAdministrador\(p, atendidos\.value\)/)
    assert.match(pagina, /Tú la administras/)
  })

  it('el aviso usa colores de la paleta y no un hexadecimal suelto', () => {
    const aviso = plantilla.slice(
      plantilla.indexOf('juntas-page__atiende'),
      plantilla.indexOf('juntas-page__head'),
    )
    assert.ok(aviso.length > 0)
    assert.doesNotMatch(aviso, /#[0-9a-fA-F]{3,8}\b/)
  })
})
