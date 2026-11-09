// Revisión de UI, rebanada 9 (revisión de conjunto): lo que debe estar parejo en toda la app.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const aRuta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(aRuta(relativa), 'utf8')
const archivos = (dir, extension) =>
  readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    return statSync(ruta).isDirectory() ? archivos(ruta, extension) : ruta.endsWith(extension) ? [ruta] : []
  })
const plantillaDe = (fuente) => fuente.split('<script')[0]

const vues = archivos(aRuta('../src'), '.vue').map((ruta) => [ruta, readFileSync(ruta, 'utf8')])

describe('Textos en tú en toda la app', () => {
  // Cadenas que lee la persona: imperativos en usted al inicio de «qué hacer» o de un aviso.
  const USTED = /['`](Inicie|Ingrese|Envíe|Seleccione|Verifique|Escriba|Use |Inténtelo|Espere|Pida|Indique|Elija|Actualice)|No tiene permiso|Debe cambiar su|Cree su propia|le dio el administrador/

  it('el backend ya no responde en usted', () => {
    for (const ruta of archivos(aRuta('../../Backend/src'), '.js')) {
      assert.doesNotMatch(readFileSync(ruta, 'utf8'), USTED, ruta)
    }
  })

  it('los servicios del frontend tampoco', () => {
    for (const ruta of archivos(aRuta('../src/services'), '.js')) {
      assert.doesNotMatch(readFileSync(ruta, 'utf8'), USTED, ruta)
    }
  })

  it('el backend nombra los estados como el frontend sin cambiar los valores guardados', () => {
    const evento = readFileSync(aRuta('../../Backend/src/controllers/AuditoriaEventoController.js'), 'utf8')
    assert.match(evento, /Elige Pendiente, En revisión, En proceso, Rechazado o Completado/)
    assert.match(evento, /'Revision'/, 'el valor guardado sigue igual')
    // El alta de usuarios reconoce el correo repetido por «ya existe».
    assert.match(readFileSync(aRuta('../../Backend/src/controllers/UserController.js'), 'utf8'), /'El correo ya existe'/)
  })
})

describe('Área táctil de 44 px en todos los componentes', () => {
  it('la regla es global y ya no se copia en cada componente (salvo las de 48 px del acceso)', () => {
    assert.match(leer('../src/css/app.scss'), /\n\.control-touch\s*\{\s*min-width:\s*44px;\s*min-height:\s*44px;/)
    const conCopia = vues.filter(([, t]) => /\n\.control-touch\s*\{\s*min-width:\s*44px;\s*min-height:\s*44px;/.test(t))
    assert.deepEqual(conCopia.map(([ruta]) => ruta), [])
  })

  it('«Empezar»/«Finalizar» de la agenda ya no son compactos', () => {
    const agenda = plantillaDe(leer('../src/components/AgendaCasos.vue'))
    const boton = agenda.slice(agenda.indexOf('class="agenda-casos__accion'), agenda.indexOf('/>', agenda.indexOf('class="agenda-casos__accion')))
    const apertura = agenda.slice(agenda.lastIndexOf('<q-btn', agenda.indexOf('class="agenda-casos__accion')), agenda.indexOf('class="agenda-casos__accion'))
    assert.doesNotMatch(apertura + boton, /\bdense\b/)
  })
})

describe('Detalles parejos', () => {
  it('todos los diálogos de confirmación entran y salen igual', () => {
    for (const [ruta, t] of vues) {
      assert.doesNotMatch(plantillaDe(t), /<q-dialog[^>]*transition-show="fade"/, ruta)
    }
  })

  it('botones de acción de acceso, avisos y estados responden al presionar; sin copias propias del efecto', () => {
    for (const archivo of ['pages/LoginPage.vue', 'pages/CambiarContrasenaPage.vue', 'pages/[...path].vue', 'components/AccessDenied.vue', 'components/AvisoSesionCaducada.vue', 'components/ErrorState.vue', 'components/EmptyState.vue']) {
      assert.match(plantillaDe(leer(`../src/${archivo}`)), /boton-presionable/, archivo)
    }
    for (const archivo of ['pages/LoginPage.vue', 'pages/CambiarContrasenaPage.vue']) {
      assert.doesNotMatch(leer(`../src/${archivo}`), /__submit:active\s*\{/, archivo)
    }
  })

  it('colores de la paleta en la campana, los filtros, el layout y el borrado de eventos', () => {
    assert.doesNotMatch(plantillaDe(leer('../src/components/CampanaAvisos.vue')), /grey-\d/)
    assert.doesNotMatch(plantillaDe(leer('../src/components/FiltrosCasos.vue')), /'white'/)
    assert.doesNotMatch(plantillaDe(leer('../src/pages/AdminDashboardPage.vue')), /text-color="white"/)
    assert.doesNotMatch(plantillaDe(leer('../src/layouts/MaquetaLayout.vue')), /\btext-white\b/)
    assert.doesNotMatch(leer('../src/components/BitacoraAuditoria.vue'), /color: 'negative'/)
  })

  it('el menú de la campana se abre como los demás menús', () => {
    assert.match(plantillaDe(leer('../src/components/CampanaAvisos.vue')), /<q-menu[^>]*transition-show="jump-down"[^>]*:transition-duration="180"/)
  })

  it('si falla el envío de un mensaje, el aviso ofrece «Reintentar»', () => {
    assert.match(leer('../src/components/ChatAuditoria.vue'), /label: 'Reintentar'[\s\S]*?handler: enviar/)
  })
})
