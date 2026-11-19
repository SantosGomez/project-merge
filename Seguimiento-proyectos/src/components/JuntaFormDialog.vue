<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="junta-form-titulo"
    @show="enfocarTitulo"
    @hide="alCerrar"
    @shake="pedirDescartar"
  >
    <q-card ref="tarjeta" class="junta-form">
      <q-form class="junta-form__form" novalidate :aria-label="textos.formulario" @submit="submit">
        <q-card-section class="junta-form__head">
          <h2 id="junta-form-titulo" class="junta-form__title">{{ textos.titulo }}</h2>
          <p class="junta-form__help">{{ textos.ayuda }}</p>
        </q-card-section>

        <q-card-section class="junta-form__body">
          <p v-if="terminaOtroDia" class="junta-form__aviso" role="note">
            <q-icon name="info" size="16px" aria-hidden="true" />
            Esta junta termina otro día. Al guardar terminará el mismo día en que empieza.
          </p>

          <p v-if="organizadorNombre" class="junta-form__organiza junta-form__ancho-completo">
            <q-icon name="person" size="16px" aria-hidden="true" />
            <span>
              Organiza: <strong>{{ organizadorNombre }}</strong>
            </span>
          </p>

          <div class="form-group junta-form__ancho-completo">
            <label for="junta-titulo" class="form-label"
              >Título <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              ref="tituloInput"
              v-model="titulo"
              for="junta-titulo"
              type="text"
              placeholder="Por ejemplo: Revisión semanal del equipo"
              :maxlength="MAX_TITULO"
              outlined
              dense
              counter
              class="input-moderno"
              aria-required="true"
              :error="!!errorDeCampo('titulo')"
              :error-message="errorDeCampo('titulo')"
              @update:model-value="clearError('titulo')"
            >
              <template #prepend>
                <q-icon name="title" />
              </template>
            </q-input>
          </div>

          <div class="form-group">
            <label for="junta-fecha" class="form-label"
              >Fecha <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              v-model="fecha"
              for="junta-fecha"
              type="text"
              placeholder="DD-MM-AAAA"
              maxlength="10"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              hint="Formato DD-MM-AAAA."
              :error="!!errorDeCampo('fecha')"
              :error-message="errorDeCampo('fecha')"
              @update:model-value="clearError('fecha')"
            >
              <template #append>
                <q-icon
                  name="event"
                  class="junta-form__icono-accion"
                  tabindex="0"
                  role="button"
                  aria-label="Abrir el calendario para elegir la fecha"
                >
                  <q-tooltip>Elegir la fecha en el calendario.</q-tooltip>
                  <q-popup-proxy
                    :breakpoint="700"
                    transition-show="jump-down"
                    transition-hide="jump-up"
                    :transition-duration="180"
                  >
                    <q-date
                      v-model="fecha"
                      mask="DD-MM-YYYY"
                      :first-day-of-week="1"
                      today-btn
                      @update:model-value="clearError('fecha')"
                    >
                      <div class="row justify-end">
                        <q-btn v-close-popup label="Listo" color="primary" flat no-caps />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>

          <div class="junta-form__horas">
            <div v-for="campo in CAMPOS_HORA" :key="campo.clave" class="form-group">
              <label :for="campo.id" class="form-label"
                >{{ campo.etiqueta }} <span aria-hidden="true" class="required-mark">*</span></label
              >
              <q-input
                v-model="horas[campo.clave]"
                :for="campo.id"
                type="text"
                placeholder="HH:mm"
                mask="##:##"
                maxlength="5"
                outlined
                dense
                class="input-moderno"
                aria-required="true"
                :error="!!errorDeCampo(campo.clave)"
                :error-message="errorDeCampo(campo.clave)"
                @update:model-value="clearError(campo.clave)"
              >
                <template #append>
                  <q-icon
                    name="schedule"
                    class="junta-form__icono-accion"
                    tabindex="0"
                    role="button"
                    :aria-label="`Abrir el reloj para elegir la ${campo.etiqueta.toLowerCase()}`"
                  >
                    <q-tooltip>Elegir la {{ campo.etiqueta.toLowerCase() }} en el reloj.</q-tooltip>
                    <q-popup-proxy
                      :breakpoint="700"
                      transition-show="jump-down"
                      transition-hide="jump-up"
                      :transition-duration="180"
                    >
                      <q-time
                        v-model="horas[campo.clave]"
                        mask="HH:mm"
                        format24h
                        :minute-options="MINUTOS_DISPONIBLES"
                        @update:model-value="clearError(campo.clave)"
                      >
                        <div class="row justify-end">
                          <q-btn v-close-popup label="Listo" color="primary" flat no-caps />
                        </div>
                      </q-time>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>

          <div class="form-group junta-form__ancho-completo">
            <label for="junta-invitados" class="form-label">Invitados</label>
            <q-select
              v-model="invitados"
              for="junta-invitados"
              :options="opcionesFiltradas"
              option-label="etiqueta"
              option-value="valor"
              multiple
              use-input
              use-chips
              outlined
              dense
              options-dense
              input-debounce="0"
              dropdown-icon="expand_more"
              placeholder="Busca por nombre"
              no-error-icon
              popup-content-class="menu-seleccion-custom"
              transition-show="jump-down"
              transition-hide="jump-up"
              :transition-duration="180"
              class="selector-moderno"
              :hint="textoAyudaInvitados"
              :loading="cargandoPersonas"
              :error="!!errorDeCampo('participantes')"
              :error-message="errorDeCampo('participantes')"
              @filter="filtrarPersonas"
              @update:model-value="clearError('participantes')"
            >
              <template #prepend>
                <q-icon name="group_add" />
              </template>
              <template #option="{ itemProps, opt, selected }">
                <q-item
                  v-bind="itemProps"
                  :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                >
                  <q-item-section>
                    <q-item-label>{{ opt.nombre }}</q-item-label>
                    <q-item-label caption>{{ opt.rol }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="selected" side>
                    <q-icon name="check" size="18px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
              <template #no-option>
                <q-item>
                  <q-item-section class="text-dg-texto-secundario">
                    {{
                      errorPersonas
                        ? 'No se pudo cargar la lista de personas.'
                        : 'Nadie coincide con tu búsqueda.'
                    }}
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-btn
              v-if="errorPersonas"
              flat
              no-caps
              icon="refresh"
              label="Reintentar la lista de personas"
              class="control-touch boton-presionable junta-form__reintentar"
              @click="cargarPersonas"
            >
              <q-tooltip>Vuelve a pedir la lista de personas que puedes invitar.</q-tooltip>
            </q-btn>
          </div>

          <div class="form-group junta-form__ancho-completo">
            <label for="junta-descripcion" class="form-label">Descripción</label>
            <q-input
              v-model="descripcion"
              for="junta-descripcion"
              type="textarea"
              placeholder="De qué se hablará en la junta"
              outlined
              dense
              rows="3"
              :maxlength="MAX_DESCRIPCION"
              counter
              class="input-moderno"
              :error="!!errorDeCampo('descripcion')"
              :error-message="errorDeCampo('descripcion')"
              @update:model-value="clearError('descripcion')"
            >
              <template #prepend>
                <q-icon name="description" />
              </template>
            </q-input>
          </div>

          <div class="form-group junta-form__ancho-completo">
            <q-toggle
              v-model="privada"
              label="Junta privada"
              color="primary"
              class="control-touch"
              aria-describedby="junta-privada-ayuda"
            >
              <q-tooltip>
                Si la activas, quien no esté invitado solo verá «Ocupado» en las agendas.
              </q-tooltip>
            </q-toggle>
            <p id="junta-privada-ayuda" class="form-help">
              Quien no esté invitado solo verá «Ocupado» en las agendas.
            </p>
          </div>

          <ErrorState
            v-if="errorGuardado"
            class="junta-form__ancho-completo"
            :title="textos.errorGuardado"
            :detail="mensajeError"
            @retry="submit"
          />
        </q-card-section>

        <q-card-actions align="right" class="junta-form__actions">
          <q-btn
            flat
            no-caps
            label="Cancelar"
            class="control-touch boton-presionable"
            :disable="guardando"
            @click="cerrar"
          >
            <q-tooltip>{{ textos.tooltipCancelar }}</q-tooltip>
          </q-btn>
          <q-btn
            type="submit"
            color="primary"
            :label="textos.boton"
            :icon="modoEdicion ? 'save' : 'add_circle'"
            no-caps
            unelevated
            class="control-touch boton-presionable"
            :loading="guardando"
            :disable="guardando"
          >
            <q-tooltip>{{ textos.tooltipBoton }}</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-form>

      <!-- Esc, un clic fuera o «Cancelar» con datos escritos: se pregunta antes de perderlos. -->
      <q-dialog
        v-model="confirmacionAbierta"
        transition-show="dialogo-entra"
        transition-hide="dialogo-sale"
        :transition-duration="220"
        aria-labelledby="descartar-junta-titulo"
      >
        <q-card class="confirmar-descartar">
          <q-card-section>
            <h2 id="descartar-junta-titulo" class="confirmar-descartar__titulo">
              ¿Descartar los cambios?
            </h2>
            <p class="confirmar-descartar__texto">
              Lo que escribiste en este formulario se perderá.
            </p>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn
              v-close-popup
              autofocus
              flat
              no-caps
              label="Seguir editando"
              class="control-touch boton-presionable"
            >
              <q-tooltip>Vuelve al formulario con todo lo que escribiste.</q-tooltip>
            </q-btn>
            <q-btn
              color="dg-error"
              unelevated
              no-caps
              label="Descartar"
              class="control-touch boton-presionable"
              @click="descartar"
            >
              <q-tooltip>Cierra el formulario y pierde lo que escribiste.</q-tooltip>
            </q-btn>
          </q-card-actions>
        </q-card>
      </q-dialog>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

import ErrorState from './ErrorState.vue'
import { actualizar, crear, participantesDisponibles } from '../services/juntaService.js'
import { fechaParaFormulario } from '../utils/fechasCaso.js'
import { formatearRol } from '../utils/formateadores.js'
import {
  MAX_DESCRIPCION,
  MAX_INVITADOS,
  MAX_TITULO,
  armarFechaHora,
  campoDeErrorJunta,
  horaDeFechaHora,
  validarFormularioJunta,
} from '../utils/juntas.js'

/*
 * Alta y edición de una junta (prop `junta` para editar). La junta del formulario es de un solo día:
 * fecha DD-MM-AAAA y dos horas HH:mm; a la API va como `AAAA-MM-DD HH:mm`. Con `fechaInicial` y
 * `horaInicial` (clic en un hueco del calendario) se precarga el horario, de 30 minutos.
 * Con `organizador` (la recepcionista agendando a nombre de un administrador) la junta queda a nombre de
 * él: se muestra «Organiza: {nombre}» y no se le puede invitar. Al editar una junta que organiza otra
 * persona (la recepcionista con la junta de un administrador) también se muestra quién organiza.
 */
const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  /** Junta de la API que se edita; null para crear una nueva. */
  junta: { type: Object, default: null },
  /** Día precargado al crear (AAAA-MM-DD); vacío deja el campo en blanco. */
  fechaInicial: { type: String, default: '' },
  /** Hora precargada al crear (HH:mm); vacío deja los campos en blanco. */
  horaInicial: { type: String, default: '' },
  /** Persona a invitar de entrada al crear ({ id, nombre, rol }), p. ej. de cuya agenda se parte. */
  invitadoInicial: { type: Object, default: null },
  /** Administrador a cuyo nombre se agenda al crear ({ id, nombre }); null si la junta es de quien la crea. */
  organizador: { type: Object, default: null },
})

