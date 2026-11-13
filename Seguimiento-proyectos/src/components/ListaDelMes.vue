<template>
  <q-card flat bordered class="lista-mes" aria-labelledby="lista-mes-titulo">
    <q-card-section class="lista-mes__cabecera">
      <div class="lista-mes__navegacion">
        <q-btn
          flat
          round
          icon="chevron_left"
          color="primary"
          class="control-touch boton-presionable"
          aria-label="Mes anterior"
          @click="irAlMes(mesAnterior(mes))"
        >
          <q-tooltip>Mes anterior</q-tooltip>
        </q-btn>
        <h2 id="lista-mes-titulo" class="lista-mes__titulo" aria-live="polite">
          {{ etiquetaDeMes(mes) }}
        </h2>
        <q-btn
          flat
          round
          icon="chevron_right"
          color="primary"
          class="control-touch boton-presionable"
          aria-label="Mes siguiente"
          @click="irAlMes(mesSiguiente(mes))"
        >
          <q-tooltip>Mes siguiente</q-tooltip>
        </q-btn>
        <q-btn
          outline
          no-caps
          icon="today"
          label="Hoy"
          color="primary"
          class="control-touch boton-presionable"
          :disable="mes === mesDeHoy"
          @click="irAlMes(mesDeHoy)"
        >
          <q-tooltip>Vuelve al mes actual.</q-tooltip>
        </q-btn>
      </div>

      <p class="lista-mes__ayuda">
        Aquí ves lo que te toca hacer en el mes: un renglón por cada cliente y tipo de actividad de
        tu cartera. El mes es el mes en que haces el trabajo: en noviembre ves lo que haces en
        noviembre. Marca «Hecha» y se guarda al instante.
        <strong v-if="totales.total > 0" class="lista-mes__avance">
          {{ totales.hechas }} de {{ totales.total }} hechas este mes.
        </strong>
      </p>
    </q-card-section>

    <q-separator />

    <q-card-section class="lista-mes__cuerpo">
      <ScreenLoader v-if="estado === SCREEN_STATES.loading" text="Cargando tu lista del mes…" />

      <ErrorState
        v-else-if="estado === SCREEN_STATES.error"
        :detail="error?.mensaje ?? 'tu lista del mes.'"
        @retry="cargar()"
      />

      <EmptyState
        v-else-if="estado === SCREEN_STATES.empty"
        :title="textoVacio.titulo"
        :message="textoVacio.mensaje"
        :action-label="textoVacio.accion"
        @action="emit('ir-a-catalogos')"
      />

      <div v-else class="lista-mes__grupos">
        <q-expansion-item
          v-for="grupo in grupos"
          :key="grupo.tipo_id"
          default-opened
          class="lista-mes__grupo"
          header-class="lista-mes__grupo-cabecera"
          :toggle-aria-label="`Plegar o desplegar ${grupo.tipo}: ${grupo.hechas} de ${grupo.total} hechas`"
        >
          <template #header>
            <q-item-section class="lista-mes__grupo-texto">
              <q-item-label class="lista-mes__grupo-nombre">{{ grupo.tipo }}</q-item-label>
              <q-item-label v-if="!grupo.tipo_activo" caption>Tipo desactivado</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge
                v-if="grupo.hechas === grupo.total"
                color="dg-exito-fondo"
                text-color="dg-exito"
                :label="`${grupo.hechas} de ${grupo.total} hechas`"
              >
                <q-tooltip>Ya hiciste todas las actividades de este tipo en el mes.</q-tooltip>
              </q-badge>
              <q-badge
                v-else
                outline
                color="dg-texto-tenue"
                :label="`${grupo.hechas} de ${grupo.total} hechas`"
              >
                <q-tooltip>Actividades de este tipo que ya hiciste de las que te tocan.</q-tooltip>
              </q-badge>
            </q-item-section>
          </template>

          <q-list separator :aria-label="`Clientes de ${grupo.tipo}`">
            <q-item
              v-for="renglon in grupo.renglones"
              :key="renglon.cliente_id"
              class="lista-mes__fila"
            >
              <q-item-section class="lista-mes__principal">
                <q-item-label class="lista-mes__cliente">{{ renglon.cliente }}</q-item-label>
                <q-item-label v-if="!renglon.cliente_activo || !renglon.tipo_activo" caption>
                  <q-badge outline color="dg-texto-tenue" :label="avisoDeInactivo(renglon)">
                    <q-tooltip
                      >Para cambiar este renglón, reactívalo en «Clientes y tipos».</q-tooltip
                    >
                  </q-badge>
                </q-item-label>
              </q-item-section>
              <q-item-section side class="lista-mes__lado">
                <q-checkbox
                  :model-value="renglon.hecha"
                  label="Hecha"
                  color="primary"
                  class="control-touch"
                  :aria-label="`Marcar como hecha: ${renglon.cliente}, ${grupo.tipo}`"
                  :disable="
                    estaGuardando(renglon) || !renglon.cliente_activo || !renglon.tipo_activo
                  "
                  @update:model-value="(valor) => cambiarEstado(renglon, valor)"
                >
                  <q-tooltip>{{
                    renglon.hecha
                      ? 'Desmarca para dejarla pendiente otra vez.'
                      : 'Marca la actividad como hecha este mes. Se guarda al instante.'
                  }}</q-tooltip>
                </q-checkbox>
              </q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import ScreenLoader from './ScreenLoader.vue'
