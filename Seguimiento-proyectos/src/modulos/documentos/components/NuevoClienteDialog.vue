<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="doc-nuevo-cliente-titulo"
    @show="alAbrir"
    @shake="pedirDescartar"
  >
    <q-card class="nuevo-cliente-dialog">
      <q-form novalidate aria-label="Formulario de nuevo cliente" @submit.prevent="guardar">
        <q-card-section class="q-pb-sm">
          <div id="doc-nuevo-cliente-titulo" class="text-h6 text-weight-bold text-primary">
            Nuevo cliente
          </div>
          <div class="text-caption text-grey-8">
            Registra un cliente en el catálogo del despacho. Los campos con * son obligatorios.
          </div>
        </q-card-section>

        <q-card-section class="q-gutter-y-sm">
          <div>
            <label for="doc-cliente-razon-social" class="text-weight-medium text-grey-9">
              Razón social o nombre <span aria-hidden="true" class="text-negative">*</span>
            </label>
            <q-input
              id="doc-cliente-razon-social"
              ref="campoPrincipal"
              v-model="form.razonSocial"
              dense
              outlined
              maxlength="150"
              autocomplete="off"
              placeholder="Ej. Comercializadora del Norte S.A. de C.V."
              aria-required="true"
              :error="!!errores.razonSocial"
              :error-message="errores.razonSocial"
              @update:model-value="errores.razonSocial = null"
            >
              <template #prepend>
                <q-icon name="business" aria-hidden="true" />
              </template>
              <q-tooltip v-if="!errores.razonSocial" anchor="top middle" self="bottom middle">
                Nombre o razón social completo del cliente (máximo 150 caracteres).
              </q-tooltip>
            </q-input>
          </div>

          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-5">
              <label for="doc-cliente-clave" class="text-weight-medium text-grey-9">
                Clave de carpeta (opcional)
              </label>
              <q-input
                id="doc-cliente-clave"
                v-model="form.clave"
                dense
                outlined
                maxlength="4"
                autocomplete="off"
                placeholder="Ej. 0001"
                :error="!!errores.clave"
                :error-message="errores.clave"
                @update:model-value="errores.clave = null"
              >
                <template #prepend>
                  <q-icon name="folder_shared" aria-hidden="true" />
                </template>
                <q-tooltip v-if="!errores.clave" anchor="top middle" self="bottom middle">
                  Clave corta de hasta 4 caracteres para identificar su carpeta.
                </q-tooltip>
              </q-input>
            </div>

            <div class="col-12 col-sm-7">
              <label for="doc-cliente-rfc" class="text-weight-medium text-grey-9">
                RFC (opcional)
              </label>
              <q-input
                id="doc-cliente-rfc"
                v-model="form.rfc"
                dense
                outlined
                maxlength="13"
                autocomplete="off"
                placeholder="ABC010101XY1"
                input-class="text-uppercase"
                :error="!!errores.rfc"
                :error-message="errores.rfc"
                @update:model-value="errores.rfc = null"
              >
                <template #prepend>
                  <q-icon name="badge" aria-hidden="true" />
                </template>
                <q-tooltip v-if="!errores.rfc" anchor="top middle" self="bottom middle">
                  12 caracteres (empresa) o 13 (persona física). Se guarda en mayúsculas.
                </q-tooltip>
              </q-input>
            </div>
          </div>

          <div>
            <label for="doc-cliente-contador" class="text-weight-medium text-grey-9">
              Contador asignado (opcional)
            </label>
            <q-select
              id="doc-cliente-contador"
              v-model="form.contadorId"
              :options="opcionesContadores"
              emit-value
              map-options
              clearable
              dense
              outlined
              options-dense
              dropdown-icon="expand_more"
              popup-content-class="menu-seleccion-custom"
              transition-show="jump-down"
              transition-hide="jump-up"
              :loading="cargandoContadores"
              placeholder="Sin asignar"
              class="selector-moderno"
            >
              <template #prepend>
                <q-icon name="person" aria-hidden="true" />
              </template>
              <template #no-option>
                <q-item>
                  <q-item-section class="text-grey-8">
                    No hay contadores con acceso al módulo de documentos.
                  </q-item-section>
                </q-item>
              </template>
              <q-tooltip anchor="top middle" self="bottom middle">
                Contador responsable de este cliente en el despacho.
              </q-tooltip>
            </q-select>
          </div>

          <div class="row q-col-gutter-sm">
            <div class="col-12 col-sm-6">
              <label for="doc-cliente-email" class="text-weight-medium text-grey-9">
                Correo electrónico (opcional)
              </label>
              <q-input
                id="doc-cliente-email"
                v-model="form.email"
                type="email"
                dense
                outlined
                maxlength="150"
                autocomplete="off"
                placeholder="contacto@empresa.com"
                :error="!!errores.email"
                :error-message="errores.email"
                @update:model-value="errores.email = null"
              >
                <template #prepend>
                  <q-icon name="mail" aria-hidden="true" />
                </template>
                <q-tooltip v-if="!errores.email" anchor="top middle" self="bottom middle">
                  Correo de contacto para avisos y recordatorios.
                </q-tooltip>
              </q-input>
            </div>

            <div class="col-12 col-sm-6">
              <label for="doc-cliente-telefono" class="text-weight-medium text-grey-9">
                Teléfono (opcional)
              </label>
              <q-input
                id="doc-cliente-telefono"
                v-model="form.telefono"
                type="tel"
                dense
                outlined
                maxlength="20"
                autocomplete="off"
                placeholder="55 1234 5678"
                :error="!!errores.telefono"
                :error-message="errores.telefono"
                @update:model-value="errores.telefono = null"
              >
                <template #prepend>
                  <q-icon name="phone" aria-hidden="true" />
                </template>
                <q-tooltip v-if="!errores.telefono" anchor="top middle" self="bottom middle">
                  Número telefónico de contacto del cliente.
                </q-tooltip>
              </q-input>
            </div>
          </div>

          <q-banner v-if="errorGeneral" class="bg-negative text-white rounded-borders" role="alert">
            {{ errorGeneral }}
          </q-banner>
        </q-card-section>

        <q-card-actions align="right" class="q-px-md q-pb-md">
          <q-btn
            flat
            no-caps
            label="Cancelar"
            color="primary"
            class="control-touch boton-presionable"
            :disable="guardando"
            @click="cerrar"
          >
            <q-tooltip>Cierra el formulario sin guardar</q-tooltip>
          </q-btn>
          <q-btn
            type="submit"
            color="primary"
            icon="person_add"
            label="Guardar cliente"
            no-caps
            unelevated
            class="control-touch boton-presionable"
            :loading="guardando"
            :disable="guardando"
          >
            <q-tooltip>Registra el nuevo cliente en el directorio</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { crearClienteDocumento, obtenerCatalogos } from '@/modulos/documentos/servicios/api.js'
