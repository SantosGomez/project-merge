<template>
  <q-page class="q-pa-md fondo-pagina">
    <SeccionAnimada>
      <!-- Encabezado -->
      <div class="row items-center justify-between q-mb-md">
        <div class="col-12 col-sm">
          <div class="text-h5 text-weight-bold text-primary">Dashboard de Control Contable</div>
          <div class="text-subtitle2 text-grey-8">
            Documentos recibidos en el mes elegido y todo lo que sigue pendiente de meses anteriores
          </div>
        </div>
        <div class="col-12 col-sm-auto row items-center q-gutter-sm">
          <!-- El periodo manda en las tarjetas y en la tabla: al cambiarlo se recargan las dos -->
          <q-select
            v-model="periodo"
            :options="opcionesPeriodo"
            emit-value
            map-options
            dense
            outlined
            options-dense
            dropdown-icon="expand_more"
            label="Mes de recepción"
            aria-label="Seleccionar el mes de recepción de los documentos"
            name="periodo"
            class="selector-periodo selector-moderno"
            popup-content-class="menu-seleccion-custom"
            transition-show="jump-down"
            transition-hide="jump-up"
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
            <q-tooltip>Mes al que pertenecen los documentos que se muestran</q-tooltip>
          </q-select>
          <q-btn
            icon="refresh"
            flat
            label="Actualizar"
            color="primary"
            :loading="cargando"
            @click="cargarDocumentos"
          >
            <q-tooltip>Actualizar indicadores y lista de documentos</q-tooltip>
          </q-btn>
          <q-btn
            v-if="puedeRecepcionar"
            icon="add"
            color="primary"
            label="Nueva Recepción"
            :to="{ name: 'doc-recepcion' }"
          >
            <q-tooltip>Ir al formulario de recepción de documentos</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- Tarjetas: resumen de los documentos (resumenDocumentos.js), sin el filtro de la tabla.
         Cada tarjeta es un botón: al pulsarla la tabla muestra solo lo que cuenta, y otra vez lo quita. -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div v-for="tarjeta in tarjetas" :key="tarjeta.clave" class="col-12 col-sm-6 col-md-3">
          <q-card
            :class="[
              'shadow-1 rounded-borders bg-white tarjeta-filtro cursor-pointer',
              tarjeta.borde,
              { 'tarjeta-activa': tarjetaActiva === tarjeta.clave },
            ]"
            role="button"
            tabindex="0"
            :aria-pressed="tarjetaActiva === tarjeta.clave"
            :aria-label="`${tarjeta.titulo}: ${resumen[tarjeta.cifra]}. ${tarjeta.ayuda}`"
            @click="alternarTarjeta(tarjeta.clave)"
            @keydown.enter.prevent="alternarTarjeta(tarjeta.clave)"
            @keydown.space.prevent="alternarTarjeta(tarjeta.clave)"
          >
            <q-card-section class="row items-center justify-between no-wrap">
              <div>
                <div class="text-caption text-weight-bold text-grey-8">{{ tarjeta.titulo }}</div>
                <div :class="['text-h4 text-weight-bolder', tarjeta.colorCifra]">
                  {{ resumen[tarjeta.cifra] }}
                </div>
                <div :class="['text-caption', tarjeta.colorPie]">{{ tarjeta.pie }}</div>
              </div>
              <q-avatar
                :icon="tarjeta.icono"
                :color="tarjeta.colorIcono"
                :text-color="tarjeta.textoIcono"
                size="48px"
              />
            </q-card-section>
            <q-tooltip>{{ tarjeta.ayuda }}</q-tooltip>
          </q-card>
        </div>
      </div>

      <!-- Tabla de Control con Semáforo -->
      <q-card class="shadow-2 rounded-borders bg-white">
        <q-card-section class="row items-center justify-between q-pb-none">
          <div class="row items-center q-gutter-sm">
            <div class="text-h6 text-weight-bold text-grey-8">Documentos</div>
            <q-chip
              v-if="tarjetaActiva"
              removable
              outline
              color="primary"
              :remove-aria-label="`Quitar el filtro «${tituloTarjetaActiva}»`"
              @remove="tarjetaActiva = null"
            >
              Solo: {{ tituloTarjetaActiva }}
            </q-chip>
          </div>

          <!-- Búsqueda y Filtros -->
          <div class="barra-filtros q-mt-xs-sm q-mt-md-none">
            <q-toggle
              v-if="esContador"
              v-model="soloMisDocumentos"
              label="Mis documentos"
              color="primary"
              dense
              class="text-weight-medium text-grey-8"
            />

            <q-input
              v-model="filter"
              dense
              outlined
              aria-label="Buscar por cliente o folio"
              name="busqueda"
              autocomplete="off"
              placeholder="Buscar cliente o folio…"
              class="input-busqueda-moderno"
            >
              <template #prepend>
                <q-icon name="search" size="18px" class="text-grey-8" />
              </template>
            </q-input>

            <q-select
              v-model="filtroEstado"
              :options="opcionesEstado"
              emit-value
              map-options
              dense
              outlined
              options-dense
              dropdown-icon="expand_more"
              label="Estado"
              aria-label="Filtrar documentos por estado"
              name="estado"
              class="selector-moderno selector-filtro-estado"
              popup-content-class="menu-seleccion-custom"
              transition-show="jump-down"
              transition-hide="jump-up"
            >
              <template #prepend>
                <q-icon name="tune" size="18px" class="text-grey-8" />
              </template>
              <template #selected-item="scope">
                <div class="row items-center no-wrap q-gutter-xs">
                  <span
                    v-if="scope.opt?.value && scope.opt.value !== 'Todos'"
                    :class="['punto-estado-sm', estiloDeEstadoDocumento(scope.opt.value).fondo]"
                  />
                  <span class="text-primary text-weight-medium ellipsis">
                    {{ scope.opt?.label ?? scope.opt }}
                  </span>
                </div>
              </template>
              <template #option="{ itemProps, opt, selected }">
                <q-item
                  v-bind="itemProps"
                  :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                >
                  <q-item-section avatar class="item-seccion-icono">
                    <span
                      v-if="opt.value !== 'Todos'"
                      :class="['punto-estado', estiloDeEstadoDocumento(opt.value).fondo]"
                    />
                    <q-icon v-else name="apps" size="16px" class="text-grey-8" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-weight-medium">{{ opt.label }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="selected" side>
                    <q-icon name="check" size="16px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <q-select
              v-model="filtroTipo"
              :options="opcionesTipo"
              emit-value
              map-options
              dense
              outlined
              options-dense
              clearable
              dropdown-icon="expand_more"
              label="Tipo de documento"
              aria-label="Filtrar documentos por tipo de documento"
              name="tipo"
              class="selector-moderno selector-filtro-tipo"
              popup-content-class="menu-seleccion-custom"
              transition-show="jump-down"
              transition-hide="jump-up"
            >
              <template #prepend>
                <q-icon name="description" size="18px" class="text-grey-8" />
              </template>
              <template #selected-item="scope">
                <span class="text-primary text-weight-medium ellipsis">
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
                      :name="opt.value ? 'article' : 'category'"
                      size="16px"
                      :class="selected ? 'text-primary' : 'text-grey-8'"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-weight-medium ellipsis">{{ opt.label }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="selected" side>
                    <q-icon name="check" size="16px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </div>
        </q-card-section>

        <q-card-section>
          <q-table
            :rows="filteredRows"
            :columns="columns"
            row-key="id"
            flat
            bordered
            :loading="cargando"
            loading-label="Cargando documentos…"
            :no-data-label="mensajeTablaVacia"
            :pagination="{ rowsPerPage: 6 }"
            rows-per-page-label="Documentos por página:"
            :pagination-label="etiquetaPaginacion"
            :grid="$q.screen.width < 1024"
          >
            <!-- Por debajo de 1024px la tabla no cabe (a 800px sobraban 322px con cinco columnas):
               cada documento se muestra como una tarjeta (modo grid de QTable). -->
            <template #item="props">
              <div class="col-12 q-pa-xs">
                <q-card flat bordered>
                  <q-card-section class="q-pb-xs">
                    <div class="row items-center no-wrap q-gutter-x-sm">
                      <div class="col texto-recortado text-weight-bold text-primary">
                        {{ props.row.folio }}
                      </div>
                      <q-chip
                        :class="[
                          'text-weight-bold',
                          estiloDeEstadoDocumento(props.row.estado).fondo,
                          estiloDeEstadoDocumento(props.row.estado).texto,
                        ]"
                        size="sm"
                        :icon="estiloDeEstadoDocumento(props.row.estado).icono"
                      >
                        {{ estiloDeEstadoDocumento(props.row.estado).etiqueta }}
                      </q-chip>
                    </div>
                    <div class="texto-recortado text-grey-8">{{ props.row.cliente }}</div>
                    <div class="texto-recortado text-caption text-grey-8">
                      {{ props.row.tipo }} ·
                      {{ formatearPeriodo(props.row.periodo, { mes: 'short' }) }} · Prioridad
                      {{ textoPrioridad(props.row.prioridad) }}
                    </div>
                    <div
                      v-if="textoDelPlazo(props.row, hoy)"
                      :class="[
                        'text-caption',
                        esVencido(props.row) ? 'text-negative text-weight-bold' : 'text-grey-8',
                      ]"
                    >
                      {{ textoDelPlazo(props.row, hoy) }}
                    </div>
                  </q-card-section>
                  <q-card-actions align="right" class="q-pt-none">
                    <q-btn
                      flat
                      round
                      dense
                      icon="visibility"
                      color="primary"
                      :aria-label="`Ver detalle del documento ${props.row.folio}`"
                      @click="verDetalles(props.row)"
                    >
                      <q-tooltip>Ver detalle del documento</q-tooltip>
                    </q-btn>
                    <q-btn
                      v-if="puedeCambiarDocumento(props.row)"
                      flat
                      round
                      dense
                      icon="edit"
                      color="grey-8"
                      :aria-label="`Cambiar estado contable de ${props.row.folio}`"
                      @click="cambiarEstado(props.row)"
                    >
                      <q-tooltip>Cambiar estado contable</q-tooltip>
                    </q-btn>
                  </q-card-actions>
                </q-card>
              </div>
            </template>

            <!-- Celda de Folio -->
            <template #body-cell-folio="props">
              <q-td :props="props">
                <span class="text-weight-bold text-primary">{{ props.value }}</span>
                <!-- Sin la columna Periodo (bajo 1440px), el periodo va bajo el folio -->
                <div class="lt-lg text-caption text-grey-8">
                  {{ formatearPeriodo(props.row.periodo, { mes: 'short' }) }}
                </div>
              </q-td>
            </template>

            <!-- Cliente y Tipo se recortan con puntos suspensivos; el texto completo va en el tooltip -->
            <template #body-cell-cliente="props">
              <q-td :props="props">
                {{ props.value }}
                <q-tooltip>{{ props.value }}</q-tooltip>
              </q-td>
            </template>

            <template #body-cell-tipo="props">
              <q-td :props="props">
                {{ props.value }}
                <q-tooltip>{{ props.value }}</q-tooltip>
              </q-td>
            </template>

            <!-- Celdas de Periodo y Fecha (se formatean con Intl, no en crudo) -->
            <template #body-cell-periodo="props">
              <q-td :props="props">{{ formatearPeriodo(props.value, { mes: 'short' }) }}</q-td>
            </template>

            <template #body-cell-fecha="props">
              <q-td :props="props">{{ formatearFechaHora(props.value) }}</q-td>
            </template>

            <!-- Fecha límite con lo que falta o lo que lleva de atraso; el atraso en rojo (6.41:1) -->
            <template #body-cell-limite="props">
              <q-td :props="props">
                <div>{{ formatearFecha(props.value?.slice(0, 10)) }}</div>
                <div
                  v-if="textoDelPlazo(props.row, hoy)"
                  :class="[
                    'text-caption',
                    esVencido(props.row) ? 'text-negative text-weight-bold' : 'text-grey-8',
                  ]"
                >
                  {{ textoDelPlazo(props.row, hoy) }}
                </div>
              </q-td>
            </template>

            <!-- Prioridad como texto: el color por prioridad vive en otras dos vistas y no se copia aquí -->
            <template #body-cell-prioridad="props">
              <q-td :props="props">{{ textoPrioridad(props.value) }}</q-td>
            </template>

            <!-- Celda de Semáforo / Estado -->
            <template #body-cell-estado="props">
              <q-td :props="props">
                <q-chip
                  :class="[
                    'text-weight-bold',
                    estiloDeEstadoDocumento(props.value).fondo,
                    estiloDeEstadoDocumento(props.value).texto,
                  ]"
                  size="sm"
                  :icon="estiloDeEstadoDocumento(props.value).icono"
                >
                  {{ estiloDeEstadoDocumento(props.value).etiqueta }}
                </q-chip>
              </q-td>
            </template>

            <!-- Celda de Acciones -->
            <template #body-cell-acciones="props">
              <q-td :props="props" class="text-center">
                <q-btn
                  flat
                  round
                  dense
                  icon="visibility"
                  color="primary"
                  :aria-label="`Ver detalle del documento ${props.row.folio}`"
                  @click="verDetalles(props.row)"
                >
                  <q-tooltip>Ver detalle del documento</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="puedeCambiarDocumento(props.row)"
                  flat
                  round
                  dense
                  icon="edit"
                  color="grey-8"
                  :aria-label="`Cambiar estado contable de ${props.row.folio}`"
                  @click="cambiarEstado(props.row)"
                >
                  <q-tooltip>Cambiar estado contable</q-tooltip>
                </q-btn>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>

      <!-- Modal Ver Detalle de Documento -->
      <q-dialog v-model="mostrarDetalle" aria-label="Detalle del documento">
        <q-card class="dialogo-detalle">
          <q-card-section class="bg-primary text-white row items-center">
            <div class="text-h6">Detalle de Documento</div>
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
          <q-card-section v-if="docSeleccionado" class="q-gutter-y-sm">
            <div><strong>Folio:</strong> {{ docSeleccionado.folio }}</div>
            <div><strong>Cliente:</strong> {{ docSeleccionado.cliente }}</div>
            <div><strong>Tipo:</strong> {{ docSeleccionado.tipo }}</div>
            <div>
              <strong>Periodo:</strong>
              {{ formatearPeriodo(docSeleccionado.periodo, { mes: 'short' }) }}
            </div>
            <div>
              <strong>Fecha Recepción:</strong>
              {{ formatearFechaHora(docSeleccionado.fechaRecepcion) }}
            </div>
            <div>
              <strong>Fecha límite:</strong>
              {{ formatearFecha(docSeleccionado.fechaLimite?.slice(0, 10)) }}
              <span
                v-if="textoDelPlazo(docSeleccionado, hoy)"
                :class="
                  esVencido(docSeleccionado) ? 'text-negative text-weight-bold' : 'text-grey-8'
                "
              >
                ({{ textoDelPlazo(docSeleccionado, hoy) }})
              </span>
            </div>
            <div><strong>Prioridad:</strong> {{ textoPrioridad(docSeleccionado.prioridad) }}</div>
            <div>
              <strong>Estado Actual:</strong>
              <q-chip
                :class="[
                  estiloDeEstadoDocumento(docSeleccionado.estado).fondo,
                  estiloDeEstadoDocumento(docSeleccionado.estado).texto,
                ]"
                size="xs"
              >
                {{ estiloDeEstadoDocumento(docSeleccionado.estado).etiqueta }}
              </q-chip>
            </div>
            <!-- Explica por qué no hay botón de cambio: la entrega firmada es en Direccionamiento -->
            <div
              v-if="puedeCambiarEstado && docSeleccionado.estado === 'RECEPCIONADO'"
              class="text-caption text-grey-8"
            >
              Pasa a «En proceso» cuando se entrega a un contador en Direccionamiento.
            </div>
            <q-separator />
            <div>
              <strong>Observaciones:</strong>
              {{ docSeleccionado.observaciones || 'Sin observaciones registradas.' }}
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Cerrar" color="grey-8" v-close-popup />
            <q-btn
              v-if="puedeCambiarDocumento(docSeleccionado)"
              label="Cambiar estado"
              color="primary"
              @click="cambiarEstado(docSeleccionado)"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- Modal Cambiar Estado: guarda en la base y deja la fila en el historial -->
      <q-dialog v-model="mostrarCambioEstado" aria-label="Cambiar el estado del documento">
        <q-card class="dialogo-detalle">
          <q-card-section class="bg-primary text-white row items-center">
            <div class="text-h6">Cambiar estado</div>
            <q-space />
            <q-btn
              icon="close"
              flat
              round
              dense
              aria-label="Cerrar sin cambiar el estado"
              :disable="guardandoEstado"
              v-close-popup
            >
              <q-tooltip>Cerrar sin cambiar el estado</q-tooltip>
            </q-btn>
          </q-card-section>
          <q-card-section v-if="docCambio" class="q-gutter-y-md">
            <div>
              <strong>Folio:</strong> {{ docCambio.folio }} ·
              <strong>Estado actual:</strong>
              {{ estiloDeEstadoDocumento(docCambio.estado).etiqueta }}
            </div>
            <q-select
              v-model="estadoNuevo"
              :options="opcionesEstadoNuevo"
              emit-value
              map-options
              outlined
              dense
              dropdown-icon="expand_more"
              label="Nuevo estado *"
              aria-label="Elegir el nuevo estado del documento"
              name="estado-nuevo"
              class="selector-moderno"
              popup-content-class="menu-seleccion-custom"
              transition-show="jump-down"
              transition-hide="jump-up"
            >
              <template #prepend>
                <q-icon name="sync_alt" size="18px" class="text-primary" />
              </template>
              <template #selected-item="scope">
                <div class="row items-center no-wrap q-gutter-xs">
                  <span
                    v-if="scope.opt?.value"
                    :class="['punto-estado-sm', estiloDeEstadoDocumento(scope.opt.value).fondo]"
                  />
                  <span class="text-primary text-weight-medium">
                    {{ scope.opt?.label ?? scope.opt }}
                  </span>
                </div>
              </template>
              <template #option="{ itemProps, opt, selected }">
                <q-item
                  v-bind="itemProps"
                  :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                >
                  <q-item-section avatar class="item-seccion-icono">
                    <span :class="['punto-estado', estiloDeEstadoDocumento(opt.value).fondo]" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-weight-medium">{{ opt.label }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="selected" side>
                    <q-icon name="check" size="16px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input
              v-model="comentarioEstado"
              type="textarea"
              autogrow
              outlined
              label="Comentario (opcional)"
              name="comentario-estado"
              hint="Queda guardado en el historial del documento"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Cancelar" color="grey-8" :disable="guardandoEstado" v-close-popup />
            <q-btn
              label="Guardar estado"
              color="primary"
              :loading="guardandoEstado"
              :disable="!estadoNuevo"
              @click="guardarEstado"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </SeccionAnimada>
  </q-page>
