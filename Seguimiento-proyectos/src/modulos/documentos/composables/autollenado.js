// Autollenado del formulario de recepción a partir de un cliente frecuente.
//
// Los valores por tipo de recepción son datos ficticios de arranque: el Backend
// todavía no tiene la tabla de «tipos de recepción» ni la matriz de plantillas
// por cliente. Cuando exista, esta plantilla se sustituirá por la respuesta del
// servidor sin cambiar la vista.
//
// ⚠️ El autollenado NUNCA toca `periodo`, `archivos` ni las firmas: esos los
// decide la persona en cada entrega.

/** Tipos de recepción acordados para el MVP. */
export const TIPOS_RECEPCION = Object.freeze(['Mensual', 'Trimestral', 'Anual', 'Eventual', 'Otro'])

/**
 * Los campos del formulario que sí se autollenan. Es la lista de la que tira
 * `aplicarPlantilla`; todo lo que no esté aquí se respeta.
 */
export const CAMPOS_AUTOLLENADO = Object.freeze([
  'empresaDca',
  'asunto',
  'departamento',
  'tipoDocumento',
  'prioridad',
  'contadorAsignado',
  'viaEntrega',
  'notificarCorreo',
  'observaciones',
])

/**
 * Valores por defecto por tipo de recepción. Son ficticios: se usan hasta que
 * exista la matriz real por cliente.
 */
export const PLANTILLAS = Object.freeze({
  Mensual: Object.freeze({
    empresaDca: 'DCA Contadores S.C.',
    asunto: 'Documentación mensual recurrente',
    departamento: 'Contabilidad',
    tipoDocumento: 'Declaración Mensual',
    prioridad: 'MEDIA',
    contadorAsignado: null,
    viaEntrega: 'Digital',
    notificarCorreo: true,
    observaciones: 'Recepción mensual programada',
  }),
  Trimestral: Object.freeze({
    empresaDca: 'DCA Contadores S.C.',
    asunto: 'Documentación trimestral recurrente',
    departamento: 'Fiscal',
    tipoDocumento: 'Declaración Mensual',
    prioridad: 'MEDIA',
    contadorAsignado: null,
    viaEntrega: 'Digital',
    notificarCorreo: true,
    observaciones: 'Recepción trimestral programada',
  }),
  Anual: Object.freeze({
    empresaDca: 'DCA Asesores y Consultores',
    asunto: 'Documentación anual recurrente',
    departamento: 'Fiscal',
    tipoDocumento: 'Opinión de Cumplimiento',
    prioridad: 'ALTA',
    contadorAsignado: null,
    viaEntrega: 'Digital',
    notificarCorreo: true,
    observaciones: 'Recepción anual programada',
  }),
  Eventual: Object.freeze({
    empresaDca: 'DCA Contadores S.C.',
    asunto: 'Documentación eventual',
    departamento: 'Contabilidad',
    tipoDocumento: 'Comprobante de Pago',
    prioridad: 'BAJA',
    contadorAsignado: null,
    viaEntrega: 'Físico',
    notificarCorreo: false,
    observaciones: 'Entrega eventual',
  }),
  Otro: Object.freeze({
    empresaDca: 'DCA Contadores S.C.',
    asunto: 'Recepción de documentos',
    departamento: 'Contabilidad',
    tipoDocumento: 'Comprobante de Pago',
    prioridad: 'MEDIA',
    contadorAsignado: null,
    viaEntrega: 'Digital',
    notificarCorreo: false,
    observaciones: '',
  }),
})

/**
 * Vuelca la plantilla del tipo indicado sobre el formulario reactivo.
 *
 * @param {string} tipo - Uno de `TIPOS_RECEPCION`.
 * @param {Record<string, unknown>} form - Formulario reactivo de la recepción.
 * @returns {boolean} `true` si el tipo existe y se aplicó; `false` si no.
 */
export const aplicarPlantilla = (tipo, form) => {
  const plantilla = PLANTILLAS[tipo]
  if (!plantilla || !form) return false

  for (const campo of CAMPOS_AUTOLLENADO) {
    form[campo] = plantilla[campo]
  }
  return true
}
