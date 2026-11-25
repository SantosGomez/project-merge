// Módulos de la app unida (status-conta + Recepción de documentos). Funciones puras, sin Vue.
// El backend decide qué módulos tiene cada cuenta (`modulos` del login y del perfil); aquí solo
// se ordena la pantalla: a dónde ir al entrar, qué menú mostrar y qué permiso pide cada vista.

export const MODULOS = Object.freeze({
  seguimiento: 'seguimiento',
  documentos: 'documentos',
})

/** Pantalla para elegir módulo cuando la cuenta tiene más de uno. */
export const RUTA_SELECTOR_MODULOS = '/modulos'

/** Pantalla de entrada del módulo de documentos (elige la vista según el rol). */
export const RUTA_DOCUMENTOS = '/documentos'

/** Datos de cada módulo para el selector y el menú. */
export const DATOS_MODULO = Object.freeze({
  [MODULOS.seguimiento]: Object.freeze({
    nombre: 'Seguimiento de Proyectos',
    descripcion: 'Casos, auditorías, calendario y actividades del equipo',
    icono: 'assignment',
  }),
  [MODULOS.documentos]: Object.freeze({
    nombre: 'Recepción de documentos',
    descripcion: 'Recepción, entrega al contador y seguimiento de papelería de clientes',
    icono: 'inventory_2',
  }),
})

// Rol del módulo (minúsculas, como en usuario_modulos) → nombre que usan los permisos de documentos.
const ROL_DOCUMENTOS = Object.freeze({
  administrador: 'Administrador',
  contador: 'Contador',
  recepcionista: 'Recepcionista',
  practicante: 'Practicante',
  sistemas: 'Sistemas',
  cliente: 'Cliente',
})

// Los mismos permisos que el backend (Backend/src/modulos/documentos/logica/errores.mjs).
export const PERMISOS_DOCUMENTOS = Object.freeze({
  registrar_recepcion: Object.freeze(['Recepcionista', 'Administrador', 'Sistemas']),
  ver_directorio: Object.freeze(['Contador', 'Administrador', 'Practicante', 'Sistemas']),
  crear_cliente: Object.freeze(['Contador', 'Administrador', 'Sistemas']),
  cambiar_estado: Object.freeze(['Contador', 'Administrador', 'Sistemas']),
  ver_usuarios: Object.freeze(['Administrador', 'Sistemas']),
  administrar_usuarios: Object.freeze(['Administrador', 'Sistemas']),
  ver_seguimiento: Object.freeze([
    'Cliente',
    'Contador',
    'Administrador',
    'Practicante',
    'Sistemas',
  ]),
})

/**
 * @param {string|null} rol - rol dentro de documentos ('Contador'…).
 * @param {string} accion - permiso de PERMISOS_DOCUMENTOS.
 * @returns {boolean}
 */
export const hayAccesoDocumentos = (rol, accion) =>
  typeof rol === 'string' && (PERMISOS_DOCUMENTOS[accion] ?? []).includes(rol)

/**
 * Rol dentro de documentos con el nombre de sus permisos, o null si no tiene el módulo.
 * @param {Array<{ modulo: string, rol: string|null }>} modulos
 */
export const rolDocumentosDe = (modulos) => {
  const documentos = (modulos ?? []).find((m) => m.modulo === MODULOS.documentos)
  return (documentos && ROL_DOCUMENTOS[documentos.rol]) ?? null
}

/**
 * Primera vista del módulo de documentos para un rol: la recepción para quien recibe papelería,
 * el dashboard para quien la trabaja y el seguimiento para los demás.
 * @param {string|null} rol
 * @returns {string|null} nombre de ruta, o null si no puede entrar a ninguna.
 */
export const vistaInicialDocumentos = (rol) => {
  if (hayAccesoDocumentos(rol, 'registrar_recepcion')) return 'doc-recepcion'
  if (hayAccesoDocumentos(rol, 'ver_directorio')) return 'doc-dashboard'
  if (hayAccesoDocumentos(rol, 'ver_seguimiento')) return 'doc-seguimiento'
  return null
}

/**
 * A dónde ir al entrar: con varios módulos, al selector; con solo documentos, a documentos;
 * si no, a la pantalla principal de su rol en seguimiento (como siempre).
 * @param {Array<{ modulo: string }>} modulos
 * @param {string|null} pantallaSeguimiento - pantalla principal del rol en seguimiento.
 * @returns {string|null}
 */
export const destinoTrasEntrar = (modulos, pantallaSeguimiento) => {
  const lista = (modulos ?? []).map((m) => m.modulo)
  const conDocumentos = lista.includes(MODULOS.documentos) && rolDocumentosDe(modulos) !== null
  const conSeguimiento = lista.includes(MODULOS.seguimiento)
  if (conDocumentos && conSeguimiento) return RUTA_SELECTOR_MODULOS
  if (conDocumentos) return RUTA_DOCUMENTOS
  return pantallaSeguimiento
}
