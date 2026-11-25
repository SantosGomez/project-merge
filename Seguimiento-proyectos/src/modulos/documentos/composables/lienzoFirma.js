// Cálculos puros del lienzo de firma: sin DOM, para poder probarlos con `node --test`.

/**
 * Tamaño interno del lienzo (en píxeles del dispositivo) a partir de su tamaño en
 * pantalla. Un `dpr` inválido o ausente cuenta como 1.
 */
export function medidasDelLienzo({ anchoCss, altoCss, dpr }) {
  const escala = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  return {
    ancho: Math.round(anchoCss * escala),
    alto: Math.round(altoCss * escala),
    escala,
  }
}

/** Posición del puntero en coordenadas CSS relativas a la esquina del lienzo. */
export function posicionEnLienzo(rect, evento) {
  return { x: evento.clientX - rect.left, y: evento.clientY - rect.top }
}
