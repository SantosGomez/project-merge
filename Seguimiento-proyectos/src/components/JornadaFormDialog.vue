<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="jornada-form-titulo"
    @show="enfocarFecha"
    @shake="pedirDescartar"
  >
    <q-card ref="tarjeta" class="jornada-form">
      <q-form
        class="jornada-form__form"
        novalidate
        aria-label="Corregir las horas de la jornada"
        @submit="guardar"
      >
        <q-card-section>
          <h2 id="jornada-form-titulo" class="jornada-form__title">Corregir horas</h2>
          <p class="jornada-form__help">
            Corrige las horas de hoy o de un día anterior. Escribe la hora en formato de 24 horas
            (HH:MM). Deja vacío lo que no ocurrió. Si guardas todo vacío, se borra la jornada de ese
            día. Los campos con * son obligatorios.
          </p>
        </q-card-section>

        <q-card-section class="jornada-form__body">
          <div class="form-group">
            <label for="jornada-fecha" class="form-label"
              >Día <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="jornada-fecha"
              v-model="form.fecha"
              type="text"
              placeholder="DD-MM-AAAA"
              maxlength="10"
              autocomplete="off"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              aria-describedby="jornada-fecha-ayuda"
              :error="!!erroresCampo.fecha"
              :error-message="erroresCampo.fecha"
              :disable="guardando"
              @update:model-value="erroresCampo.fecha = null"
            >
              <template #append>
                <q-icon
                  name="event"
                  class="jornada-form__calendario"
                  tabindex="0"
                  role="button"
                  aria-label="Abrir calendario del día"
                >
                  <q-tooltip
                    >Elegir el día en el calendario. No se puede elegir un día futuro.</q-tooltip
                  >
                  <q-popup-proxy
                    :breakpoint="700"
                    transition-show="jump-down"
                    transition-hide="jump-up"
                    :transition-duration="180"
                  >
                    <q-date
                      v-model="form.fecha"
                      mask="DD-MM-YYYY"
                      :options="diaPermitido"
                      today-btn
                      @update:model-value="erroresCampo.fecha = null"
                    >
                      <div class="row justify-end">
                        <q-btn v-close-popup label="Listo" color="primary" flat no-caps />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
              <q-tooltip v-if="!erroresCampo.fecha"
                >Día cuya jornada vas a corregir. Hoy o un día anterior.</q-tooltip
              >
            </q-input>
            <p id="jornada-fecha-ayuda" class="form-help">
              Formato DD-MM-AAAA. Al cambiar el día se cargan las horas que ya tenía.
            </p>
          </div>

          <ScreenLoader v-if="cargandoDia" text="Cargando las horas de ese día…" />

          <div v-else class="jornada-form__horas">
            <div v-for="campo in CAMPOS_DE_HORA" :key="campo.nombre" class="form-group">
              <label :for="`jornada-${campo.nombre}`" class="form-label">
                {{ campo.etiqueta }}
                <span v-if="campo.nombre === 'entrada'" class="form-label__nota"
                  >(si hay otras horas)</span
                >
              </label>
              <q-input
                :for="`jornada-${campo.nombre}`"
                v-model="form[campo.nombre]"
                type="text"
                mask="##:##"
                placeholder="HH:MM"
                inputmode="numeric"
                autocomplete="off"
                outlined
                dense
                class="input-moderno"
                :error="!!erroresCampo[campo.nombre]"
                :error-message="erroresCampo[campo.nombre]"
                :disable="guardando"
                @update:model-value="erroresCampo[campo.nombre] = null"
              >
                <template #prepend><q-icon :name="campo.icono" aria-hidden="true" /></template>
                <q-tooltip v-if="!erroresCampo[campo.nombre]">{{ campo.ayuda }}</q-tooltip>
              </q-input>
            </div>
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
            label="Guardar horas"
            icon="save"
            no-caps
            unelevated
            class="control-touch boton-presionable"
            :loading="guardando"
            :disable="guardando || cargandoDia"
          >
            <q-tooltip>Guarda estas horas en la jornada del día elegido.</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import ScreenLoader from './ScreenLoader.vue'
import { corregir, listarMes } from '../services/jornadaService.js'
import { fechaADominioBackend, fechaParaFormulario } from '../utils/fechasCaso.js'
import { PASOS, fechaDeHoy, validarHorasJornada } from '../utils/jornada.js'

