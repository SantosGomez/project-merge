// Estado de navegación compartido entre el guard del router y el layout común.
// El guard decide si la dirección solicitada está denegada por perfil (RF-6);
// el layout solo se limita a mostrar el aviso de acceso denegado que el guard marcó.

import { ref } from 'vue'

/** Verdadero cuando la pantalla solicitada pertenece a un perfil distinto al de la sesión. */
export const accessDenied = ref(false)

/**
 * Error del arranque cuando el backend no respondió al validar la sesión guardada
 * (plan 4.3, RF-36): P-1 lo muestra con la opción de reintentar y no se borra el token.
 */
export const arranqueFallido = ref(null)

