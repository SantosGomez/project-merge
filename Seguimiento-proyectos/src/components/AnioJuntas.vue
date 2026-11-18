<template>
  <q-card flat bordered class="anio-juntas" :aria-label="`Calendario de juntas del año ${anio}`">
    <div class="anio-juntas__meses">
      <section
        v-for="mes in meses"
        :key="mes.mes"
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
              class="anio-dia boton-presionable"
              :class="{
                'anio-dia--con-juntas': cuentas[dia] > 0,
                'anio-dia--hoy': dia === hoy,
              }"
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
import { computed } from 'vue'

import { juntasPorDia, mesesDelAnio, textoDiaConJuntas } from '../utils/juntas.js'

/*
 * Vista de año: 12 meses compactos de lunes a domingo. No pide datos: recibe el año y las juntas
 * del año; cada día con juntas lleva su cantidad (y su nombre accesible la dice con texto, por
 * ejemplo «18 de noviembre: 2 juntas»). Un clic en un día avisa con `elegir-dia` para abrir la
 * vista Día de esa fecha.
 */
const props = defineProps({
  /** Año que se muestra. */
  anio: { type: Number, required: true },
  /** Juntas del año, tal como las devuelve la API. */
  juntas: { type: Array, default: () => [] },
  /** Hoy en AAAA-MM-DD, para marcar el día actual. */
  hoy: { type: String, default: '' },
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
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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

.anio-dia {
  position: relative;
  min-width: 0;
  min-height: 36px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--dg-texto);
  font-size: 0.85rem;
}

.anio-dia--vacio {
  display: block;
}

.anio-dia :deep(.q-btn__content) {
  flex-direction: column;
  gap: 0;
  line-height: 1.1;
}

.anio-dia--con-juntas {
  background: var(--dg-fondo-seleccion);
  font-weight: 700;
}

.anio-dia--hoy {
  border-color: var(--dg-acento);
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
