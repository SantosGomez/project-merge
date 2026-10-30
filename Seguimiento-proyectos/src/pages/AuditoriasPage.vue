<template>
  <q-page class="auditorias-page">
    <div class="auditorias-page__head">
      <p class="auditorias-page__lead">
        Registra y da seguimiento a las auditorías asignadas. Cambia el estado y el resto de los datos
        con «Editar».
      </p>
      <q-btn
        class="auditorias-page__register-btn control-touch"
        color="primary"
        no-caps
        unelevated
        icon="add_circle"
        label="Registrar auditoría"
        aria-haspopup="dialog"
        @click="abrirRegistro"
      >
        <q-tooltip>Abre el formulario para registrar una auditoría nueva.</q-tooltip>
      </q-btn>
    </div>

    <ScreenLoader v-if="cargando" text="Cargando auditorías…" />

    <ErrorState
      v-else-if="errorCarga"
      :detail="mensajeError"
      @retry="reintentar"
    />

    <div v-else class="auditorias-page__body">
      <EmptyState
        v-if="auditoriasFiltradas.length === 0 && !hayFiltros"
        title="No tienes auditorías registradas"
        message="Aún no hay auditorías asignadas. Usa «Registrar auditoría» para registrar la primera y empezar a dar seguimiento."
        action-label="Registrar auditoría"
        @action="abrirRegistro"
      />

      <template v-else>
        <section class="auditorias-page__resumen" aria-label="Auditorías por semáforo">
          <q-card
            v-for="tarjeta in tarjetasSemaforo"
            :key="tarjeta.valor"
            flat
            bordered
            tag="button"
            type="button"
            class="resumen-semaforo"
            :class="[
              `resumen-semaforo--${tarjeta.clase}`,
              { 'resumen-semaforo--activa': filtroSemaforo === tarjeta.valor },
            ]"
            :aria-pressed="filtroSemaforo === tarjeta.valor ? 'true' : 'false'"
            @click="alternarSemaforo(tarjeta.valor)"
          >
            <span class="resumen-semaforo__valor">{{ conteoSemaforo[tarjeta.valor] }}</span>
            <span class="resumen-semaforo__etiqueta">{{ tarjeta.etiqueta }}</span>
            <q-tooltip max-width="260px">{{ tarjeta.ayuda }} Haz clic para ver solo estas.</q-tooltip>
          </q-card>
        </section>

        <section class="auditorias-page__filtros" aria-label="Filtros de auditorías">
          <div class="auditorias-page__busqueda">
            <q-input
              v-model="texto"
              dense
              outlined
              clearable
              debounce="200"
              placeholder="Buscar por cliente o expediente"
              aria-label="Buscar por cliente o expediente"
              class="auditorias-page__buscar"
            >
              <template #prepend><q-icon name="search" aria-hidden="true" /></template>
            </q-input>
            <q-select
              v-model="orden"
              :options="opcionesOrden"
              emit-value
              map-options
              dense
              outlined
              options-dense
              label="Ordenar por"
              class="auditorias-page__orden"
            >
              <q-tooltip>Por urgencia: primero lo vencido y lo que vence antes.</q-tooltip>
            </q-select>
          </div>
          <div class="auditorias-page__filtro-grupo">
            <span class="auditorias-page__filtro-titulo">Estado</span>
            <q-chip
              v-for="opcion in opcionesEstado"
              :key="opcion.valor"
              clickable
              :outline="filtroEstado !== opcion.valor"
              :color="filtroEstado === opcion.valor ? 'primary' : 'grey-7'"
              :text-color="filtroEstado === opcion.valor ? 'white' : 'grey-9'"
              :aria-pressed="filtroEstado === opcion.valor ? 'true' : 'false'"
              class="auditorias-page__chip"
              @click="filtroEstado = opcion.valor"
            >
              {{ opcion.etiqueta }}
              <q-tooltip>{{ opcion.ayuda }}</q-tooltip>
            </q-chip>
          </div>
          <q-btn
            v-if="hayFiltros"
            flat
            no-caps
            dense
            color="primary"
            icon="filter_alt_off"
            label="Limpiar filtros"
            class="auditorias-page__limpiar control-touch"
            @click="limpiarFiltros"
          >
            <q-tooltip>Vuelve a mostrar todas las auditorías.</q-tooltip>
          </q-btn>
        </section>

        <div v-if="auditoriasFiltradas.length === 0" class="sin-resultados" role="status">
          <q-icon name="filter_alt" size="28px" color="grey-7" aria-hidden="true" />
          <p class="sin-resultados__texto">
            Ninguna auditoría cumple la búsqueda o los filtros. Cambia el texto, el estado o el semáforo, o usa
            «Limpiar filtros».
          </p>
        </div>

        <div v-else class="auditorias-page__lista">
          <AuditoriaItem
            v-for="item in auditoriasFiltradas"
            :key="item.id"
            :auditoria="item"
            :nombres-contadores="item.contadores.map((c) => c.nombre)"
            @ver-detalle="router.push({ name: 'auditoria-ficha', params: { id: item.id } })"
            @editar="abrirEdicion(item.id)"
          />
        </div>
      </template>
    </div>

    <AuditoriaFormDialog
      v-model="dialogoRegistroAbierto"
      :auditoria="auditoriaEnEdicion"
      :contadores="contadores"
      :es-admin="session.esAdministrador"
      @registrada="alRegistrar"
      @guardada="alGuardar"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

