// Etiquetas de estado y prioridad para las pantallas (RF-13, RF-28, RNF-03, RNF-06).
// Reciben la forma del backend ('Pendiente', 'Alta', ...), como los datos del servicio.
// Cada etiqueta trae texto, color y tooltip: el color nunca es el único portador del significado.
// Sin Vue, sin navegador y sin efectos secundarios.

import { PRIORITY_COLORS, PRIORITY_LABELS } from './constants.js'
import { prioridadDeBackend } from './traduccionBackend.js'

/** Texto, color de Quasar y ayuda contextual de cada estado del backend. */
const ESTADOS = new Map([
  [
    'Pendiente',
    {
      texto: 'Pendiente',
      color: 'orange',
      tooltip: 'El caso todavía no se ha empezado: está esperando a que se atienda.',
    },
  ],
  [
    'En proceso',
    {
      texto: 'En proceso',
      color: 'blue',
      tooltip: 'El caso está siendo atendido y todavía no ha terminado.',
    },
  ],
  [
    'Finalizado',
    {
      texto: 'Finalizado',
      color: 'green',
      tooltip: 'El caso ya está terminado; no queda trabajo pendiente en él.',
    },
  ],
])

/** Nombre legible de cada rol con pantalla. */
const ROLES = new Map([
  ['administrador', 'Administrador'],
  ['contador', 'Contador'],
  ['usuarios_de_sistema', 'Usuario de sistema'],
])

/** Ayuda contextual de cada prioridad, en su código interno. */
const TOOLTIPS_PRIORIDAD = {
  alta: 'Prioridad alta: el caso es urgente y debe atenderse primero.',
  media: 'Prioridad media: el caso es importante, pero puede esperar a los urgentes.',
  baja: 'Prioridad baja: el caso puede atenderse después de los urgentes e importantes.',
}

/**
 * Etiqueta de un estado del backend.
 * Un estado desconocido devuelve `null`: no se inventa una etiqueta.
 */
export const formatearEstado = (estado) => ESTADOS.get(estado) ?? null

/**
 * Dos primeras letras del nombre de usuario, en mayúsculas.
 * `contador_seed` → «CO»; un usuario vacío devuelve una cadena vacía.
 */
export const formatearIniciales = (usuario) =>
  String(usuario ?? '')
    .trim()
    .slice(0, 2)
    .toUpperCase()

/**
 * Nombre legible del rol. Un rol sin etiqueta devuelve una cadena vacía.
 */
export const formatearRol = (rol) => ROLES.get(rol) ?? ''

/**
 * Etiqueta de una prioridad del backend.
 * Reutiliza los textos y colores de `constants.js` y devuelve `null` si no es una prioridad conocida.
 */
export const formatearPrioridad = (prioridad) => {
  const prioridadInterna = prioridadDeBackend(prioridad)

  if (prioridadInterna === null) {
    return null
  }

  return {
    texto: PRIORITY_LABELS[prioridadInterna],
    color: PRIORITY_COLORS[prioridadInterna],
    tooltip: TOOLTIPS_PRIORIDAD[prioridadInterna],
  }
}