import { mensajeParaUsuario } from '@/modulos/documentos/servicios/cliente.js'
import { normalizarRfc } from '@/modulos/documentos/logica/normalizar.js'

const REGEX_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const dialogoAbierto = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['guardado'])

const $q = useQuasar()
const campoPrincipal = ref(null)
const guardando = ref(false)
const cargandoContadores = ref(false)
const opcionesContadores = ref([])
const errorGeneral = ref('')

const form = reactive({
  razonSocial: '',
  clave: '',
  rfc: '',
  contadorId: null,
  email: '',
  telefono: '',
})

const errores = reactive({
  razonSocial: null,
  clave: null,
  rfc: null,
  email: null,
  telefono: null,
})

const hayDatosSinGuardar = computed(
  () =>
    form.razonSocial.trim() !== '' ||
    form.clave.trim() !== '' ||
    form.rfc.trim() !== '' ||
    form.contadorId !== null ||
    form.email.trim() !== '' ||
    form.telefono.trim() !== '',
)

function limpiarFormulario() {
  form.razonSocial = ''
  form.clave = ''
  form.rfc = ''
  form.contadorId = null
  form.email = ''
  form.telefono = ''
  errores.razonSocial = null
  errores.clave = null
  errores.rfc = null
  errores.email = null
  errores.telefono = null
  errorGeneral.value = ''
}

