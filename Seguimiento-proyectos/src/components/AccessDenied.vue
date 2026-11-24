<template>
  <section class="access-denied" role="alert" :aria-labelledby="titleId">
    <h2 :id="titleId" class="access-denied__title">Acceso denegado</h2>

    <p class="access-denied__message">
      Esta dirección pertenece a una pantalla de otro perfil, así que no puedes verla. Vuelve a la
      pantalla principal de tu perfil para continuar.
    </p>

    <q-btn
      color="primary"
      no-caps
      icon="home"
      label="Volver a mi pantalla principal"
      class="access-denied__action control-touch boton-presionable"
      :to="homeRoute"
    >
      <q-tooltip>Vuelve a la pantalla principal de tu perfil.</q-tooltip>
    </q-btn>

    <!-- Ayuda siempre visible: se lee con puntero, con teclado y con toque (RNF-3). -->
    <section class="access-denied__help" aria-labelledby="access-denied-help-title">
      <h3 id="access-denied-help-title" class="access-denied__help-title">
        Por qué ves este aviso
      </h3>
      <q-list dense class="access-denied__help-list">
        <q-item class="access-denied__help-item">
          <q-item-section avatar class="access-denied__help-icono">
            <q-icon name="info" size="18px" color="dg-acento" aria-hidden="true" />
          </q-item-section>
          <q-item-section>
            <q-item-label v-if="sinAccesoAlModulo" class="access-denied__help-texto"
              >Tu cuenta no tiene acceso al módulo de
              <strong>Recepción de documentos</strong>.</q-item-label
            >
            <q-item-label v-else-if="enDocumentos" class="access-denied__help-texto"
              >Tu rol en Recepción de documentos es <strong>{{ profileLabel }}</strong> y esta
              pantalla no pertenece a ese perfil.</q-item-label
            >
            <q-item-label v-else class="access-denied__help-texto"
              >Tu sesión es de perfil <strong>{{ profileLabel }}</strong> y esta pantalla no
              pertenece a ese perfil.</q-item-label
            >
          </q-item-section>
        </q-item>
        <q-item class="access-denied__help-item">
          <q-item-section avatar class="access-denied__help-icono">
            <q-icon name="info" size="18px" color="dg-acento" aria-hidden="true" />
          </q-item-section>
          <q-item-section>
            <!-- prettier-ignore -->
            <q-item-label class="access-denied__help-texto">Si necesitas ver esta pantalla, pídele al administrador que revise tu perfil.</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </section>
  </section>
</template>

<script setup>
import { computed, useId } from 'vue'
import { useRoute } from 'vue-router'

import { useSessionStore } from '../stores/session.js'
import { PANTALLA_PRINCIPAL_POR_ROL } from '../utils/accessRules.js'
import { formatearRol } from '../utils/formateadores.js'
import { MODULOS, vistaInicialDocumentos } from '../utils/modulos.js'

/*
 * Aviso de acceso denegado (RF-6): se muestra en la dirección solicitada, sin cambiar de pantalla,
 * y ofrece volver a la pantalla principal del perfil conectado (P-2 para administrador, P-5 para contador).
 */
const route = useRoute()
const sesion = useSessionStore()

const enDocumentos = computed(() => route.meta?.modulo === MODULOS.documentos)
const sinAccesoAlModulo = computed(() => enDocumentos.value && !sesion.rolDocumentos)

/** Pantalla principal del perfil o módulo conectado. */
const homeRoute = computed(() => {
  if (enDocumentos.value && sesion.rolDocumentos) {
    const vistaDoc = vistaInicialDocumentos(sesion.rolDocumentos)
    if (vistaDoc) return { name: vistaDoc }
  }
  if (!sesion.tieneModulo(MODULOS.seguimiento) && sesion.rolDocumentos) {
    return { name: vistaInicialDocumentos(sesion.rolDocumentos) ?? 'modulos' }
  }
  return { name: PANTALLA_PRINCIPAL_POR_ROL[sesion.rol] ?? 'admin-dashboard' }
})

/** Perfil de la sesión actual (en documentos usa el rol del módulo). */
const profileLabel = computed(() => {
  if (enDocumentos.value) {
    return sesion.rolDocumentos ? sesion.rolDocumentos.toLowerCase() : 'sin acceso'
  }
  return formatearRol(sesion.rol).toLowerCase()
})

const titleId = useId()
</script>

<style scoped>
.access-denied {
  max-width: 560px;
  margin: 0 auto;
  padding: 8px 0;
  text-align: center;
}

.access-denied__title {
  margin: 0 0 12px;
  color: var(--dg-error-oscuro);
  font-size: clamp(1.3rem, 5vw, 1.6rem);
  line-height: 1.2;
}

.access-denied__message {
  margin: 0 0 20px;
  color: var(--dg-texto-secundario);
  font-size: 1rem;
  line-height: 1.5;
}

/* El botón de Quasar trae la clase `no-outline`; el foco se refuerza a propósito (RNF-8). */
.access-denied__action:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

.access-denied__help {
  margin-top: 24px;
  padding: 16px;
  border-radius: 8px;
  background: var(--dg-fondo-hover);
  text-align: left;
}

.access-denied__help-title {
  margin: 0 0 8px;
  color: var(--dg-texto);
  font-size: 1rem;
}

.access-denied__help-list {
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
}

/* Sin el alto mínimo ni el relleno de q-item: cada punto ocupa lo que su texto. */
.access-denied__help-item {
  min-height: 0;
  padding: 0;
}

.access-denied__help-item + .access-denied__help-item {
  margin-top: 6px;
}

.access-denied__help-icono {
  min-width: 26px;
  padding-top: 2px;
  justify-content: flex-start;
}

/* q-item-label trae line-height de 1.2em con !important; se conserva el 1.5 de la ayuda. */
.access-denied__help-texto {
  line-height: 1.5 !important;
}
</style>
