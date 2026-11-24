<template>
  <q-page class="acceso-page">
    <header class="acceso-page__encabezado">
      <h1 class="acceso-page__titulo">Acceso al módulo</h1>
      <p class="acceso-page__lead">
        Elige quién entra a Recepción de documentos y con qué rol. Las cuentas se crean y se editan en el
        Directorio de Seguimiento de Proyectos.
      </p>
    </header>

    <q-banner v-if="error" class="acceso-page__aviso" role="alert">
      {{ error }}
      <template #action>
        <q-btn flat no-caps label="Reintentar" @click="cargar" />
      </template>
    </q-banner>

    <q-input
      v-model="busqueda"
      class="acceso-page__busqueda"
      outlined
      dense
      clearable
      label="Buscar por nombre, correo o usuario"
      autocomplete="off"
    >
      <template #prepend>
        <q-icon name="search" aria-hidden="true" />
      </template>
    </q-input>

    <q-table
      flat
      bordered
      row-key="id"
      :rows="filtradas"
      :columns="columnas"
      :loading="cargando"
      :pagination="{ rowsPerPage: 25 }"
      no-data-label="No hay cuentas que coincidan."
    >
      <template #body-cell-rol="props">
        <q-td :props="props">
          <q-select
            :model-value="props.row.rolDocumentos"
            :options="opcionesRol"
            emit-value
            map-options
            dense
            outlined
            options-dense
            class="acceso-page__rol"
            :disable="guardando === props.row.id"
            :loading="guardando === props.row.id"
            :aria-label="`Rol en documentos de ${props.row.nombre}`"
            @update:model-value="(rol) => cambiar(props.row, rol)"
          />
          <div v-if="props.row.porRol" class="acceso-page__nota">Por ser administrador</div>
        </q-td>
      </template>
    </q-table>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { cambiarAccesoDocumentos, obtenerAccesosDocumentos } from '@/modulos/documentos/servicios/api.js'

/*
 * Reemplaza la pantalla de usuarios de Proyecto-documentos: en la app unida las cuentas son las de
 * status-conta y aquí solo se decide el rol en este módulo (usuario_modulos). El administrador entra
 * siempre por su rol; se le puede dar otro rol dentro del módulo, pero no quitarle el acceso.
 */
const $q = useQuasar()

const NOMBRES_ROL = {
  administrador: 'Administrador',
  contador: 'Contador',
  recepcionista: 'Recepcionista',
  practicante: 'Practicante',
  sistemas: 'Sistemas',
}

const usuarios = ref([])
const roles = ref([])
const cargando = ref(false)
const guardando = ref(null)
const error = ref('')
const busqueda = ref('')

const columnas = [
  { name: 'nombre', label: 'Nombre', field: 'nombre', align: 'left', sortable: true },
  { name: 'correo', label: 'Correo', field: 'correo', align: 'left', sortable: true },
  { name: 'alias', label: 'Usuario', field: (fila) => fila.alias || '—', align: 'left' },
  { name: 'rol', label: 'Rol en documentos', field: 'rolDocumentos', align: 'left' },
]

const opcionesRol = computed(() => [
  { label: 'Sin acceso', value: null },
  ...roles.value.map((rol) => ({ label: NOMBRES_ROL[rol] ?? rol, value: rol })),
])

const filtradas = computed(() => {
  const termino = (busqueda.value ?? '').trim().toLowerCase()
  if (!termino) return usuarios.value
  return usuarios.value.filter((u) =>
    [u.nombre, u.correo, u.alias].some((v) => (v ?? '').toLowerCase().includes(termino)),
  )
})

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    const datos = await obtenerAccesosDocumentos()
    usuarios.value = datos.usuarios ?? []
    roles.value = datos.roles ?? []
  } catch (e) {
    error.value = e?.message || 'No se pudo cargar la lista de cuentas.'
  } finally {
    cargando.value = false
  }
}

async function cambiar(fila, rol) {
  if (fila.porRol && rol === null) {
    $q.notify({ type: 'warning', message: 'El administrador entra por su rol: no se le puede quitar el acceso.' })
    return
  }
  guardando.value = fila.id
  try {
    await cambiarAccesoDocumentos(fila.id, rol)
    fila.rolDocumentos = rol
    fila.porRol = false
    $q.notify({
      type: 'positive',
      message: rol ? `${fila.nombre}: ${NOMBRES_ROL[rol] ?? rol} en documentos.` : `${fila.nombre} ya no entra a documentos.`,
    })
  } catch (e) {
    $q.notify({ type: 'negative', message: e?.message || 'No se pudo guardar el cambio.' })
  } finally {
    guardando.value = null
  }
}

onMounted(cargar)
</script>

<style scoped>
.acceso-page {
  padding: 24px 16px;
  max-width: 1080px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.acceso-page__titulo {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--dg-texto);
}

.acceso-page__lead {
  margin: 4px 0 0;
  color: var(--dg-texto-secundario);
  max-width: 70ch;
}

.acceso-page__aviso {
  background: var(--dg-error-aviso-fondo);
  color: var(--dg-error-aviso-texto);
  border-radius: 12px;
}

.acceso-page__busqueda {
  max-width: 420px;
}

.acceso-page__rol {
  min-width: 180px;
}

.acceso-page__nota {
  margin-top: 4px;
  font-size: 0.8rem;
  color: var(--dg-texto-tenue);
}
</style>
