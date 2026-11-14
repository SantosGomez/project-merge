<template>
  <q-card
    v-if="cronometro.activo"
    ref="aviso"
    flat
    bordered
    class="cronometro-activo"
    :class="{ 'cronometro-activo--aviso': cronometro.masDeDiezHoras }"
    role="region"
    aria-label="Cronómetro en marcha"
  >
    <q-card-section class="cronometro-activo__cuerpo">
      <q-icon name="timer" size="28px" class="cronometro-activo__icono" aria-hidden="true" />

      <div class="cronometro-activo__texto">
        <p class="cronometro-activo__titulo">
          Cronómetro en marcha:
          <strong>{{ cronometro.activo.cliente }}</strong>
          <span class="cronometro-activo__tipo">
            · {{ cronometro.activo.tipo }} · {{ etiquetaDeMes(cronometro.activo.mes) }}
          </span>
        </p>
        <p v-if="cronometro.masDeDiezHoras" class="cronometro-activo__aviso">
          <q-icon name="warning_amber" size="18px" aria-hidden="true" />
          Lleva más de 10 horas en marcha; revisa si lo olvidaste.
        </p>
      </div>

      <span class="cronometro-activo__reloj" role="timer" aria-label="Tiempo transcurrido">
        {{ formatearCronometro(cronometro.segundos) }}
        <q-tooltip>Tiempo que lleva en marcha este cronómetro.</q-tooltip>
      </span>

      <q-btn
        unelevated
        no-caps
        icon="stop"
        label="Detener"
        color="dg-error"
        class="control-touch boton-presionable"
        :loading="deteniendo"
        :disable="deteniendo"
        :aria-label="`Detener el cronómetro: ${cronometro.activo.cliente}, ${cronometro.activo.tipo}`"
        @click="detener"
      >
        <q-tooltip>Detiene el cronómetro y guarda el tiempo en su renglón.</q-tooltip>
      </q-btn>
    </q-card-section>
  </q-card>

  <!-- Al desplazarte el aviso sale de la pantalla: una barra fija abajo mantiene el tiempo y «Detener» a la mano. -->
  <q-page-sticky v-if="cronometro.activo" position="bottom" expand class="cronometro-fijo">
    <transition name="cronometro-fijo">
      <div
        v-if="cronometro.activo && !avisoALaVista"
        class="cronometro-fijo__barra"
        :class="{ 'cronometro-fijo__barra--aviso': cronometro.masDeDiezHoras }"
        role="group"
        aria-label="Cronómetro en marcha, acceso rápido"
      >
        <q-icon name="timer" size="22px" aria-hidden="true" />
        <span class="cronometro-fijo__texto">
          <strong>{{ cronometro.activo.cliente }}</strong>
          <span class="cronometro-fijo__tipo"> · {{ cronometro.activo.tipo }}</span>
        </span>
        <span class="cronometro-fijo__reloj" aria-hidden="true">
          {{ formatearCronometro(cronometro.segundos) }}
        </span>
        <q-btn
          unelevated
          no-caps
          icon="stop"
          label="Detener"
          color="dg-error"
          class="control-touch boton-presionable"
          :loading="deteniendo"
          :disable="deteniendo"
          :aria-label="`Detener el cronómetro: ${cronometro.activo.cliente}, ${cronometro.activo.tipo}`"
          @click="detener"
        >
          <q-tooltip anchor="top middle" self="bottom middle">
            Detiene el cronómetro y guarda el tiempo en su renglón.
          </q-tooltip>
        </q-btn>
      </div>
    </transition>
  </q-page-sticky>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import { useCronometroStore } from '../stores/cronometro.js'
import { etiquetaDeMes, formatearCronometro, formatearDuracion } from '../utils/actividades.js'

/*
 * Aviso fijo del cronómetro en marcha. Va arriba de las tres vistas de «Mis actividades», con cliente,
 * tipo, mes, tiempo transcurrido y «Detener». El tiempo está en un `role="timer"` (no se anuncia cada
 * segundo). Este componente es quien enciende el reloj del store mientras haya un cronómetro. Cuando el
 * aviso queda fuera de la pantalla (al desplazarte por la lista), una barra fija abajo lo sustituye.
 */
const $q = useQuasar()
const cronometro = useCronometroStore()
const deteniendo = ref(false)

