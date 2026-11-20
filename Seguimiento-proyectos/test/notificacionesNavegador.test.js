// Notificaciones del navegador para los avisos nuevos (rebanada 40): la lógica vive en
// `utils/notificacionesNavegador.js` con la API Notification, el documento y el almacenamiento
// inyectados, así que se prueba sin navegador.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import {
  crearNotificadorNavegador,
  mensajeDeActivacion,
} from '../src/utils/notificacionesNavegador.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const aviso = (id, datos = {}) => ({
  id,
  mensaje: `Aviso ${id}`,
  leida: false,
  casoId: id,
  ...datos,
})

// Entorno falso: Notification registra cada notificación creada.
const crearEntorno = ({
  permiso = 'granted',
  visible = 'hidden',
  activado = true,
  respuesta,
} = {}) => {
  const creadas = []
  const pedidos = []
  class NotificacionFalsa {
    static permission = permiso
    static async requestPermission() {
      pedidos.push(true)
      NotificacionFalsa.permission = respuesta ?? permiso
      return NotificacionFalsa.permission
    }
    constructor(titulo, opciones) {
      this.titulo = titulo
      this.opciones = opciones
      this.cerrada = false
      creadas.push(this)
    }
    close() {
      this.cerrada = true
    }
  }
  const datos = new Map(activado ? [['avisosNavegador', '1']] : [])
  const almacenamiento = {
    getItem: (clave) => datos.get(clave) ?? null,
    setItem: (clave, valor) => datos.set(clave, valor),
    removeItem: (clave) => datos.delete(clave),
  }
  const documento = { visibilityState: visible }
  const enfocados = []
  const ventana = { focus: () => enfocados.push(true) }
  const clics = []
  const notificador = crearNotificadorNavegador({
    Notificacion: NotificacionFalsa,
    documento,
    almacenamiento,
    ventana,
    alHacerClic: (a) => clics.push(a),
  })
  return { notificador, creadas, pedidos, documento, almacenamiento, enfocados, clics }
}

