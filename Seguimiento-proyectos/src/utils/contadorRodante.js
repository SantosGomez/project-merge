/*
 * Lógica del número tipo odómetro (`ContadorRodante.vue`, prueba en «experimento», idea del
 * Counter de Vue Bits). Cada dígito se dibuja como una tira 0-9 repetida tres veces (30
 * posiciones); en reposo queda en el tramo del medio (10 + dígito). Para rodar «hacia adelante»
 * de 9 a 0 se va al tramo de arriba (20 + dígito) y luego se vuelve sin animación al reposo; para
 * rodar hacia atrás de 0 a 9, al tramo de abajo (dígito). `salto` marca esas celdas.
 */

/** Valor numérico del texto, solo con sus dígitos (sirve para «12» y para «01:05:09»). */
const numeroDe = (texto) => Number(String(texto ?? '').replace(/\D/g, '') || 0)

/**
 * Celdas a dibujar para `nuevo`, sabiendo cómo estaba antes (`viejo` y sus `previas` celdas).
 * Las claves cuentan desde la derecha para que las unidades sigan siendo la misma celda aunque
 * el número gane o pierda cifras.
 * @param {string} nuevo
 * @param {string|null} viejo - null en el primer dibujo.
 * @param {Array} previas - celdas del dibujo anterior.
 * @param {{ sinMovimiento?: boolean }} [opciones]
 * @returns {Array<{clave:string, tipo:'digito'|'signo', caracter?:string, digito?:number, pos?:number, salto?:boolean, orden:number}>}
 */
export const celdasDelContador = (nuevo, viejo, previas, { sinMovimiento = false } = {}) => {
  const caracteres = [...String(nuevo ?? '')]
  const anteriores = new Map(previas.map((celda) => [celda.clave, celda]))
  const sube = viejo === null || numeroDe(nuevo) >= numeroDe(viejo)

  return caracteres.map((caracter, indice) => {
    const orden = caracteres.length - 1 - indice
    if (!/\d/.test(caracter)) return { clave: `s${orden}`, tipo: 'signo', caracter, orden }

    const digito = Number(caracter)
    const clave = `d${orden}`
    const antes = anteriores.get(clave)
    let pos = 10 + digito
    let salto = false
    if (antes && viejo !== null && !sinMovimiento && antes.digito !== digito) {
      if (sube && digito < antes.digito) {
        pos = 20 + digito
        salto = true
      } else if (!sube && digito > antes.digito) {
        pos = digito
        salto = true
      }
    }
    return { clave, tipo: 'digito', digito, pos, salto, orden }
  })
}
