// Rebanada 07: cambiar mi contraseña desde «Mi perfil» escribiendo la actual
// (PATCH /auth/mi-contrasena). Las contraseñas de estas pruebas son valores inventados.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { crearAuthService } from '../src/services/authService.js'
import { validarCambioContrasenaPropia } from '../src/utils/validators.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const dialogo = leer('../src/components/CambiarContrasenaDialog.vue')
const plantilla = dialogo.split('<script')[0]
const pagina = leer('../src/pages/ContadorAuxiliaresPage.vue')
const plantillaPagina = pagina.split('<script')[0]

const claves = []
const almacenFalso = () => ({
  getItem: () => null,
  setItem: (clave) => claves.push(clave),
  removeItem: () => {},
})

describe('authService.cambiarMiContrasena', () => {
  it('envía PATCH /auth/mi-contrasena con la actual y la nueva', async () => {
    const llamadas = []
    const api = { patch: async (url, cuerpo) => { llamadas.push([url, cuerpo]); return { data: { mensaje: 'ok' } } } }
    const servicio = crearAuthService({ api, almacen: almacenFalso() })

    await servicio.cambiarMiContrasena({ passwordActual: 'actual-x1', password: 'nueva-y2' })

    assert.deepEqual(llamadas, [['/auth/mi-contrasena', { password_actual: 'actual-x1', password: 'nueva-y2' }]])
  })

  it('no toca la sesión guardada', async () => {
    claves.length = 0
    const api = { patch: async () => ({ data: {} }) }
    const servicio = crearAuthService({ api, almacen: almacenFalso() })

    await servicio.cambiarMiContrasena({ passwordActual: 'actual-x1', password: 'nueva-y2' })

    assert.deepEqual(claves, [])
  })

  it('propaga el error normalizado', async () => {
    const error = { estado: 'cliente', mensaje: 'Contraseña actual incorrecta sobre contraseña actual: revisa', codigoHttp: 400 }
    const api = { patch: async () => { throw error } }
    const servicio = crearAuthService({ api, almacen: almacenFalso() })

    await assert.rejects(() => servicio.cambiarMiContrasena({ passwordActual: 'a', password: 'b' }), error)
  })
})

describe('validarCambioContrasenaPropia', () => {
  it('acepta actual, nueva de 8 o más distinta y confirmación igual', () => {
    const { valido, errores } = validarCambioContrasenaPropia('actual-x1', 'nueva-y2z', 'nueva-y2z')
    assert.equal(valido, true)
    assert.deepEqual(errores, { actual: null, nueva: null, confirmacion: null })
  })

  it('los tres campos son obligatorios', () => {
    const { valido, errores } = validarCambioContrasenaPropia('', '', '')
    assert.equal(valido, false)
    assert.ok(errores.actual && errores.nueva && errores.confirmacion)
  })

  it('la nueva necesita 8 caracteres', () => {
    assert.ok(validarCambioContrasenaPropia('actual-x1', 'corta', 'corta').errores.nueva)
  })

  it('la nueva no puede ser igual a la actual', () => {
    const { valido, errores } = validarCambioContrasenaPropia('misma-clave1', 'misma-clave1', 'misma-clave1')
    assert.equal(valido, false)
    assert.ok(errores.nueva)
  })

  it('la confirmación debe coincidir', () => {
    const { valido, errores } = validarCambioContrasenaPropia('actual-x1', 'nueva-y2z', 'nueva-otra')
    assert.equal(valido, false)
    assert.ok(errores.confirmacion)
  })
})

describe('«Mi cuenta»: botón «Cambiar contraseña»', () => {
  it('está en la sección «Mi cuenta», con tooltip, y abre el diálogo', () => {
    const cuenta = plantillaPagina.slice(0, plantillaPagina.indexOf('Mis auxiliares'))
    assert.match(cuenta, /label="Cambiar contraseña"/)
    assert.match(cuenta, /<q-btn[^>]*label="Cambiar contraseña"[\s\S]*?<q-tooltip>[^<]+<\/q-tooltip>/)
    assert.match(plantillaPagina, /<CambiarContrasenaDialog\s+v-model="dialogoContrasenaAbierto"/)
    assert.match(pagina, /import CambiarContrasenaDialog from '..\/components\/CambiarContrasenaDialog\.vue'/)
  })
})

describe('CambiarContrasenaDialog', () => {
  it('tiene los tres campos con su etiqueta, asterisco aria-hidden y `label for`', () => {
    for (const etiqueta of ['Contraseña actual', 'Contraseña nueva', 'Confirma la contraseña nueva']) {
      assert.ok(plantilla.includes(etiqueta), `falta ${etiqueta}`)
    }
    assert.equal((plantilla.match(/<label for="/g) ?? []).length, 3)
    assert.equal((plantilla.match(/class="required-mark"/g) ?? []).length, 3)
    assert.match(plantilla, /aria-hidden="true" class="required-mark"/)
  })

  it('cada campo usa input-moderno, tiene su botón mostrar/ocultar y el autocomplete correcto', () => {
    assert.equal((plantilla.match(/class="input-moderno"/g) ?? []).length, 3)
    assert.equal((plantilla.match(/autocomplete="current-password"/g) ?? []).length, 1)
    assert.equal((plantilla.match(/autocomplete="new-password"/g) ?? []).length, 2)
    assert.equal((plantilla.match(/'Mostrar contraseña'/g) ?? []).length >= 3, true)
  })

  it('sigue el patrón de formularios en diálogo', () => {
    assert.match(plantilla, /:persistent="guardando \|\| hayDatosSinGuardar"/)
    assert.match(plantilla, /@shake="pedirDescartar"/)
    assert.match(plantilla, /transition-show="dialogo-entra"/)
    assert.match(plantilla, /transition-hide="dialogo-sale"/)
    assert.match(dialogo, /¿Descartar los cambios\?/)
    assert.match(dialogo, /erroresCampo/)
    assert.match(dialogo, /enfocarPrimerError/)
    assert.match(dialogo, /hayDatosSinGuardar = computed/)
  })

  it('valida antes de enviar y avisa «Contraseña actualizada.»', () => {
    assert.match(dialogo, /validarCambioContrasenaPropia/)
    assert.match(dialogo, /cambiarMiContrasena/)
    assert.match(dialogo, /Contraseña actualizada\./)
  })

  it('un error del servidor se muestra en su campo y lo escrito se conserva', () => {
    assert.match(dialogo, /campoDelError/)
    assert.match(dialogo, /contraseña actual/)
    const bloqueCatch = dialogo.slice(dialogo.indexOf('} catch'), dialogo.indexOf('} finally'))
    assert.match(bloqueCatch, /campoDelError/, 'se localizó el catch de guardar')
    assert.doesNotMatch(bloqueCatch, /form\.(actual|nueva|confirmacion)\s*=(?!=)/)
  })

  it('valida y envía la actual y la nueva recortadas, los mismos valores', () => {
    assert.match(dialogo, /const actual = form\.actual\.trim\(\)/)
    assert.match(dialogo, /const nueva = form\.nueva\.trim\(\)/)
    assert.match(dialogo, /const confirmacion = form\.confirmacion\.trim\(\)/)
    assert.match(dialogo, /validarCambioContrasenaPropia\(actual, nueva, confirmacion\)/)
    assert.match(dialogo, /cambiarMiContrasena\(\{\s*passwordActual: actual,\s*password: nueva\s*\}\)/)
  })

  it('no escribe contraseñas literales', () => {
    assert.doesNotMatch(dialogo, /\b(password|passwordActual|contrasena)\s*[:=]\s*'[^']{4,}'/i)
  })
})
