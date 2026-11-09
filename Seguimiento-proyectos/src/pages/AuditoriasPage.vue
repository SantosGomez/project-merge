<template>
  <q-page class="auditorias-page">
    <div class="auditorias-page__head">
      <p class="auditorias-page__lead">
        Registra y da seguimiento a las auditorías asignadas. Cambia el estado y el resto de los
        datos con «Editar».
      </p>
      <q-btn
        class="auditorias-page__register-btn control-touch gt-xs boton-presionable"
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

    <!-- Esqueleto con la forma de la lista; el texto se anuncia a los lectores de pantalla. -->
    <div v-if="cargando" class="auditorias-page__carga" role="status">
      <q-skeleton v-for="n in 3" :key="n" type="rect" height="88px" class="auditorias-page__skeleton" />
      <p class="auditorias-page__skeleton-texto">Cargando auditorías…</p>
    </div>

    <ErrorState v-else-if="errorCarga" :detail="mensajeError" @retry="reintentar" />

    <div v-else class="auditorias-page__body">
      <EmptyState
        v-if="auditoriasFiltradas.length === 0 && !hayFiltros"
        title="Todavía no hay auditorías"
        message="Registra la primera con «Registrar auditoría» para empezar a darle seguimiento."
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
            class="resumen-semaforo boton-presionable"
            :class="[
              `semaforo--${tarjeta.clase}`,
              { 'resumen-semaforo--activa': filtroSemaforo === tarjeta.valor },
            ]"
            :aria-pressed="filtroSemaforo === tarjeta.valor ? 'true' : 'false'"
            @click="alternarSemaforo(tarjeta.valor)"
          >
            <span class="resumen-semaforo__valor">{{ conteoSemaforo[tarjeta.valor] }}</span>
            <span class="resumen-semaforo__etiqueta">{{ tarjeta.etiqueta }}</span>
            <q-tooltip max-width="260px"
              >{{ AYUDA_SEMAFORO[tarjeta.valor] }} Haz clic para ver solo estas.</q-tooltip
            >
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
              class="auditorias-page__buscar input-moderno"
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
              dropdown-icon="expand_more"
              popup-content-class="menu-seleccion-custom"
              transition-show="jump-down"
              transition-hide="jump-up"
              :transition-duration="180"
              label="Ordenar por"
              class="auditorias-page__orden selector-moderno"
            >
              <template #prepend>
                <q-icon name="sort" />
              </template>
              <template #option="{ itemProps, opt, selected }">
                <q-item
                  v-bind="itemProps"
                  :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                >
                  <q-item-section>
                    <q-item-label>{{ opt.label }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="selected" side>
                    <q-icon name="check" size="18px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
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
              :color="filtroEstado === opcion.valor ? 'primary' : 'dg-texto-tenue'"
              :text-color="filtroEstado === opcion.valor ? 'dg-superficie' : 'dg-texto'"
              :aria-pressed="filtroEstado === opcion.valor ? 'true' : 'false'"
              class="auditorias-page__chip boton-presionable"
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
            class="auditorias-page__limpiar control-touch boton-presionable"
            @click="limpiarFiltros"
          >
            <q-tooltip>Vuelve a mostrar todas las auditorías.</q-tooltip>
          </q-btn>
        </section>

        <div v-if="auditoriasFiltradas.length === 0" class="sin-resultados" role="status">
          <q-icon name="filter_alt" size="28px" color="dg-texto-tenue" aria-hidden="true" />
          <p class="sin-resultados__texto">
            Ninguna auditoría cumple la búsqueda o los filtros. Cambia el texto, el estado o el
            semáforo, o usa «Limpiar filtros».
          </p>
        </div>

        <AuditoriasTabla
          v-else-if="vistaTabla"
          :auditorias="auditoriasFiltradas"
          @ver-detalle="verFicha"
          @editar="abrirEdicion"
        />

        <div v-else class="auditorias-page__lista">
          <AuditoriaItem
            v-for="item in auditoriasFiltradas"
            :key="item.id"
            :auditoria="item"
            :nombres-contadores="item.contadores.map((c) => c.nombre)"
            @ver-detalle="verFicha(item.id)"
            @editar="abrirEdicion(item.id)"
            @abrir-chat="chatAbierto = item"
          />
        </div>
      </template>
    </div>

    <!-- En el celular, el registro va en un botón flotante para tenerlo siempre a la mano -->
    <q-page-sticky class="lt-sm" position="bottom-right" :offset="[16, 16]">
      <q-btn
        fab
        color="primary"
        icon="add"
        class="boton-presionable"
        aria-label="Registrar auditoría"
        aria-haspopup="dialog"
        @click="abrirRegistro"
      >
        <q-tooltip anchor="center left" self="center right"
          >Registrar una auditoría nueva.</q-tooltip
        >
      </q-btn>
    </q-page-sticky>

    <AuditoriaFormDialog
      v-model="dialogoRegistroAbierto"
      :auditoria="auditoriaEnEdicion"
      :contadores="contadores"
      :es-admin="session.esAdministrador"
      @registrada="alRegistrar"
      @guardada="alGuardar"
    />

    <ChatAuditoria
      v-if="chatAbierto"
      :model-value="Boolean(chatAbierto)"
      :auditoria-id="chatAbierto.id"
      :cliente="chatAbierto.cliente"
      @update:model-value="(abierto) => !abierto && (chatAbierto = null)"
    />
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

import AuditoriaFormDialog from '../components/AuditoriaFormDialog.vue'
import AuditoriaItem from '../components/AuditoriaItem.vue'
import ChatAuditoria from '../components/ChatAuditoria.vue'
import AuditoriasTabla from '../components/AuditoriasTabla.vue'
import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import { listarAuditorias } from '../services/auditoriaService.js'
import { listCounters } from '../services/counterService.js'
import {
  contarPorSemaforo,
  filtrarAuditorias,
  ordenarAuditorias,
} from '../utils/listaAuditorias.js'
import { AYUDA_SEMAFORO } from '../utils/semaforoAuditoria.js'
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
  { valor: 'Aplazado por acta', etiqueta: 'Aplazado por acta', ayuda: 'Auditorías aplazadas por acta.' },
]

