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
          @click="irAHoy"
        >
          <q-tooltip>Vuelve al mes actual y elige el día de hoy.</q-tooltip>
        </q-btn>
      </div>

      <p class="calendario__ayuda">
        Aquí ves qué vence cada día: casos importantes, auditorías y entregas de auditoría. Elige un
        día para ver el detalle y filtra por contador para ver solo lo suyo.
      </p>

      <q-select
        v-model="contadorElegido"
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
        aria-label="Filtrar el calendario por contador"
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
      <ScreenLoader v-if="cargando && !tuvoDatos" text="Cargando el calendario del despacho…" />

      <ErrorState v-else-if="todasFallaron" :detail="`${nombresDeFallos}.`" @retry="cargar()" />

      <template v-else>
        <q-banner v-if="fallos.length > 0" dense rounded class="calendario__aviso" role="alert">
          No se pudo cargar: {{ nombresDeFallos }}. Se muestra lo demás. Pulsa «Reintentar» para
          volver a pedirlo.
          <template #action>
            <q-btn
              flat
              no-caps
              icon="refresh"
              label="Reintentar"
              color="primary"
              class="control-touch boton-presionable"
              @click="cargar()"
            />
          </template>
        </q-banner>

        <div class="calendario__contenido" :aria-busy="cargando">
          <q-linear-progress
            v-if="cargando"
            indeterminate
            color="primary"
            class="calendario__progreso"
            aria-label="Actualizando el calendario"
          />

          <div class="calendario__fecha-columna">
            <div ref="contenedorFecha" class="calendario__fecha-contenedor">
              <q-date
                ref="fechaRef"
                :model-value="fechaParaCalendario(diaElegido)"
                :default-year-month="diaElegido.slice(0, 7).replace('-', '/')"
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

            <ul class="calendario__leyenda" aria-label="Qué significa cada color">
              <li v-for="item in LEYENDA" :key="item.texto" class="calendario__leyenda-item">
                <q-badge rounded :color="item.color" class="calendario__punto" aria-hidden="true" />
                {{ item.texto }}
                <q-tooltip>{{ item.ayuda }}</q-tooltip>
              </li>
            </ul>
          </div>

          <section
            class="calendario__dia"
            aria-labelledby="calendario-admin-dia-titulo"
            aria-live="polite"
          >
            <h3 id="calendario-admin-dia-titulo" class="calendario__dia-titulo">
              {{ tituloDeDia(diaElegido) }}
            </h3>

            <p v-if="totalDelDia === 0" class="calendario__nada">Nada vence este día.</p>

            <template v-else>
              <section
                v-for="grupo in gruposVisibles"
                :key="grupo.clave"
                class="calendario__grupo"
                :aria-labelledby="`calendario-grupo-${grupo.clave}`"
              >
                <h4 :id="`calendario-grupo-${grupo.clave}`" class="calendario__grupo-titulo">
                  {{ grupo.titulo }}
                  <q-badge
                    color="dg-fondo-seleccion"
                    text-color="dg-texto"
                    :label="grupo.elementos.length"
                    :aria-label="`${grupo.elementos.length} en este grupo`"
                  />
                </h4>

                <q-list separator class="calendario__lista" :aria-label="grupo.titulo">
                  <q-item
                    v-for="elemento in grupo.elementos"
                    :key="elemento.clave"
                    class="calendario__fila"
                  >
                    <q-item-section class="calendario__principal">
                      <q-item-label class="calendario__cliente">{{ elemento.titulo }}</q-item-label>
                      <q-item-label v-if="elemento.detalle" caption class="calendario__detalle">
                        {{ elemento.detalle }}
                      </q-item-label>
                      <q-item-label caption class="calendario__marcas">
                        <q-badge
                          :color="ESTILO_DE_URGENCIA[urgenciaDeElemento(elemento)].fondo"
                          :text-color="ESTILO_DE_URGENCIA[urgenciaDeElemento(elemento)].texto"
                          class="calendario__etiqueta"
                        >
                          <q-icon
                            :name="ESTILO_DE_URGENCIA[urgenciaDeElemento(elemento)].icono"
                            size="14px"
                            aria-hidden="true"
                            class="q-mr-xs"
                          />
                          {{ textoDeUrgencia(urgenciaDeElemento(elemento)) }}
                          <q-tooltip>{{
                            ESTILO_DE_URGENCIA[urgenciaDeElemento(elemento)].ayuda
                          }}</q-tooltip>
                        </q-badge>
                        <span class="calendario__contador">{{ textoDeContador(elemento) }}</span>
                      </q-item-label>
                    </q-item-section>
                    <q-item-section side class="calendario__lado">
                      <q-btn
                        flat
                        no-caps
                        dense
                        color="primary"
                        icon="visibility"
                        label="Ver"
                        class="control-touch boton-presionable"
                        :aria-label="`Ver ${etiquetaDeVer(elemento)} de ${elemento.titulo}`"
                        v-bind="enlaceDeVer(elemento)"
                        @click="alVer(elemento)"
                      >
                        <q-tooltip>{{ ayudaDeVer(elemento) }}</q-tooltip>
                      </q-btn>
                    </q-item-section>
                  </q-item>
                </q-list>
              </section>
            </template>
          </section>
        </div>
      </template>
    </q-card-section>

    <CasoDetalleDialog v-if="casoEnDetalle" v-model="detalleAbierto" :caso="casoEnDetalle" />
  </q-card>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import CasoDetalleDialog from './CasoDetalleDialog.vue'
