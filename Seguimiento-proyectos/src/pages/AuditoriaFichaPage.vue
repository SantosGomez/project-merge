<template>
  <q-page class="ficha">
    <q-btn
      flat
      no-caps
      color="dg-acento"
      icon="arrow_back"
      label="Volver a auditorías"
      class="ficha__volver control-touch"
      :to="{ name: 'auditorias' }"
    >
      <q-tooltip>Regresa a la lista de auditorías.</q-tooltip>
    </q-btn>

    <ScreenLoader v-if="cargando" text="Cargando la ficha de la auditoría…" />

    <ErrorState v-else-if="errorCarga" :detail="errorCarga.mensaje ?? 'la ficha de la auditoría.'" @retry="cargar" />

    <template v-else-if="auditoria">
      <q-card flat bordered class="ficha__cabecera" :class="`ficha__cabecera--${semaforoClase}`">
        <q-card-section>
          <div class="ficha__titulo-fila">
            <h1 class="ficha__cliente">{{ auditoria.cliente }}</h1>
            <q-chip dense square class="ficha__chip" :class="`ficha__estado--${estadoClase}`">
              {{ auditoria.estado }}
              <q-tooltip>Estatus de la auditoría; se cambia con «Editar».</q-tooltip>
            </q-chip>
            <q-chip dense square icon="traffic" class="ficha__chip" :class="`ficha__semaforo--${semaforoClase}`">
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
          </div>
          <p class="ficha__expediente">
            <q-icon name="folder_open" size="16px" aria-hidden="true" /> Expediente {{ auditoria.noExpediente }} ·
            {{ auditoria.tipoAud }}
            <span v-if="auditoria.estatal" class="ficha__estatal">Estatal</span>
          </p>

          <p class="ficha__proximo" :class="{ 'ficha__proximo--vacio': !auditoria.proximoVencimiento }">
            <q-icon name="event" size="20px" aria-hidden="true" />
            <span v-if="auditoria.proximoVencimiento">
              <strong>Próximo:</strong> {{ auditoria.queVence }} · vence {{ auditoria.proximoVencimiento }}
              ({{ textoDias(auditoria.diasParaVencer) }})
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

      <q-card flat bordered class="ficha__seccion">
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
                  · {{ diasAutoridad >= 0 ? `le quedan ${diasAutoridad} días` : `venció hace ${-diasAutoridad} días` }}
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

      <q-card flat bordered class="ficha__seccion">
        <q-card-section>
          <BitacoraAuditoria :auditoria-id="auditoria.id" :fases="fases" @cambio="refrescar" />
        </q-card-section>
      </q-card>

      <AuditoriaFormDialog
        v-model="dialogoEdicionAbierto"
        :auditoria="auditoria"
        :contadores="contadores"
        :es-admin="session.esAdministrador"
        @guardada="alGuardar"
      />
    </template>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'

import AuditoriaFormDialog from '../components/AuditoriaFormDialog.vue'
import BitacoraAuditoria from '../components/BitacoraAuditoria.vue'
import ErrorState from '../components/ErrorState.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { listarFases, obtenerAuditoria } from '../services/auditoriaService.js'
import { listCounters } from '../services/counterService.js'
import { useSessionStore } from '../stores/session.js'
import { plazoDeEvento } from '../utils/listaAuditorias.js'

const route = useRoute()
const $q = useQuasar()
const session = useSessionStore()

const ESTADO_CLASE = {
  Pendiente: 'pendiente',
  'En Proceso': 'en-proceso',
  Completado: 'completado',
  'Aplazado por acta': 'aplazado',
}
const SEMAFORO_CLASE = {
  Vencido: 'vencido',
  Crítico: 'critico',
  Atención: 'atencion',
  'En tiempo': 'en-tiempo',
  Concluida: 'concluida',
}
const AYUDA_SEMAFORO = {
  Vencido: 'Un plazo pendiente de la bitácora ya pasó.',
  Crítico: 'Un plazo pendiente vence en 7 días o menos.',
  Atención: 'Un plazo vence en 20 días o menos, o a la autoridad le quedan 60 días o menos para concluir.',
  'En tiempo': 'Sin vencimientos cercanos.',
  Concluida: 'La auditoría está completada.',
}
const ETIQUETA_FASE = { cumplida: 'Cumplida', actual: 'Actual', pendiente: 'Pendiente' }

const auditoria = ref(null)
const fases = ref([])
const contadores = ref([])
const cargando = ref(true)
const errorCarga = ref(null)
const dialogoEdicionAbierto = ref(false)

const estadoClase = computed(() => ESTADO_CLASE[auditoria.value?.estado] ?? 'pendiente')
const semaforoClase = computed(() => SEMAFORO_CLASE[auditoria.value?.semaforo] ?? 'en-tiempo')

const faseActualId = computed(() => auditoria.value?.faseActual?.id ?? 1)
const estadoDeFase = (id) => {
  if (id < faseActualId.value) return 'cumplida'
  if (id === faseActualId.value) return 'actual'
  return 'pendiente'
}

// «Fase 3 · Observaciones» → «Observaciones».
const nombreCorto = (nombre) => (nombre.includes('·') ? nombre.slice(nombre.indexOf('·') + 1).trim() : nombre)

// Días que le quedan a la autoridad para su fecha de vencimiento (mismo cálculo que los plazos).
const diasAutoridad = computed(() =>
  auditoria.value ? plazoDeEvento({ fechaLimite: auditoria.value.fechaVencimiento, estado: '' }).dias : null,
)

const textoDias = (dias) => {
  if (dias === 0) return 'vence hoy'
  if (dias < 0) return `venció hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`
  return `en ${dias} ${dias === 1 ? 'día' : 'días'}`
}

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
watch(() => route.params.id, (id) => id && cargar())

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
</script>

<style scoped>
.ficha {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 1100px;
  padding: 16px;
}

.ficha__volver {
  align-self: flex-start;
}

.ficha__cabecera {
  border-left-width: 6px;
  background: var(--dg-superficie);
}

.ficha__cabecera--vencido {
  border-left-color: var(--dg-error);
}

.ficha__cabecera--critico {
  border-left-color: var(--dg-prioridad-alta-borde);
}

.ficha__cabecera--atencion {
  border-left-color: var(--dg-importante);
}

.ficha__cabecera--en-tiempo {
  border-left-color: var(--dg-exito-borde);
}

.ficha__cabecera--concluida {
  border-left-color: var(--dg-neutro-borde);
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

.ficha__semaforo--vencido {
  background: var(--dg-error);
  color: var(--dg-superficie);
}

.ficha__semaforo--critico {
  background: var(--dg-prioridad-alta-fondo);
  color: var(--dg-prioridad-alta);
  border: 1px solid var(--dg-prioridad-alta-borde);
}

.ficha__semaforo--atencion {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.ficha__semaforo--en-tiempo {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.ficha__semaforo--concluida {
  background: var(--dg-neutro-fondo);
  color: var(--dg-texto-secundario);
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
</style>