import AuditoriaFormDialog from '../components/AuditoriaFormDialog.vue'
import AuditoriaItem from '../components/AuditoriaItem.vue'
import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { listarAuditorias } from '../services/auditoriaService.js'
import { listCounters } from '../services/counterService.js'
import { contarPorSemaforo, filtrarAuditorias, ordenarAuditorias } from '../utils/listaAuditorias.js'
import { useSessionStore } from '../stores/session.js'

const $q = useQuasar()
const router = useRouter()
const session = useSessionStore()

const auditorias = ref([])
// Contadores asignables: solo los necesita el administrador para registrar y reasignar.
const contadores = ref([])

const cargando = ref(true)
const errorCarga = ref(null)

const filtroEstado = ref('todos')

const opcionesEstado = [
  { valor: 'todos', etiqueta: 'Todos', ayuda: 'Todas las auditorías.' },
  { valor: 'Pendiente', etiqueta: 'Pendiente', ayuda: 'Auditorías que aún no se empiezan.' },
  { valor: 'En Proceso', etiqueta: 'En proceso', ayuda: 'Auditorías en trabajo.' },
  { valor: 'Completado', etiqueta: 'Completado', ayuda: 'Auditorías terminadas.' },
  { valor: 'Aplazado por acta', etiqueta: 'Aplazado', ayuda: 'Auditorías aplazadas por acta.' },
]

const filtroSemaforo = ref('todos')
const texto = ref('')
const orden = ref('urgencia')

// Tarjetas del resumen: el semáforo lo calcula el backend desde la bitácora (próximo plazo pendiente).
const tarjetasSemaforo = [
  { valor: 'Vencido', clase: 'vencido', etiqueta: 'Vencidas', ayuda: 'Un plazo pendiente ya pasó.' },
  { valor: 'Crítico', clase: 'critico', etiqueta: 'Críticas', ayuda: 'Un plazo pendiente vence en 7 días o menos.' },
  {
    valor: 'Atención',
    clase: 'atencion',
    etiqueta: 'En atención',
    ayuda: 'Un plazo vence en 20 días o menos, o a la autoridad le quedan 60 días o menos.',
  },
  { valor: 'En tiempo', clase: 'en-tiempo', etiqueta: 'En tiempo', ayuda: 'Sin vencimientos cercanos.' },
  { valor: 'Concluida', clase: 'concluida', etiqueta: 'Concluidas', ayuda: 'Auditorías completadas.' },
]

const opcionesOrden = [
  { label: 'Urgencia', value: 'urgencia' },
  { label: 'Más recientes', value: 'recientes' },
  { label: 'Cliente (A-Z)', value: 'cliente' },
]

const conteoSemaforo = computed(() => contarPorSemaforo(auditorias.value))

const auditoriasFiltradas = computed(() =>
  ordenarAuditorias(
    filtrarAuditorias(auditorias.value, {
      texto: texto.value ?? '',
      estado: filtroEstado.value,
      semaforo: filtroSemaforo.value,
    }),
    orden.value,
  ),
)

const hayFiltros = computed(
  () => filtroEstado.value !== 'todos' || filtroSemaforo.value !== 'todos' || (texto.value ?? '').trim() !== '',
)

// Un segundo clic en la misma tarjeta quita el filtro.
const alternarSemaforo = (valor) => {
  filtroSemaforo.value = filtroSemaforo.value === valor ? 'todos' : valor
}

const limpiarFiltros = () => {
  filtroEstado.value = 'todos'
  filtroSemaforo.value = 'todos'
  texto.value = ''
}

const dialogoRegistroAbierto = ref(false)
const auditoriaEnEdicion = ref(null)

