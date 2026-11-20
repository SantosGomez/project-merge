// Notificaciones del sistema para los avisos nuevos de la campana. Sin Vue: la API Notification,
// el documento, la ventana y el almacenamiento se pueden inyectar para probarlo sin navegador.
//
// - La preferencia «avisos en este equipo» vive en localStorage (por equipo, no en la base).
// - Solo notifica avisos no leídos que no se habían visto antes, con la pestaña oculta,
//   el permiso concedido y la preferencia activa.
// - Con más de 3 avisos a la vez sale un solo resumen.

const CLAVE_PREFERENCIA = 'avisosNavegador'
const TITULO = 'Seguimiento de Proyectos'
const ICONO = '/icons/icon-192x192.png'
const MAXIMO_INDIVIDUALES = 3
// Algunos navegadores (Opera GX con el aviso silenciado) nunca contestan la petición de permiso.
const ESPERA_PERMISO_MS = 10000

const MENSAJES_DE_ACTIVACION = {
  denied:
    'El navegador bloqueó los avisos. Actívalos en la configuración del sitio (candado junto a la dirección).',
  default: 'Cerraste la ventana del permiso sin elegir. Vuelve a intentarlo y elige «Permitir».',
  'sin-respuesta':
    'Tu navegador no mostró la ventana del permiso. Revisa el icono junto a la dirección o actívalos en la configuración del sitio y vuelve a intentarlo.',
}

/**
 * Texto para la persona según el resultado de `activar()`; vacío si se concedió.
 * @param {'granted'|'denied'|'default'|'sin-respuesta'} resultado
 * @returns {string}
 */
export const mensajeDeActivacion = (resultado) => MENSAJES_DE_ACTIVACION[resultado] ?? ''

/**
 * Crea el notificador con dependencias inyectables.
 * @param {Object} [opciones]
 * @param {Function} [opciones.alHacerClic] - recibe el aviso al tocar su notificación (no el resumen).
 * @returns {{ soportado: boolean, permiso: Function, activas: Function, activar: Function, desactivar: Function, registrarVistos: Function, notificarNuevos: Function }}
 */
export const crearNotificadorNavegador = (opciones = {}) => {
  const Notificacion =
    'Notificacion' in opciones
      ? opciones.Notificacion
      : typeof globalThis.Notification === 'function'
        ? globalThis.Notification
        : undefined
  const documento = opciones.documento ?? globalThis.document
  const ventana = opciones.ventana ?? globalThis.window
  const alHacerClic = opciones.alHacerClic ?? (() => {})
  const esperaPermisoMs = opciones.esperaPermisoMs ?? ESPERA_PERMISO_MS
  const programar = opciones.programar ?? ((funcion, ms) => globalThis.setTimeout(funcion, ms))
  const cancelar = opciones.cancelar ?? ((pendiente) => globalThis.clearTimeout(pendiente))

  const obtenerAlmacenamiento = () => {
    try {
      return opciones.almacenamiento ?? globalThis.localStorage
    } catch {
      return undefined
    }
  }

  const soportado = typeof Notificacion === 'function'
  const vistos = new Set()

  const permiso = () => (soportado ? Notificacion.permission : 'denied')

  const preferenciaActiva = () => {
    try {
      return obtenerAlmacenamiento()?.getItem(CLAVE_PREFERENCIA) === '1'
    } catch {
      return false
    }
  }

  const guardarPreferencia = (activa) => {
    try {
      const almacenamiento = obtenerAlmacenamiento()
      if (activa) almacenamiento?.setItem(CLAVE_PREFERENCIA, '1')
      else almacenamiento?.removeItem(CLAVE_PREFERENCIA)
    } catch {
      // Sin almacenamiento la preferencia no se recuerda; no es un fallo de la pantalla.
    }
  }

  /** Hay soporte, preferencia activa en este equipo y permiso concedido. */
  const activas = () => soportado && preferenciaActiva() && permiso() === 'granted'

  /**
   * Pide el permiso (si no está bloqueado) y, si lo conceden, guarda la preferencia.
   * Si el navegador no contesta en `esperaPermisoMs`, responde «sin-respuesta» para que la pantalla
   * no se quede esperando.
   * @returns {Promise<'granted'|'denied'|'default'|'sin-respuesta'>}
   */
  const pedirPermiso = async () => {
    let pendiente
    const limite = new Promise((resolver) => {
      pendiente = programar(() => resolver('sin-respuesta'), esperaPermisoMs)
    })
    try {
      return await Promise.race([Promise.resolve(Notificacion.requestPermission()), limite])
    } finally {
      cancelar(pendiente)
    }
  }

  const activar = async () => {
    if (!soportado) return 'denied'
    if (permiso() === 'denied') return 'denied'
    const resultado = permiso() === 'granted' ? 'granted' : await pedirPermiso()
    if (resultado === 'granted') guardarPreferencia(true)
    return resultado
  }

  const desactivar = () => guardarPreferencia(false)

  /** Marca los avisos como vistos sin notificar (primera carga y recargas que no son «aviso-nuevo»). */
  const registrarVistos = (avisos) => {
    for (const aviso of avisos ?? []) vistos.add(aviso.id)
  }

  const mostrar = (cuerpo, tag, alTocar) => {
    let notificacion
    try {
      notificacion = new Notificacion(TITULO, { body: cuerpo, icon: ICONO, tag })
    } catch {
      // Algunos navegadores (Chrome en Android) no permiten crearla desde la página: queda la campana.
      return
    }
    notificacion.onclick = () => {
      ventana?.focus?.()
      notificacion.close()
      alTocar?.()
    }
  }

  /** Notifica los avisos no leídos que no se habían visto, si la pestaña está oculta. */
  const notificarNuevos = (avisos) => {
    const nuevos = (avisos ?? []).filter((aviso) => !aviso.leida && !vistos.has(aviso.id))
    registrarVistos(avisos)
    if (nuevos.length === 0 || !activas()) return
    if (documento?.visibilityState === 'visible') return

    if (nuevos.length > MAXIMO_INDIVIDUALES) {
      mostrar(`Tienes ${nuevos.length} avisos nuevos`, 'avisos-resumen')
      return
    }
    for (const aviso of nuevos) {
      mostrar(aviso.mensaje, `aviso-${aviso.id}`, () => alHacerClic(aviso))
    }
  }

  return { soportado, permiso, activas, activar, desactivar, registrarVistos, notificarNuevos }
}
