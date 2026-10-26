/*
 * Directorio de usuarios — verificación estática de las rebanadas 3 en adelante.
 * No monta Vue; comprueba cadenas clave del diálogo y de la pantalla del directorio.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

describe('Directorio de usuarios (rebanada 3: «Nuevo usuario» en diálogo)', () => {
  const dialogo = read('../src/components/NewUserDialog.vue')
  const pagina = read('../src/pages/CountersDirectoryPage.vue')

  it('el diálogo pide los campos de la tabla usuarios, en orden', () => {
    const etiquetas = [...dialogo.matchAll(/class="form-label"\s*>([^<]+)</g)].map((m) => m[1].trim())
    assert.deepEqual(etiquetas, ['Nombre', 'Correo', 'Contraseña', 'Rol'])
    assert.match(dialogo, /v-model="correo"[\s\S]*?type="email"/, 'el correo abre el teclado de correo')
  })

  it('valida antes de enviar y el correo repetido sale bajo Correo', () => {
    const enviar = dialogo.slice(dialogo.indexOf('const darDeAlta = async'), dialogo.indexOf('</script>'))
    assert.match(enviar, /validarAltaUsuario\(nombre\.value, correo\.value, password\.value, rol\.value\)/)
    assert.ok(
      enviar.indexOf('if (!validacion.valido) return') < enviar.indexOf('crearUsuario('),
      'con errores no se envía',
    )
    assert.match(enviar, /error\?\.codigoHttp === 400[\s\S]*?errores\.correo = error\.mensaje/, 'el 400 va bajo Correo')
  })

  it('no se cierra mientras guarda; al crear se cierra y avisa a la pantalla', () => {
    assert.match(dialogo, /<q-dialog v-model="dialogoAbierto" :persistent="guardando"/)
    const enviar = dialogo.slice(dialogo.indexOf('const darDeAlta = async'), dialogo.indexOf('</script>'))
    assert.match(enviar, /dialogoAbierto\.value = false\s*\n\s*emit\('creado', mensaje\)/, 'cierra y emite')
  })

  it('el diálogo tiene nombre accesible y botón Cancelar', () => {
    assert.match(dialogo, /aria-labelledby="nuevo-usuario-titulo"/)
    assert.match(dialogo, /id="nuevo-usuario-titulo"/)
    assert.match(dialogo, /label="Cancelar"/)
  })

  it('el directorio muestra «Nuevo usuario» solo al usuario de sistema', () => {
    const inicio = pagina.indexOf('label="Nuevo usuario"')
    assert.ok(inicio >= 0, 'falta el botón')
    const boton = pagina.slice(pagina.lastIndexOf('<q-btn', inicio), pagina.indexOf('</q-btn>', inicio))
    assert.match(boton, /v-if="session\.esUsuarioSistema"/)
    assert.match(boton, /<q-tooltip>/)
    assert.match(boton, /@click="abrirNuevoUsuario"/)
    const abrir = pagina.slice(pagina.indexOf('const abrirNuevoUsuario'), pagina.indexOf('\n}', pagina.indexOf('const abrirNuevoUsuario')))
    assert.match(abrir, /mensajeExito\.value = ''/, 'el aviso de la alta anterior se oculta')
    assert.match(pagina, /<NewUserDialog v-if="session\.esUsuarioSistema" v-model="dialogoNuevoAbierto"/)
  })

  it('al crear la cuenta el directorio avisa y recarga la tabla', () => {
    assert.match(pagina, /@creado="alCrearUsuario"/)
    const alCrear = pagina.slice(pagina.indexOf('const alCrearUsuario'), pagina.indexOf('\nconst ', pagina.indexOf('const alCrearUsuario') + 1))
    assert.match(alCrear, /mensajeExito\.value = mensaje/)
    assert.match(alCrear, /cargar\(\)/)
  })
})
