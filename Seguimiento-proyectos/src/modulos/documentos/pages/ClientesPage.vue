<template>
  <q-page class="q-pa-md fondo-pagina">
    <SeccionAnimada>
      <!-- Encabezado -->
      <div class="row items-center justify-between q-mb-md">
        <div class="col-12 col-sm">
          <div class="text-h5 text-weight-bold text-primary">
            Directorio de Clientes y Semáforo Fiscal
          </div>
          <div class="text-subtitle2 text-grey-8">
            Estado global de cumplimiento de entrega de documentos de clientes DCA
          </div>
        </div>
        <div class="col-12 col-sm-auto row q-gutter-sm">
          <q-btn icon="person_add" color="primary" label="Nuevo Cliente" @click="nuevoCliente">
            <q-tooltip>Registrar un nuevo cliente en el sistema</q-tooltip>
          </q-btn>
          <q-btn
            icon="download"
            flat
            color="primary"
            label="Exportar Reporte"
            @click="exportarReporte"
          >
            <q-tooltip>Descargar reporte de semáforo fiscal en Excel/PDF</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- Filtros -->
      <div class="row q-col-gutter-md q-mb-md items-center">
        <div class="col-12 col-md-3">
          <q-select
            v-model="periodo"
            :options="opcionesPeriodo"
            emit-value
            map-options
            :disable="error !== null"
            dense
            outlined
            options-dense
            dropdown-icon="expand_more"
            popup-content-class="menu-seleccion-custom"
            transition-show="jump-down"
            transition-hide="jump-up"
            label="Periodo"
            aria-label="Seleccionar periodo de consulta"
            class="selector-periodo selector-moderno"
          >
            <template #prepend>
              <q-icon name="calendar_month" size="18px" class="text-primary" />
            </template>
            <template #selected-item="scope">
              <span class="text-weight-medium text-primary text-capitalize ellipsis">
                {{ scope.opt?.label ?? scope.opt }}
              </span>
            </template>
            <template #option="{ itemProps, opt, selected }">
              <q-item
                v-bind="itemProps"
                :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
              >
                <q-item-section avatar class="item-seccion-icono">
                  <q-icon
                    :name="esMesActual(opt.value) ? 'today' : 'event'"
                    size="18px"
                    :class="selected ? 'text-primary' : 'text-grey-8'"
                  />
                </q-item-section>
                <q-item-section>
                  <q-item-label class="text-capitalize text-weight-medium">
                    {{ opt.label }}
                  </q-item-label>
                </q-item-section>
                <q-item-section v-if="esMesActual(opt.value)" side>
                  <q-badge color="primary" label="Actual" rounded class="badge-mes-actual" />
                </q-item-section>
                <q-item-section v-else-if="selected" side>
                  <q-icon name="check" size="16px" color="primary" />
                </q-item-section>
              </q-item>
            </template>
            <q-tooltip>Mes al que pertenecen los documentos de los clientes</q-tooltip>
          </q-select>
        </div>
        <div class="col-12 col-md-4">
          <q-toggle
            v-model="incluirBaja"
            label="Ver clientes dados de baja"
            aria-label="Incluir clientes dados de baja en los resultados"
          />
        </div>
        <div class="col-12 col-md-5">
          <q-input
            v-model="busqueda"
            dense
            outlined
            aria-label="Buscar clientes por RFC o razón social"
            name="busqueda"
            autocomplete="off"
            placeholder="Buscar por RFC o razón social…"
            class="buscador-clientes input-busqueda-moderno"
          >
            <template #append>
              <q-icon name="search" aria-hidden="true" />
            </template>
          </q-input>
        </div>
      </div>

      <!-- Aviso de error -->
      <q-banner v-if="error" class="bg-negative text-white q-mb-md rounded-borders">
        <template #avatar>
          <q-icon name="error" aria-hidden="true" />
        </template>
        {{ error }}
      </q-banner>

      <!-- Tabla Principal de Clientes -->
      <q-card class="shadow-2 rounded-borders bg-white">
        <q-card-section class="row items-center justify-between q-pb-none">
          <div>
            <div class="text-h6 text-weight-bold text-grey-8">Clientes</div>
            <div class="text-caption text-grey-8">
              Semáforo calculado con los documentos de {{ periodoDocumentos }}
            </div>
          </div>
          <div class="text-caption text-grey-8">{{ clientes.length }} clientes</div>
        </q-card-section>

        <q-card-section>
          <q-table
            :rows="clientes"
            :columns="columns"
            row-key="id"
            :loading="cargando"
            :no-data-label="mensajeTablaVacia"
            no-results-label="No hay clientes que coincidan con la búsqueda"
            :pagination="{ rowsPerPage: 10 }"
            flat
            bordered
          >
            <!-- RFC y Razón Social -->
            <template #body-cell-cliente="props">
              <q-td :props="props" class="celda-texto">
                <q-tooltip
                  >{{ props.row.razonSocial }} — RFC {{ textoRfc(props.row.rfc) }}</q-tooltip
                >
                <div class="text-weight-bold text-grey-9">{{ props.row.razonSocial }}</div>
                <div class="text-caption text-primary">
                  <span v-if="props.row.clave">Clave {{ props.row.clave }} · </span>RFC:
                  {{ textoRfc(props.row.rfc) }}
                </div>
              </q-td>
            </template>

            <!-- Despacho y Contador: se recortan para que el semáforo y las
               acciones no se salgan de la pantalla -->
            <template #body-cell-empresaDca="props">
              <q-td :props="props" class="celda-texto celda-despacho">
                <q-tooltip>{{ props.value }}</q-tooltip>
                {{ props.value }}
              </q-td>
            </template>

            <template #body-cell-contador="props">
              <q-td :props="props" class="celda-texto celda-contador">
                <q-tooltip>{{ props.value }}</q-tooltip>
                {{ props.value }}
              </q-td>
            </template>

            <!-- Semáforo: llega calculado del servidor, solo se pinta -->
            <template #body-cell-semaforo="props">
              <q-td :props="props" class="text-center">
                <q-badge
                  :class="['badge-semaforo', claseDeSemaforo(props.value).fondo]"
                  :text-color="claseDeSemaforo(props.value).texto"
                >
                  {{ props.value }}
                </q-badge>
              </q-td>
            </template>

            <!-- Documentos en el periodo -->
            <template #body-cell-pendientes="props">
              <q-td :props="props">
                <div v-if="props.value === 0" class="text-grey-8">
                  <q-icon
                    name="remove_circle_outline"
                    size="18px"
                    aria-hidden="true"
                    class="q-mr-xs"
                  />
                  Sin documentos
                  <q-tooltip>Sin documentos en {{ periodoDocumentos }}</q-tooltip>
                </div>
                <div v-else class="text-primary text-weight-bold">
                  {{ props.value }} documentos
                  <q-tooltip>Documentos en {{ periodoDocumentos }}</q-tooltip>
                </div>
              </q-td>
            </template>

            <!-- Acciones -->
            <template #body-cell-acciones="props">
              <q-td :props="props" class="text-center">
                <q-btn
                  flat
                  round
                  dense
                  icon="folder_open"
                  color="primary"
                  :aria-label="`Ver expediente de ${props.row.razonSocial}`"
                  @click="verExpediente(props.row)"
                >
                  <q-tooltip>Ver expediente del cliente</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  icon="send"
                  color="primary"
                  :aria-label="`Enviar recordatorio a ${props.row.razonSocial}`"
                  @click="recordatorio(props.row)"
                >
                  <q-tooltip>Enviar recordatorio de documentos</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </SeccionAnimada>
  </q-page>