/*
 * «Corregir horas»: edita las cuatro horas de hoy o de un día anterior (selector de fecha, no futura).
 * Valida el orden entrada ≤ salida a descanso ≤ regreso ≤ salida; lo vacío es lo que no ocurrió y guardar
 * todo vacío borra la jornada de ese día (con confirmación). La fecha del formulario es DD-MM-AAAA; la API
 * usa AAAA-MM-DD.
 */
const dialogoAbierto = defineModel({ type: Boolean, default: false })

const emit = defineEmits(['guardado'])

const $q = useQuasar()
const tarjeta = ref(null)

const CAMPOS_DE_HORA = [
  {
    nombre: 'entrada',
    etiqueta: 'Entrada',
    icono: 'login',
    ayuda: 'Hora a la que empezaste a trabajar, en formato de 24 horas.',
  },
  {
    nombre: 'salida_descanso',
    etiqueta: 'Salida a descanso',
    icono: 'free_breakfast',
    ayuda: 'Hora a la que saliste a tu descanso. Déjala vacía si no tomaste descanso.',
  },
  {
    nombre: 'regreso_descanso',
    etiqueta: 'Regreso de descanso',
    icono: 'work_history',
    ayuda: 'Hora a la que regresaste de tu descanso. Solo si tienes salida a descanso.',
  },
  {
    nombre: 'salida',
    etiqueta: 'Salida',
    icono: 'logout',
    ayuda: 'Hora a la que terminaste de trabajar. Déjala vacía si tu jornada sigue abierta.',
  },
]

const form = reactive({
  fecha: '',
  entrada: '',
  salida_descanso: '',
  regreso_descanso: '',
  salida: '',
})
const erroresCampo = reactive({
  fecha: null,
  entrada: null,
  salida_descanso: null,
  regreso_descanso: null,
  salida: null,
})
const errorGeneral = ref('')
const guardando = ref(false)
const cargandoDia = ref(false)

// Lo que había guardado en el día elegido: sirve para saber si hay cambios y si había algo que borrar.
const inicial = reactive({ entrada: '', salida_descanso: '', regreso_descanso: '', salida: '' })
const existiaJornada = ref(false)

const hayDatosSinGuardar = computed(() =>
  PASOS.some((paso) => String(form[paso] ?? '').trim() !== inicial[paso]),
)

const DIALOGO = {
  transitionShow: 'dialogo-entra',
  transitionHide: 'dialogo-sale',
  transitionDuration: 220,
}

// Días que el calendario deja elegir: hoy y anteriores (q-date entrega AAAA/MM/DD).
const diaPermitido = (dia) => dia.replaceAll('/', '-') <= fechaDeHoy()