import ErrorState from './ErrorState.vue'
import ScreenLoader from './ScreenLoader.vue'
import { listarAuditorias, listarEntregasCalendario } from '../services/auditoriaService.js'
import { getCasosImportantesCalendario } from '../services/counterService.js'
import {
  agruparDelDia,
  elementosDelCalendario,
  filtrarPorContador,
  marcasPorDia,
  opcionesDeContador,
  textoDeUrgencia,
  urgenciaDe,
} from '../utils/calendarioAdministrador.js'
import { fechaDeCalendario, fechaParaCalendario, tituloDeDia } from '../utils/actividades.js'
import { hoyLocal } from '../utils/filtrosCasos.js'

/*
 * Calendario del administrador: un q-date que marca con un punto los días en que vence algo (casos
 * importantes, auditorías y entregas de auditoría) y, bajo él, lo que vence el día elegido. Cada
 * fuente se pide aparte: si una falla se dice cuál y se muestran las otras. Al volver a la ventana
 * se relee en silencio y un fallo no borra lo que ya se veía.
 */

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
const ESTILO_DE_URGENCIA = {
  vencido: {
    fondo: 'dg-error-fondo',
    texto: 'dg-error',
    icono: 'error_outline',
    ayuda: 'La fecha de vencimiento ya pasó.',
  },
  pronto: {
    fondo: 'dg-aviso-fondo',
    texto: 'dg-aviso-texto',
    icono: 'schedule',
    ayuda: 'Vence hoy o en los próximos 3 días.',
  },
  'a-tiempo': {
    fondo: 'dg-exito-fondo',
    texto: 'dg-exito',
    icono: 'check_circle_outline',
    ayuda: 'Todavía faltan más de 3 días.',
  },
}
const TEXTOS_DE_MARCA = { vencido: 'vencidos', pronto: 'vencen pronto', 'a-tiempo': 'a tiempo' }

const $q = useQuasar()

const hoy = ref(hoyLocal())
const diaElegido = ref(hoy.value)

const casos = ref([])
const auditorias = ref([])
const entregas = ref([])
const fallos = ref([])
const cargando = ref(true)
const tuvoDatos = ref(false)
// 0 es «Todos los contadores»: q-select no muestra la etiqueta de una opción con valor null.
const TODOS = 0
const contadorElegido = ref(TODOS)
// Con la lista abierta el tooltip taparía la primera opción.
const selectorAbierto = ref(false)