let temporizador = null
const apagarReloj = () => {
  if (temporizador !== null) clearInterval(temporizador)
  temporizador = null
}

watch(
  () => cronometro.activo?.id ?? null,
  (id) => {
    apagarReloj()
    if (id !== null) temporizador = setInterval(() => cronometro.actualizarReloj(), 1000)
  },
  { immediate: true },
)
onBeforeUnmount(apagarReloj)

// El panel de la pestaña tiene su propio desbordamiento y `position: sticky` no se sostiene ahí: se
// observa si el aviso sigue a la vista (bajo la barra superior de 52 px) y, si no, se muestra la barra fija.
const aviso = ref(null)
const avisoALaVista = ref(true)
let observador = null
const dejarDeObservar = () => {
  observador?.disconnect()
  observador = null
}
watch(
  aviso,
  (tarjeta) => {
    dejarDeObservar()
    avisoALaVista.value = true
    const elemento = tarjeta?.$el
    if (!elemento || typeof IntersectionObserver === 'undefined') return
    observador = new IntersectionObserver(
      ([entrada]) => {
        avisoALaVista.value = entrada.isIntersecting
      },
      { rootMargin: '-56px 0px 0px 0px' },
    )
    observador.observe(elemento)
  },
  { flush: 'post' },
)
onBeforeUnmount(dejarDeObservar)

const detener = async () => {
  if (deteniendo.value) return
  deteniendo.value = true
  const { ok, bloque, error } = await cronometro.detener()
  deteniendo.value = false
  if (ok) {
    $q.notify({
      type: 'positive',
      message: `Cronómetro detenido: se guardaron ${formatearDuracion(bloque.minutos)} en «${bloque.cliente}», ${bloque.tipo}.`,
      timeout: 5000,
    })
  } else {
    $q.notify({
      type: 'negative',
      message: 'No se pudo detener el cronómetro.',
      caption: error.mensaje,
      timeout: 8000,
    })
  }
}
</script>

<style scoped>
.cronometro-activo {
  margin: 0 0 16px;
  border-radius: 12px;
  border-color: var(--dg-info-borde);
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
}

.cronometro-activo--aviso {
  border-color: var(--dg-aviso-borde);
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-texto);
}

.cronometro-activo__cuerpo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.cronometro-activo__texto {
  flex: 1 1 220px;
  min-width: 0;
}

.cronometro-activo__titulo,
.cronometro-activo__aviso {
  margin: 0;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.cronometro-activo__aviso {
  margin-top: 4px;
  font-weight: 700;
}

.cronometro-activo__reloj {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: help;
}

/* Sobre el contenido de la página y debajo de la barra superior, el menú y los diálogos de Quasar. */
.cronometro-fijo {
  z-index: 1000;
}

.cronometro-fijo__barra {
  display: flex;
  align-items: center;
  gap: 8px 12px;
  width: 100%;
  padding: 8px 16px;
  border-top: 1px solid var(--dg-info-borde);
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
  box-shadow: var(--dg-sombra-menu);
}

.cronometro-fijo__barra--aviso {
  border-top-color: var(--dg-aviso-borde);
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-texto);
}

.cronometro-fijo__texto {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* El botón no cede ancho al nombre: su rótulo se queda en una línea. */
.cronometro-fijo__barra .control-touch {
  flex: 0 0 auto;
  white-space: nowrap;
}

.cronometro-fijo__reloj {
  flex: 0 0 auto;
  font-size: 1.15rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* En celular el nombre del cliente basta: el tipo ya se vio en el aviso de arriba. */
@media (max-width: 599px) {
  .cronometro-fijo__tipo {
    display: none;
  }
}

/* Entra desde abajo, de donde sale; al irse es más rápida. */
.cronometro-fijo-enter-active {
  transition:
    opacity 180ms var(--dg-curva-salida),
    transform 180ms var(--dg-curva-salida);
}

.cronometro-fijo-leave-active {
  transition:
    opacity 120ms var(--dg-curva-salida),
    transform 120ms var(--dg-curva-salida);
}

.cronometro-fijo-enter-from,
.cronometro-fijo-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

/* Con movimiento reducido solo hay fundido. */
@media (prefers-reduced-motion: reduce) {
  .cronometro-fijo-enter-from,
  .cronometro-fijo-leave-to {
    transform: none;
  }
}
</style>
