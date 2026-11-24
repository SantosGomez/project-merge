/*
 * Píldora elástica para un `q-btn-toggle` (idea de Rubber Segment de Vue Bits, sin dependencias):
 * `v-segmento-elastico` agrega detrás de los botones una píldora que, al cambiar de opción, se estira
 * desde la anterior hasta la nueva, se aplasta unos píxeles al llegar y se asienta. Sigue a la opción
 * activa por su `aria-pressed`, así que el `q-btn-toggle` conserva su teclado y su accesibilidad.
 * Hasta que la píldora está colocada (clase `segmento-elastico--listo`) el botón activo se ve como
 * siempre; con «reducir movimiento» la píldora se mueve sin animar.
 */

const DURACION_MS = 420
const MARGEN_PX = 3
const CURVA = 'cubic-bezier(0.23, 1, 0.32, 1)'

const px = (valor) => `${Math.round(valor)}px`

/**
 * Fotogramas (Web Animations) de la píldora entre dos opciones.
 * @param {{ left: number, width: number }} desde - posición y ancho de la opción anterior.
 * @param {{ left: number, width: number }} hasta - posición y ancho de la opción nueva.
 * @param {{ estirar?: number, aplastar?: number }} [opciones] - `estirar` de 0 (deslizar) a 1
 *   (cubrir las dos opciones); `aplastar`, píxeles que el borde de atrás pasa de la orilla al llegar.
 * @returns {Array<{ left: string, width: string, offset: number, easing: string }>} vacío si no cambia.
 */
export const fotogramasDeSegmento = (desde, hasta, { estirar = 1, aplastar = 3 } = {}) => {
  if (desde.left === hasta.left && desde.width === hasta.width) return []

  const derechaDesde = desde.left + desde.width
  const derechaHasta = hasta.left + hasta.width
  const haciaLaDerecha = hasta.left > desde.left
  const pasos = [{ left: desde.left, width: desde.width }]

  if (estirar > 0) {
    if (haciaLaDerecha) {
      const derecha = derechaDesde + (derechaHasta - derechaDesde) * estirar
      pasos.push({ left: desde.left, width: derecha - desde.left })
    } else {
      const izquierda = desde.left - (desde.left - hasta.left) * estirar
      pasos.push({ left: izquierda, width: derechaDesde - izquierda })
    }
  }
  if (aplastar > 0) {
    pasos.push(
      haciaLaDerecha
        ? { left: hasta.left + aplastar, width: hasta.width - aplastar }
        : { left: hasta.left, width: hasta.width - aplastar },
    )
  }
  pasos.push({ left: hasta.left, width: hasta.width })

  // Estirarse toma casi la mitad; el aplaste llega pronto y el asentado es el final suave.
  const OFFSETS = { 2: [0, 1], 3: [0, 0.7, 1], 4: [0, 0.45, 0.8, 1] }[pasos.length]
  return pasos.map((paso, i) => ({
    left: px(paso.left),
    width: px(paso.width),
    offset: OFFSETS[i],
    easing: CURVA,
  }))
}

const sinMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export const vSegmentoElastico = {
  mounted(el) {
    const pildora = document.createElement('span')
    pildora.className = 'segmento-elastico__pildora'
    pildora.setAttribute('aria-hidden', 'true')
    el.prepend(pildora)

    let anterior = null
    let animacion = null

    const medir = () => {
      const activo = el.querySelector('[aria-pressed="true"]')
      if (!activo) return null
      return { left: activo.offsetLeft + MARGEN_PX, width: activo.offsetWidth - 2 * MARGEN_PX }
    }

    const actualizar = (animar) => {
      const nuevo = medir()
      if (!nuevo || nuevo.width <= 0) {
        el.classList.remove('segmento-elastico--listo')
        anterior = null
        return
      }
      animacion?.cancel()
      pildora.style.left = px(nuevo.left)
      pildora.style.width = px(nuevo.width)
      el.classList.add('segmento-elastico--listo')
      if (animar && anterior && !sinMovimiento() && typeof pildora.animate === 'function') {
        const fotogramas = fotogramasDeSegmento(anterior, nuevo)
        if (fotogramas.length) animacion = pildora.animate(fotogramas, { duration: DURACION_MS })
      }
      anterior = nuevo
    }

    // Cambio de opción (clic, teclado o desde fuera): se anima. Cambio de tamaño: solo se recoloca.
    const alCambiar = new MutationObserver(() => actualizar(true))
    alCambiar.observe(el, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] })
    const alRedimensionar =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => actualizar(false))
    alRedimensionar?.observe(el)

    actualizar(false)

    el._segmentoElastico = () => {
      alCambiar.disconnect()
      alRedimensionar?.disconnect()
      animacion?.cancel()
      pildora.remove()
      el.classList.remove('segmento-elastico--listo')
    }
  },
  unmounted(el) {
    el._segmentoElastico?.()
    delete el._segmentoElastico
  },
}
