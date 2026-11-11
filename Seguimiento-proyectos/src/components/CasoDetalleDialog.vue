<template>
  <q-dialog
    v-model="dialogoAbierto"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="detalle-caso-titulo"
  >
    <q-card class="detalle-caso">
      <q-card-section class="detalle-caso__head">
        <div class="detalle-caso__head-row">
          <span class="detalle-caso__icono" aria-hidden="true">
            <q-icon name="visibility" size="18px" />
          </span>
          <div class="detalle-caso__head-texto">
            <div class="detalle-caso__title-row">
              <h2 id="detalle-caso-titulo" class="detalle-caso__title">{{ caso.cliente }}</h2>
              <span v-if="caso.importante" class="detalle-importante">
                <q-icon name="star" size="12px" aria-hidden="true" />
                Importante
                <q-tooltip>Caso marcado como importante: requiere seguimiento especial.</q-tooltip>
              </span>
            </div>
            <p class="detalle-caso__ayuda">{{ textoAyuda }}</p>
          </div>
        </div>
      </q-card-section>

      <q-card-section class="detalle-caso__body">
        <!-- Otra persona cambió el caso con la ficha abierta: se dice qué cambió, no solo se pinta. -->
        <p v-if="camposActualizados.length > 0" class="detalle-aviso-cambio" role="status">
          <q-icon name="sync" size="16px" aria-hidden="true" />
          <span>Este caso se actualizó mientras lo veías: {{ textoCamposActualizados }}.</span>
        </p>

        <!-- Datos del caso y fechas en dos columnas -->
        <section class="detalle-seccion">
          <h3 class="detalle-seccion__titulo">Datos del caso</h3>
          <div class="detalle-seccion__columnas">
            <div class="detalle-columna">
              <div
                class="detalle-campo"
                :class="{ 'detalle-campo--actualizado': cambio('prioridad') }"
              >
                <div class="detalle-label">
                  <q-icon name="flag" size="16px" aria-hidden="true" />
                  <span>Prioridad</span>
                </div>
                <div class="detalle-value">
                  <PriorityTag :priority="caso.prioridad" />
                </div>
              </div>

              <div
                class="detalle-campo"
                :class="{ 'detalle-campo--actualizado': cambio('estado') }"
              >
                <div class="detalle-label">
                  <q-icon name="tune" size="16px" aria-hidden="true" />
                  <span>Estado</span>
                </div>
                <div class="detalle-value">
                  <span
                    class="detalle-estado"
                    :class="{ 'detalle-estado--finalizado': esFinalizado }"
                    :style="{ '--dot-color': colorEstado }"
                  >
                    <span class="punto-estado-sm" aria-hidden="true" />
                    {{ statusLabel }}
                  </span>
                  <q-tooltip
                    >Pendiente: sin empezar. En proceso: en trabajo. Finalizado:
                    terminado.</q-tooltip
                  >
                </div>
              </div>

              <div
                class="detalle-campo"
                :class="{ 'detalle-campo--actualizado': cambio('contador_id') }"
              >
                <div class="detalle-label">
                  <q-icon name="person" size="16px" aria-hidden="true" />
                  <span>Contador asignado</span>
                </div>
                <div class="detalle-value">{{ nombreContador }}</div>
              </div>
            </div>

            <div class="detalle-columna">
              <div
                class="detalle-campo"
                :class="{ 'detalle-campo--actualizado': cambio('fecha_inicio') }"
              >
                <div class="detalle-label">
                  <q-icon name="event" size="16px" aria-hidden="true" />
                  <span>Fecha de inicio</span>
                </div>
                <div class="detalle-value" :class="{ 'detalle-vacio': !fechaInicio }">
                  {{ fechaInicio || 'Sin fecha' }}
                </div>
              </div>

              <div
                class="detalle-campo"
                :class="{ 'detalle-campo--actualizado': cambio('fecha_vencimiento') }"
              >
                <div class="detalle-label">
                  <q-icon name="schedule" size="16px" aria-hidden="true" />
                  <span>Fecha de vencimiento</span>
                </div>
                <div class="detalle-value detalle-vencimiento">
                  <span :class="{ 'detalle-vacio': !fechaVencimiento, 'detalle-vencido': vencido }">
                    {{ fechaVencimiento || 'Sin fecha' }}
                  </span>
                  <!-- El color no es el único aviso: la etiqueta dice lo mismo que la fila de la lista. -->
                  <span v-if="vencido" class="detalle-alerta detalle-alerta--vencido">
                    <q-icon name="error_outline" aria-hidden="true" /> Vencido
                  </span>
                  <span v-else-if="proximo" class="detalle-alerta detalle-alerta--pronto">
                    <q-icon name="schedule" aria-hidden="true" /> Vence pronto
                  </span>
                </div>
              </div>

              <div
                class="detalle-campo"
                :class="{ 'detalle-campo--actualizado': cambio('en_proceso_en') }"
              >
                <div class="detalle-label">
                  <q-icon name="play_circle_outline" size="16px" aria-hidden="true" />
                  <span>En proceso desde</span>
                </div>
                <div class="detalle-value" :class="{ 'detalle-vacio': !enProcesoDesde }">
                  {{ enProcesoDesde || 'Sin fecha' }}
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Texto libre -->
        <section class="detalle-seccion">
          <h3 class="detalle-seccion__titulo">Descripción y observaciones</h3>
          <div
            class="detalle-bloque"
            :class="{ 'detalle-campo--actualizado': cambio('descripcion') }"
          >
            <div class="detalle-label">
              <q-icon name="description" size="16px" aria-hidden="true" />
              <span>Descripción</span>
            </div>
            <div
              class="detalle-value detalle-texto"
              :class="{ 'detalle-vacio': !caso.descripcion }"
            >
              {{ caso.descripcion || 'Sin descripción' }}
            </div>
          </div>
          <div
            class="detalle-bloque"
            :class="{ 'detalle-campo--actualizado': cambio('observaciones') }"
          >
            <div class="detalle-label">
              <q-icon name="sticky_note_2" size="16px" aria-hidden="true" />
              <span>Observaciones</span>
            </div>
            <div
              class="detalle-value detalle-texto"
              :class="{ 'detalle-vacio': !caso.observaciones }"
            >
              {{ caso.observaciones || 'Sin observaciones' }}
            </div>
          </div>
        </section>
      </q-card-section>

      <q-card-actions align="right" class="detalle-caso__actions">
        <q-btn flat no-caps label="Cerrar" class="control-touch boton-presionable" @click="cerrar">
          <q-tooltip>Cierra la ficha sin guardar nada; es solo consulta.</q-tooltip>
        </q-btn>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import { useSessionStore } from '../stores/session.js'
