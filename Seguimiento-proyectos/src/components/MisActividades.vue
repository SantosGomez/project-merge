<template>
  <div class="mis-actividades">
    <JornadaDeHoy />

    <CronometroActivo />

    <q-btn-toggle
      :model-value="vista"
      no-caps
      unelevated
      toggle-color="primary"
      color="white"
      text-color="primary"
      class="mis-actividades__conmutador control-touch"
      aria-label="Vista de Mis actividades"
      :options="OPCIONES_DE_VISTA"
      @update:model-value="cambiarVista"
    >
      <q-tooltip>
        «Lista del mes» muestra lo que te toca hacer este mes. «Calendario» muestra qué vence cada
        día. «Clientes y tipos» es donde armas tus clientes, tus tipos de actividad y a quién le
        haces cada uno.
      </q-tooltip>
    </q-btn-toggle>

    <ListaDelMes v-if="vista === 'lista'" @ir-a-catalogos="cambiarVista('catalogos')" />

    <CalendarioActividades
      v-else-if="vista === 'calendario'"
      @ir-a-catalogos="cambiarVista('catalogos')"
    />

    <template v-else>
      <p class="mis-actividades__lead">
        Arma aquí tu propio catálogo: tus clientes y las actividades que repites cada mes. Con el
        botón «Clientes» de cada tipo eliges a quién le haces esa actividad, y con eso se arma tu
        lista del mes. Solo tú ves esta información.
      </p>

      <div class="mis-actividades__secciones">
        <MisClientes />
        <MisTiposActividad />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CalendarioActividades from './CalendarioActividades.vue'
import CronometroActivo from './CronometroActivo.vue'
import JornadaDeHoy from './JornadaDeHoy.vue'
import ListaDelMes from './ListaDelMes.vue'
import MisClientes from './MisClientes.vue'
import MisTiposActividad from './MisTiposActividad.vue'
import { useCronometroStore } from '../stores/cronometro.js'

const OPCIONES_DE_VISTA = [
  { label: 'Lista del mes', value: 'lista', icon: 'checklist' },
  { label: 'Calendario', value: 'calendario', icon: 'calendar_month' },
  { label: 'Clientes y tipos', value: 'catalogos', icon: 'groups' },
]

const route = useRoute()
const router = useRouter()
const cronometro = useCronometroStore()

// El cronómetro en marcha vive en el servidor: se lee al entrar y, en silencio, al volver a la ventana
// (lo pudiste iniciar o detener en otro dispositivo). Un fallo de lectura no borra lo que se mostraba.
const alVolverALaVentana = () => {
  if (document.visibilityState === 'visible') cronometro.cargarActivo()
}
onMounted(() => {
  cronometro.cargarActivo()
  document.addEventListener('visibilitychange', alVolverALaVentana)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', alVolverALaVentana))

// La vista va en la dirección (?vista=calendario o ?vista=catalogos), como la pestaña (?tab=); sin
// parámetro, la lista del mes. El mes (?mes=) lo comparten la lista y el calendario.
const VISTAS = ['calendario', 'catalogos']
const vista = computed(() => (VISTAS.includes(route.query.vista) ? route.query.vista : 'lista'))

const cambiarVista = (valor) => {
  const consulta = { ...route.query }
  if (VISTAS.includes(valor)) consulta.vista = valor
  else delete consulta.vista
  router.replace({ query: consulta })
}
</script>

<style scoped>
.mis-actividades__conmutador {
  margin: 0 0 16px;
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
}

.mis-actividades__lead {
  margin: 0 0 16px;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
}

.mis-actividades__secciones {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

@media (min-width: 1024px) {
  .mis-actividades__secciones {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
