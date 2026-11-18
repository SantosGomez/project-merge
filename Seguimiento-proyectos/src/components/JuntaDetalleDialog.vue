<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="borrando"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="junta-detalle-titulo"
  >
    <q-card class="junta-detalle">
      <q-card-section class="junta-detalle__head">
        <div class="junta-detalle__head-row">
          <span class="junta-detalle__icono" aria-hidden="true">
            <q-icon name="event" size="18px" />
          </span>
          <div class="junta-detalle__head-texto">
            <h2 id="junta-detalle-titulo" class="junta-detalle__title">{{ junta.titulo }}</h2>
            <p class="junta-detalle__ayuda">{{ textoAyuda }}</p>
          </div>
        </div>
      </q-card-section>

      <q-card-section class="junta-detalle__body">
        <section class="detalle-seccion">
          <h3 class="detalle-seccion__titulo">Datos de la junta</h3>
          <div class="detalle-campo">
            <div class="detalle-label">
              <q-icon name="event" size="16px" aria-hidden="true" />
              <span>Fecha</span>
            </div>
            <div class="detalle-value">{{ fechaParaFormulario(junta.inicio) }}</div>
          </div>
          <div class="detalle-campo">
            <div class="detalle-label">
              <q-icon name="schedule" size="16px" aria-hidden="true" />
              <span>Horario</span>
            </div>
            <div class="detalle-value">{{ horarioDeJunta(junta) }}</div>
          </div>
          <div class="detalle-campo">
            <div class="detalle-label">
              <q-icon name="person" size="16px" aria-hidden="true" />
              <span>Organizador</span>
            </div>
            <div class="detalle-value">
              {{ junta.soy_organizador ? 'Tú' : junta.creado_por.nombre }}
            </div>
          </div>
        </section>

        <section class="detalle-seccion">
          <h3 class="detalle-seccion__titulo">Descripción</h3>
          <div class="detalle-campo">
            <div class="detalle-label">
              <q-icon name="description" size="16px" aria-hidden="true" />
              <span>Descripción</span>
            </div>
            <div
              class="detalle-value detalle-texto"
              :class="{ 'detalle-vacio': !junta.descripcion }"
            >
              {{ junta.descripcion || 'Sin descripción' }}
            </div>
          </div>
        </section>

        <section class="detalle-seccion">
          <h3 class="detalle-seccion__titulo">Invitados</h3>
          <q-list v-if="junta.participantes.length > 0" separator class="junta-detalle__invitados">
            <q-item
              v-for="invitado in junta.participantes"
              :key="invitado.id"
              class="junta-detalle__invitado"
            >
              <q-item-section avatar>
                <q-icon name="person" color="dg-acento" aria-hidden="true" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ invitado.nombre }}</q-item-label>
                <q-item-label caption>{{ formatearRol(invitado.rol) }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip
                  dense
                  square
                  :icon="ICONO_RESPUESTA[invitado.respuesta] ?? ICONO_RESPUESTA.pendiente"
                  :class="CLASE_RESPUESTA[invitado.respuesta] ?? CLASE_RESPUESTA.pendiente"
                >
                  {{ etiquetaRespuesta(invitado.respuesta) }}
                  <q-tooltip>{{
                    AYUDA_RESPUESTA[invitado.respuesta] ?? AYUDA_RESPUESTA.pendiente
                  }}</q-tooltip>
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
          <p v-else class="detalle-vacio">Sin invitados</p>
        </section>

        <p v-if="errorBorrado" class="error-banner" role="alert">{{ errorBorrado }}</p>
      </q-card-section>

      <q-card-actions align="right" class="junta-detalle__actions">
        <q-btn
          flat
          no-caps
          label="Cerrar"
          class="control-touch boton-presionable"
          :disable="borrando"
          @click="cerrar"
        >
          <q-tooltip>Cierra esta ficha sin cambiar nada.</q-tooltip>
        </q-btn>
        <template v-if="junta.soy_organizador">
          <q-btn
            flat
            no-caps
            icon="delete"
            label="Borrar"
            color="dg-error"
            class="control-touch boton-presionable"
            :disable="borrando"
            aria-haspopup="dialog"
            @click="confirmacionAbierta = true"
          >
            <q-tooltip>Borra la junta del calendario de todos los invitados.</q-tooltip>
          </q-btn>
          <q-btn
            unelevated
            no-caps
            icon="edit"
            label="Editar"
            color="primary"
            class="control-touch boton-presionable"
            :disable="borrando"
            aria-haspopup="dialog"
            @click="emit('editar', junta)"
          >
            <q-tooltip>Cambia el título, el horario, la descripción o los invitados.</q-tooltip>
          </q-btn>
        </template>
      </q-card-actions>

      <q-dialog
        v-model="confirmacionAbierta"
        :persistent="borrando"
        transition-show="dialogo-entra"
        transition-hide="dialogo-sale"
        :transition-duration="220"
        aria-labelledby="junta-borrar-titulo"
      >
        <q-card class="junta-borrar">
          <q-card-section>
            <h2 id="junta-borrar-titulo" class="junta-borrar__titulo">¿Borrar la junta?</h2>
            <p class="junta-borrar__texto">Se quitará del calendario de todos los invitados.</p>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              v-close-popup
              autofocus
              flat
              no-caps
              label="Cancelar"
              class="control-touch boton-presionable"
              :disable="borrando"
            >
              <q-tooltip>No borra nada y vuelve a la ficha de la junta.</q-tooltip>
            </q-btn>
            <q-btn
              color="dg-error"
              unelevated
              no-caps
              label="Borrar"
              class="control-touch boton-presionable"
              :loading="borrando"
              @click="borrarJunta"
            >
              <q-tooltip>Borra la junta de forma definitiva.</q-tooltip>
            </q-btn>
          </q-card-actions>
        </q-card>
      </q-dialog>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import { borrar } from '../services/juntaService.js'
import { fechaParaFormulario } from '../utils/fechasCaso.js'
import { formatearRol } from '../utils/formateadores.js'
import { etiquetaRespuesta, horarioDeJunta } from '../utils/juntas.js'

/*
 * Ficha de solo lectura de una junta. Para cambiar algo, el organizador usa «Editar» (emit
 * `editar`, que abre el formulario) o «Borrar» (pide confirmación y avisa con `borrada`).
 * Las respuestas de los invitados se muestran con texto, no solo con color.
 */
const props = defineProps({
  /** Junta tal como la devuelve la API. */
  junta: { type: Object, required: true },
})

const emit = defineEmits(['editar', 'borrada'])

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const ICONO_RESPUESTA = {
  pendiente: 'hourglass_empty',
  aceptada: 'check_circle',
  rechazada: 'cancel',
}
const CLASE_RESPUESTA = {
  pendiente: 'bg-dg-aviso-fondo text-dg-aviso-texto',
  aceptada: 'bg-dg-exito-fondo text-dg-exito',
  rechazada: 'bg-dg-error-fondo text-dg-error',
}
const AYUDA_RESPUESTA = {
  pendiente: 'Todavía no responde a la invitación.',
  aceptada: 'Aceptó la invitación.',
  rechazada: 'Rechazó la invitación.',
}

const confirmacionAbierta = ref(false)
const borrando = ref(false)
const errorBorrado = ref('')

const textoAyuda = computed(() =>
  props.junta.soy_organizador
    ? 'Organizas esta junta: puedes editarla o borrarla.'
    : 'Ficha de solo lectura: solo quien organiza la junta puede cambiarla.',
)

watch(dialogoAbierto, (abierto) => {
  if (abierto) {
    errorBorrado.value = ''
    confirmacionAbierta.value = false
  }
})

const cerrar = () => {
  dialogoAbierto.value = false
}

const borrarJunta = async () => {
  if (borrando.value) return
  borrando.value = true
  errorBorrado.value = ''
  try {
    await borrar(props.junta.id)
    confirmacionAbierta.value = false
    dialogoAbierto.value = false
    emit('borrada', props.junta)
  } catch (error) {
    confirmacionAbierta.value = false
    errorBorrado.value =
      error?.mensaje ??
      'Qué ocurrió: No se borró la junta. Sobre: la conexión con el servidor. Qué hacer: Revisa tu conexión y vuelve a pulsar «Borrar».'
  } finally {
    borrando.value = false
  }
}
</script>

<style scoped>
.junta-detalle {
  width: min(720px, calc(100vw - 32px));
  max-height: 85vh;
  max-width: none !important;
  min-width: 0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.junta-detalle__head {
  padding: 20px 24px 12px;
}

.junta-detalle__head-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.junta-detalle__icono {
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

.junta-detalle__head-texto {
  min-width: 0;
}

.junta-detalle__title {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.junta-detalle__ayuda {
  margin: 4px 0 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.junta-detalle__body {
  min-width: 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 24px 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--dg-borde-fuerte) transparent;
}

.junta-detalle__actions {
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 16px 16px;
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

.detalle-campo {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  gap: 4px 12px;
  align-items: baseline;
  min-width: 0;
}

.detalle-campo + .detalle-campo {
  margin-top: 10px;
}

.detalle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
  font-weight: 600;
}

.detalle-value {
  min-width: 0;
  color: var(--dg-texto);
  overflow-wrap: anywhere;
}

/* Descripción larga: scroll interno de 120 px, como en la ficha de un caso. */
.detalle-texto {
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
}

.detalle-vacio {
  color: var(--dg-texto-tenue);
  font-style: italic;
}

.junta-detalle__invitados {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
}

.junta-detalle__invitado {
  min-height: 48px;
}

/* Un nombre largo sin espacios se parte en vez de quedar debajo de la etiqueta de respuesta. */
.junta-detalle__invitado :deep(.q-item__label) {
  overflow-wrap: anywhere;
}

@media (max-width: 599px) {
  .detalle-campo {
    grid-template-columns: minmax(96px, 110px) minmax(0, 1fr);
  }
}

.junta-borrar {
  width: min(400px, calc(100vw - 32px));
}

.junta-borrar__titulo {
  margin: 0 0 8px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.3;
}

.junta-borrar__texto {
  margin: 0;
  color: var(--dg-texto-secundario);
  line-height: 1.5;
}
</style>
