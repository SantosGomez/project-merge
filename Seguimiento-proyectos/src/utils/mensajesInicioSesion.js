// Mensajes de error propios del inicio de sesión (revisión de UI, rebanada 1).
// Sin Vue y sin navegador.
//
// Los errores genéricos de api.js nombran la petición técnica («la petición POST /auth/login»);
// en el login se cambian por la acción que la persona entiende: el inicio de sesión.

import { ESTADOS_ERROR } from '../services/api.js'
import { construirError } from './mensajes.js'

const SOBRE_QUE = 'el inicio de sesión'

/**
 * Aviso del bloqueo por demasiados intentos fallidos, en trato de tú. Los 15 minutos son la
 * ventana del límite del backend (`windowMs` en Backend/src/app.js): si cambia allá, cambia aquí.
 */
export const MENSAJE_BLOQUEO_LOGIN =
  'Se bloqueó el inicio de sesión por demasiados intentos fallidos. Espera 15 minutos y vuelve a intentarlo.'

/**
 * Error de red o de servidor del login en lenguaje llano, con las tres partes de RNF-01.
 * Si el backend explicó el fallo con su propio `mensaje`, ese texto se respeta.
 * @param {{ estado: string, mensaje: string, datos?: Object|null }} error - error normalizado de api.js.
 * @returns {{ estado: string, mensaje: string }}
 */
export const errorDeConexionLogin = (error) => {
  if (error?.estado === ESTADOS_ERROR.RED) {
    return {
      ...error,
      ...construirError(
        'No se pudo conectar con el servidor',
        SOBRE_QUE,
        'revisa tu conexión a internet y vuelve a intentarlo',
      ),
    }
  }

  if (error?.estado === ESTADOS_ERROR.SERVIDOR && !error?.datos?.mensaje) {
    return {
      ...error,
      ...construirError(
        'El servidor no pudo iniciar tu sesión',
        SOBRE_QUE,
        'vuelve a intentarlo en unos segundos; si continúa, avisa al administrador',
      ),
    }
  }

  return (
    error ??
    construirError('No se pudo iniciar sesión', SOBRE_QUE, 'revisa tu conexión a internet y vuelve a intentarlo')
  )
}
