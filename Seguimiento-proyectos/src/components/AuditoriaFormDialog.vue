<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="auditoria-titulo"
    @show="enfocarCliente"
    @shake="pedirDescartar"
  >
    <q-card ref="tarjeta" class="auditoria-form">
      <q-form class="auditoria-form__form" novalidate :aria-label="textos.formulario" @submit="submit">
        <q-card-section class="auditoria-form__head">
          <h2 id="auditoria-titulo" class="auditoria-form__title">{{ textos.titulo }}</h2>
          <p class="auditoria-form__help">{{ textos.ayuda }}</p>
        </q-card-section>

        <q-card-section class="auditoria-form__body">
          <fieldset class="auditoria-form__seccion">
            <legend class="auditoria-form__seccion-titulo">Identificación</legend>

            <div class="form-group">
              <label for="aud-cliente" class="form-label">Cliente <span aria-hidden="true" class="required-mark">*</span></label>
              <q-input
                ref="clienteInput"
                v-model="cliente"
                for="aud-cliente"
                type="text"
                placeholder="Nombre del cliente auditado"
                maxlength="100"
                outlined
                dense
                counter
                class="input-moderno"
                aria-required="true"
                :error="!!errorDeCampo('cliente')"
                :error-message="errorDeCampo('cliente')"
                @update:model-value="clearError('cliente')"
              >
                <template #prepend>
                  <q-icon name="person" />
                </template>
              </q-input>
            </div>

            <div class="form-group">
              <label for="aud-expediente" class="form-label">No. de expediente / orden <span aria-hidden="true" class="required-mark">*</span></label>
              <q-input
                v-model="noExpediente"
                for="aud-expediente"
                type="text"
                placeholder="VDM-0001/2026"
                maxlength="100"
                outlined
                dense
                counter
                class="input-moderno"
                aria-required="true"
                :error="!!errorDeCampo('noExpediente')"
                :error-message="errorDeCampo('noExpediente')"
                @update:model-value="clearError('noExpediente')"
              >
                <template #prepend>
                  <q-icon name="folder_open" />
                </template>
              </q-input>
            </div>

            <div class="form-group">
              <label for="aud-dependencia" class="form-label">Dependencia <span aria-hidden="true" class="required-mark">*</span></label>
              <q-input
                v-model="dependencia"
                for="aud-dependencia"
                type="text"
                placeholder="Quién audita: SAT – ADAF, Secretaría de Finanzas…"
                maxlength="200"
                outlined
                dense
                counter
                class="input-moderno"
                aria-required="true"
                :error="!!errorDeCampo('dependencia')"
                :error-message="errorDeCampo('dependencia')"
                @update:model-value="clearError('dependencia')"
              >
                <template #prepend>
                  <q-icon name="account_balance" />
                </template>
              </q-input>
            </div>

            <div class="form-group">
              <label for="aud-tipo" class="form-label">Tipo de auditoría <span aria-hidden="true" class="required-mark">*</span></label>
              <q-select
                for="aud-tipo"
                :model-value="tipoAud"
                :options="opcionesTipo"
                use-input
                hide-selected
                fill-input
                input-debounce="0"
                placeholder="Elige o escribe: Revisión de Gabinete, Visita Domiciliaria…"
                outlined
                dense
                options-dense
                dropdown-icon="expand_more"
                popup-content-class="menu-seleccion-custom"
                transition-show="jump-down"
                transition-hide="jump-up"
                :transition-duration="180"
                class="selector-moderno"
                aria-required="true"
                :error="!!errorDeCampo('tipoAud')"
                :error-message="errorDeCampo('tipoAud')"
                @filter="filtrarTipos"
                @input-value="escribirTipo"
                @update:model-value="elegirTipo"
              >
                <template #prepend>
                  <q-icon name="category" />
                </template>
                <template #option="{ itemProps, opt, selected }">
                  <q-item
                    v-bind="itemProps"
                    :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                  >
                    <q-item-section>
                      <q-item-label>{{ opt }}</q-item-label>
                    </q-item-section>
                    <q-item-section v-if="selected" side>
                      <q-icon name="check" size="18px" color="primary" />
                    </q-item-section>
                  </q-item>
                </template>
                <q-tooltip>Puedes elegir un tipo de la lista o escribir otro.</q-tooltip>
              </q-select>
            </div>

            <div class="form-group auditoria-form__ancho-completo auditoria-form__toggle">
              <q-toggle v-model="estatal" color="dg-acento" label="Auditoría estatal" aria-describedby="estatal-help">
                <q-tooltip>Marca si la audita una autoridad estatal (impuestos locales).</q-tooltip>
              </q-toggle>
              <p id="estatal-help" class="form-help">Actívalo si la auditoría es de alcance estatal.</p>
            </div>
          </fieldset>

          <fieldset class="auditoria-form__seccion">
            <legend class="auditoria-form__seccion-titulo">Periodo y fechas</legend>

            <div v-for="campo in CAMPOS_FECHA" :key="campo.clave" class="form-group">
              <label :for="`aud-${campo.clave}`" class="form-label">{{ campo.etiqueta }} <span aria-hidden="true" class="required-mark">*</span></label>
              <q-input
                :for="`aud-${campo.clave}`"
                v-model="fechas[campo.clave]"
                type="text"
                placeholder="DD-MM-AAAA"
                maxlength="10"
                outlined
                dense
                class="input-moderno"
                aria-required="true"
                :hint="campo.ayuda"
                :error="!!errorDeCampo(campo.clave)"
                :error-message="errorDeCampo(campo.clave)"
                @update:model-value="clearError(campo.clave)"
              >
                <template #prepend>
                  <q-icon name="calendar_month" />
                </template>
                <template #append>
                  <q-icon
                    name="event"
                    class="auditoria-form__cal"
                    tabindex="0"
                    role="button"
                    :aria-label="`Abrir calendario: ${campo.etiqueta}`"
                  >
                    <q-popup-proxy
                      :breakpoint="700"
                      transition-show="jump-down"
                      transition-hide="jump-up"
                      :transition-duration="180"
                    >
                      <q-date
                        v-model="fechas[campo.clave]"
                        mask="DD-MM-YYYY"
                        today-btn
                        :options="campo.desde ? (dia) => diaNoAnterior(dia, fechas[campo.desde]) : undefined"
                        @update:model-value="clearError(campo.clave)"
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
          </fieldset>

          <fieldset class="auditoria-form__seccion">
            <legend class="auditoria-form__seccion-titulo">Estado y asignación</legend>

            <div v-if="modoEdicion" class="form-group">
              <label for="aud-estado" class="form-label">Estado de la auditoría <span aria-hidden="true" class="required-mark">*</span></label>
              <q-select
                for="aud-estado"
                v-model="estado"
                :options="opcionesEstado"
                outlined
                dense
                options-dense
                dropdown-icon="expand_more"
                popup-content-class="menu-seleccion-custom"
                transition-show="jump-down"
                transition-hide="jump-up"
                :transition-duration="180"
                class="selector-moderno"
                aria-required="true"
                :error="!!errorDeCampo('estado')"
                :error-message="errorDeCampo('estado')"
              >
                <template #prepend>
                  <q-icon name="tune" />
                </template>
                <template #option="{ itemProps, opt, selected }">
                  <q-item
                    v-bind="itemProps"
                    :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                  >
                    <q-item-section>
                      <q-item-label>{{ opt }}</q-item-label>
                    </q-item-section>
                    <q-item-section v-if="selected" side>
                      <q-icon name="check" size="18px" color="primary" />
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>
            <div v-else class="form-group">
              <span class="form-label">Estado de la auditoría</span>
              <p class="estado-fijo">Pendiente</p>
            </div>

            <div v-if="esAdmin" class="form-group">
              <label for="aud-contadores" class="form-label">Contadores asignados <span aria-hidden="true" class="required-mark">*</span></label>
              <q-select
                for="aud-contadores"
                v-model="contadoresSeleccionados"
                :options="opcionesContador"
                option-label="label"
                option-value="value"
                multiple
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
                use-chips
                aria-required="true"
                :error="!!errorDeCampo('contadores')"
                :error-message="errorDeCampo('contadores')"
                @update:model-value="clearError('contadores')"
              >
                <template #prepend>
                  <q-icon name="group" />
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
              </q-select>
            </div>
            <div v-else-if="!modoEdicion" class="form-group">
              <span class="form-label">Contadores asignados</span>
              <p class="estado-fijo">Tú quedas asignado</p>
            </div>
          </fieldset>

          <fieldset class="auditoria-form__seccion">
            <legend class="auditoria-form__seccion-titulo">Notas (opcional)</legend>

            <div class="form-group auditoria-form__ancho-completo">
              <label for="aud-descripcion" class="form-label">Descripción</label>
              <q-input
                for="aud-descripcion"
                v-model="descripcion"
                type="textarea"
                placeholder="Qué se revisa: impuestos, ejercicio, alcance…"
                outlined
                dense
                rows="2"
                maxlength="2000"
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

            <div class="form-group auditoria-form__ancho-completo">
              <label for="aud-observacion" class="form-label">Observación</label>
              <q-input
                for="aud-observacion"
                v-model="observacion"
                type="textarea"
                placeholder="Notas de seguimiento para el equipo"
                outlined
                dense
                rows="3"
                maxlength="2000"
                counter
                class="input-moderno"
                :error="!!errorDeCampo('observacion')"
                :error-message="errorDeCampo('observacion')"
                @update:model-value="clearError('observacion')"
              >
                <template #prepend>
                  <q-icon name="sticky_note_2" />
                </template>
              </q-input>
            </div>
          </fieldset>

          <ErrorState
            v-if="errorGuardado"
            class="auditoria-form__error"
            :title="textos.errorGuardado"
            :detail="mensajeError"
            @retry="submit"
          />
        </q-card-section>

        <q-card-actions align="right" class="auditoria-form__actions">
          <q-btn flat no-caps label="Cancelar" class="control-touch boton-presionable" :disable="guardando" @click="cerrar">
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
        aria-labelledby="descartar-auditoria-titulo"
      >
        <q-card class="confirmar-descartar">
          <q-card-section>
            <h2 id="descartar-auditoria-titulo" class="confirmar-descartar__titulo">¿Descartar los cambios?</h2>
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
import { actualizarAuditoria, registrarAuditoria } from '../services/auditoriaService.js'
import { fechaADominioBackend } from '../utils/fechasCaso.js'
import { TIPOS_AUDITORIA, campoConError, diaNoAnterior, filtrarSugerencias } from '../utils/formularioAuditoria.js'

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  auditoria: {
    type: Object,
    default: null,
  },
  /** Contadores asignables { id, nombre } (solo los usa el administrador). */
  contadores: {
    type: Array,
    default: () => [],
  },
  /** El administrador elige a los contadores; al contador que registra lo asigna el backend. */
  esAdmin: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['registrada', 'guardada'])

