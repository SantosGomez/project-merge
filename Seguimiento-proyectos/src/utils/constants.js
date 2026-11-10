// Valores únicos del dominio de la maqueta.
// Ninguna pantalla ni utilidad debe repetir estos textos ni estos códigos.

/** Estados permitidos de un caso, en el orden en que se muestran. */
export const STATUSES = ['pendiente', 'en_proceso', 'finalizado']

/** Prioridades permitidas de un caso, de mayor a menor urgencia. */
export const PRIORITIES = ['alta', 'media', 'baja']

/** Etiqueta en español de cada estado. */
export const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  finalizado: 'Finalizado',
}

/** Etiqueta en español de cada prioridad: el color nunca es el único portador del significado. */
export const PRIORITY_LABELS = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

/** Color de Quasar asociado a cada prioridad (Alta rojo, Media ámbar, Baja verde). */
export const PRIORITY_COLORS = {
  alta: 'red',
  media: 'amber',
  baja: 'green',
}

/**
 * Perfiles de la app; el usuario de sistema solo da de alta cuentas (historia 9a).
 * El auxiliar trabaja casos como un contador y apoya a uno; no gestiona auxiliares ni auditorías.
 */
export const PROFILES = {
  administrador: 'administrador',
  contador: 'contador',
  auxiliar: 'auxiliar',
  sistema: 'usuarios_de_sistema',
}

/** Máximo de caracteres visibles del nombre del cliente: 80 se aceptan, 81 no. */
export const MAX_CLIENT_LENGTH = 80

/** Mínimo de caracteres de la contraseña en el alta de usuario (historia 9a). */
export const MIN_PASSWORD_LENGTH = 8

/** Máximo de caracteres del nombre y del correo de una cuenta (columnas de 150 en la base). */
export const MAX_NOMBRE_CORREO_LENGTH = 150

/** Máximo de caracteres de la descripción de un caso (columna TEXT, 1000 se aceptan, 1001 no). */
export const MAX_DESCRIPCION_LENGTH = 1000

/** Máximo de caracteres de las observaciones de un caso (columna TEXT, 2000 se aceptan, 2001 no). */
export const MAX_OBSERVACIONES_LENGTH = 2000

/**
 * Texto visible de cada código de error de las validaciones de cuenta (alta y restablecer).
 * Lo comparten los diálogos del directorio: el campo ya se llama «Contraseña nueva», así que
 * el aviso no repite «nueva».
 */
export const MENSAJES_VALIDACION = Object.freeze({
  nombre_requerido: 'El nombre es obligatorio.',
  nombre_demasiado_largo: 'El nombre supera los 150 caracteres permitidos.',
  correo_requerido: 'El correo es obligatorio.',
  correo_demasiado_largo: 'El correo supera los 150 caracteres permitidos.',
  correo_invalido: 'Escribe un correo válido, por ejemplo nombre@delgrow.mx.',
  password_requerida: 'La contraseña es obligatoria.',
  password_corta: 'La contraseña debe tener al menos 8 caracteres.',
  rol_requerido: 'Elige el rol de la cuenta.',
})

/**
 * Pantalla principal de cada perfil con pantalla, como ruta de la aplicación (Definiciones).
 * Única fuente: `session.js` la usa como path y `accessRules.js` deriva el nombre de ruta.
 * Un perfil que no está aquí no tiene pantalla asignada.
 */
export const RUTA_PRINCIPAL_POR_ROL = Object.freeze({
  [PROFILES.administrador]: '/admin/dashboard',
  [PROFILES.contador]: '/contador/casos',
  [PROFILES.auxiliar]: '/contador/casos',
  [PROFILES.sistema]: '/admin/directorio',
})