import PriorityTag from './PriorityTag.vue'
import { camposActualizadosDelCaso } from '../utils/caseRules.js'
import { STATUS_LABELS } from '../utils/constants.js'
import { fechaParaFormulario } from '../utils/fechasCaso.js'
import { esCasoProximoAVencer, esCasoVencido, hoyLocal } from '../utils/filtrosCasos.js'
import { COLOR_ESTADO } from '../utils/filasVista.js'

/*
 * Ficha de solo lectura para consultar un caso sin editar.
 * Se abre con «Ver» desde «Mis casos». No tiene campos editables ni guarda nada.
 * Recibe el caso completo del store (incluye descripcion, observaciones, nombre_contador).
 */
const props = defineProps({
  /** Caso del store (campos en la forma del backend, ya traducidos por casoDeBackend). */
  caso: {
    type: Object,
    required: true,
  },
})

const session = useSessionStore()

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const esFinalizado = computed(() => props.caso.estado === 'finalizado')
const statusLabel = computed(() => STATUS_LABELS[props.caso.estado] ?? props.caso.estado)
const colorEstado = computed(() => COLOR_ESTADO[props.caso.estado] ?? 'var(--dg-texto-tenue)')

const fechaInicio = computed(() => fechaParaFormulario(props.caso.fecha_inicio))
const fechaVencimiento = computed(() => fechaParaFormulario(props.caso.fecha_vencimiento))
const enProcesoDesde = computed(() => fechaParaFormulario(props.caso.en_proceso_en))

// El vencimiento lo decide el backend: la ficha solo pinta el color, nunca calcula la fecha.
const vencido = computed(() => esCasoVencido(props.caso, hoyLocal()))
const proximo = computed(() => esCasoProximoAVencer(props.caso, hoyLocal()))

// En los casos del contador al que apoyas no existe «Editar»: la ayuda no debe mencionarlo.
const textoAyuda = computed(() =>
  props.caso.solo_estado === true
    ? 'Ficha de solo lectura. Este caso es del contador al que apoyas: solo puedes cambiar su estado desde la lista.'
    : 'Ficha de solo lectura: para cambiar algo usa «Editar».',
)

// El caso propio se muestra como «Tú»; los demás con el nombre del contador o «Sin asignar».
const nombreContador = computed(() => {
  if (String(props.caso.contador_id) === String(session.id)) {
    return 'Tú'
  }
  return props.caso.nombre_contador || 'Sin asignar'
})

// Nombre visible de cada campo en el aviso de cambios.
const ETIQUETAS_CAMPO = {
  cliente: 'cliente',
  prioridad: 'prioridad',
  estado: 'estado',
  importante: 'marca de importante',
  contador_id: 'contador asignado',
  fecha_inicio: 'fecha de inicio',
  fecha_vencimiento: 'fecha de vencimiento',
  en_proceso_en: 'en proceso desde',
  descripcion: 'descripción',
  observaciones: 'observaciones',
}

// Campos que cambiaron con la ficha abierta; se acumulan hasta cerrarla.
const camposActualizados = ref([])
const cambio = (campo) => camposActualizados.value.includes(campo)
const textoCamposActualizados = computed(() =>
  camposActualizados.value.map((campo) => ETIQUETAS_CAMPO[campo]).join(', '),
)

