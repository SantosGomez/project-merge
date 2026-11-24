<template>
  <main class="modulos-page">
    <div class="modulos-page__intro">
      <q-img
        class="modulos-page__logo"
        src="logos/PNG/DELGROW_LOGO-OF.png"
        alt="DelGrow Business Solutions"
        fit="contain"
        no-spinner
      />
      <h1 class="modulos-page__titulo">¿Qué quieres usar?</h1>
      <p class="modulos-page__lead">
        Hola{{ session.nombreVisible ? `, ${session.nombreVisible}` : '' }}. Puedes cambiar de
        módulo cuando quieras desde el menú.
      </p>
    </div>

    <nav class="modulos-page__lista" aria-label="Módulos disponibles">
      <router-link
        v-for="modulo in modulos"
        :key="modulo.clave"
        :to="modulo.destino"
        class="modulo-tarjeta boton-presionable"
        :aria-label="`Entrar a ${modulo.nombre}`"
      >
        <q-icon :name="modulo.icono" class="modulo-tarjeta__icono" aria-hidden="true" />
        <span class="modulo-tarjeta__textos">
          <span class="modulo-tarjeta__nombre">{{ modulo.nombre }}</span>
          <span class="modulo-tarjeta__descripcion">{{ modulo.descripcion }}</span>
        </span>
        <q-icon name="arrow_forward" class="modulo-tarjeta__flecha" aria-hidden="true" />
      </router-link>
    </nav>

    <q-btn
      flat
      no-caps
      class="modulos-page__salir"
      icon="logout"
      label="Cerrar sesión"
      :loading="cerrando"
      @click="cerrarSesion"
    />
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session.js'
import { DATOS_MODULO, MODULOS, RUTA_DOCUMENTOS } from '../utils/modulos.js'
import { RUTA_PRINCIPAL_POR_ROL } from '../utils/constants.js'

/*
 * Selector de módulo de la app unida (status-conta + Recepción de documentos). Aparece al entrar
 * cuando la cuenta tiene más de un módulo; desde el menú se vuelve aquí para cambiar.
 */
const session = useSessionStore()
const router = useRouter()
const cerrando = ref(false)

const modulos = computed(() => {
  const lista = []
  if (session.tieneModulo(MODULOS.seguimiento) && RUTA_PRINCIPAL_POR_ROL[session.rol]) {
    lista.push({
      clave: MODULOS.seguimiento,
      ...DATOS_MODULO[MODULOS.seguimiento],
      destino: RUTA_PRINCIPAL_POR_ROL[session.rol],
    })
  }
  if (session.rolDocumentos) {
    lista.push({
      clave: MODULOS.documentos,
      ...DATOS_MODULO[MODULOS.documentos],
      destino: RUTA_DOCUMENTOS,
    })
  }
  return lista
})

const cerrarSesion = async () => {
  if (cerrando.value) return
  cerrando.value = true
  try {
    await session.cerrarSesionVoluntaria()
    await router.replace({ name: 'login' })
  } finally {
    cerrando.value = false
  }
}
</script>

<style scoped>
.modulos-page {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.modulos-page__intro {
  text-align: center;
}

.modulos-page__logo {
  width: 168px;
  height: 56px;
  margin: 0 auto 16px;
}

.modulos-page__titulo {
  margin: 0;
  font-size: 1.75rem;
  line-height: 1.2;
  font-weight: 700;
  color: var(--dg-texto);
}

.modulos-page__lead {
  margin: 8px 0 0;
  color: var(--dg-texto-secundario);
}

.modulos-page__lista {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modulo-tarjeta {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 88px;
  padding: 20px;
  border: 1px solid var(--dg-borde);
  border-radius: 16px;
  background: var(--dg-superficie);
  box-shadow: var(--dg-sombra-tarjeta);
  color: var(--dg-texto);
  text-decoration: none;
  transition:
    border-color 0.2s var(--dg-curva-salida),
    box-shadow 0.2s var(--dg-curva-salida);
}

.modulo-tarjeta:hover {
  border-color: var(--dg-borde-fuerte);
  background: var(--dg-fondo-hover);
}

.modulo-tarjeta:focus-visible {
  outline: 3px solid var(--dg-anillo-foco);
  outline-offset: 2px;
}

.modulo-tarjeta__icono {
  flex: none;
  font-size: 32px;
  color: var(--q-primary);
}

.modulo-tarjeta__textos {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.modulo-tarjeta__nombre {
  font-size: 1.125rem;
  font-weight: 600;
}

.modulo-tarjeta__descripcion {
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
}

.modulo-tarjeta__flecha {
  flex: none;
  color: var(--dg-texto-tenue);
}

.modulos-page__salir {
  align-self: center;
  color: var(--dg-texto-secundario);
}
</style>