</template>

<script setup>
import SeccionAnimada from '@/modulos/documentos/components/SeccionAnimada.vue'
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import {
  formatearFecha,
  formatearPeriodo,
  periodoDe,
  ultimosPeriodos,
} from '@/modulos/documentos/composables/fechas'
import { obtenerDocumentos, cambiarEstadoDocumento } from '@/modulos/documentos/servicios/api.js'
import { mensajeParaUsuario } from '@/modulos/documentos/servicios/cliente.js'
import { useSesion } from '@/modulos/documentos/composables/sesion.js'
import { hayAcceso } from '@/modulos/documentos/permisos.js'
import { estadosPermitidos } from '../logica/estadosDocumento.js'
import { estiloDeEstadoDocumento } from '@/modulos/documentos/composables/estadoDocumentoVista.js'
import {
  resumirDocumentos,
  coincideConTarjeta,
  textoDelPlazo,
} from '@/modulos/documentos/composables/resumenDocumentos.js'

const $q = useQuasar()

// Cada rol ve solo los botones que puede usar, con la misma tabla de permisos
// que la guardia y el menú. El servidor vuelve a comprobarlo en cada petición.
const sesion = useSesion()
const puede = (accion) => hayAcceso(sesion.usuario.value?.rol, accion)
const puedeRecepcionar = computed(() => puede('registrar_recepcion'))
const puedeCambiarEstado = computed(() => puede('cambiar_estado'))
const esContador = computed(() => puedeCambiarEstado.value && !puedeRecepcionar.value)
const soloMisDocumentos = ref(false)

