// Rol auxiliar (decisión del usuario, 2026-11-10): trabaja casos como un contador (propios y los
// de su contador, ahí solo el estado), pero no gestiona auxiliares ni entra a auditorías.
// Se da de alta desde el directorio y no aparece en el dashboard del administrador.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { PROFILES, RUTA_PRINCIPAL_POR_ROL } from '../src/utils/constants.js'
import { formatearRol } from '../src/utils/formateadores.js'
import { decidirAcceso } from '../src/utils/accessRules.js'
import { validarAltaUsuario } from '../src/utils/validators.js'
import { destinoDeAviso } from '../src/utils/avisos.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

// `meta.perfil` de una ruta por su nombre, leído del router (importarlo arrastra los .vue).
const router = leer('../src/router/index.js')
const perfilDeRuta = (nombre) => {
  const bloque = router.slice(router.indexOf(`name: '${nombre}'`))
  const perfil = bloque.match(/perfil: (\[[^\]]*\]|PROFILES\.\w+)/)[1]
  return [...perfil.matchAll(/PROFILES\.(\w+)/g)].map(([, clave]) => PROFILES[clave])
}
const accesoDelAuxiliar = (nombre) =>
  decidirAcceso({
    ruta: { requiereSesion: true, perfil: perfilDeRuta(nombre) },
    sesion: { autenticado: true, rol: 'auxiliar' },
  }).accion

describe('rol auxiliar: datos y reglas', () => {
  it('existe como perfil, se muestra como «Auxiliar» y su pantalla principal es «Mis casos»', () => {
    assert.equal(PROFILES.auxiliar, 'auxiliar')
    assert.equal(formatearRol('auxiliar'), 'Auxiliar')
    assert.equal(RUTA_PRINCIPAL_POR_ROL.auxiliar, '/contador/casos')
  })

  it('el alta de usuario acepta el rol auxiliar', () => {
    const { valido, errores } = validarAltaUsuario('Ana Auxiliar', 'ana@delgrow.mx', 'Segura1234', 'auxiliar')
    assert.equal(errores.rol, null)
    assert.equal(valido, true)
  })

  it('entra a «Mis casos» y «Mi resumen», pero no a «Mis auxiliares» ni a auditorías', () => {
    assert.equal(accesoDelAuxiliar('contador-casos'), 'permitir')
    assert.equal(accesoDelAuxiliar('contador-dashboard'), 'permitir')
    assert.equal(accesoDelAuxiliar('contador-auxiliares'), 'denegar')
    assert.equal(accesoDelAuxiliar('auditorias'), 'denegar')
    assert.equal(accesoDelAuxiliar('admin-dashboard'), 'denegar')
  })

  it('los avisos de la campana también lo llevan a su caso', () => {
    assert.deepEqual(destinoDeAviso({ casoId: 5 }, 'auxiliar'), {
      name: 'contador-casos',
      query: { casoId: '5' },
    })
  })
})

describe('rol auxiliar: pantallas', () => {
  const layout = leer('../src/layouts/MaquetaLayout.vue')
  const resumen = leer('../src/pages/ContadorDashboardPage.vue')
  const alta = leer('../src/components/NewUserDialog.vue')
  const directorio = leer('../src/pages/CountersDirectoryPage.vue')

  it('el menú muestra «Mi trabajo» y la campana a quien trabaja casos; auxiliares y auditorías solo al contador', () => {
    assert.match(layout, /<template v-if="session\.trabajaCasos">/)
    assert.equal((layout.match(/<CampanaAvisos v-if="session\.veCampana"/g) ?? []).length, 2)
    const miTrabajo = layout.slice(layout.indexOf('<template v-if="session.trabajaCasos">'))
    assert.match(miTrabajo, /v-if="session\.esContador"[\s\S]*?name: 'contador-auxiliares'/)
    assert.match(miTrabajo, /v-if="session\.esContador"[\s\S]*?name: 'auditorias'/)
  })

  it('«Mi resumen» oculta la pestaña de auditorías al auxiliar', () => {
    assert.match(resumen, /<q-tab v-if="session\.esContador" name="auditorias"/)
    assert.match(resumen, /\.\.\.\(session\.esContador \? \['auditorias'\] : \[\]\)/)
    assert.match(resumen, /<q-tab-panel v-if="session\.esContador" name="auditorias"/)
  })

  it('el alta explica el rol auxiliar y el directorio permite filtrarlo', () => {
    assert.match(alta, /Auxiliar apoya a un contador/)
    assert.match(directorio, /PROFILES\.auxiliar/)
  })
})
