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
        <section class="auditorias-page__filtros" aria-label="Filtros de auditorías">
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
          <div class="auditorias-page__filtro-grupo">
            <span class="auditorias-page__filtro-titulo">Semáforo</span>
            <q-chip
              v-for="opcion in opcionesSemaforo"
              :key="opcion.valor"
              clickable
              :outline="filtroSemaforo !== opcion.valor"
              :color="filtroSemaforo === opcion.valor ? 'primary' : 'grey-7'"
              :text-color="filtroSemaforo === opcion.valor ? 'white' : 'grey-9'"
              :aria-pressed="filtroSemaforo === opcion.valor ? 'true' : 'false'"
              class="auditorias-page__chip"
              @click="filtroSemaforo = opcion.valor"
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
            Ninguna auditoría cumple estos filtros. Cambia el estado o el semáforo, o usa «Limpiar filtros».
          </p>
        </div>

        <div v-else class="auditorias-page__lista">
          <AuditoriaItem
            v-for="item in auditoriasFiltradas"
            :key="item.id"
            :auditoria="item"
            :nombres-contadores="item.contadores.map((c) => c.nombre)"
            @ver-detalle="abrirDetalle(item)"
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

    <AuditoriaDetalleDialog
      v-if="auditoriaEnDetalle"
      v-model="dialogoDetalleAbierto"
      :auditoria="auditoriaEnDetalle"
      @cambio="refrescar"
    />
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'

import AuditoriaDetalleDialog from '../components/AuditoriaDetalleDialog.vue'
import AuditoriaFormDialog from '../components/AuditoriaFormDialog.vue'
import AuditoriaItem from '../components/AuditoriaItem.vue'
import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { listarAuditorias } from '../services/auditoriaService.js'
import { listCounters } from '../services/counterService.js'
import { useSessionStore } from '../stores/session.js'

const $q = useQuasar()
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

// El semáforo lo calcula el backend desde la bitácora (próximo plazo pendiente).
const opcionesSemaforo = [
  { valor: 'todos', etiqueta: 'Todos', ayuda: 'Sin filtrar por semáforo.' },
  { valor: 'Vencido', etiqueta: 'Vencido', ayuda: 'Un plazo pendiente ya pasó.' },
  { valor: 'Crítico', etiqueta: 'Crítico', ayuda: 'Un plazo pendiente vence en 7 días o menos.' },
  {
    valor: 'Atención',
    etiqueta: 'Atención',
    ayuda: 'Un plazo vence en 20 días o menos, o a la autoridad le quedan 60 días o menos.',
  },
  { valor: 'En tiempo', etiqueta: 'En tiempo', ayuda: 'Sin vencimientos cercanos.' },
  { valor: 'Concluida', etiqueta: 'Concluida', ayuda: 'Auditorías completadas.' },
]

const auditoriasFiltradas = computed(() =>
  auditorias.value.filter(
    (a) =>
      (filtroEstado.value === 'todos' || a.estado === filtroEstado.value) &&
      (filtroSemaforo.value === 'todos' || a.semaforo === filtroSemaforo.value),
  ),
)

const hayFiltros = computed(() => filtroEstado.value !== 'todos' || filtroSemaforo.value !== 'todos')

const limpiarFiltros = () => {
  filtroEstado.value = 'todos'
  filtroSemaforo.value = 'todos'
}

const dialogoRegistroAbierto = ref(false)
const auditoriaEnEdicion = ref(null)
const dialogoDetalleAbierto = ref(false)
const auditoriaEnDetalle = ref(null)

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

// Tras cambiar la bitácora se vuelve a leer la lista sin pantalla de carga, para que la
// fase actual, el próximo vencimiento y el semáforo de la tarjeta queden al día.
const refrescar = async () => {
  try {
    auditorias.value = await listarAuditorias()
    if (auditoriaEnDetalle.value) {
      auditoriaEnDetalle.value =
        auditorias.value.find((a) => a.id === auditoriaEnDetalle.value.id) ?? auditoriaEnDetalle.value
    }
  } catch (error) {
    $q.notify({ type: 'negative', message: error.mensaje ?? 'No se pudo actualizar la lista de auditorías.' })
  }
}

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

const abrirDetalle = (auditoria) => {
  auditoriaEnDetalle.value = auditoria
  dialogoDetalleAbierto.value = true
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