import { guardarEstado, listarActividades } from '../services/actividadService.js'
import { listarClientes } from '../services/clienteService.js'
import { listarTipos } from '../services/tipoActividadService.js'
import {
  agruparPorTipo,
  diagnosticoVacio,
  esMesValido,
  etiquetaDeMes,
  mesActual,
  mesAnterior,
  mesSiguiente,
  totalesDelMes,
} from '../utils/actividades.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

/*
 * Lista del mes de «Mis actividades»: un renglón por cada cliente y tipo de tu cartera, agrupado por
 * tipo. El mes va en la dirección (?mes=AAAA-MM); sin parámetro, el mes actual. Marcar «Hecha» se
 * guarda al instante y, si falla, la casilla vuelve a como estaba.
 */
const emit = defineEmits(['ir-a-catalogos'])

const $q = useQuasar()
const route = useRoute()
const router = useRouter()

// «Hoy» se recalcula al volver a la ventana: si la app queda abierta de un día para otro, cambia el mes.
const mesDeHoy = ref(mesActual())
const mes = computed(() => (esMesValido(route.query.mes) ? route.query.mes : mesDeHoy.value))

const actividades = ref([])
const clientes = ref([])
const tipos = ref([])
const cargando = ref(true)
const error = ref(null)
// Renglones que se están guardando (clave `tipo-cliente`): solo esas casillas quedan ocupadas.
const guardandoClaves = reactive(new Set())

const grupos = computed(() => agruparPorTipo(actividades.value))
const totales = computed(() => totalesDelMes(grupos.value))
const estado = computed(() =>
  screenState({ loading: cargando.value, error: error.value, rows: actividades.value }),
)

const TEXTOS_VACIO = {
  'sin-clientes': {
    titulo: 'Todavía no tienes clientes',
    mensaje:
      'Para armar tu lista del mes primero agrega tus clientes en «Clientes y tipos», en la sección «Mis clientes».',
    accion: 'Ir a Clientes y tipos',
  },
  'sin-tipos': {
    titulo: 'Todavía no tienes tipos de actividad',
    mensaje:
      'Agrega las actividades que repites cada mes en «Clientes y tipos», en la sección «Mis tipos de actividad».',
    accion: 'Ir a Clientes y tipos',
  },
  'sin-cartera': {
    titulo: 'Tus tipos de actividad todavía no tienen clientes',
    mensaje:
      'En «Clientes y tipos», pulsa el botón «Clientes» de cada tipo de actividad y marca a qué clientes se la haces. Con eso aparecerá aquí tu lista de cada mes.',
    accion: 'Ir a Clientes y tipos',
  },
  'sin-renglones': {
    titulo: 'No hay actividades este mes',
    mensaje:
      'No hay renglones por mostrar en este mes. Revisa tus clientes y tipos en «Clientes y tipos».',
    accion: 'Ir a Clientes y tipos',
  },
}
const textoVacio = computed(
  () => TEXTOS_VACIO[diagnosticoVacio({ clientes: clientes.value, tipos: tipos.value })],
)

const claveDe = (renglon) => `${renglon.tipo_id}-${renglon.cliente_id}`
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
  try {
    const [resultado, listaClientes, listaTipos] = await Promise.all([
      listarActividades(mes.value),
      listarClientes(),
      listarTipos(),
    ])
    if (actual !== secuencia) return
    actividades.value = resultado.actividades
    clientes.value = listaClientes
    tipos.value = listaTipos
    error.value = null
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

watch(mes, () => cargar())

const cambiarEstado = async (renglon, hecha) => {
  const clave = claveDe(renglon)
  if (guardandoClaves.has(clave)) return
  const anterior = { hecha: renglon.hecha, hecha_en: renglon.hecha_en }
  const mesDelCambio = mes.value
  guardandoClaves.add(clave)
  renglon.hecha = hecha
  try {
    const guardada = await guardarEstado({
      cliente_id: renglon.cliente_id,
      tipo_id: renglon.tipo_id,
      mes: mesDelCambio,
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

// Al volver a la ventana se actualiza «hoy» y se relee la lista sin avisos ni pantalla de carga.
const alVolverALaVentana = () => {
  if (document.visibilityState !== 'visible') return
  mesDeHoy.value = mesActual()
  cargar({ silencioso: true })
}

onMounted(() => {
  cargar()
  document.addEventListener('visibilitychange', alVolverALaVentana)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', alVolverALaVentana))
</script>

<style scoped>
.lista-mes {
  border-radius: 12px;
  border-color: var(--dg-borde);
  min-width: 0;
}

.lista-mes__cabecera {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lista-mes__navegacion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.lista-mes__titulo {
  min-width: 10ch;
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.3;
  text-align: center;
}

.lista-mes__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.lista-mes__avance {
  color: var(--dg-texto-secundario);
}

.lista-mes__cuerpo {
  padding: 0;
}

/* Los estados vacío, de carga y de error llevan su propio margen. */
.lista-mes__cuerpo > :not(.lista-mes__grupos) {
  margin: 16px;
}

.lista-mes__grupo + .lista-mes__grupo {
  border-top: 1px solid var(--dg-borde);
}

.lista-mes__grupo-texto {
  min-width: 0;
}

.lista-mes__grupo-nombre {
  color: var(--dg-texto);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.lista-mes__fila {
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 4px 16px 4px 32px;
}

.lista-mes__principal {
  flex: 1 1 220px;
  min-width: 0;
}

/* Cuando la casilla baja debajo del nombre (móvil) queda alineada con él. */
.lista-mes__lado {
  padding-left: 0;
}

.lista-mes__cliente {
  color: var(--dg-texto);
  overflow-wrap: anywhere;
}
</style>