describe('notificarNuevos: cuándo sale una notificación', () => {
  it('no notifica la primera carga: solo marca los avisos como vistos', () => {
    const { notificador, creadas } = crearEntorno()
    notificador.registrarVistos([aviso(1), aviso(2)])
    notificador.notificarNuevos([aviso(1), aviso(2)])
    assert.equal(creadas.length, 0)
  })

  it('notifica un aviso no leído y nuevo con título, cuerpo, icono y tag del aviso', () => {
    const { notificador, creadas } = crearEntorno()
    notificador.registrarVistos([aviso(1)])
    notificador.notificarNuevos([aviso(2), aviso(1)])
    assert.equal(creadas.length, 1)
    assert.equal(creadas[0].titulo, 'Seguimiento de Proyectos')
    assert.equal(creadas[0].opciones.body, 'Aviso 2')
    assert.equal(creadas[0].opciones.icon, '/icons/icon-192x192.png')
    assert.equal(creadas[0].opciones.tag, 'aviso-2')
  })

  it('no repite un aviso que ya se notificó', () => {
    const { notificador, creadas } = crearEntorno()
    notificador.registrarVistos([])
    notificador.notificarNuevos([aviso(5)])
    notificador.notificarNuevos([aviso(5)])
    assert.equal(creadas.length, 1)
  })

  it('ignora los avisos leídos', () => {
    const { notificador, creadas } = crearEntorno()
    notificador.registrarVistos([])
    notificador.notificarNuevos([aviso(3, { leida: true })])
    assert.equal(creadas.length, 0)
  })

  it('no notifica con la pestaña visible, y esos avisos tampoco salen después', () => {
    const { notificador, creadas, documento } = crearEntorno({ visible: 'visible' })
    notificador.registrarVistos([])
    notificador.notificarNuevos([aviso(4)])
    documento.visibilityState = 'hidden'
    notificador.notificarNuevos([aviso(4)])
    assert.equal(creadas.length, 0)
  })

  it('no notifica sin permiso concedido', () => {
    const { notificador, creadas } = crearEntorno({ permiso: 'denied' })
    notificador.registrarVistos([])
    notificador.notificarNuevos([aviso(1)])
    assert.equal(creadas.length, 0)
  })

  it('no notifica si la persona no las activó en este equipo', () => {
    const { notificador, creadas } = crearEntorno({ activado: false })
    notificador.registrarVistos([])
    notificador.notificarNuevos([aviso(1)])
    assert.equal(creadas.length, 0)
  })

  it('con hasta 3 avisos nuevos sale una notificación por aviso', () => {
    const { notificador, creadas } = crearEntorno()
    notificador.registrarVistos([])
    notificador.notificarNuevos([aviso(1), aviso(2), aviso(3)])
    assert.equal(creadas.length, 3)
  })

  it('con más de 3 sale una sola: «Tienes N avisos nuevos»', () => {
    const { notificador, creadas } = crearEntorno()
    notificador.registrarVistos([])
    notificador.notificarNuevos([aviso(1), aviso(2), aviso(3), aviso(4), aviso(5)])
    assert.equal(creadas.length, 1)
    assert.equal(creadas[0].opciones.body, 'Tienes 5 avisos nuevos')
  })

  it('no falla si el constructor de Notification lanza (p. ej. Chrome en Android)', () => {
    class NotificacionQueLanza {
      static permission = 'granted'
      constructor() {
        throw new TypeError('Illegal constructor')
      }
    }
    const notificador = crearNotificadorNavegador({
      Notificacion: NotificacionQueLanza,
      documento: { visibilityState: 'hidden' },
      almacenamiento: { getItem: () => '1', setItem: () => {}, removeItem: () => {} },
    })
    notificador.registrarVistos([])
    assert.doesNotThrow(() => notificador.notificarNuevos([aviso(1)]))
  })

  it('no falla si Notification no existe', () => {
    const notificador = crearNotificadorNavegador({ Notificacion: undefined })
    assert.equal(notificador.soportado, false)
    assert.doesNotThrow(() => notificador.notificarNuevos([aviso(1)]))
  })
})

describe('clic en la notificación', () => {
  it('enfoca la pestaña, cierra la notificación y abre el aviso', () => {
    const { notificador, creadas, enfocados, clics } = crearEntorno()
    notificador.registrarVistos([])
    const nuevo = aviso(7)
    notificador.notificarNuevos([nuevo])
    creadas[0].onclick()
    assert.equal(enfocados.length, 1)
    assert.equal(creadas[0].cerrada, true)
    assert.deepEqual(clics, [nuevo])
  })

  it('en el resumen solo enfoca la pestaña', () => {
    const { notificador, creadas, enfocados, clics } = crearEntorno()
    notificador.registrarVistos([])
    notificador.notificarNuevos([aviso(1), aviso(2), aviso(3), aviso(4)])
    creadas[0].onclick()
    assert.equal(enfocados.length, 1)
    assert.equal(creadas[0].cerrada, true)
    assert.equal(clics.length, 0)
  })
})

describe('activar y desactivar en este equipo', () => {
  it('activar pide permiso, guarda la preferencia y responde «granted»', async () => {
    const { notificador, pedidos, almacenamiento } = crearEntorno({
      permiso: 'default',
      activado: false,
      respuesta: 'granted',
    })
    assert.equal(notificador.activas(), false)
    assert.equal(await notificador.activar(), 'granted')
    assert.equal(pedidos.length, 1)
    assert.equal(almacenamiento.getItem('avisosNavegador'), '1')
    assert.equal(notificador.activas(), true)
  })

  it('si el permiso se niega no guarda la preferencia y no vuelve a pedirlo', async () => {
    const { notificador, pedidos, almacenamiento } = crearEntorno({
      permiso: 'default',
      activado: false,
      respuesta: 'denied',
    })
    assert.equal(await notificador.activar(), 'denied')
    assert.equal(await notificador.activar(), 'denied')
    assert.equal(pedidos.length, 1)
    assert.equal(almacenamiento.getItem('avisosNavegador'), null)
  })

  it('desactivar deja de notificar sin tocar el permiso', () => {
    const { notificador, creadas } = crearEntorno()
    notificador.desactivar()
    notificador.registrarVistos([])
    notificador.notificarNuevos([aviso(1)])
    assert.equal(notificador.activas(), false)
    assert.equal(creadas.length, 0)
  })

  it('un almacenamiento que falla no rompe nada', () => {
    const fallar = () => {
      throw new Error('bloqueado')
    }
    const notificador = crearNotificadorNavegador({
      Notificacion: class {
        static permission = 'granted'
      },
      almacenamiento: { getItem: fallar, setItem: fallar, removeItem: fallar },
    })
    assert.equal(notificador.activas(), false)
    assert.doesNotThrow(() => notificador.desactivar())
  })
})

