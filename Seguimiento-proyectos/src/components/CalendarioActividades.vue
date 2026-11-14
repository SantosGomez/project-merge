<template>
  <q-card flat bordered class="calendario" aria-labelledby="calendario-titulo">
    <q-card-section class="calendario__cabecera">
      <div class="calendario__encabezado">
        <h2 id="calendario-titulo" class="calendario__titulo">Calendario de vencimientos</h2>
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
        Aquí ves qué actividades vencen cada día. Cambia de mes con las flechas del calendario y
        elige un día para ver sus actividades. Las que se recorrieron desde el mes anterior (como
        las de fin de mes) salen en el día en que vencen.
        <strong v-if="textoSinFechaDelMes && !error" class="calendario__sin-fecha">
          {{ textoSinFechaDelMes }}
        </strong>
      </p>
    </q-card-section>

    <q-separator />

    <q-card-section class="calendario__cuerpo">
      <ScreenLoader v-if="cargando && !tuvoDatos" text="Cargando tu calendario…" />

      <ErrorState
        v-else-if="error"
        :detail="error?.mensaje ?? 'tu calendario de vencimientos.'"
        @retry="cargar()"
      />

      <template v-else>
        <EmptyState
          v-if="sinActividades"
          class="calendario__vacio"
          title="No hay actividades este mes"
          message="Todavía no tienes actividades para este mes. Arma tus clientes y tipos de actividad en «Clientes y tipos» y aquí verás qué vence cada día."
          action-label="Ir a Clientes y tipos"
          @action="emit('ir-a-catalogos')"
        />
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
                :model-value="diaElegido ? fechaParaCalendario(diaElegido) : null"
                :default-year-month="mes.replace('-', '/')"
                :first-day-of-week="1"
                :events="tieneVencimiento"
                :event-color="colorDelPunto"
                flat
                minimal
                class="calendario__fecha"
                aria-label="Calendario de vencimientos"
                @update:model-value="elegirDia"
                @navigation="alNavegar"
              />
            </div>

            <ul class="calendario__leyenda" aria-label="Qué significa cada color">
              <li v-for="item in LEYENDA" :key="item.texto" class="calendario__leyenda-item">
                <q-badge rounded :color="item.color" class="calendario__punto" aria-hidden="true" />
                {{ item.texto }}
                <q-tooltip>{{ item.ayuda }}</q-tooltip>
              </li>
              <li class="calendario__leyenda-item">
                <span class="calendario__muestra-inhabil" aria-hidden="true" />
                Sábados, domingos y festivos
                <q-tooltip
                  >Días inhábiles: las actividades con vencimiento de día hábil no vencen en
                  ellos.</q-tooltip
                >
              </li>
            </ul>
          </div>

          <section
            class="calendario__dia"
            aria-labelledby="calendario-dia-titulo"
            aria-live="polite"
          >
            <template v-if="diaElegido">
              <div class="calendario__dia-cabecera">
                <h3 id="calendario-dia-titulo" class="calendario__dia-titulo">
                  {{ tituloDeDia(diaElegido) }}
                </h3>
                <q-badge
                  v-if="diaInhabil"
                  outline
                  color="dg-texto-tenue"
                  label="Día inhábil"
                  class="calendario__etiqueta"
                >
                  <q-tooltip>
                    {{
                      esFestivoElegido ? 'Este día es festivo.' : 'Este día es sábado o domingo.'
                    }}
                    Los vencimientos que caen en día inhábil se recorren al siguiente día hábil.
                  </q-tooltip>
                </q-badge>
              </div>

              <p v-if="renglonesDelDia.length === 0" class="calendario__nada">
                Nada vence este día.
              </p>

              <q-list v-else separator class="calendario__lista" aria-label="Actividades del día">
                <q-item
                  v-for="renglon in renglonesDelDia"
                  :key="claveDe(renglon)"
                  class="calendario__fila"
                >
                  <q-item-section class="calendario__principal">
                    <q-item-label class="calendario__tipo">{{ renglon.tipo }}</q-item-label>
                    <q-item-label class="calendario__cliente" caption>{{
                      renglon.cliente
                    }}</q-item-label>
                    <q-item-label caption class="calendario__marcas">
                      <q-badge
                        v-if="estadoDeVencimiento(renglon, hoy) === 'vencida'"
                        color="dg-error-fondo"
                        text-color="dg-error"
                        class="calendario__etiqueta"
                      >
                        <q-icon
                          name="error_outline"
                          size="14px"
                          aria-hidden="true"
                          class="q-mr-xs"
                        />
                        Vencida
                        <q-tooltip
                          >La fecha de vencimiento ya pasó y la actividad no está hecha.</q-tooltip
                        >
                      </q-badge>
                      <q-badge
                        v-else-if="estadoDeVencimiento(renglon, hoy) === 'pronto'"
                        color="dg-aviso-fondo"
                        text-color="dg-aviso-texto"
                        class="calendario__etiqueta"
                      >
                        <q-icon name="schedule" size="14px" aria-hidden="true" class="q-mr-xs" />
                        Vence pronto
                        <q-tooltip
                          >Vence hoy o en los próximos 3 días y la actividad no está
                          hecha.</q-tooltip
                        >
                      </q-badge>
                      <q-badge
                        v-if="renglon.mes !== mes"
                        outline
                        color="dg-texto-tenue"
                        class="calendario__etiqueta"
                        :label="`Lista de ${etiquetaDeMes(renglon.mes)}`"
                      >
                        <q-tooltip
                          >Esta actividad es del mes anterior y su vencimiento cae en este
                          mes.</q-tooltip
                        >
                      </q-badge>
                      <q-badge
                        v-if="!renglon.cliente_activo || !renglon.tipo_activo"
                        outline
                        color="dg-texto-tenue"
                        :label="avisoDeInactivo(renglon)"
                      >
                        <q-tooltip
                          >Para cambiar este renglón, reactívalo en «Clientes y tipos».</q-tooltip
                        >
                      </q-badge>
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side class="calendario__lado">
                    <q-checkbox
                      :model-value="renglon.hecha"
                      label="Hecha"
                      color="primary"
                      class="control-touch"
                      :aria-label="nombreAccesibleDeRenglon(renglon, hoy)"
                      :disable="
                        estaGuardando(renglon) || !renglon.cliente_activo || !renglon.tipo_activo
                      "
                      @update:model-value="(valor) => cambiarEstado(renglon, valor)"
                    >
                      <q-tooltip>{{
                        renglon.hecha
                          ? 'Desmarca para dejarla pendiente otra vez.'
                          : 'Marca la actividad como hecha. Se guarda al instante.'
                      }}</q-tooltip>
                    </q-checkbox>
                  </q-item-section>
                </q-item>
              </q-list>
            </template>
          </section>
        </div>
      </template>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import ScreenLoader from './ScreenLoader.vue'