// Además del rol, el documento: solo lo cambia su contador asignado o un
// administrador, y solo por los caminos permitidos (la regla es la del servidor).
const usuarioSesion = computed(() => sesion.usuario.value)
const puedeCambiarDocumento = (row) =>
  puedeCambiarEstado.value && estadosPermitidos(row, usuarioSesion.value).length > 0
const filter = ref('')
const filtroEstado = ref('Todos')
const filtroTipo = ref(null)
const mostrarDetalle = ref(false)
const docSeleccionado = ref(null)

// Formato de fecha con Intl, para no depender de un formato escrito a mano.
// Los datos se guardan en ISO 8601 (así los entregará el backend).
// ⚠️ Zona horaria, dos trampas distintas:
//   · `2026-10-08T10:15:00` (con hora y sin offset) se interpreta como HORA LOCAL.
//   · `2026-10-01` (solo fecha) se interpreta como UTC, y en México (UTC-6)
//     retrocede al día y al mes anteriores. Por eso el periodo se ancla a mediodía.
// Los formateadores se crean una sola vez, no en cada render.
// El formateo del periodo y de la fecha lo pone el módulo compartido
// (`@/composables/fechas`), que ya vive en `formatearPeriodo` y `formatearFecha`.
const LOCALE = 'es-MX'
const fmtFechaHora = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const fmtMesAnio = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' })

