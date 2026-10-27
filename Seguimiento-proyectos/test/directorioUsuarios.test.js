/*
 * Directorio de usuarios — verificación estática de las rebanadas 3 en adelante.
 * No monta Vue; comprueba cadenas clave del diálogo y de la pantalla del directorio.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'fs'
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
    // Los avisos son notificaciones de Quasar que se van solas: ya no hay aviso fijo que ocultar.
    assert.doesNotMatch(pagina, /mensajeExito/, 'sin el aviso fijo anterior')
    assert.match(pagina, /<NewUserDialog v-if="session\.esUsuarioSistema" v-model="dialogoNuevoAbierto"/)
  })

  it('al crear la cuenta el directorio avisa y recarga la tabla', () => {
    assert.match(pagina, /@creado="alCrearUsuario"/)
    const alCrear = pagina.slice(pagina.indexOf('const alCrearUsuario'), pagina.indexOf('\nconst ', pagina.indexOf('const alCrearUsuario') + 1))
    assert.match(alCrear, /\$q\.notify\(\{ type: 'positive', message: mensaje \}\)/)
    assert.match(alCrear, /cargar\(\)/)
  })
})

describe('Directorio de usuarios (rebanada 4: «Restablecer contraseña» por fila)', () => {
  const dialogo = read('../src/components/ResetPasswordDialog.vue')
  const pagina = read('../src/pages/CountersDirectoryPage.vue')
  const enviar = dialogo.slice(dialogo.indexOf('const restablecer = async'), dialogo.indexOf('</script>'))

  it('muestra la cuenta de solo lectura y solo pide la contraseña nueva', () => {
    const etiquetas = [...dialogo.matchAll(/class="form-label"\s*>([^<]+)</g)].map((m) => m[1].trim())
    assert.deepEqual(etiquetas, ['Contraseña nueva'])
    assert.match(dialogo, /\{\{ cuenta\?\.nombre \}\}/, 'nombre de la cuenta')
    assert.match(dialogo, /\{\{ cuenta\?\.correo \}\}/, 'correo de la cuenta')
    assert.doesNotMatch(dialogo, /v-model="correo"/, 'el correo no se edita')
  })

  it('valida solo la contraseña nueva antes de enviar; el correo guardado lo valida el backend', () => {
    assert.match(enviar, /validarRestablecimiento\(props\.cuenta\.correo, password\.value\)/)
    assert.ok(
      enviar.indexOf('if (validacion.errores.password) return') < enviar.indexOf('restablecerContrasena('),
      'con la contraseña inválida no se envía',
    )
    // Un correo guardado que no pase la regla del formulario no debe bloquear la cuenta.
    assert.doesNotMatch(enviar, /validacion\.valido|errores\.correo|no es válido/)
    assert.match(enviar, /restablecerContrasena\(\{\s*correo: props\.cuenta\.correo,/)
  })

  it('no se cierra mientras guarda; al terminar se cierra y avisa a la pantalla', () => {
    assert.match(dialogo, /<q-dialog v-model="dialogoAbierto" :persistent="guardando"/)
    assert.match(enviar, /dialogoAbierto\.value = false\s*\n\s*emit\('restablecida', mensaje\)/)
    assert.match(dialogo, /label="Cancelar"/)
    assert.match(dialogo, /aria-labelledby="restablecer-titulo"/)
  })

  it('con la cuenta propia cierra la sesión y lleva al login', () => {
    assert.match(
      enviar,
      /if \(cuentaPropia\) \{\s*session\.cerrarSesionPorContrasenaNueva\(\)\s*await router\.replace\(\{ name: 'login' \}\)/,
    )
  })

  it('el botón de cada fila y tarjeta solo lo ve el usuario de sistema', () => {
    const botones = [...pagina.matchAll(/<q-btn\s[^>]*?label="Restablecer contraseña"[\s\S]*?<\/q-btn>/g)].map((m) => m[0])
    assert.equal(botones.length, 2, 'tabla y tarjetas')
    for (const boton of botones) {
      assert.match(boton, /v-if="session\.esUsuarioSistema"/)
      assert.match(boton, /@click="abrirRestablecer\(props\.row\)"/)
      assert.match(boton, /<q-tooltip>/)
    }
    assert.match(
      pagina,
      /<ResetPasswordDialog\s+v-if="session\.esUsuarioSistema"\s+v-model="dialogoRestablecerAbierto"\s+:cuenta="cuentaRestablecer"\s+@restablecida="alRestablecer"/,
    )
  })
})

describe('Directorio de usuarios (rebanada 5: se retiran las pantallas viejas de alta y restablecer)', () => {
  const rutas = read('../src/router/index.js')
  const menu = read('../src/layouts/MaquetaLayout.vue')
  const existe = (p) => existsSync(fileURLToPath(new URL(p, import.meta.url)))

  it('las pantallas viejas ya no existen ni se importan', () => {
    assert.equal(existe('../src/pages/NewUserPage.vue'), false, 'se retiró la pantalla de alta')
    assert.equal(existe('../src/pages/ResetPasswordPage.vue'), false, 'se retiró la pantalla de restablecer')
    assert.doesNotMatch(rutas, /NewUserPage|ResetPasswordPage/)
  })

  it('las direcciones viejas redirigen al directorio', () => {
    for (const path of ['usuarios/alta', 'usuarios/restablecer-contrasena']) {
      const inicio = rutas.indexOf(`path: '${path}'`)
      assert.ok(inicio >= 0, `falta la dirección ${path}`)
      const ruta = rutas.slice(inicio, rutas.indexOf('}', rutas.indexOf('redirect', inicio)) + 1)
      assert.match(ruta, /redirect: \{ name: 'admin-directorio' \}/, `${path} lleva al directorio`)
    }
  })

  it('la sección «Usuarios» del menú solo tiene «Directorio»', () => {
    const inicio = menu.indexOf('<template v-if="session.esUsuarioSistema">')
    const seccion = menu.slice(inicio, menu.indexOf('</template>', inicio))
    const destinos = [...seccion.matchAll(/:to="\{ name: '([^']+)' \}"/g)].map((m) => m[1])
    assert.deepEqual(destinos, ['admin-directorio'])
  })
})

describe('Directorio de usuarios (revisión): diálogos accesibles y texto del menú', () => {
  const menu = read('../src/layouts/MaquetaLayout.vue')

  for (const [archivo, id] of [
    ['NewUserDialog', 'nuevo-usuario-titulo'],
    ['ResetPasswordDialog', 'restablecer-titulo'],
  ]) {
    it(`${archivo}: el nombre accesible va en el q-dialog y la tarjeta no repite role ni aria-modal`, () => {
      const dialogo = read(`../src/components/${archivo}.vue`)
      const etiqueta = (nombre) => {
        const inicio = dialogo.indexOf(`<${nombre}`)
        return dialogo.slice(inicio, dialogo.indexOf('>', inicio) + 1)
      }

      assert.match(etiqueta('q-dialog'), new RegExp(`aria-labelledby="${id}"`))
      assert.doesNotMatch(etiqueta('q-card'), /role=|aria-modal|aria-labelledby/)
    })
  }

  it('las dos opciones «Directorio» del menú se llaman igual que la pantalla: directorio de usuarios', () => {
    assert.doesNotMatch(menu, /directorio de contadores|Elegir contador/)
    const opciones = [...menu.matchAll(/aria-label="Ir al directorio de usuarios"/g)]
    assert.equal(opciones.length, 2, 'administrador y usuario de sistema')
  })
})

describe('Directorio de usuarios: filtros de búsqueda y rol', () => {
  const pagina = read('../src/pages/CountersDirectoryPage.vue')
  const plantilla = pagina.split('<script')[0]

  it('tiene buscador por nombre o correo con lupa, ✕ para borrar y tooltip', () => {
    const buscador = plantilla.slice(plantilla.indexOf('v-model="filtros.texto"'), plantilla.indexOf('</q-input>'))
    assert.match(buscador, /label="Buscar por nombre o correo"/)
    assert.match(buscador, /\bclearable\b/)
    assert.match(buscador, /debounce="300"/)
    assert.match(buscador, /<q-icon name="search"/)
    assert.match(buscador, /<q-tooltip>/)
  })

  it('tiene lista de rol con «Todos los roles» y los tres roles', () => {
    assert.match(plantilla, /<q-select[^>]*v-model="filtros\.rol"[^>]*:options="OPCIONES_ROL"/)
    for (const texto of ['Todos los roles', 'Administrador', 'Contador', 'Usuario de sistema']) {
      assert.ok(pagina.includes(`label: '${texto}'`), texto)
    }
  })

  it('la tabla muestra las filas filtradas y avisa cuando nada coincide', () => {
    assert.match(pagina, /const filasFiltradas = computed\(\(\) =>\s*filtrarUsuarios\(filas\.value, \{/)
    assert.match(pagina, /rol: filtros\.value\.rol === TODOS_LOS_ROLES \? null : filtros\.value\.rol/)
    assert.match(plantilla, /:rows="filasFiltradas"/)
    assert.match(plantilla, /no-data-label="Ningún usuario coincide con los filtros\."/)
  })

  it('muestra cuántas cuentas se ven y «Limpiar filtros» solo con filtros activos', () => {
    assert.match(plantilla, /Mostrando \{\{ filasFiltradas\.length \}\} de \{\{ filas\.length \}\} cuentas/)
    assert.match(plantilla, /<q-btn[^>]*v-if="hayFiltros"[^>]*label="Limpiar filtros"/)
  })

  it('al cambiar un filtro vuelve a la página 1', () => {
    assert.match(pagina, /watch\(\s*filtros,[\s\S]*?paginacion\.value\.page = 1/)
  })
})