const emit = defineEmits(['guardada', 'cerrada'])

// Avisa cuando el diálogo ya terminó de cerrarse, para que la pantalla devuelva el foco.
const alCerrar = () => emit('cerrada')

const modoEdicion = computed(() => props.junta !== null)

// Quien organiza cuando no es la cuenta que usa el formulario; null si la junta es propia.
const organizadorAjeno = computed(() => {
  if (modoEdicion.value) return props.junta.soy_organizador ? null : props.junta.creado_por
  return props.organizador
})
const organizadorNombre = computed(() => organizadorAjeno.value?.nombre ?? '')

// Ayuda bajo el selector de invitados (prop hint): cambia según a nombre de quién se agenda.
const textoAyudaInvitados = computed(() =>
  organizadorNombre.value
    ? `Puedes elegir hasta ${MAX_INVITADOS} personas. Cada invitado empieza como «Pendiente». Si no invitas a nadie, la junta solo bloquea el horario de ${organizadorNombre.value}.`
    : `Puedes elegir hasta ${MAX_INVITADOS} personas. Cada invitado empieza como «Pendiente». Si no invitas a nadie, la junta solo bloquea tu horario y los demás la verán en tu agenda.`,
)

const TEXTOS_ALTA = {
  titulo: 'Nueva junta',
  formulario: 'Formulario para crear una junta',
  ayuda: 'Completa los campos marcados con *. Los invitados la verán en su calendario.',
  boton: 'Crear junta',
  tooltipBoton: 'Guarda la junta y la agrega al calendario de los invitados.',
  tooltipCancelar: 'Cierra el formulario sin crear la junta.',
  errorGuardado: 'No se pudo guardar la junta',
}