const modoEdicion = computed(() => props.auditoria !== null)

const TEXTOS_REGISTRO = {
  titulo: 'Registrar auditoría',
  formulario: 'Formulario de registro de auditoría',
  ayuda: 'Completa los campos marcados con *. El estado inicial siempre es Pendiente.',
  boton: 'Registrar auditoría',
  tooltipBoton: 'Guarda la auditoría.',
  tooltipCancelar: 'Cierra el formulario sin registrar la auditoría.',
  errorGuardado: 'No se pudo registrar la auditoría',
}

const TEXTOS_EDICION = {
  titulo: 'Editar auditoría',
  formulario: 'Formulario de edición de auditoría',
  ayuda: 'Cambia los datos que necesites de la auditoría.',
  boton: 'Guardar cambios',
  tooltipBoton: 'Guarda los cambios de la auditoría.',
  tooltipCancelar: 'Cierra el formulario sin guardar los cambios.',
  errorGuardado: 'No se pudieron guardar los cambios',
}

// Fechas del formulario; `desde` bloquea en el calendario los días anteriores a esa otra fecha.
const CAMPOS_FECHA = [
  {
    clave: 'periodoInicio',
    etiqueta: 'Periodo revisado: desde',
    ayuda: 'Primer día del periodo que se revisa.',
    requerido: 'Escribe la fecha de inicio del periodo revisado.',
  },
  {
    clave: 'periodoFinal',
    etiqueta: 'Periodo revisado: hasta',
    desde: 'periodoInicio',
    ayuda: 'Último día del periodo que se revisa; no puede ser anterior al inicio.',
    requerido: 'Escribe el final del periodo revisado.',
    anterior: 'El final del periodo no puede ser anterior a su inicio.',
  },
  {
    clave: 'fechaInicio',
    etiqueta: 'Fecha de inicio',
    ayuda: 'Notificación de inicio de la auditoría.',
    requerido: 'Escribe la fecha de inicio.',
  },
  {
    clave: 'fechaVencimiento',
    etiqueta: 'Fecha de vencimiento',
    desde: 'fechaInicio',
    ayuda: 'Plazo de la autoridad para concluir; no puede ser anterior a la fecha de inicio.',
    requerido: 'Escribe la fecha de vencimiento.',
    anterior: 'La fecha de vencimiento no puede ser anterior a la fecha de inicio.',
  },
]

