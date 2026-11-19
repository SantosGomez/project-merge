<template>
  <q-card flat bordered class="anio-juntas" :aria-label="`Calendario de juntas del año ${anio}`">
    <div ref="contenedor" class="anio-juntas__meses" @keydown="alTeclear" @focusin="alEnfocar">
      <section
        v-for="mes in meses"
        :key="mes.mes"
        :data-mes="mes.mes"
        class="anio-mes"
        :aria-labelledby="`anio-mes-${mes.mes}`"
      >
        <h3 :id="`anio-mes-${mes.mes}`" class="anio-mes__titulo">{{ mes.nombre }}</h3>
        <div class="anio-mes__semana anio-mes__dias-de-semana" aria-hidden="true">
          <span v-for="letra in LETRAS_DE_SEMANA" :key="letra.clave">{{ letra.texto }}</span>
        </div>
        <div v-for="(semana, indice) in mes.semanas" :key="indice" class="anio-mes__semana">
          <template v-for="(dia, posicion) in semana" :key="posicion">
            <span v-if="dia === null" class="anio-dia anio-dia--vacio" aria-hidden="true"></span>
            <q-btn
              v-else
              flat
              no-caps
              dense
              :ripple="false"
              :data-dia="dia"
              :tabindex="dia === diaConFoco ? 0 : -1"
              class="anio-dia boton-presionable"
              :class="[
                intensidadDeJuntas(cuentas[dia]) > 0
                  ? `anio-dia--nivel-${intensidadDeJuntas(cuentas[dia])}`
                  : '',
                { 'anio-dia--hoy': dia === hoy },
              ]"
              :aria-label="nombreAccesible(dia)"
              @click="emit('elegir-dia', dia)"
            >
              <span class="anio-dia__numero">{{ Number(dia.slice(8)) }}</span>
              <span v-if="cuentas[dia] > 0" class="anio-dia__cuenta" aria-hidden="true">{{
                cuentas[dia]
              }}</span>
            </q-btn>
          </template>
        </div>
      </section>
    </div>
  </q-card>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import {
  diaInicialDelAnio,
  intensidadDeJuntas,
  juntasPorDia,
  mesesDelAnio,
  moverDiaEnAnio,
  textoDiaConJuntas,
} from '../utils/juntas.js'

/*
 * Vista de año: 12 meses compactos de lunes a domingo. No pide datos: recibe el año y las juntas
 * del año; cada día con juntas lleva su cantidad (y su nombre accesible la dice con texto, por
 * ejemplo «18 de noviembre: 2 juntas»). Un clic en un día (o Enter) avisa con `elegir-dia` para abrir la
 * vista Día de esa fecha. Con teclado hay una sola parada de Tab (foco itinerante: la fecha elegida u hoy) y las
 * flechas mueven el foco; al abrir, el mes de esa fecha queda a la vista. El tinte de cada día crece con el
 * número de juntas (1, 2–3 y 4 o más).
 */
const props = defineProps({
  /** Año que se muestra. */
  anio: { type: Number, required: true },
  /** Juntas del año, tal como las devuelve la API. */
  juntas: { type: Array, default: () => [] },
  /** Hoy en AAAA-MM-DD, para marcar el día actual. */
  hoy: { type: String, default: '' },
  /** Fecha elegida AAAA-MM-DD: el día que recibe el foco y el mes que se muestra al abrir. */
  fecha: { type: String, default: '' },
})

const emit = defineEmits(['elegir-dia'])

const LETRAS_DE_SEMANA = [
  { clave: 'lunes', texto: 'L' },
  { clave: 'martes', texto: 'M' },
  { clave: 'miercoles', texto: 'M' },
  { clave: 'jueves', texto: 'J' },
  { clave: 'viernes', texto: 'V' },
  { clave: 'sabado', texto: 'S' },
  { clave: 'domingo', texto: 'D' },
]