const formatearFechaHora = (valor) => (valor ? fmtFechaHora.format(new Date(valor)) : '—')
const anclaMesLocal = (periodo) => new Date(`${periodo}-01T12:00:00`)
const formatearMesAnio = (valor) => (valor ? fmtMesAnio.format(anclaMesLocal(valor)) : '—')

// El color, la etiqueta y el icono de cada estado los pone `estadoDocumentoVista.js`.
// Filtro de estado: los cinco valores del ENUM `documentos.estado`, con su etiqueta.
const opcionesEstado = [
  { label: 'Todos', value: 'Todos' },
  ...['RECEPCIONADO', 'EN_PROCESO', 'PENDIENTE_CLIENTE', 'COMPLETADO', 'CANCELADO'].map(
    (estado) => ({
      label: estiloDeEstadoDocumento(estado).etiqueta,
      value: estado,
    }),
  ),
]

const opcionesTipo = computed(() => [
  { label: 'Todos los tipos', value: null },
  ...[...new Set(rows.value.map((r) => r.tipo).filter(Boolean))]
    .sort()
    .map((tipo) => ({ label: tipo, value: tipo })),
])
const columns = [
  { name: 'folio', label: 'Folio', field: 'folio', align: 'left', sortable: true },
  {
    name: 'cliente',
    label: 'Cliente',
    field: 'cliente',
    align: 'left',
    sortable: true,
    classes: 'celda-texto celda-cliente',
  },
  // Medido el 2026-11-04 con Fecha límite y Prioridad: a 1440px sobraban 98px
  // (Fecha Recepción pasa a verse solo desde 1920px) y a 1024px otros 98px
  // (Periodo se oculta y va bajo el folio). Todo sigue en el detalle.
  {
    name: 'tipo',
    label: 'Tipo Documento',
    field: 'tipo',
    align: 'left',
    classes: 'celda-texto celda-tipo ocultar-bajo-lg',
    headerClasses: 'ocultar-bajo-lg',
  },
  {
    name: 'periodo',
    label: 'Periodo',
    field: 'periodo',
    align: 'center',
    sortable: true,
    classes: 'ocultar-bajo-lg',
    headerClasses: 'ocultar-bajo-lg',
  },
  {
    name: 'fecha',
    label: 'Fecha Recepción',
    field: 'fechaRecepcion',
    align: 'center',
    classes: 'ocultar-bajo-xl',
    headerClasses: 'ocultar-bajo-xl',
  },
  { name: 'limite', label: 'Fecha límite', field: 'fechaLimite', align: 'left', sortable: true },
  {
    name: 'prioridad',
    label: 'Prioridad',
    field: 'prioridad',
    align: 'left',
    classes: 'ocultar-bajo-lg',
    headerClasses: 'ocultar-bajo-lg',
  },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'center', sortable: true },
  { name: 'acciones', label: 'Acciones', field: 'acciones', align: 'center' },
]

