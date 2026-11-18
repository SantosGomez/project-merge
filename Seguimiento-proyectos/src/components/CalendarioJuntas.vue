<template>
  <q-card
    flat
    bordered
    class="calendario-juntas"
    :aria-label="`Calendario de juntas: ${textoDeVista}`"
  >
    <!-- Mes: cuadrícula de lunes a domingo; cada junta es una etiqueta con su hora y su título. -->
    <div v-if="vista === 'mes'" class="calendario-juntas__scroll">
      <QCalendarMonth
        :model-value="fecha"
        :weekdays="DIAS_DEL_MES"
        locale="es-MX"
        :day-min-height="104"
        :mini-mode="false"
        enable-outside-days
        no-active-date
        bordered
        class="calendario-juntas__calendario calendario-juntas__calendario--mes"
      >
        <template #day="{ scope }">
          <div class="calendario-juntas__dia">
            <q-btn
              v-for="junta in juntasDelDia(juntas, scope.timestamp.date)"
              :key="junta.id"
              unelevated
              no-caps
              dense
              align="left"
              :ripple="false"
              class="junta-etiqueta boton-presionable"
              :aria-label="nombreAccesible(junta)"
              @click.stop="emit('abrir-junta', junta)"
            >
              <span class="junta-etiqueta__hora">{{ horaDeFechaHora(junta.inicio) }}</span>
              <span class="junta-etiqueta__titulo">{{ junta.titulo }}</span>
              <q-tooltip>{{ junta.titulo }} · {{ horarioDeJunta(junta) }}</q-tooltip>
            </q-btn>
          </div>
        </template>
      </QCalendarMonth>
    </div>

    <!-- Semana (lunes a viernes) y día: de 8:00 a 19:00; un clic en un hueco vacío crea una junta. -->
    <div v-else class="calendario-juntas__scroll">
      <QCalendarDay
        :model-value="fecha"
        :view="vista === 'semana' ? 'week' : 'day'"
        :weekdays="vista === 'semana' ? DIAS_LABORALES : TODOS_LOS_DIAS"
        locale="es-MX"
        hour24-format
        time-clicks-clamped
        no-active-date
        bordered
        :interval-minutes="MINUTOS_POR_HUECO"
        :interval-start="(HORA_INICIO_VISTA * 60) / MINUTOS_POR_HUECO"
        :interval-count="((HORA_FIN_VISTA - HORA_INICIO_VISTA) * 60) / MINUTOS_POR_HUECO"
        :interval-height="ALTO_DE_HUECO"
        :show-interval-label="(marca) => marca.minute === 0"
        class="calendario-juntas__calendario"
        :class="{ 'calendario-juntas__calendario--semana': vista === 'semana' }"
        @click-time="alElegirHueco"
      >
        <template #day-body="{ scope }">
          <q-btn
            v-for="bloque in bloquesDelDia(scope.timestamp.date)"
            :key="bloque.junta.id"
            unelevated
            no-caps
            dense
            align="left"
            :ripple="false"
            class="junta-bloque boton-presionable"
            :style="estiloDeBloque(bloque)"
            :aria-label="nombreAccesible(bloque.junta)"
            @click.stop="emit('abrir-junta', bloque.junta)"
          >
            <span class="junta-bloque__texto">
              <span class="junta-bloque__titulo">{{ bloque.junta.titulo }}</span>
              <span class="junta-bloque__horario">{{ horarioDeJunta(bloque.junta) }}</span>
            </span>
            <q-tooltip>{{ bloque.junta.titulo }} · {{ horarioDeJunta(bloque.junta) }}</q-tooltip>
          </q-btn>
        </template>
      </QCalendarDay>
    </div>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { QCalendarDay } from '@quasar/quasar-ui-qcalendar/QCalendarDay'
import { QCalendarMonth } from '@quasar/quasar-ui-qcalendar/QCalendarMonth'
import '@quasar/quasar-ui-qcalendar/QCalendarDay.css'
import '@quasar/quasar-ui-qcalendar/QCalendarMonth.css'

import {
  HORA_FIN_VISTA,
  HORA_INICIO_VISTA,
  distribuirSolapadas,
  horaDeFechaHora,
  horarioDeJunta,
  juntasDelDia,
  segmentoDelDia,
  textoPeriodo,
} from '../utils/juntas.js'

/*
 * Calendario de juntas con QCalendar (importado solo aquí, no como plugin global). No pide datos:
 * recibe la vista, la fecha y las juntas del periodo; avisa con `abrir-junta` (clic en una junta)
 * y `nueva-junta` (clic en un hueco vacío de semana o día). El idioma es es-MX y los colores salen
 * de la paleta `--dg-*` (ver los estilos de abajo).
 */
const props = defineProps({
  /** 'mes', 'semana' o 'dia'. */
  vista: { type: String, required: true },
  /** Fecha de referencia AAAA-MM-DD. */
  fecha: { type: String, required: true },
  /** Juntas del periodo, tal como las devuelve la API. */
  juntas: { type: Array, default: () => [] },
})

const emit = defineEmits(['abrir-junta', 'nueva-junta'])

// Días de la semana de QCalendar: 0 es domingo.
const DIAS_DEL_MES = [1, 2, 3, 4, 5, 6, 0]
const DIAS_LABORALES = [1, 2, 3, 4, 5]
const TODOS_LOS_DIAS = [1, 2, 3, 4, 5, 6, 0]

// Cada hueco dura 30 minutos y mide 30 px: un minuto es un píxel.
const MINUTOS_POR_HUECO = 30
const ALTO_DE_HUECO = 30
const ALTO_MINIMO_DE_BLOQUE = 24

const textoDeVista = computed(() => textoPeriodo(props.vista, props.fecha))

