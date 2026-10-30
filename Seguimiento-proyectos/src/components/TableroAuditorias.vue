<template>
  <section class="tablero" aria-label="Tablero de auditorías">
    <ScreenLoader v-if="cargando" text="Cargando las auditorías…" />

    <ErrorState
      v-else-if="errorCarga"
      :detail="errorCarga.mensaje ?? 'las auditorías.'"
      @retry="cargar"
    />

    <EmptyState
      v-else-if="auditorias.length === 0"
      title="No hay auditorías registradas"
      message="Cuando los contadores registren auditorías, aquí verás sus indicadores y su avance por fase."
    />

    <template v-else>
      <q-tabs
        v-model="vista"
        dense
        no-caps
        inline-label
        align="left"
        active-color="primary"
        indicator-color="primary"
        class="tablero__tabs"
      >
        <q-tab name="resumen" icon="insights" label="Resumen">
          <q-tooltip>Indicadores de todas las auditorías.</q-tooltip>
        </q-tab>
        <q-tab name="avance" icon="view_timeline" label="Avance">
          <q-tooltip>En qué fase va cada auditoría y qué vence después.</q-tooltip>
        </q-tab>
      </q-tabs>

      <q-tab-panels v-model="vista" animated class="tablero__paneles">
        <q-tab-panel name="resumen" class="tablero__panel">
          <div class="tablero__indicadores">
            <q-card
              v-for="indicador in tarjetasIndicadores"
              :key="indicador.clave"
              flat
              bordered
              class="indicador"
              :class="`indicador--${indicador.clave}`"
            >
              <span class="indicador__valor">{{ indicadores[indicador.clave] }}</span>
              <span class="indicador__etiqueta">{{ indicador.etiqueta }}</span>
              <q-tooltip max-width="260px">{{ indicador.ayuda }}</q-tooltip>
            </q-card>
          </div>
        </q-tab-panel>

        <q-tab-panel name="avance" class="tablero__panel">
          <p class="tablero__ayuda">
            ✔ fase cumplida · ● fase actual. Ordenadas por urgencia: primero lo vencido y lo que
            vence antes. Haz clic en una auditoría para abrir su ficha.
          </p>
          <q-markup-table flat bordered dense wrap-cells class="avance">
            <thead>
              <tr>
                <th class="text-left">Cliente</th>
                <th class="text-left">Tipo</th>
                <th class="text-left">Dependencia</th>
                <th v-for="fase in fases" :key="fase.id" class="text-center avance__fase-th">
                  {{ fase.id }}
                  <q-tooltip>{{ fase.nombre }}</q-tooltip>
                </th>
                <th class="text-left">Próximo vencimiento</th>
                <th class="text-left">¿Qué vence?</th>
                <th class="text-left">Días</th>
                <th class="text-left">Semáforo</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="auditoria in auditoriasOrdenadas"
                :key="auditoria.id"
                class="avance__fila"
                tabindex="0"
                @click="verFicha(auditoria.id)"
                @keydown.enter="verFicha(auditoria.id)"
              >
                <td
                  class="avance__cliente"
                  :class="`avance__franja--${claseSemaforo(auditoria.semaforo)}`"
                >
                  {{ auditoria.cliente }}
                  <div class="avance__tenue">Expediente {{ auditoria.noExpediente }}</div>
                </td>
                <td>{{ auditoria.tipoAud }}</td>
                <td>{{ auditoria.dependencia }}</td>
                <td
                  v-for="(marca, i) in marcasDeFases(auditoria.faseActual?.id, auditoria.semaforo)"
                  :key="i"
                  class="text-center"
                  :class="`avance__marca--${marca}`"
                >
                  {{ SIMBOLO_MARCA[marca] }}
                </td>
                <td class="avance__fecha">{{ auditoria.proximoVencimiento || '—' }}</td>
                <td>{{ auditoria.queVence || '—' }}</td>
                <td class="avance__fecha">{{ textoDiasPlazo(auditoria.diasParaVencer) }}</td>
                <td>
                  <span
                    class="avance__semaforo"
                    :class="`avance__semaforo--${claseSemaforo(auditoria.semaforo)}`"
                  >
                    {{ auditoria.semaforo }}
                  </span>
                </td>
              </tr>
            </tbody>
          </q-markup-table>
        </q-tab-panel>
      </q-tab-panels>
    </template>
  </section>
</template>

