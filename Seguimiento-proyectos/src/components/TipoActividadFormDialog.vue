<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="tipo-form-titulo"
    @show="enfocarPrimerCampo"
    @shake="pedirDescartar"
  >
    <q-card ref="tarjeta" class="tipo-form">
      <q-form
        class="tipo-form__form"
        novalidate
        aria-label="Formulario de tipo de actividad"
        @submit="guardar"
      >
        <q-card-section>
          <h2 id="tipo-form-titulo" class="tipo-form__title">
            {{ esEdicion ? 'Editar tipo de actividad' : 'Agregar tipo de actividad' }}
          </h2>
          <p class="tipo-form__help">
            Es un tipo tuyo (por ejemplo «Revisión de facturas»): solo tú lo ves. Los campos con *
            son obligatorios.
          </p>
        </q-card-section>

        <q-card-section class="tipo-form__body">
          <div class="form-group">
            <label for="tipo-nombre" class="form-label"
              >Nombre <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="tipo-nombre"
              v-model="form.nombre"
              type="text"
              placeholder="Nombre de la actividad"
              maxlength="121"
              autocomplete="off"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              aria-describedby="tipo-nombre-ayuda"
              :error="!!erroresCampo.nombre"
              :error-message="erroresCampo.nombre"
              @update:model-value="erroresCampo.nombre = null"
            >
              <template #prepend><q-icon name="task_alt" aria-hidden="true" /></template>
              <!-- Arriba del campo y sin error a la vista: abajo taparía el mensaje de error y la ayuda. -->
              <q-tooltip v-if="!erroresCampo.nombre" anchor="top middle" self="bottom middle">
                Nombre con el que reconocerás esta actividad cuando la registres.
              </q-tooltip>
            </q-input>
            <p id="tipo-nombre-ayuda" class="form-help">
              Máximo 120 caracteres. No puede repetir el nombre de otro tipo tuyo.
            </p>
          </div>

          <div class="form-group">
            <q-toggle
              v-model="form.cobrable"
              label="Cobrable"
              color="primary"
              class="control-touch"
              aria-describedby="tipo-cobrable-ayuda"
            >
              <q-tooltip>Actívalo si el tiempo de esta actividad se le cobra al cliente.</q-tooltip>
            </q-toggle>
            <p id="tipo-cobrable-ayuda" class="form-help">
              Indica si el tiempo de esta actividad se cobra al cliente. Por defecto no.
            </p>
          </div>

          <div class="form-group">
            <label for="tipo-vencimiento" class="form-label">Vencimiento</label>
            <q-select
              for="tipo-vencimiento"
              v-model="form.regla_vencimiento"
              :options="REGLAS_VENCIMIENTO"
              option-label="label"
              option-value="value"
              outlined
              dense
              options-dense
              dropdown-icon="expand_more"
              popup-content-class="menu-seleccion-custom"
              transition-show="jump-down"
              transition-hide="jump-up"
              :transition-duration="180"
              class="selector-moderno"
              emit-value
              map-options
              aria-describedby="tipo-vencimiento-ayuda"
              @popup-show="selectorAbierto = true"
              @popup-hide="selectorAbierto = false"
              @update:model-value="erroresCampo.dia_del_mes = null"
            >
              <template #prepend><q-icon name="event" aria-hidden="true" /></template>
              <!-- Con la lista abierta el tooltip taparía la primera opción. -->
              <q-tooltip v-if="!selectorAbierto"
                >Cuándo vence esta actividad cada mes. Se calcula dentro del mes de trabajo y, si
                cae en día inhábil, pasa al siguiente día hábil.</q-tooltip
              >
            </q-select>
            <p id="tipo-vencimiento-ayuda" class="form-help">
              {{ ayudaDeRegla }}
            </p>
          </div>

          <div v-if="form.regla_vencimiento === 'dia_del_mes'" class="form-group">
            <label for="tipo-dia" class="form-label"
              >Día del mes <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="tipo-dia"
              v-model="form.dia_del_mes"
              type="number"
              inputmode="numeric"
              min="1"
              max="28"
              placeholder="Del 1 al 28"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              aria-describedby="tipo-dia-ayuda"
              :error="!!erroresCampo.dia_del_mes"
              :error-message="erroresCampo.dia_del_mes"
              @update:model-value="erroresCampo.dia_del_mes = null"
            >
              <template #prepend><q-icon name="calendar_today" aria-hidden="true" /></template>
              <q-tooltip v-if="!erroresCampo.dia_del_mes" anchor="top middle" self="bottom middle">
                Día del mes en que vence la actividad, del 1 al 28.
              </q-tooltip>
            </q-input>
            <p id="tipo-dia-ayuda" class="form-help">
              Del 1 al 28. Para el último día del mes elige «Fin de mes».
            </p>
          </div>

          <p v-if="errorGeneral" class="error-banner" role="alert">{{ errorGeneral }}</p>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            flat
            no-caps
            label="Cancelar"
            color="primary"
            class="control-touch boton-presionable"
            :disable="guardando"
            @click="cerrar"
          >
            <q-tooltip>Cierra sin guardar.</q-tooltip>
          </q-btn>
          <q-btn
            type="submit"
            color="primary"
            :label="esEdicion ? 'Guardar cambios' : 'Agregar tipo'"
            :icon="esEdicion ? 'save' : 'playlist_add'"
            no-caps
            unelevated
            class="control-touch boton-presionable"
            :loading="guardando"
            :disable="guardando"
          >
            <q-tooltip>{{
              esEdicion ? 'Guarda los cambios de este tipo.' : 'Agrega el tipo a tu lista.'
            }}</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import { actualizarTipo, crearTipo } from '../services/tipoActividadService.js'