describe('activar cuando el navegador no responde o se cierra la ventana', () => {
  // Navegador que nunca contesta la petición de permiso (Opera GX con el aviso silenciado).
  const crearSinRespuesta = () => {
    let programado = null
    const notificador = crearNotificadorNavegador({
      Notificacion: class {
        static permission = 'default'
        static requestPermission() {
          return new Promise(() => {})
        }
      },
      almacenamiento: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      esperaPermisoMs: 10000,
      programar: (funcion, ms) => {
        programado = { funcion, ms }
        return 'temporizador'
      },
      cancelar: () => {},
    })
    return { notificador, disparar: () => programado.funcion(), programado: () => programado }
  }

  it('si el navegador no responde, a los 10 s responde «sin-respuesta» y no guarda la preferencia', async () => {
    const { notificador, disparar, programado } = crearSinRespuesta()
    const promesa = notificador.activar()
    assert.equal(programado().ms, 10000)
    disparar()
    assert.equal(await promesa, 'sin-respuesta')
    assert.equal(notificador.activas(), false)
  })

  it('si se cierra la ventana sin elegir responde «default» y no guarda la preferencia', async () => {
    const { notificador, almacenamiento } = crearEntorno({
      permiso: 'default',
      activado: false,
      respuesta: 'default',
    })
    assert.equal(await notificador.activar(), 'default')
    assert.equal(almacenamiento.getItem('avisosNavegador'), null)
  })

  it('cada resultado tiene su mensaje claro; «granted» no muestra nada', () => {
    assert.equal(mensajeDeActivacion('granted'), '')
    assert.match(mensajeDeActivacion('denied'), /El navegador bloqueó los avisos/)
    assert.match(mensajeDeActivacion('default'), /Cerraste la ventana del permiso sin elegir/)
    assert.match(
      mensajeDeActivacion('sin-respuesta'),
      /Tu navegador no mostró la ventana del permiso/,
    )
  })
})

describe('integración en las pantallas', () => {
  const campana = leer('../src/components/CampanaAvisos.vue')
  const perfil = leer('../src/pages/ContadorAuxiliaresPage.vue')

  it('la campana solo notifica con «aviso-nuevo» y ofrece activar los avisos', () => {
    assert.match(campana, /Activar avisos en este equipo/)
    assert.match(campana, /eventos\.escuchar\('aviso-nuevo', cargarYNotificar\)/)
    assert.match(campana, /eventos\.escuchar\('reconectado', cargar\)/)
    // El mensaje (bloqueado, ventana cerrada o sin respuesta) sale del módulo y se muestra en la campana.
    assert.match(campana, /mensajeActivacion\.value = mensajeDeActivacion\(resultado\)/)
    assert.match(campana, /<p v-if="mensajeActivacion"[^>]*role="alert">/)
  })

  it('«Mi perfil» tiene el interruptor «Avisos en este equipo» y explica el resultado', () => {
    assert.match(perfil, /Avisos en este equipo/)
    assert.match(perfil, /q-toggle/)
    assert.match(perfil, /mensajeDeActivacion\(resultadoActivacion\.value\)/)
  })
})
