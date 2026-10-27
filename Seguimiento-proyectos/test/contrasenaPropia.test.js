// Pruebas estáticas de la contraseña propia tras el primer inicio de sesión (rebanada 2):
// la página, su ruta, el guard del router y el aviso en los diálogos del administrador.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => (existsSync(ruta(relativa)) ? readFileSync(ruta(relativa), 'utf8') : '')

describe('Página «Crea tu contraseña»', () => {
  const pagina = leer('../src/pages/CambiarContrasenaPage.vue')
  const plantilla = pagina.split('<script')[0]

  it('existe y usa el mismo logo y tarjeta que el login', () => {
    assert.ok(pagina, 'existe pages/CambiarContrasenaPage.vue')
    assert.match(plantilla, /<q-img[^>]*src="logos\/PNG\/DELGROW_LOGO-OF\.png"/)
    assert.match(plantilla, /<h1[^>]*>Crea tu contraseña<\/h1>/)
  })

  it('pide la contraseña nueva y su confirmación, cada una con su botón de ojo', () => {
    assert.match(plantilla, /label="Contraseña nueva"/)
    assert.match(plantilla, /label="Confirmar contraseña"/)
    assert.equal((plantilla.match(/autocomplete="new-password"/g) ?? []).length, 2)
    assert.match(plantilla, /:type="verNueva \? 'text' : 'password'"/)
    assert.match(plantilla, /:type="verConfirmacion \? 'text' : 'password'"/)
    assert.equal((plantilla.match(/:aria-pressed="ver(Nueva|Confirmacion)"/g) ?? []).length, 2)
  })

  it('valida con reglas de Quasar que usan validarContrasenaNueva, sin errores puestos a mano', () => {
    const nueva = plantilla.slice(plantilla.indexOf('ref="nuevaInput"'), plantilla.indexOf('</q-input>'))
    const confirmacion = plantilla.slice(plantilla.indexOf('ref="confirmacionInput"'))
    assert.match(nueva, /:rules="\[reglaNueva\]"/)
    assert.match(nueva, /\blazy-rules\b/, 'la nueva se revisa al salir del campo')
    assert.match(confirmacion, /:rules="\[reglaConfirmacion\]"/)
    assert.doesNotMatch(confirmacion.split('</q-input>')[0], /lazy-rules/, 'la confirmación se revisa mientras se escribe')
    assert.doesNotMatch(plantilla, /:error="|:error-message="/, 'los errores los pone QInput con sus reglas')
    assert.match(pagina, /validarContrasenaNueva\(/)
  })

  it('la confirmación usa una regla asíncrona (Promise) y se vuelve a validar si cambia la nueva', () => {
    assert.match(pagina, /const reglaConfirmacion = \(valor\) =>\s*new Promise\(/)
    assert.match(pagina, /watch\(\s*\(\) => form\.nueva,[\s\S]*?confirmacionInput\.value\?\.validate\(\)/)
  })

  it('muestra visualmente cuando las contraseñas coinciden', () => {
    assert.match(plantilla, /<q-icon[^>]*v-if="coinciden"[^>]*name="check_circle"[^>]*aria-label="Las contraseñas coinciden"/)
    assert.match(plantilla, /:hint="coinciden \? 'Las contraseñas coinciden\.' : undefined"/)
  })

  it('guarda con crearContrasenaPropia', () => {
    assert.match(pagina, /sesion\.crearContrasenaPropia\(/)
    assert.match(plantilla, /<q-form[^>]*novalidate[^>]*@submit="guardar"/)
    assert.match(plantilla, /:label="guardando \? 'Guardando…' : 'Guardar contraseña'"/)
  })

  it('al guardar avisa y abre la pantalla del perfil; también permite cerrar sesión', () => {
    assert.match(pagina, /\$q\.notify\(\{[\s\S]*?Contraseña actualizada/)
    assert.match(pagina, /router\.replace\(resultado\.pantallaPrincipal\)/)
    assert.match(plantilla, /label="Cerrar sesión"/)
    assert.match(pagina, /sesion\.cerrarSesionVoluntaria\(\)/)
  })

  it('muestra el error del servidor en un aviso con role="alert"', () => {
    assert.match(plantilla, /<q-banner v-if="errorServidor"[^>]*role="alert"/)
  })
})

describe('Ruta y guard de la contraseña propia', () => {
  const router = leer('../src/router/index.js')

  it('la ruta /cambiar-contrasena usa el layout del login y requiere sesión', () => {
    assert.match(router, /import CambiarContrasenaPage from '\.\.\/pages\/CambiarContrasenaPage\.vue'/)
    assert.match(
      router,
      /path: '\/cambiar-contrasena',\s*component: LoginLayout,[\s\S]*?name: 'cambiar-contrasena',\s*component: CambiarContrasenaPage/,
    )
  })

  it('con la marca solo deja ir a crear la contraseña o al login; sin ella, la ruta lleva a la pantalla del perfil', () => {
    assert.match(router, /sesion\.debeCambiarContrasena && !\['cambiar-contrasena', 'login'\]\.includes\(to\.name\)/)
    assert.match(router, /to\.name === 'cambiar-contrasena' && !sesion\.debeCambiarContrasena/)
  })

  it('al recargar en el login con la marca se va a crear la contraseña', () => {
    assert.match(router, /resultado\.estado === 'valida' && to\.name === 'login'[\s\S]*?resultado\.pantallaPrincipal/)
  })
})

describe('Aviso al administrador en el alta y el restablecimiento', () => {
  for (const dialogo of ['NewUserDialog.vue', 'ResetPasswordDialog.vue']) {
    it(`${dialogo} avisa que la persona creará su propia contraseña al entrar`, () => {
      assert.match(
        leer(`../src/components/${dialogo}`),
        /Al menos 8 caracteres\. La persona creará su propia contraseña al entrar\./,
      )
    })
  }
})