const filtroSemaforo = ref('todos')
const texto = ref('')
const orden = ref('urgencia')

// Tarjetas del resumen: el semáforo lo calcula el backend desde la bitácora (próximo plazo pendiente).
const tarjetasSemaforo = [
  {
    valor: 'Vencido',
    clase: 'vencido',
    etiqueta: 'Vencidas',
  },
  { valor: 'Crítico', clase: 'critico', etiqueta: 'Críticas' },
  { valor: 'Atención', clase: 'atencion', etiqueta: 'En atención' },
  { valor: 'En tiempo', clase: 'en-tiempo', etiqueta: 'En tiempo' },
  { valor: 'Concluida', clase: 'concluida', etiqueta: 'Concluidas' },
]

const opcionesOrden = [
  { label: 'Urgencia', value: 'urgencia' },
  { label: 'Más recientes', value: 'recientes' },
  { label: 'Cliente (A-Z)', value: 'cliente' },
]

// En escritorio la lista se ve como tabla; en tablet y celular, como tarjetas.
const vistaTabla = computed(() => $q.screen.width >= 1024)

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
  () =>
    filtroEstado.value !== 'todos' ||
    filtroSemaforo.value !== 'todos' ||
    (texto.value ?? '').trim() !== '',
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
// Auditoría cuyo chat está abierto en el panel lateral (null = cerrado).
const chatAbierto = ref(null)

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

// Al volver a la ventana (por ejemplo, al día siguiente) el semáforo y los días se refrescan sin esqueleto.
const alVolver = async () => {
  if (document.visibilityState !== 'visible' || cargando.value || errorCarga.value) return
  try {
    auditorias.value = await listarAuditorias()
  } catch {
    // Se conserva la lista que ya se ve; la siguiente visita la actualiza.
  }
}
document.addEventListener('visibilitychange', alVolver)
onBeforeUnmount(() => document.removeEventListener('visibilitychange', alVolver))

const abrirRegistro = () => {
  auditoriaEnEdicion.value = null
  dialogoRegistroAbierto.value = true
}

const verFicha = (id) => router.push({ name: 'auditoria-ficha', params: { id } })

const abrirEdicion = (id) => {
  const found = auditorias.value.find((a) => a.id === id)
  if (!found) return
  auditoriaEnEdicion.value = found
  dialogoRegistroAbierto.value = true
}

const alRegistrar = (auditoria) => {
  auditorias.value = [auditoria, ...auditorias.value]
  // Si los filtros la ocultan, se dice por qué y se ofrece quitarlos.
  const oculta = !auditoriasFiltradas.value.some((a) => a.id === auditoria.id)
  $q.notify({
    type: 'positive',
    message: oculta ? 'Auditoría registrada. No aparece porque hay filtros activos.' : 'Auditoría registrada.',
    actions: oculta ? [{ label: 'Limpiar filtros', color: 'white', noCaps: true, handler: limpiarFiltros }] : [],
  })
}

const alGuardar = (auditoria) => {
  auditorias.value = auditorias.value.map((a) => (a.id === auditoria.id ? auditoria : a))
  $q.notify({ type: 'positive', message: 'Cambios de la auditoría guardados.' })
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
  border-left-color: var(--semaforo-color);
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
    border-top-color: var(--semaforo-color);
    text-align: center;
  }

  .resumen-semaforo__valor {
    font-size: 1.2rem;
  }

  .resumen-semaforo__etiqueta {
    font-size: 0.75rem;
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
  /* 12 px entre filas: las áreas táctiles de los chips no se enciman. */
  gap: 12px 8px;
}

.auditorias-page__filtro-titulo {
  margin-right: 4px;
  color: var(--dg-texto-tenue);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

/* El chip se ve de 32 px; su área táctil llega a 44 px con 6 px invisibles arriba y abajo. */
.auditorias-page__chip {
  position: relative;
  min-height: 32px;
  margin: 0;
  font-weight: 600;
}

.auditorias-page__chip::after {
  content: '';
  position: absolute;
  inset: -6px 0;
}

.auditorias-page__limpiar {
  margin-left: auto;
}

.auditorias-page__carga {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auditorias-page__skeleton {
  border-radius: 12px;
}

.auditorias-page__skeleton-texto {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.95rem;
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

/* Espacio al pie para que el botón flotante no tape la última tarjeta */
@media (max-width: 599px) {
  .auditorias-page {
    padding-bottom: 88px;
  }
}

@media (min-width: 1024px) {
  .auditorias-page {
    padding: 20px 24px;
  }
}
</style>
