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

/** Perfiles de la app; el usuario de sistema solo da de alta cuentas (historia 9a). */
export const PROFILES = {
  administrador: 'administrador',
  contador: 'contador',
  sistema: 'usuarios_de_sistema',
}

/** Máximo de caracteres visibles del nombre del cliente: 80 se aceptan, 81 no. */
export const MAX_CLIENT_LENGTH = 80

/** Mínimo de caracteres de la contraseña en el alta de usuario (historia 9a). */
export const MIN_PASSWORD_LENGTH = 8

/** Máximo de caracteres del nombre y del correo de una cuenta (columnas de 150 en la base). */
export const MAX_NOMBRE_CORREO_LENGTH = 150