const TEXTOS_EDICION = {
  titulo: 'Editar junta',
  formulario: 'Formulario para editar una junta',
  ayuda: 'Cambia lo que necesites. Quien ya respondió conserva su respuesta.',
  boton: 'Guardar cambios',
  tooltipBoton: 'Guarda los cambios de la junta.',
  tooltipCancelar: 'Cierra el formulario sin guardar los cambios.',
  errorGuardado: 'No se pudieron guardar los cambios',
}

const textos = computed(() => (modoEdicion.value ? TEXTOS_EDICION : TEXTOS_ALTA))

const CAMPOS_HORA = [
  { clave: 'horaInicio', id: 'junta-hora-inicio', etiqueta: 'Hora de inicio' },
  { clave: 'horaFin', id: 'junta-hora-fin', etiqueta: 'Hora de fin' },
]
const MINUTOS_DISPONIBLES = [0, 15, 30, 45]
const MINUTOS_POR_DEFECTO = 30

// Campo del formulario al que apunta cada campo de la API.
const CAMPO_DE_FORMULARIO = {
  titulo: 'titulo',
  descripcion: 'descripcion',
  inicio: 'horaInicio',
  fin: 'horaFin',
  participantes: 'participantes',
}

const guardando = ref(false)

const titulo = ref('')
const fecha = ref('')
const horas = ref({ horaInicio: '', horaFin: '' })
const descripcion = ref('')
const privada = ref(false)
// Invitados elegidos, como opciones del selector ({ valor, nombre, rol, etiqueta }).
const invitados = ref([])

