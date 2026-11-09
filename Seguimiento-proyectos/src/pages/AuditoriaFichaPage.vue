<template>
  <q-page class="ficha">
    <q-btn
      flat
      no-caps
      color="dg-acento"
      icon="arrow_back"
      :label="volver.etiqueta"
      class="ficha__volver control-touch"
      :to="volver.destino"
    >
      <q-tooltip>{{ volver.ayuda }}</q-tooltip>
    </q-btn>

    <ScreenLoader v-if="cargando" text="Cargando la ficha de la auditoría…" />

    <ErrorState
      v-else-if="errorCarga"
      :detail="errorCarga.mensaje ?? 'la ficha de la auditoría.'"
      @retry="cargar"
    />

    <template v-else-if="auditoria">
      <q-card flat bordered class="ficha__cabecera" :class="`semaforo--${semaforoClase}`">
        <q-card-section>
          <div class="ficha__titulo-fila">
            <h1 class="ficha__cliente">{{ auditoria.cliente }}</h1>
            <q-chip dense square class="ficha__chip" :class="`ficha__estado--${estadoClase}`">
              {{ auditoria.estado }}
              <q-tooltip>Estatus de la auditoría; se cambia con «Editar».</q-tooltip>
            </q-chip>
            <q-chip
              dense
              square
              icon="traffic"
              class="ficha__chip semaforo-etiqueta"
              :class="`semaforo--${semaforoClase}`"
            >
              {{ auditoria.semaforo }}
              <q-tooltip>{{ AYUDA_SEMAFORO[auditoria.semaforo] }}</q-tooltip>
            </q-chip>
            <q-btn
              outline
              no-caps
              color="primary"
              icon="edit"
              label="Editar"
              class="ficha__editar control-touch"
              @click="dialogoEdicionAbierto = true"
            >
              <q-tooltip>Cambia los datos generales o el estatus de la auditoría.</q-tooltip>
            </q-btn>
            <q-btn
              flat
              no-caps
              color="dg-acento"
              icon="forum"
              label="Mensajes"
              class="control-touch"
              @click="chatAbierto = true"
            >
              <q-tooltip>Abre el chat con el administrador y los contadores de esta auditoría.</q-tooltip>
            </q-btn>
            <q-btn
              flat
              no-caps
              color="dg-acento"
              icon="print"
              label="Imprimir ficha"
              class="control-touch"
              @click="imprimir"
            >
              <q-tooltip
                >Imprime la ficha o guárdala como PDF, con la historia completa en tabla.</q-tooltip
              >
            </q-btn>
          </div>
          <p class="ficha__expediente">
            <q-icon name="folder_open" size="16px" aria-hidden="true" /> Expediente
            {{ auditoria.noExpediente }} ·
            {{ auditoria.tipoAud }}
            <span v-if="auditoria.estatal" class="ficha__estatal">Estatal</span>
          </p>

          <p
            class="ficha__proximo"
            :class="{ 'ficha__proximo--vacio': !auditoria.proximoVencimiento }"
          >
            <q-icon name="event" size="20px" aria-hidden="true" />
            <span v-if="auditoria.proximoVencimiento">
              <strong>Próximo:</strong> {{ auditoria.queVence }} · vence
              {{ auditoria.proximoVencimiento }} ({{ textoDiasPlazo(auditoria.diasParaVencer) }})
            </span>
            <span v-else>Sin plazos pendientes en la bitácora</span>
          </p>
        </q-card-section>
      </q-card>

      <q-card flat bordered class="ficha__seccion">
        <q-card-section>
          <h2 class="ficha__subtitulo">Avance por fase</h2>
          <ol class="ficha__fases">
            <li
              v-for="fase in fases"
              :key="fase.id"
              class="ficha__fase"
              :class="`ficha__fase--${estadoDeFase(fase.id)}`"
            >
              <span class="ficha__fase-marca" aria-hidden="true">
                <q-icon v-if="estadoDeFase(fase.id) === 'cumplida'" name="check" size="14px" />
                <template v-else>{{ fase.id }}</template>
              </span>
              <span class="ficha__fase-nombre">{{ nombreCorto(fase.nombre) }}</span>
              <span class="ficha__fase-estado">{{ ETIQUETA_FASE[estadoDeFase(fase.id)] }}</span>
              <q-tooltip max-width="260px">{{ fase.descripcion }}</q-tooltip>
            </li>
          </ol>
        </q-card-section>
      </q-card>

      <!-- En pantallas anchas, datos generales a la derecha y bitácora a la izquierda -->
      <div class="ficha__cuerpo">
        <q-card flat bordered class="ficha__seccion ficha__datos-generales">
          <q-card-section>
            <h2 class="ficha__subtitulo">Datos generales</h2>
            <dl class="ficha__datos">
              <div class="ficha__dato">
                <dt>Dependencia</dt>
                <dd>{{ auditoria.dependencia }}</dd>
              </div>
              <div class="ficha__dato">
                <dt>Periodo revisado</dt>
                <dd>{{ auditoria.periodoInicio }} al {{ auditoria.periodoFinal }}</dd>
              </div>
              <div class="ficha__dato">
                <dt>Inicio</dt>
                <dd>{{ auditoria.fechaInicio }}</dd>
              </div>
              <div class="ficha__dato">
                <dt>Vencimiento (plazo de la autoridad)</dt>
                <dd>
                  {{ auditoria.fechaVencimiento }}
                  <span v-if="diasAutoridad !== null" class="ficha__tenue">
                    ·
                    {{
                      diasAutoridad >= 0
                        ? `le quedan ${diasAutoridad} días`
                        : `venció hace ${-diasAutoridad} días`
                    }}
                  </span>
                </dd>
              </div>
              <div class="ficha__dato ficha__dato--ancho">
                <dt>Contadores asignados</dt>
                <dd>
                  <q-chip
                    v-for="contador in auditoria.contadores"
                    :key="contador.id"
                    dense
                    outline
                    color="dg-acento"
                    class="ficha__contador"
                  >
                    {{ contador.nombre }}
                  </q-chip>
                </dd>
              </div>
              <div v-if="auditoria.descripcion" class="ficha__dato ficha__dato--ancho">
                <dt>Descripción</dt>
                <dd class="ficha__texto">{{ auditoria.descripcion }}</dd>
              </div>
              <div v-if="auditoria.observacion" class="ficha__dato ficha__dato--ancho">
                <dt>Observación</dt>
                <dd class="ficha__texto">{{ auditoria.observacion }}</dd>
              </div>
            </dl>
          </q-card-section>
        </q-card>

        <q-card flat bordered class="ficha__seccion ficha__bitacora">
          <q-card-section>
            <BitacoraAuditoria :auditoria-id="auditoria.id" :fases="fases" @cambio="refrescar" />
          </q-card-section>
        </q-card>
      </div>

      <AuditoriaFormDialog
        v-model="dialogoEdicionAbierto"
        :auditoria="auditoria"
        :contadores="contadores"
        :es-admin="session.esAdministrador"
        @guardada="alGuardar"
      />

      <ChatAuditoria v-model="chatAbierto" :auditoria-id="auditoria.id" :cliente="auditoria.cliente" />

      <!-- En el celular el chat queda a la mano del pulgar; el panel se abre desde ese mismo lado -->
      <q-page-sticky class="lt-sm" position="bottom-right" :offset="[16, 16]">
        <q-btn
          fab
          color="primary"
          icon="forum"
          aria-label="Abrir mensajes de la auditoría"
          aria-haspopup="dialog"
          @click="chatAbierto = true"
        >
          <q-tooltip anchor="center left" self="center right">Abre el chat de esta auditoría.</q-tooltip>
        </q-btn>
      </q-page-sticky>
    </template>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