import { guardarEstado, listarActividades } from '../services/actividadService.js'
import {
  diaInicialDelCalendario,
  esDiaInhabil,
  esMesValido,
  estadoDeVencimiento,
  etiquetaDeMes,
  fechaDeCalendario,
  fechaParaCalendario,
  mesActual,
  mesAnterior,
  nombreAccesibleDeRenglon,
  renglonesDelCalendario,
  resumenDeDias,
  textoSinFecha,
  tituloDeDia,
} from '../utils/actividades.js'
import { hoyLocal } from '../utils/filtrosCasos.js'

/*
 * Calendario de vencimientos de «Mis actividades»: un q-date que marca con un punto los días en que
 * vence algo y, bajo él, las actividades del día elegido. Muestra las actividades por su fecha de
 * vencimiento: se piden el mes mostrado y el anterior (el «fin de mes» del anterior puede vencer en los
 * primeros días de este). El mes va en la dirección (?mes=AAAA-MM), igual que en la lista del mes.
 */

const LEYENDA = [
  {
    color: 'dg-error',
    texto: 'Pendientes vencidas',
    ayuda: 'Ese día vencía alguna actividad que sigue sin hacerse.',
  },
  {
    color: 'dg-importante',
    texto: 'Pendientes por vencer',
    ayuda: 'Ese día vence alguna actividad que todavía no haces.',
  },
  {
    color: 'dg-exito',
    texto: 'Todo hecho',
    ayuda: 'Todo lo que vence ese día ya está hecho.',
  },
]

const COLOR_DEL_PUNTO = { vencida: 'dg-error', 'por-vencer': 'dg-importante', hecha: 'dg-exito' }

const emit = defineEmits(['ir-a-catalogos'])

const $q = useQuasar()
const route = useRoute()
const router = useRouter()

// «Hoy» se recalcula al volver a la ventana, como en la lista del mes.
const mesDeHoy = ref(mesActual())
const hoy = ref(hoyLocal())
const mes = computed(() => (esMesValido(route.query.mes) ? route.query.mes : mesDeHoy.value))

