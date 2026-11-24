<template>
  <q-page class="q-pa-md fondo-pagina">
    <SeccionAnimada>
      <div class="row justify-center">
        <div class="col-12 col-md-10 col-lg-8">
          <!-- Encabezado: responde «¿en qué va lo mío?» con el resumen por estado -->
          <q-card class="q-mb-md bg-white shadow-1 rounded-borders q-pa-md">
            <h1 class="text-h5 text-weight-bold text-primary q-my-none">{{ titulo }}</h1>
            <div class="text-subtitle2 text-grey-8">{{ subtitulo }}</div>

            <div v-if="expedientes.length" class="row q-col-gutter-sm q-mt-sm">
              <div class="col-12 col-sm-6 col-md-4">
                <!-- Lo único que el cliente puede resolver: único bloque con color -->
                <div
                  :class="[
                    'bloque-resumen',
                    resumen.necesitanAlgo ? 'bg-warning text-primary' : 'bloque-neutro',
                  ]"
                >
                  <q-icon name="schedule" size="20px" class="q-mr-sm" />
                  <span class="cifra">{{ resumen.necesitanAlgo }}</span>
                  {{ textoNecesitanAlgo }}
                </div>
              </div>
              <div class="col-12 col-sm-6 col-md-4">
                <div class="bloque-resumen bloque-neutro">
                  <q-icon name="find_in_page" size="20px" class="q-mr-sm" />
                  <span class="cifra">{{ resumen.enProceso }}</span> en proceso
                </div>
              </div>
              <div class="col-12 col-sm-6 col-md-4">
                <div class="bloque-resumen bloque-neutro">
                  <q-icon name="check_circle" size="20px" class="q-mr-sm" />
                  <span class="cifra">{{ resumen.completados }}</span>
                  {{ resumen.completados === 1 ? 'completado' : 'completados' }}
                </div>
              </div>
            </div>
          </q-card>

          <!-- Buscador: el Cliente busca entre lo suyo; el personal, en todos los clientes -->
          <q-card class="shadow-2 bg-white rounded-borders q-mb-md">
            <q-card-section>
              <div class="text-h6 text-weight-bold text-grey-8 q-mb-sm">
                {{ esCliente ? 'Buscar un folio' : 'Buscar por folio o RFC' }}
              </div>
              <div class="row q-col-gutter-sm">
                <div class="col">
                  <q-input
                    v-model="queryBusqueda"
                    outlined
                    dense
                    class="input-busqueda-moderno"
                    :aria-label="
                      esCliente ? 'Buscar un folio' : 'Buscar documentos por folio o RFC'
                    "
                    name="busqueda"
                    autocomplete="off"
                    :placeholder="
                      esCliente
                        ? 'Folio del acuse (DCA-AAAA-NNNN); vacío para ver todos'
                        : 'Folio del acuse (DCA-AAAA-NNNN) o RFC'
                    "
                    :loading="cargando"
                    @keyup.enter="buscar"
                  >
                    <template #prepend>
                      <q-icon name="search" color="primary" />
                    </template>
                  </q-input>
                </div>
                <div class="col-auto">
                  <q-btn
                    color="primary"
                    label="Consultar"
                    :loading="cargando"
                    :disable="cargando"
                    @click="buscar"
                  />
                </div>
              </div>
            </q-card-section>
          </q-card>

          <!-- Aviso del servidor (por ejemplo, que se recortaron los resultados) -->
          <q-banner v-if="aviso" class="q-mb-md bg-warning text-primary rounded-borders">
            <template #avatar><q-icon name="info" color="primary" /></template>
            {{ aviso }}
          </q-banner>

          <!-- Error de la consulta, con el motivo que da el servidor -->
          <q-banner v-if="errorBusqueda" class="q-mb-md bg-negative text-white rounded-borders">
            <template #avatar><q-icon name="error" color="white" /></template>
            {{ errorBusqueda }}
          </q-banner>

          <!-- Resultados: un expediente por documento encontrado -->
          <template v-if="expedientes.length">
            <div class="text-subtitle2 text-grey-8 q-mb-sm" aria-live="polite">
              {{
                expedientes.length === 1
                  ? 'Se encontró 1 documento'
                  : `Se encontraron ${expedientes.length} documentos`
              }}
            </div>

            <q-card
              v-for="exp in expedientes"
              :key="exp.folio"
              class="shadow-2 bg-white rounded-borders q-mb-md"
            >
              <q-expansion-item
                :default-opened="expedientes.length === 1"
                header-class="banda-folio"
                :aria-label="`Ver el avance del folio ${exp.folio}`"
              >
                <template #header>
                  <q-item-section>
                    <q-item-label caption class="text-grey-8">Folio de recepción</q-item-label>
                    <q-item-label class="text-h6 text-weight-bold text-primary">
                      {{ exp.folio }}
                    </q-item-label>
                    <q-item-label caption class="text-grey-8">
                      {{ exp.tipo }} · {{ formatearPeriodo(exp.periodo) }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-chip
                      :class="['chip-estado', exp.estilo.fondo, exp.estilo.texto]"
                      :icon="exp.estilo.icono"
                    >
                      {{ exp.estilo.etiqueta }}
                    </q-chip>
                  </q-item-section>
                </template>

                <!-- Datos del documento -->
                <q-card-section>
                  <div class="row q-col-gutter-sm">
                    <div class="col-12 col-sm-6">
                      <div><strong class="text-grey-8">Cliente:</strong> {{ exp.cliente }}</div>
                      <div><strong class="text-grey-8">RFC:</strong> {{ textoRfc(exp.rfc) }}</div>
                      <div>
                        <strong class="text-grey-8">Empresa que recibió:</strong>
                        {{ exp.empresa }}
                      </div>
                    </div>
                    <div class="col-12 col-sm-6">
                      <div>
                        <strong class="text-grey-8">Fecha de recepción:</strong>
                        {{ formatearFechaHora(exp.fechaRecepcion) }}
                      </div>
                      <div>
                        <strong class="text-grey-8">Contador asignado:</strong>
                        {{ exp.contador || 'Aún sin asignar' }}
                      </div>
                    </div>
                  </div>
                </q-card-section>

                <q-separator />

                <!-- Línea de tiempo del trámite -->
                <q-card-section>
                  <div class="text-subtitle1 text-weight-bold text-grey-8 row items-center">
                    <q-icon name="timeline" color="primary" class="q-mr-xs" />
                    Avance del trámite
                  </div>
                  <q-timeline v-if="exp.hitos.length" color="primary">
                    <q-timeline-entry
                      v-for="hito in exp.hitos"
                      :key="hito.titulo + hito.fecha"
                      :title="hito.etiqueta"
                      :subtitle="formatearFechaHora(hito.fecha)"
                      :icon="hito.icono"
                      :color="hito.color"
                    >
                      <div v-if="hito.comentario">{{ hito.comentario }}</div>
                      <div class="text-caption text-grey-8">Registrado por {{ hito.usuario }}</div>
                    </q-timeline-entry>
                  </q-timeline>
                  <div v-else class="text-caption text-grey-8 q-mt-sm">
                    Todavía no hay movimientos registrados.
                  </div>
                </q-card-section>

                <q-separator />

                <!-- Archivos adjuntos registrados -->
                <q-card-section>
                  <div class="text-subtitle1 text-weight-bold text-grey-8 q-mb-sm">
                    Archivos adjuntos
                  </div>
                  <q-list v-if="exp.archivos.length">
                    <q-item v-for="archivo in exp.archivos" :key="archivo.nombre + archivo.fecha">
                      <q-item-section avatar>
                        <q-icon :name="iconoArchivo(archivo.tipo)" color="primary" size="28px" />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label class="text-weight-bold">{{ archivo.nombre }}</q-item-label>
                        <q-item-label caption class="text-grey-8">
                          {{ archivo.tamano }} — {{ formatearFechaHora(archivo.fecha) }}
                        </q-item-label>
                      </q-item-section>
                      <q-item-section side v-if="archivo.disponible">
                        <q-btn
                          flat
                          round
                          dense
                          icon="download"
                          color="primary"
                          :href="`/api/documentos/${exp.id}/archivos/${archivo.id}`"
                          target="_blank"
                          aria-label="Descargar archivo"
                        >
                          <q-tooltip>Descargar archivo</q-tooltip>
                        </q-btn>
                      </q-item-section>
                    </q-item>
                  </q-list>
                  <div v-else class="text-center text-grey-8 q-py-md">
                    <q-icon name="folder_open" size="48px" color="grey-8" />
                    <div class="text-caption q-mt-xs">No hay archivos registrados</div>
                  </div>
                </q-card-section>
              </q-expansion-item>
            </q-card>
          </template>

          <!-- Sin resultados -->
          <div
            v-else-if="busquedaRealizada && !errorBusqueda"
            class="text-center q-pa-xl text-grey-8"
          >
            <q-icon name="find_in_page" size="64px" color="grey-8" />
            <template v-if="esCliente && !terminoConsultado">
              <div class="text-h6 q-mt-sm">Todavía no hay documentos registrados a tu nombre</div>
              <div class="text-caption">
                Aparecerán aquí en cuanto el Grupo DCA reciba tu primera entrega.
              </div>
            </template>
            <template v-else>
              <div class="text-h6 q-mt-sm">No se encontró ningún documento con ese folio o RFC</div>
              <div class="text-caption">Revisa que el folio o el RFC estén bien escritos.</div>
            </template>
          </div>

          <!-- Estado inicial del personal; el Cliente ya está cargando lo suyo -->
          <div v-else-if="!busquedaRealizada && !esCliente" class="text-center q-pa-xl text-grey-8">
            <q-icon name="find_in_page" size="64px" color="grey-8" />
            <div class="text-h6 q-mt-sm">Escribe un folio o un RFC para ver el avance</div>
            <div class="text-caption">
              El folio viene impreso en el acuse que recibiste al entregar tus documentos.
            </div>
          </div>
        </div>
      </div>
    </SeccionAnimada>
  </q-page>
</template>

<script setup>
import SeccionAnimada from '@/modulos/documentos/components/SeccionAnimada.vue'
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useSesion } from '@/modulos/documentos/composables/sesion.js'
import { formatearPeriodo } from '@/modulos/documentos/composables/fechas'
import { estiloDeEstadoDocumento } from '@/modulos/documentos/composables/estadoDocumentoVista.js'
import {
  resumirSeguimiento,
  ordenarPorAtencion,
} from '@/modulos/documentos/composables/resumenSeguimiento.js'
import { obtenerSeguimiento } from '@/modulos/documentos/servicios/api.js'
import { textoRfc } from '@/modulos/documentos/composables/clientesVista.js'
import { mensajeParaUsuario } from '@/modulos/documentos/servicios/cliente.js'

