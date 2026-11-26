<template>
  <q-page class="ajustes-page">
    <q-tabs
      v-model="pestana"
      no-caps
      inline-label
      align="left"
      active-color="primary"
      indicator-color="primary"
      class="ajustes-page__pestanas"
    >
      <q-tab v-if="veClientes" name="clientes" icon="business" label="Clientes">
        <q-tooltip>Consulta, da de alta y administra los clientes del despacho.</q-tooltip>
      </q-tab>
      <q-tab name="usuarios" icon="group" label="Usuarios">
        <q-tooltip>Consulta las cuentas del equipo.</q-tooltip>
      </q-tab>
      <q-tab v-if="veAccesos" name="accesos" icon="admin_panel_settings" label="Acceso a módulos">
        <q-tooltip>Elige quién entra a Recepción de documentos y con qué rol.</q-tooltip>
      </q-tab>
    </q-tabs>

    <!-- Sin animación: las pestañas se usan a menudo y el cambio debe ser inmediato. -->
    <q-tab-panels v-model="pestana" keep-alive class="ajustes-page__paneles">
      <q-tab-panel v-if="veClientes" name="clientes" class="ajustes-page__panel">
        <AjustesClientes />
      </q-tab-panel>
      <q-tab-panel name="usuarios" class="ajustes-page__panel">
        <CountersDirectoryPage />
      </q-tab-panel>
      <q-tab-panel v-if="veAccesos" name="accesos" class="ajustes-page__panel">
        <AccesoDocumentosPage />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AjustesClientes from '../components/AjustesClientes.vue'
import AccesoDocumentosPage from '../modulos/documentos/pages/AccesoDocumentosPage.vue'
import CountersDirectoryPage from './CountersDirectoryPage.vue'
import { useSessionStore } from '../stores/session.js'
import { hayAccesoDocumentos } from '../utils/modulos.js'

/*
 * Ajustes: «Usuarios» (el directorio de cuentas) y «Clientes» (catálogo: lista, alta, edición y contadores).
 * La pestaña viaja en la URL (?tab=clientes|usuarios|accesos); por omisión se abre «Usuarios».
 * «Clientes» la ven el administrador, el usuario de sistemas y la recepcionista (ella solo lista y da de alta).
 * «Acceso a módulos» (quién entra a documentos y con qué rol) la ve quien administra usuarios en documentos.
 */
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const veClientes = computed(
  () => session.esAdministrador || session.esUsuarioSistema || session.esRecepcionista,
)
const veAccesos = computed(() => hayAccesoDocumentos(session.rolDocumentos, 'administrar_usuarios'))

const pestana = computed({
  get: () => {
    if (veClientes.value && route.query.tab === 'clientes') return 'clientes'
    if (veAccesos.value && route.query.tab === 'accesos') return 'accesos'
    return 'usuarios'
  },
  set: (valor) => router.replace({ query: { ...route.query, tab: valor } }),
})
</script>

<style scoped>
.ajustes-page {
  padding: 16px;
}

.ajustes-page__pestanas {
  margin-bottom: 4px;
  border-bottom: 1px solid var(--dg-borde);
  color: var(--dg-texto-secundario);
}

.ajustes-page__paneles {
  background: transparent;
}

.ajustes-page__panel {
  padding: 12px 0 0;
}

/* El directorio es una página con su propio relleno: dentro de la pestaña lo cede a Ajustes. */
.ajustes-page__panel :deep(.directory-page) {
  min-height: 0;
  padding: 0;
}

@media (min-width: 1024px) {
  .ajustes-page {
    padding: 20px 24px;
  }

  .ajustes-page__panel :deep(.directory-page) {
    padding: 0;
  }
}
</style>
