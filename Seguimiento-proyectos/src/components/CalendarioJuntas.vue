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
              v-for="vencimiento in vencimientosDelDia(vencimientos, scope.timestamp.date)"
              :key="vencimiento.clave"
              unelevated
              no-caps
              dense
              align="left"
              :ripple="false"
              class="vencimiento-etiqueta boton-presionable"
              :class="`vencimiento-etiqueta--${claseDeVencimiento(vencimiento)}`"
              :aria-label="nombreAccesibleDeVencimiento(vencimiento, rol)"
              @click.stop="emit('abrir-vencimiento', vencimiento)"
            >
              <span class="vencimiento-etiqueta__texto">{{ textoDeVencimiento(vencimiento) }}</span>
              <span
                v-if="marcasDeVencimiento(vencimiento).length > 0"
                class="vencimiento-etiqueta__marcas"
                >{{ marcasDeVencimiento(vencimiento).join(' · ') }}</span
              >
            </q-btn>
            <template
              v-for="(junta, indice) in juntasDelDia(juntas, scope.timestamp.date)"
              :key="claveDeJunta(junta, indice)"
            >
              <div
                v-if="esJuntaOcupada(junta)"
                tabindex="0"
                role="group"
                class="junta-etiqueta junta-etiqueta--ocupada"
                :aria-label="nombreAccesibleOcupada(junta)"
                @click.stop
              >
                <span class="junta-etiqueta__hora">{{
                  horaEnElDia(junta, scope.timestamp.date)
                }}</span>
                <span class="junta-etiqueta__titulo">{{ etiquetaDeJuntaOcupada(junta) }}</span>
              </div>
              <q-btn
                v-else
                unelevated
                no-caps
                dense
                align="left"
                :ripple="false"
                class="junta-etiqueta boton-presionable"
                :class="clasesDeEstado(junta, 'junta-etiqueta')"
                :data-junta-id="junta.id"
                :aria-label="nombreAccesible(junta)"
                @click.stop="emit('abrir-junta', junta)"
              >
                <span class="junta-etiqueta__hora">{{
                  horaEnElDia(junta, scope.timestamp.date)
                }}</span>
                <span v-if="textoDeMarcas(junta)" class="junta-etiqueta__marcas">{{
                  textoDeMarcas(junta)
                }}</span>
                <span class="junta-etiqueta__titulo">{{ junta.titulo }}</span>
              </q-btn>
            </template>
          </div>
        </template>
      </QCalendarMonth>
    </div>

    <!-- Semana (lunes a viernes) y día: de 8:00 a 19:00; un clic en un hueco vacío crea una junta. -->
    <div v-else class="calendario-juntas__scroll">
      <QCalendarDay
        :model-value="fecha"
        :view="vista === 'semana' ? 'week' : 'day'"
        :weekdays="vista === 'semana' && !conFinDeSemana ? DIAS_LABORALES : TODOS_LOS_DIAS"
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
        <template #head-day-event="{ scope }">
          <div
            v-if="hayEtiquetasArriba(scope.timestamp.date)"
            class="calendario-juntas__vencimientos"
          >
            <template
              v-for="fuera in juntasFueraDeHorario(scope.timestamp.date)"
              :key="claveDeJunta(fuera.junta, fuera.indice)"
            >
              <div
                v-if="esJuntaOcupada(fuera.junta)"
                tabindex="0"
                role="group"
                class="junta-etiqueta junta-etiqueta--ocupada junta-etiqueta--arriba"
                :aria-label="`${fuera.texto}. ${AYUDA_OCUPADA}.`"
                @click.stop
              >
                <span class="junta-etiqueta__titulo">{{ fuera.texto }}</span>
              </div>
              <q-btn
                v-else
                unelevated
                no-caps
                dense
                align="left"
                :ripple="false"
                class="junta-etiqueta junta-etiqueta--arriba boton-presionable"
                :class="clasesDeEstado(fuera.junta, 'junta-etiqueta')"
                :data-junta-id="fuera.junta.id"
                :aria-label="`${nombreAccesible(fuera.junta)} ${fuera.texto}.`"
                @click.stop="emit('abrir-junta', fuera.junta)"
              >
                <span class="junta-etiqueta__titulo">{{ fuera.texto }}</span>
                <span v-if="textoDeMarcas(fuera.junta)" class="junta-etiqueta__marcas">{{
                  textoDeMarcas(fuera.junta)
                }}</span>
              </q-btn>
            </template>
            <q-btn
              v-for="vencimiento in vencimientosDelDia(vencimientos, scope.timestamp.date)"
              :key="vencimiento.clave"
              unelevated
              no-caps
              dense
              align="left"
              :ripple="false"
              class="vencimiento-etiqueta boton-presionable"
              :class="`vencimiento-etiqueta--${claseDeVencimiento(vencimiento)}`"
              :aria-label="nombreAccesibleDeVencimiento(vencimiento, rol)"
              @click.stop="emit('abrir-vencimiento', vencimiento)"
            >
              <span class="vencimiento-etiqueta__texto">{{ textoDeVencimiento(vencimiento) }}</span>
              <span
                v-if="marcasDeVencimiento(vencimiento).length > 0"
                class="vencimiento-etiqueta__marcas"
                >{{ marcasDeVencimiento(vencimiento).join(' · ') }}</span
              >
            </q-btn>
          </div>
        </template>
        <template #day-body="{ scope }">
          <template
            v-for="(bloque, indice) in bloquesDelDia(scope.timestamp.date)"
            :key="claveDeJunta(bloque.junta, indice)"
          >
            <div
              v-if="esJuntaOcupada(bloque.junta)"
              tabindex="0"
              role="group"
              class="junta-bloque junta-bloque--ocupada"
              :style="estiloDeBloque(bloque)"
              :aria-label="nombreAccesibleOcupada(bloque.junta)"
              @click.stop
            >
              <span class="junta-bloque__texto">
                <span class="junta-bloque__titulo">{{ etiquetaDeJuntaOcupada(bloque.junta) }}</span>
                <span class="junta-bloque__horario">{{ horarioDeJunta(bloque.junta) }}</span>
                <span v-if="bloque.nota" class="junta-bloque__nota">{{ bloque.nota }}</span>
              </span>
            </div>
            <q-btn
              v-else
              unelevated
              no-caps
              dense
              align="left"
              :ripple="false"
              class="junta-bloque boton-presionable"
              :class="clasesDeEstado(bloque.junta, 'junta-bloque')"
              :data-junta-id="bloque.junta.id"
              :style="estiloDeBloque(bloque)"
              :aria-label="nombreAccesible(bloque.junta)"
              @click.stop="emit('abrir-junta', bloque.junta)"
            >
              <span class="junta-bloque__texto">
                <span class="junta-bloque__titulo">{{ bloque.junta.titulo }}</span>
                <span class="junta-bloque__horario">
                  {{ horarioDeJunta(bloque.junta) }}
                  <span v-if="textoDeMarcas(bloque.junta)" class="junta-bloque__marcas">
                    {{ textoDeMarcas(bloque.junta) }}
                  </span>
                </span>
                <span v-if="bloque.nota" class="junta-bloque__nota">{{ bloque.nota }}</span>
              </span>
            </q-btn>
          </template>
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
  claveDeJunta,
  distribuirSolapadas,
  esJuntaOcupada,
  etiquetaDeJuntaOcupada,
  etiquetaFueraDeHorario,
  horaEnElDia,
  horarioDeJunta,
  juntasDelDia,
  marcasDeJunta,
  notaDeRecorte,
  segmentoDelDia,
  textoPeriodo,
} from '../utils/juntas.js'
import {
  claseDeVencimiento,
  marcasDeVencimiento,
  nombreAccesibleDeVencimiento,
  textoDeVencimiento,
  vencimientosDelDia,
} from '../utils/vencimientosEnCalendario.js'

