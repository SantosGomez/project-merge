<template>
  <q-btn
    flat
    round
    icon="notifications"
    class="campana-avisos control-touch"
    :class="{ 'campana-avisos--clara': clara }"
    :aria-label="noLeidas > 0 ? `Avisos: ${noLeidas} sin leer` : 'Avisos'"
  >
    <q-badge
      v-if="noLeidas > 0"
      floating
      rounded
      color="dg-error"
      :label="noLeidas > 9 ? '9+' : noLeidas"
    />
    <q-tooltip
      >Avisos sobre tus casos y juntas, por ejemplo una invitación o un cambio de
      prioridad.</q-tooltip
    >

    <q-menu
      anchor="bottom right"
      self="top right"
      transition-show="jump-down"
      transition-hide="jump-up"
      :transition-duration="180"
      class="campana-avisos__menu"
      @show="alAbrir"
    >
      <div class="campana-avisos__cabecera">Avisos</div>
      <q-separator />
      <div v-if="puedeActivarNotificaciones" class="campana-avisos__activar">
        <q-btn
          flat
          no-caps
          dense
          color="primary"
          icon="notifications_active"
          label="Activar avisos en este equipo"
          class="control-touch boton-presionable"
          :loading="activando"
          @click="activarNotificaciones"
        >
          <q-tooltip
            >Recibe una notificación de Windows cuando llegue un aviso y no estés viendo la
            app.</q-tooltip
          >
        </q-btn>
        <p v-if="mensajeActivacion" class="campana-avisos__bloqueo" role="alert">
          {{ mensajeActivacion }}
        </p>
      </div>
      <q-separator v-if="puedeActivarNotificaciones" />
      <p v-if="!cargado" class="campana-avisos__vacio" role="status">
        <q-spinner size="16px" color="dg-acento" aria-hidden="true" />
        Cargando avisos…
      </p>
      <p v-else-if="error" class="campana-avisos__vacio" role="alert">{{ error }}</p>
      <p v-else-if="avisos.length === 0" class="campana-avisos__vacio">No tienes avisos.</p>
      <q-list v-else separator class="campana-avisos__lista">
        <q-item
          v-for="aviso in avisos"
          :key="aviso.id"
          :clickable="Boolean(destinoDeAviso(aviso, session.rol))"
          v-close-popup="Boolean(destinoDeAviso(aviso, session.rol))"
          :class="{ 'campana-avisos__item--nuevo': !aviso.leida }"
          @click="irAlCaso(aviso)"
        >
          <q-item-section avatar>
            <q-icon
              :name="aviso.juntaId ? 'event' : 'flag'"
              :color="aviso.leida ? 'dg-texto-tenue' : 'dg-acento'"
              aria-hidden="true"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label class="campana-avisos__mensaje">{{ aviso.mensaje }}</q-item-label>
            <q-item-label caption class="campana-avisos__fecha">
              {{ aviso.fecha }}<span v-if="!aviso.leida"> · Nuevo</span>
            </q-item-label>
            <q-item-label
              v-if="destinoDeAviso(aviso, session.rol)"
              caption
              class="campana-avisos__enlace"
            >
              {{ aviso.juntaId ? 'Toca para ver la junta' : 'Toca para ver el caso' }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'

import { eventos } from '../services/eventosService.js'
import { getNotificaciones, marcarLeidas } from '../services/notificacionService.js'
import { useSessionStore } from '../stores/session.js'
import { destinoDeAviso } from '../utils/avisos.js'
import { crearNotificadorNavegador, mensajeDeActivacion } from '../utils/notificacionesNavegador.js'

/*
 * Campanita del contador: muestra cuántos avisos no ha leído (p. ej. el administrador cambió
 * la prioridad de un caso) y la lista al tocarla. Al abrirla, los avisos se marcan como leídos.
 * Al tocar un aviso de un caso, el contador va a «Mis casos» con ese caso a la vista y resaltado.
 * Se actualiza al instante cuando el servidor avisa (tiempo real), al cambiar de pantalla
 * y, como respaldo, cada 5 minutos.
 */
defineProps({
  /** Icono blanco para el encabezado oscuro del celular. */
  clara: { type: Boolean, default: false },
})

const session = useSessionStore()
const router = useRouter()
const route = useRoute()

const $q = useQuasar()

const avisos = ref([])
const noLeidas = ref(0)
const error = ref('')
// Hasta la primera respuesta no se sabe si hay avisos: se dice que está cargando.
const cargado = ref(false)

/** Lleva al caso o junta del aviso; los avisos sin destino no navegan. */
const irAlCaso = (aviso) => {
  const destino = destinoDeAviso(aviso, session.rol)
  if (destino) router.push(destino)
}

// Notificaciones del sistema (por equipo): al tocar una, se abre el mismo destino que en la campana.
const notificador = crearNotificadorNavegador({ alHacerClic: irAlCaso })
const notificacionesActivas = ref(notificador.activas())
// Qué pasó al pedir el permiso (bloqueado, ventana cerrada o el navegador no contestó); vacío si salió bien.
const mensajeActivacion = ref('')
const activando = ref(false)
const puedeActivarNotificaciones = computed(
  () => notificador.soportado && !notificacionesActivas.value,
)

const activarNotificaciones = async () => {
  activando.value = true
  mensajeActivacion.value = ''
  try {
    const resultado = await notificador.activar()
    notificacionesActivas.value = notificador.activas()
    mensajeActivacion.value = mensajeDeActivacion(resultado)
    if (resultado === 'granted') {
      $q.notify({ type: 'positive', message: 'Listo: te avisaremos aunque no estés viendo la app' })
    }
  } finally {
    activando.value = false
  }
}

/** Recarga la campana; `notificar` solo es true cuando el servidor avisa de un aviso nuevo. */
const cargar = async (notificar = false) => {
  try {
    const resultado = await getNotificaciones()
    avisos.value = resultado.avisos
    noLeidas.value = resultado.noLeidas
    error.value = ''
    if (notificar === true) notificador.notificarNuevos(resultado.avisos)
    else notificador.registrarVistos(resultado.avisos)
  } catch (fallo) {
    error.value = fallo?.mensaje ?? 'No se pudieron cargar los avisos.'
  } finally {
    cargado.value = true
  }
}

const cargarYNotificar = () => cargar(true)

/** Al abrir la lista se ven los avisos nuevos y se marcan como leídos en el servidor. */
const alAbrir = async () => {
  // La preferencia pudo cambiarse en «Mi perfil» desde la última vez.
  notificacionesActivas.value = notificador.activas()
  await cargar()
  if (noLeidas.value === 0) return
  try {
    await marcarLeidas()
    noLeidas.value = 0
  } catch {
    // Si falla, siguen como no leídos y se reintentará la próxima vez que se abra.
  }
}

let intervalo = null
const dejarDeEscuchar = [
  eventos.escuchar('aviso-nuevo', cargarYNotificar),
  // Si la conexión se cayó, pudo perderse algún aviso
  eventos.escuchar('reconectado', cargar),
]

onMounted(() => {
  cargar()
  intervalo = setInterval(cargar, 5 * 60 * 1000)
})
onBeforeUnmount(() => {
  clearInterval(intervalo)
  dejarDeEscuchar.forEach((dejar) => dejar())
})

// Se observa la ruta sin la consulta: ajustar la vista o la fecha de una pantalla no vuelve a pedir los avisos.
watch(() => route.path, cargar)
</script>

<style scoped>
.campana-avisos {
  color: var(--dg-texto-secundario);
}

/* El número cae dentro del botón: en el encabezado del celular, más arriba lo recorta el borde. */
.campana-avisos :deep(.q-badge--floating) {
  top: 2px;
  right: 2px;
}

.campana-avisos--clara {
  color: inherit;
}

.campana-avisos__cabecera {
  padding: 10px 16px;
  color: var(--dg-texto);
  font-weight: 600;
}

.campana-avisos__activar {
  padding: 8px 12px;
}

.campana-avisos__bloqueo {
  margin: 8px 0 0;
  max-width: min(360px, 90vw);
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
  line-height: 1.4;
}

.campana-avisos__vacio {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 16px;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
}

.campana-avisos__lista {
  width: min(360px, 90vw);
}

.campana-avisos__item--nuevo {
  background: var(--dg-fondo-hover);
}

.campana-avisos__enlace {
  color: var(--dg-acento);
  font-weight: 500;
}

.campana-avisos__fecha {
  color: var(--dg-texto-tenue);
}

.campana-avisos__mensaje {
  color: var(--dg-texto);
  line-height: 1.4;
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
