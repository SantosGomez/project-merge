<template>
  <q-card flat bordered class="calendario" aria-labelledby="calendario-admin-titulo">
    <q-card-section class="calendario__cabecera">
      <div class="calendario__encabezado">
        <h2 id="calendario-admin-titulo" class="calendario__titulo">Calendario de vencimientos</h2>
        <q-btn
          outline
          no-caps
          icon="today"
          label="Hoy"
          color="primary"
          class="control-touch boton-presionable"
          @click="emit('elegir-dia', hoy)"
        >
          <q-tooltip>Vuelve al mes actual y muestra lo que vence hoy.</q-tooltip>
        </q-btn>
      </div>

      <q-select
        v-model="contador"
        :options="opcionesDelFiltro"
        option-label="nombre"
        option-value="id"
        emit-value
        map-options
        outlined
        dense
        options-dense
        dropdown-icon="expand_more"
        popup-content-class="menu-seleccion-custom"
        transition-show="jump-down"
        transition-hide="jump-up"
        :transition-duration="180"
        label="Filtrar por contador"
        aria-label="Filtrar el calendario, las cifras y las listas por contador"
        class="calendario__filtro selector-moderno"
        @popup-show="selectorAbierto = true"
        @popup-hide="selectorAbierto = false"
      >
        <q-tooltip v-if="!selectorAbierto"
          >Elige un contador para ver solo lo suyo. «Todos los contadores» muestra todo.</q-tooltip
        >
      </q-select>
    </q-card-section>

    <q-separator />

    <q-card-section class="calendario__cuerpo">
      <!-- Celular y tableta: la tira de la semana; «Ver mes» despliega el calendario completo. -->
      <SemanaCalendario
        v-if="compacto"
        :marcas="marcas"
        :dia-elegido="diaElegido"
        :hoy="hoy"
        :mes-visible="mesVisible"
        @elegir-dia="(dia) => emit('elegir-dia', dia)"
        @alternar-mes="mesVisible = !mesVisible"
      />

      <transition name="calendario-mes">
        <div v-if="!compacto || mesVisible" class="calendario__fecha-columna">
          <div ref="contenedorFecha" class="calendario__fecha-contenedor">
            <q-date
              ref="fechaRef"
              :model-value="diaElegido ? fechaParaCalendario(diaElegido) : null"
              :default-year-month="(diaElegido ?? hoy).slice(0, 7).replace('-', '/')"
              :first-day-of-week="1"
              :events="tieneVencimiento"
              :event-color="colorDelPunto"
              flat
              minimal
              class="calendario__fecha"
              aria-label="Calendario de vencimientos del despacho"
              @update:model-value="elegirDia"
            />
          </div>
        </div>
      </transition>

      <ul class="calendario__leyenda" aria-label="Qué significa cada color">
        <li v-for="item in LEYENDA" :key="item.texto" class="calendario__leyenda-item">
          <q-badge rounded :color="item.color" class="calendario__punto" aria-hidden="true" />
          {{ item.texto }}
          <q-tooltip>{{ item.ayuda }}</q-tooltip>
        </li>
      </ul>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import SemanaCalendario from './SemanaCalendario.vue'
import { fechaDeCalendario, fechaParaCalendario } from '../utils/actividades.js'

/*
 * Calendario compacto del dashboard del administrador: un q-date que marca con un punto los días en
 * que vence algo, la leyenda de colores, «Hoy» y el filtro por contador. No pide datos ni lista lo del
 * día: recibe las marcas ya calculadas y emite el día elegido (`elegir-dia`). En celular y tableta
 * (`compacto`) muestra la tira de la semana y el mes completo solo con «Ver mes».
 */
const props = defineProps({
  /** Marca de cada día (`marcasPorDia`): vencido, pronto o a-tiempo. */
  marcas: { type: Object, required: true },
  /** Día elegido AAAA-MM-DD, o null en la vista general. */
  diaElegido: { type: String, default: null },
  /** Hoy AAAA-MM-DD. */
  hoy: { type: String, required: true },
  /** Contadores para el filtro, `{ id, nombre }`. */
  opciones: { type: Array, required: true },
  /** Celular y tableta: tira de la semana en vez del mes. */
  compacto: { type: Boolean, default: false },
})

const emit = defineEmits(['elegir-dia'])

// 0 es «Todos los contadores»: q-select no muestra la etiqueta de una opción con valor null.
const contador = defineModel('contador', { type: Number, default: 0 })

const LEYENDA = [
  { color: 'dg-error', texto: 'Vencido', ayuda: 'Ese día hay algo cuya fecha ya pasó.' },
  {
    color: 'dg-importante',
    texto: 'Vence pronto',
    ayuda: 'Ese día hay algo que vence hoy o en los próximos 3 días.',
  },
  { color: 'dg-exito', texto: 'A tiempo', ayuda: 'Todo lo de ese día vence con tiempo de sobra.' },
]

const COLOR_DEL_PUNTO = { vencido: 'dg-error', pronto: 'dg-importante', 'a-tiempo': 'dg-exito' }
const TEXTOS_DE_MARCA = { vencido: 'vencidos', pronto: 'vencen pronto', 'a-tiempo': 'a tiempo' }

