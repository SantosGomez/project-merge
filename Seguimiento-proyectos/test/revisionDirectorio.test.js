// Revisión de UI, rebanada 8 («Directorio de usuarios»): textos (A), diálogos que no pierden lo
// escrito y contraseña visible (B), accesibilidad y paleta (C), movimiento (D).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { textoUltimoAcceso, usuarioAFila } from '../src/utils/filasVista.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]
const scriptDe = (fuente) => fuente.slice(fuente.indexOf('<script'), fuente.indexOf('<style'))
const estilosDe = (fuente) => fuente.slice(fuente.indexOf('<style'))

const pagina = leer('../src/pages/CountersDirectoryPage.vue')
const alta = leer('../src/components/NewUserDialog.vue')
const restablecer = leer('../src/components/ResetPasswordDialog.vue')

describe('A: textos', () => {
  it('«Último acceso» se lee DD-MM-AAAA HH:mm y «Aún no ha entrado»; el orden sigue igual', () => {
    assert.equal(textoUltimoAcceso('2026-11-09 10:22:33'), '09-11-2026 10:22')
    assert.equal(textoUltimoAcceso(null), 'Aún no ha entrado')
    const fila = usuarioAFila({ id: 1, nombre: 'A', correo: 'a@b.mx', rol: 'contador', ultimo_acceso_en: null })
    assert.equal(fila.ultimoAccesoTexto, 'Aún no ha entrado')
    assert.match(plantillaDe(pagina), /\{\{ props\.row\.ultimoAccesoTexto \}\}/)
    assert.match(scriptDe(pagina), /format: \(_valor, fila\) => fila\.ultimoAccesoTexto/)
  })

  it('«Ver casos importantes», ayuda clara y plurales', () => {
    const plantilla = plantillaDe(pagina)
    assert.match(plantilla, /label="Ver casos importantes"/)
    assert.doesNotMatch(plantilla, /No hay conteos ni casos aquí/)
    assert.match(plantilla, /filas\.length === 1 \? 'cuenta' : 'cuentas'/)
    assert.match(plantilla, /Ninguna cuenta coincide con la búsqueda o el rol elegidos\./)
  })

  it('el correo repetido y la cuenta que ya no existe se explican en tú', () => {
    assert.match(alta, /Ese correo ya tiene una cuenta\. Usa otro o restablece la contraseña de esa cuenta\./)
    assert.match(restablecer, /Esta cuenta ya no existe; puede que otra persona la haya borrado\./)
    assert.match(restablecer, /emit\('cuenta-inexistente'\)/)
  })

  it('avisos de éxito con el nombre de la cuenta', () => {
    assert.ok(pagina.includes('`Cuenta de ${nombre} creada. Comparte la contraseña temporal por un medio seguro.`'))
    assert.ok(pagina.includes('`Contraseña de ${nombre} restablecida; sus sesiones abiertas se cerraron.`'))
  })

  it('una sola ayuda de contraseña y aviso al restablecer la propia cuenta', () => {
    for (const fuente of [alta, restablecer]) {
      assert.match(fuente, /Es temporal: al iniciar sesión, la persona tendrá que cambiarla por la suya\./)
      assert.doesNotMatch(fuente, /compártela con la persona por un medio seguro\.<\/q-tooltip>/)
    }
    assert.match(plantillaDe(restablecer), /Es tu propia cuenta: al guardar se cerrará tu sesión/)
  })
})

