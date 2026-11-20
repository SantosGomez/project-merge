<template>
  <q-card
    flat
    bordered
    class="calendario-juntas"
    :aria-label="`Calendario de juntas: ${textoDeVista}`"
  >
    <!-- Celular, Semana: la tira de días arriba y debajo la agenda del día elegido. -->
    <SemanaCalendario
      v-if="vista === 'semana' && compacto"
      :marcas="marcasDeLaTira"
      :dia-elegido="fecha"
      :hoy="hoy"
      :con-cabecera="false"
      class="calendario-juntas__tira"
      @elegir-dia="(dia) => emit('elegir-dia', dia)"
    />

    <!-- Celular, Mes: cuadrícula compacta con el número de juntas de cada día y debajo la agenda del día elegido. -->
    <div
      v-else-if="vista === 'mes' && compacto"
      class="calendario-juntas__mes-compacto"
      role="group"
      aria-label="Días del mes: elige uno para ver sus juntas"
    >
      <div
        class="calendario-juntas__fila-compacta calendario-juntas__dias-de-semana"
        aria-hidden="true"
      >
        <span v-for="letra in LETRAS_DE_SEMANA" :key="letra.clave">{{ letra.texto }}</span>
      </div>
      <div
        v-for="(semana, indice) in semanasDelMes"
        :key="indice"
        class="calendario-juntas__fila-compacta"
      >
        <template v-for="(dia, posicion) in semana" :key="posicion">
          <span v-if="dia === null" class="mes-compacto__dia" aria-hidden="true"></span>
          <q-btn
            v-else
            flat
            no-caps
            dense
            :ripple="false"
            class="mes-compacto__dia boton-presionable"
            :class="{
              'mes-compacto__dia--elegido': dia === fecha,
              'mes-compacto__dia--hoy': dia === hoy,
            }"
            :aria-pressed="String(dia === fecha)"
            :aria-label="nombreAccesibleDeDia(dia)"
            @click="emit('elegir-dia', dia)"
          >
            <span class="mes-compacto__numero" aria-hidden="true">{{ Number(dia.slice(8)) }}</span>
            <span class="mes-compacto__cuenta" aria-hidden="true">{{
              cuentasDelMes[dia] > 0 ? cuentasDelMes[dia] : ''
            }}</span>
          </q-btn>
        </template>
      </div>
    </div>

    <!-- Mes: cuadrícula de lunes a domingo; cada día muestra hasta 3 elementos y «+N más» abre ese día. -->
    <div v-if="vista === 'mes' && !compacto" class="calendario-juntas__scroll">
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
            <template v-for="resumen in [resumenDelMes(scope.timestamp.date)]" :key="resumen.dia">
              <template v-for="elemento in resumen.visibles" :key="elemento.clave">
                <q-btn
                  v-if="elemento.vencimiento"
                  unelevated
                  no-caps
                  dense
                  align="left"
                  :ripple="false"
                  class="vencimiento-etiqueta vencimiento-etiqueta--mes boton-presionable"
                  :class="`vencimiento-etiqueta--${claseDeVencimiento(elemento.vencimiento)}`"
                  :aria-label="nombreAccesibleDeVencimiento(elemento.vencimiento, rol)"
                  @click.stop="emit('abrir-vencimiento', elemento.vencimiento)"
                >
                  <span class="vencimiento-etiqueta__cuerpo">
                    <span class="vencimiento-etiqueta__fila">
                      <q-icon
                        :name="iconoDeVencimiento(elemento.vencimiento)"
                        size="14px"
                        aria-hidden="true"
                      />
                      <span class="vencimiento-etiqueta__texto">{{
                        textoDeVencimiento(elemento.vencimiento)
                      }}</span>
                    </span>
                    <span
                      v-if="marcasDeVencimiento(elemento.vencimiento).length > 0"
                      class="vencimiento-etiqueta__prioridad"
                      >{{ marcasDeVencimiento(elemento.vencimiento).join(' · ') }}</span
                    >
                  </span>
                </q-btn>
                <BloqueJunta
                  v-else
                  formato="mes"
                  :junta="elemento.junta"
                  :dia="scope.timestamp.date"
                  :usuario-id="usuarioId"
                  :agenda-id="agendaId"
                  :resaltada="esResaltada(elemento.junta)"
                  @abrir="emit('abrir-junta', $event)"
                />
              </template>
              <q-btn
                v-if="resumen.ocultos > 0"
                flat
                dense
                no-caps
                color="primary"
                class="calendario-juntas__mas boton-presionable"
                :label="`+${resumen.ocultos} más`"
                :aria-label="`Hay ${resumen.ocultos} más este día. Abre la vista Día de ese día.`"
                @click.stop="verDia(scope.timestamp.date)"
              />
            </template>
          </div>
        </template>
      </QCalendarMonth>
    </div>

    <!-- Semana (lunes a viernes) y día: de 8:00 a 19:00; un clic en un hueco vacío crea una junta. En celular, Semana y Mes muestran aquí solo el día elegido. -->
    <div v-else class="calendario-juntas__scroll">
      <QCalendarDay
        :model-value="fecha"
        :view="esSemanaCompleta ? 'week' : 'day'"
        :weekdays="esSemanaCompleta && !conFinDeSemana ? DIAS_LABORALES : TODOS_LOS_DIAS"
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
        :class="{ 'calendario-juntas__calendario--semana': esSemanaCompleta }"
        @click-time="alElegirHueco"
      >
        <template #head-day-event="{ scope }">
          <span v-if="scope.timestamp.current" class="sr-only">Hoy</span>
          <div
            v-if="hayEtiquetasArriba(scope.timestamp.date)"
            class="calendario-juntas__vencimientos"
          >
            <BloqueJunta
              v-for="fuera in juntasFueraDeHorario(scope.timestamp.date)"
              :key="claveDeJunta(fuera.junta, fuera.indice)"
              formato="arriba"
              :junta="fuera.junta"
              :dia="scope.timestamp.date"
              :texto-arriba="fuera.texto"
              :usuario-id="usuarioId"
              :agenda-id="agendaId"
              :resaltada="esResaltada(fuera.junta)"
              @abrir="emit('abrir-junta', $event)"
            />
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
              <span class="vencimiento-etiqueta__cuerpo">
                <span class="vencimiento-etiqueta__fila">
                  <q-icon :name="iconoDeVencimiento(vencimiento)" size="14px" aria-hidden="true" />
                  <span class="vencimiento-etiqueta__texto">{{
                    textoDeVencimiento(vencimiento)
                  }}</span>
                </span>
                <span
                  v-if="marcasDeVencimiento(vencimiento).length > 0"
                  class="vencimiento-etiqueta__prioridad"
                  >{{ marcasDeVencimiento(vencimiento).join(' · ') }}</span
                >
              </span>
            </q-btn>
          </div>
        </template>
        <template #day-body="{ scope }">
          <BloqueJunta
            v-for="(bloque, indice) in bloquesDelDia(scope.timestamp.date)"
            :key="claveDeJunta(bloque.junta, indice)"
            formato="bloque"
            :junta="bloque.junta"
            :dia="scope.timestamp.date"
            :alto="altoDeBloque(bloque)"
            :nota="bloque.nota"
            :usuario-id="usuarioId"
            :agenda-id="agendaId"
            :resaltada="esResaltada(bloque.junta)"
            :style="estiloDeBloque(bloque)"
            @abrir="emit('abrir-junta', $event)"
          />
        </template>
      </QCalendarDay>
    </div>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { QCalendarDay } from '@quasar/quasar-ui-qcalendar/QCalendarDay'