async function cargarContadores() {
  cargandoContadores.value = true
  try {
    const res = await obtenerCatalogos()
    opcionesContadores.value = (res.contadores || []).map((c) => ({
      value: c.id,
      label: c.nombre,
    }))
  } catch {
    opcionesContadores.value = []
  } finally {
    cargandoContadores.value = false
  }
}

async function alAbrir() {
  limpiarFormulario()
  cargarContadores()
  await nextTick()
  campoPrincipal.value?.focus()
}

function cerrar() {
  if (guardando.value) return
  if (hayDatosSinGuardar.value) {
    pedirDescartar()
    return
  }
  dialogoAbierto.value = false
}

function pedirDescartar() {
  if (guardando.value) return
  $q.dialog({
    title: '¿Descartar los cambios?',
    message: 'Si cierras ahora se perderán los datos que escribiste para el cliente.',
    cancel: { label: 'Seguir editando', flat: true, noCaps: true, color: 'primary' },
    ok: { label: 'Descartar', flat: true, noCaps: true, color: 'negative' },
    persistent: true,
  }).onOk(() => {
    limpiarFormulario()
    dialogoAbierto.value = false
  })
}

function validarFormulario() {
  let valido = true
  errores.razonSocial = null
  errores.clave = null
  errores.rfc = null
  errores.email = null
  errores.telefono = null
  errorGeneral.value = ''

  const razonSocial = form.razonSocial.trim()
  if (!razonSocial) {
    errores.razonSocial = 'Escribe la razón social o el nombre del cliente.'
    valido = false
  } else if (razonSocial.length > 150) {
    errores.razonSocial = 'La razón social no puede superar los 150 caracteres.'
    valido = false
  }

  const clave = form.clave.trim()
  if (clave && (clave.length > 4 || /\s/.test(clave))) {
    errores.clave = 'Máximo 4 caracteres sin espacios.'
    valido = false
  }

  const rfcLimpio = normalizarRfc(form.rfc)
  if (rfcLimpio && !REGEX_RFC.test(rfcLimpio)) {
    errores.rfc = 'Debe tener 12 o 13 caracteres válidos (ej. ABC010101XY1).'
    valido = false
  }

  const email = form.email.trim()
  if (email && (email.length > 150 || !REGEX_EMAIL.test(email))) {
    errores.email = 'Escribe un correo electrónico válido.'
    valido = false
  }

  const telefono = form.telefono.trim()
  if (telefono && telefono.length > 20) {
    errores.telefono = 'Máximo 20 caracteres.'
    valido = false
  }

  return valido
}

async function guardar() {
  if (guardando.value || !validarFormulario()) return
  guardando.value = true
  errorGeneral.value = ''
  try {
    const payload = {
      razonSocial: form.razonSocial.trim(),
      clave: form.clave.trim() ? form.clave.trim().toUpperCase() : null,
      rfc: normalizarRfc(form.rfc) || null,
      contadorId: form.contadorId || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
    }
    const respuesta = await crearClienteDocumento(payload)
    limpiarFormulario()
    dialogoAbierto.value = false
    emit('guardado', respuesta.cliente)
  } catch (err) {
    errorGeneral.value = mensajeParaUsuario(err, 'No se pudo registrar el cliente.')
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped lang="scss">
.nuevo-cliente-dialog {
  width: 100%;
  max-width: 560px;
  border-radius: 12px;
}
</style>