// Campos de texto obligatorios y su mensaje, en el orden del formulario (el foco va al primero).
const CAMPOS_TEXTO = [
  ['cliente', 'Escribe el nombre del cliente.'],
  ['noExpediente', 'Escribe el no. de expediente u orden.'],
  ['dependencia', 'Escribe la dependencia que audita.'],
  ['tipoAud', 'Elige o escribe el tipo de auditoría.'],
]

const textos = computed(() => (modoEdicion.value ? TEXTOS_EDICION : TEXTOS_REGISTRO))

const guardando = ref(false)

const cliente = ref('')
const noExpediente = ref('')
const dependencia = ref('')
const tipoAud = ref('')
const estatal = ref(false)
const fechas = ref({ periodoInicio: '', periodoFinal: '', fechaInicio: '', fechaVencimiento: '' })
const descripcion = ref('')
const observacion = ref('')
const estado = ref('Pendiente')
const contadoresSeleccionados = ref([])

const clienteInput = ref(null)
const tarjeta = ref(null)
// Errores de validación por campo: { cliente: 'Escribe el nombre del cliente.', … }.
const erroresCampo = ref({})
const errorGuardado = ref(null)
const confirmacionAbierta = ref(false)
// Foto del formulario al abrirlo: si algo cambió, cerrar pide confirmación.
const fotoInicial = ref('')

