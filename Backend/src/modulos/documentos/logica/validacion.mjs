// Validación del documento y de los adjuntos
// (tarea T6 de la especificación 002).
//
// Sin un solo import: nada de aquí habla con la base de datos ni con el
// servidor. Por eso `node --test` lo carga sin nada más.
//
// ⚠️ Lo que devuelve NO es un verdadero o un falso, sino una LISTA de lo que
// falta. Quien llama tiene que poder decir CUÁLES campos van mal, no solo que
// algo falló: RF-5.10 pide "explica qué falta" y un sí o un no obliga a validar
// otra vez para averiguarlo.
//
// Y cada problema trae DOS cosas distintas, porque el remedio es distinto:
//   · `problema: 'FALTA'`   → el campo está vacío. El usuario lo escribe.
//   · `problema: 'FORMATO'` → el campo está lleno pero mal. Escribirlo otra vez
//     igual no lo arregla; hay que decirle cuál es la forma.
//
// Ejemplo de por qué importa: con el periodo en "octubre", un mensaje de "falta
// el periodo" manda al usuario a escribir un periodo, y el que escriba puede
// volver a escribir "octubre".

/**
 * El límite de tamaño de un adjunto: 25 MiB.
 *
 * El plan y la maqueta dicen "25 megabytes" sin especificar. Se usa MiB
 * (25 * 1024 * 1024) porque es la lectura habitual de un límite de archivo y
 * porque es la más permisiva de las dos: con 25 MB exactos, un archivo entre
 * 25 000 000 y 26 214 400 bytes sería rechazado aunque quien lo subió contara
 * con 25 megabytes.
 */
export const LIMITE_ADJUNTO_BYTES = 25 * 1024 * 1024

/** Los cuatro valores que acepta el ENUM de la base. */
const VIAS_DE_ENTREGA = ['PRESENCIAL', 'CORREO', 'DIGITAL', 'OTRO']

/**
 * La forma que tiene que tener el periodo: cuatro dígitos, guion y un mes de
 * `01` a `12`.
 *
 * El mes va dentro de la misma expresión a propósito. La cláusula CHECK de la
 * base (`§3 del plan`) solo comprueba `\d{4}-\d{2}`, así que un `2026-13` la
 * pasa: el documento se guardaría y no aparecería en ningún periodo, que es
 * exactamente el fallo que se encontró al ejecutar la migración. Aquí se cierra
 * antes, y con un mensaje en español.
 */
const FORMA_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/

// Los diez campos obligatorios de RF-5.2. La etiqueta es cómo se llama cada uno
// en la pantalla: el nombre técnico va al registro del servidor y el usuario
// tiene que ver el otro.
const OBLIGATORIOS = [
  { campo: 'clienteId', etiqueta: 'cliente' },
  { campo: 'empresaId', etiqueta: 'empresa receptora' },
  { campo: 'tipoDocId', etiqueta: 'tipo de documento' },
  { campo: 'departamentoId', etiqueta: 'departamento' },
  { campo: 'asunto', etiqueta: 'asunto' },
  { campo: 'prioridad', etiqueta: 'prioridad' },
  { campo: 'periodo', etiqueta: 'periodo' },
  { campo: 'viaEntrega', etiqueta: 'vía de entrega' },
  { campo: 'firmaCliente', etiqueta: 'firma del cliente' },
  { campo: 'firmaRecep', etiqueta: 'firma del recepcionista' }
]

/**
 * ¿Este valor cuenta como "puesto"?
 *
 * Una cadena de puros espacios NO cuenta. En un formulario es muy fácil dejar el
 * espacio en blanco y creer que se escribió algo, y el usuario no sabría por qué
 * se lo rechazan.
 *
 * @param {unknown} valor Lo que vino en el campo.
 * @returns {boolean} `true` si hay algo de verdad.
 */
const estaPuesto = (valor) => {
  if (valor === null || valor === undefined) return false
  if (typeof valor === 'string') return valor.trim() !== ''
  // El cero es un valor, no una ausencia: un id cero es un id.
  return true
}

/**
 * Valida un documento y devuelve la lista de lo que está mal.
 *
 * No valida el FORMATO de la prioridad: el formulario ofrece las cuatro de un
 * selector y no se puede elegir otra cosa, así que la base lo rechaza sola.
 *
 * @param {object} datos El documento tal como lo manda el formulario.
 * @returns {Array<{campo: string, etiqueta: string, problema: string, detalle?: string}>}
 *   Lista vacía si el documento está bien. Cada problema trae el nombre técnico
 *   del campo, su etiqueta en pantalla, si `FALTA` o `FORMATO`, y el detalle
 *   cuando hay forma esperada.
 */
export const validarDocumento = (datos) => {
  const documento = datos && typeof datos === 'object' ? datos : {}
  const problemas = []

  for (const { campo, etiqueta } of OBLIGATORIOS) {
    if (!estaPuesto(documento[campo])) {
      problemas.push({ campo, etiqueta, problema: 'FALTA' })
    }
  }

  // El periodo: además de estar puesto, tiene que tener la forma. La base lo
  // comprueba con una cláusula CHECK (§3 del plan), pero aquí se avisa antes y
  // en español, que es lo que RF-5.10 pide.
  if (estaPuesto(documento.periodo) && !FORMA_PERIODO.test(documento.periodo)) {
    problemas.push({
      campo: 'periodo',
      etiqueta: 'periodo',
      problema: 'FORMATO',
      detalle:
        'El periodo tiene que tener la forma AAAA-MM con un mes del 01 al 12, ' +
        'por ejemplo 2026-10.'
    })
  }

  // La vía de entrega tiene que ser uno de los cuatro del ENUM. Sin esta
  // comprobación, en una base sin modo estricto el valor se guardaría vacío.
  if (estaPuesto(documento.viaEntrega) && !VIAS_DE_ENTREGA.includes(documento.viaEntrega)) {
    problemas.push({
      campo: 'viaEntrega',
      etiqueta: 'vía de entrega',
      problema: 'FORMATO',
      detalle: `La vía de entrega tiene que ser una de: ${VIAS_DE_ENTREGA.join(', ')}.`
    })
  }

  return problemas
}

/**
 * Separta los adjuntos que se pasan del límite de tamaño.
 *
 * ⚠️ No devuelve un sí o un no: un adjunto grande **no bloquea el documento**,
 * se rechaza SOLO ese y el resto del registro continúa (RF-9.4). Por eso lo que
 * sale es la lista de los que se quedaron fuera.
 *
 * @param {Array<{nombreOriginal: string, tamanoBytes: number}>} adjuntos
 * @returns {Array<{nombreOriginal: string, tamanoBytes: number, limiteBytes: number}>}
 *   Solo los rechazados, cada uno con su tamaño y el límite, para que la
 *   pantalla pueda decir qué archivo y cuánto.
 */
export const validarAdjuntos = (adjuntos) => {
  if (!Array.isArray(adjuntos)) return []

  const rechazados = []

  for (const adjunto of adjuntos) {
    const tamano = Number(adjunto?.tamanoBytes)

    // Sin tamaño no se puede decir que se pasa del límite. No se marca, porque
    // afirmar que un archivo es demasiado grande sin saber cuánto mide sería
    // inventarse un dato. Lo que se sepa lo preguntará la base.
    if (!Number.isFinite(tamano)) continue

    if (tamano > LIMITE_ADJUNTO_BYTES) {
      rechazados.push({
        nombreOriginal: adjunto.nombreOriginal,
        tamanoBytes: tamano,
        limiteBytes: LIMITE_ADJUNTO_BYTES
      })
    }
  }

  return rechazados
}
