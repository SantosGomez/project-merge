<template>
  <section class="bitacora" aria-labelledby="bitacora-titulo">
    <div class="bitacora__encabezado">
      <h2 id="bitacora-titulo" class="bitacora__titulo">Bitácora</h2>
      <div class="bitacora__controles">
        <q-btn-toggle
          v-model="vista"
          :options="opcionesVista"
          no-caps
          unelevated
          toggle-color="primary"
          color="dg-neutro-fondo"
          text-color="dg-texto"
          class="bitacora__vista"
          aria-label="Cómo ver la bitácora"
        />
        <q-btn
          v-if="!formularioAbierto"
          color="primary"
          no-caps
          unelevated
          icon="add_circle"
          label="Agregar evento"
          class="control-touch boton-presionable"
          @click="abrirNuevo"
        >
          <q-tooltip>Registra un oficio, requerimiento, acta, multa o entrega.</q-tooltip>
        </q-btn>
      </div>
    </div>
    <p class="bitacora__ayuda">
      Cada oficio, requerimiento, acta o entrega es un evento, del más antiguo al más reciente. Los
      que tienen plazo pendiente muestran cuántos días faltan. Para editar o registrar una entrega,
      usa «Línea de tiempo».
    </p>

    <transition name="bitacora-form">
    <q-card v-if="formularioAbierto" ref="formulario" flat bordered class="bitacora__form-card">
      <q-form novalidate @submit="guardar">
        <q-card-section class="bitacora__form">
          <h3 class="bitacora__form-titulo bitacora__ancho">
            {{ eventoEnEdicion ? 'Editar evento' : 'Agregar evento' }}
          </h3>
          <div class="form-group bitacora__ancho">
            <label for="ev-evento" class="form-label">Evento <span aria-hidden="true" class="required-mark">*</span></label>
            <q-select
              for="ev-evento"
              :model-value="form.evento"
              :options="opcionesEvento"
              use-input
              hide-selected
              fill-input
              input-debounce="0"
              placeholder="Elige o escribe: orden de visita, requerimiento, acta parcial, multa…"
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
              :error="!!errorDeCampo('evento')"
              :error-message="errorDeCampo('evento')"
              @filter="filtrarEventos"
              @input-value="escribirEvento"
              @update:model-value="elegirEvento"
            >
              <template #prepend>
                <q-icon name="event_note" />
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
              <q-tooltip
                >Al elegir un evento de la lista se propone su fase; puedes cambiarla.</q-tooltip
              >
            </q-select>
          </div>
          <div class="form-group">
            <label for="ev-fase" class="form-label">Fase <span aria-hidden="true" class="required-mark">*</span></label>
            <q-select
              for="ev-fase"
              v-model="form.faseId"
              :options="opcionesFase"
              emit-value
              map-options
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
            >
              <template #prepend>
                <q-icon name="flag" />
              </template>
              <template #option="{ itemProps, opt, selected }">
                <q-item
                  v-bind="itemProps"
                  :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                >
                  <q-item-section>
                    <q-item-label>{{ opt.label }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="selected" side>
                    <q-icon name="check" size="18px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
              <q-tooltip>Etapa del procedimiento a la que pertenece el evento.</q-tooltip>
            </q-select>
          </div>
          <div class="form-group">
            <label for="ev-estado" class="form-label">Estado <span aria-hidden="true" class="required-mark">*</span></label>
            <q-select
              for="ev-estado"
              v-model="form.estado"
              :options="ESTADOS_EVENTO"
              :option-label="etiquetaEstadoEvento"
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
                    <q-item-label>{{ etiquetaEstadoEvento(opt) }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="selected" side>
                    <q-icon name="check" size="18px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </div>
          <div v-for="campo in CAMPOS_FECHA" :key="campo.clave" class="form-group">
            <label :for="`ev-${campo.clave}`" class="form-label">
              {{ campo.etiqueta }}
              <span v-if="campo.requerido" aria-hidden="true" class="required-mark">*</span>
            </label>
            <q-input
              :for="`ev-${campo.clave}`"
              v-model="form[campo.clave]"
              placeholder="DD-MM-AAAA"
              maxlength="10"
              outlined
              dense
              class="input-moderno"
              :aria-required="campo.requerido ? 'true' : 'false'"
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
                  class="bitacora__cal"
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
                      v-model="form[campo.clave]"
                      mask="DD-MM-YYYY"
                      today-btn
                      :options="
                        campo.desde ? (dia) => diaNoAnterior(dia, form[campo.desde]) : undefined
                      "
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
          <div class="form-group">
            <label for="ev-folio" class="form-label">Folio</label>
            <q-input
              for="ev-folio"
              v-model="form.folio"
              placeholder="Folio del oficio o acta"
              maxlength="200"
              outlined
              dense
              class="input-moderno"
            >
              <template #prepend>
                <q-icon name="tag" />
              </template>
            </q-input>
          </div>
          <div class="form-group bitacora__ancho">
            <label for="ev-descripcion" class="form-label">Descripción</label>
            <q-input
              for="ev-descripcion"
              v-model="form.descripcion"
              type="textarea"
              rows="2"
              maxlength="2000"
              outlined
              dense
              class="input-moderno"
            >
              <template #prepend>
                <q-icon name="description" />
              </template>
            </q-input>
          </div>
          <div class="form-group bitacora__ancho">
            <label for="ev-observaciones" class="form-label">Observaciones</label>
            <q-input
              for="ev-observaciones"
              v-model="form.observaciones"
              type="textarea"
              rows="2"
              maxlength="2000"
              outlined
              dense
              class="input-moderno"
            >
              <template #prepend>
                <q-icon name="sticky_note_2" />
              </template>
            </q-input>
          </div>
          <p v-if="errorGuardado" class="bitacora__error bitacora__ancho" role="alert">
            {{ errorGuardado.mensaje ?? 'No se pudo guardar el evento. Intenta de nuevo.' }}
          </p>
          <div class="bitacora__form-acciones">
            <q-btn
              flat
              no-caps
              label="Cancelar"
              class="control-touch boton-presionable"
              :disable="guardando"
              @click="cancelar"
            />
            <q-btn
              type="submit"
              color="primary"
              no-caps
              unelevated
              :icon="eventoEnEdicion ? 'save' : 'add'"
              :label="eventoEnEdicion ? 'Guardar cambios' : 'Agregar'"
              class="control-touch boton-presionable"
              :loading="guardando"
            >
              <q-tooltip>
                {{
                  eventoEnEdicion
                    ? 'Guarda los cambios del evento.'
                    : 'Agrega el evento a la bitácora.'
                }}
              </q-tooltip>
            </q-btn>
          </div>
        </q-card-section>
      </q-form>
    </q-card>
    </transition>

    <p v-if="cargando" class="bitacora__vacio" role="status">Cargando la bitácora…</p>

    <ErrorState
      v-else-if="errorCarga"
      title="No se pudo cargar la bitácora"
      :detail="errorCarga.mensaje ?? 'la bitácora de la auditoría.'"
      @retry="cargar"
    />

    <template v-else>
      <div v-if="eventos.length === 0" class="bitacora__vacio">
        Aún no hay eventos en la bitácora. Usa «Agregar evento» para registrar el primero.
      </div>

      <!-- En escritorio los eventos se desplazan dentro de un área de 600 px; en celular y
           tablet crecen con la página para no tener un scroll dentro de otro -->
      <component
        :is="conScroll ? QScrollArea : 'div'"
        v-else
        class="bitacora__scroll"
        :class="{ 'bitacora__scroll--fija': conScroll }"
      >
        <q-timeline v-show="vista === 'linea'" color="dg-acento" class="bitacora__timeline">
          <q-timeline-entry
            v-for="ev in eventos"
            :key="ev.id"
            :color="esUrgente(ev) ? 'dg-error' : 'dg-acento'"
            :icon="ev.plazo.pendiente ? 'schedule' : undefined"
          >
            <template #title>
              <span class="bitacora__evento">{{ ev.evento }}</span>
              <q-chip
                dense
                class="bitacora__estado"
                :class="`bitacora__estado--${estadoEventoClase(ev.estado)}`"
              >
                {{ etiquetaEstadoEvento(ev.estado) }}
              </q-chip>
            </template>
            <template #subtitle>
              <span class="bitacora__fecha">{{ ev.fecha }} · {{ ev.fase.nombre }}</span>
            </template>
            <div
              class="bitacora__contenido"
              :class="{ 'bitacora__contenido--pendiente': ev.plazo.pendiente }"
            >
              <p
                v-if="ev.plazo.pendiente"
                class="bitacora__plazo"
                :class="`bitacora__plazo--${SEMAFORO_CLASE[ev.plazo.semaforo]}`"
              >
                <q-icon name="timer" size="16px" aria-hidden="true" />
                Vence {{ ev.fechaLimite }} · {{ textoDiasPlazo(ev.plazo.dias) }}
              </p>
              <p v-if="ev.folio" class="bitacora__linea"><strong>Folio:</strong> {{ ev.folio }}</p>
              <p v-if="ev.fechaLimite && !ev.plazo.pendiente" class="bitacora__linea">
                <strong>Fecha límite:</strong> {{ ev.fechaLimite }}
              </p>
              <p v-if="ev.fechaEntrega" class="bitacora__linea">
                <strong>Fecha de entrega:</strong> {{ ev.fechaEntrega }}
              </p>
              <p v-if="ev.descripcion" class="bitacora__linea">
                <strong>Descripción:</strong> {{ ev.descripcion }}
              </p>
              <p v-if="ev.observaciones" class="bitacora__linea">
                <strong>Observaciones:</strong> {{ ev.observaciones }}
              </p>
              <p class="bitacora__linea bitacora__registro">
                Registró: {{ ev.registradoPor.nombre }}
              </p>
              <div class="bitacora__acciones">
                <q-btn
                  v-if="ev.plazo.pendiente"
                  unelevated
                  dense
                  no-caps
                  color="dg-exito"
                  icon="task_alt"
                  label="Registrar entrega"
                  class="control-touch boton-presionable"
                  :disable="guardando"
                  @click="confirmarEntrega(ev)"
                >
                  <q-tooltip>Marca el evento como Completado y entregado hoy.</q-tooltip>
                </q-btn>
                <q-btn
                  flat
                  dense
                  no-caps
                  color="primary"
                  icon="edit"
                  label="Editar"
                  class="control-touch boton-presionable"
                  :disable="guardando"
                  @click="editar(ev)"
                >
                  <q-tooltip
                    >Cambia los datos del evento, por ejemplo otra fecha de entrega.</q-tooltip
                  >
                </q-btn>
                <q-btn
                  flat
                  dense
                  no-caps
                  color="dg-error"
                  icon="delete"
                  label="Borrar"
                  class="control-touch boton-presionable"
                  :disable="guardando"
                  @click="confirmarBorrado(ev)"
                >
                  <q-tooltip
                    >Borra el evento si se capturó por error. No se puede deshacer.</q-tooltip
                  >
                </q-btn>
              </div>
            </div>
          </q-timeline-entry>
        </q-timeline>

        <!-- Historia en renglones, como la ficha del boceto; al imprimir siempre sale esta tabla -->
        <q-markup-table
          v-show="vista === 'tabla'"
          flat
          bordered
          dense
          separator="cell"
          wrap-cells
          class="bitacora__tabla"
          :class="{ 'bitacora__solo-impresion': vista !== 'tabla' }"
        >
          <thead>
            <tr>
              <th class="text-left">Fecha</th>
              <th class="text-left">Evento</th>
              <th class="text-left">Fase</th>
              <th class="text-left">Folio</th>
              <th class="text-left">Descripción</th>
              <th class="text-left">Fecha límite</th>
              <th class="text-left">Fecha de entrega</th>
              <th class="text-left">Estado</th>
              <th class="text-left">¿En tiempo?</th>
              <th class="text-left">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ev in eventos"
              :key="ev.id"
              :class="{ 'bitacora__fila--urgente': esUrgente(ev) }"
            >
              <td class="bitacora__celda-fecha">{{ ev.fecha }}</td>
              <td class="bitacora__celda-evento">{{ ev.evento }}</td>
              <td>{{ ev.fase.id }} · {{ nombreCorto(ev.fase.nombre) }}</td>
              <td>{{ ev.folio }}</td>
              <td>{{ ev.descripcion }}</td>
              <td class="bitacora__celda-fecha">{{ ev.fechaLimite }}</td>
              <td class="bitacora__celda-fecha">{{ ev.fechaEntrega }}</td>
              <td>{{ etiquetaEstadoEvento(ev.estado) }}</td>
              <td :class="`bitacora__en-tiempo--${CLASE_EN_TIEMPO[entregaEnTiempo(ev)]}`">
                {{ entregaEnTiempo(ev) }}
              </td>
              <td>{{ ev.observaciones }}</td>
            </tr>
          </tbody>
        </q-markup-table>
      </component>
    </template>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { QScrollArea, useQuasar } from 'quasar'

import ErrorState from './ErrorState.vue'
import {
  actualizarEvento,
  borrarEvento,
  listarEventos,
  registrarEvento,
} from '../services/auditoriaService.js'
import { fechaADominioBackend } from '../utils/fechasCaso.js'
import { entregaEnTiempo, nombreCorto, plazoDeEvento } from '../utils/listaAuditorias.js'
import { textoDiasPlazo } from '../utils/semaforoAuditoria.js'
import {
  EVENTOS_SUGERIDOS,
  diaNoAnterior,
  faseSugerida,
  filtrarSugerencias,
} from '../utils/formularioAuditoria.js'

const props = defineProps({
  auditoriaId: {
    type: Number,
    required: true,
  },
  /** Catálogo de fases { id, nombre } (lo carga la ficha). */
  fases: {
    type: Array,
    default: () => [],
  },
})

// Avisa a la ficha que la bitácora cambió (fase actual, vencimiento y semáforo se recalculan).
const emit = defineEmits(['cambio'])

const $q = useQuasar()

const ESTADO_EVENTO_CLASE = {
  Pendiente: 'pendiente',
  Revision: 'revision',
  'En Proceso': 'en-proceso',
  Rechazado: 'rechazado',
  Completado: 'completado',
}
const ESTADOS_EVENTO = Object.keys(ESTADO_EVENTO_CLASE)
// En pantalla, como en el resto de la app; en la base se guarda el valor de siempre.
const ETIQUETA_ESTADO_EVENTO = { Revision: 'En revisión', 'En Proceso': 'En proceso' }
const etiquetaEstadoEvento = (estado) => ETIQUETA_ESTADO_EVENTO[estado] ?? estado
const SEMAFORO_CLASE = {
  Vencido: 'vencido',
  Crítico: 'critico',
  Atención: 'atencion',
  'En tiempo': 'en-tiempo',
}
const CAMPOS_FECHA = [
  {
    clave: 'fecha',
    etiqueta: 'Fecha del evento',
    requerido: true,
    ayuda: 'Día en que se notificó o sucedió el evento.',
    mensajeRequerido: 'Escribe la fecha del evento.',
  },
  {
    clave: 'fechaLimite',
    etiqueta: 'Fecha límite',
    requerido: false,
    desde: 'fecha',
    ayuda: 'Hasta cuándo hay para atenderlo (opcional); no antes de la fecha del evento.',
    anterior: 'La fecha límite no puede ser anterior a la fecha del evento.',
  },
  {
    clave: 'fechaEntrega',
    etiqueta: 'Fecha de entrega',
    requerido: false,
    desde: 'fecha',
    ayuda: 'Cuándo se entregó o atendió (opcional); no antes de la fecha del evento.',
    anterior: 'La fecha de entrega no puede ser anterior a la fecha del evento.',
  },
]

// Evento: sugerencias del boceto con su fase; se acepta cualquier texto escrito.
const NOMBRES_EVENTO = EVENTOS_SUGERIDOS.map((s) => s.evento)
const opcionesEvento = ref([...NOMBRES_EVENTO])

const filtrarEventos = (texto, actualizar) => {
  actualizar(() => {
    opcionesEvento.value = filtrarSugerencias(NOMBRES_EVENTO, texto)
  })
}

const elegirEvento = (valor) => {
  form.value.evento = valor ?? ''
  const fase = faseSugerida(form.value.evento)
  if (fase) form.value.faseId = fase
}

const estadoEventoClase = (estado) => ESTADO_EVENTO_CLASE[estado] ?? 'pendiente'

// Línea de tiempo (con acciones) o tabla (historia completa, como la ficha del boceto).
const vista = ref('linea')
const opcionesVista = [
  { label: 'Línea de tiempo', value: 'linea', icon: 'timeline' },
  { label: 'Tabla', value: 'tabla', icon: 'table_rows' },
]
const CLASE_EN_TIEMPO = { Sí: 'si', No: 'no', '—': 'sin-dato' }

// Desde 1024 px los eventos van en un QScrollArea de alto fijo.
const conScroll = computed(() => $q.screen.width >= 1024)

// El rojo queda para lo urgente: un plazo pendiente vencido o a 7 días o menos.
const esUrgente = (ev) => ev.plazo.pendiente && ['Vencido', 'Crítico'].includes(ev.plazo.semaforo)

// Fecha local de hoy en DD-MM-AAAA (sin pasar por UTC).
const hoyDDMM = () => {
  const hoy = new Date()
  return (
    [hoy.getDate(), hoy.getMonth() + 1].map((n) => String(n).padStart(2, '0')).join('-') +
    `-${hoy.getFullYear()}`
  )
}

const eventosCrudos = ref([])
const eventos = computed(() =>
  eventosCrudos.value.map((ev) => ({ ...ev, plazo: plazoDeEvento(ev) })),
)
const cargando = ref(false)
const errorCarga = ref(null)

const opcionesFase = computed(() => props.fases.map((f) => ({ label: f.nombre, value: f.id })))

const formularioVacio = () => ({
  evento: '',
  faseId: props.fases[0]?.id ?? null,
  estado: 'Pendiente',
  fecha: hoyDDMM(),
  fechaLimite: '',
  fechaEntrega: '',
  folio: '',
  descripcion: '',
  observaciones: '',
})

const form = ref(formularioVacio())
const formularioAbierto = ref(false)
const eventoEnEdicion = ref(null)
const guardando = ref(false)
const errorGuardado = ref(null)
// Errores de validación por campo: { evento: 'Escribe el evento.', … }.
const erroresCampo = ref({})
const formulario = ref(null)
// Foto del formulario al abrirlo: si algo cambió, cerrarlo o cambiar de evento pide confirmación.
const fotoInicial = ref('')
const hayDatosSinGuardar = computed(
  () => formularioAbierto.value && JSON.stringify(form.value) !== fotoInicial.value,
)

const errorDeCampo = (campo) => erroresCampo.value[campo] ?? null
const clearError = (campo) => {
  const restantes = { ...erroresCampo.value }
  delete restantes[campo]
  erroresCampo.value = restantes
}

const escribirEvento = (texto) => {
  form.value.evento = texto
  clearError('evento')
}

/** Lleva la vista y el foco al primer campo con error. */
const enfocarPrimerError = () =>
  nextTick(() => {
    const campo = formulario.value?.$el?.querySelector('.q-field--error')
    if (!campo) return
    campo.scrollIntoView({ block: 'center' })
    campo.querySelector('input, textarea, [tabindex="0"]')?.focus({ preventScroll: true })
  })

const cargar = async () => {
  cargando.value = true
  errorCarga.value = null
  try {
    eventosCrudos.value = await listarEventos(props.auditoriaId)
  } catch (error) {
    errorCarga.value = error
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

// Tras cualquier cambio se vuelve a leer para respetar el orden cronológico del backend.
const releer = async () => {
  eventosCrudos.value = await listarEventos(props.auditoriaId)
  emit('cambio')
}

/*
 * Lo guardado ya está en el servidor: si después falla la relectura, se dice así (no «no se pudo
 * guardar»), para que nadie repita un cambio que sí se hizo.
 */
const releerTrasCambio = async () => {
  try {
    await releer()
  } catch {
    $q.notify({
      type: 'negative',
      message: 'Se guardó, pero no se pudo actualizar la bitácora.',
      timeout: 8000,
      actions: [{ label: 'Reintentar', color: 'white', noCaps: true, handler: releerTrasCambio }],
    })
  }
}

// La ficha la llama en vivo y al volver a la ventana; si falla, se queda lo que se ve.
const refrescar = async () => {
  if (cargando.value || errorCarga.value) return
  try {
    eventosCrudos.value = await listarEventos(props.auditoriaId)
  } catch {
    // Se conserva la bitácora que ya se ve.
  }
}
defineExpose({ refrescar })

const DIALOGO = { transitionShow: 'dialogo-entra', transitionHide: 'dialogo-sale', transitionDuration: 220 }

/** Si hay datos sin guardar, pregunta antes de seguir; si no, sigue directo. */
const confirmarDescartar = (seguir) => {
  if (!hayDatosSinGuardar.value) return seguir()
  $q.dialog({
    ...DIALOGO,
    title: '¿Descartar los cambios?',
    message: 'Lo que escribiste en este evento se perderá.',
    cancel: { label: 'Seguir editando', flat: true, noCaps: true },
    ok: { label: 'Descartar', color: 'dg-error', noCaps: true, unelevated: true },
  }).onOk(seguir)
}

const abrirFormulario = (valores, ev = null) => {
  eventoEnEdicion.value = ev
  form.value = valores
  fotoInicial.value = JSON.stringify(valores)
  erroresCampo.value = {}
  errorGuardado.value = null
  formularioAbierto.value = true
  // El formulario aparece arriba de la lista: se lleva a la vista con el foco en «Evento».
  nextTick(() => {
    formulario.value?.$el?.scrollIntoView({ block: 'nearest' })
    document.getElementById('ev-evento')?.focus({ preventScroll: true })
  })
}

const abrirNuevo = () => abrirFormulario(formularioVacio())

const cerrarFormulario = () => {
  formularioAbierto.value = false
  eventoEnEdicion.value = null
  errorGuardado.value = null
  erroresCampo.value = {}
}

const cancelar = () => confirmarDescartar(cerrarFormulario)

const editar = (ev) => confirmarDescartar(() => abrirEdicion(ev))

const abrirEdicion = (ev) => {
  abrirFormulario({
    evento: ev.evento,
    faseId: ev.fase.id,
    estado: ev.estado,
    fecha: ev.fecha,
    fechaLimite: ev.fechaLimite,
    fechaEntrega: ev.fechaEntrega,
    folio: ev.folio,
    descripcion: ev.descripcion,
    observaciones: ev.observaciones,
  }, ev)
}

/** Todos los errores a la vez, por campo ({} si todo está bien). */
const validarFormulario = () => {
  const errores = {}
  if (form.value.evento.trim() === '') errores.evento = 'Escribe el evento.'
  const fechaEvento = fechaADominioBackend(form.value.fecha)
  for (const campo of CAMPOS_FECHA) {
    const valor = (form.value[campo.clave] ?? '').trim()
    if (valor === '') {
      if (campo.requerido) errores[campo.clave] = campo.mensajeRequerido
    } else if (!fechaADominioBackend(valor)) {
      errores[campo.clave] = 'Escribe la fecha como DD-MM-AAAA.'
    } else if (campo.anterior && fechaEvento && fechaADominioBackend(valor) < fechaEvento) {
      // AAAA-MM-DD se compara como texto.
      errores[campo.clave] = campo.anterior
    }
  }
  return errores
}

const guardar = async () => {
  if (guardando.value) return
  errorGuardado.value = null
  erroresCampo.value = validarFormulario()
  if (Object.keys(erroresCampo.value).length > 0) {
    enfocarPrimerError()
    return
  }
  guardando.value = true
  try {
    if (eventoEnEdicion.value) {
      await actualizarEvento(props.auditoriaId, eventoEnEdicion.value.id, form.value)
    } else {
      await registrarEvento(props.auditoriaId, form.value)
    }
  } catch (error) {
    errorGuardado.value = error
    return
  } finally {
    guardando.value = false
  }
  $q.notify({
    type: 'positive',
    message: eventoEnEdicion.value ? 'Evento actualizado.' : 'Evento agregado a la bitácora.',
  })
  cerrarFormulario()
  releerTrasCambio()
}

// Acción rápida: entregado hoy y Completado, sin abrir el formulario.
const registrarEntrega = async (ev) => {
  guardando.value = true
  try {
    await actualizarEvento(props.auditoriaId, ev.id, {
      fechaEntrega: hoyDDMM(),
      estado: 'Completado',
    })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.mensaje ?? 'No se pudo registrar la entrega.' })
    return
  } finally {
    guardando.value = false
  }
  $q.notify({ type: 'positive', message: `Entrega registrada: «${ev.evento}».` })
  releerTrasCambio()
}

// Registrar la entrega cierra el plazo del evento: se confirma antes, porque un toque basta.
const confirmarEntrega = (ev) => {
  $q.dialog({
    ...DIALOGO,
    title: '¿Registrar la entrega?',
    message: `«${ev.evento}» quedará como Completado con fecha de entrega de hoy (${hoyDDMM()}).`,
    cancel: { label: 'Cancelar', flat: true, noCaps: true },
    ok: { label: 'Registrar entrega', color: 'dg-exito', noCaps: true, unelevated: true },
  }).onOk(() => registrarEntrega(ev))
}

const confirmarBorrado = (ev) => {
  $q.dialog({
    ...DIALOGO,
    title: 'Borrar evento',
    message: `¿Borrar «${ev.evento}» del ${ev.fecha}? Esta acción no se puede deshacer.`,
    cancel: { label: 'Cancelar', flat: true, noCaps: true },
    ok: { label: 'Borrar evento', color: 'negative', noCaps: true, unelevated: true },
  }).onOk(async () => {
    guardando.value = true
    try {
      await borrarEvento(props.auditoriaId, ev.id)
    } catch (error) {
      $q.notify({ type: 'negative', message: error.mensaje ?? 'No se pudo borrar el evento.' })
      return
    } finally {
      guardando.value = false
    }
    if (eventoEnEdicion.value?.id === ev.id) cerrarFormulario()
    $q.notify({ type: 'positive', message: 'Evento borrado.' })
    releerTrasCambio()
  })
}
</script>

<style scoped>
.bitacora {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bitacora__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.bitacora__titulo {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.1rem;
  font-weight: 700;
}

.bitacora__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.bitacora__timeline {
  padding-left: 4px;
}

.bitacora__controles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.bitacora__vista :deep(.q-btn) {
  min-height: 40px;
}

.bitacora__scroll--fija {
  height: 600px;
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
}

/* Margen para que la barra de desplazamiento no tape el contenido */
.bitacora__scroll--fija :deep(.q-scrollarea__content) {
  padding: 8px 14px 8px 8px;
}

.bitacora__tabla {
  border-color: var(--dg-borde);
  background: var(--dg-superficie);
}

.bitacora__tabla th {
  color: var(--dg-texto-secundario);
  font-weight: 700;
}

.bitacora__tabla td {
  vertical-align: top;
  color: var(--dg-texto);
}

.bitacora__celda-fecha {
  white-space: nowrap;
}

.bitacora__celda-evento {
  font-weight: 600;
}

.bitacora__fila--urgente {
  background: var(--dg-error-fondo);
}

.bitacora__en-tiempo--si {
  color: var(--dg-exito);
  font-weight: 700;
}

.bitacora__en-tiempo--no {
  color: var(--dg-error);
  font-weight: 700;
}

.bitacora__en-tiempo--sin-dato {
  color: var(--dg-texto-tenue);
}

/* Impresión: la historia sale como tabla, sin línea de tiempo ni formulario */
@media print {
  .bitacora__tabla.bitacora__solo-impresion {
    display: block !important;
  }

  .bitacora__timeline,
  .bitacora__form-card,
  .bitacora__controles,
  .bitacora__ayuda {
    display: none !important;
  }

  /* Sin esto, algunos navegadores no imprimen el fondo de los plazos urgentes. */
  .bitacora__fila--urgente {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  /* El área con scroll se suelta para que salgan todos los eventos */
  .bitacora__scroll {
    height: auto !important;
    border: 0;
    contain: none;
    overflow: visible;
  }

  .bitacora__scroll :deep(.q-scrollarea__container) {
    height: auto !important;
    overflow: visible !important;
  }

  .bitacora__scroll :deep(.q-scrollarea__content) {
    position: static !important;
    padding: 0;
  }

  .bitacora__scroll :deep(.q-scrollarea__bar),
  .bitacora__scroll :deep(.q-scrollarea__thumb) {
    display: none;
  }
}

.bitacora__evento {
  color: var(--dg-texto);
  font-weight: 600;
  margin-right: 8px;
}

.bitacora__estado {
  font-size: 0.75rem;
  text-transform: none;
}

.bitacora__estado--pendiente {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.bitacora__estado--revision {
  background: var(--dg-neutro-fondo);
  color: var(--dg-texto-secundario);
}

.bitacora__estado--en-proceso {
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
}

.bitacora__estado--rechazado {
  background: var(--dg-error-fondo);
  color: var(--dg-error);
}

.bitacora__estado--completado {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.bitacora__fecha {
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
}

.bitacora__contenido {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Evento con plazo pendiente: recuadro para que destaque en la historia */
.bitacora__contenido--pendiente {
  padding: 8px 10px;
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
  background: var(--dg-fondo-suave);
}

.bitacora__plazo {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  margin: 0;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.bitacora__plazo--vencido {
  background: var(--dg-error);
  color: var(--dg-superficie);
}

.bitacora__plazo--critico {
  background: var(--dg-prioridad-alta-fondo);
  color: var(--dg-prioridad-alta);
}

.bitacora__plazo--atencion {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.bitacora__plazo--en-tiempo {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.bitacora__linea {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
  /* Respeta los saltos de línea de la descripción y las observaciones. */
  white-space: pre-line;
}

.bitacora__registro {
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
}

.bitacora__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 4px;
}

.bitacora__vacio {
  color: var(--dg-texto-tenue);
  font-size: 0.9rem;
  font-style: italic;
}

.bitacora__form-card {
  border-color: var(--dg-borde);
}

.bitacora__form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

@media (min-width: 600px) {
  .bitacora__form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.bitacora__form-titulo {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1rem;
  font-weight: 600;
}

.bitacora__ancho {
  grid-column: 1 / -1;
}

.bitacora__cal {
  cursor: pointer;
  color: var(--dg-acento);
}

.bitacora__error {
  margin: 0;
  color: var(--dg-error);
  font-size: 0.9rem;
}

.bitacora__form-acciones {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}

/* El formulario de evento aparece y se va con un fundido corto, sin saltar. */
.bitacora-form-enter-active,
.bitacora-form-leave-active {
  transition: opacity 180ms cubic-bezier(0.23, 1, 0.32, 1), transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
}

.bitacora-form-enter-from,
.bitacora-form-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .bitacora-form-enter-from,
  .bitacora-form-leave-to {
    transform: none;
  }
}
</style>