const fechaRef = ref(null)
const contenedorFecha = ref(null)

const todos = computed(() =>
  elementosDelCalendario({
    casos: casos.value,
    auditorias: auditorias.value,
    entregas: entregas.value,
  }),
)
const opciones = computed(() => opcionesDeContador(todos.value))
const opcionesDelFiltro = computed(() => [
  { id: TODOS, nombre: 'Todos los contadores' },
  ...opciones.value,
])
const visibles = computed(() => filtrarPorContador(todos.value, contadorElegido.value || null))
const marcas = computed(() => marcasPorDia(visibles.value, hoy.value))
const delDia = computed(() => agruparDelDia(visibles.value, diaElegido.value))
const gruposVisibles = computed(() =>
  [
    { clave: 'casos', titulo: 'Casos', elementos: delDia.value.casos },
    { clave: 'auditorias', titulo: 'Auditorías', elementos: delDia.value.auditorias },
    { clave: 'entregas', titulo: 'Entregas de auditoría', elementos: delDia.value.entregas },
  ].filter((grupo) => grupo.elementos.length > 0),
)
const totalDelDia = computed(() =>
  gruposVisibles.value.reduce((total, grupo) => total + grupo.elementos.length, 0),
)

// Si el contador elegido ya no aparece tras releer, se vuelve a «Todos».
watch(opciones, (lista) => {
  if (contadorElegido.value !== TODOS && !lista.some((c) => c.id === contadorElegido.value)) {
    contadorElegido.value = TODOS
  }
})

const NOMBRES_DE_FUENTE = {
  casos: 'los casos importantes',
  auditorias: 'los vencimientos de las auditorías',
  entregas: 'las entregas de auditoría',
}
const nombresDeFallos = computed(() => fallos.value.map((f) => NOMBRES_DE_FUENTE[f]).join(', '))
const todasFallaron = computed(() => fallos.value.length === 3)

const tieneVencimiento = (fecha) => marcas.value[fechaDeCalendario(fecha)] !== undefined
const colorDelPunto = (fecha) => COLOR_DEL_PUNTO[marcas.value[fechaDeCalendario(fecha)]]

const urgenciaDeElemento = (elemento) => urgenciaDe(elemento.vence, hoy.value)

const textoDeContador = (elemento) => {
  const nombres = elemento.contadores.map((c) => c.nombre).join(', ') || 'Sin contador'
  const base = `Contador: ${nombres}`
  return elemento.deAuxiliar ? `${base} · de ${elemento.deAuxiliar}` : base
}

const etiquetaDeVer = (elemento) =>
  ({ caso: 'el caso', auditoria: 'la auditoría', entrega: 'la auditoría de la entrega' })[
    elemento.tipo
  ]
const ayudaDeVer = (elemento) =>
  elemento.tipo === 'caso'
    ? 'Abre la ficha del caso, solo para consultar.'
    : 'Abre la ficha de la auditoría.'

// Casos: abren la ficha en un diálogo; auditorías y entregas llevan a la ficha de la auditoría.
const enlaceDeVer = (elemento) =>
  elemento.tipo === 'caso'
    ? {}
    : { to: { name: 'auditoria-ficha', params: { id: elemento.auditoriaId } } }

const detalleAbierto = ref(false)
const casoEnDetalle = ref(null)
const alVer = (elemento) => {
  if (elemento.tipo !== 'caso') return
  casoEnDetalle.value = elemento.caso
  detalleAbierto.value = true
}

// Evita que una respuesta lenta pise a una más reciente.
let secuencia = 0

