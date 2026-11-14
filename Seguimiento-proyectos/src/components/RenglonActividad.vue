<template>
  <div class="renglon-tiempo">
    <q-btn
      :outline="!enMarcha"
      :unelevated="enMarcha"
      no-caps
      dense
      :icon="enMarcha ? 'stop' : 'play_arrow'"
      :label="enMarcha ? 'Detener' : 'Iniciar'"
      :color="enMarcha ? 'dg-error' : 'primary'"
      class="renglon-tiempo__boton control-touch boton-presionable"
      :loading="ocupado"
      :disable="ocupado || (!enMarcha && !puedeIniciar)"
      :aria-label="`${enMarcha ? 'Detener' : 'Iniciar'} el cronómetro: ${renglon.cliente}, ${renglon.tipo}`"
      @click="alternar"
    >
      <q-tooltip>{{ textoDelBoton }}</q-tooltip>
    </q-btn>

    <span v-if="enMarcha" class="renglon-tiempo__reloj" role="timer" aria-label="Tiempo en marcha">
      {{ formatearCronometro(cronometro.segundos) }}
      <q-tooltip>Tiempo que lleva en marcha el cronómetro de este renglón.</q-tooltip>
    </span>

    <q-btn
      flat
      no-caps
      dense
      icon="history"
      :label="formatearDuracion(renglon.minutos)"
      color="dg-texto-secundario"
      class="renglon-tiempo__acumulado control-touch boton-presionable"
      aria-haspopup="dialog"
      :aria-label="`Tiempo registrado en ${renglon.cliente}, ${renglon.tipo}: ${formatearDuracion(renglon.minutos)}. Abrir el detalle`"
      @click="abrirDetalle"
    >
      <q-tooltip
        >Tiempo registrado en este renglón este mes. Pulsa para ver los bloques, agregar tiempo a
        mano o borrar uno.</q-tooltip
      >
    </q-btn>

    <TiempoRegistradoDialog
      v-if="detalleMontado"
      v-model="detalleAbierto"
      :renglon="renglon"
      :mes="mes"
      @hide="detalleMontado = false"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'

import TiempoRegistradoDialog from './TiempoRegistradoDialog.vue'
import { useCronometroStore } from '../stores/cronometro.js'
import { formatearCronometro, formatearDuracion } from '../utils/actividades.js'

/*
 * Controles de tiempo de un renglón de la lista del mes o del calendario: «Iniciar»/«Detener» el
 * cronómetro, el tiempo acumulado (que abre «Tiempo registrado») y, mientras corre, el tiempo en marcha.
 * El renglón se identifica por cliente, tipo y `mes` (el mes de su lista).
 */
const props = defineProps({
  /** Renglón de la lista del mes (`cliente_id`, `tipo_id`, `cliente`, `tipo`, `minutos`, activos). */
  renglon: { type: Object, required: true },
  /** Mes del renglón (AAAA-MM). */
  mes: { type: String, required: true },
})

const $q = useQuasar()
const cronometro = useCronometroStore()
const ocupado = ref(false)
const detalleMontado = ref(false)
const detalleAbierto = ref(false)

const enMarcha = computed(
  () =>
    cronometro.activo?.cliente_id === props.renglon.cliente_id &&
    cronometro.activo?.tipo_id === props.renglon.tipo_id &&
    cronometro.activo?.mes === props.mes,
)
const puedeIniciar = computed(() => props.renglon.cliente_activo && props.renglon.tipo_activo)

const textoDelBoton = computed(() => {
  if (enMarcha.value) return 'Detiene el cronómetro y guarda el tiempo en este renglón.'
  if (!puedeIniciar.value)
    return 'Para medir tiempo en este renglón, reactiva el cliente y el tipo en «Clientes y tipos».'
  return cronometro.activo
    ? 'Detiene el cronómetro que está en marcha e inicia el de este renglón.'
    : 'Inicia un cronómetro para medir cuánto tiempo te lleva este renglón.'
})

const avisarError = (mensaje, error) =>
  $q.notify({ type: 'negative', message: mensaje, caption: error.mensaje, timeout: 8000 })

const detener = async () => {
  const { ok, bloque, error } = await cronometro.detener()
  if (ok) {
    $q.notify({
      type: 'positive',
      message: `Cronómetro detenido: se guardaron ${formatearDuracion(bloque.minutos)} en «${bloque.cliente}», ${bloque.tipo}.`,
      timeout: 5000,
    })
  } else {
    avisarError('No se pudo detener el cronómetro.', error)
  }
}

const iniciar = async () => {
  const { ok, detenido, error } = await cronometro.iniciar({
    cliente_id: props.renglon.cliente_id,
    tipo_id: props.renglon.tipo_id,
    mes: props.mes,
  })
  if (!ok) {
    avisarError(`No se pudo iniciar el cronómetro de «${props.renglon.cliente}».`, error)
    return
  }
  $q.notify({
    type: 'info',
    message: detenido
      ? `Se detuvo el cronómetro de «${detenido.cliente}», ${detenido.tipo} (${formatearDuracion(detenido.minutos)} guardados). Empezó el de «${props.renglon.cliente}».`
      : `Cronómetro iniciado: «${props.renglon.cliente}», ${props.renglon.tipo}.`,
    timeout: detenido ? 8000 : 3000,
  })
}

const alternar = async () => {
  if (ocupado.value) return
  ocupado.value = true
  try {
    await (enMarcha.value ? detener() : iniciar())
  } finally {
    ocupado.value = false
  }
}

const abrirDetalle = () => {
  detalleMontado.value = true
  detalleAbierto.value = true
}
</script>

<style scoped>
.renglon-tiempo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.renglon-tiempo__reloj {
  color: var(--dg-error);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: help;
}

.renglon-tiempo__acumulado {
  font-variant-numeric: tabular-nums;
}
</style>
