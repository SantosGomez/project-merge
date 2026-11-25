<template>
  <q-dialog
    v-model="dialogoAbierto"
    :maximized="$q.screen.lt.sm"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="doc-expediente-titulo"
    @before-show="cargar"
    @hide="vaciar"
  >
    <q-card
      class="expediente-dialog column no-wrap"
      :class="{ 'expediente-dialog--ajustado': !$q.screen.lt.sm }"
    >
      <q-card-section class="row items-start no-wrap q-pb-sm">
        <div class="col">
          <div id="doc-expediente-titulo" class="text-h6 text-weight-bold text-primary">
            Expediente del cliente
          </div>
          <div class="text-caption text-grey-8">
            Datos del cliente y sus recepciones más recientes. Es una consulta: para corregir datos
            usa «Editar».
          </div>
        </div>
        <q-btn
          v-close-popup
          flat
          round
          dense
          icon="close"
          color="primary"
          class="control-touch"
          aria-label="Cerrar expediente"
        >
          <q-tooltip>Cerrar expediente</q-tooltip>
        </q-btn>
      </q-card-section>

      <q-separator />

      <q-card-section class="col scroll">
        <div v-if="cargando" class="row justify-center q-pa-lg">
          <q-spinner color="primary" size="32px" aria-label="Cargando expediente" />
        </div>

        <q-banner v-else-if="error" class="bg-negative text-white rounded-borders" role="alert">
          {{ error }}
        </q-banner>

        <template v-else-if="expediente">
          <q-list separator class="datos-cliente">
            <q-item v-for="dato in datos" :key="dato.etiqueta">
              <q-item-section avatar>
                <q-icon :name="dato.icono" color="primary" aria-hidden="true" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption>{{ dato.etiqueta }}</q-item-label>
                <q-item-label class="texto-largo">
                  <q-badge
                    v-if="dato.etiqueta === 'Estado'"
                    :color="expediente.cliente.activo ? 'positive' : 'grey-8'"
                    :label="dato.valor"
                  />
                  <template v-else>{{ dato.valor }}</template>
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div class="row items-center justify-between q-mt-md q-mb-xs">
            <div class="text-subtitle1 text-weight-bold text-grey-9">Recepciones</div>
            <div class="text-caption text-grey-8">
              {{ textoTotalRecepciones }}
            </div>
          </div>

          <div
            v-if="expediente.recepciones.length === 0"
            class="text-grey-8 q-pa-md text-center rounded-borders sin-recepciones"
          >
            Este cliente aún no tiene recepciones registradas.
          </div>
          <q-list v-else separator bordered class="rounded-borders">
            <q-item v-for="recepcion in recepciones" :key="recepcion.id">
              <q-item-section>
                <q-item-label class="text-weight-medium texto-largo">
                  {{ recepcion.folio }} · {{ recepcion.tipo }}
                </q-item-label>
                <q-item-label caption>
                  Periodo {{ recepcion.periodoTexto }} · Recibido el {{ recepcion.fechaTexto }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-chip dense :icon="recepcion.estilo.icono" :class="recepcion.estilo.chip">
                  {{ recepcion.estilo.etiqueta }}
                </q-chip>
              </q-item-section>
            </q-item>
          </q-list>
        </template>
      </q-card-section>

      <q-separator />

      <q-card-actions align="right" class="q-pa-md">
        <q-btn
          v-if="puedeEditar && expediente"
          unelevated
          no-caps
          color="primary"
          icon="edit"
          label="Editar"
          class="control-touch boton-presionable"
          @click="dialogoEditar = true"
        >
          <q-tooltip>Corregir los datos de este cliente</q-tooltip>
        </q-btn>
        <q-btn
          v-close-popup
          flat
          no-caps
          color="primary"
          label="Cerrar"
          class="control-touch boton-presionable"
        >
          <q-tooltip>Cierra el expediente</q-tooltip>
        </q-btn>
      </q-card-actions>
    </q-card>

    <NuevoClienteDialog
      v-if="expediente"
      v-model="dialogoEditar"
      :cliente="expediente.cliente"
      @guardado="alGuardar"
    />
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import NuevoClienteDialog from '@/modulos/documentos/components/NuevoClienteDialog.vue'
import { obtenerExpedienteCliente } from '@/modulos/documentos/servicios/api.js'
import { mensajeParaUsuario } from '@/modulos/documentos/servicios/cliente.js'
import { estiloDeEstadoDocumento } from '@/modulos/documentos/composables/estadoDocumentoVista.js'
import { formatearFecha, formatearPeriodo } from '@/modulos/documentos/composables/fechas.js'
import { useSesion } from '@/modulos/documentos/composables/sesion.js'
import { hayAcceso } from '@/modulos/documentos/permisos.js'

const props = defineProps({
  // Id del cliente cuyo expediente se consulta.
  clienteId: { type: Number, default: null },
})
const dialogoAbierto = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['actualizado'])

