<template>
  <q-dialog
    :model-value="modelValue"
    position="right"
    full-height
    aria-labelledby="chat-auditoria-titulo"
    @update:model-value="(abierto) => emit('update:modelValue', abierto)"
  >
    <q-card class="chat-auditoria column no-wrap">
      <q-card-section class="chat-auditoria__cabecera row items-center no-wrap">
        <q-icon name="forum" size="24px" color="dg-acento" aria-hidden="true" />
        <div class="chat-auditoria__titulos">
          <h2 id="chat-auditoria-titulo" class="chat-auditoria__titulo">Mensajes</h2>
          <p class="chat-auditoria__cliente" :title="cliente">{{ cliente }}</p>
        </div>
        <q-btn
          flat
          round
          icon="close"
          aria-label="Cerrar mensajes"
          class="control-touch"
          @click="emit('update:modelValue', false)"
        >
          <q-tooltip>Cierra el panel de mensajes.</q-tooltip>
        </q-btn>
      </q-card-section>

      <q-separator />

      <q-scroll-area ref="areaMensajes" class="chat-auditoria__mensajes col">
        <div class="chat-auditoria__lista" role="log" aria-live="polite" aria-label="Mensajes de la auditoría">
          <ScreenLoader v-if="cargando" text="Cargando los mensajes…" />

          <ErrorState v-else-if="errorCarga" :detail="errorCarga" @retry="cargar" />

          <div v-else-if="mensajes.length === 0" class="chat-auditoria__vacio">
            <q-icon name="chat_bubble_outline" size="32px" color="grey-7" aria-hidden="true" />
            <p>Todavía no hay mensajes. Escribe el primero para el equipo de esta auditoría.</p>
          </div>

          <template v-else>
            <q-chat-message
              v-for="mensaje in mensajes"
              :key="mensaje.id"
              :sent="esPropio(mensaje)"
              :name="mensaje.autor.nombre"
              :stamp="mensaje.fechaHora"
              :bg-color="esPropio(mensaje) ? 'dg-info-fondo' : 'dg-neutro-fondo'"
              :text-color="esPropio(mensaje) ? 'dg-info-texto' : 'primary'"
              class="chat-auditoria__mensaje"
            >
              <div class="chat-auditoria__texto">{{ mensaje.texto }}</div>
            </q-chat-message>
          </template>
        </div>
      </q-scroll-area>

      <q-separator />

      <q-card-section class="chat-auditoria__redactar">
        <q-form class="row items-end no-wrap q-gutter-x-sm" @submit.prevent="enviar">
          <q-input
            v-model="texto"
            type="textarea"
            autogrow
            outlined
            dense
            maxlength="1000"
            counter
            label="Escribe un mensaje"
            hint="Enter envía · Mayús+Enter hace un salto de línea"
            :disable="enviando || cargando || Boolean(errorCarga)"
            class="chat-auditoria__campo col input-moderno"
            @keydown.enter.exact.prevent="enviar"
          />
          <q-btn
            type="submit"
            unelevated
            no-caps
            color="primary"
            icon="send"
            label="Enviar"
            :loading="enviando"
            :disable="!puedeEnviar"
            class="control-touch"
          >
            <q-tooltip>Envía el mensaje a todos los participantes de la auditoría.</q-tooltip>
          </q-btn>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import ErrorState from './ErrorState.vue'
import ScreenLoader from './ScreenLoader.vue'
import { enviarMensaje, listarMensajes, mensajeDeBackend } from '../services/auditoriaService.js'
import { eventos } from '../services/eventosService.js'
import { useSessionStore } from '../stores/session.js'

const props = defineProps({
  /** Abre o cierra el panel (v-model). */
  modelValue: {
    type: Boolean,
    default: false,
  },
  /** ID de la auditoría cuyo chat se muestra. */
  auditoriaId: {
    type: Number,
    required: true,
  },
  /** Cliente de la auditoría, para el encabezado del panel. */
  cliente: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])

const $q = useQuasar()
const session = useSessionStore()

