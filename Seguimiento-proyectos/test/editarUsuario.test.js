// Editar una cuenta desde el directorio (2026-11-17): el mismo diálogo del alta sirve para
// editar con la prop `cuenta`, como CaseFormDialog.vue con `caso`. Nunca cambia la contraseña.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { crearUserService } from '../src/services/userService.js'
import { validarEdicionUsuario } from '../src/utils/validators.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

describe('servicio: actualizarUsuario', () => {
  const servicioQueGuarda = (cuerpos) =>
    crearUserService({
      api: {
        patch: async (ruta, cuerpo) => (
          cuerpos.push([ruta, cuerpo]),
          { data: { mensaje: 'Usuario actualizado correctamente', usuario: { id: 9, ...cuerpo } } }
        ),
      },
    })

  it('envía PATCH /usuarios/:id con el nombre recortado y el correo en minúsculas', async () => {
    const cuerpos = []
    const usuario = await servicioQueGuarda(cuerpos).actualizarUsuario(9, {
      nombre: '  Ana López ',
      correo: ' Ana@DelGrow.mx ',
      rol: 'contador',
    })
    assert.deepEqual(cuerpos, [
      ['/usuarios/9', { nombre: 'Ana López', correo: 'ana@delgrow.mx', rol: 'contador' }],
    ])
    assert.equal(usuario.nombre, 'Ana López')
  })

  it('manda el contador que apoya solo si queda como auxiliar y nunca una contraseña', async () => {
    const cuerpos = []
    const servicio = servicioQueGuarda(cuerpos)
    const base = { nombre: 'Ana', correo: 'ana@delgrow.mx', password: 'NoSeManda1' }
    await servicio.actualizarUsuario(9, { ...base, rol: 'auxiliar', contadores: [3] })
    await servicio.actualizarUsuario(9, { ...base, rol: 'auxiliar', contadores: [] })
    await servicio.actualizarUsuario(9, { ...base, rol: 'auxiliar' })
    await servicio.actualizarUsuario(9, { ...base, rol: 'contador', contadores: [3] })
    assert.deepEqual(cuerpos[0][1].contadores, [3])
    assert.deepEqual(cuerpos[1][1].contadores, [])
    assert.equal(
      'contadores' in cuerpos[2][1],
      false,
      'sin contadores cargados no se toca el vínculo',
    )
    assert.equal('contadores' in cuerpos[3][1], false)
    assert.ok(cuerpos.every(([, cuerpo]) => !('password' in cuerpo)))
  })
})

describe('validación de la edición', () => {
  it('exige nombre, correo válido y rol, sin contraseña', () => {
    const { valido, errores } = validarEdicionUsuario('  ', 'sin-arroba', 'jefe')
    assert.equal(valido, false)
    assert.deepEqual(errores, {
      nombre: 'nombre_requerido',
      correo: 'correo_invalido',
      rol: 'rol_requerido',
    })
  })

  it('acepta una cuenta completa', () => {
    assert.deepEqual(validarEdicionUsuario('Ana', 'ana@delgrow.mx', 'auxiliar'), {
      valido: true,
      errores: { nombre: null, correo: null, rol: null },
    })
  })
})

describe('diálogo: modo edición de NewUserDialog', () => {
  const dialogo = leer('../src/components/NewUserDialog.vue')

  it('recibe la cuenta a editar y cambia título, ayuda y botón', () => {
    assert.match(dialogo, /cuenta:\s*\{\s*type:\s*Object,\s*default:\s*null\s*\}/)
    assert.match(dialogo, /esEdicion\s*\?\s*'Editar usuario'\s*:\s*'Nuevo usuario'/)
    assert.match(dialogo, /esEdicion\s*\?\s*'Guardar cambios'\s*:\s*'Dar de alta'/)
    assert.match(dialogo, /restablecer/i, 'la ayuda de edición dice cómo cambiar la contraseña')
  })

  it('en edición no muestra la contraseña ni la envía', () => {
    assert.match(
      dialogo,
      /<div v-if="!esEdicion" class="form-group">\s*<label for="nuevo-password"/,
    )
    assert.match(dialogo, /actualizarUsuario\(props\.cuenta\.id,/)
    const llamada = /actualizarUsuario\(props\.cuenta\.id,[\s\S]*?\}\)/.exec(dialogo)[0]
    assert.doesNotMatch(llamada, /password/)
  })

  it('carga los datos de la cuenta y el contador que apoya al abrir', () => {
    assert.match(dialogo, /nombre\.value = props\.cuenta\.nombre/)
    assert.match(dialogo, /listarContadoresDeAuxiliar\(props\.cuenta\.id\)/)
  })

  it('solo pide confirmar al cerrar si algo cambió frente a lo cargado', () => {
    assert.match(dialogo, /const hayDatosSinGuardar = computed\(\(\) =>\s*esEdicion\.value\s*\?/)
    assert.match(dialogo, /originales\.value/)
  })

  it('no deja cambiar el rol propio ni elegir a la misma cuenta como su contador', () => {
    assert.match(dialogo, /:disable="guardando \|\| esCuentaPropia"/)
    assert.match(dialogo, /No puedes cambiar tu propio rol/)
    assert.match(dialogo, /props\.contadores\s*\.filter\(\(c\) => c\.id !== props\.cuenta\?\.id\)/)
  })

  it('lleva cada error del backend a su campo y avisa al terminar', () => {
    assert.match(dialogo, /emit\('actualizado'/)
    assert.match(dialogo, /sobre \(nombre\|correo\|rol\)/)
    assert.match(dialogo, /errores\[campo\] = mensaje\.replace\(` sobre \$\{campo\}: `, '\. '\)/)
  })
})

describe('directorio: botón «Editar»', () => {
  const directorio = leer('../src/pages/CountersDirectoryPage.vue')

  it('cada cuenta tiene «Editar» (tabla y tarjeta) solo para el usuario de sistema', () => {
    const botones = directorio.match(
      /<q-btn\s+v-if="session\.esUsuarioSistema"\s+flat\s+no-caps\s+color="primary"\s+icon="edit"\s+label="Editar"[\s\S]*?<\/q-btn>/g,
    )
    assert.equal(botones?.length, 2)
    for (const boton of botones) {
      assert.match(boton, /:aria-label="`Editar la cuenta de \$\{props\.row\.nombre\}`"/)
      assert.match(boton, /aria-haspopup="dialog"/)
      assert.match(boton, /@click="abrirEditar\(props\.row\)"/)
      assert.match(boton, /<q-tooltip>/)
    }
  })

  it('abre el mismo diálogo del alta con la cuenta elegida', () => {
    assert.match(
      directorio,
      /<NewUserDialog[^>]*:cuenta="cuentaEditar"[^>]*@actualizado="alActualizarUsuario"/,
    )
    assert.match(directorio, /const abrirNuevoUsuario = \(\) => \{\s*cuentaEditar\.value = null/)
  })
})
