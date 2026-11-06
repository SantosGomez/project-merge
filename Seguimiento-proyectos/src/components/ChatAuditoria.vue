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
              :class="{ 'chat-auditoria__mensaje--entrando': recientes.has(mensaje.id) }"
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
            :disable="cargando || Boolean(errorCarga)"
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
            class="chat-auditoria__enviar control-touch"
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
import { auditoriaConChatAbierto } from '../utils/avisosChat.js'
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
// Mensajes de otros que acaban de llegar en vivo: solo esos entran con animación.
const recientes = ref(new Set())

const puedeEnviar = computed(
  () => !enviando.value && !cargando.value && !errorCarga.value && texto.value.trim() !== '',
)

/** El mensaje lo escribió quien tiene la sesión abierta: va a la derecha (el id guardado es texto). */
const esPropio = (mensaje) => mensaje.autor.id === Number(session.id)

/**
 * Lleva la vista al mensaje más reciente. Al abrir el chat salta sin animar
 * (nadie pidió ese movimiento); con un mensaje nuevo se desliza.
 */
const bajarAlFinal = async (animar = true) => {
  await nextTick()
  areaMensajes.value?.setScrollPercentage('vertical', 1, animar ? 150 : 0)
}

/**
 * Carga el chat. En silencio (al reconectar) no muestra el aviso de carga ni borra
 * la lista: si falla, se quedan los mensajes que ya se veían.
 */
const cargar = async ({ silencioso = false } = {}) => {
  if (!silencioso) {
    cargando.value = true
    errorCarga.value = null
  }
  try {
    mensajes.value = await listarMensajes(props.auditoriaId)
    errorCarga.value = null
  } catch (error) {
    if (!silencioso) errorCarga.value = error.mensaje ?? 'los mensajes de la auditoría.'
  } finally {
    cargando.value = false
  }
  bajarAlFinal(false)
}

/**
 * Agrega un mensaje al final sin repetirlo: el propio llega dos veces, en la respuesta
 * del envío y en el aviso en vivo (en cualquier orden).
 */
const agregarMensaje = (nuevo) => {
  if (mensajes.value.some((m) => m.id === nuevo.id)) return
  if (!esPropio(nuevo)) recientes.value.add(nuevo.id)
  mensajes.value.push(nuevo)
  bajarAlFinal()
}

const enviar = async () => {
  if (!puedeEnviar.value) return
  // El campo se vacía al instante para seguir escribiendo mientras se envía.
  const enviado = texto.value.trim()
  texto.value = ''
  enviando.value = true
  try {
    agregarMensaje(await enviarMensaje(props.auditoriaId, enviado))
  } catch (error) {
    // Se devuelve el texto (si no se escribió otro) para reintentar sin reescribirlo.
    if (texto.value === '') texto.value = enviado
    $q.notify({ type: 'negative', message: error.mensaje ?? 'No se pudo enviar el mensaje.' })
  } finally {
    enviando.value = false
  }
}

watch(
  () => props.modelValue,
  (abierto) => {
    // Con el panel abierto no tiene caso el aviso emergente de esta misma auditoría.
    auditoriaConChatAbierto.value = abierto ? props.auditoriaId : null
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
  if (props.modelValue) cargar({ silencioso: true })
}

const dejarDeEscuchar = [
  eventos.escuchar('mensaje-auditoria', alRecibirMensaje),
  eventos.escuchar('reconectado', recargarSiAbierto),
]
onBeforeUnmount(() => {
  dejarDeEscuchar.forEach((dejar) => dejar())
  if (auditoriaConChatAbierto.value === props.auditoriaId) auditoriaConChatAbierto.value = null
})
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

/* Un mensaje que llega en vivo sube un poco mientras aparece; ease-out fuerte, sin rebote. */
.chat-auditoria__mensaje--entrando {
  animation: chat-entrar 200ms cubic-bezier(0.23, 1, 0.32, 1) both;
}

@keyframes chat-entrar {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

/* El botón confirma la pulsación con una leve reducción. */
.chat-auditoria__enviar {
  transition: transform 160ms ease-out;
}

.chat-auditoria__enviar:active {
  transform: scale(0.97);
}

/* Con movimiento reducido no hay desplazamiento: solo el desvanecido ayuda a notarlo. */
@media (prefers-reduced-motion: reduce) {
  .chat-auditoria__mensaje--entrando {
    animation-name: chat-aparecer;
  }

  .chat-auditoria__enviar:active {
    transform: none;
  }
}

@keyframes chat-aparecer {
  from {
    opacity: 0;
  }
}

/* En el celular el panel ocupa todo el ancho. */
@media (max-width: 599px) {
  .chat-auditoria {
    width: 100vw;
  }
}
</style>
