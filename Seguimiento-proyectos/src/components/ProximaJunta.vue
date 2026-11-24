<template>
  <q-card
    v-if="actual"
    flat
    bordered
    role="button"
    tabindex="0"
    :aria-label="textoAccesible"
    class="proxima-junta boton-presionable"
    :class="{ 'proxima-junta--en-curso': actual.enCurso }"
    @click="emit('ver', actual.junta)"
    @keydown.enter.prevent="emit('ver', actual.junta)"
    @keydown.space.prevent="emit('ver', actual.junta)"
  >
    <q-tooltip max-width="320px">
      {{ actual.junta.titulo }} · Pulsa para ver los detalles de esta junta.
    </q-tooltip>
    <q-card-section class="proxima-junta__cuerpo">
      <q-icon
        :name="actual.enCurso ? 'groups' : 'schedule'"
        size="20px"
        class="proxima-junta__icono"
        aria-hidden="true"
      />

      <div class="proxima-junta__textos">
        <p class="proxima-junta__etiqueta">
          {{ actual.enCurso ? 'En curso' : 'Próxima junta' }}
        </p>
        <p class="proxima-junta__titulo">
          {{ actual.junta.titulo }}
        </p>
        <p class="proxima-junta__hora">
          {{
            actual.enCurso
              ? `Termina ${horaDeFechaHora(actual.junta.fin)}`
              : `${horaDeFechaHora(actual.junta.inicio)}`
          }}
        </p>
      </div>

      <div v-if="!actual.enCurso" class="proxima-junta__cuenta" aria-hidden="true">
        <span class="proxima-junta__cuenta-texto">Empieza en</span>
        <span class="proxima-junta__reloj">
          <ContadorRodante :valor="cuentaRegresiva(actual.segundos)" />
        </span>
      </div>
      <q-badge v-else class="proxima-junta__en-curso" label="En curso" />

      <q-icon name="chevron_right" size="18px" class="proxima-junta__flecha" aria-hidden="true" />
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

const textoAccesible = computed(() => {
  if (!actual.value) return ''
  const j = actual.value.junta
  const estado = actual.value.enCurso
    ? `en curso, termina ${horaDeFechaHora(j.fin)}`
    : `a las ${horaDeFechaHora(j.inicio)}, empieza en ${cuentaRegresiva(actual.value.segundos)}`
  return `Tu próxima junta: ${j.titulo}, ${estado}. Pulsa para ver los detalles.`
})

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
  margin: 0;
  border-color: var(--dg-borde);
  border-left: 4px solid var(--dg-acento);
  border-radius: 8px;
  background: var(--dg-superficie);
  cursor: pointer;
  transition:
    transform 120ms var(--dg-curva-salida),
    box-shadow 120ms var(--dg-curva-salida),
    border-color 120ms var(--dg-curva-salida);
  user-select: none;
}

.proxima-junta:hover {
  border-color: var(--dg-acento);
  box-shadow: var(--dg-sombra-campo-hover);
}

.proxima-junta:focus-visible {
  outline: 2px solid var(--dg-foco);
  outline-offset: 2px;
}

.proxima-junta--en-curso {
  border-left-color: var(--dg-exito);
  background: var(--dg-exito-fondo);
}

.proxima-junta__cuerpo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding: 4px 10px;
  min-height: 44px;
}

.proxima-junta__icono {
  color: var(--dg-acento);
  flex-shrink: 0;
}

.proxima-junta--en-curso .proxima-junta__icono {
  color: var(--dg-exito);
}

.proxima-junta__flecha {
  color: var(--dg-texto-tenue);
  flex-shrink: 0;
  transition: transform 120ms var(--dg-curva-salida);
}

.proxima-junta:hover .proxima-junta__flecha {
  color: var(--dg-acento);
  transform: translateX(2px);
}

.proxima-junta__textos {
  flex: 1 1 110px;
  min-width: 0;
}

.proxima-junta__etiqueta,
.proxima-junta__titulo,
.proxima-junta__hora {
  margin: 0;
  line-height: 1.2;
}

.proxima-junta__etiqueta {
  color: var(--dg-texto-secundario);
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.proxima-junta__titulo {
  overflow: hidden;
  color: var(--dg-texto);
  font-size: 0.85rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.proxima-junta__hora {
  color: var(--dg-texto-secundario);
  font-size: 0.72rem;
}

.proxima-junta__cuenta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.proxima-junta__cuenta-texto {
  color: var(--dg-texto-secundario);
  font-size: 0.62rem;
  line-height: 1;
}

.proxima-junta__reloj {
  color: var(--dg-texto);
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.1;
}

.proxima-junta__en-curso {
  padding: 2px 8px;
  background: var(--dg-exito);
  color: var(--dg-texto-claro);
  font-size: 0.75rem;
  flex-shrink: 0;
}

/* En escritorio la tarjeta se ajusta a su contenido para leerla de un vistazo, sin cruzar toda la pantalla. */
@media (min-width: 600px) {
  .proxima-junta {
    width: fit-content;
    min-width: 430px;
    max-width: 820px;
  }

  /* Una sola fila: si falta espacio, el título se recorta con «…» (el tooltip lo muestra completo). */
  .proxima-junta__cuerpo {
    flex-wrap: nowrap;
  }
}

@media (max-width: 599px) {
  .proxima-junta__cuenta {
    align-items: flex-start;
  }
}
</style>