const $q = useQuasar()
const sesion = useSesion()
const puedeEditar = computed(() => hayAcceso(sesion.usuario.value?.rol, 'crear_cliente'))

const expediente = ref(null)
const cargando = ref(false)
const error = ref('')
const dialogoEditar = ref(false)

const SIN_CAPTURAR = 'Sin capturar'

const datos = computed(() => {
  const c = expediente.value?.cliente
  if (!c) return []
  return [
    { etiqueta: 'Razón social', icono: 'business', valor: c.razonSocial },
    { etiqueta: 'Clave de carpeta', icono: 'folder_shared', valor: c.clave || SIN_CAPTURAR },
    { etiqueta: 'RFC', icono: 'badge', valor: c.rfc || SIN_CAPTURAR },
    { etiqueta: 'Correo', icono: 'mail', valor: c.email || SIN_CAPTURAR },
    { etiqueta: 'Teléfono', icono: 'phone', valor: c.telefono || SIN_CAPTURAR },
    { etiqueta: 'Contador asignado', icono: 'person', valor: c.contador || SIN_CAPTURAR },
    { etiqueta: 'Estado', icono: 'toggle_on', valor: c.activo ? 'Activo' : 'Inactivo' },
    {
      etiqueta: 'Fecha de alta',
      icono: 'event',
      valor: c.creadoEn ? formatearFecha(c.creadoEn.slice(0, 10)) : SIN_CAPTURAR,
    },
  ]
})

const recepciones = computed(() =>
  (expediente.value?.recepciones ?? []).map((r) => ({
    ...r,
    estilo: estiloDeEstadoDocumento(r.estado),
    periodoTexto: formatearPeriodo(r.periodo),
    fechaTexto: formatearFecha(r.fechaRecepcion.slice(0, 10)),
  })),
)

const textoTotalRecepciones = computed(() => {
  const total = expediente.value?.totalRecepciones ?? 0
  const mostradas = expediente.value?.recepciones.length ?? 0
  if (total === 0) return 'Sin recepciones'
  const plural = total === 1 ? 'recepción' : 'recepciones'
  return total > mostradas
    ? `${total} ${plural} en total · se muestran las ${mostradas} más recientes`
    : `${total} ${plural} en total`
})

// Sin esto, al abrir otro cliente se vería un instante la ficha del anterior.
function vaciar() {
  expediente.value = null
  error.value = ''
}

watch(
  () => props.clienteId,
  () => vaciar(),
)

async function cargar() {
  if (props.clienteId === null) return
  cargando.value = true
  error.value = ''
  try {
    expediente.value = await obtenerExpedienteCliente(props.clienteId)
  } catch (err) {
    expediente.value = null
    error.value = mensajeParaUsuario(err, 'No se pudo cargar el expediente del cliente.')
  } finally {
    cargando.value = false
  }
}

async function alGuardar() {
  $q.notify({ type: 'positive', message: 'Cambios guardados', position: 'top-right' })
  await cargar()
  emit('actualizado')
}
</script>

<style scoped lang="scss">
.expediente-dialog {
  width: 100%;
  max-width: 640px;
  border-radius: 12px;
}

/* En pantalla completa (celular) no se limita el alto */
.expediente-dialog--ajustado {
  max-height: 90vh;
}

/* Textos largos: se parten en vez de desbordar la ficha en pantallas angostas */
.texto-largo {
  overflow-wrap: anywhere;
}
</style>