<script setup>
import { computed, onActivated, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import ScreenLoader from './ScreenLoader.vue'
import { listarAuditorias, listarFases } from '../services/auditoriaService.js'
import { ordenarAuditorias } from '../utils/listaAuditorias.js'
import { indicadoresAuditorias, marcasDeFases, textoDiasPlazo } from '../utils/tableroAuditorias.js'

const route = useRoute()
const router = useRouter()

// Sub-pestaña en la URL (?vista=avance): al volver de una ficha se regresa a la misma vista.
const VISTAS = ['resumen', 'avance']
const vista = computed({
  get: () => (VISTAS.includes(route.query.vista) ? route.query.vista : 'resumen'),
  set: (valor) => router.replace({ query: { ...route.query, vista: valor } }),
})

const tarjetasIndicadores = [
  { clave: 'activas', etiqueta: 'Activas', ayuda: 'Auditorías que no están concluidas.' },
  {
    clave: 'vencidas',
    etiqueta: 'Vencidas',
    ayuda: 'Tienen un plazo pendiente de la bitácora que ya pasó.',
  },
  {
    clave: 'criticas',
    etiqueta: 'Críticas (≤ 7 días)',
    ayuda: 'Un plazo pendiente vence en 7 días o menos.',
  },
  {
    clave: 'atencion',
    etiqueta: 'En atención',
    ayuda: 'Un plazo vence en 20 días o menos, o a la autoridad le quedan 60 días o menos.',
  },
]

const SEMAFORO_CLASE = {
  Vencido: 'vencido',
  Crítico: 'critico',
  Atención: 'atencion',
  'En tiempo': 'en-tiempo',
  Concluida: 'concluida',
}
const claseSemaforo = (semaforo) => SEMAFORO_CLASE[semaforo] ?? 'en-tiempo'
const SIMBOLO_MARCA = { cumplida: '✔', actual: '●', pendiente: '' }

const auditorias = ref([])
const fases = ref([])
const cargando = ref(true)
const errorCarga = ref(null)

const indicadores = computed(() => indicadoresAuditorias(auditorias.value))
const auditoriasOrdenadas = computed(() => ordenarAuditorias(auditorias.value, 'urgencia'))

const cargar = async () => {
  cargando.value = true
  errorCarga.value = null
  try {
    const [lista, catalogo] = await Promise.all([listarAuditorias(), listarFases()])
    auditorias.value = lista
    fases.value = catalogo
  } catch (error) {
    errorCarga.value = error
  } finally {
    cargando.value = false
  }
}

// La pestaña vive dentro de un keep-alive: se recarga cada vez que se vuelve a mostrar.
onActivated(cargar)

const verFicha = (id) => router.push({ name: 'auditoria-ficha', params: { id } })
</script>

<style scoped>
.tablero {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tablero__tabs {
  border-bottom: 1px solid var(--dg-borde);
  color: var(--dg-texto-secundario);
}

.tablero__paneles {
  background: transparent;
}

.tablero__panel {
  padding: 12px 0 0;
}

.tablero__ayuda {
  margin: 0 0 8px;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.tablero__indicadores {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.indicador {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 16px;
  border-left-width: 5px;
  border-radius: 10px;
  background: var(--dg-superficie);
}

.indicador__valor {
  color: var(--dg-texto);
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1.1;
}

.indicador__etiqueta {
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  font-weight: 600;
}

.indicador--activas {
  border-left-color: var(--dg-acento);
}

.indicador--vencidas {
  border-left-color: var(--dg-error);
}

.indicador--criticas {
  border-left-color: var(--dg-prioridad-alta-borde);
}

.indicador--atencion {
  border-left-color: var(--dg-importante);
}

.avance {
  border-color: var(--dg-borde);
  background: var(--dg-superficie);
}

.avance th {
  color: var(--dg-texto-secundario);
  font-weight: 700;
}

.avance td {
  vertical-align: top;
  color: var(--dg-texto);
}

.avance__fila {
  cursor: pointer;
}

.avance__fila:focus-visible {
  outline: 3px solid var(--dg-foco);
  outline-offset: -3px;
}

.avance__fase-th {
  width: 36px;
}

.avance__cliente {
  min-width: 200px;
  font-weight: 700;
}

/* Franja del semáforo en el borde izquierdo de la fila */
.avance__franja--vencido {
  box-shadow: inset 5px 0 0 var(--dg-error);
}

.avance__franja--critico {
  box-shadow: inset 5px 0 0 var(--dg-prioridad-alta-borde);
}

.avance__franja--atencion {
  box-shadow: inset 5px 0 0 var(--dg-importante);
}

.avance__franja--en-tiempo {
  box-shadow: inset 5px 0 0 var(--dg-exito-borde);
}

.avance__franja--concluida {
  box-shadow: inset 5px 0 0 var(--dg-neutro-borde);
}

.avance__tenue {
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
  font-weight: 400;
}

.avance__fecha {
  white-space: nowrap;
}

.avance__marca--cumplida {
  color: var(--dg-exito);
  font-weight: 700;
}

.avance__marca--actual {
  background: var(--dg-fondo-seleccion);
  color: var(--dg-acento);
  font-weight: 700;
}

.avance__semaforo {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.avance__semaforo--vencido {
  background: var(--dg-error);
  color: var(--dg-superficie);
}

.avance__semaforo--critico {
  border: 1px solid var(--dg-prioridad-alta-borde);
  background: var(--dg-prioridad-alta-fondo);
  color: var(--dg-prioridad-alta);
}

.avance__semaforo--atencion {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.avance__semaforo--en-tiempo {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.avance__semaforo--concluida {
  background: var(--dg-neutro-fondo);
  color: var(--dg-texto-secundario);
}
</style>