// Esc, clic fuera o «Cancelar» con cambios: se pregunta antes de perderlos.
const pedirDescartar = () => {
  if (guardando.value) return
  $q.dialog({
    ...DIALOGO,
    title: '¿Descartar los cambios?',
    message: 'Las horas que cambiaste en este formulario se perderán.',
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

const enfocarFecha = () => {
  nextTick(() => document.getElementById('jornada-fecha')?.focus())
}

/** Lleva la vista y el foco al primer campo con error (en celular puede estar fuera de la pantalla). */
const enfocarPrimerError = () =>
  nextTick(() => {
    const campo = tarjeta.value?.$el?.querySelector('.q-field--error')
    if (!campo) return
    campo.scrollIntoView({ block: 'center' })
    campo.querySelector('input, textarea')?.focus({ preventScroll: true })
  })

// Fecha del formulario en AAAA-MM-DD, o null si está incompleta o no es un día real.
const fechaElegida = () => fechaADominioBackend(form.fecha)

const ponerHoras = (jornada) => {
  for (const paso of PASOS) {
    form[paso] = jornada?.[paso] ?? ''
    inicial[paso] = form[paso]
  }
  existiaJornada.value = Boolean(jornada)
}

// Cada lectura lleva un número: si el día cambia mientras se lee otro, se descarta la respuesta vieja.
let ultimaLectura = 0

/** Carga las horas que ya tenía el día elegido (o las deja vacías). Un fallo se avisa sin bloquear. */
const cargarDia = async () => {
  const fecha = fechaElegida()
  if (!fecha || fecha > fechaDeHoy()) return
  const lectura = (ultimaLectura += 1)
  cargandoDia.value = true
  errorGeneral.value = ''
  try {
    const jornadas = await listarMes(fecha.slice(0, 7))
    if (lectura !== ultimaLectura) return
    ponerHoras(jornadas.find((j) => j.fecha === fecha) ?? null)
  } catch (error) {
    if (lectura !== ultimaLectura) return
    ponerHoras(null)
    errorGeneral.value =
      error?.mensaje ??
      'No se pudieron leer las horas de ese día. Puedes escribirlas de todos modos.'
  } finally {
    if (lectura === ultimaLectura) cargandoDia.value = false
  }
}

// Cada apertura empieza en hoy, con sus horas y sin errores de la vez anterior.
watch(dialogoAbierto, (abierto) => {
  if (!abierto) return
  ultimaLectura += 1
  for (const campo of Object.keys(erroresCampo)) erroresCampo[campo] = null
  errorGeneral.value = ''
  ponerHoras(null)
  form.fecha = fechaParaFormulario(fechaDeHoy())
  cargarDia()
})

// Al elegir otro día (a mano o en el calendario) se leen sus horas.
watch(
  () => form.fecha,
  () => {
    if (dialogoAbierto.value) cargarDia()
  },
)

const enviar = async (fecha, horas) => {
  guardando.value = true
  try {
    const jornada = await corregir(fecha, horas)
    dialogoAbierto.value = false
    $q.notify({
      type: 'positive',
      message: jornada
        ? `Se guardaron las horas del ${fechaParaFormulario(fecha)}.`
        : `Se borró la jornada del ${fechaParaFormulario(fecha)}.`,
      timeout: 4000,
    })
    emit('guardado', fecha)
  } catch (error) {
    errorGeneral.value = error?.mensaje ?? 'No se pudieron guardar las horas. Intenta de nuevo.'
  } finally {
    guardando.value = false
  }
}

const guardar = async () => {
  if (guardando.value || cargandoDia.value) return
  errorGeneral.value = ''

  const fecha = fechaElegida()
  erroresCampo.fecha = null
  if (!fecha) {
    erroresCampo.fecha = 'Escribe un día real con el formato DD-MM-AAAA, por ejemplo 13-11-2026.'
  } else if (fecha > fechaDeHoy()) {
    erroresCampo.fecha =
      'No puedes corregir un día que todavía no llega. Elige hoy o un día anterior.'
  }
  const validacion = validarHorasJornada(form)
  for (const paso of PASOS) erroresCampo[paso] = validacion.errores[paso] ?? null
  if (erroresCampo.fecha || !validacion.valido) {
    enfocarPrimerError()
    return
  }

  const todoVacio = PASOS.every((paso) => validacion.horas[paso] === null)
  if (todoVacio && !existiaJornada.value) {
    dialogoAbierto.value = false
    $q.notify({
      type: 'info',
      message: `El ${fechaParaFormulario(fecha)} no tenía horas registradas: no hay nada que guardar.`,
      timeout: 4000,
    })
    return
  }
  if (todoVacio) {
    $q.dialog({
      ...DIALOGO,
      title: '¿Borrar la jornada de este día?',
      message: `Dejaste todas las horas vacías: se borrará la jornada del ${fechaParaFormulario(fecha)}. No se puede deshacer.`,
      cancel: {
        label: 'Cancelar',
        flat: true,
        noCaps: true,
        class: 'control-touch boton-presionable',
      },
      ok: {
        label: 'Borrar jornada',
        color: 'dg-error',
        noCaps: true,
        unelevated: true,
        class: 'control-touch boton-presionable',
      },
      focus: 'cancel',
    }).onOk(() => enviar(fecha, validacion.horas))
    return
  }
  await enviar(fecha, validacion.horas)
}
</script>

<style scoped>
.jornada-form {
  width: 100%;
  max-width: 520px;
  min-width: 0;
}

.jornada-form__form,
.jornada-form__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.jornada-form__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.jornada-form__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.jornada-form__horas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

@media (max-width: 480px) {
  .jornada-form__horas {
    grid-template-columns: minmax(0, 1fr);
  }
}

.jornada-form__calendario {
  cursor: pointer;
}

.form-label__nota {
  color: var(--dg-texto-tenue);
  font-weight: 400;
}

/* .form-group, .form-label, .required-mark, .form-help y .error-banner viven en app.scss. */
</style>