const tituloInput = ref(null)
const tarjeta = ref(null)
const erroresCampo = ref({})
const errorGuardado = ref(null)
const confirmacionAbierta = ref(false)
const fotoInicial = ref('')

// Personas que se pueden invitar: { valor, nombre, rol, etiqueta } (etiqueta sirve para buscar).
const personas = ref([])
const opcionesFiltradas = ref([])
const cargandoPersonas = ref(false)
const errorPersonas = ref(false)

const mensajeError = computed(
  () =>
    errorGuardado.value?.mensaje ??
    'Qué ocurrió: No se guardó la junta. Sobre: la conexión con el servidor. Qué hacer: Revisa tu conexión y pulsa «Reintentar»; tus datos siguen en el formulario.',
)

// Una junta que ya cruza la medianoche (creada por la API) pierde ese cruce al guardarla aquí.
const terminaOtroDia = computed(
  () =>
    modoEdicion.value &&
    String(props.junta.inicio).slice(0, 10) !== String(props.junta.fin).slice(0, 10),
)

const clearError = (campo) => {
  const restantes = { ...erroresCampo.value }
  delete restantes[campo]
  erroresCampo.value = restantes
}

const errorDeCampo = (campo) => erroresCampo.value[campo] ?? null

/** Lleva la vista y el foco al primer campo con error (en celular puede estar fuera de la pantalla). */
const enfocarPrimerError = () =>
  nextTick(() => {
    const campo = tarjeta.value?.$el?.querySelector('.q-field--error')
    if (!campo) return
    campo.scrollIntoView({ block: 'center' })
    campo.querySelector('input, textarea, [tabindex="0"]')?.focus({ preventScroll: true })
  })

