<template>
  <q-page class="q-pa-md fondo-pagina">
    <SeccionAnimada>
      <!-- Encabezado -->
      <div class="row items-center justify-between q-mb-md">
        <div class="col-12 col-sm">
          <div class="text-h5 text-weight-bold text-primary">
            Direccionamiento y Recepción Contable
          </div>
          <div class="text-subtitle2 text-grey-8">
            Entrega formal de documentación del área de recepción al contador asignado
          </div>
        </div>
        <div class="col-12 col-sm-auto row q-gutter-sm">
          <q-btn icon="refresh" flat color="primary" label="Actualizar" @click="actualizarTabla">
            <q-tooltip>Recargar la lista de documentos pendientes</q-tooltip>
          </q-btn>
          <q-btn
            icon="print"
            color="primary"
            label="Imprimir Relación"
            :loading="generando"
            :disable="generando"
            @click="imprimirRelacion"
          >
            <q-tooltip>Imprimir la relación de documentos por entregar</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- Tarjetas: se calculan con los mismos pendientes de la tabla -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-12 col-sm-6 col-md-4">
          <q-card class="shadow-1 rounded-borders bg-white">
            <q-card-section class="row items-center">
              <q-avatar
                icon="inventory_2"
                color="secondary"
                text-color="primary"
                size="44px"
                class="q-mr-md"
              />
              <div>
                <div class="text-subtitle2 text-grey-8">Pendientes de entrega</div>
                <div class="text-h6 text-weight-bold text-primary">{{ resumen.porEntregar }}</div>
              </div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-sm-6 col-md-4">
          <q-card class="shadow-1 rounded-borders bg-white">
            <q-card-section class="row items-center">
              <q-avatar
                icon="priority_high"
                color="warning"
                text-color="primary"
                size="44px"
                class="q-mr-md"
              />
              <div>
                <div class="text-subtitle2 text-grey-8">Prioridad urgente</div>
                <div class="text-h6 text-weight-bold text-primary">{{ resumen.urgentes }}</div>
              </div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-sm-6 col-md-4">
          <q-card class="shadow-1 rounded-borders bg-white">
            <q-card-section class="row items-center">
              <q-avatar
                icon="warning"
                color="negative"
                text-color="white"
                size="44px"
                class="q-mr-md"
              />
              <div>
                <div class="text-subtitle2 text-grey-8">Fuera de plazo</div>
                <div class="text-h6 text-weight-bold text-negative">{{ resumen.vencidos }}</div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Filtros y Tabla -->
      <q-card class="shadow-2 rounded-borders bg-white">
        <q-card-section class="row items-center justify-between q-pb-none q-col-gutter-md">
          <div class="col-12 col-sm text-h6 text-weight-bold text-grey-8">
            Documentos por Entregar
          </div>
          <div class="col-12 col-sm-auto row q-col-gutter-sm items-center">
            <q-select
              v-model="filtroCliente"
              :options="opcionesClientes"
              label="Cliente"
              aria-label="Filtrar documentos por cliente"
              name="filtroCliente"
              outlined
              dense
              options-dense
              dropdown-icon="expand_more"
              popup-content-class="menu-seleccion-custom"
              transition-show="jump-down"
              transition-hide="jump-up"
              clearable
              class="filtro-cliente selector-moderno"
            >
              <template #prepend>
                <q-icon name="storefront" size="18px" class="text-primary" />
              </template>
              <template #selected-item="scope">
                <span class="text-weight-medium text-primary ellipsis">
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
                      name="storefront"
                      size="18px"
                      :class="selected ? 'text-primary' : 'text-grey-8'"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-weight-medium">{{ opt?.label ?? opt }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="selected" side>
                    <q-icon name="check" size="16px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-select
              v-model="filtroContador"
              :options="opcionesContadores"
              label="Contador"
              aria-label="Filtrar documentos por contador"
              name="filtroContador"
              outlined
              dense
              options-dense
              dropdown-icon="expand_more"
              popup-content-class="menu-seleccion-custom"
              transition-show="jump-down"
              transition-hide="jump-up"
              clearable
              class="filtro-contador selector-moderno"
            >
              <template #prepend>
                <q-icon name="person" size="18px" class="text-primary" />
              </template>
              <template #selected-item="scope">
                <span class="text-weight-medium text-primary ellipsis">
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
                      name="person"
                      size="18px"
                      :class="selected ? 'text-primary' : 'text-grey-8'"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-weight-medium">{{ opt?.label ?? opt }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="selected" side>
                    <q-icon name="check" size="16px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input
              v-model="busqueda"
              dense
              outlined
              aria-label="Buscar documentos por folio o cliente"
              name="busqueda"
              autocomplete="off"
              placeholder="Buscar folio o cliente…"
              class="filtro-busqueda input-busqueda-moderno"
            >
              <template #append>
                <q-icon name="search" aria-hidden="true" />
              </template>
            </q-input>
          </div>
        </q-card-section>

        <q-card-section>
          <q-table
            :rows="rowsFiltrados"
            :columns="columns"
            row-key="id"
            flat
            bordered
            :no-data-label="mensajeTablaVacia"
            no-results-label="No hay documentos que coincidan con el filtro"
            loading-label="Cargando documentos…"
            :pagination="{ rowsPerPage: 6 }"
            rows-per-page-label="Documentos por página:"
            :pagination-label="etiquetaPaginacion"
            :loading="cargando"
          >
            <template #body-cell-cliente="props">
              <q-td :props="props" class="celda-texto">
                <q-tooltip>{{ props.row.cliente }}</q-tooltip>
                <div class="text-weight-bold text-grey-8">{{ props.row.cliente }}</div>
                <div class="text-caption text-primary">RFC: {{ textoRfc(props.row.rfc) }}</div>
              </q-td>
            </template>

            <template #body-cell-tipo="props">
              <q-td :props="props" class="celda-texto celda-tipo">
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

            <!-- La fecha se pinta con Intl, no en crudo (venía como "09/10/2026 09:12") -->
            <template #body-cell-fechaRecepcion="props">
              <q-td :props="props">{{ formatearFechaHora(props.value) }}</q-td>
            </template>

            <template #body-cell-prioridad="props">
              <q-td :props="props">
                <q-badge
                  :class="['badge-prioridad', getPrioridadFondo(props.value)]"
                  :text-color="getPrioridadTexto(props.value)"
                >
                  {{ props.value }}
                </q-badge>
              </q-td>
            </template>

            <!-- Fecha límite: se marca solo cuando ya pasó (la de hoy sigue en plazo) -->
            <template #body-cell-fechaLimite="props">
              <q-td
                :props="props"
                :class="{ 'text-negative text-weight-bold': estaVencida(props.row) }"
              >
                <span v-if="estaVencida(props.row)">
                  <q-icon name="warning" size="16px" aria-hidden="true" class="q-mr-xs" />
                  {{ formatearDia(props.value) }}
                </span>
                <span v-else>{{ formatearDia(props.value) }}</span>
              </q-td>
            </template>

            <template #body-cell-acciones="props">
              <q-td :props="props" class="text-center">
                <q-btn
                  flat
                  round
                  dense
                  icon="draw"
                  color="primary"
                  :aria-label="`Formalizar entrega del documento ${props.row.folio}`"
                  @click="abrirDialogoEntrega(props.row)"
                >
                  <q-tooltip>Formalizar entrega y recepción con firmas</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  round
                  dense
                  icon="visibility"
                  color="grey-8"
                  :aria-label="`Ver detalle del documento ${props.row.folio}`"
                  @click="verDetalle(props.row)"
                >
                  <q-tooltip>Ver detalle del documento recibido</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>

      <!-- Diálogo de Firma de Entrega al Contador -->
      <q-dialog
        v-model="mostrarDialogoEntrega"
        persistent
        aria-label="Entrega y recepción contable"
      >
        <q-card class="dialogo-entrega">
          <q-card-section class="row items-center bg-primary text-white rounded-borders">
            <q-icon name="assignment_return" size="30px" class="q-mr-sm" aria-hidden="true" />
            <div>
              <div class="text-h6 text-weight-bold">Entrega y Recepción Contable</div>
              <div class="text-caption">
                Folio: <strong>{{ documentoSeleccionado.folio }}</strong>
              </div>
            </div>
            <q-space />
            <q-btn
              icon="close"
              flat
              round
              dense
              aria-label="Cerrar la entrega sin guardar"
              @click="cerrarDialogoEntrega"
            >
              <q-tooltip>Cerrar sin guardar</q-tooltip>
            </q-btn>
          </q-card-section>

          <q-card-section class="q-pt-md">
            <div class="row q-col-gutter-sm q-mb-md banda-info q-pa-sm rounded-borders">
              <div class="col-12 col-sm-6">
                <div class="text-caption text-grey-8">Cliente:</div>
                <div class="text-weight-bold">{{ documentoSeleccionado.cliente }}</div>
              </div>
              <div class="col-12 col-sm-6">
                <div class="text-caption text-grey-8">Tipo de Documento:</div>
                <div class="text-weight-bold">{{ documentoSeleccionado.tipoDocumento }}</div>
              </div>
            </div>

            <div v-if="contadorFijo" class="row items-center no-wrap q-mb-sm contador-fijo">
              <q-icon name="person_pin" color="primary" size="24px" aria-hidden="true" />
              <div class="q-ml-sm">
                <div class="text-caption text-grey-8">Contador que recibe la documentación</div>
                <div class="text-weight-bold">{{ documentoSeleccionado.contador }}</div>
              </div>
            </div>
            <q-select
              v-else
              v-model="contadorEntrega"
              :options="catalogoContadores"
              emit-value
              map-options
              label="Contador que Recibe la Documentación *"
              name="contadorEntrega"
              outlined
              dense
              options-dense
              dropdown-icon="expand_more"
              popup-content-class="menu-seleccion-custom"
              transition-show="jump-down"
              transition-hide="jump-up"
              class="selector-moderno"
              :disable="guardando"
              :loading="cargandoCatalogo"
              :rules="[(val) => !!val || 'Seleccione el contador que recibe']"
            >
              <template #prepend>
                <q-icon name="person_pin" color="primary" aria-hidden="true" />
              </template>
              <template #selected-item="scope">
                <span class="text-weight-medium text-primary ellipsis">
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
                      name="person"
                      size="18px"
                      :class="selected ? 'text-primary' : 'text-grey-8'"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-weight-medium">
                      {{ opt?.label ?? opt }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section v-if="selected" side>
                    <q-icon name="check" size="16px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <div
              class="text-subtitle1 text-weight-bold text-grey-8 q-mt-md q-mb-sm row items-center"
            >
              <q-icon name="draw" class="q-mr-xs text-primary" size="20px" aria-hidden="true" />
              Firmas de Conformidad
            </div>

            <div class="row q-col-gutter-md">
              <div class="col-12 col-sm-6">
                <q-card
                  flat
                  bordered
                  :class="[
                    'q-pa-sm panel-firma',
                    { 'borde-error': submittedEntrega && firmaRecepcionistaVacia },
                  ]"
                >
                  <div class="text-caption text-weight-bold text-grey-8 q-mb-xs">
                    Firma de Recepción DCA (Entrega) *
                  </div>
                  <canvas
                    ref="canvasRecepcionista"
                    class="bg-white rounded-borders style-signature-canvas"
                    @mousedown="startDrawingRecepcionista"
                    @mousemove="drawRecepcionista"
                    @mouseup="stopDrawingRecepcionista"
                    @mouseleave="stopDrawingRecepcionista"
                    @touchstart.prevent="startDrawingRecepcionista"
                    @touchmove.prevent="drawRecepcionista"
                    @touchend.prevent="stopDrawingRecepcionista"
                  ></canvas>
                  <div class="text-caption text-grey-8 text-center q-mt-xs">
                    <q-icon name="gesture" aria-hidden="true" /> Dibuje la firma con el dedo o ratón
                  </div>
                </q-card>
              </div>

              <div class="col-12 col-sm-6">
                <q-card
                  flat
                  bordered
                  :class="[
                    'q-pa-sm panel-firma',
                    { 'borde-error': submittedEntrega && firmaContadorVacia },
                  ]"
                >
                  <div class="text-caption text-weight-bold text-grey-8 q-mb-xs">
                    Firma del Contador (Recibido) *
                  </div>
                  <canvas
                    ref="canvasContador"
                    class="bg-white rounded-borders style-signature-canvas"
                    @mousedown="startDrawingContador"
                    @mousemove="drawContador"
                    @mouseup="stopDrawingContador"
                    @mouseleave="stopDrawingContador"
                    @touchstart.prevent="startDrawingContador"
                    @touchmove.prevent="drawContador"
                    @touchend.prevent="stopDrawingContador"
                  ></canvas>
                  <div class="text-caption text-grey-8 text-center q-mt-xs">
                    <q-icon name="how_to_reg" aria-hidden="true" /> Confirme la recepción del
                    documento
                  </div>
                </q-card>
              </div>
            </div>

            <q-input
              v-model="observacionesEntrega"
              type="textarea"
              rows="2"
              autogrow
              label="Observaciones de la entrega"
              outlined
              dense
              class="q-mt-sm"
              placeholder="Ej: Se entregan 45 CFDI del periodo, faltan estados de cuenta del banco."
            />
          </q-card-section>

          <q-card-actions align="right" class="q-pr-md q-pb-md q-gutter-sm">
            <q-btn label="Cancelar" color="grey-8" flat @click="cerrarDialogoEntrega" />
            <q-btn
              label="Confirmar Entrega y Generar Constancia"
              color="primary"
              icon-right="task_alt"
              @click="confirmarEntrega"
            >
              <q-tooltip>Registrar ambas firmas y pasar el documento a En Proceso</q-tooltip>
            </q-btn>
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- Confirmación al descartar firmas ya capturadas -->
      <q-dialog v-model="mostrarConfirmacionCierre" aria-label="Confirmar cierre sin guardar">
        <q-card class="dialogo-confirmacion">
          <q-card-section class="row items-center q-pb-none">
            <q-avatar icon="warning" color="warning" text-color="primary" class="q-mr-md" />
            <div>
              <div class="text-subtitle1 text-weight-bold text-grey-8">¿Cerrar sin guardar?</div>
              <div class="text-caption text-grey-8">
                Las firmas capturadas se descartarán y el documento seguirá pendiente de entrega.
              </div>
            </div>
          </q-card-section>
          <q-card-actions align="right" class="q-gutter-sm q-pa-md">
            <q-btn flat label="Seguir firmando" color="grey-8" v-close-popup />
            <q-btn
              label="Descartar firmas"
              color="negative"
              unelevated
              @click="confirmarDescarte"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- Diálogo de Detalle del Documento -->
      <q-dialog v-model="mostrarDetalle" aria-label="Detalle del documento">
        <q-card class="dialogo-detalle q-pa-sm">
          <q-card-section class="row items-center cabecera-detalle rounded-borders">
            <q-icon
              name="description"
              color="primary"
              class="q-mr-sm"
              size="28px"
              aria-hidden="true"
            />
            <div class="text-h6 text-weight-bold text-grey-9">Detalle del Documento</div>
            <q-space />
            <q-btn
              icon="close"
              flat
              round
              dense
              aria-label="Cerrar detalle del documento"
              v-close-popup
            >
              <q-tooltip>Cerrar detalle del documento</q-tooltip>
            </q-btn>
          </q-card-section>
          <q-card-section>
            <q-list separator dense>
              <q-item>
                <q-item-section class="text-grey-8">Folio:</q-item-section>
                <q-item-section side class="text-weight-bold">{{
                  documentoSeleccionado.folio
                }}</q-item-section>
              </q-item>
              <q-item>
                <q-item-section class="text-grey-8">Cliente:</q-item-section>
                <q-item-section side class="text-weight-bold">{{
                  documentoSeleccionado.cliente
                }}</q-item-section>
              </q-item>
              <q-item>
                <q-item-section class="text-grey-8">Tipo de documento:</q-item-section>
                <q-item-section side class="text-weight-bold">{{
                  documentoSeleccionado.tipo
                }}</q-item-section>
              </q-item>
              <q-item>
                <q-item-section class="text-grey-8">Prioridad:</q-item-section>
                <q-item-section side class="text-weight-bold">{{
                  documentoSeleccionado.prioridad
                }}</q-item-section>
              </q-item>
              <q-item>
                <q-item-section class="text-grey-8">Recibido por:</q-item-section>
                <q-item-section side class="text-weight-bold">{{
                  documentoSeleccionado.recibidoPor
                }}</q-item-section>
              </q-item>
              <q-item>
                <q-item-section class="text-grey-8">Recepción:</q-item-section>
                <q-item-section side class="text-weight-bold">{{
                  formatearFechaHora(documentoSeleccionado.fechaRecepcion)
                }}</q-item-section>
              </q-item>
              <q-item>
                <q-item-section class="text-grey-8">Fecha límite:</q-item-section>
                <q-item-section side class="text-weight-bold">{{
                  formatearDia(documentoSeleccionado.fechaLimite)
                }}</q-item-section>
              </q-item>
              <q-item>
                <q-item-section class="text-grey-8">Periodo:</q-item-section>
                <q-item-section side class="text-weight-bold">{{
                  documentoSeleccionado.periodo
                }}</q-item-section>
              </q-item>
              <q-item v-if="documentoSeleccionado.observaciones">
                <q-item-section class="text-grey-8">Observaciones:</q-item-section>
                <q-item-section side class="text-weight-bold">{{
                  documentoSeleccionado.observaciones
                }}</q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
          <q-card-actions align="right" class="q-pr-md q-pb-md">
            <q-btn flat label="Cerrar" color="grey-8" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        Mostrando {{ rowsFiltrados.length }} documentos por entregar
      </div>
    </SeccionAnimada>
  </q-page>

  <Teleport to="body">
    <div ref="zonaImpresion" class="zona-impresion" aria-hidden="true">
      <div class="pagina-relacion">
        <header class="encabezado-relacion">
          <h1 class="titulo-monument">Relación de Documentos por Entregar</h1>
          <p class="subtitulo">Grupo DCA — Direccionamiento y Recepción Contable</p>
        </header>
        <p class="fecha-emision">Fecha de emisión: {{ fechaEmision }}</p>
        <table class="tabla-relacion">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Prioridad</th>
              <th>Contador asignado</th>
              <th>Fecha límite</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rowsFiltrados" :key="row.id">
              <td>{{ row.folio }}</td>
              <td>{{ row.cliente }}</td>
              <td>{{ row.tipo }}</td>
              <td>{{ row.prioridad }}</td>
              <td>{{ row.contador || 'Sin asignar' }}</td>
              <td>{{ formatearDia(row.fechaLimite) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="pie-relacion">Total de documentos: {{ rowsFiltrados.length }}</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import SeccionAnimada from '@/modulos/documentos/components/SeccionAnimada.vue'
import { ref, computed, nextTick, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { formatearFecha } from '@/modulos/documentos/composables/fechas'
import html2pdf from 'html2pdf.js'
import {
  obtenerCatalogos,
  obtenerDireccionamiento,
  entregarDocumento,
} from '@/modulos/documentos/servicios/api.js'
import { mensajeParaUsuario } from '@/modulos/documentos/servicios/cliente.js'
import { resumirPendientes } from '@/modulos/documentos/composables/resumenDireccionamiento.js'
import { textoRfc } from '@/modulos/documentos/composables/clientesVista.js'

const $q = useQuasar()

const zonaImpresion = ref(null)
const generando = ref(false)

// Catálogo de contadores (activos, rol Contador) para el diálogo de entrega
const catalogoContadores = ref([])
const cargandoCatalogo = ref(false)

// Datos reales
const rows = ref([])
const cargando = ref(false)
const error = ref(null)

const resumen = computed(() => resumirPendientes(rows.value, new Date()))

const busqueda = ref('')
const filtroCliente = ref(null)
const filtroContador = ref(null)

const opcionesClientes = computed(() => [...new Set(rows.value.map((r) => r.cliente))])
const opcionesContadores = computed(() => [
  ...new Set(rows.value.map((r) => r.contador).filter(Boolean)),
])

const rowsFiltrados = computed(() => {
  let resultado = rows.value
  if (filtroCliente.value) {
    resultado = resultado.filter((r) => r.cliente === filtroCliente.value)
  }
  if (filtroContador.value) {
    resultado = resultado.filter((r) => r.contador === filtroContador.value)
  }
  if (busqueda.value.trim()) {
    const q = busqueda.value.toLowerCase()
    resultado = resultado.filter(
      (r) => r.folio.toLowerCase().includes(q) || r.cliente.toLowerCase().includes(q),
    )
  }
  return resultado
})

const hoyDia = computed(() => {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
})

const getPrioridadFondo = (prioridad) => {
  if (prioridad === 'URGENTE') return 'bg-negative'
  if (prioridad === 'ALTA') return 'bg-warning'
  if (prioridad === 'MEDIA') return 'bg-info'
  return 'fondo-prioridad-baja'
}

const getPrioridadTexto = (prioridad) => (prioridad === 'URGENTE' ? 'white' : 'primary')

const fechaEmision = computed(() => {
  const h = new Date()
  const fmt = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return fmt.format(h)
})

const estaVencida = (row) => row?.fechaLimite != null && row.fechaLimite.slice(0, 10) < hoyDia.value

const formatearDia = (valor) => (valor ? formatearFecha(valor.slice(0, 10)) : '—')

const LOCALE = 'es-MX'
const fmtFechaHora = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const formatearFechaHora = (valor) => (valor ? fmtFechaHora.format(new Date(valor)) : '—')

const columns = [
  { name: 'folio', label: 'Folio', field: 'folio', align: 'left', sortable: true },
  {
    name: 'cliente',
    label: 'Cliente / RFC',
    field: 'cliente',
    align: 'left',
    sortable: true,
    classes: 'celda-cliente',
  },
  {
    name: 'tipo',
    label: 'Tipo de Documento',
    field: 'tipo',
    align: 'left',
    classes: 'celda-texto celda-tipo ocultar-en-xs',
    headerClasses: 'ocultar-en-xs',
  },
  {
    name: 'fechaRecepcion',
    label: 'Recepción',
    field: 'fechaRecepcion',
    align: 'left',
    sortable: true,
  },
  {
    name: 'prioridad',
    label: 'Prioridad',
    field: 'prioridad',
    align: 'center',
    sortable: true,
    classes: 'ocultar-en-xs',
    headerClasses: 'ocultar-en-xs',
  },
  {
    name: 'contador',
    label: 'Contador asignado',
    field: 'contador',
    align: 'left',
    classes: 'celda-texto celda-contador ocultar-en-xs',
    headerClasses: 'ocultar-en-xs',
  },
  {
    name: 'fechaLimite',
    label: 'Fecha límite',
    field: 'fechaLimite',
    align: 'left',
    sortable: true,
    classes: 'ocultar-en-xs',
    headerClasses: 'ocultar-en-xs',
  },
  { name: 'acciones', label: 'Acciones', field: 'acciones', align: 'center' },
]

const mensajeTablaVacia = computed(() => {
  if (error.value) return error.value
  if (busqueda.value.trim() || filtroCliente.value || filtroContador.value) {
    return 'No hay documentos que coincidan con el filtro'
  }
  return 'No hay documentos pendientes de entrega'
})

const etiquetaPaginacion = (inicio, fin, total) => `${inicio}–${fin} de ${total}`

// Carga real de pendientes
const cargarPendientes = async () => {
  cargando.value = true
  error.value = null
  try {
    const respuesta = await obtenerDireccionamiento()
    rows.value = respuesta.documentos || []
  } catch (err) {
    rows.value = []
    error.value = mensajeParaUsuario(err, 'No se pudieron cargar los documentos por entregar')
    $q.notify({ type: 'negative', message: error.value, position: 'top-right' })
  } finally {
    cargando.value = false
  }
}

const actualizarTabla = () => {
  cargarPendientes()
}

const verDetalle = (row) => {
  documentoSeleccionado.value = row
  mostrarDetalle.value = true
}

// Diálogo de entrega y firmas
const mostrarDialogoEntrega = ref(false)
const mostrarConfirmacionCierre = ref(false)
const mostrarDetalle = ref(false)
const documentoSeleccionado = ref({})
// Si el documento ya trae contador (el de la recepción o, en los anteriores, el
// habitual del cliente), recibe ese y no se elige otro.
const contadorFijo = computed(() => !!documentoSeleccionado.value?.contadorId)
const submittedEntrega = ref(false)
const contadorEntrega = ref(null)
const observacionesEntrega = ref('')
const guardando = ref(false)

const canvasRecepcionista = ref(null)
const canvasContador = ref(null)
const firmaRecepcionistaVacia = ref(true)
const firmaContadorVacia = ref(true)
let ctxRecepcionista = null
let ctxContador = null
let isDrawingRecep = false
let isDrawingCont = false

const getPos = (canvas, e) => {
  const rect = canvas.getBoundingClientRect()
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  return { x: clientX - rect.left, y: clientY - rect.top }
}

const prepararCanvas = (canvas) => {
  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight
  const ctx = canvas.getContext('2d')
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  return ctx
}

const tintaInstitucional = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--q-primary').trim() || '#111e30'

const abrirDialogoEntrega = async (row) => {
  documentoSeleccionado.value = row
  contadorEntrega.value = row.contadorId ?? null
  observacionesEntrega.value = ''
  submittedEntrega.value = false
  guardando.value = false
  mostrarDialogoEntrega.value = true

  await nextTick()
  ctxRecepcionista = prepararCanvas(canvasRecepcionista.value)
  ctxContador = prepararCanvas(canvasContador.value)
  const tinta = tintaInstitucional()
  ctxRecepcionista.strokeStyle = tinta
  ctxContador.strokeStyle = tinta
}

const cerrarDialogoEntrega = () => {
  if (!firmaRecepcionistaVacia.value || !firmaContadorVacia.value) {
    mostrarConfirmacionCierre.value = true
    return
  }
  mostrarDialogoEntrega.value = false
  limpiarFirmas()
}

const confirmarDescarte = () => {
  mostrarConfirmacionCierre.value = false
  mostrarDialogoEntrega.value = false
  limpiarFirmas()
}

const limpiarFirmas = () => {
  if (ctxRecepcionista && canvasRecepcionista.value) {
    ctxRecepcionista.clearRect(
      0,
      0,
      canvasRecepcionista.value.width,
      canvasRecepcionista.value.height,
    )
  }
  if (ctxContador && canvasContador.value) {
    ctxContador.clearRect(0, 0, canvasContador.value.width, canvasContador.value.height)
  }
  firmaRecepcionistaVacia.value = true
  firmaContadorVacia.value = true
}

// Canvas Recepcionista
const startDrawingRecepcionista = (e) => {
  isDrawingRecep = true
  firmaRecepcionistaVacia.value = false
  const pos = getPos(canvasRecepcionista.value, e)
  ctxRecepcionista.beginPath()
  ctxRecepcionista.moveTo(pos.x, pos.y)
}
const drawRecepcionista = (e) => {
  if (!isDrawingRecep) return
  const pos = getPos(canvasRecepcionista.value, e)
  ctxRecepcionista.lineTo(pos.x, pos.y)
  ctxRecepcionista.stroke()
}
const stopDrawingRecepcionista = () => {
  isDrawingRecep = false
}

// Canvas Contador
const startDrawingContador = (e) => {
  isDrawingCont = true
  firmaContadorVacia.value = false
  const pos = getPos(canvasContador.value, e)
  ctxContador.beginPath()
  ctxContador.moveTo(pos.x, pos.y)
}
const drawContador = (e) => {
  if (!isDrawingCont) return
  const pos = getPos(canvasContador.value, e)
  ctxContador.lineTo(pos.x, pos.y)
  ctxContador.stroke()
}
const stopDrawingContador = () => {
  isDrawingCont = false
}

const imprimirRelacion = async () => {
  if (generando.value) return
  generando.value = true
  try {
    if (!zonaImpresion.value) {
      console.error('No se encontró la zona de impresión de la relación')
      return
    }
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready.catch(() => {})
    }
    await html2pdf()
      .from(zonaImpresion.value)
      .set({
        margin: [8, 8, 8, 8],
        filename: 'relacion-documentos-por-entregar.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      })
      .save()
  } catch (e) {
    console.error('Error al generar el PDF de la relación:', e)
    $q.notify({
      type: 'negative',
      message: 'No se pudo generar el PDF de la relación.',
      position: 'top-right',
    })
  } finally {
    generando.value = false
  }
}

const confirmarEntrega = async () => {
  submittedEntrega.value = true
  if (firmaRecepcionistaVacia.value || firmaContadorVacia.value) {
    $q.notify({
      type: 'warning',
      message: 'Ambas firmas son obligatorias para confirmar la entrega.',
      position: 'top-right',
    })
    return
  }
  if (!contadorEntrega.value) {
    $q.notify({
      type: 'warning',
      message: 'Seleccione el contador que recibe la documentación.',
      position: 'top-right',
    })
    return
  }
  if (guardando.value) return

  guardando.value = true
  try {
    const firmaEntrega = canvasRecepcionista.value.toDataURL()
    const firmaContador = canvasContador.value.toDataURL()
    const nombreContador =
      (contadorFijo.value
        ? documentoSeleccionado.value.contador
        : catalogoContadores.value.find((c) => c.value === contadorEntrega.value)?.label) ||
      'el contador'

    await entregarDocumento(documentoSeleccionado.value.id, {
      contadorId: contadorEntrega.value,
      firmaEntrega,
      firmaContador,
      observaciones: observacionesEntrega.value.trim() || undefined,
    })

    mostrarDialogoEntrega.value = false
    limpiarFirmas()
    $q.notify({
      type: 'positive',
      message: `Documento ${documentoSeleccionado.value.folio} entregado a ${nombreContador}. Estado: En Proceso.`,
      position: 'top-right',
    })
    await cargarPendientes()
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: mensajeParaUsuario(err, 'No se pudo confirmar la entrega del documento'),
      position: 'top-right',
    })
  } finally {
    guardando.value = false
  }
}

// Carga inicial
const cargarCatalogo = async () => {
  cargandoCatalogo.value = true
  try {
    const respuesta = await obtenerCatalogos()
    const contadores = (respuesta.contadores || []).map((c) => ({ value: c.id, label: c.nombre }))
    catalogoContadores.value = contadores
  } catch {
    catalogoContadores.value = []
  } finally {
    cargandoCatalogo.value = false
  }
}

onMounted(() => {
  cargarCatalogo()
  cargarPendientes()
})
</script>

<style scoped lang="scss">
/* Fondo de la página con un neutro de la paleta institucional (en lugar de `bg-grey-2`) */
/* Diálogos: las medidas van en clase, no en estilo en línea */
.dialogo-entrega {
  width: 700px;
  max-width: 95vw;
  max-height: 85vh;
  overscroll-behavior: contain;
}

.dialogo-detalle {
  width: 520px;
  max-width: 95vw;
  max-height: 85vh;
  overscroll-behavior: contain;
}

/* El diálogo de confirmación no necesita ancho fijo: se ajusta a su contenido */
.dialogo-confirmacion {
  max-width: 90vw;
}

/* Cabecera del detalle: neutro institucional (en lugar de `bg-grey-2`) */
.cabecera-detalle {
  background-color: $secondary-white-alternative;
}

/* Banda de contexto del cliente y tipo de documento. Antes `bg-blue-1` (#e3f2fd),
   un azul de Material que no pertenece a la paleta institucional. */
.banda-info {
  background-color: rgba($info, 0.12);
}

/* Panel donde se dibuja la firma (antes `bg-grey-1`, #fafafa, de Material).
   El borde sí se conserva: delimita el área de dibujo, no es un borde redundante. */
.panel-firma {
  background-color: $secondary-white-alternative;
}

/* Marca de firma obligatoria faltante (antes era un hex literal `#c10015`) */
.borde-error {
  border: 2px solid $negative;
}

/* Badges del semáforo */
.badge-prioridad,
.badge-estado {
  padding: 4px 8px;
  font-weight: 700;
}

/* Prioridad BAJA: neutro institucional, porque no requiere atención */
.fondo-prioridad-baja {
  background-color: $secondary-white-alternative;
}

/* Anchos de los filtros, para que no se compriman en pantallas medianas */
.filtro-cliente,
.filtro-busqueda {
  flex: 1 1 220px;
  min-width: 0;
  max-width: 100%;
}

.filtro-contador {
  flex: 0 1 220px;
  min-width: 160px;
  max-width: 100%;
}

.style-signature-canvas {
  touch-action: none;
  cursor: crosshair;
  width: 100%;
  height: 120px;
}

/* Columnas de texto largo. Sin esto la tabla medía 1355px dentro de un contenedor
   de 1124px en un monitor de 1440px y las columnas Estado y Acciones quedaban
   fuera de la pantalla: los botones de formalizar la entrega, que son el motivo de
   esta vista, había que buscarlos con barra de desplazamiento horizontal.
   El texto completo sigue disponible en el tooltip y en los diálogos. */
.celda-texto {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.celda-cliente {
  max-width: 190px;
}

.celda-tipo {
  max-width: 180px;
}

.celda-contador {
  max-width: 125px;
}

/* En móvil se ocultan Tipo, Prioridad y Contador: con 8 columnas la tabla medía
   1318px dentro de un contenedor de 419px. Se usa `:deep` porque las celdas las
   renderiza QTable, fuera del ámbito del template del componente.
   (Quasar no incluye un helper `hidden-xs`.) */
@media (max-width: 599.98px) {
  :deep(.ocultar-en-xs) {
    display: none;
  }

  /* Los nombres de cliente son largos y empujaban el estado y las acciones
     fuera de la pantalla. Se recortan aquí; el nombre completo sigue visible
     en el detalle del documento. */
  :deep(.celda-cliente) {
    max-width: 140px;
  }

  /* Los filtros ocupan el ancho completo en vez de apiñar tres controles */
  .filtro-cliente,
  .filtro-contador,
  .filtro-busqueda {
    min-width: 0;
    width: 100%;
  }
}
.zona-impresion {
  position: fixed;
  left: -10000px;
  top: 0;
  width: 277mm;
  background-color: #ffffff;
  color: $primary;
  font-family: 'Matter', 'Roboto', sans-serif;
}

.pagina-relacion {
  box-sizing: border-box;
  width: 100%;
  padding: 10mm 8mm;
  background-color: #ffffff;
}

.encabezado-relacion {
  background-color: $primary;
  color: #ffffff;
  padding: 7mm 6mm;
  border-radius: 4px 4px 0 0;
}

.titulo-monument {
  font-family: 'MonumentExtended', sans-serif;
  font-weight: 700;
  font-size: 18pt;
  line-height: 1.15;
  margin: 0 0 2mm 0;
  color: #ffffff;
}

.subtitulo {
  font-size: 9pt;
  margin: 0;
  color: #ffffff;
}

.fecha-emision {
  font-size: 9pt;
  margin: 4mm 0;
  color: $primary;
}

.tabla-relacion {
  width: 100%;
  border-collapse: collapse;
  font-size: 8.5pt;
}

.tabla-relacion th,
.tabla-relacion td {
  border: 0.5pt solid $secondary-white;
  padding: 2mm 2.5mm;
  text-align: left;
}

.tabla-relacion th {
  background-color: $secondary;
  color: $secondary-black;
  font-weight: 700;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
