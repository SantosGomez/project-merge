<template>
  <span class="contador-rodante">
    <span class="sr-only">{{ texto }}</span>
    <span class="contador-rodante__visible" aria-hidden="true">
      <template v-for="celda in celdas" :key="celda.clave">
        <span v-if="celda.tipo === 'signo'" class="contador-rodante__signo">{{
          celda.caracter
        }}</span>
        <span v-else class="contador-rodante__columna">
          <span
            class="contador-rodante__tira"
            :class="{ 'contador-rodante__tira--fija': celda.fijar }"
            :style="{
              transform: `translateY(${-celda.pos * ALTO_DIGITO}em)`,
              transitionDelay: `${celda.orden * RETRASO_POR_CIFRA}ms`,
            }"
            @transitionend="alTerminar(celda)"
          >
            <span v-for="n in 30" :key="n" class="contador-rodante__digito">{{
              (n - 1) % 10
            }}</span>
          </span>
        </span>
      </template>
    </span>
  </span>
</template>

<script setup>
/*
 * Número tipo odómetro (prueba en «experimento», idea del Counter de Vue Bits): cuando el valor
 * cambia, cada dígito rueda hasta el nuevo, en cascada desde la derecha y con un pequeño rebote.
 * Los caracteres que no son dígito quedan fijos. Hereda tipografía y color del contenedor.
 * El lector de pantalla lee el texto normal; con «reducir movimiento» no hay animación.
 */
import { computed, ref, watch } from 'vue'

import { celdasDelContador } from '../utils/contadorRodante.js'

const props = defineProps({
  /** Número o texto a mostrar, por ejemplo 13 o «01:05:09». */
  valor: { type: [Number, String], required: true },
})

/** Alto de cada dígito en em: el mismo que el alto de línea de la columna. */
const ALTO_DIGITO = 1.2
const RETRASO_POR_CIFRA = 40

const texto = computed(() => String(props.valor))
const celdas = ref(celdasDelContador(texto.value, null, []))

const sinMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

watch(texto, (nuevo, viejo) => {
  celdas.value = celdasDelContador(nuevo, viejo, celdas.value, { sinMovimiento: sinMovimiento() })
})

// Tras rodar por el tramo de arriba o de abajo, vuelve al de en medio sin que se note.
const alTerminar = (celda) => {
  if (!celda.salto) return
  celda.salto = false
  celda.fijar = true
  celda.pos = 10 + celda.digito
  requestAnimationFrame(() => requestAnimationFrame(() => (celda.fijar = false)))
}
</script>

<style scoped>
.contador-rodante__visible {
  display: inline-flex;
  align-items: flex-start;
  height: 1.2em;
  line-height: 1.2em;
  font-variant-numeric: tabular-nums;
  vertical-align: bottom;
}

.contador-rodante__columna {
  display: inline-block;
  height: 1.2em;
  overflow: hidden;
}

.contador-rodante__tira {
  display: flex;
  flex-direction: column;
  transition: transform 550ms var(--dg-curva-rebote);
  will-change: transform;
}

.contador-rodante__tira--fija {
  transition: none;
}

.contador-rodante__digito,
.contador-rodante__signo {
  display: block;
  height: 1.2em;
  line-height: 1.2em;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .contador-rodante__tira {
    transition: none;
  }
}
</style>