import { REGLAS_VENCIMIENTO, validarDatosTipo } from '../utils/actividades.js'

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  /** Tipo que se edita; null para agregar uno nuevo. */
  tipo: { type: Object, default: null },
})

const emit = defineEmits(['guardado'])

const $q = useQuasar()
const tarjeta = ref(null)
const esEdicion = computed(() => props.tipo !== null)

const form = reactive({
  nombre: '',
  cobrable: false,
  regla_vencimiento: 'ninguna',
  dia_del_mes: '',
})
const erroresCampo = reactive({ nombre: null, dia_del_mes: null })
const errorGeneral = ref('')
const guardando = ref(false)
const selectorAbierto = ref(false)

// Lo que había al abrir: sirve para saber si hay algo sin guardar (también al editar).
const inicial = reactive({
  nombre: '',
  cobrable: false,
  regla_vencimiento: 'ninguna',
  dia_del_mes: '',
})

// El día solo cuenta con «Día fijo del mes»: con otra regla escribirlo no es un cambio.
const diaDe = (datos) =>
  datos.regla_vencimiento === 'dia_del_mes' ? String(datos.dia_del_mes ?? '') : ''

const hayDatosSinGuardar = computed(
  () =>
    form.nombre.trim() !== inicial.nombre ||
    form.cobrable !== inicial.cobrable ||
    form.regla_vencimiento !== inicial.regla_vencimiento ||
    diaDe(form) !== diaDe(inicial),
)

const AYUDAS_DE_REGLA = {
  ninguna: 'La actividad no tiene fecha de vencimiento. Es la opción por defecto.',
  dia_del_mes:
    'Vence el día del mes que elijas. Si cae en día inhábil, pasa al siguiente día hábil.',
  fin_de_mes: 'Vence el último día del mes. Si es inhábil, pasa al siguiente día hábil.',
  dia_17_rfc:
    'Vence el día 17 más días hábiles según el sexto dígito del RFC del cliente. Si el cliente no tiene RFC, no hay fecha.',
}
const ayudaDeRegla = computed(() => AYUDAS_DE_REGLA[form.regla_vencimiento])

const DIALOGO = {
  transitionShow: 'dialogo-entra',
  transitionHide: 'dialogo-sale',
  transitionDuration: 220,
}