import { QCalendarMonth } from '@quasar/quasar-ui-qcalendar/QCalendarMonth'
import '@quasar/quasar-ui-qcalendar/QCalendarDay.css'
import '@quasar/quasar-ui-qcalendar/QCalendarMonth.css'

import BloqueJunta from './BloqueJunta.vue'
import SemanaCalendario from './SemanaCalendario.vue'
import { diasDeTira } from '../utils/calendarioAdministrador.js'
import {
  HORA_FIN_VISTA,
  HORA_INICIO_VISTA,
  claveDeJunta,
  distribuirSolapadas,
  etiquetaFueraDeHorario,
  juntasDelDia,
  juntasPorDia,
  limitarElementosDelDia,
  marcasDeDiasConJuntas,
  mesesDelAnio,
  notaDeRecorte,
  segmentoDelDia,
  textoDiaConJuntas,
  textoPeriodo,
} from '../utils/juntas.js'
import {
  claseDeVencimiento,
  iconoDeVencimiento,
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
 * de la paleta `--dg-*` (ver los estilos de abajo). Cada junta se pinta con `BloqueJunta` (estado, marcas y
 * modo compacto). En el Mes, cada día muestra hasta 3 elementos y «+N más» abre la vista Día de esa fecha.
 * En menos de 600 px, Semana y Mes no usan la cuadrícula ancha: arriba va la tira de la semana (`SemanaCalendario`)
 * o una cuadrícula compacta del mes con el número de juntas de cada día, y debajo la agenda del día elegido
 * (la vista Día); elegir un día avisa con `elegir-dia`.
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
  /** Hoy en AAAA-MM-DD, para marcar el día actual en celular. */
  hoy: { type: String, default: '' },
})

