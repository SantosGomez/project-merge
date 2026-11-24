// Sesión que ven las pantallas de documentos. En Proyecto-documentos tenía su propio login; en la
// app unida es la de status-conta (store de pinia) y el rol es el que la cuenta tiene en el módulo.
import { computed } from 'vue'
import { useSessionStore } from '../../../stores/session.js'

/**
 * @returns {{ usuario: import('vue').ComputedRef<{ id: number, nombre: string|null, rol: string|null, clienteId: null }|null> }}
 */
export function useSesion() {
  const session = useSessionStore()
  const usuario = computed(() =>
    session.autenticado
      ? {
          id: Number(session.id),
          nombre: session.nombre,
          rol: session.rolDocumentos,
          // El portal de clientes todavía no está activo.
          clienteId: null,
        }
      : null,
  )
  return { usuario }
}