/*
 * Calendario de juntas con QCalendar (importado solo aquí, no como plugin global). No pide datos:
 * recibe la vista, la fecha y las juntas del periodo; avisa con `abrir-junta` (clic en una junta)
 * y `nueva-junta` (clic en un hueco vacío de semana o día). Los vencimientos de casos salen como
 * etiquetas de día completo («Vence: cliente», con su prioridad y «Importante» si lo es) y los de
 * auditorías como «Auditoría: cliente»; ambos avisan con `abrir-vencimiento`. El idioma es es-MX y los colores salen
 * de la paleta `--dg-*` (ver los estilos de abajo). Cada junta lleva con texto su estado («Por
 * confirmar», «Cancelada», con el título tachado) y «Responder» si te invitaron y aún no contestas.
 */
const props = defineProps({
  /** 'mes', 'semana' o 'dia'. */
  vista: { type: String, required: true },
  /** Fecha de referencia AAAA-MM-DD. */
  fecha: { type: String, required: true },
  /** Juntas del periodo, tal como las devuelve la API. */
  juntas: { type: Array, default: () => [] },
  /** Cuenta de la sesión, para saber si una invitación sigue sin respuesta. */
  usuarioId: { type: [Number, String], default: null },
  /** Vencimientos de casos por marcar (salida de `vencimientosDeCasos`); vacío si no se muestran. */
  vencimientos: { type: Array, default: () => [] },
  /** Rol de la sesión: decide a dónde lleva el clic y lo que dice el nombre accesible. */
  rol: { type: String, default: '' },
  /** Persona cuya agenda se ve (id como texto); null en la propia. Decide a quién se refiere «Responder». */
  agendaId: { type: [Number, String], default: null },
  /** La vista Semana agrega sábado y domingo (la pantalla lo decide: solo si tienen juntas o vencimientos). */
  conFinDeSemana: { type: Boolean, default: false },
  /** Id de la junta recién guardada: se resalta con un anillo de acento unos segundos. */
  resaltadaId: { type: [Number, String], default: null },
})