import AuditoriaFormDialog from '../components/AuditoriaFormDialog.vue'
import BitacoraAuditoria from '../components/BitacoraAuditoria.vue'
import ChatAuditoria from '../components/ChatAuditoria.vue'
import ErrorState from '../components/ErrorState.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { listarFases, obtenerAuditoria } from '../services/auditoriaService.js'
import { listCounters } from '../services/counterService.js'
import { useSessionStore } from '../stores/session.js'
import { destinoVolverFicha, plazoDeEvento } from '../utils/listaAuditorias.js'
import { AYUDA_SEMAFORO, claseSemaforo, textoDiasPlazo } from '../utils/semaforoAuditoria.js'

const route = useRoute()
const router = useRouter()

// «Volver» regresa a donde se estaba: el router guarda la página anterior en history.state.back
// (no existe al abrir la ficha con un enlace directo o al recargar).
const paginaAnterior = window.history.state?.back
const volver = destinoVolverFicha(paginaAnterior ? router.resolve(paginaAnterior) : null)
const $q = useQuasar()
const session = useSessionStore()

const ESTADO_CLASE = {
  Pendiente: 'pendiente',
  'En Proceso': 'en-proceso',
  Completado: 'completado',
  'Aplazado por acta': 'aplazado',
}
const ETIQUETA_FASE = { cumplida: 'Cumplida', actual: 'Actual', pendiente: 'Pendiente' }