const idsDeInvitados = () => invitados.value.map((persona) => persona.valor)

const fotoDelFormulario = () =>
  JSON.stringify([
    titulo.value,
    fecha.value,
    horas.value,
    descripcion.value,
    privada.value,
    idsDeInvitados().sort((a, b) => a - b),
  ])

const hayDatosSinGuardar = computed(() => fotoDelFormulario() !== fotoInicial.value)

const enfocarTitulo = () => {
  nextTick(() => tituloInput.value?.focus())
}

// --- personas invitables ------------------------------------------------------------------------

const opcionDePersona = (persona) => {
  const rol = formatearRol(persona.rol)
  return { valor: persona.id, nombre: persona.nombre, rol, etiqueta: `${persona.nombre} (${rol})` }
}

const sinTildes = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const filtrarPersonas = (texto, actualizar) => {
  actualizar(() => {
    const buscado = sinTildes(texto.trim())
    opcionesFiltradas.value = personas.value.filter((p) => sinTildes(p.etiqueta).includes(buscado))
  })
}

// Quien ya está invitado y ya no se puede invitar (p. ej. cambió de rol) sigue en la lista para poder quitarlo.
const mezclarInvitadosDeLaJunta = (lista) => {
  const ids = new Set(lista.map((p) => p.valor))
  const extra = (props.junta?.participantes ?? [])
    .filter((p) => !ids.has(p.id))
    .map(opcionDePersona)
  return [...lista, ...extra]
}

const cargarPersonas = async () => {
  cargandoPersonas.value = true
  errorPersonas.value = false
  try {
    const usuarios = (await participantesDisponibles()).filter(
      (persona) => persona.id !== organizadorAjeno.value?.id,
    )
    personas.value = mezclarInvitadosDeLaJunta(usuarios.map(opcionDePersona))
    opcionesFiltradas.value = personas.value
  } catch {
    errorPersonas.value = true
    personas.value = mezclarInvitadosDeLaJunta([])
    opcionesFiltradas.value = personas.value
  } finally {
    cargandoPersonas.value = false
  }
}

// --- apertura y cierre ----------------------------------------------------------------------------