const $q = useQuasar()
const sesion = useSesion()

const queryBusqueda = ref('')
const terminoConsultado = ref('')
const cargando = ref(false)
const busquedaRealizada = ref(false)
const expedientes = ref([])
const aviso = ref(null)
const errorBusqueda = ref(null)

// El Cliente ve lo suyo al entrar; el personal busca entre todos los clientes
const esCliente = computed(() => sesion.usuario.value?.rol === 'Cliente')
const titulo = computed(() => {
  const nombre = sesion.usuario.value?.nombre?.trim()
  return esCliente.value && nombre ? `Hola, ${nombre}` : 'Seguimiento de documentos'
})
const subtitulo = computed(() =>
  esCliente.value
    ? 'Así van los documentos que entregaste al Grupo DCA.'
    : 'Busca por folio o RFC para ver en qué va un trámite.',
)

const resumen = computed(() => resumirSeguimiento(expedientes.value))
const textoNecesitanAlgo = computed(() => {
  const una = resumen.value.necesitanAlgo === 1
  if (esCliente.value) return una ? 'necesita algo de ti' : 'necesitan algo de ti'
  return una ? 'espera al cliente' : 'esperan al cliente'
})

const fmtFechaHora = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const formatearFechaHora = (valor) => (valor ? fmtFechaHora.format(new Date(valor)) : '—')