const emit = defineEmits(['abrir-junta', 'nueva-junta', 'abrir-vencimiento', 'elegir-dia'])

const $q = useQuasar()
// Menos de 600 px: Semana y Mes pasan a la tira de la semana y a la cuadrícula compacta.
const compacto = computed(() => $q.screen.lt.sm)
const esSemanaCompleta = computed(() => props.vista === 'semana' && !compacto.value)

// Días de la semana de QCalendar: 0 es domingo.
const DIAS_DEL_MES = [1, 2, 3, 4, 5, 6, 0]
const LETRAS_DE_SEMANA = [
  { clave: 'lunes', texto: 'L' },
  { clave: 'martes', texto: 'M' },
  { clave: 'miercoles', texto: 'M' },
  { clave: 'jueves', texto: 'J' },
  { clave: 'viernes', texto: 'V' },
  { clave: 'sabado', texto: 'S' },
  { clave: 'domingo', texto: 'D' },
]
const DIAS_LABORALES = [1, 2, 3, 4, 5]
const TODOS_LOS_DIAS = [1, 2, 3, 4, 5, 6, 0]

// Cada hueco dura 30 minutos y mide 30 px: un minuto es un píxel.
const MINUTOS_POR_HUECO = 30
const ALTO_DE_HUECO = 30
const ALTO_MINIMO_DE_BLOQUE = 24

const textoDeVista = computed(() => textoPeriodo(props.vista, props.fecha))

// Junta recién guardada: la pantalla la resalta unos segundos.
const esResaltada = (junta) =>
  props.resaltadaId !== null && String(junta.id) === String(props.resaltadaId)

// Tira de la semana (celular): marca los días con juntas entre los que ya se cargaron.
const marcasDeLaTira = computed(() => marcasDeDiasConJuntas(props.juntas, diasDeTira(props.fecha)))

// Mes compacto (celular): las semanas del mes de la fecha y cuántas juntas hay cada día.
const anioDeLaFecha = computed(() => Number(props.fecha.slice(0, 4)))
const semanasDelMes = computed(
  () => mesesDelAnio(anioDeLaFecha.value)[Number(props.fecha.slice(5, 7)) - 1].semanas,
)
const cuentasDelMes = computed(() => juntasPorDia(props.juntas, anioDeLaFecha.value))
const nombreAccesibleDeDia = (dia) =>
  `${textoDiaConJuntas(dia, cuentasDelMes.value[dia] ?? 0)}${dia === props.hoy ? ' (hoy)' : ''}. Muestra ese día.`

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

// Alto del bloque en píxeles: un minuto es un píxel, con un mínimo para que se vea.
const altoDeBloque = (bloque) => Math.max(bloque.hasta - bloque.desde, ALTO_MINIMO_DE_BLOQUE)

const estiloDeBloque = (bloque) => ({
  top: `${bloque.desde - HORA_INICIO_VISTA * 60}px`,
  height: `${altoDeBloque(bloque)}px`,
  left: `calc(${(bloque.columna / bloque.columnas) * 100}% + 2px)`,
  width: `calc(${100 / bloque.columnas}% - 4px)`,
})

// Mes: las juntas del día (por hora) y luego sus vencimientos; solo 3 se pintan y el resto va en «+N más».
const resumenDelMes = (dia) => ({
  dia,
  ...limitarElementosDelDia([
    ...juntasDelDia(props.juntas, dia).map((junta, indice) => ({
      clave: claveDeJunta(junta, indice),
      junta,
    })),
    ...vencimientosDelDia(props.vencimientos, dia).map((vencimiento) => ({
      clave: vencimiento.clave,
      vencimiento,
    })),
  ]),
})

// «+N más» abre la vista Día de esa fecha: la pantalla lee la vista y la fecha de la URL.
const route = useRoute()
const router = useRouter()
const verDia = (dia) => {
  router.replace({ query: { ...route.query, vista: 'dia', fecha: dia } })
}

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

/* Celular, Semana: la tira de días ocupa todo el ancho, con aire a los lados. */
.calendario-juntas__tira {
  padding: 8px 4px 0;
  border-bottom: 1px solid var(--dg-borde);
}

/* Celular, Mes: siete columnas de 44 px de alto como mínimo, sin scroll de lado. */
.calendario-juntas__mes-compacto {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border-bottom: 1px solid var(--dg-borde);
}

.calendario-juntas__fila-compacta {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
}

.calendario-juntas__dias-de-semana {
  color: var(--dg-texto-secundario);
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
}

.mes-compacto__dia {
  min-width: 0;
  min-height: 44px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--dg-texto);
  font-size: 0.9rem;
}

.mes-compacto__dia :deep(.q-btn__content) {
  flex-direction: column;
  gap: 0;
  line-height: 1.1;
}