const opcionesEstado = ['Pendiente', 'En Proceso', 'Completado', 'Aplazado por acta']
const opcionesTipo = ref([...TIPOS_AUDITORIA])

const opcionesContador = computed(() =>
  (props.contadores ?? []).map((c) => ({ label: c.nombre, value: c.id })),
)

// Sin mensaje del servidor: se aclara que lo escrito sigue ahí (recargar la página lo perdería).
const mensajeError = computed(
  () =>
    errorGuardado.value?.mensaje ??
    'Qué ocurrió: No se guardó la auditoría. Sobre: la conexión con el servidor. Qué hacer: Revisa tu conexión y pulsa «Reintentar»; tus datos siguen en el formulario.',
)

/** Al escribir en un campo se borra solo su error; los de los demás siguen a la vista. */
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

const fotoDelFormulario = () =>
  JSON.stringify([
    cliente.value,
    noExpediente.value,
    dependencia.value,
    tipoAud.value,
    estatal.value,
    fechas.value,
    descripcion.value,
    observacion.value,
    estado.value,
    contadoresSeleccionados.value,
  ])

const hayDatosSinGuardar = computed(() => fotoDelFormulario() !== fotoInicial.value)

const enfocarCliente = () => {
  nextTick(() => clienteInput.value?.focus())
}

// Tipo de auditoría: sugerencias del boceto, pero se acepta cualquier texto escrito.
const filtrarTipos = (texto, actualizar) => {
  actualizar(() => {
    opcionesTipo.value = filtrarSugerencias(TIPOS_AUDITORIA, texto)
  })
}

const escribirTipo = (texto) => {
  tipoAud.value = texto
  clearError('tipoAud')
}

const elegirTipo = (valor) => {
  tipoAud.value = valor ?? ''
  clearError('tipoAud')
}

const reiniciarFormulario = () => {
  const a = props.auditoria
  cliente.value = a?.cliente ?? ''
  noExpediente.value = a?.noExpediente ?? ''
  dependencia.value = a?.dependencia ?? ''
  tipoAud.value = a?.tipoAud ?? ''
  estatal.value = Boolean(a?.estatal)
  fechas.value = {
    periodoInicio: a?.periodoInicio ?? '',
    periodoFinal: a?.periodoFinal ?? '',
    fechaInicio: a?.fechaInicio ?? '',
    fechaVencimiento: a?.fechaVencimiento ?? '',
  }
  descripcion.value = a?.descripcion ?? ''
  observacion.value = a?.observacion ?? ''
  estado.value = a?.estado ?? 'Pendiente'
  contadoresSeleccionados.value = (a?.contadores ?? []).map((c) => c.id)
  erroresCampo.value = {}
  errorGuardado.value = null
  fotoInicial.value = fotoDelFormulario()
}