const renglones = ref([])
const festivos = ref([])
const sinFecha = ref(0)
// El mes mostrado no tiene ningún renglón (ni con fecha ni sin ella): falta armar clientes y tipos.
const sinActividades = ref(false)
const cargando = ref(true)
const tuvoDatos = ref(false)
const error = ref(null)
const diaElegido = ref(null)
const guardandoClaves = reactive(new Set())

const fechaRef = ref(null)
const contenedorFecha = ref(null)

const dias = computed(() => resumenDeDias(renglones.value, hoy.value))
const textoSinFechaDelMes = computed(() => textoSinFecha(sinFecha.value))
const diaInhabil = computed(
  () => diaElegido.value !== null && esDiaInhabil(diaElegido.value, festivos.value),
)
const esFestivoElegido = computed(() => festivos.value.includes(diaElegido.value))
const renglonesDelDia = computed(() =>
  renglones.value
    .filter((renglon) => renglon.vence === diaElegido.value)
    .sort(
      (a, b) =>
        a.tipo.localeCompare(b.tipo, 'es', { sensitivity: 'base' }) ||
        a.cliente.localeCompare(b.cliente, 'es', { sensitivity: 'base' }),
    ),
)

const tieneVencimiento = (fecha) => dias.value[fechaDeCalendario(fecha)] !== undefined
const colorDelPunto = (fecha) => COLOR_DEL_PUNTO[dias.value[fechaDeCalendario(fecha)]]

const claveDe = (renglon) => `${renglon.mes}-${renglon.tipo_id}-${renglon.cliente_id}`
const estaGuardando = (renglon) => guardandoClaves.has(claveDe(renglon))

const avisoDeInactivo = (renglon) =>
  !renglon.cliente_activo && !renglon.tipo_activo
    ? 'Cliente y tipo desactivados'
    : !renglon.cliente_activo
      ? 'Cliente desactivado'
      : 'Tipo desactivado'

// Evita que una respuesta lenta de un mes anterior pise la del mes que se ve ahora.
let secuencia = 0

// En silencio no se muestra la carga ni el error: si falla, se queda lo que ya había.
const cargar = async ({ silencioso = false } = {}) => {
  const actual = ++secuencia
  if (!silencioso) {
    cargando.value = true
    error.value = null
  }
  const mesPedido = mes.value
  try {
    const [delMes, delAnterior] = await Promise.all([
      listarActividades(mesPedido),
      listarActividades(mesAnterior(mesPedido)),
    ])
    if (actual !== secuencia) return
    const calendario = renglonesDelCalendario(
      mesPedido,
      delMes.actividades,
      delAnterior.actividades,
    )
    renglones.value = calendario.conFecha
    sinFecha.value = calendario.sinFecha
    sinActividades.value = delMes.actividades.length === 0 && calendario.conFecha.length === 0
    festivos.value = delMes.festivos
    tuvoDatos.value = true
    error.value = null
    const sigueElegido = silencioso && diaElegido.value?.startsWith(`${mesPedido}-`)
    if (!sigueElegido) {
      diaElegido.value = diaInicialDelCalendario(mesPedido, hoy.value, dias.value)
    }
  } catch (fallo) {
    if (actual !== secuencia || silencioso) return
    error.value = fallo
  } finally {
    if (actual === secuencia) cargando.value = false
  }
}

const irAlMes = (nuevo) => {
  const consulta = { ...route.query }
  if (nuevo === mesDeHoy.value) delete consulta.mes
  else consulta.mes = nuevo
  router.replace({ query: consulta })
}

const irAHoy = () => {
  mesDeHoy.value = mesActual()
  hoy.value = hoyLocal()
  if (mes.value === mesDeHoy.value) diaElegido.value = hoy.value
  else irAlMes(mesDeHoy.value)
}

// Las flechas del q-date cambian el mes: se refleja en la dirección y eso recarga los datos.
const alNavegar = ({ year, month }) => {
  const nuevo = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
  if (nuevo !== mes.value) irAlMes(nuevo)
}

// q-date emite null al pulsar de nuevo el día elegido: se ignora para que siempre haya un día elegido.
const elegirDia = (valor) => {
  if (valor) diaElegido.value = fechaDeCalendario(valor)
}

watch(mes, (nuevo) => {
  const [anio, numero] = nuevo.split('-').map(Number)
  fechaRef.value?.setCalendarTo(anio, numero)
  cargar()
})