// Esc, clic fuera o «Cancelar» con cambios: se pregunta antes de perderlos.
const pedirDescartar = () => {
  if (guardando.value) return
  $q.dialog({
    ...DIALOGO,
    title: '¿Descartar los cambios?',
    message: 'Lo que escribiste en este formulario se perderá.',
    cancel: {
      label: 'Seguir editando',
      flat: true,
      noCaps: true,
      class: 'control-touch boton-presionable',
    },
    ok: {
      label: 'Descartar',
      color: 'dg-error',
      noCaps: true,
      unelevated: true,
      class: 'control-touch boton-presionable',
    },
    focus: 'cancel',
  }).onOk(() => {
    dialogoAbierto.value = false
  })
}

const cerrar = () => {
  if (guardando.value) return
  if (hayDatosSinGuardar.value) pedirDescartar()
  else dialogoAbierto.value = false
}

const enfocarPrimerCampo = () => {
  nextTick(() => document.getElementById('tipo-nombre')?.focus())
}

/** Lleva la vista y el foco al primer campo con error (en celular puede estar fuera de la pantalla). */
const enfocarPrimerError = () =>
  nextTick(() => {
    const campo = tarjeta.value?.$el?.querySelector('.q-field--error')
    if (!campo) return
    campo.scrollIntoView({ block: 'center' })
    campo.querySelector('input, textarea, [tabindex="0"]')?.focus({ preventScroll: true })
  })

// Cada apertura empieza con los datos del tipo (o vacía) y sin errores de la vez anterior.
watch(dialogoAbierto, (abierto) => {
  if (!abierto) return
  form.nombre = props.tipo?.nombre ?? ''
  form.cobrable = props.tipo?.cobrable ?? false
  form.regla_vencimiento = props.tipo?.regla_vencimiento ?? 'ninguna'
  form.dia_del_mes = props.tipo?.dia_del_mes ?? ''
  inicial.nombre = form.nombre.trim()
  inicial.cobrable = form.cobrable
  inicial.regla_vencimiento = form.regla_vencimiento
  inicial.dia_del_mes = form.dia_del_mes
  erroresCampo.nombre = null
  erroresCampo.dia_del_mes = null
  errorGeneral.value = ''
})

const guardar = async () => {
  if (guardando.value) return
  errorGeneral.value = ''

  const validacion = validarDatosTipo(form)
  erroresCampo.nombre = validacion.errores.nombre ?? null
  erroresCampo.dia_del_mes = validacion.errores.dia_del_mes ?? null
  if (!validacion.valido) {
    enfocarPrimerError()
    return
  }

  guardando.value = true
  try {
    const datos = {
      nombre: form.nombre,
      cobrable: form.cobrable,
      regla_vencimiento: form.regla_vencimiento,
    }
    if (form.regla_vencimiento === 'dia_del_mes') datos.dia_del_mes = Number(form.dia_del_mes)
    const tipo = esEdicion.value
      ? await actualizarTipo(props.tipo.id, datos)
      : await crearTipo(datos)
    dialogoAbierto.value = false
    emit('guardado', tipo, esEdicion.value)
  } catch (error) {
    // El nombre repetido va bajo «Nombre»; cualquier otro error, al aviso general.
    if (error?.codigoHttp === 409 || /ya existe/i.test(error?.mensaje ?? '')) {
      erroresCampo.nombre =
        'Ya existe un tipo tuyo con ese nombre. Usa otro o edita el que ya tienes.'
      enfocarPrimerError()
    } else {
      errorGeneral.value =
        error?.mensaje ?? 'No se pudo guardar el tipo de actividad. Intenta de nuevo.'
    }
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.tipo-form {
  width: 100%;
  max-width: 480px;
  min-width: 0;
}

.tipo-form__form,
.tipo-form__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.tipo-form__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.tipo-form__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

/* .form-group, .form-label, .required-mark, .form-help y .error-banner viven en app.scss. */
</style>