describe('B: comportamiento', () => {
  for (const [nombre, fuente] of [['alta', alta], ['restablecer', restablecer]]) {
    it(`${nombre}: no pierde lo escrito y lleva el foco al primer campo y al primer error`, () => {
      const plantilla = plantillaDe(fuente)
      assert.match(plantilla, /:persistent="guardando \|\| hayDatosSinGuardar"/)
      assert.match(plantilla, /@shake="pedirDescartar"/)
      assert.match(plantilla, /@show="enfocarPrimerCampo"/)
      assert.match(scriptDe(fuente), /¿Descartar los cambios\?/)
      assert.match(scriptDe(fuente), /enfocarPrimerError\(\)/)
      assert.match(plantilla, /label="Cancelar"[\s\S]*?@click="cerrar"/)
    })

    it(`${nombre}: la contraseña se puede mostrar y copiar`, () => {
      const plantilla = plantillaDe(fuente)
      assert.match(plantilla, /:type="verPassword \? 'text' : 'password'"/)
      assert.match(plantilla, /:aria-pressed="verPassword \? 'true' : 'false'"/)
      assert.match(plantilla, /aria-label="Copiar contraseña"/)
      assert.match(scriptDe(fuente), /copyToClipboard\(password\.value\)/)
    })
  }

  it('solo el correo repetido va bajo «Correo»; otros errores del servidor van al aviso general', () => {
    assert.match(scriptDe(alta), /\/ya existe\/i\.test\(error\?\.mensaje/)
  })

  it('la lista se refresca en silencio al crear cuentas y al volver a la ventana', () => {
    const script = scriptDe(pagina)
    assert.match(script, /const refrescar = async/)
    assert.match(script, /addEventListener\('visibilitychange', alVolver\)/)
    assert.match(script, /removeEventListener\('visibilitychange', alVolver\)/)
    const alCrear = script.slice(script.indexOf('const alCrearUsuario'), script.indexOf('const alVolver'))
    assert.match(alCrear, /refrescar\(\{ avisarFallo: true \}\)/)
    assert.doesNotMatch(alCrear, /\bcargar\(\)/)
  })

  it('sin restos de la maqueta (carga simulada y selección duplicada)', () => {
    assert.doesNotMatch(pagina, /useMaquetaStore|startScreenLoad|maqueta\./)
  })
})

describe('C: accesibilidad y paleta', () => {
  it('el nombre accesible de cada botón contiene su texto visible', () => {
    const plantilla = plantillaDe(pagina)
    assert.match(plantilla, /:aria-label="`Ver casos importantes de \$\{props\.row\.nombre\}`"/)
    assert.match(plantilla, /:aria-label="`Restablecer contraseña de \$\{props\.row\.nombre\}`"/)
    assert.doesNotMatch(plantilla, /Ver los casos de|Restablecer la contraseña de/)
  })

  it('botones de 44 px, sin hexadecimales, paginación de 10 y roles escritos en un solo lugar', () => {
    const plantilla = plantillaDe(pagina)
    const botones = plantilla.split('<q-btn').slice(1).map((b) => b.slice(0, b.indexOf('>')))
    for (const b of botones) assert.doesNotMatch(b, /\bdense\b/)
    assert.doesNotMatch(estilosDe(pagina), /#[0-9a-fA-F]{3,6}\b/)
    assert.match(scriptDe(pagina), /const paginacion = ref\(\{ rowsPerPage: 10 \}\)/)
    assert.match(scriptDe(pagina), /formatearRol\(/)
  })

  it('asterisco e iconos decorativos ocultos al lector; carga con esqueleto anunciada', () => {
    for (const fuente of [alta, restablecer]) {
      assert.doesNotMatch(fuente, /aria-label="obligatorio"/)
      assert.match(plantillaDe(fuente), /<span aria-hidden="true" class="required-mark">\*<\/span>/)
    }
    assert.doesNotMatch(plantillaDe(alta), /<q-icon name="(person|email|lock|badge)" \/>/)
    assert.match(plantillaDe(pagina), /role="status"[\s\S]*?<q-skeleton/)
  })
})

describe('D: movimiento', () => {
  for (const [nombre, fuente] of [['alta', alta], ['restablecer', restablecer]]) {
    it(`${nombre}: entra y sale como los demás diálogos y sus botones responden al presionar`, () => {
      const plantilla = plantillaDe(fuente)
      assert.match(plantilla, /transition-show="dialogo-entra"\s+transition-hide="dialogo-sale"/)
      assert.match(plantilla, /type="submit"[\s\S]*?class="control-touch boton-presionable"/)
    })
  }

  it('«Nuevo usuario» responde al presionar', () => {
    assert.match(plantillaDe(pagina), /label="Nuevo usuario"[\s\S]*?class="control-touch boton-presionable"/)
  })
})