const sumarMinutos = (hora, minutos) => {
  const [h, m] = hora.split(':').map(Number)
  const total = h * 60 + m + minutos
  if (total >= 24 * 60) return ''
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const reiniciarFormulario = () => {
  const j = props.junta
  titulo.value = j?.titulo ?? ''
  descripcion.value = j?.descripcion ?? ''
  privada.value = j?.privada === true
  invitados.value = j
    ? j.participantes.map(opcionDePersona)
    : props.invitadoInicial
      ? [opcionDePersona(props.invitadoInicial)]
      : []
  if (j) {
    fecha.value = fechaParaFormulario(j.inicio)
    horas.value = { horaInicio: horaDeFechaHora(j.inicio), horaFin: horaDeFechaHora(j.fin) }
  } else {
    fecha.value = fechaParaFormulario(props.fechaInicial)
    horas.value = {
      horaInicio: props.horaInicial,
      horaFin: props.horaInicial ? sumarMinutos(props.horaInicial, MINUTOS_POR_DEFECTO) : '',
    }
  }
  erroresCampo.value = {}
  errorGuardado.value = null
  fotoInicial.value = fotoDelFormulario()
}

watch(dialogoAbierto, (abierto) => {
  if (!abierto) return
  reiniciarFormulario()
  cargarPersonas()
})

const pedirDescartar = () => {
  if (!guardando.value) confirmacionAbierta.value = true
}

const cerrar = () => {
  if (guardando.value) return
  if (hayDatosSinGuardar.value) {
    confirmacionAbierta.value = true
    return
  }
  dialogoAbierto.value = false
}

const descartar = () => {
  confirmacionAbierta.value = false
  dialogoAbierto.value = false
}

// --- guardado -------------------------------------------------------------------------------------

const submit = async () => {
  if (guardando.value) return
  errorGuardado.value = null

  erroresCampo.value = validarFormularioJunta({
    titulo: titulo.value,
    fecha: fecha.value,
    horaInicio: horas.value.horaInicio,
    horaFin: horas.value.horaFin,
    descripcion: descripcion.value,
    participantes: idsDeInvitados(),
  })
  if (Object.keys(erroresCampo.value).length > 0) {
    enfocarPrimerError()
    return
  }

  guardando.value = true
  try {
    const datos = {
      titulo: titulo.value,
      descripcion: descripcion.value,
      inicio: armarFechaHora(fecha.value, horas.value.horaInicio),
      fin: armarFechaHora(fecha.value, horas.value.horaFin),
      participantes: idsDeInvitados(),
      privada: privada.value,
    }
    const guardada = modoEdicion.value
      ? await actualizar(props.junta.id, datos)
      : await crear(props.organizador ? { ...datos, organizadorId: props.organizador.id } : datos)
    emit('guardada', guardada)
    dialogoAbierto.value = false
  } catch (error) {
    // Si el error nombra un campo, se muestra junto a él; si no, en el aviso general.
    const campo = CAMPO_DE_FORMULARIO[campoDeErrorJunta(error?.mensaje)]
    if (campo) {
      erroresCampo.value = { [campo]: error.mensaje }
      enfocarPrimerError()
    } else errorGuardado.value = error
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.junta-form {
  width: min(720px, calc(100vw - 32px));
  max-height: 85vh;
  max-width: none !important;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.junta-form__form {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.junta-form__head {
  padding-bottom: 0;
}

.junta-form__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
}

.junta-form__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.junta-form__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--dg-borde-fuerte) transparent;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px 20px;
  align-items: start;
}

@media (min-width: 700px) {
  .junta-form__body {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.junta-form__ancho-completo {
  grid-column: 1 / -1;
}

/* Las dos horas comparten la segunda columna en pantallas anchas. */
.junta-form__horas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.junta-form__organiza {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--dg-texto);
  font-size: 0.95rem;
}

.junta-form__aviso {
  display: flex;
  grid-column: 1 / -1;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--dg-aviso-borde);
  border-radius: 8px;
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-texto);
  font-size: 0.9rem;
}

.junta-form__icono-accion {
  cursor: pointer;
  color: var(--dg-acento);
}

.junta-form__reintentar {
  align-self: flex-start;
}

/* Pie fijo: «Cancelar» y «Guardar» se ven siempre; solo el cuerpo se desplaza. */
.junta-form__actions {
  flex: none;
  padding: 8px 16px 16px;
  border-top: 1px solid var(--dg-borde);
}

/* Confirmación de descartar: mismo aspecto que en los demás formularios. */
.confirmar-descartar {
  width: min(400px, calc(100vw - 32px));
}

.confirmar-descartar__titulo {
  margin: 0 0 8px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.3;
}

.confirmar-descartar__texto {
  margin: 0;
  color: var(--dg-texto-secundario);
  line-height: 1.5;
}
</style>