const auditoria = ref(null)
const fases = ref([])
const contadores = ref([])
const cargando = ref(true)
const errorCarga = ref(null)
const dialogoEdicionAbierto = ref(false)
const chatAbierto = ref(false)

// Desde el aviso «Ver mensajes» se llega con ?chat=1: la ficha abre el chat directamente.
watch(
  () => route.query.chat,
  (chat) => {
    if (chat) chatAbierto.value = true
  },
  { immediate: true },
)

const estadoClase = computed(() => ESTADO_CLASE[auditoria.value?.estado] ?? 'pendiente')
const semaforoClase = computed(() => claseSemaforo(auditoria.value?.semaforo))

const faseActualId = computed(() => auditoria.value?.faseActual?.id ?? 1)
const estadoDeFase = (id) => {
  if (id < faseActualId.value) return 'cumplida'
  if (id === faseActualId.value) return 'actual'
  return 'pendiente'
}

// «Fase 3 · Observaciones» → «Observaciones».
const nombreCorto = (nombre) =>
  nombre.includes('·') ? nombre.slice(nombre.indexOf('·') + 1).trim() : nombre

// Días que le quedan a la autoridad para su fecha de vencimiento (mismo cálculo que los plazos).
const diasAutoridad = computed(() =>
  auditoria.value
    ? plazoDeEvento({ fechaLimite: auditoria.value.fechaVencimiento, estado: '' }).dias
    : null,
)

