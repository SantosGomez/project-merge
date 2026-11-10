<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="cases.guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="registro-caso-titulo"
    @show="enfocarCliente"
    @shake="pedirDescartar"
  >
    <q-card ref="tarjeta" class="registro-caso">
      <q-form
        class="registro-caso__form"
        novalidate
        :aria-label="textos.formulario"
        @submit="submitCase"
      >
        <q-card-section class="registro-caso__head">
          <h2 id="registro-caso-titulo" class="registro-caso__title">{{ textos.titulo }}</h2>
          <p class="registro-caso__help">{{ textos.ayuda }}</p>
        </q-card-section>

        <q-card-section class="registro-caso__body">
          <div class="form-group">
            <label for="client-field" class="form-label"
              >Cliente <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              ref="clienteInput"
              for="client-field"
              v-model="client"
              type="text"
              placeholder="Nombre del cliente"
              maxlength="80"
              outlined
              dense
              counter
              class="input-moderno"
              aria-required="true"
              aria-describedby="client-help"
              :error="!!errorDeCampo('client_required', 'client_too_long')"
              :error-message="errorDeCampo('client_required', 'client_too_long')"
              @update:model-value="clearFormError('client_required', 'client_too_long')"
            >
              <template #prepend>
                <q-icon name="person" />
              </template>
            </q-input>
            <p id="client-help" class="form-help">Máximo 80 caracteres visibles.</p>
          </div>

          <div class="form-group">
            <label for="priority-field" class="form-label"
              >Prioridad <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-select
              for="priority-field"
              v-model="priority"
              :options="priorityOptions"
              option-label="label"
              option-value="value"
              placeholder="Elige una prioridad"
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
              aria-required="true"
              aria-describedby="priority-help"
              :error="!!errorDeCampo('priority_required')"
              :error-message="errorDeCampo('priority_required')"
              @update:model-value="clearFormError('priority_required')"
            >
              <template #prepend>
                <q-icon name="flag" />
              </template>
              <template #option="scope">
                <q-item
                  v-bind="scope.itemProps"
                  clickable
                  :class="['item-opcion-custom', { 'opcion-seleccionada': scope.selected }]"
                >
                  <q-item-section>
                    <PriorityTag :priority="scope.opt.value" />
                  </q-item-section>
                  <q-item-section v-if="scope.selected" side>
                    <q-icon name="check" size="18px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
              <template #selected>
                <div v-if="priority" class="priority-selected">
                  <PriorityTag :priority="priority" />
                </div>
              </template>
            </q-select>
            <p id="priority-help" class="form-help">Indica qué tan urgente es el caso. No cambia la fecha de vencimiento.</p>
          </div>

          <div class="form-group">
            <label for="fecha-inicio-field" class="form-label"
              >Fecha de inicio
              <span v-if="modoEdicion" aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="fecha-inicio-field"
              v-model="fechaInicio"
              type="text"
              placeholder="DD-MM-AAAA"
              maxlength="10"
              outlined
              dense
              class="input-moderno"
              :aria-required="modoEdicion ? 'true' : 'false'"
              aria-describedby="fecha-inicio-help"
              :error="!!errorDeCampo('fecha_inicio_invalido')"
              :error-message="errorDeCampo('fecha_inicio_invalido')"
              @update:model-value="clearFormError('fecha_inicio_invalido')"
            >
              <template #append>
                <q-icon
                  name="event"
                  class="registro-caso__calendario-icono"
                  tabindex="0"
                  role="button"
                  aria-label="Abrir calendario de la fecha de inicio"
                >
                  <q-tooltip>Elegir la fecha de inicio en el calendario.</q-tooltip>
                  <q-popup-proxy
                    :breakpoint="700"
                    transition-show="jump-down"
                    transition-hide="jump-up"
                    :transition-duration="180"
                  >
                    <q-date
                      v-model="fechaInicio"
                      mask="DD-MM-YYYY"
                      today-btn
                      @update:model-value="clearFormError('fecha_inicio_invalido')"
                    >
                      <div class="row justify-end">
                        <q-btn v-close-popup label="Listo" color="primary" flat no-caps />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
            <p id="fecha-inicio-help" class="form-help">{{ textos.ayudaFecha }}</p>
          </div>

          <div class="form-group">
            <label for="fecha-vencimiento-field" class="form-label"
              >Fecha de vencimiento <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="fecha-vencimiento-field"
              v-model="fechaVencimiento"
              type="text"
              placeholder="DD-MM-AAAA"
              maxlength="10"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              aria-describedby="fecha-vencimiento-help"
              :error="!!errorDeCampo('fecha_vencimiento_invalido')"
              :error-message="errorDeCampo('fecha_vencimiento_invalido')"
              @update:model-value="clearFormError('fecha_vencimiento_invalido')"
            >
              <template #append>
                <q-icon
                  name="event"
                  class="registro-caso__calendario-icono"
                  tabindex="0"
                  role="button"
                  aria-label="Abrir calendario de la fecha de vencimiento"
                >
                  <q-tooltip>Elegir la fecha de vencimiento en el calendario.</q-tooltip>
                  <q-popup-proxy
                    :breakpoint="700"
                    transition-show="jump-down"
                    transition-hide="jump-up"
                    :transition-duration="180"
                  >
                    <q-date
                      v-model="fechaVencimiento"
                      mask="DD-MM-YYYY"
                      :options="permitirVencimiento"
                      :default-year-month="mesInicialVencimiento"
                      @update:model-value="clearFormError('fecha_vencimiento_invalido')"
                    >
                      <div class="row justify-end">
                        <q-btn v-close-popup label="Listo" color="primary" flat no-caps />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
                <q-icon
                  name="info"
                  class="registro-caso__ayuda-icono"
                  tabindex="0"
                  role="img"
                  aria-label="Ayuda sobre la fecha de vencimiento"
                >
                  <q-tooltip>Día límite para terminar el caso. Lo decides tú y puedes cambiarlo después.</q-tooltip>
                </q-icon>
              </template>
            </q-input>
            <p id="fecha-vencimiento-help" class="form-help">
              Formato DD-MM-AAAA. Igual o posterior a la fecha de inicio.
            </p>
          </div>

          <div class="form-group registro-caso__estado">
            <template v-if="modoEdicion">
              <label for="estado-field" class="form-label"
                >Estado <span aria-hidden="true" class="required-mark">*</span></label
              >
              <q-select
                for="estado-field"
                v-model="estado"
                :options="statusOptions"
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
                aria-required="true"
                aria-describedby="estado-help"
              >
                <template #prepend>
                  <q-icon name="tune" />
                </template>
                <template #selected-item="scope">
                  <div class="row items-center q-gutter-x-sm no-wrap">
                    <span
                      class="punto-estado-sm"
                      :style="{ '--dot-color': `var(--dg-estado-${(scope.opt?.value ?? estado)?.replace(/_/g, '-')})` }"
                    />
                    <span class="text-weight-medium text-primary">{{ scope.opt?.label ?? scope.opt }}</span>
                  </div>
                </template>
                <template #option="{ itemProps, opt, selected }">
                  <q-item
                    v-bind="itemProps"
                    :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                  >
                    <q-item-section avatar class="item-seccion-icono">
                      <span
                        class="punto-estado"
                        :style="{ '--dot-color': `var(--dg-estado-${opt.value?.replace(/_/g, '-')})` }"
                      />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ opt.label }}</q-item-label>
                    </q-item-section>
                    <q-item-section v-if="selected" side>
                      <q-icon name="check" size="18px" color="primary" />
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
              <p id="estado-help" class="form-help">
                Pendiente: sin empezar. En proceso: en trabajo. Finalizado: terminado.
              </p>
            </template>
            <template v-else>
              <span id="estado-label" class="form-label">Estado</span>
              <p class="estado-fijo" aria-labelledby="estado-label" aria-describedby="estado-help">
                {{ statusLabel }}
              </p>
              <p id="estado-help" class="form-help">Todo caso nuevo empieza en Pendiente.</p>
            </template>
          </div>

          <div class="form-group">
            <q-toggle
              v-model="importante"
              color="dg-importante"
              checked-icon="star"
              unchecked-icon="star_border"
              label="Caso importante"
              class="registro-caso__importante"
              aria-describedby="importante-help"
            >
              <q-tooltip>Marca el caso como importante para darle seguimiento especial.</q-tooltip>
            </q-toggle>
            <p id="importante-help" class="form-help">
              Actívalo si el caso es de un cliente importante o requiere atención especial.
            </p>
          </div>

          <div class="form-group">
            <label for="descripcion-field" class="form-label">Descripción</label>
            <q-input
              for="descripcion-field"
              v-model="descripcion"
              type="textarea"
              outlined
              dense
              rows="3"
              maxlength="1000"
              class="input-moderno"
              aria-describedby="descripcion-help"
              :error="!!errorDeCampo('descripcion_demasiado_largo')"
              :error-message="errorDeCampo('descripcion_demasiado_largo')"
            >
              <template #prepend>
                <q-icon name="description" />
              </template>
            </q-input>
            <p id="descripcion-help" class="form-help">Máximo 1000 caracteres.</p>
          </div>

          <div class="form-group">
            <label for="observaciones-field" class="form-label">Observaciones</label>
            <q-input
              for="observaciones-field"
              v-model="observaciones"
              type="textarea"
              outlined
              dense
              rows="3"
              maxlength="2000"
              class="input-moderno"
              aria-describedby="observaciones-help"
              :error="!!errorDeCampo('observaciones_demasiado_largo')"
              :error-message="errorDeCampo('observaciones_demasiado_largo')"
            >
              <template #prepend>
                <q-icon name="sticky_note_2" />
              </template>
            </q-input>
            <p id="observaciones-help" class="form-help">Máximo 2000 caracteres.</p>
          </div>

          <div v-if="modoAsignacion" class="form-group registro-caso__ancho-completo">
            <label for="contador-field" class="form-label"
              >Contador asignado <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-select
              for="contador-field"
              v-model="contadorId"
              :options="opcionesContador"
              option-label="label"
              option-value="value"
              placeholder="Elige un contador"
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
              aria-required="true"
              aria-describedby="contador-help"
              :error="!!errorDeCampo('contador_required')"
              :error-message="errorDeCampo('contador_required')"
              @update:model-value="clearFormError('contador_required')"
            >
              <template #prepend>
                <q-icon name="person_search" />
              </template>
              <template #option="{ itemProps, opt, selected }">
                <q-item
                  v-bind="itemProps"
                  :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                >
                  <q-item-section avatar class="item-seccion-icono">
                    <q-icon name="person" size="18px" color="primary" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ opt.label }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="selected" side>
                    <q-icon name="check" size="18px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
              <q-tooltip>El caso aparecerá en «Mis casos» de esta persona y se le enviará un aviso.</q-tooltip>
            </q-select>
            <p id="contador-help" class="form-help">Contador que atenderá el caso.</p>
          </div>

          <dl v-else class="readonly-info">
            <div class="readonly-row">
              <dt>Contador asignado</dt>
              <dd>{{ assignedCounterName }}</dd>
            </div>
          </dl>

          <ErrorState
            v-if="errorGuardado"
            class="registro-caso__error registro-caso__ancho-completo"
            :title="textos.errorGuardado"
            :detail="mensajeError"
            @retry="submitCase"
          />
        </q-card-section>

        <q-card-actions align="right" class="registro-caso__actions">
          <p v-if="modoEdicion && !hayCambios" class="form-help registro-caso__sin-cambios">
            Todavía no has cambiado ningún dato.
          </p>
          <q-btn
            flat
            no-caps
            label="Cancelar"
            class="control-touch boton-presionable"
            :disable="cases.guardando"
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
            :loading="cases.guardando"
            :disable="cases.guardando || (modoEdicion && !hayCambios)"
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
        aria-labelledby="descartar-titulo"
      >
        <q-card class="confirmar-descartar">
          <q-card-section>
            <h2 id="descartar-titulo" class="confirmar-descartar__titulo">¿Descartar los cambios?</h2>
            <p class="confirmar-descartar__texto">Lo que escribiste en este formulario se perderá.</p>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn v-close-popup autofocus flat no-caps label="Seguir editando" class="control-touch boton-presionable">
              <q-tooltip>Vuelve al formulario con todo lo que escribiste.</q-tooltip>
            </q-btn>
            <q-btn color="dg-error" unelevated no-caps label="Descartar" class="control-touch boton-presionable" @click="descartar">
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
import PriorityTag from './PriorityTag.vue'
import { CASE_ERROR_CODES, cambiosDelCaso } from '../utils/caseRules.js'
import { diaPermitidoParaVencimiento, fechaADominioBackend, fechaParaFormulario } from '../utils/fechasCaso.js'
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, STATUSES, MAX_DESCRIPCION_LENGTH, MAX_OBSERVACIONES_LENGTH } from '../utils/constants.js'
import { prioridadABackend } from '../utils/traduccionBackend.js'
import { hoyLocal } from '../utils/filtrosCasos.js'
import {
  validarCliente,
  validarFechaInicio,
  validarFechaVencimiento,
  validarPrioridad,
  validarTextoOpcional,
} from '../utils/validators.js'
import { useCasesStore } from '../stores/cases.js'
import { useAuxiliaresStore } from '../stores/auxiliares.js'
import { useSessionStore } from '../stores/session.js'

