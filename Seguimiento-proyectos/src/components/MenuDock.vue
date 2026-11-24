<template>
  <nav
    ref="panel"
    class="menu-dock"
    aria-label="Navegación principal"
    @pointermove="alMoverPuntero"
    @pointerleave="alSalirPuntero"
  >
    <router-link v-if="logoTo" #default="{ href, navigate }" :to="logoTo" custom>
      <a
        :href="href"
        class="menu-dock__azulejo menu-dock__azulejo--logo"
        aria-label="Inicio · Cambiar de módulo"
        @click="navigate"
      >
        <img
          class="menu-dock__logo"
          src="logos/PNG/DELGROW_ISOTIPO-OF_T.png"
          alt=""
          width="30"
          height="30"
        />
        <q-tooltip anchor="center right" self="center left" :offset="[14, 0]">
          <strong>Inicio</strong>
          <br />
          Cambiar de módulo
        </q-tooltip>
      </a>
    </router-link>
    <span v-else class="menu-dock__azulejo menu-dock__azulejo--logo" aria-hidden="true">
      <img
        class="menu-dock__logo"
        src="logos/PNG/DELGROW_ISOTIPO-OF_T.png"
        alt=""
        width="30"
        height="30"
      />
    </span>

    <span class="menu-dock__separador" aria-hidden="true" />

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
      <router-link v-if="perfilTo" #default="{ href, navigate }" :to="perfilTo" custom>
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
        <q-tooltip anchor="center right" self="center left" :offset="[14, 0]"
          >Cerrar sesión</q-tooltip
        >
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
  /** Ruta de «Inicio» al pulsar el logo, o null si no hay selector de módulos. */
  logoTo: { type: Object, default: null },
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
  align-items: center;
  gap: 10px;
  width: 74px;
  padding: 12px;
  border: 1px solid var(--dg-dock-borde);
  border-radius: 22px;
  background: var(--q-primary);
  box-shadow: var(--dg-sombra-tarjeta);
  transform: translateY(-50%);
}

/* El logo vive en un azulejo como los demás, pero no es un control. */
.menu-dock__azulejo--logo {
  cursor: default;
}

.menu-dock__logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.menu-dock__grupo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.menu-dock__separador {
  width: 100%;
  height: 1px;
  background: var(--dg-borde-menu);
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
  background: linear-gradient(180deg, var(--dg-dock-azulejo), var(--q-primary));
  box-shadow: inset 0 0 0 1px var(--dg-borde-menu);
  color: var(--dg-texto-claro);
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
  /* Al pasar el puntero solo se marca el contorno: el relleno celeste es de la activa. */
  .menu-dock__azulejo:not(.menu-dock__azulejo--logo):hover {
    box-shadow: inset 0 0 0 1px var(--q-secondary);
  }
}

.menu-dock__azulejo:focus-visible {
  outline: 2px solid var(--q-secondary);
  outline-offset: 3px;
}

/* Activa: azulejo celeste con el icono oscuro y un punto sobre el borde del dock. */
.menu-dock__azulejo--activo {
  background: var(--q-secondary);
  color: var(--q-primary);
}

.menu-dock__azulejo--activo::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -16px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--q-secondary);
  transform: translateY(-50%);
}

/* Mismo azulejo que las opciones, con las iniciales; se rellena de celeste en «Mi perfil». */
.menu-dock__azulejo--avatar {
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
