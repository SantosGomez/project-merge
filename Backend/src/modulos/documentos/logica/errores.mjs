// Clasificación de fallos y tabla de permisos
// (tarea T4 de la especificación 002).
//
// Sin un solo import: este módulo no habla con la base de datos ni con el
// servidor. Solo mira el `code` de un error que le pasen. Por eso `node --test`
// lo carga sin nada más, que es lo que pide RNF-5.
//
// ⚠️ Este módulo NUNCA escribe en la consola. Ni un mensaje, ni un código
// técnico. Los dos van por caminos distintos: el texto en español va a la
// pantalla, y el código crudo al registro del servidor. Un código de MySQL en
// pantalla se puede leer desde otra red y no le dice nada a quien recepciona.

/** Códigos del cliente de red: no hay quien escuche, o se cortó el hilo. */
const DE_RED = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH'
])

/** Códigos del motor: la base responde, pero le faltan tablas o la base misma. */
const DE_ESQUEMA = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_DB_ERROR'])

/** Código del motor: se quiso escribir algo que ya existe. */
const DE_DUPLICADO = 'ER_DUP_ENTRY'

/**
 * Traduce un error a uno de los cuatro motivos que el resto del sistema
 * entiende. Los motivos están escritos en español y sin abreviaturas de MySQL,
 * porque van a aparecer en las respuestas HTTP del §5.1 del plan.
 *
 * @param {unknown} error El error que falló. Puede no ser un error.
 * @returns {'SIN_CONEXION'|'ESQUEMA_NO_APLICADO'|'FOLIO_REPETIDO'|'OTRO'} El motivo.
 */
export const clasificarFallo = (error) => {
  // Esta función se llama DENTRO de un `catch`. Si también fallara aquí, quien
  // recibe el error vería un error del error, que es la peor forma de fallar.
  const codigo = error?.code
  if (typeof codigo !== 'string') return 'OTRO'

  if (DE_RED.has(codigo)) return 'SIN_CONEXION'
  if (DE_ESQUEMA.has(codigo)) return 'ESQUEMA_NO_APLICADO'
  if (codigo === DE_DUPLICADO) return 'FOLIO_REPETIDO'

  // Un código en minúsculas o desconocido es `OTRO` a propósito. Los del motor
  // vienen en mayúsculas; adivinar sería inventarse un motivo.
  return 'OTRO'
}

// Los cuatro motivos y su texto. RNF-1: cada mensaje dice QUÉ PASÓ y QUÉ HACER,
// porque un "no se pudo conectar" sin más deja al usuario sin camino.
//
// ⚠️ Son cuatro textos y no uno parametrizado porque lo que hay que hacer es
// distinto en cada caso: levantar el servidor y ejecutar el script del esquema
// no es lo mismo. Un mensaje que cubriera a los dos sería inútil en ambos.

/** Textos en español con su remedio, uno por motivo. */
const MENSAJES = {
  SIN_CONEXION:
    'No se pudo conectar con la base de datos. Revisa que el servidor de la base ' +
    'esté encendido y que el usuario y la clave de la configuración sean correctos.',

  ESQUEMA_NO_APLICADO:
    'La base de datos no tiene el esquema del proyecto. Falta ejecutar el script ' +
    'schema.sql, o las migraciones pendientes, antes de poder guardar.',

  FOLIO_REPETIDO:
    'El número de folio chocó con otro registro que se guardó en este momento. ' +
    'Vuelve a intentarlo: el sistema le dará el siguiente número disponible.',

  OTRO:
    'Ocurrió un problema al guardar y no se pudo completar la operación. ' +
    'Inténtalo de nuevo y, si sigue pasando, avisa al administrador.'
}

/**
 * El texto en español de un motivo, con su remedio.
 * @param {string} motivo Uno de los cuatro motivos de `clasificarFallo`.
 * @returns {string} El mensaje. Nunca cadena vacía, nunca `undefined`.
 */
export const mensajeDeFallo = (motivo) => {
  // Un motivo desconocido cae en el texto genérico en vez de devolver
  // indefinido: quien llama lo pinta tal cual y no queremos un hueco en pantalla.
  return MENSAJES[motivo] ?? MENSAJES.OTRO
}

// La tabla de permisos. Las reglas de RF-3.1, RF-3.2 y RF-3.5, más
// `cambiar_estado` (cambiar el estado de un documento desde el Dashboard) y
// `ver_usuarios` (el directorio de usuarios) y `administrar_usuarios` (activar o
// desactivar cuentas), los dos solo para el Administrador.
// ⚠️ Está replicada en Frontend/src/router/routes.js para la guardia de rutas:
// toda acción que use una ruta tiene que estar en las dos.
//
// ⚠️ `Object.freeze`: es una constante, no un objeto que llegue como argumento.
// Si alguien pudiera ampliarla desde fuera, un rol inventado se llevaría
// todos los permisos.

const PERMISOS = Object.freeze({
  // Sistemas (soporte) puede lo mismo que el Administrador; Practicante solo consulta.
  registrar_recepcion: Object.freeze(['Recepcionista', 'Administrador', 'Sistemas']),
  ver_directorio: Object.freeze(['Contador', 'Administrador', 'Practicante', 'Sistemas']),
  crear_cliente: Object.freeze(['Contador', 'Administrador', 'Sistemas']),
  cambiar_estado: Object.freeze(['Contador', 'Administrador', 'Sistemas']),
  ver_usuarios: Object.freeze(['Administrador', 'Sistemas']),
  administrar_usuarios: Object.freeze(['Administrador', 'Sistemas']),
  ver_seguimiento: Object.freeze(['Cliente', 'Contador', 'Administrador', 'Practicante', 'Sistemas'])
})

/**
 * ¿Este rol puede esta acción?
 *
 * La comparación de roles es **exacta**, sin recortar espacios ni ignorar
 * mayúsculas. `roles.nombre` es texto libre con restricción de único, así que
 * pueden existir "Recepcionista" y "recepcionista" a la vez. Comparar exacto
 * falla hacia el lado seguro: se le pide al administrador que lo arregle, en vez
 * de devolverle un permiso que nadie le concedió.
 *
 * @param {string} rol El nombre del rol del usuario.
 * @param {string} accion La acción que intenta hacer.
 * @returns {boolean} `true` solo si el rol está en la lista de esa acción.
 */
export const hayAcceso = (rol, accion) => {
  if (typeof rol !== 'string' || typeof accion !== 'string') return false

  const permitidos = PERMISOS[accion]
  if (!permitidos) return false

  return permitidos.includes(rol)
}