// Mes de recepción elegido (por omisión, el mes en curso); el parámetro sigue llamándose `periodo` en la API
const periodo = ref(periodoDe(new Date()))
const opcionesPeriodo = ultimosPeriodos(new Date(), 12)
const rows = ref([])
const cargando = ref(false)
const error = ref(null)

// El día de referencia se fija al cargar: así la tarjeta, la fila y el texto
// del plazo usan el mismo «hoy» aunque la página quede abierta pasada la medianoche.
const hoy = ref(new Date())
const esMesActual = (val) => val === periodoDe(hoy.value)

// Las tarjetas cuentan todos los documentos cargados, no solo los filtrados
const resumen = computed(() => resumirDocumentos(rows.value, hoy.value, periodo.value))

// Tarjeta pulsada: la tabla muestra solo lo que esa tarjeta cuenta (misma regla)
const tarjetaActiva = ref(null)
const alternarTarjeta = (clave) => {
  tarjetaActiva.value = tarjetaActiva.value === clave ? null : clave
}

const tarjetas = computed(() => {
  const mes = formatearMesAnio(periodo.value)
  return [
    {
      clave: 'recibidos',
      cifra: 'total',
      titulo: 'Recibidos',
      pie: `Recibidos en ${mes}`,
      ayuda: `Mostrar solo los documentos recibidos en ${mes}`,
      borde: 'border-left-primary',
      colorCifra: 'text-primary',
      colorPie: 'text-grey-8',
      icono: 'inventory_2',
      colorIcono: 'secondary',
      textoIcono: 'primary',
    },
    {
      clave: 'enTramite',
      cifra: 'enTramite',
      titulo: 'En trámite',
      pie: 'Dentro de su fecha límite',
      ayuda: 'Mostrar solo lo que sigue en trámite y en plazo, sea del mes que sea',
      borde: 'border-left-warning',
      colorCifra: 'text-primary',
      colorPie: 'text-grey-8',
      icono: 'pending_actions',
      colorIcono: 'warning',
      textoIcono: 'primary',
    },
    {
      clave: 'vencidos',
      cifra: 'vencidos',
      titulo: 'Vencidos',
      pie: 'Fecha límite pasada',
      ayuda: 'Mostrar solo lo que ya pasó su fecha límite, sea del mes que sea',
      borde: 'border-left-negative',
      colorCifra: 'text-negative',
      colorPie: 'text-negative text-weight-bold',
      icono: 'warning',
      colorIcono: 'negative',
      textoIcono: 'white',
    },
    {
      clave: 'completados',
      cifra: 'completados',
      titulo: 'Completados',
      pie: `Recibidos en ${mes} y terminados`,
      ayuda: `Mostrar solo los documentos recibidos en ${mes} ya terminados`,
      borde: 'border-left-positive',
      colorCifra: 'text-primary',
      colorPie: 'text-grey-8',
      icono: 'check_circle',
      colorIcono: 'positive',
      textoIcono: 'primary',
    },
  ]
})
const tituloTarjetaActiva = computed(
  () => tarjetas.value.find((t) => t.clave === tarjetaActiva.value)?.titulo ?? '',
)