const meses = computed(() => mesesDelAnio(props.anio))
const cuentas = computed(() => juntasPorDia(props.juntas, props.anio))

// Foco itinerante: solo este día está en el orden de Tab; las flechas lo mueven.
const contenedor = ref(null)
const diaConFoco = ref(diaInicialDelAnio(props.anio, props.fecha, props.hoy))
watch(
  () => [props.anio, props.fecha],
  () => {
    diaConFoco.value = diaInicialDelAnio(props.anio, props.fecha, props.hoy)
  },
)

const alEnfocar = (evento) => {
  const dia = evento.target.closest?.('[data-dia]')?.dataset.dia
  if (dia) diaConFoco.value = dia
}

const alTeclear = async (evento) => {
  const origen = evento.target.closest?.('[data-dia]')
  const destino = origen ? moverDiaEnAnio(origen.dataset.dia, evento.key) : null
  if (destino === null) return
  evento.preventDefault()
  diaConFoco.value = destino
  await nextTick()
  contenedor.value?.querySelector(`[data-dia="${destino}"]`)?.focus()
}

// Al abrir, el mes de la fecha elegida (u hoy) queda a la vista; el salto es instantáneo.
onMounted(() => {
  const mes = Number(diaConFoco.value.slice(5, 7)) - 1
  contenedor.value?.querySelector(`[data-mes="${mes}"]`)?.scrollIntoView({ block: 'center' })
})

const nombreAccesible = (dia) =>
  `${textoDiaConJuntas(dia, cuentas.value[dia] ?? 0)}${dia === props.hoy ? ' (hoy)' : ''}. Abre ese día.`
</script>

<style scoped>
.anio-juntas {
  overflow: hidden;
  border-color: var(--dg-borde);
  border-radius: 12px;
  background: var(--dg-superficie);
  color: var(--dg-texto);
}

.anio-juntas__meses {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  padding: 16px;
}

.anio-mes {
  min-width: 0;
}

.anio-mes__titulo {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
  text-transform: capitalize;
}

.anio-mes__semana {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
}

.anio-mes__dias-de-semana {
  margin-bottom: 2px;
  color: var(--dg-texto-secundario);
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
}

/* Un día sin juntas pesa poco: peso 400 y texto tenue. Los que tienen juntas suben de tinte y de peso. */
.anio-dia {
  position: relative;
  min-width: 0;
  min-height: 44px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  font-weight: 400;
}

.anio-dia--vacio {
  display: block;
}

.anio-dia :deep(.q-btn__content) {
  flex-direction: column;
  gap: 0;
  line-height: 1.1;
}

.anio-dia--nivel-1,
.anio-dia--nivel-2,
.anio-dia--nivel-3 {
  color: var(--dg-texto);
  font-weight: 700;
}

.anio-dia--nivel-1 {
  background: var(--dg-fondo-seleccion);
}

.anio-dia--nivel-2 {
  background: color-mix(in srgb, var(--dg-acento) 22%, var(--dg-superficie));
}

.anio-dia--nivel-3 {
  background: color-mix(in srgb, var(--dg-acento) 42%, var(--dg-superficie));
}

/* Hoy: anillo de 2 px en el color de foco, hacia adentro para que no tape a los vecinos. */
.anio-dia--hoy {
  box-shadow: inset 0 0 0 2px var(--dg-foco);
}

.anio-dia:focus-visible {
  z-index: 1;
  outline: 2px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

.anio-dia__cuenta {
  min-width: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--dg-acento);
  color: var(--dg-superficie);
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 16px;
}

/* Celular: dos meses por fila (uno solo en pantallas muy angostas) y los días miden 44 px. */
@media (max-width: 600px) {
  .anio-juntas__meses {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 10px;
    padding: 12px;
  }

  .anio-dia {
    min-height: 44px;
  }
}

@media (max-width: 479px) {
  .anio-juntas__meses {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
