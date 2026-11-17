<template>
  <div class="semana">
    <div class="semana__cabecera">
      <p class="semana__mes">{{ mesDeLaTira }}</p>
      <q-btn
        flat
        no-caps
        dense
        color="primary"
        :icon="mesVisible ? 'expand_less' : 'expand_more'"
        :label="mesVisible ? 'Ocultar mes' : 'Ver mes'"
        class="control-touch boton-presionable"
        :aria-expanded="String(mesVisible)"
        @click="emit('alternar-mes')"
      >
        <q-tooltip>{{
          mesVisible
            ? 'Vuelve a mostrar solo la tira de la semana.'
            : 'Despliega el calendario completo del mes.'
        }}</q-tooltip>
      </q-btn>
    </div>

    <div
      ref="tira"
      class="semana__tira"
      role="group"
      aria-label="Días de la semana: desliza de lado para ver otras semanas"
    >
      <q-btn
        v-for="dia in dias"
        :key="dia"
        :data-dia="dia"
        flat
        no-caps
        :class="[
          'semana__dia',
          'boton-presionable',
          {
            'semana__dia--elegido': dia === diaElegido,
            'semana__dia--hoy': dia === hoy,
            'semana__dia--lunes': nombreCorto(dia) === 'lun',
          },
        ]"
        :aria-pressed="String(dia === diaElegido)"
        :aria-label="etiquetaAccesible(dia)"
        @click="emit('elegir-dia', dia)"
      >
        <span class="semana__nombre" aria-hidden="true">{{ nombreCorto(dia) }}</span>
        <span class="semana__numero" aria-hidden="true">{{ numeroDe(dia) }}</span>
        <span
          class="semana__marca"
          :class="marcas[dia] ? `semana__marca--${marcas[dia]}` : ''"
          aria-hidden="true"
        ></span>
      </q-btn>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { diasDeTira } from '../utils/calendarioAdministrador.js'
import { tituloDeDia } from '../utils/actividades.js'

/*
 * Tira de la semana para celular y tableta: tres semanas de lunes a domingo que se deslizan de
 * lado, cada día con su número y una marca de color. «Ver mes» despliega el calendario completo
 * (lo pinta el componente padre). Solo presenta: el día elegido y las marcas llegan por props.
 */
const props = defineProps({
  /** Marca de cada día (`marcasPorDia`): vencido, pronto o a-tiempo. */
  marcas: { type: Object, required: true },
  /** Día elegido AAAA-MM-DD, o null en la vista general. */
  diaElegido: { type: String, default: null },
  /** Hoy AAAA-MM-DD. */
  hoy: { type: String, required: true },
  mesVisible: { type: Boolean, default: false },
})

const emit = defineEmits(['elegir-dia', 'alternar-mes'])

const NOMBRES_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const TEXTOS_DE_MARCA = { vencido: 'vencidos', pronto: 'vencen pronto', 'a-tiempo': 'a tiempo' }

// La tira se centra en el día elegido o, si no hay, en hoy.
const base = computed(() => props.diaElegido ?? props.hoy)
const dias = computed(() => diasDeTira(base.value))

const nombreCorto = (dia) => {
  const [anio, mes, numero] = dia.split('-').map(Number)
  return NOMBRES_CORTOS[new Date(anio, mes - 1, numero).getDay()]
}
const numeroDe = (dia) => Number(dia.slice(8, 10))

const etiquetaAccesible = (dia) => {
  const marca = props.marcas[dia]
  return marca ? `${tituloDeDia(dia)} — ${TEXTOS_DE_MARCA[marca]}` : tituloDeDia(dia)
}

const mesDeLaTira = computed(() => {
  const partes = tituloDeDia(base.value).split(' ')
  return `${partes[3]} ${partes[5]}`.replace(/^./, (letra) => letra.toUpperCase())
})

const tira = ref(null)

// Deja a la vista la semana (de lunes a domingo) del día base, sin mover la página.
const alinearSemana = async () => {
  await nextTick()
  const contenedor = tira.value
  const lunes = contenedor?.querySelector(`[data-dia="${dias.value[7]}"]`)
  if (lunes) contenedor.scrollLeft = lunes.offsetLeft
}

onMounted(alinearSemana)
watch(base, alinearSemana)
</script>

<style scoped>
.semana {
  min-width: 0;
}

.semana__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.semana__mes {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  font-weight: 600;
}

.semana__tira {
  position: relative;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 4px 0 8px;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  scrollbar-color: var(--dg-borde-fuerte) transparent;
}

.semana__dia {
  flex: 0 0 calc((100% - 24px) / 7);
  min-width: 44px;
  min-height: 64px;
  padding: 4px 0;
  border: 1px solid var(--dg-borde);
  border-radius: 10px;
  background: var(--dg-superficie);
  color: var(--dg-texto);
}

.semana__dia--lunes {
  scroll-snap-align: start;
}

.semana__dia :deep(.q-btn__content) {
  flex-direction: column;
  gap: 2px;
}

.semana__nombre {
  color: var(--dg-texto-tenue);
  font-size: 0.75rem;
  text-transform: uppercase;
}

.semana__numero {
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.1;
}

.semana__marca {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;
}

.semana__marca--vencido {
  background: var(--dg-error);
}

.semana__marca--pronto {
  background: var(--dg-importante);
}

.semana__marca--a-tiempo {
  background: var(--dg-exito);
}

.semana__dia--hoy {
  border-color: var(--dg-acento);
}

.semana__dia--elegido {
  border-color: var(--dg-acento);
  background: var(--dg-fondo-seleccion);
}

.semana__dia:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}
</style>