const emit = defineEmits(['abrir-junta', 'nueva-junta', 'abrir-vencimiento'])

const AYUDA_OCUPADA = 'No estás invitado a esta junta'

// Los bloques ajenos (agenda de otra persona) no abren ficha: se enfocan con el teclado y su
// `aria-label` dice que no estás invitado. El calendario no usa tooltips.
const nombreAccesibleOcupada = (junta) =>
  `${etiquetaDeJuntaOcupada(junta)}, ${horarioDeJunta(junta)}. ${AYUDA_OCUPADA}.`

// Días de la semana de QCalendar: 0 es domingo.
const DIAS_DEL_MES = [1, 2, 3, 4, 5, 6, 0]
const DIAS_LABORALES = [1, 2, 3, 4, 5]
const TODOS_LOS_DIAS = [1, 2, 3, 4, 5, 6, 0]

// Cada hueco dura 30 minutos y mide 30 px: un minuto es un píxel.
const MINUTOS_POR_HUECO = 30
const ALTO_DE_HUECO = 30
const ALTO_MINIMO_DE_BLOQUE = 24

const textoDeVista = computed(() => textoPeriodo(props.vista, props.fecha))

// «Por confirmar · Responder»: lo que acompaña a la junta, o '' si no lleva marcas.
const textoDeMarcas = (junta) => marcasDeJunta(junta, props.usuarioId, props.agendaId).join(' · ')

const nombreAccesible = (junta) =>
  `Junta ${junta.titulo}, ${horarioDeJunta(junta)}${
    textoDeMarcas(junta) ? `, ${textoDeMarcas(junta)}` : ''
  }. Abre los datos de la junta.`

// Clase de color según el estado (el texto de las marcas ya lo dice; el color solo refuerza).
const clasesDeEstado = (junta, base) => ({
  [`${base}--por-confirmar`]: junta.estado === 'por_confirmar',
  [`${base}--cancelada`]: junta.estado === 'cancelada',
  'junta--resaltada': props.resaltadaId !== null && String(junta.id) === String(props.resaltadaId),
})

// Bloques de un día con su columna, para que las juntas que se cruzan no se tapen.
const bloquesDelDia = (dia) =>
  distribuirSolapadas(
    props.juntas.flatMap((junta) => {
      const segmento = segmentoDelDia(junta, dia)
      return segmento ? [{ ...segmento, junta, nota: notaDeRecorte(junta, dia) }] : []
    }),
  )

// Juntas que quedan enteras antes de las 8:00 o después de las 19:00: no caben en la cuadrícula y salen
// como etiquetas arriba del día. `indice` es su posición entre todas las juntas, para una clave única.
const juntasFueraDeHorario = (dia) =>
  props.juntas.flatMap((junta, indice) => {
    const texto = etiquetaFueraDeHorario(junta, dia)
    return texto ? [{ junta, texto, indice }] : []
  })

const hayEtiquetasArriba = (dia) =>
  juntasFueraDeHorario(dia).length > 0 || vencimientosDelDia(props.vencimientos, dia).length > 0

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

.calendario-juntas :deep(.q-calendar-day__day-interval) {
  cursor: pointer;
}

/* Solo con mouse: en táctil el hover se queda pegado después del toque. */
@media (hover: hover) and (pointer: fine) {
  .calendario-juntas :deep(.q-calendar-day__day-interval) {
    transition: background-color 120ms ease;
  }

  .calendario-juntas :deep(.q-calendar-day__day-interval:hover) {
    background: var(--dg-fondo-hover);
  }
}

.calendario-juntas__dia {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 4px 6px;
}

/* Vencimiento de un caso: etiqueta de día completo con el color de su prioridad (el texto dice la prioridad). */
.vencimiento-etiqueta {
  min-height: 24px;
  max-width: 100%;
  padding: 1px 6px;
  border: 1px solid var(--dg-neutro-borde);
  border-left-width: 4px;
  border-radius: 4px;
  background: var(--dg-neutro-fondo);
  color: var(--dg-texto-secundario);
  font-size: 0.78rem;
  text-align: left;
}

.vencimiento-etiqueta--alta {
  border-color: var(--dg-prioridad-alta-borde);
  background: var(--dg-prioridad-alta-fondo);
  color: var(--dg-prioridad-alta);
}

.vencimiento-etiqueta--media {
  border-color: var(--dg-prioridad-media-borde);
  background: var(--dg-prioridad-media-fondo);
  color: var(--dg-prioridad-media);
}

