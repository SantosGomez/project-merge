<template>
  <q-btn
    flat
    round
    icon="notifications"
    class="campana-avisos control-touch"
    :class="{ 'campana-avisos--clara': clara }"
    :aria-label="noLeidas > 0 ? `Avisos: ${noLeidas} sin leer` : 'Avisos'"
  >
    <q-badge v-if="noLeidas > 0" floating rounded color="dg-error" :label="noLeidas > 9 ? '9+' : noLeidas" />
    <q-tooltip>Avisos sobre tus casos, por ejemplo cuando el administrador cambia una prioridad.</q-tooltip>

    <q-menu anchor="bottom right" self="top right" class="campana-avisos__menu" @show="alAbrir">
      <div class="campana-avisos__cabecera">Avisos</div>
      <q-separator />
      <p v-if="error" class="campana-avisos__vacio" role="alert">{{ error }}</p>
      <p v-else-if="avisos.length === 0" class="campana-avisos__vacio">No tienes avisos.</p>
      <q-list v-else separator class="campana-avisos__lista">
        <q-item v-for="aviso in avisos" :key="aviso.id" :class="{ 'campana-avisos__item--nuevo': !aviso.leida }">
          <q-item-section avatar>
            <q-icon name="flag" :color="aviso.leida ? 'grey-6' : 'dg-acento'" aria-hidden="true" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="campana-avisos__mensaje">{{ aviso.mensaje }}</q-item-label>
            <q-item-label caption class="campana-avisos__fecha">
              {{ aviso.fecha }}<span v-if="!aviso.leida"> · Nuevo</span>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { eventos } from '../services/eventosService.js'
import { getNotificaciones, marcarLeidas } from '../services/notificacionService.js'

/*
 * Campanita del contador: muestra cuántos avisos no ha leído (p. ej. el administrador cambió
 * la prioridad de un caso) y la lista al tocarla. Al abrirla, los avisos se marcan como leídos.
 * Se actualiza al instante cuando el servidor avisa (tiempo real), al cambiar de pantalla
 * y, como respaldo, cada 5 minutos.
 */
defineProps({
  /** Icono blanco para el encabezado oscuro del celular. */
  clara: { type: Boolean, default: false },
})

const route = useRoute()
const avisos = ref([])
const noLeidas = ref(0)
const error = ref('')

const cargar = async () => {
  try {
    const resultado = await getNotificaciones()
    avisos.value = resultado.avisos
    noLeidas.value = resultado.noLeidas
    error.value = ''
  } catch (fallo) {
    error.value = fallo?.mensaje ?? 'No se pudieron cargar los avisos.'
  }
}

/** Al abrir la lista se ven los avisos nuevos y se marcan como leídos en el servidor. */
const alAbrir = async () => {
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
  eventos.escuchar('aviso-nuevo', cargar),
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

watch(() => route.fullPath, cargar)
</script>

<style scoped>
.campana-avisos {
  color: var(--dg-texto-secundario);
}

.campana-avisos--clara {
  color: inherit;
}

.campana-avisos__cabecera {
  padding: 10px 16px;
  color: var(--dg-texto);
  font-weight: 600;
}

.campana-avisos__vacio {
  margin: 0;
  padding: 16px;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
}

.campana-avisos__lista {
  width: min(360px, 90vw);
  max-height: 60vh;
  overflow-y: auto;
}

.campana-avisos__item--nuevo {
  background: var(--dg-fondo-hover);
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
