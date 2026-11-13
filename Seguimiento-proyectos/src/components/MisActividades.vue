<template>
  <div class="mis-actividades">
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
        «Lista del mes» muestra lo que te toca hacer este mes. «Clientes y tipos» es donde armas tus
        clientes, tus tipos de actividad y a quién le haces cada uno.
      </q-tooltip>
    </q-btn-toggle>

    <ListaDelMes v-if="vista === 'lista'" @ir-a-catalogos="cambiarVista('catalogos')" />

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
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ListaDelMes from './ListaDelMes.vue'
import MisClientes from './MisClientes.vue'
import MisTiposActividad from './MisTiposActividad.vue'

const OPCIONES_DE_VISTA = [
  { label: 'Lista del mes', value: 'lista', icon: 'checklist' },
  { label: 'Clientes y tipos', value: 'catalogos', icon: 'groups' },
]

const route = useRoute()
const router = useRouter()

// La vista va en la dirección (?vista=catalogos), como la pestaña (?tab=); sin parámetro, la lista del mes.
const vista = computed(() => (route.query.vista === 'catalogos' ? 'catalogos' : 'lista'))

const cambiarVista = (valor) => {
  const consulta = { ...route.query }
  if (valor === 'catalogos') consulta.vista = 'catalogos'
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
