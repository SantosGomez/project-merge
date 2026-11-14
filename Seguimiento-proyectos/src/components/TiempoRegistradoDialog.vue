<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="tiempo-titulo"
    @show="enfocarCampo"
    @shake="pedirDescartar"
    @hide="emit('hide')"
  >
    <q-card ref="tarjeta" class="tiempo-dialogo">
      <q-card-section>
        <h2 id="tiempo-titulo" class="tiempo-dialogo__titulo">Tiempo registrado</h2>
        <p class="tiempo-dialogo__subtitulo">
          {{ renglon.cliente }} · {{ renglon.tipo }} · {{ etiquetaDeMes(mes) }}
        </p>
        <p class="tiempo-dialogo__total">
          Total: <strong>{{ formatearDuracion(totalMinutos) }}</strong>
          <q-tooltip>Suma de todos los bloques terminados de este renglón en este mes.</q-tooltip>
        </p>
      </q-card-section>

      <q-separator />

      <q-card-section class="tiempo-dialogo__bloques">
        <ScreenLoader v-if="cargando" text="Cargando el tiempo registrado…" />

        <ErrorState v-else-if="errorCarga" :detail="errorCarga.mensaje" @retry="cargar()" />

        <p v-else-if="bloques.length === 0" class="tiempo-dialogo__vacio">
          Todavía no hay tiempo registrado en este renglón. Inicia el cronómetro o agrega minutos a
          mano aquí abajo.
        </p>

        <q-list v-else separator class="tiempo-dialogo__lista" aria-label="Bloques de tiempo">
          <q-item v-for="bloque in bloques" :key="bloque.id" class="tiempo-dialogo__fila">
            <q-item-section class="tiempo-dialogo__datos">
              <q-item-label class="tiempo-dialogo__minutos">
                {{ formatearDuracion(bloque.minutos) }}
                <q-badge
                  v-if="bloque.manual"
                  outline
                  color="dg-texto-tenue"
                  label="A mano"
                  class="tiempo-dialogo__etiqueta"
                >
                  <q-tooltip
                    >Tiempo que agregaste a mano; la hora de inicio es aproximada.</q-tooltip
                  >
                </q-badge>
              </q-item-label>
              <q-item-label caption>
                {{ fechaParaFormulario(bloque.fin.slice(0, 10)) }} · de
                {{ bloque.inicio.slice(11, 16) }} a {{ bloque.fin.slice(11, 16) }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                round
                dense
                icon="delete_outline"
                color="dg-error"
                class="control-touch boton-presionable"
                :disable="borrandoId === bloque.id || guardando"
                :loading="borrandoId === bloque.id"
                :aria-label="`Borrar el bloque de ${formatearDuracion(bloque.minutos)} del ${fechaParaFormulario(bloque.fin.slice(0, 10))}`"
                @click="confirmarBorrado(bloque)"
              >
                <q-tooltip>Borra este bloque de tiempo. Te pediremos confirmar.</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-separator />

      <q-form
        class="tiempo-dialogo__formulario"
        novalidate
        aria-label="Agregar tiempo a mano"
        @submit="agregar"
      >
        <q-card-section class="tiempo-dialogo__campo">
          <div class="form-group">
            <label for="tiempo-minutos" class="form-label"
              >Agregar tiempo a mano (minutos)
              <span aria-hidden="true" class="required-mark">*</span></label
            >
            <div class="tiempo-dialogo__entrada">
              <q-input
                v-model="minutos"
                for="tiempo-minutos"
                type="number"
                min="1"
                max="1440"
                step="1"
                inputmode="numeric"
                placeholder="Ejemplo: 30"
                outlined
                dense
                class="input-moderno tiempo-dialogo__input"
                aria-required="true"
                aria-describedby="tiempo-minutos-ayuda"
                :error="!!erroresCampo.minutos"
                :error-message="erroresCampo.minutos"
                :disable="guardando"
                @update:model-value="erroresCampo.minutos = null"
              >
                <template #prepend><q-icon name="timer" aria-hidden="true" /></template>
                <!-- Arriba del campo y sin error a la vista: abajo taparía el mensaje de error y la ayuda. -->
                <q-tooltip v-if="!erroresCampo.minutos" anchor="top middle" self="bottom middle">
                  Minutos de trabajo que quieres sumar a este renglón.
                </q-tooltip>
              </q-input>
              <q-btn
                type="submit"
                unelevated
                no-caps
                color="primary"
                icon="add"
                label="Agregar tiempo"
                class="control-touch boton-presionable"
                :loading="guardando"
                :disable="guardando"
              >
                <q-tooltip>Suma estos minutos como un bloque nuevo de este renglón.</q-tooltip>
              </q-btn>
            </div>
            <p id="tiempo-minutos-ayuda" class="form-help">
              De 1 a 1440 minutos (un día completo). Se guarda como un bloque más y lo puedes borrar
              después.
            </p>
          </div>
          <p v-if="errorGeneral" class="error-banner" role="alert">{{ errorGeneral }}</p>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            flat
            no-caps
            label="Cerrar"
            color="primary"
            class="control-touch boton-presionable"
            :disable="guardando"
            @click="cerrar"
          >
            <q-tooltip>Cierra esta ventana.</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'

import ErrorState from './ErrorState.vue'
import ScreenLoader from './ScreenLoader.vue'
import { agregarManual, borrarBloque, listarBloques } from '../services/tiempoService.js'
import { useCronometroStore } from '../stores/cronometro.js'
import { etiquetaDeMes, formatearDuracion, validarMinutosManual } from '../utils/actividades.js'
import { fechaParaFormulario } from '../utils/fechasCaso.js'

/*
 * «Tiempo registrado» de un renglón: sus bloques de tiempo del mes (fecha, inicio, fin y minutos), con
 * agregar tiempo a mano (1 a 1440 minutos) y borrar un bloque con confirmación. Cada cambio avisa al
 * store del cronómetro para que la lista y el calendario se actualicen.
 */
const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  /** Renglón (`cliente_id`, `tipo_id`, `cliente`, `tipo`). */
  renglon: { type: Object, required: true },
  /** Mes del renglón (AAAA-MM). */
  mes: { type: String, required: true },
})