const $q = useQuasar()

const opcionesDelFiltro = computed(() => [
  { id: 0, nombre: 'Todos los contadores' },
  ...props.opciones,
])
// Con la lista abierta el tooltip taparía la primera opción.
const selectorAbierto = ref(false)
const mesVisible = ref(false)

const fechaRef = ref(null)
const contenedorFecha = ref(null)

const tieneVencimiento = (fecha) => props.marcas[fechaDeCalendario(fecha)] !== undefined
const colorDelPunto = (fecha) => COLOR_DEL_PUNTO[props.marcas[fechaDeCalendario(fecha)]]

// q-date emite null al pulsar de nuevo el día elegido: se ignora para que no se pierda la elección.
const elegirDia = (valor) => {
  if (valor) emit('elegir-dia', fechaDeCalendario(valor))
}

// Al elegir un día desde fuera (botón «Hoy», enlace) el mes mostrado lo sigue.
watch(
  () => props.diaElegido,
  (dia) => {
    if (!dia) return
    const [anio, mes] = dia.split('-').map(Number)
    fechaRef.value?.setCalendarTo(anio, mes)
  },
)

/*
 * q-date no deja marcar días con clases propias: tras cada pintado se agrega al nombre accesible de cada
 * día con marca su estado en texto, para que el color nunca sea el único indicador.
 */
const MARCA_DE_NOMBRE = ' — '

const fechaDeEtiqueta = (etiqueta) => {
  const [dia, nombreDeMes, anio] = etiqueta.split(MARCA_DE_NOMBRE)[0].split(' ')
  const indice = $q.lang.date.months.findIndex(
    (nombre) => nombre.toLowerCase() === nombreDeMes?.toLowerCase(),
  )
  if (indice < 0) return null
  return `${anio}-${String(indice + 1).padStart(2, '0')}-${String(Number(dia)).padStart(2, '0')}`
}

const anotarDias = () => {
  const raiz = contenedorFecha.value
  if (!raiz) return
  for (const boton of raiz.querySelectorAll('.q-date__calendar-days .q-btn[aria-label]')) {
    const base = boton.getAttribute('aria-label').split(MARCA_DE_NOMBRE)[0]
    const marca = props.marcas[fechaDeEtiqueta(base)]
    const texto = marca ? `${base}${MARCA_DE_NOMBRE}${TEXTOS_DE_MARCA[marca]}` : base
    if (boton.getAttribute('aria-label') !== texto) boton.setAttribute('aria-label', texto)
    const titulo = marca ? TEXTOS_DE_MARCA[marca] : ''
    if (boton.title !== titulo) boton.title = titulo
  }
}

let cuadroPendiente = 0
let observador = null
const programarAnotacion = () => {
  if (cuadroPendiente) return
  cuadroPendiente = requestAnimationFrame(() => {
    cuadroPendiente = 0
    anotarDias()
  })
}

// El q-date se vuelve a crear (por ejemplo con «Ver mes»): el observador se engancha al nuevo.
const observarCalendario = () => {
  if (!contenedorFecha.value || observador?.objetivo === contenedorFecha.value) return
  observador?.desconectar()
  const instancia = new MutationObserver(programarAnotacion)
  instancia.observe(contenedorFecha.value, { childList: true, subtree: true })
  observador = { objetivo: contenedorFecha.value, desconectar: () => instancia.disconnect() }
}

const reanotar = async () => {
  await nextTick()
  observarCalendario()
  programarAnotacion()
}

watch(() => props.marcas, reanotar)
watch(mesVisible, reanotar)
watch(() => props.compacto, reanotar)
onMounted(reanotar)
onBeforeUnmount(() => {
  observador?.desconectar()
  if (cuadroPendiente) cancelAnimationFrame(cuadroPendiente)
})
</script>

<style scoped>
.calendario {
  border-radius: 12px;
  border-color: var(--dg-borde);
  min-width: 0;
}

.calendario__cabecera {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calendario__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.calendario__titulo {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.3;
}

.calendario__filtro {
  width: 100%;
}

.calendario__cuerpo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.calendario__fecha-columna {
  min-width: 0;
}

.calendario__fecha {
  width: 100%;
  border: 1px solid var(--dg-borde);
  border-radius: 12px;
}

/* «Ver mes»: el calendario entra con un salto corto de 180 ms, como los selectores */
.calendario-mes-enter-active,
.calendario-mes-leave-active {
  transition:
    opacity 180ms var(--dg-curva-salida),
    transform 180ms var(--dg-curva-salida);
}

.calendario-mes-enter-from,
.calendario-mes-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

@media (prefers-reduced-motion: reduce) {
  .calendario-mes-enter-active,
  .calendario-mes-leave-active {
    transition: none;
  }
}

.calendario__leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
}

.calendario__leyenda-item {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: help;
}

.calendario__punto {
  width: 10px;
  min-width: 10px;
  height: 10px;
  padding: 0;
}
</style>