/**
 * Color del punto de la línea de tiempo a partir del fondo del estado
 * (`bg-info` → `info`). El estado desconocido cae al primario.
 */
const colorDeFondo = (fondo) =>
  fondo.startsWith('bg-') && fondo !== 'bg-secondary-white-alternative' ? fondo.slice(3) : 'primary'

const iconoArchivo = (tipo) => ({ pdf: 'picture_as_pdf', xml: 'code' })[tipo] ?? 'insert_drive_file'

/** Traduce lo que manda el servidor a lo que se pinta: estado y hitos con etiqueta e icono. */
const aVista = (exp) => ({
  ...exp,
  estilo: estiloDeEstadoDocumento(exp.estado),
  hitos: (exp.hitos ?? []).map((hito) => {
    const estilo = estiloDeEstadoDocumento(hito.titulo)
    return {
      ...hito,
      etiqueta: estilo.etiqueta,
      icono: estilo.icono,
      color: colorDeFondo(estilo.fondo),
    }
  }),
  archivos: exp.archivos ?? [],
})

/** Pide los expedientes al servidor. Sin término, el Cliente recibe todos los suyos. */
const consultar = async (termino) => {
  if (cargando.value) return

  cargando.value = true
  aviso.value = null
  errorBusqueda.value = null
  expedientes.value = []

  try {
    const respuesta = await obtenerSeguimiento(termino)
    expedientes.value = ordenarPorAtencion((respuesta.expedientes ?? []).map(aVista))
    aviso.value = respuesta.aviso ?? null
  } catch (err) {
    errorBusqueda.value = mensajeParaUsuario(err, 'No se pudo consultar el seguimiento.')
  } finally {
    terminoConsultado.value = termino
    cargando.value = false
    busquedaRealizada.value = true
  }
}

const buscar = () => {
  const termino = queryBusqueda.value.trim()
  // Al personal, una búsqueda vacía le traería todos los clientes: se pide el dato
  if (!termino && !esCliente.value) {
    $q.notify({
      type: 'warning',
      message: 'Escribe un folio de acuse o un RFC.',
      position: 'top-right',
    })
    return
  }
  consultar(termino)
}

onMounted(() => {
  if (esCliente.value) consultar('')
})
</script>

<style scoped lang="scss">
/* Fondo de la página con un neutro de la paleta institucional */
/* Cabecera de cada expediente: neutro institucional */
:deep(.banda-folio) {
  background-color: $secondary-white-alternative;
}

/* Bloques del resumen por estado: el color solo en el que pide algo al cliente */
.bloque-resumen {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  color: $primary;
}

.bloque-neutro {
  background-color: $secondary-white-alternative;
}

.cifra {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  margin-right: 6px;
}

/* Chip del estado del expediente */
.chip-estado {
  font-weight: 700;
}

/* Quasar aplica `text-transform: uppercase` a los subtítulos del timeline */
:deep(.q-timeline__subtitle) {
  text-transform: none;
}
</style>