</template>

<script setup>
import SeccionAnimada from '@/modulos/documentos/components/SeccionAnimada.vue'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { obtenerDirectorio } from '@/modulos/documentos/servicios/api.js'
import { mensajeParaUsuario } from '@/modulos/documentos/servicios/cliente.js'
import { claseDeSemaforo } from '@/modulos/documentos/composables/semaforoVista.js'
import { textoRfc } from '@/modulos/documentos/composables/clientesVista.js'
import { periodoDe, ultimosPeriodos } from '@/modulos/documentos/composables/fechas.js'

const $q = useQuasar()

// Formato de mes para etiquetas y tooltips
const formatoMesAnio = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })

// Estado reactivo
const clientes = ref([])
const cargando = ref(false)
const error = ref(null)
const periodo = ref(periodoDe(new Date()) || '')
const busqueda = ref('')
const incluirBaja = ref(false)

// Opciones del selector de periodo: últimos 12 meses. Con `emit-value` y
// `map-options` en el q-select, `periodo` guarda el texto 'YYYY-MM' y no el
// objeto de la opción: sin ellos se pedía `?periodo=[object Object]` y el
// servidor caía al mes en curso sin avisar.
const opcionesPeriodo = ultimosPeriodos(new Date(), 12)

// Mes en curso: se marca con «Actual» dentro del desplegable del periodo.
const periodoActual = periodoDe(new Date())
const esMesActual = (valor) => valor === periodoActual

// Periodo formateado para mostrar en la vista
const periodoDocumentos = computed(() => {
  if (!periodo.value) return ''
  const fecha = new Date(`${periodo.value}-01T12:00:00`)
  return formatoMesAnio.format(fecha)
})

// Mensaje de tabla vacía según el estado de la búsqueda
const mensajeTablaVacia = computed(() => {
  if (busqueda.value.trim()) {
    return 'No hay clientes que coincidan con la búsqueda'
  }
  return 'No hay clientes registrados'
})