const cambiarEstado = async (renglon, hecha) => {
  const clave = claveDe(renglon)
  if (guardandoClaves.has(clave)) return
  const anterior = { hecha: renglon.hecha, hecha_en: renglon.hecha_en }
  guardandoClaves.add(clave)
  renglon.hecha = hecha
  try {
    const guardada = await guardarEstado({
      cliente_id: renglon.cliente_id,
      tipo_id: renglon.tipo_id,
      mes: renglon.mes,
      hecha,
    })
    renglon.hecha_en = guardada.hecha_en
  } catch (fallo) {
    renglon.hecha = anterior.hecha
    renglon.hecha_en = anterior.hecha_en
    $q.notify({
      type: 'negative',
      message: `No se pudo guardar «${renglon.cliente}» en ${renglon.tipo}. La casilla quedó como estaba.`,
      caption: fallo?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
    })
  } finally {
    guardandoClaves.delete(clave)
  }
}

/*
 * q-date no deja marcar días con clases propias: tras cada pintado se anota en cada día su condición
 * (inhábil, estado de sus vencimientos) con una clase, un título y un texto en su nombre accesible,
 * para que el color nunca sea el único indicador.
 */
const MARCA_DE_NOMBRE = ' — '
const TEXTOS_DE_ESTADO = {
  vencida: 'pendientes vencidas',
  'por-vencer': 'pendientes por vencer',
  hecha: 'todo hecho',
}

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
    const fecha = fechaDeEtiqueta(base)
    if (!fecha) continue
    const notas = []
    if (festivos.value.includes(fecha)) notas.push('festivo, día inhábil')
    else if (esDiaInhabil(fecha, festivos.value)) notas.push('fin de semana, día inhábil')
    if (dias.value[fecha]) notas.push(TEXTOS_DE_ESTADO[dias.value[fecha]])
    const texto = notas.length ? `${base}${MARCA_DE_NOMBRE}${notas.join(', ')}` : base
    if (boton.getAttribute('aria-label') !== texto) boton.setAttribute('aria-label', texto)
    if (boton.title !== (notas.length ? notas.join(', ') : '')) boton.title = notas.join(', ')
    const casilla = boton.parentElement
    const inhabil = esDiaInhabil(fecha, festivos.value)
    if (casilla.classList.contains('calendario__dia--inhabil') !== inhabil) {
      casilla.classList.toggle('calendario__dia--inhabil', inhabil)
    }
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

watch([dias, festivos, mes, renglones, tuvoDatos, error], async () => {
  await nextTick()
  observarCalendario()
  programarAnotacion()
})

// El q-date se vuelve a crear tras un error o la primera carga: el observador se engancha al nuevo.
const observarCalendario = () => {
  if (!contenedorFecha.value || observador?.objetivo === contenedorFecha.value) return
  observador?.desconectar()
  const instancia = new MutationObserver(programarAnotacion)
  instancia.observe(contenedorFecha.value, { childList: true, subtree: true })
  observador = {
    objetivo: contenedorFecha.value,
    desconectar: () => instancia.disconnect(),
  }
}

// Al volver a la ventana se actualiza «hoy» y se relee el calendario sin avisos ni pantalla de carga.
const alVolverALaVentana = () => {
  if (document.visibilityState !== 'visible') return
  mesDeHoy.value = mesActual()
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

.calendario__sin-fecha {
  color: var(--dg-texto-secundario);
}

.calendario__cuerpo > :not(.calendario__contenido) {
  margin: 0;
}

.calendario__contenido {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.calendario__vacio {
  margin-bottom: 16px;
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

/* Sábados, domingos y festivos: fondo suave y texto tenue (la clase la pone anotarDias). */
.calendario__fecha :deep(.calendario__dia--inhabil) {
  background: var(--dg-fondo-suave);
  border-radius: 8px;
}

.calendario__fecha :deep(.calendario__dia--inhabil .q-btn:not(.bg-primary)) {
  color: var(--dg-texto-tenue);
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

.calendario__muestra-inhabil {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 1px solid var(--dg-borde-fuerte);
  border-radius: 4px;
  background: var(--dg-fondo-suave);
}

.calendario__dia {
  min-width: 0;
}

.calendario__dia-cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin-bottom: 8px;
}

.calendario__dia-titulo {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.05rem;
  line-height: 1.3;
}

.calendario__nada {
  margin: 0;
  color: var(--dg-texto-secundario);
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

.calendario__tipo {
  color: var(--dg-texto);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.calendario__cliente {
  color: var(--dg-texto-secundario);
  overflow-wrap: anywhere;
}

.calendario__marcas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.calendario__etiqueta {
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 700;
}
</style>