watch(
  () => props.caso,
  (nuevo, anterior) => {
    // Otro caso (o la ficha cerrada) no es una actualización: se empieza de cero.
    if (!dialogoAbierto.value || String(nuevo?.id) !== String(anterior?.id)) {
      camposActualizados.value = []
      return
    }
    const cambiados = camposActualizadosDelCaso(anterior, nuevo)
    camposActualizados.value = [...new Set([...camposActualizados.value, ...cambiados])]
  },
)

watch(dialogoAbierto, (abierto) => {
  if (!abierto) camposActualizados.value = []
})

const cerrar = () => {
  dialogoAbierto.value = false
}
</script>

<style scoped>
.detalle-caso {
  width: min(1080px, calc(100vw - 32px));
  max-height: 85vh;
  max-width: none !important;
  min-width: 0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detalle-caso__head {
  padding: 20px 24px 12px;
}

.detalle-caso__head-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.detalle-caso__icono {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--dg-fondo-seleccion);
  color: var(--dg-acento);
  flex-shrink: 0;
}

.detalle-caso__head-texto {
  min-width: 0;
}

.detalle-caso__title {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.detalle-caso__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
}

.detalle-caso__ayuda {
  margin: 4px 0 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.detalle-caso__body {
  min-width: 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 24px 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--dg-borde-fuerte) transparent;
}

.detalle-caso__body::-webkit-scrollbar {
  width: 8px;
}

.detalle-caso__body::-webkit-scrollbar-thumb {
  background: var(--dg-borde-fuerte);
  border-radius: 4px;
}

.detalle-seccion + .detalle-seccion {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--dg-borde);
}

.detalle-seccion__titulo {
  margin: 0 0 8px;
  color: var(--dg-texto-tenue);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.detalle-seccion__columnas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 24px;
  min-width: 0;
}

@media (max-width: 599px) {
  .detalle-seccion__columnas {
    grid-template-columns: 1fr;
    gap: 6px 0;
  }
}

.detalle-columna {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.detalle-campo {
  display: grid;
  /* 170 px: «Fecha de vencimiento» cabe en una línea junto a su icono. */
  grid-template-columns: 170px minmax(0, 1fr);
  gap: 4px 12px;
  align-items: baseline;
  min-width: 0;
}

@media (max-width: 599px) {
  .detalle-campo {
    grid-template-columns: minmax(110px, 130px) minmax(0, 1fr);
  }
}

.detalle-vencimiento {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

/* Mismas etiquetas que la fila de «Mis casos» (`caso-item__alerta`). */
.detalle-alerta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.detalle-alerta--vencido {
  border-color: var(--dg-error);
  background: var(--dg-error-fondo);
  color: var(--dg-error);
}

.detalle-alerta--pronto {
  border-color: var(--dg-aviso-borde);
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-texto);
}

.detalle-label {
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.4;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

@media (max-width: 599px) {
  .detalle-label {
    margin-top: 6px;
  }
}

.detalle-value {
  color: var(--dg-texto);
  font-size: 0.95rem;
  line-height: 1.5;
  min-width: 0;
}

.detalle-bloque {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
  background: var(--dg-fondo-suave);
  padding: 8px 10px;
}

.detalle-bloque + .detalle-bloque {
  margin-top: 12px;
}

.detalle-texto {
  white-space: pre-line;
  overflow-wrap: anywhere;
  max-height: 120px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--dg-borde-fuerte) transparent;
  padding-right: 4px;
}

.detalle-aviso-cambio {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 12px;
  padding: 8px 12px;
  border: 1px solid var(--dg-borde-fuerte);
  border-radius: 8px;
  background: var(--dg-fondo-seleccion);
  color: var(--dg-texto);
  font-size: 0.85rem;
  line-height: 1.45;
}

.detalle-aviso-cambio .q-icon {
  margin-top: 2px;
  color: var(--dg-acento);
}

/* El campo que cambió se resalta; el aviso de arriba lo dice también con texto. */
.detalle-campo--actualizado {
  border-radius: 6px;
  background: var(--dg-fondo-seleccion);
  box-shadow: 0 0 0 4px var(--dg-fondo-seleccion);
}

.detalle-bloque.detalle-campo--actualizado {
  border-color: var(--dg-acento);
  box-shadow: none;
}

.detalle-vacio {
  color: var(--dg-texto-tenue);
  font-style: italic;
}

.detalle-vencido {
  color: var(--dg-error);
  font-weight: 600;
}

.detalle-estado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border: 1px solid var(--dg-borde-fuerte);
  border-radius: 999px;
  background: var(--dg-fondo-suave);
  color: var(--dg-texto);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: help;
}

/* El verde de Finalizado acompaña al texto, igual que en la fila de la lista. */
.detalle-estado--finalizado {
  border-color: var(--dg-exito-borde);
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.detalle-importante {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: help;
}

.detalle-caso__actions {
  min-width: 0;
  padding: 8px 24px 16px;
}

@media (max-width: 599px) {
  .detalle-caso__head {
    padding: 16px 16px 8px;
  }
  .detalle-caso__body {
    padding: 4px 16px 12px;
  }
  .detalle-caso__actions {
    padding: 8px 16px 12px;
  }
}
</style>
