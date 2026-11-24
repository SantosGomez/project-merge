<template>
  <q-card
    v-if="actual"
    flat
    bordered
    class="proxima-junta"
    :class="{ 'proxima-junta--en-curso': actual.enCurso }"
  >
    <q-card-section class="proxima-junta__cuerpo">
      <q-icon
        :name="actual.enCurso ? 'groups' : 'schedule'"
        size="28px"
        class="proxima-junta__icono"
        aria-hidden="true"
      />

      <div class="proxima-junta__textos">
        <p class="proxima-junta__etiqueta">
          {{ actual.enCurso ? 'Tu junta en curso' : 'Tu próxima junta' }}
        </p>
        <p class="proxima-junta__titulo">
          {{ actual.junta.titulo }}
          <q-tooltip max-width="320px">{{ actual.junta.titulo }}</q-tooltip>
        </p>
        <p class="proxima-junta__hora">
          {{
            actual.enCurso
              ? `Termina a las ${horaDeFechaHora(actual.junta.fin)}`
              : `Empieza a las ${horaDeFechaHora(actual.junta.inicio)}`
          }}
        </p>
      </div>

      <div v-if="!actual.enCurso" class="proxima-junta__cuenta">
        <span class="proxima-junta__cuenta-texto">Empieza en</span>
        <span class="proxima-junta__reloj" role="timer" aria-label="Tiempo para que empiece">
          <ContadorRodante :valor="cuentaRegresiva(actual.segundos)" />
        </span>
      </div>
      <q-badge v-else class="proxima-junta__en-curso" label="En curso" />

      <q-btn
        flat
        no-caps
        color="primary"
        icon="visibility"
        label="Ver"
        class="control-touch boton-presionable"
        aria-haspopup="dialog"
        @click="emit('ver', actual.junta)"
      >
        <q-tooltip>Abre la ficha de esta junta.</q-tooltip>
      </q-btn>
    </q-card-section>
  </q-card>
</template>

<script setup>
/*
 * «Tu próxima junta» (rebanada 42): arriba de «Mi Calendario», la junta propia en curso o la que
 * empieza dentro de las próximas 24 h, con la cuenta regresiva. Pide sus juntas aparte (de hoy a
 * mañana) porque el calendario solo carga el periodo visible. Se relee al montar, al volver a la
 * ventana, cada 5 minutos y cuando la página lo pide (`recargar`); un fallo conserva lo que se veía.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import ContadorRodante from './ContadorRodante.vue'
import { listar } from '../services/juntaService.js'
import { useSessionStore } from '../stores/session.js'
import { formatearFechaISO, horaDeFechaHora } from '../utils/juntas.js'
import { cuentaRegresiva, proximaJunta } from '../utils/proximaJunta.js'

const emit = defineEmits(['ver'])

const session = useSessionStore()
const juntas = ref([])
const ahora = ref(new Date())

const actual = computed(() => proximaJunta(juntas.value, ahora.value, session.id))

let peticion = 0
const recargar = async () => {
  const esta = ++peticion
  const hoy = new Date()
  const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1)
  try {
    const lista = await listar({ desde: formatearFechaISO(hoy), hasta: formatearFechaISO(manana) })
    if (esta === peticion) juntas.value = lista
  } catch {
    // Se conserva lo que se veía; la siguiente recarga lo intenta otra vez.
  }
}

const RECARGA_MS = 5 * 60 * 1000
let reloj = 0
let recarga = 0
const alVolver = () => {
  if (document.visibilityState !== 'visible') return
  ahora.value = new Date()
  recargar()
}

onMounted(() => {
  recargar()
  reloj = setInterval(() => (ahora.value = new Date()), 1000)
  recarga = setInterval(recargar, RECARGA_MS)
  document.addEventListener('visibilitychange', alVolver)
})
onBeforeUnmount(() => {
  clearInterval(reloj)
  clearInterval(recarga)
  document.removeEventListener('visibilitychange', alVolver)
})

defineExpose({ recargar })
</script>

<style scoped>
.proxima-junta {
  margin-bottom: 12px;
  border-color: var(--dg-borde);
  border-left: 4px solid var(--dg-acento);
  border-radius: 12px;
  background: var(--dg-superficie);
}

.proxima-junta--en-curso {
  border-left-color: var(--dg-exito);
  background: var(--dg-exito-fondo);
}

.proxima-junta__cuerpo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 12px 16px;
}

.proxima-junta__icono {
  color: var(--dg-acento);
}

.proxima-junta--en-curso .proxima-junta__icono {
  color: var(--dg-exito);
}

.proxima-junta__textos {
  flex: 1 1 200px;
  min-width: 0;
}

.proxima-junta__etiqueta,
.proxima-junta__titulo,
.proxima-junta__hora {
  margin: 0;
  line-height: 1.35;
}

.proxima-junta__etiqueta {
  color: var(--dg-texto-secundario);
  font-size: 0.8rem;
  font-weight: 600;
}

.proxima-junta__titulo {
  overflow: hidden;
  color: var(--dg-texto);
  font-size: 1rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proxima-junta__hora {
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
}

.proxima-junta__cuenta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.proxima-junta__cuenta-texto {
  color: var(--dg-texto-secundario);
  font-size: 0.75rem;
}

.proxima-junta__reloj {
  color: var(--dg-texto);
  font-size: 1.5rem;
  font-weight: 700;
}

.proxima-junta__en-curso {
  padding: 4px 10px;
  background: var(--dg-exito);
  color: var(--dg-texto-claro);
  font-size: 0.8rem;
}

/* En escritorio la tarjeta se ajusta a su contenido para leerla de un vistazo, sin cruzar toda la pantalla. */
@media (min-width: 600px) {
  .proxima-junta {
    width: fit-content;
    min-width: 360px;
    max-width: 520px;
  }
}

@media (max-width: 599px) {
  .proxima-junta__cuenta {
    align-items: flex-start;
  }
}
</style>
