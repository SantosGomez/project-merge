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
  it('se llama «juntas», muestra JuntasPage con el título «Juntas» y pide sesión', () => {
    const ruta = bloqueRuta()
    assert.match(ruta, /path: 'juntas'/)
    assert.match(ruta, /component: JuntasPage/)
    assert.match(ruta, /titulo: 'Juntas'/)
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
    assert.equal(RUTA_PRINCIPAL_POR_ROL.usuarios_de_sistema, '/admin/directorio')
  })
})

describe('menú lateral: ítem «Juntas»', () => {
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
    it(`la sección «${nombre}» tiene «Juntas» con su subtítulo y sin tooltip`, () => {
      const cuerpo = seccion(condicion)
      assert.match(cuerpo, /:to="\{ name: 'juntas' \}"/)
      assert.match(cuerpo, /<q-item-label>Juntas<\/q-item-label>/)
      assert.match(cuerpo, /<q-item-label caption>Calendario de juntas del equipo<\/q-item-label>/)
      assert.equal((cuerpo.match(/name: 'juntas'/g) ?? []).length, 1)
      assert.doesNotMatch(cuerpo, /q-tooltip/)
    })
  }

  it('el usuario de sistema no ve «Juntas»', () => {
    assert.doesNotMatch(seccion('session.esUsuarioSistema'), /juntas/)
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