const esVencido = (row) => coincideConTarjeta(row, 'vencidos', hoy.value)

// «URGENTE» → «Urgente»: solo el texto; el color por prioridad no se repite aquí
const textoPrioridad = (prioridad) =>
  prioridad ? prioridad.charAt(0) + prioridad.slice(1).toLowerCase() : '—'

const filteredRows = computed(() => {
  const q = filter.value.toLowerCase().trim()
  return rows.value.filter((r) => {
    const coincideEstado = filtroEstado.value === 'Todos' || r.estado === filtroEstado.value
    const coincideTipo = !filtroTipo.value || r.tipo === filtroTipo.value
    const coincideTexto =
      !q || r.folio.toLowerCase().includes(q) || r.cliente.toLowerCase().includes(q)
    const coincideTarjeta = coincideConTarjeta(r, tarjetaActiva.value, hoy.value, periodo.value)
    return coincideEstado && coincideTipo && coincideTexto && coincideTarjeta
  })
})

const verDetalles = (row) => {
  docSeleccionado.value = row
  mostrarDetalle.value = true
}

// Cambio de estado: el diálogo ofrece los otros cuatro estados (el actual no,
// porque el servidor lo rechazaría) y un comentario opcional para el historial.
const mostrarCambioEstado = ref(false)
const docCambio = ref(null)
const estadoNuevo = ref(null)
const comentarioEstado = ref('')
const guardandoEstado = ref(false)

