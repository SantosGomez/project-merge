<template>
  <nav
    ref="panel"
    class="menu-dock"
    aria-label="Navegación principal"
    @pointermove="alMoverPuntero"
    @pointerleave="alSalirPuntero"
  >
    <img class="menu-dock__logo" src="logos/PNG/DELGROW_ISOTIPO-OF_T.png" alt="" width="40" height="40" />

    <div class="menu-dock__grupo">
      <router-link
        v-for="(opcion, indice) in opciones"
        :key="opcion.clave"
        #default="{ href, navigate }"
        :to="opcion.to"
        custom
      >
        <a
          :ref="(el) => (azulejos[indice] = el)"
          :href="href"
          class="menu-dock__azulejo"
          :class="{
            'menu-dock__azulejo--activo': opcion.activa,
            'menu-dock__azulejo--saltando': saltando === opcion.clave,
          }"
          :style="{ '--escala': (tamanos[indice] ?? TAM_BASE) / TAM_BASE }"
          :aria-label="opcion.ariaLabel"
          :aria-current="opcion.activa ? 'page' : undefined"
          @click="(evento) => alPulsar(evento, navigate, opcion.clave)"
        >
          <q-icon :name="opcion.icono" class="menu-dock__icono" />
          <q-tooltip anchor="center right" self="center left" :offset="[14, 0]">
            <strong>{{ opcion.nombre }}</strong>
            <br />
            {{ opcion.descripcion }}
          </q-tooltip>
        </a>
      </router-link>
    </div>

    <span class="menu-dock__separador" aria-hidden="true" />

    <div class="menu-dock__grupo">
      <router-link
        v-if="perfilTo"
        #default="{ href, navigate }"
        :to="perfilTo"
        custom
      >
        <a
          :href="href"
          class="menu-dock__azulejo menu-dock__azulejo--avatar"
          :class="{ 'menu-dock__azulejo--activo': perfilActivo }"
          aria-label="Ir a mi perfil"
          :aria-current="perfilActivo ? 'page' : undefined"
          @click="navigate"
        >
          <span aria-hidden="true">{{ iniciales }}</span>
          <q-tooltip anchor="center right" self="center left" :offset="[14, 0]">
            <strong>{{ nombreUsuario }}</strong>
            <br />
            {{ rol }} · Mi perfil
          </q-tooltip>
        </a>
      </router-link>
      <div v-else class="menu-dock__azulejo menu-dock__azulejo--avatar" tabindex="0">
        <span aria-hidden="true">{{ iniciales }}</span>
        <span class="sr-only">{{ nombreUsuario }}, {{ rol }}</span>
        <q-tooltip anchor="center right" self="center left" :offset="[14, 0]">
          <strong>{{ nombreUsuario }}</strong>
          <br />
          {{ rol }}
        </q-tooltip>
      </div>

      <button
        type="button"
        class="menu-dock__azulejo"
        aria-label="Cerrar sesión"
        :disabled="cerrandoSesion"
        @click="emit('cerrar-sesion')"
      >
        <q-icon name="logout" class="menu-dock__icono" />
        <q-tooltip anchor="center right" self="center left" :offset="[14, 0]">Cerrar sesión</q-tooltip>
      </button>
    </div>
  </nav>
</template>

<script setup>
/*
 * Menú lateral tipo dock (prueba en «experimento», idea del Dock de Vue Bits): barra vertical
 * flotante con solo iconos. Los iconos crecen según la cercanía del puntero, el nombre sale en
 * un globo y un punto marca la página activa. Sin animaciones con «reducir movimiento».
 */
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  /** Opciones `{ clave, nombre, descripcion, icono, to, activa, ariaLabel }` del rol. */
  opciones: { type: Array, default: () => [] },
  iniciales: { type: String, default: '' },
  nombreUsuario: { type: String, default: '' },
  rol: { type: String, default: '' },
  /** Ruta de «Mi perfil», o null si el rol no la tiene. */
  perfilTo: { type: Object, default: null },
  perfilActivo: { type: Boolean, default: false },
  cerrandoSesion: { type: Boolean, default: false },
})
const emit = defineEmits(['cerrar-sesion'])

const TAM_BASE = 48
const TAM_MAXIMO = 64
const DISTANCIA = 140