const emit = defineEmits(['hide'])

const $q = useQuasar()
const cronometro = useCronometroStore()
const tarjeta = ref(null)

const bloques = ref([])
const cargando = ref(true)
const errorCarga = ref(null)
const minutos = ref('')
const erroresCampo = reactive({ minutos: null })
const errorGeneral = ref('')
const guardando = ref(false)
const borrandoId = ref(null)

const hayDatosSinGuardar = computed(() => String(minutos.value ?? '').trim() !== '')
const totalMinutos = computed(() => bloques.value.reduce((suma, b) => suma + b.minutos, 0))

const DIALOGO = {
  transitionShow: 'dialogo-entra',
  transitionHide: 'dialogo-sale',
  transitionDuration: 220,
}

const renglonActual = () => ({
  cliente_id: props.renglon.cliente_id,
  tipo_id: props.renglon.tipo_id,
  mes: props.mes,
})

const cargar = async () => {
  cargando.value = true
  errorCarga.value = null
  try {
    bloques.value = await listarBloques(renglonActual())
  } catch (error) {
    errorCarga.value = error
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

// Esc, clic fuera o «Cerrar» con minutos escritos sin agregar: se pregunta antes de perderlos.
const pedirDescartar = () => {
  if (guardando.value) return
  $q.dialog({
    ...DIALOGO,
    title: '¿Descartar los cambios?',
    message: 'Los minutos que escribiste y no agregaste se perderán.',
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
    minutos.value = ''
    dialogoAbierto.value = false
  })
}

const cerrar = () => {
  if (guardando.value) return
  if (hayDatosSinGuardar.value) pedirDescartar()
  else dialogoAbierto.value = false
}

const enfocarCampo = () => {
  nextTick(() => document.getElementById('tiempo-minutos')?.focus())
}

/** Lleva la vista y el foco al campo con error (en celular puede estar fuera de la pantalla). */
const enfocarPrimerError = () =>
  nextTick(() => {
    const campo = tarjeta.value?.$el?.querySelector('.q-field--error')
    if (!campo) return
    campo.scrollIntoView({ block: 'center' })
    campo.querySelector('input, textarea')?.focus({ preventScroll: true })
  })

const agregar = async () => {
  if (guardando.value) return
  errorGeneral.value = ''
  const validacion = validarMinutosManual(minutos.value)
  erroresCampo.minutos = validacion.valido ? null : validacion.error
  if (!validacion.valido) {
    enfocarPrimerError()
    return
  }
  guardando.value = true
  try {
    await agregarManual({ ...renglonActual(), minutos: validacion.minutos })
    minutos.value = ''
    await cargar()
    cronometro.registrarCambio()
    $q.notify({
      type: 'positive',
      message: `Se agregaron ${formatearDuracion(validacion.minutos)} a «${props.renglon.cliente}», ${props.renglon.tipo}.`,
      timeout: 4000,
    })
  } catch (error) {
    errorGeneral.value = error?.mensaje ?? 'No se pudo agregar el tiempo. Intenta de nuevo.'
  } finally {
    guardando.value = false
  }
}

const borrar = async (bloque) => {
  borrandoId.value = bloque.id
  try {
    await borrarBloque(bloque.id)
    await cargar()
    cronometro.registrarCambio()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'No se pudo borrar el bloque de tiempo. Sigue en la lista.',
      caption: error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
    })
  } finally {
    borrandoId.value = null
  }
}