const nombreAccesible = (junta) =>
  `Junta ${junta.titulo}, ${horarioDeJunta(junta)}. Abre los datos de la junta.`

// Bloques de un día con su columna, para que las juntas que se cruzan no se tapen.
const bloquesDelDia = (dia) =>
  distribuirSolapadas(
    props.juntas.flatMap((junta) => {
      const segmento = segmentoDelDia(junta, dia)
      return segmento ? [{ ...segmento, junta }] : []
    }),
  )

const estiloDeBloque = (bloque) => ({
  top: `${bloque.desde - HORA_INICIO_VISTA * 60}px`,
  height: `${Math.max(bloque.hasta - bloque.desde, ALTO_MINIMO_DE_BLOQUE)}px`,
  left: `calc(${(bloque.columna / bloque.columnas) * 100}% + 2px)`,
  width: `calc(${100 / bloque.columnas}% - 4px)`,
})

const alElegirHueco = ({ scope }) => {
  emit('nueva-junta', { fecha: scope.timestamp.date, hora: scope.timestamp.time })
}
</script>

<style scoped>
/*
 * Colores de QCalendar con la paleta de la app. QCalendar define los suyos en :root con
 * hexadecimales propios; aquí se declaran solo los que usan las vistas de mes, semana y día.
 */
.calendario-juntas {
  --calendar-border: 1px solid var(--dg-borde);
  --calendar-border-section: 1px dashed var(--dg-borde);
  --calendar-border-current: 2px solid var(--dg-acento);
  --calendar-color: var(--dg-texto);
  --calendar-background: var(--dg-superficie);
  --calendar-current-color: var(--dg-acento);
  --calendar-current-background: var(--dg-superficie);
  --calendar-disabled-date-color: var(--dg-texto-tenue);
  --calendar-disabled-date-background: var(--dg-fondo-panel);
  --calendar-active-date-color: var(--dg-acento);
  --calendar-active-date-background: var(--dg-fondo-seleccion);
  --calendar-outside-color: var(--dg-texto-tenue);
  --calendar-outside-background: var(--dg-fondo-panel);
  --calendar-selected-color: var(--dg-acento);
  --calendar-selected-background: var(--dg-fondo-seleccion);
  --calendar-range-color: var(--dg-acento);
  --calendar-range-background: var(--dg-fondo-seleccion);
  --calendar-scrollbar-width-height: 10px;
  --calendar-scrollbar-track: var(--dg-fondo-suave);
  --calendar-scrollbar-thumb: var(--dg-borde-discontinuo);
  --calendar-scrollbar-thumb-hover: var(--dg-texto-tenue);
  --calendar-intervals-width: 56px;
  --calendar-work-week-width: 30px;
  --calendar-mini-work-week-width: 30px;
  --calendar-head-font-weight: 600;

  overflow: hidden;
  border-radius: 12px;
  border-color: var(--dg-borde);
  background: var(--dg-superficie);
  color: var(--dg-texto);
}

/* Celular: la cuadrícula se desplaza dentro de su propio contenedor, no la página entera. */
.calendario-juntas__scroll {
  overflow-x: auto;
}

.calendario-juntas__calendario {
  min-width: 100%;
}

.calendario-juntas__calendario--mes {
  min-width: 640px;
}

.calendario-juntas__calendario--semana {
  min-width: 640px;
}

/* Capas de QCalendar que usan blanco y negro fijos: se llevan a la paleta. */
.calendario-juntas :deep(.q-calendar__focus-helper:before) {
  background: var(--dg-texto);
}

.calendario-juntas :deep(.q-calendar__focus-helper:after) {
  background: var(--dg-superficie);
}

/* Hora de cada hueco: el texto de QCalendar pasa a la paleta. */
.calendario-juntas :deep(.q-calendar-day__interval--text) {
  color: var(--dg-texto-secundario);
  font-size: 0.8rem;
}

.calendario-juntas :deep(.q-calendar-day__interval),
.calendario-juntas :deep(.q-calendar-day__day-interval) {
  cursor: pointer;
}

.calendario-juntas :deep(.q-calendar-day__day-interval:hover) {
  background: var(--dg-fondo-hover);
}

.calendario-juntas__dia {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 4px 6px;
}

/* Junta en el mes: una línea con la hora y el título. */
.junta-etiqueta {
  min-height: 24px;
  max-width: 100%;
  padding: 1px 6px;
  border-left: 3px solid var(--dg-acento);
  border-radius: 4px;
  background: var(--dg-fondo-seleccion);
  color: var(--dg-texto);
  font-size: 0.78rem;
  text-align: left;
}

.junta-etiqueta:hover {
  background: var(--dg-fondo-hover);
}

.junta-etiqueta :deep(.q-btn__content) {
  display: flex;
  flex-wrap: nowrap;
  align-items: baseline;
  justify-content: flex-start;
  gap: 4px;
  min-width: 0;
  width: 100%;
}

.junta-etiqueta__hora {
  flex: none;
  font-weight: 700;
}

.junta-etiqueta__titulo {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Junta en semana y día: un bloque sobre su franja horaria. */
.junta-bloque {
  position: absolute;
  z-index: 1;
  overflow: hidden;
  padding: 2px 6px;
  border-left: 4px solid var(--dg-acento);
  border-radius: 6px;
  background: var(--dg-fondo-seleccion);
  color: var(--dg-texto);
  font-size: 0.8rem;
  text-align: left;
}

.junta-bloque:hover {
  background: var(--dg-fondo-hover);
}

.junta-bloque :deep(.q-btn__content) {
  align-items: flex-start;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
}

.junta-bloque__texto {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  max-width: 100%;
  line-height: 1.25;
  text-align: left;
}

.junta-bloque__titulo {
  max-width: 100%;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.junta-bloque__horario {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