// Columnas de la tabla
const columns = [
  {
    name: 'cliente',
    label: 'Cliente / RFC',
    field: 'razonSocial',
    align: 'left',
    sortable: true,
    classes: 'celda-cliente',
  },
  // En móvil se ocultan para que el semáforo y las acciones queden a la vista
  {
    name: 'empresaDca',
    label: 'Despacho DCA Asignado',
    field: 'empresaDca',
    align: 'left',
    classes: 'ocultar-en-xs',
    headerClasses: 'ocultar-en-xs',
  },
  {
    name: 'contador',
    label: 'Contador Asignado',
    field: 'contador',
    align: 'left',
    classes: 'ocultar-en-xs',
    headerClasses: 'ocultar-en-xs',
  },
  {
    name: 'semaforo',
    label: 'Semáforo de Entrega',
    field: 'semaforo',
    align: 'center',
    sortable: true,
  },
  {
    name: 'pendientes',
    label: 'Documentos en el Periodo',
    field: 'totalDocumentos',
    align: 'left',
    classes: 'ocultar-en-xs',
    headerClasses: 'ocultar-en-xs',
  },
  { name: 'acciones', label: 'Acciones', field: 'acciones', align: 'center' },
]

// Cargar clientes desde el servidor
const cargarClientes = async () => {
  cargando.value = true
  error.value = null
  try {
    const respuesta = await obtenerDirectorio({
      periodo: periodo.value,
      busqueda: busqueda.value.trim(),
      incluirBaja: incluirBaja.value,
    })
    clientes.value = respuesta.clientes || []
  } catch (err) {
    clientes.value = []
    error.value = mensajeParaUsuario(err, 'No se pudieron cargar los clientes')
    $q.notify({
      type: 'negative',
      message: error.value,
      position: 'top-right',
    })
  } finally {
    cargando.value = false
  }
}

// Debounce de búsqueda: espera 300ms después de la última pulsación
let temporizador = null
watch(busqueda, () => {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    cargarClientes()
  }, 300)
})

// Recargar al cambiar periodo o datos de baja
watch(periodo, () => cargarClientes())
watch(incluirBaja, () => cargarClientes())

// Limpiar temporizador al desmontar
onUnmounted(() => {
  clearTimeout(temporizador)
})

// Cargar al montar
onMounted(() => {
  cargarClientes()
})

// Acciones
const nuevoCliente = () => {
  $q.notify({
    type: 'info',
    message: 'Abrir diálogo de registro de nuevo cliente.',
    position: 'top-right',
  })
}

const exportarReporte = () => {
  $q.notify({
    type: 'positive',
    message: 'Reporte de semaforización exportado en Excel/PDF.',
    position: 'top-right',
  })
}

const verExpediente = (cliente) => {
  $q.notify({
    type: 'info',
    message: `Abriendo expediente contable de ${cliente.razonSocial}`,
    position: 'top-right',
  })
}

const recordatorio = (cliente) => {
  $q.notify({
    type: 'positive',
    message: `Recordatorio enviado vía WhatsApp/Email a ${cliente.razonSocial}`,
    position: 'top-right',
  })
}
</script>

<style scoped lang="scss">
/* Fondo de la página con un neutro de la paleta institucional (en lugar de `bg-grey-2`) */
/* Buscador: ancho completo dentro de su columna */
.buscador-clientes {
  width: 100%;
}

/* Selector de periodo: ancho completo dentro de su columna */
.selector-periodo {
  width: 100%;
}

/* Badge del semáforo: tamaño y peso en clase, no en estilo en línea */
.badge-semaforo {
  padding: 6px 10px;
  font-size: 0.8rem;
  font-weight: 700;
  border-radius: 6px;
}

/* Chips de documentos pendientes: neutro institucional, porque el color de
   estado ya lo comunica la columna del semáforo */
.chip-pendiente {
  background-color: $secondary-white-alternative;
}

/* Los chips se envuelven en varias líneas. Sin esto NO bajaban: Vue los renderiza
   uno tras otro sin espacio entre ellos, y dos elementos en línea sin un espacio
   en medio no tienen punto de corte, así que la celda crecía hasta 364px para
   mostrar los tres chips en una sola línea y la tabla se salía de su contenedor. */
.lista-pendientes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* Columnas de texto largo. Sin esto la tabla medía 1303px dentro de un contenedor
   de 1124px en un monitor de 1440px y las columnas Semáforo, Pendientes y
   Acciones quedaban fuera de la pantalla: los botones para abrir el expediente y
   enviar recordatorio había que buscarlos con barra de desplazamiento horizontal.
   El texto completo sigue disponible en el tooltip. */
.celda-texto {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.celda-cliente {
  max-width: 240px;
}

.celda-despacho {
  max-width: 170px;
}

.celda-contador {
  max-width: 155px;
}

/* En móvil se ocultan Despacho, Contador y Pendientes, y se recorta el nombre
   del cliente para que semáforo y acciones quepan sin desplazar la tabla.
   `:deep` es necesario porque las celdas las renderiza QTable, fuera del
   ámbito del template del componente. */
@media (max-width: 599.98px) {
  :deep(.ocultar-en-xs) {
    display: none;
  }

  :deep(.celda-cliente) {
    max-width: 140px;
  }
}
</style>