/*
 * Registro y edición de caso en un diálogo dentro de «Mis casos» (P-5).
 * Sin `caso` registra uno nuevo; con `caso` edita ese caso y solo envía lo que cambió.
 * El store actualiza la lista local, así que la pantalla se entera al cerrar.
 */
const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  /** Caso del store a editar; null para registrar uno nuevo. */
  caso: {
    type: Object,
    default: null,
  },
  /** Contadores `{ id, nombre }` para que el administrador elija a quién asignar; null en «Mis casos». */
  contadores: {
    type: Array,
    default: null,
  },
  /** Id del contador dueño cuando el registro lo hace un auxiliar; null en registro normal. */
  contadorDuenioId: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits(['registrado', 'guardado'])

const auxiliares = useAuxiliaresStore()

const modoEdicion = computed(() => props.caso !== null)
const modoAsignacion = computed(() => !modoEdicion.value && props.contadores !== null)
const modoAuxiliar = computed(() => !modoEdicion.value && props.contadorDuenioId !== null)

const TEXTOS_REGISTRO = {
  titulo: 'Registrar caso',
  formulario: 'Formulario de registro de caso',
  ayuda: 'Completa los campos obligatorios. El estado inicial siempre es Pendiente.',
  ayudaFecha: 'Formato DD-MM-AAAA. Deja vacío para usar hoy.',
  boton: 'Registrar caso',
  tooltipBoton: 'Guarda el caso en tu lista con estado Pendiente.',
  tooltipCancelar: 'Cierra el formulario sin registrar el caso.',
  errorGuardado: 'No se pudo registrar el caso',
  errorDetalle: 'el registro del caso.',
}