const panel = ref(null)
const azulejos = ref([])
const tamanos = ref([])
const saltando = ref(null)

const sinMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// Cada icono crece según su distancia vertical al puntero (curva suave, 0 más allá de DISTANCIA).
const alMoverPuntero = (evento) => {
  if (evento.pointerType !== 'mouse' || sinMovimiento()) return
  tamanos.value = props.opciones.map((_, i) => {
    const el = azulejos.value[i]
    if (!el) return TAM_BASE
    const caja = el.getBoundingClientRect()
    const distancia = Math.abs(evento.clientY - (caja.top + caja.height / 2))
    const cercania = Math.max(0, 1 - (distancia / DISTANCIA) ** 2)
    return TAM_BASE + (TAM_MAXIMO - TAM_BASE) * cercania
  })
}

const alSalirPuntero = () => {
  tamanos.value = []
}

// Salto corto al pulsar, como al abrir una app en macOS; luego navega.
let temporizadorSalto = 0
const alPulsar = (evento, navigate, clave) => {
  if (!sinMovimiento()) {
    saltando.value = clave
    clearTimeout(temporizadorSalto)
    temporizadorSalto = setTimeout(() => (saltando.value = null), 450)
  }
  navigate(evento)
}

watch(
  () => props.opciones.length,
  () => {
    tamanos.value = []
  },
)

onBeforeUnmount(() => clearTimeout(temporizadorSalto))
</script>

<style scoped>
.menu-dock {
  position: fixed;
  top: 50%;
  left: 16px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  width: 72px;
  padding: 14px 12px;
  border-radius: 24px;
  background: var(--q-primary);
  box-shadow: var(--dg-sombra-tarjeta);
  transform: translateY(-50%);
}

.menu-dock__logo {
  align-self: center;
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.menu-dock__grupo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

.menu-dock__separador {
  align-self: center;
  width: 32px;
  height: 1px;
  background: var(--dg-texto-claro-tenue);
  opacity: 0.4;
}

/*
 * Azulejo del icono: crece con --escala desde el borde izquierdo, hacia la derecha (lejos del
 * borde de la pantalla). Con transform la barra no cambia de tamaño ni se mueve.
 */
.menu-dock__azulejo {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  border-radius: 14px;
  background: var(--dg-fondo-menu-activo);
  color: var(--q-secondary);
  text-decoration: none;
  cursor: pointer;
  transform: scale(var(--escala, 1));
  transform-origin: left center;
  transition:
    transform 160ms var(--dg-curva-salida),
    background 160ms var(--dg-curva-salida);
}

.menu-dock__azulejo:disabled {
  cursor: default;
  opacity: 0.6;
}

.menu-dock__icono {
  font-size: 24px;
}

@media (hover: hover) and (pointer: fine) {
  .menu-dock__azulejo:hover {
    background: var(--q-secondary);
    color: var(--q-primary);
  }
}

.menu-dock__azulejo:focus-visible {
  outline: 2px solid var(--q-secondary);
  outline-offset: 3px;
}

/* Activa: contorno celeste y un punto pegado al borde del dock. */
.menu-dock__azulejo--activo {
  box-shadow: inset 0 0 0 1px var(--q-secondary);
}

.menu-dock__azulejo--activo::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -9px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--q-secondary);
  transform: translateY(-50%);
}

.menu-dock__azulejo--avatar {
  border-radius: 50%;
  background: var(--q-secondary);
  color: var(--q-primary);
  font-size: 15px;
  font-weight: 700;
}

.menu-dock__azulejo--saltando {
  animation: menu-dock-salto 450ms var(--dg-curva-salida);
}

/* El salto se suma a la escala del momento para no encoger el icono a media animación. */
@keyframes menu-dock-salto {
  30% {
    transform: translateX(10px) scale(var(--escala, 1));
  }
  60% {
    transform: translateX(-2px) scale(var(--escala, 1));
  }
  100% {
    transform: translateX(0) scale(var(--escala, 1));
  }
}

@media (prefers-reduced-motion: reduce) {
  .menu-dock__azulejo {
    transition: none;
  }

  .menu-dock__azulejo--saltando {
    animation: none;
  }
}
</style>