.vencimiento-etiqueta--baja {
  border-color: var(--dg-prioridad-baja-borde);
  background: var(--dg-prioridad-baja-fondo);
  color: var(--dg-prioridad-baja);
}

/* Auditoría: azul informativo, para distinguirla de los casos (el texto dice «Auditoría:»). */
.vencimiento-etiqueta--auditoria {
  border-color: var(--dg-info-borde);
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
}

/* Si el cliente es largo, la prioridad baja a una segunda línea en lugar de recortarse. */
.vencimiento-etiqueta :deep(.q-btn__content) {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: flex-start;
  gap: 0 4px;
  min-width: 0;
  width: 100%;
}

.vencimiento-etiqueta__texto {
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vencimiento-etiqueta__marcas {
  flex: none;
  font-size: 0.72rem;
  font-weight: 600;
}

/* Etiquetas de día completo de las vistas de semana y día. */
.calendario-juntas__vencimientos {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 2px 4px;
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

.junta-etiqueta__marcas {
  flex: none;
  font-weight: 700;
}

/* Bloque ajeno de la agenda de otra persona: sin ficha, con borde discontinuo (no solo color) y texto «Ocupado». */
.junta-etiqueta.junta-etiqueta--ocupada,
.junta-bloque.junta-bloque--ocupada {
  border-left: 3px dashed var(--dg-borde-discontinuo);
  background: var(--dg-fondo-panel);
  color: var(--dg-texto-secundario);
  cursor: default;
}

.junta-etiqueta--ocupada {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}

.junta-etiqueta.junta-etiqueta--ocupada:hover,
.junta-bloque.junta-bloque--ocupada:hover {
  background: var(--dg-fondo-panel);
}

.junta-etiqueta--ocupada:focus-visible,
.junta-bloque--ocupada:focus-visible {
  outline: 2px solid var(--dg-foco);
  outline-offset: 1px;
}

/* Etiqueta de arriba del día (junta fuera de 8:00 a 19:00): el texto baja de línea en lugar de recortarse. */
.junta-etiqueta--arriba {
  height: auto;
  padding-block: 2px;
}

.junta-etiqueta--arriba :deep(.q-btn__content) {
  flex-wrap: wrap;
  justify-content: flex-start;
  text-align: left;
}

.junta-etiqueta--arriba .junta-etiqueta__titulo {
  overflow: visible;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: left;
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

.junta-etiqueta--por-confirmar,
.junta-bloque--por-confirmar {
  border-left-color: var(--dg-aviso-borde);
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-texto);
}

.junta-etiqueta--cancelada,
.junta-bloque--cancelada {
  border-left-color: var(--dg-error);
  background: var(--dg-error-fondo);
  color: var(--dg-error);
}

/*
 * Hover: refuerza el color del estado, no lo cambia. Cada estado tiene el suyo (el normal oscurece su fondo;
 * «Por confirmar» y «Cancelada» conservan su fondo y marcan su borde). Después de definir los estados, con igual
 * especificidad, para que ninguno se pinte del azul de una junta normal.
 */
@media (hover: hover) and (pointer: fine) {
  .junta-etiqueta,
  .junta-bloque {
    transition:
      background-color 120ms ease,
      box-shadow 120ms ease;
  }

  .junta-etiqueta:hover,
  .junta-bloque:hover {
    background: var(--dg-fondo-hover);
  }

  .junta-etiqueta--por-confirmar:hover,
  .junta-bloque--por-confirmar:hover {
    background: var(--dg-aviso-fondo);
    box-shadow: inset 0 0 0 1px var(--dg-aviso-borde);
  }

  .junta-etiqueta--cancelada:hover,
  .junta-bloque--cancelada:hover {
    background: var(--dg-error-fondo);
    box-shadow: inset 0 0 0 1px var(--dg-error);
  }
}

/* Junta recién guardada: anillo de acento con una transición corta (la quita la pantalla a los 3 s). */
.junta-etiqueta.junta--resaltada,
.junta-bloque.junta--resaltada {
  z-index: 2;
  box-shadow: 0 0 0 2px var(--dg-acento);
  transition: box-shadow 200ms var(--dg-curva-salida);
}

@media (prefers-reduced-motion: reduce) {
  .junta-etiqueta,
  .junta-bloque {
    transition: none !important;
  }
}

.junta-etiqueta--cancelada .junta-etiqueta__titulo,
.junta-bloque--cancelada .junta-bloque__titulo {
  text-decoration: line-through;
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

.junta-bloque__marcas {
  display: block;
  white-space: normal;
  font-weight: 700;
}

.junta-bloque__nota {
  max-width: 100%;
  overflow: hidden;
  font-size: 0.74rem;
  font-weight: 600;
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