const TEXTOS_EDICION = {
  titulo: 'Editar caso',
  formulario: 'Formulario de edición de caso',
  ayuda: 'Cambia los datos que necesites, incluida la fecha de vencimiento si el caso lo requiere.',
  ayudaFecha: 'Formato DD-MM-AAAA.',
  boton: 'Guardar cambios',
  tooltipBoton: 'Guarda los cambios del caso.',
  tooltipCancelar: 'Cierra el formulario sin guardar los cambios.',
  errorGuardado: 'No se pudieron guardar los cambios',
  errorDetalle: 'los cambios del caso.',
}

const TEXTOS_ASIGNACION = {
  ...TEXTOS_REGISTRO,
  titulo: 'Asignar caso',
  formulario: 'Formulario de asignación de caso',
  ayuda: 'Completa los campos obligatorios y elige al contador. El estado inicial siempre es Pendiente.',
  boton: 'Asignar caso',
  tooltipBoton: 'Guarda el caso a nombre del contador elegido con estado Pendiente y le envía un aviso.',
  tooltipCancelar: 'Cierra el formulario sin asignar el caso.',
  errorGuardado: 'No se pudo asignar el caso',
  errorDetalle: 'la asignación del caso.',
}

const TEXTOS_AUXILIAR = {
  ...TEXTOS_REGISTRO,
  titulo: 'Registrar caso para otro contador',
  formulario: 'Formulario de registro de caso para auxiliar',
  ayuda: 'Completa los campos obligatorios. El caso se creará a nombre del contador seleccionado y él recibirá un aviso.',
  boton: 'Registrar caso para el contador',
  tooltipBoton: 'Guarda el caso a nombre del contador seleccionado con estado Pendiente y le envía un aviso.',
  tooltipCancelar: 'Cierra el formulario sin registrar el caso.',
  errorGuardado: 'No se pudo registrar el caso',
  errorDetalle: 'el registro del caso.',
}