// En silencio no se muestra la carga y un fallo conserva lo que ya había.
const cargar = async ({ silencioso = false } = {}) => {
  const actual = ++secuencia
  if (!silencioso) cargando.value = true
  const [delosCasos, lasAuditorias, lasEntregas] = await Promise.allSettled([
    getCasosImportantesCalendario(),
    listarAuditorias(),
    listarEntregasCalendario(),
  ])
  if (actual !== secuencia) return
  const nuevosFallos = []
  const aplicar = (clave, resultado, destino) => {
    if (resultado.status === 'fulfilled') destino.value = resultado.value
    else nuevosFallos.push(clave)
  }
  aplicar('casos', delosCasos, casos)
  aplicar('auditorias', lasAuditorias, auditorias)
  aplicar('entregas', lasEntregas, entregas)
  // Al releer en silencio, un fallo no cambia lo que se ve ni muestra el aviso.
  if (!silencioso || nuevosFallos.length === 0) fallos.value = nuevosFallos
  if (nuevosFallos.length < 3) tuvoDatos.value = true
  cargando.value = false
}

const irAHoy = () => {
  hoy.value = hoyLocal()
  diaElegido.value = hoy.value
  const [anio, mes] = hoy.value.split('-').map(Number)
  fechaRef.value?.setCalendarTo(anio, mes)
}

// q-date emite null al pulsar de nuevo el día elegido: se ignora para que siempre haya un día elegido.
const elegirDia = (valor) => {
  if (valor) diaElegido.value = fechaDeCalendario(valor)
}

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
    const marca = marcas.value[fechaDeEtiqueta(base)]
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

// El q-date se vuelve a crear tras la primera carga o un error: el observador se engancha al nuevo.
const observarCalendario = () => {
  if (!contenedorFecha.value || observador?.objetivo === contenedorFecha.value) return
  observador?.desconectar()
  const instancia = new MutationObserver(programarAnotacion)
  instancia.observe(contenedorFecha.value, { childList: true, subtree: true })
  observador = { objetivo: contenedorFecha.value, desconectar: () => instancia.disconnect() }
}

watch([marcas, tuvoDatos, fallos], async () => {
  await nextTick()
  observarCalendario()
  programarAnotacion()
})

// Al volver a la ventana se actualiza «hoy» y se relee sin pantalla de carga ni avisos.
const alVolverALaVentana = () => {
  if (document.visibilityState !== 'visible') return
  hoy.value = hoyLocal()
  cargar({ silencioso: true })
}

onMounted(() => {
  cargar()
  document.addEventListener('visibilitychange', alVolverALaVentana)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', alVolverALaVentana)
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

.calendario__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.calendario__filtro {
  width: 100%;
  max-width: 320px;
}

.calendario__aviso {
  margin-bottom: 12px;
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-texto);
}

.calendario__contenido {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.calendario__progreso {
  grid-column: 1 / -1;
}

@media (min-width: 1024px) {
  .calendario__contenido {
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: 24px;
  }
}

.calendario__fecha-columna {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.calendario__fecha {
  width: 100%;
  border: 1px solid var(--dg-borde);
  border-radius: 12px;
}

.calendario__leyenda {
  display: flex;
  flex-direction: column;
  gap: 6px;
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

.calendario__dia {
  min-width: 0;
}

.calendario__dia-titulo {
  margin: 0 0 8px;
  color: var(--dg-texto);
  font-size: 1.05rem;
  line-height: 1.3;
}

.calendario__nada {
  margin: 0;
  color: var(--dg-texto-secundario);
}

.calendario__grupo + .calendario__grupo {
  margin-top: 16px;
}

.calendario__grupo-titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.3;
}

.calendario__fila {
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 4px 0;
}

.calendario__principal {
  flex: 1 1 220px;
  min-width: 0;
}

.calendario__lado {
  padding-left: 0;
}

.calendario__cliente {
  color: var(--dg-texto);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.calendario__detalle {
  color: var(--dg-texto-secundario);
  overflow-wrap: anywhere;
}

.calendario__marcas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.calendario__contador {
  color: var(--dg-texto-secundario);
  overflow-wrap: anywhere;
}

.calendario__etiqueta {
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 700;
}
</style>