const cargar = async () => {
  cargando.value = true
  errorCarga.value = null
  try {
    const [lista, asignables] = await Promise.all([
      listarAuditorias(),
      session.esAdministrador ? listCounters() : Promise.resolve([]),
    ])
    auditorias.value = lista
    contadores.value = asignables
  } catch (error) {
    errorCarga.value = error
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

const abrirRegistro = () => {
  auditoriaEnEdicion.value = null
  dialogoRegistroAbierto.value = true
}

const abrirEdicion = (id) => {
  const found = auditorias.value.find((a) => a.id === id)
  if (!found) return
  auditoriaEnEdicion.value = found
  dialogoRegistroAbierto.value = true
}

const alRegistrar = (auditoria) => {
  auditorias.value = [auditoria, ...auditorias.value]
  $q.notify({ type: 'positive', message: 'Auditoría registrada.' })
}

const alGuardar = (auditoria) => {
  auditorias.value = auditorias.value.map((a) => (a.id === auditoria.id ? auditoria : a))
  $q.notify({ type: 'positive', message: 'Cambios guardados.' })
}

const reintentar = () => cargar()

const mensajeError = computed(() => errorCarga.value?.mensaje ?? 'las auditorías.')
</script>

<style scoped>
.auditorias-page {
  padding: 16px;
}

.auditorias-page__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 16px;
}

.auditorias-page__lead {
  flex: 1 1 260px;
  min-width: 0;
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
}

.auditorias-page__register-btn {
  min-width: 44px;
  min-height: 44px;
}

.auditorias-page__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auditorias-page__filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 12px;
  border: 1px solid var(--dg-borde);
  border-radius: 10px;
  background: var(--dg-fondo-suave);
}

/* Resumen por semáforo: cinco tarjetas que también filtran la lista */
.auditorias-page__resumen {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 8px;
}

.resumen-semaforo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-height: 44px;
  padding: 10px 12px;
  border-left-width: 5px;
  border-radius: 10px;
  background: var(--dg-superficie);
  color: var(--dg-texto);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.resumen-semaforo:focus-visible {
  outline: 3px solid var(--dg-foco);
  outline-offset: 2px;
}

.resumen-semaforo--activa {
  background: var(--dg-fondo-seleccion);
  box-shadow: inset 0 0 0 2px var(--dg-acento);
}

.resumen-semaforo__valor {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.1;
}

.resumen-semaforo__etiqueta {
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
  font-weight: 600;
}

.resumen-semaforo--vencido {
  border-left-color: var(--dg-error);
}

.resumen-semaforo--critico {
  border-left-color: var(--dg-prioridad-alta-borde);
}

.resumen-semaforo--atencion {
  border-left-color: var(--dg-importante);
}

.resumen-semaforo--en-tiempo {
  border-left-color: var(--dg-exito-borde);
}

.resumen-semaforo--concluida {
  border-left-color: var(--dg-neutro-borde);
}

/* En el celular, las cinco en una sola fila para no empujar la lista hacia abajo */
@media (max-width: 599px) {
  .auditorias-page__resumen {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
  }

  .resumen-semaforo {
    align-items: center;
    padding: 6px 2px;
    border-left-width: 1px;
    border-top-width: 4px;
    text-align: center;
  }

  .resumen-semaforo--vencido {
    border-top-color: var(--dg-error);
  }

  .resumen-semaforo--critico {
    border-top-color: var(--dg-prioridad-alta-borde);
  }

  .resumen-semaforo--atencion {
    border-top-color: var(--dg-importante);
  }

  .resumen-semaforo--en-tiempo {
    border-top-color: var(--dg-exito-borde);
  }

  .resumen-semaforo--concluida {
    border-top-color: var(--dg-neutro-borde);
  }

  .resumen-semaforo__valor {
    font-size: 1.2rem;
  }

  .resumen-semaforo__etiqueta {
    font-size: 0.68rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }
}

.auditorias-page__busqueda {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  width: 100%;
}

.auditorias-page__buscar {
  flex: 1 1 240px;
  min-width: 0;
}

.auditorias-page__orden {
  flex: 0 1 200px;
  min-width: 160px;
}

.auditorias-page__filtro-grupo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.auditorias-page__filtro-titulo {
  margin-right: 4px;
  color: var(--dg-texto-tenue);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.auditorias-page__chip {
  min-height: 32px;
  margin: 0;
  font-weight: 600;
}

.auditorias-page__limpiar {
  margin-left: auto;
}

.auditorias-page__lista {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sin-resultados {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px dashed var(--dg-borde-discontinuo);
  border-radius: 10px;
  background: var(--dg-superficie);
}

.sin-resultados__texto {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}

@media (min-width: 1024px) {
  .auditorias-page {
    padding: 20px 24px;
  }
}
</style>