const cargar = async () => {
  cargando.value = true
  errorCarga.value = null
  try {
    const [datos, catalogo, asignables] = await Promise.all([
      obtenerAuditoria(route.params.id),
      listarFases(),
      session.esAdministrador ? listCounters() : Promise.resolve([]),
    ])
    auditoria.value = datos
    fases.value = catalogo
    contadores.value = asignables
  } catch (error) {
    errorCarga.value = error
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
watch(
  () => route.params.id,
  (id) => id && cargar(),
)

// Tras cambiar la bitácora, se recalculan fase actual, próximo vencimiento y semáforo sin recargar la página.
const refrescar = async () => {
  try {
    auditoria.value = await obtenerAuditoria(route.params.id)
  } catch (error) {
    $q.notify({ type: 'negative', message: error.mensaje ?? 'No se pudo actualizar la ficha.' })
  }
}

const alGuardar = (guardada) => {
  auditoria.value = guardada
  $q.notify({ type: 'positive', message: 'Cambios guardados.' })
}

// El diálogo del navegador permite imprimir o guardar como PDF.
const imprimir = () => window.print()
</script>

<style scoped>
.ficha {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.ficha__cuerpo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ficha__volver {
  align-self: flex-start;
}

.ficha__cabecera {
  border-left-width: 6px;
  border-left-color: var(--semaforo-color);
  background: var(--dg-superficie);
}

.ficha__titulo-fila {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ficha__cliente {
  min-width: 0;
  margin: 0 auto 0 0;
  color: var(--dg-texto);
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.ficha__chip {
  margin: 0;
  font-weight: 600;
}

.ficha__estado--pendiente {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.ficha__estado--en-proceso {
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
}

.ficha__estado--completado {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.ficha__estado--aplazado {
  background: var(--dg-error-fondo);
  color: var(--dg-error);
}

.ficha__expediente {
  margin: 6px 0 0;
  color: var(--dg-texto-tenue);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.ficha__estatal {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
  font-size: 0.75rem;
  font-weight: 600;
}

.ficha__proximo {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--dg-fondo-suave);
  color: var(--dg-texto);
  overflow-wrap: anywhere;
}

.ficha__proximo--vacio {
  color: var(--dg-texto-tenue);
}

.ficha__seccion {
  background: var(--dg-superficie);
}

.ficha__subtitulo {
  margin: 0 0 12px;
  color: var(--dg-texto);
  font-size: 1.1rem;
  font-weight: 700;
}

/* Avance por fase: en el celular una lista; en pantallas anchas, seis columnas */
.ficha__fases {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 900px) {
  .ficha__fases {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

.ficha__fase {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
  color: var(--dg-texto-tenue);
}

.ficha__fase-marca {
  display: flex;
  grid-row: 1 / 3;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 2px solid var(--dg-borde-fuerte);
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: 700;
}

.ficha__fase-nombre {
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.25;
}

.ficha__fase-estado {
  font-size: 0.75rem;
}

.ficha__fase--cumplida .ficha__fase-marca {
  border-color: var(--dg-acento);
  background: var(--dg-acento);
  color: var(--dg-superficie);
}

.ficha__fase--actual {
  border-color: var(--dg-acento);
  background: var(--dg-fondo-seleccion);
}

.ficha__fase--actual .ficha__fase-marca {
  border-color: var(--dg-acento);
  color: var(--dg-acento);
}

.ficha__fase--actual .ficha__fase-nombre {
  color: var(--dg-texto);
}

.ficha__datos {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px 24px;
  margin: 0;
}

@media (min-width: 700px) {
  .ficha__datos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ficha__dato dt {
  color: var(--dg-texto-tenue);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.ficha__dato dd {
  margin: 2px 0 0;
  color: var(--dg-texto);
  overflow-wrap: anywhere;
}

.ficha__dato--ancho {
  grid-column: 1 / -1;
}

.ficha__texto {
  white-space: pre-line;
}

.ficha__tenue {
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.ficha__contador {
  margin: 0 4px 4px 0;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}

@media (min-width: 1024px) {
  .ficha {
    padding: 20px 24px;
  }
}

/* Pantallas anchas: la bitácora ocupa el espacio libre y los datos generales quedan a la
   derecha, a la vista mientras se recorre la bitácora */
@media (min-width: 1280px) {
  .ficha__cuerpo {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
    grid-template-areas: 'bitacora datos';
    align-items: start;
  }

  .ficha__bitacora {
    grid-area: bitacora;
  }

  .ficha__datos-generales {
    grid-area: datos;
    position: sticky;
    top: 16px;
    /* Con una descripción larga, se desplaza por dentro en vez de quedar cortada */
    max-height: calc(100vh - 32px);
    overflow-y: auto;
  }

  /* En la columna angosta, un dato por renglón */
  .ficha__datos-generales .ficha__datos {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Impresión: solo la ficha, sin menú, barra ni botones. `body:has(.ficha)` limita
   estas reglas a esta pantalla aunque la hoja de estilos siga cargada en otras. */
@media print {
  :global(body:has(.ficha) .q-drawer),
  :global(body:has(.ficha) .q-header),
  :global(body:has(.ficha) .q-btn),
  :global(body:has(.ficha) .q-page-sticky) {
    display: none !important;
  }

  :global(body:has(.ficha) .q-page-container) {
    padding: 0 !important;
  }

  .ficha {
    padding: 0;
  }

  .ficha__cabecera {
    break-inside: avoid-page;
  }

  .ficha__cuerpo {
    display: flex !important;
    flex-direction: column;
  }

  .ficha__datos-generales {
    position: static !important;
  }
}
</style>
