// Rol recepcionista (rebanada 20, 2026-11-18): entra a la app, consulta el directorio en solo
// lectura y no ve nada de casos, auditorías ni avisos. Se da de alta desde el directorio.
// Su pantalla principal es el calendario «Juntas» (rebanada 21b); el directorio sigue en su menú.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { PROFILES, RUTA_PRINCIPAL_POR_ROL } from '../src/utils/constants.js'
import { formatearRol } from '../src/utils/formateadores.js'
import { decidirAcceso } from '../src/utils/accessRules.js'
import { validarAltaUsuario } from '../src/utils/validators.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

// `meta.perfil` de una ruta por su nombre, leído del router (importarlo arrastra los .vue).
const router = leer('../src/router/index.js')
const perfilDeRuta = (nombre) => {
  const bloque = router.slice(router.indexOf(`name: '${nombre}'`))
  const perfil = bloque.match(/perfil: (\[[^\]]*\]|PROFILES\.\w+)/)[1]
  return [...perfil.matchAll(/PROFILES\.(\w+)/g)].map(([, clave]) => PROFILES[clave])
}
const accesoDeLaRecepcionista = (nombre) =>
  decidirAcceso({
    ruta: { requiereSesion: true, perfil: perfilDeRuta(nombre) },
    sesion: { autenticado: true, rol: 'recepcionista' },
  }).accion

describe('rol recepcionista: datos y reglas', () => {
  it('existe como perfil, se muestra como «Recepcionista» y su pantalla principal es «Juntas»', () => {
    assert.equal(PROFILES.recepcionista, 'recepcionista')
    assert.equal(formatearRol('recepcionista'), 'Recepcionista')
    assert.equal(RUTA_PRINCIPAL_POR_ROL.recepcionista, '/juntas')
  })

  it('el alta de usuario acepta el rol recepcionista', () => {
    const { valido, errores } = validarAltaUsuario(
      'Rosa Recepción',
      'rosa@delgrow.mx',
      'Segura1234',
      'recepcionista',
    )
    assert.equal(errores.rol, null)
    assert.equal(valido, true)
  })

  it('entra al directorio y a «Juntas», y a ninguna otra pantalla con perfil', () => {
    assert.equal(accesoDeLaRecepcionista('admin-directorio'), 'permitir')
    assert.equal(accesoDeLaRecepcionista('juntas'), 'permitir')
    for (const nombre of [
      'admin-dashboard',
      'auditorias',
      'auditoria-ficha',
      'contador-casos',
      'contador-dashboard',
      'mi-perfil',
    ]) {
      assert.equal(accesoDeLaRecepcionista(nombre), 'denegar', nombre)
    }
  })
})

describe('rol recepcionista: pantallas', () => {
  const layout = leer('../src/layouts/MaquetaLayout.vue')
  const directorio = leer('../src/pages/CountersDirectoryPage.vue')
  const sesion = leer('../src/stores/session.js')

  it('la sesión la reconoce, le da campana de avisos (invitaciones a juntas) y no «Mis casos»', () => {
    assert.match(sesion, /esRecepcionista: \(state\) => state\.rol === 'recepcionista'/)
    assert.match(
      sesion,
      /veCampana: \(state\) =>\s+\['administrador', 'contador', 'auxiliar', 'recepcionista'\]\.includes\(state\.rol\)/,
    )
    assert.doesNotMatch(sesion, /trabajaCasos: [^\n]*recepcionista/)
  })

  it('el menú tiene la sección «Recepción» con los ítems «Mi Calendario» y «Directorio», sin tooltip', () => {
    const inicio = layout.indexOf('<template v-if="session.esRecepcionista">')
    assert.ok(inicio >= 0, 'falta la sección de la recepcionista')
    const seccion = layout.slice(inicio, layout.indexOf('</template>', inicio))
    assert.match(seccion, /<q-item-label header>Recepción<\/q-item-label>/)
    assert.match(seccion, /name: 'juntas'/)
    assert.match(seccion, /name: 'admin-directorio'/)
    assert.match(seccion, /Consultar cuentas del equipo/)
    assert.equal((seccion.match(/<q-item\s/g) ?? []).length, 2)
    assert.doesNotMatch(seccion, /q-tooltip/)
  })

  it('el directorio no le deja ningún botón de acción ni los textos de ayuda de otros roles', () => {
    // Los botones de gestión ya exigen usuario de sistema o administrador; los dos que no lo exigían se acotan.
    assert.match(
      directorio,
      /v-if="props\.row\.rolClave === 'auxiliar' && !session\.esRecepcionista"/,
    )
    assert.doesNotMatch(directorio, /v-if="props\.row\.rolClave === 'auxiliar'"/)
    assert.match(
      directorio,
      /<p v-else-if="session\.esUsuarioSistema" class="directory-panel__help">/,
    )
    assert.match(directorio, /<p v-else class="directory-panel__help">[\s\S]*?Consulta/)
    assert.match(directorio, /\(fila\.rolClave === 'auxiliar' && !session\.esRecepcionista\)/)
  })

  it('el alta explica qué hace el rol recepcionista', () => {
    assert.match(
      leer('../src/components/NewUserDialog.vue'),
      /Recepcionista consulta el directorio/,
    )
  })

  it('el filtro «Rol» del directorio ofrece «Recepcionista»', () => {
    assert.match(directorio, /PROFILES\.sistema, PROFILES\.recepcionista/)
  })
})
