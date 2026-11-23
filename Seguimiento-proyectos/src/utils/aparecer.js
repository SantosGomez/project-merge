/*
 * Entrada animada (prueba en «experimento», idea de Animated Content de Vue Bits, sin GSAP):
 * `v-aparecer="{ orden, duracion, desenfoque, distancia, cortina }"` hace que el elemento entre
 * desenfocado, subiendo y desvaneciéndose, la primera vez que aparece en pantalla. `orden` lo
 * escalona (90 ms por paso) y `cortina` lo descubre con un borde suave desde la izquierda.
 * Al terminar se quitan clases y variables (no queda ningún transform que afecte al contenido).
 * Con «reducir movimiento», sin IntersectionObserver o con `apagado: true` no hace nada: el contenido
 * se ve de inmediato. `reproducirAparicion(raiz)` repite la entrada de los bloques de un contenedor
 * (por ejemplo, al volver a una pestaña que se conserva en memoria y no se monta de nuevo).
 */

const PASO_ORDEN_MS = 90

/**
 * Variables CSS de la entrada a partir de las opciones de la directiva.
 * @param {{ orden?: number, duracion?: number, desenfoque?: number, distancia?: number }} [opciones]
 * @returns {Record<string, string>}
 */
export const variablesDeAparicion = ({
  orden = 0,
  duracion = 500,
  desenfoque = 6,
  distancia = 24,
} = {}) => ({
  '--aparecer-retraso': `${orden * PASO_ORDEN_MS}ms`,
  '--aparecer-duracion': `${duracion}ms`,
  '--aparecer-desenfoque': `${desenfoque}px`,
  '--aparecer-distancia': `${distancia}px`,
})

const CLASES = ['aparecer', 'aparecer--activo', 'aparecer--cortina']

const sinMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export const vAparecer = {
  mounted(el, { value = {} }) {
    if (value.apagado || sinMovimiento() || typeof IntersectionObserver === 'undefined') return

    let variables = {}
    let respaldo = 0

    // Deja el elemento listo para entrar: variables y clase que lo oculta.
    const preparar = (desfase = 0) => {
      variables = variablesDeAparicion({ ...value, orden: (value.orden ?? 0) - desfase })
      for (const [nombre, valor] of Object.entries(variables)) el.style.setProperty(nombre, valor)
      el.classList.add('aparecer')
      if (value.cortina) el.classList.add('aparecer--cortina')
    }

    const terminar = () => {
      clearTimeout(respaldo)
      el.classList.remove(...CLASES)
      for (const nombre of Object.keys(variables)) el.style.removeProperty(nombre)
      el.removeEventListener('animationend', alTerminarAnimacion)
    }
    // animationend burbujea: solo cuenta la animación del propio elemento.
    const alTerminarAnimacion = (evento) => {
      if (evento.target === el && evento.animationName === 'aparecer') terminar()
    }

    const animar = () => {
      el.addEventListener('animationend', alTerminarAnimacion)
      el.classList.add('aparecer--activo')
      // Respaldo por si la animación no termina (pestaña oculta): nunca queda contenido invisible.
      const total =
        parseInt(variables['--aparecer-retraso']) + parseInt(variables['--aparecer-duracion'])
      respaldo = setTimeout(terminar, total + 500)
    }

    preparar()
    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((entrada) => entrada.isIntersecting)) return
        observador.disconnect()
        animar()
      },
      { threshold: 0.1 },
    )
    observador.observe(el)

    el._aparecerOrden = value.orden ?? 0
    // Repetir: se cancela lo que hubiera en curso y la animación arranca de nuevo (el reflow la reinicia).
    el._aparecerReproducir = (desfase = 0) => {
      if (sinMovimiento()) return
      observador.disconnect()
      terminar()
      preparar(desfase)
      void el.offsetWidth
      animar()
    }
    el._aparecer = () => {
      observador.disconnect()
      terminar()
    }
  },
  unmounted(el) {
    el._aparecer?.()
    delete el._aparecer
    delete el._aparecerReproducir
    delete el._aparecerOrden
  },
}

/**
 * Repite la entrada de `raiz` y de sus bloques con `v-aparecer`, haciéndolos empezar desde el de
 * menor orden (así la pestaña que se abre no espera el turno del encabezado).
 * @param {Element|null|undefined} raiz
 */
export const reproducirAparicion = (raiz) => {
  if (!raiz) return
  const bloques = [raiz, ...raiz.querySelectorAll('*')].filter(
    (el) => typeof el._aparecerReproducir === 'function',
  )
  if (bloques.length === 0) return
  const desfase = Math.min(...bloques.map((el) => el._aparecerOrden ?? 0))
  for (const el of bloques) el._aparecerReproducir(desfase)
}