const textos = computed(() => {
  if (modoEdicion.value) return TEXTOS_EDICION
  if (modoAuxiliar.value) return TEXTOS_AUXILIAR
  return modoAsignacion.value ? TEXTOS_ASIGNACION : TEXTOS_REGISTRO
})

const cases = useCasesStore()
const session = useSessionStore()

const client = ref('')
const priority = ref('')
// Errores de validación por código de campo: { client_required: 'El cliente es obligatorio.', … }.
const erroresCampo = ref({})
const errorGuardado = ref(null)
const clienteInput = ref(null)
const tarjeta = ref(null)
const confirmacionAbierta = ref(false)

const assignedCounter = computed(() =>
  session.nombreVisible ? { id: session.id, name: session.nombreVisible } : null,
)

const priorityOptions = computed(() =>
  PRIORITIES.map((p) => ({ label: PRIORITY_LABELS[p], value: p })),
)

const statusOptions = computed(() => STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s })))

const contadorId = ref(null)
const opcionesContador = computed(() =>
  (props.contadores ?? []).map((contador) => ({ label: contador.nombre, value: contador.id })),
)

const estado = ref('')
const fechaInicio = ref('')
const fechaVencimiento = ref('')
const descripcion = ref('')
const observaciones = ref('')
const importante = ref(false)