.mes-compacto__cuenta {
  min-width: 16px;
  min-height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 16px;
}

.mes-compacto__cuenta:not(:empty) {
  background: var(--dg-acento);
  color: var(--dg-superficie);
}

.mes-compacto__dia--hoy {
  border-color: var(--dg-acento);
}

.mes-compacto__dia--elegido {
  border-color: var(--dg-acento);
  background: var(--dg-fondo-seleccion);
  font-weight: 700;
}

.mes-compacto__dia:focus-visible {
  outline: 2px solid var(--dg-foco) !important;
  outline-offset: 2px;
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

/* Semana y Día de escritorio: la cabecera de hoy va pintada completa, sin círculo en el número. */
.calendario-juntas :deep(.q-calendar-day__head--day.q-current-day) {
  background: var(--q-primary);
  color: var(--dg-superficie);
}

.calendario-juntas :deep(.q-calendar-day__head--day.q-current-day .q-calendar__button) {
  border: none;
  background: transparent;
  color: inherit;
}

.calendario-juntas
  :deep(.q-calendar-day__head--day.q-current-day .q-calendar__button:focus-visible) {
  outline: 3px solid var(--dg-superficie) !important;
  outline-offset: 2px;
}

/*
 * Celular, Semana y Día: el día de hoy de la tira va pintado completo (solo en «Mi Calendario»; el calendario
 * del administrador usa la misma tira y no cambia). Si además es el día elegido, un aro interior blanco lo distingue.
 */
.calendario-juntas__tira :deep(.semana__dia--hoy) {
  border-color: var(--q-primary);
  background: var(--q-primary);
  color: var(--dg-superficie);
}

.calendario-juntas__tira :deep(.semana__dia--hoy .semana__nombre) {
  color: var(--dg-superficie);
}

.calendario-juntas__tira :deep(.semana__dia--hoy .semana__marca--junta) {
  background: var(--dg-superficie);
}

.calendario-juntas__tira :deep(.semana__dia--hoy.semana__dia--elegido) {
  box-shadow: inset 0 0 0 2px var(--dg-superficie);
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

/*
 * Vencimiento: «pestaña de expediente». Lleva icono (`flag` en un caso, `fact_check` en una auditoría), fondo
 * pleno y un borde uniforme, sin el borde izquierdo grueso de las juntas, para no confundirse con ellas. El
 * título ocupa hasta 2 líneas y la prioridad va en su propia píldora (el texto dice la prioridad).
 */
.vencimiento-etiqueta {
  min-height: 24px;
  max-width: 100%;
  padding: 2px 6px;
  border: 1px solid var(--dg-neutro-borde);
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

.vencimiento-etiqueta :deep(.q-btn__content) {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  justify-content: flex-start;
  min-width: 0;
  width: 100%;
}

.vencimiento-etiqueta__cuerpo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  max-width: 100%;
  line-height: 1.25;
}

.vencimiento-etiqueta__fila {
  display: flex;
  align-items: flex-start;
  gap: 3px;
  min-width: 0;
  max-width: 100%;
}

.vencimiento-etiqueta__fila :deep(.q-icon) {
  flex: none;
  margin-top: 1px;
}

.vencimiento-etiqueta__texto {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  font-weight: 700;
  text-align: left;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}

/* Prioridad (y «Importante»): su propia píldora, con el color del vencimiento. */
.vencimiento-etiqueta__prioridad {
  padding: 0 6px;
  border: 1px solid currentcolor;
  border-radius: 999px;
  background: var(--dg-superficie);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
}

/* En el Mes todas las filas miden lo mismo (42 px): el título ocupa una línea y la prioridad va debajo. */
.vencimiento-etiqueta--mes {
  display: flex;
  width: 100%;
  height: 42px;
}

.vencimiento-etiqueta--mes .vencimiento-etiqueta__texto {
  line-clamp: 1;
  -webkit-line-clamp: 1;
}

.vencimiento-etiqueta--mes .vencimiento-etiqueta__prioridad {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Un solo anillo de foco en los vencimientos, igual que en los bloques de junta. */
.vencimiento-etiqueta:focus-visible {
  z-index: 3;
  outline: 2px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

/* «+N más» del Mes: botón plano del ancho del día. */
.calendario-juntas__mas {
  align-self: flex-start;
  min-height: 24px;
  font-size: 0.78rem;
  font-weight: 700;
}

/* Etiquetas de día completo de las vistas de semana y día. */
.calendario-juntas__vencimientos {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 2px 4px;
}

@media (prefers-reduced-motion: reduce) {
  .vencimiento-etiqueta {
    transition: none !important;
  }
}
</style>
