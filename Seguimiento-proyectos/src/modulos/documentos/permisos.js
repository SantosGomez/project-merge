// Permisos del módulo de documentos para sus pantallas. Antes vivían en su router
// (`@/router/routes.js`); en la app unida salen de utils/modulos.js, que repite los del backend.
import { hayAccesoDocumentos } from '../../utils/modulos.js'

/**
 * @param {string|null} rol - rol dentro de documentos ('Contador', 'Administrador'…).
 * @param {string} accion - permiso ('registrar_recepcion', 'ver_directorio'…).
 * @returns {boolean}
 */
export const hayAcceso = (rol, accion) => hayAccesoDocumentos(rol, accion)