const mensajes = ref([])
const cargando = ref(false)
const errorCarga = ref(null)
const texto = ref('')
const enviando = ref(false)
const areaMensajes = ref(null)

const puedeEnviar = computed(
  () => !enviando.value && !cargando.value && !errorCarga.value && texto.value.trim() !== '',
)

/** El mensaje lo escribió quien tiene la sesión abierta: va a la derecha (el id guardado es texto). */
const esPropio = (mensaje) => mensaje.autor.id === Number(session.id)

/** Lleva la vista al mensaje más reciente. */
const bajarAlFinal = async () => {
  await nextTick()
  areaMensajes.value?.setScrollPercentage('vertical', 1, 150)
}

const cargar = async () => {
  cargando.value = true
  errorCarga.value = null
  try {
    mensajes.value = await listarMensajes(props.auditoriaId)
  } catch (error) {
    errorCarga.value = error.mensaje ?? 'los mensajes de la auditoría.'
  } finally {
    cargando.value = false
  }
  bajarAlFinal()
}

/**
 * Agrega un mensaje al final sin repetirlo: el propio llega dos veces, en la respuesta
 * del envío y en el aviso en vivo (en cualquier orden).
 */
const agregarMensaje = (nuevo) => {
  if (mensajes.value.some((m) => m.id === nuevo.id)) return
  mensajes.value.push(nuevo)
  bajarAlFinal()
}

const enviar = async () => {
  if (!puedeEnviar.value) return
  enviando.value = true
  try {
    agregarMensaje(await enviarMensaje(props.auditoriaId, texto.value.trim()))
    texto.value = ''
  } catch (error) {
    // El texto se conserva para que la persona pueda reintentar sin reescribirlo.
    $q.notify({ type: 'negative', message: error.mensaje ?? 'No se pudo enviar el mensaje.' })
  } finally {
    enviando.value = false
  }
}

watch(
  () => props.modelValue,
  (abierto) => {
    if (abierto) cargar()
  },
  { immediate: true },
)

/** Mensaje nuevo en vivo: solo cuenta si es de esta auditoría y el chat ya cargó. */
const alRecibirMensaje = (datos) => {
  if (datos.auditoriaId !== props.auditoriaId || cargando.value || errorCarga.value) return
  agregarMensaje(mensajeDeBackend(datos.mensaje))
}

/** Tras perder la conexión pudieron llegar mensajes: se recarga el chat si está abierto. */
const recargarSiAbierto = () => {
  if (props.modelValue) cargar()
}

const dejarDeEscuchar = [
  eventos.escuchar('mensaje-auditoria', alRecibirMensaje),
  eventos.escuchar('reconectado', recargarSiAbierto),
]
onBeforeUnmount(() => dejarDeEscuchar.forEach((dejar) => dejar()))
</script>

<style scoped>
.chat-auditoria {
  width: 420px;
  max-width: 100vw;
  height: 100%;
  border-radius: 0;
  background: var(--dg-superficie);
}

.chat-auditoria__cabecera {
  gap: 12px;
  padding: 12px 8px 12px 16px;
}

.chat-auditoria__titulos {
  flex: 1 1 auto;
  min-width: 0;
}

.chat-auditoria__titulo {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1.3;
}

.chat-auditoria__cliente {
  margin: 0;
  overflow: hidden;
  color: var(--dg-acento);
  font-size: 0.85rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-auditoria__mensajes {
  background: var(--dg-fondo-panel);
}

.chat-auditoria__lista {
  padding: 16px;
}

.chat-auditoria__vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 16px;
  text-align: center;
}

.chat-auditoria__vacio p {
  margin: 0;
}

/* Respeta los saltos de línea y corta palabras largas (folios, rutas) dentro de la burbuja. */
.chat-auditoria__texto {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chat-auditoria__redactar {
  padding: 12px 16px;
}

/* En el celular el panel ocupa todo el ancho. */
@media (max-width: 599px) {
  .chat-auditoria {
    width: 100vw;
  }
}
</style>