// En el calendario del vencimiento solo se eligen días desde la fecha de inicio (o hoy).
const permitirVencimiento = (dia) => diaPermitidoParaVencimiento(dia, fechaInicio.value, hoyLocal())

// Sin vencimiento elegido, el calendario abre en el mes de la fecha de inicio (o el actual): AAAA/MM.
const mesInicialVencimiento = computed(() => {
  const inicio = fechaADominioBackend(fechaInicio.value) ?? hoyLocal()
  return inicio.slice(0, 7).replace('-', '/')
})

// Solo lo que cambió respecto al caso guardado (vacío en el registro).
const cambios = computed(() =>
  modoEdicion.value
    ? cambiosDelCaso(props.caso, {
        cliente: client.value,
        estado: estado.value,
        prioridad: priority.value,
        fechaInicio: fechaInicio.value,
        fechaVencimiento: fechaVencimiento.value,
        descripcion: descripcion.value,
        observaciones: observaciones.value,
        importante: importante.value,
      })
    : {},
)

const hayCambios = computed(() => Object.keys(cambios.value).length > 0)

// Hay algo que se perdería al cerrar: en edición, un cambio; en registro, cualquier dato escrito.
const hayDatosSinGuardar = computed(() => {
  if (modoEdicion.value) return hayCambios.value
  const campos = [client, priority, fechaInicio, fechaVencimiento, descripcion, observaciones]
  return (
    campos.some((campo) => String(campo.value ?? '').trim() !== '') ||
    importante.value ||
    contadorId.value !== null
  )
})

const assignedCounterName = computed(() =>
  assignedCounter.value ? assignedCounter.value.name : 'Sin asignar',
)

const statusLabel = STATUS_LABELS[STATUSES[0]]

const mensajeError = computed(() => errorGuardado.value?.mensaje ?? textos.value.errorDetalle)

/** Al escribir en un campo se borra solo su error; los de los demás campos siguen a la vista. */
const clearFormError = (...codigos) => {
  const restantes = { ...erroresCampo.value }
  codigos.forEach((codigo) => delete restantes[codigo])
  erroresCampo.value = restantes
}

/** Mensaje que va bajo el campo (error-message) si alguno de sus códigos tiene error; si no, null. */
const errorDeCampo = (...codigos) => codigos.map((codigo) => erroresCampo.value[codigo]).find(Boolean) ?? null

/** Lleva la vista y el foco al primer campo con error (en celular puede estar fuera de la pantalla). */
const enfocarPrimerError = () =>
  nextTick(() => {
    const campo = tarjeta.value?.$el?.querySelector('.q-field--error')
    if (!campo) return
    campo.scrollIntoView({ block: 'center' })
    campo.querySelector('input, textarea, [tabindex="0"]')?.focus({ preventScroll: true })
  })

// Registro: formulario vacío. Edición: los valores actuales del caso.
const reiniciarFormulario = () => {
  const caso = props.caso
  client.value = caso?.cliente ?? ''
  priority.value = caso?.prioridad ?? ''
  estado.value = caso?.estado ?? ''
  fechaInicio.value = fechaParaFormulario(caso?.fecha_inicio)
  fechaVencimiento.value = fechaParaFormulario(caso?.fecha_vencimiento)
  descripcion.value = caso?.descripcion ?? ''
  observaciones.value = caso?.observaciones ?? ''
  importante.value = Boolean(caso?.importante)
  contadorId.value = null
  erroresCampo.value = {}
  errorGuardado.value = null
}