const opcionesEstadoNuevo = computed(() =>
  estadosPermitidos(docCambio.value, usuarioSesion.value).map((estado) => ({
    label: estiloDeEstadoDocumento(estado).etiqueta,
    value: estado,
  })),
)

const cambiarEstado = (row) => {
  docCambio.value = row
  estadoNuevo.value = null
  comentarioEstado.value = ''
  mostrarDetalle.value = false
  mostrarCambioEstado.value = true
}

const guardarEstado = async () => {
  // Bandera de reentrada: un doble clic no debe dejar dos filas en el historial
  if (guardandoEstado.value || !estadoNuevo.value) return
  guardandoEstado.value = true
  try {
    await cambiarEstadoDocumento(docCambio.value.id, {
      estado: estadoNuevo.value,
      comentario: comentarioEstado.value.trim() || undefined,
    })
    mostrarCambioEstado.value = false
    $q.notify({
      type: 'positive',
      message: `El documento ${docCambio.value.folio} quedó como «${estiloDeEstadoDocumento(estadoNuevo.value).etiqueta}».`,
      position: 'top-right',
    })
    // Se recarga del servidor: tabla y tarjetas muestran lo que quedó guardado
    await cargarDocumentos()
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: mensajeParaUsuario(err, 'No se pudo cambiar el estado del documento'),
      position: 'top-right',
    })
  } finally {
    guardandoEstado.value = false
  }
}

// Pie de la tabla en español: sin esta prop Quasar pinta «1–6 of 19»
const etiquetaPaginacion = (inicio, fin, total) => `${inicio}–${fin} de ${total}`