watch(dialogoAbierto, (abierto) => {
  if (abierto) reiniciarFormulario()
})

// Esc o clic fuera con datos escritos (el diálogo es persistente y «sacude»): se pregunta antes.
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

const vacio = (valor) => !valor || String(valor).trim() === ''

/** Todos los errores a la vez, por campo ({} si todo está bien). */
const validarFormulario = () => {
  const errores = {}
  const textos = { cliente, noExpediente, dependencia, tipoAud }
  for (const [campo, mensaje] of CAMPOS_TEXTO) {
    if (vacio(textos[campo].value)) errores[campo] = mensaje
  }
  for (const campo of CAMPOS_FECHA) {
    const valor = fechas.value[campo.clave]
    if (vacio(valor)) {
      errores[campo.clave] = campo.requerido
    } else if (!fechaADominioBackend(valor)) {
      errores[campo.clave] = 'Escribe la fecha como DD-MM-AAAA.'
    } else if (campo.desde) {
      // AAAA-MM-DD se compara como texto; solo si la otra fecha también es válida.
      const desde = fechaADominioBackend(fechas.value[campo.desde])
      if (desde && fechaADominioBackend(valor) < desde) errores[campo.clave] = campo.anterior
    }
  }
  if (props.esAdmin && contadoresSeleccionados.value.length === 0) {
    errores.contadores = 'Elige al menos un contador.'
  }
  return errores
}

const submit = async () => {
  if (guardando.value) return
  errorGuardado.value = null

  erroresCampo.value = validarFormulario()
  if (Object.keys(erroresCampo.value).length > 0) {
    enfocarPrimerError()
    return
  }

  guardando.value = true
  try {
    const datos = {
      cliente: cliente.value.trim(),
      noExpediente: noExpediente.value.trim(),
      dependencia: dependencia.value.trim(),
      tipoAud: tipoAud.value.trim(),
      estatal: estatal.value,
      ...Object.fromEntries(CAMPOS_FECHA.map(({ clave }) => [clave, fechas.value[clave].trim()])),
      descripcion: descripcion.value.trim(),
      observacion: observacion.value.trim(),
    }
    // Solo el administrador manda contadores: el backend rechaza que un contador los cambie.
    if (props.esAdmin) datos.contadores = [...contadoresSeleccionados.value]

    if (modoEdicion.value) {
      datos.estado = estado.value
      emit('guardada', await actualizarAuditoria(props.auditoria.id, datos))
    } else {
      emit('registrada', await registrarAuditoria(datos))
    }
    dialogoAbierto.value = false
  } catch (error) {
    // Si el error nombra un campo, se muestra junto a él; si no, en el aviso general.
    const campo = campoConError(error?.mensaje)
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
.auditoria-form {
  width: min(920px, calc(100vw - 32px));
  max-width: none !important;
}

.auditoria-form__form {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.auditoria-form__head {
  padding-bottom: 0;
}

.auditoria-form__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
}

.auditoria-form__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.auditoria-form__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px 20px;
  align-items: start;
}

@media (min-width: 700px) {
  .auditoria-form__body {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.auditoria-form__ancho-completo {
  grid-column: 1 / -1;
}

.auditoria-form__toggle {
  align-self: flex-start;
}

.auditoria-form__actions {
  padding: 8px 16px 16px;
}

.auditoria-form__cal {
  cursor: pointer;
  color: var(--dg-acento);
}

.auditoria-form__error {
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

.auditoria-form__seccion {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px 20px;
  /* Un fieldset no se encoge por defecto; sin esto desborda en el celular */
  min-width: 0;
  margin: 0;
  padding: 12px 14px 4px;
  border: 1px solid var(--dg-borde);
  border-radius: 10px;
}

@media (min-width: 700px) {
  .auditoria-form__seccion {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.auditoria-form__seccion-titulo {
  padding: 0 6px;
  color: var(--dg-acento);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

/* Confirmación de descartar: mismo aspecto que en el formulario de casos. */
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