const enfocarCliente = () => {
  nextTick(() => clienteInput.value?.focus())
}

// Al abrir se limpia lo que quedó de la vez anterior; al cerrar no se toca nada.
watch(dialogoAbierto, (abierto) => {
  if (abierto) {
    reiniciarFormulario()
  }
})

// Esc o clic fuera con datos escritos (el diálogo es persistente y «sacude»): se pregunta antes.
const pedirDescartar = () => {
  if (cases.guardando) return
  confirmacionAbierta.value = true
}

const cerrar = () => {
  // Mientras el alta está en curso, el diálogo no se puede cerrar.
  if (cases.guardando) return
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

const MENSAJES_VENCIMIENTO = {
  vencimiento_requerido: 'La fecha de vencimiento es obligatoria. Usa el formato DD-MM-AAAA.',
  fecha_formato_invalido: 'Formato de fecha inválido. Usa DD-MM-AAAA.',
  fecha_invalida: 'La fecha no existe. Escribe una fecha real en formato DD-MM-AAAA.',
}

/** Todos los errores del formulario de una vez, por código de campo ({} si todo está bien). */
const validarFormulario = (clienteLimpio, prioridadBackend, fechaLimpia) => {
  const errores = {}

  const validacionCliente = validarCliente(clienteLimpio)
  if (!validacionCliente.valido) {
    if (validacionCliente.error === 'cliente_requerido') {
      errores[CASE_ERROR_CODES.clientRequired] = 'El cliente es obligatorio.'
    } else {
      errores[CASE_ERROR_CODES.clientTooLong] = 'El cliente supera los 80 caracteres permitidos.'
    }
  }

  if (!validarPrioridad(prioridadBackend).valido) {
    errores[CASE_ERROR_CODES.priorityRequired] = 'Elige una prioridad.'
  }

  let inicioValido = true
  if (modoEdicion.value && fechaLimpia === '') {
    inicioValido = false
    errores.fecha_inicio_invalido = 'La fecha de inicio es obligatoria al editar. Usa el formato DD-MM-AAAA.'
  } else {
    const validacionFecha = validarFechaInicio(fechaLimpia)
    if (!validacionFecha.valido) {
      inicioValido = false
      errores.fecha_inicio_invalido =
        validacionFecha.error === 'fecha_invalida'
          ? 'La fecha no existe. Escribe una fecha real en formato DD-MM-AAAA.'
          : 'Formato de fecha inválido. Usa DD-MM-AAAA.'
    }
  }

  // Con un inicio inválido el vencimiento se revisa solo por sí mismo (no se compara con el inicio).
  const validacionVencimiento = validarFechaVencimiento(
    fechaVencimiento.value,
    inicioValido ? fechaLimpia : '',
    hoyLocal(),
  )
  if (!validacionVencimiento.valido) {
    if (validacionVencimiento.error === 'vencimiento_antes_del_inicio') {
      if (inicioValido) {
        errores.fecha_vencimiento_invalido = fechaLimpia
          ? 'El vencimiento no puede ser anterior a la fecha de inicio.'
          : 'El vencimiento no puede ser anterior a hoy (fecha de inicio vacía).'
      }
    } else {
      errores.fecha_vencimiento_invalido = MENSAJES_VENCIMIENTO[validacionVencimiento.error]
    }
  }

  if (!validarTextoOpcional(descripcion.value, 'descripcion', MAX_DESCRIPCION_LENGTH).valido) {
    errores.descripcion_demasiado_largo = 'La descripción no debe superar los 1000 caracteres.'
  }

  if (!validarTextoOpcional(observaciones.value, 'observaciones', MAX_OBSERVACIONES_LENGTH).valido) {
    errores.observaciones_demasiado_largo = 'Las observaciones no deben superar los 2000 caracteres.'
  }

  if (modoAsignacion.value && contadorId.value === null) {
    errores.contador_required = 'Elige el contador que atenderá el caso.'
  }

  return errores
}

const submitCase = async () => {
  if (cases.guardando) return

  errorGuardado.value = null

  const clienteLimpio = client.value.trim()
  const prioridadBackend = prioridadABackend(priority.value)
  const fechaLimpia = fechaInicio.value.trim()

  // Se revisan todos los campos a la vez: el contador ve juntos todos los errores.
  erroresCampo.value = validarFormulario(clienteLimpio, prioridadBackend, fechaLimpia)
  if (Object.keys(erroresCampo.value).length > 0) {
    enfocarPrimerError()
    return
  }

  if (modoEdicion.value) {
    if (!hayCambios.value) return

    const edicion = await cases.actualizarCaso(props.caso.id, cambios.value)
    if (!edicion.ok) {
      errorGuardado.value = edicion.error ?? null
      return
    }

    dialogoAbierto.value = false
    emit('guardado', edicion.caso)
    return
  }

  const datosDelCaso = {
    cliente: clienteLimpio,
    prioridad: prioridadBackend,
    fecha_inicio: fechaLimpia || undefined,
    descripcion: descripcion.value || undefined,
    observaciones: observaciones.value || undefined,
    importante: importante.value,
    fecha_vencimiento: fechaVencimiento.value.trim(),
  }
  const resultado = modoAuxiliar.value
    ? await auxiliares.crearCasoComoAuxiliar(props.contadorDuenioId, datosDelCaso)
    : modoAsignacion.value
      ? await cases.asignarCaso(contadorId.value, [
          datosDelCaso.cliente,
          datosDelCaso.prioridad,
          datosDelCaso.fecha_inicio,
          datosDelCaso.descripcion,
          datosDelCaso.observaciones,
          datosDelCaso.importante,
          datosDelCaso.fecha_vencimiento,
        ])
      : await cases.crearCaso(
          datosDelCaso.cliente,
          datosDelCaso.prioridad,
          datosDelCaso.fecha_inicio,
          datosDelCaso.descripcion,
          datosDelCaso.observaciones,
          datosDelCaso.importante,
          datosDelCaso.fecha_vencimiento,
        )

  if (!resultado.ok) {
    errorGuardado.value = resultado.error ?? null
    return
  }

  reiniciarFormulario()
  dialogoAbierto.value = false
  emit('registrado', resultado.caso)
}
</script>

<style scoped>
/* Más ancho que el tope de 560 px de Quasar para repartir los campos en dos columnas. */
.registro-caso {
  width: min(860px, calc(100vw - 32px));
  max-width: none !important;
  min-width: 0;
}

.registro-caso__form {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.registro-caso__head {
  padding-bottom: 0;
}

.registro-caso__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.registro-caso__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

/* Una columna en móvil; dos desde 700 px: Cliente | Prioridad, Inicio | Vencimiento, Estado | Importante, Descripción | Observaciones. */
.registro-caso__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px 20px;
  align-items: start;
  min-width: 0;
}

@media (min-width: 700px) {
  .registro-caso__body {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.registro-caso__ancho-completo {
  grid-column: 1 / -1;
}

.estado-fijo {
  display: flex;
  align-items: center;
  min-height: 40px;
  margin: 0;
  padding: 0 12px;
  border: 1px dashed var(--dg-borde-fuerte);
  border-radius: 4px;
  background: var(--dg-fondo-suave);
  color: var(--dg-texto);
  font-weight: 600;
}

.registro-caso__actions {
  min-width: 0;
  padding: 8px 16px 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.form-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--dg-texto);
}

.required-mark {
  color: var(--dg-error);
  font-weight: 700;
}

.form-help {
  margin: 0 0 4px;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}


.readonly-info {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--dg-fondo-seleccion);
  border: 1px solid var(--dg-borde-fuerte);
  border-radius: 8px;
  font-size: 0.9rem;
  min-width: 0;
}

.readonly-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.readonly-row dt {
  color: var(--dg-texto-tenue);
  font-weight: 600;
  min-width: 140px;
}

.readonly-row dd {
  margin: 0;
  color: var(--dg-texto);
  font-weight: 600;
  min-width: 0;
  overflow-wrap: anywhere;
}

.registro-caso__importante {
  align-self: flex-start;
  min-height: 44px;
  color: var(--dg-texto);
  font-weight: 600;
}

.registro-caso__calendario-icono {
  cursor: pointer;
  color: var(--dg-acento);
}

.registro-caso__ayuda-icono {
  cursor: help;
  color: var(--dg-acento);
}

.priority-selected {
  display: inline-flex;
}


/* Confirmación de descartar: mismo aspecto que la de cerrar sesión. */
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