// Con el filtrado en un computed la tabla no sabe si hay búsqueda activa:
// el mensaje de tabla vacía se calcula aquí (ver AGENTS.md).
const mensajeTablaVacia = computed(() => {
  if (error.value) return error.value
  if (
    filter.value.trim() ||
    filtroEstado.value !== 'Todos' ||
    filtroTipo.value ||
    tarjetaActiva.value
  ) {
    return 'No hay documentos que coincidan con la búsqueda o el filtro'
  }
  return `No hay documentos recibidos en ${formatearMesAnio(periodo.value)} ni pendientes de meses anteriores`
})

// Cargar los documentos del periodo desde el servidor
const cargarDocumentos = async () => {
  cargando.value = true
  error.value = null
  try {
    const respuesta = await obtenerDocumentos(periodo.value, {
      misDocumentos: soloMisDocumentos.value,
    })
    hoy.value = new Date()
    rows.value = respuesta.documentos || []
  } catch (err) {
    rows.value = []
    error.value = mensajeParaUsuario(err, 'No se pudieron cargar los documentos')
    $q.notify({
      type: 'negative',
      message: error.value,
      position: 'top-right',
    })
  } finally {
    cargando.value = false
  }
}

onMounted(cargarDocumentos)
watch([periodo, soloMisDocumentos], cargarDocumentos)
</script>

<style scoped lang="scss">
/* Fondo de la página con un neutro de la paleta institucional (en lugar de `bg-grey-2`) */
/* Franja de color que identifica cada indicador del dashboard.
   Antes usaba hexadecimales literales: dos de ellos ni siquiera coincidían con
   la paleta (`primary` era #1976d2 en vez de $primary y `warning` #ffb300). */
.border-left-primary {
  border-left: 5px solid $primary;
}
.border-left-warning {
  border-left: 5px solid $warning;
}
.border-left-negative {
  border-left: 5px solid $negative;
}
.border-left-positive {
  border-left: 5px solid $positive;
}

/* Tarjetas que filtran: la pulsada lleva un borde completo, y el foco por
   teclado su propio anillo (la regla global de app.scss solo cubre botones e items). */
.tarjeta-filtro:focus-visible {
  outline: 2px solid $primary;
  outline-offset: 2px;
}
.tarjeta-activa {
  box-shadow: 0 0 0 2px $primary;
}

/* Selectores y campos modernos: definidos una sola vez en
   Frontend/src/css/app.scss (`.selector-moderno`,
   `.input-busqueda-moderno`, `.barra-filtros`). Aquí solo se
   respetan los anchos de cada filtro de esta vista. */

/* Ancho y comportamiento de selectores y filtros */
.selector-periodo {
  width: 224px;
}

.selector-filtro-estado {
  width: 195px;
}

.selector-filtro-tipo {
  width: 225px;
}

.input-busqueda-moderno {
  width: 220px;
}

@media (max-width: 599.98px) {
  .selector-periodo,
  .selector-filtro-estado,
  .selector-filtro-tipo,
  .input-busqueda-moderno {
    width: 100% !important;
  }
}

/* Diálogo de detalle: las medidas van en clase, no en estilo en línea */
.dialogo-detalle {
  width: 500px;
  max-width: 90vw;
  max-height: 85vh;
  overscroll-behavior: contain;
}

/* Cliente y Tipo son texto largo: se recortan con puntos suspensivos sobre el
   `q-td` (funciona con `table-layout: auto`) y el texto completo va en el tooltip.
   Se usa `:deep` porque las celdas las renderiza QTable, fuera del ámbito del
   template del componente. */
:deep(.celda-texto) {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
:deep(.celda-cliente) {
  max-width: 180px;
}
:deep(.celda-tipo) {
  max-width: 180px;
}

/* Por debajo de 1440px se ocultan Tipo, Periodo y Prioridad, y por debajo de
   1920px la Fecha Recepción, para que Acciones no quede fuera de la vista.
   Por debajo de 1024px la tabla pasa a tarjetas (`grid`). */
@media (max-width: 1919.98px) {
  :deep(.ocultar-bajo-xl) {
    display: none;
  }
}
@media (max-width: 1439.98px) {
  :deep(.ocultar-bajo-lg) {
    display: none;
  }
  /* A 1024px aún sobraban 5px: el cliente se recorta un poco más (el nombre va en el tooltip) */
  :deep(.celda-cliente) {
    max-width: 160px;
  }
}

/* En las tarjetas de móvil: recorte en una línea. `min-width: 0` deja encoger
   al hijo flex, que si no se niega y empuja el chip fuera de la tarjeta. */
.texto-recortado {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