const confirmarBorrado = (bloque) => {
  $q.dialog({
    ...DIALOGO,
    title: '¿Borrar este bloque de tiempo?',
    message: `Se borrarán ${formatearDuracion(bloque.minutos)} del ${fechaParaFormulario(bloque.fin.slice(0, 10))} de «${props.renglon.cliente}», ${props.renglon.tipo}. No se puede deshacer.`,
    cancel: {
      label: 'Cancelar',
      flat: true,
      noCaps: true,
      class: 'control-touch boton-presionable',
    },
    ok: {
      label: 'Borrar bloque',
      color: 'dg-error',
      noCaps: true,
      unelevated: true,
      class: 'control-touch boton-presionable',
    },
    focus: 'cancel',
  }).onOk(() => borrar(bloque))
}
</script>

<style scoped>
.tiempo-dialogo {
  width: 100%;
  max-width: 520px;
  min-width: 0;
}

.tiempo-dialogo__titulo {
  margin: 0 0 4px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.tiempo-dialogo__subtitulo {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.tiempo-dialogo__total {
  margin: 8px 0 0;
  color: var(--dg-texto);
  cursor: help;
}

.tiempo-dialogo__bloques {
  max-height: 40vh;
  overflow-y: auto;
}

.tiempo-dialogo__vacio {
  margin: 0;
  color: var(--dg-texto-secundario);
}

.tiempo-dialogo__fila {
  padding-left: 0;
  padding-right: 0;
}

.tiempo-dialogo__datos {
  min-width: 0;
}

.tiempo-dialogo__minutos {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dg-texto);
  font-weight: 600;
}

.tiempo-dialogo__etiqueta {
  padding: 2px 8px;
  font-size: 0.75rem;
}

.tiempo-dialogo__formulario {
  min-width: 0;
}

.tiempo-dialogo__campo {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tiempo-dialogo__entrada {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}

.tiempo-dialogo__input {
  flex: 1 1 160px;
  min-width: 0;
}

/* .form-group, .form-label, .required-mark, .form-help y .error-banner viven en app.scss. */
</style>
