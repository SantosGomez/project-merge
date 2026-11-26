<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="catalogo-cliente-titulo"
    @show="enfocarPrimerCampo"
    @shake="pedirDescartar"
  >
    <q-card ref="tarjeta" class="catalogo-cliente">
      <q-form
        class="catalogo-cliente__form"
        novalidate
        :aria-label="
          esEdicion ? 'Formulario para editar un cliente' : 'Formulario de nuevo cliente'
        "
        @submit="guardar"
      >
        <q-card-section>
          <h2 id="catalogo-cliente-titulo" class="catalogo-cliente__titulo">
            {{ esEdicion ? 'Editar datos del cliente' : 'Nuevo cliente' }}
          </h2>
          <p class="catalogo-cliente__ayuda">
            {{
              esEdicion
                ? 'Corrige los datos del cliente. Los campos con * son obligatorios.'
                : 'Registra un cliente en el catálogo del despacho. Los campos con * son obligatorios.'
            }}
          </p>
        </q-card-section>

        <q-card-section class="catalogo-cliente__cuerpo">
          <div class="catalogo-cliente__fila">
            <div class="form-group catalogo-cliente__clave">
              <label for="catalogo-cliente-clave" class="form-label"
                >Clave de carpeta <span aria-hidden="true" class="required-mark">*</span></label
              >
              <q-input
                for="catalogo-cliente-clave"
                v-model="form.clave"
                type="text"
                placeholder="Ej. 0001"
                maxlength="4"
                autocomplete="off"
                outlined
                dense
                class="input-moderno"
                input-class="catalogo-cliente__mayusculas"
                aria-required="true"
                aria-describedby="catalogo-cliente-clave-ayuda"
                :error="!!erroresCampo.clave"
                :error-message="erroresCampo.clave"
                @update:model-value="erroresCampo.clave = null"
              >
                <template #prepend><q-icon name="folder_shared" aria-hidden="true" /></template>
                <q-tooltip v-if="!erroresCampo.clave" anchor="top middle" self="bottom middle">
                  Clave corta que identifica la carpeta del cliente. Se guarda en mayúsculas.
                </q-tooltip>
              </q-input>
              <p id="catalogo-cliente-clave-ayuda" class="form-help">
                Hasta 4 caracteres, sin espacios.
              </p>
            </div>

            <div class="form-group catalogo-cliente__rfc">
              <label for="catalogo-cliente-rfc" class="form-label">RFC (opcional)</label>
              <q-input
                for="catalogo-cliente-rfc"
                v-model="form.rfc"
                type="text"
                placeholder="ABC010101XY1"
                maxlength="14"
                autocomplete="off"
                outlined
                dense
                class="input-moderno"
                input-class="catalogo-cliente__mayusculas"
                aria-describedby="catalogo-cliente-rfc-ayuda"
                :error="!!erroresCampo.rfc"
                :error-message="erroresCampo.rfc"
                @update:model-value="erroresCampo.rfc = null"
              >
                <template #prepend><q-icon name="badge" aria-hidden="true" /></template>
                <q-tooltip v-if="!erroresCampo.rfc" anchor="top middle" self="bottom middle">
                  RFC del cliente: 12 caracteres si es empresa o 13 si es persona física.
                </q-tooltip>
              </q-input>
              <p id="catalogo-cliente-rfc-ayuda" class="form-help">
                12 caracteres (empresa) o 13 (persona física).
              </p>
            </div>
          </div>

          <div class="form-group">
            <label for="catalogo-cliente-nombre" class="form-label"
              >Razón social <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="catalogo-cliente-nombre"
              v-model="form.nombre"
              type="text"
              placeholder="Nombre del cliente o de la empresa"
              maxlength="151"
              autocomplete="off"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              aria-describedby="catalogo-cliente-nombre-ayuda"
              :error="!!erroresCampo.nombre"
              :error-message="erroresCampo.nombre"
              @update:model-value="erroresCampo.nombre = null"
            >
              <template #prepend><q-icon name="business" aria-hidden="true" /></template>
              <q-tooltip v-if="!erroresCampo.nombre" anchor="top middle" self="bottom middle">
                Nombre o razón social completo del cliente.
              </q-tooltip>
            </q-input>
            <p id="catalogo-cliente-nombre-ayuda" class="form-help">
              Máximo 150 caracteres. No puede repetir el nombre de otro cliente del despacho.
            </p>
          </div>

          <div class="catalogo-cliente__fila">
            <div class="form-group catalogo-cliente__correo">
              <label for="catalogo-cliente-email" class="form-label">Correo (opcional)</label>
              <q-input
                for="catalogo-cliente-email"
                v-model="form.email"
                type="email"
                placeholder="contacto@empresa.com"
                maxlength="150"
                autocomplete="off"
                outlined
                dense
                class="input-moderno"
                :error="!!erroresCampo.email"
                :error-message="erroresCampo.email"
                @update:model-value="erroresCampo.email = null"
              >
                <template #prepend><q-icon name="mail" aria-hidden="true" /></template>
                <q-tooltip v-if="!erroresCampo.email" anchor="top middle" self="bottom middle">
                  Correo de contacto del cliente para avisos y recordatorios.
                </q-tooltip>
              </q-input>
            </div>

            <div class="form-group catalogo-cliente__telefono">
              <label for="catalogo-cliente-telefono" class="form-label">Teléfono (opcional)</label>
              <q-input
                for="catalogo-cliente-telefono"
                v-model="form.telefono"
                type="tel"
                placeholder="55 1234 5678"
                maxlength="21"
                autocomplete="off"
                outlined
                dense
                class="input-moderno"
                :error="!!erroresCampo.telefono"
                :error-message="erroresCampo.telefono"
                @update:model-value="erroresCampo.telefono = null"
              >
                <template #prepend><q-icon name="phone" aria-hidden="true" /></template>
                <q-tooltip v-if="!erroresCampo.telefono" anchor="top middle" self="bottom middle">
                  Número de contacto del cliente (hasta 20 caracteres).
                </q-tooltip>
              </q-input>
            </div>
          </div>

          <div v-if="!esEdicion" class="form-group">
            <label for="catalogo-cliente-contadores" class="form-label"
              >Contadores (opcional)</label
            >
            <q-select
              for="catalogo-cliente-contadores"
              v-model="form.contadores"
              :options="opcionesVisibles"
              multiple
              use-chips
              use-input
              input-debounce="0"
              emit-value
              map-options
              outlined
              dense
              options-dense
              dropdown-icon="expand_more"
              popup-content-class="menu-seleccion-custom"
              transition-show="jump-down"
              transition-hide="jump-up"
              :placeholder="form.contadores.length === 0 ? 'Sin contadores por ahora' : ''"
              class="selector-moderno"
              aria-describedby="catalogo-cliente-contadores-ayuda"
              :loading="cargandoContadores"
              :error="!!erroresCampo.contadores"
              :error-message="erroresCampo.contadores"
              @filter="filtrarContadores"
              @update:model-value="erroresCampo.contadores = null"
            >
              <template #prepend><q-icon name="groups" aria-hidden="true" /></template>
              <template #selected-item="scope">
                <q-chip
                  removable
                  dense
                  color="dg-info-fondo"
                  text-color="dg-info-texto"
                  :tabindex="scope.tabindex"
                  @remove="scope.removeAtIndex(scope.index)"
                >
                  {{ scope.opt.label }}
                  <span v-if="scope.index === 0" class="catalogo-cliente__principal">
                    · Principal</span
                  >
                </q-chip>
              </template>
              <template #no-option>
                <q-item>
                  <q-item-section class="text-dg-texto-secundario">
                    No hay cuentas que coincidan. Solo se ofrecen contadores, auxiliares y personas
                    con rol de Contador en Documentos.
                  </q-item-section>
                </q-item>
              </template>
              <q-tooltip v-if="!erroresCampo.contadores" anchor="top middle" self="bottom middle">
                Elige quién lleva a este cliente. Puedes dejarlo vacío y asignarlos después.
              </q-tooltip>
            </q-select>
            <p id="catalogo-cliente-contadores-ayuda" class="form-help">
              {{ EXPLICACION_PRINCIPAL }} Elige primero a quien será el principal.
            </p>
            <p v-if="errorContadores" class="error-banner" role="alert">
              {{ errorContadores.mensaje ?? 'No se pudo cargar la lista de contadores.' }}
              <q-btn
                flat
                dense
                no-caps
                icon="refresh"
                label="Reintentar"
                color="primary"
                class="control-touch boton-presionable"
                @click="cargarContadores"
              />
            </p>
            <p v-if="avisoPrincipal" class="catalogo-cliente__aviso" role="status">
              <q-icon name="info" aria-hidden="true" />
              <span>{{ avisoPrincipal }}</span>
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
            :label="esEdicion ? 'Guardar cambios' : 'Agregar cliente'"
            :icon="esEdicion ? 'save' : 'add_business'"
            no-caps
            unelevated
            class="control-touch boton-presionable"
            :loading="guardando"
            :disable="guardando"
          >
            <q-tooltip>{{
              esEdicion
                ? 'Guarda los cambios de este cliente.'
                : 'Agrega el cliente al catálogo del despacho.'
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

import {
  EXPLICACION_PRINCIPAL,
  avisoPrincipalSinRolDocumentos,
  cambiosDeCliente,
  campoDeErrorCliente,
  crearCliente,
  editarCliente,
  listarContadoresElegibles,
  opcionesDeContadores,
  validarClienteCatalogo,
} from '../services/ajustesService.js'

/*
 * Alta y edición de datos de un cliente del catálogo (Ajustes > Clientes). Los campos son los de la
 * tabla `clientes`. En el alta se pueden elegir contadores (el primero es el principal); al editar
 * solo se envía lo que cambió y los contadores se cambian en su propio diálogo.
 * Emite `guardado` con el cliente y si fue edición.
 */
const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  /** Cliente que se edita (una fila del catálogo); null para dar de alta. */
  cliente: { type: Object, default: null },
})

const emit = defineEmits(['guardado'])

const $q = useQuasar()
const tarjeta = ref(null)
const esEdicion = computed(() => props.cliente !== null)

const CAMPOS = ['clave', 'nombre', 'rfc', 'email', 'telefono']
const form = reactive({ clave: '', nombre: '', rfc: '', email: '', telefono: '', contadores: [] })
const erroresCampo = reactive({
  clave: null,
  nombre: null,
  rfc: null,
  email: null,
  telefono: null,
  contadores: null,
})
const errorGeneral = ref('')
const guardando = ref(false)

// Lo que había al abrir: sirve para saber si hay algo sin guardar (también al editar).
const inicial = reactive({ clave: '', nombre: '', rfc: '', email: '', telefono: '' })

const hayDatosSinGuardar = computed(
  () =>
    Object.keys(cambiosDeCliente(inicial, form)).length > 0 ||
    (!esEdicion.value && form.contadores.length > 0),
)

// Contadores elegibles (solo en el alta): se piden al abrir.
const elegibles = ref([])
const cargandoContadores = ref(false)
const errorContadores = ref(null)
const filtro = ref('')
const opciones = computed(() => opcionesDeContadores(elegibles.value))
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
// Con la búsqueda activa, las cuentas ya elegidas se conservan en la lista: sin ellas el campo
// perdería el nombre de sus chips.
const opcionesVisibles = computed(() =>
  filtro.value === ''
    ? opciones.value
    : opciones.value.filter(
        (o) =>
          form.contadores.includes(o.value) ||
          normalizar(o.label).includes(normalizar(filtro.value)),
      ),
)
const avisoPrincipal = computed(() =>
  avisoPrincipalSinRolDocumentos(form.contadores, opciones.value),
)

const filtrarContadores = (texto, actualizar) => {
  actualizar(() => {
    filtro.value = texto
  })
}

const cargarContadores = async () => {
  cargandoContadores.value = true
  errorContadores.value = null
  try {
    elegibles.value = await listarContadoresElegibles()
  } catch (fallo) {
    errorContadores.value = fallo
  } finally {
    cargandoContadores.value = false
  }
}

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
  nextTick(() => document.getElementById('catalogo-cliente-clave')?.focus())
}

/** Lleva la vista y el foco al primer campo con error (en celular puede estar fuera de la pantalla). */
const enfocarPrimerError = () =>
  nextTick(() => {
    const campo = tarjeta.value?.$el?.querySelector('.q-field--error')
    if (!campo) return
    campo.scrollIntoView({ block: 'center' })
    campo.querySelector('input, textarea, [tabindex="0"]')?.focus({ preventScroll: true })
  })

// Cada apertura empieza con los datos del cliente (o vacía) y sin errores de la vez anterior.
watch(dialogoAbierto, (abierto) => {
  if (!abierto) return
  for (const campo of CAMPOS) {
    form[campo] = props.cliente?.[campo] ?? ''
    inicial[campo] = form[campo]
    erroresCampo[campo] = null
  }
  form.contadores = []
  erroresCampo.contadores = null
  errorGeneral.value = ''
  errorContadores.value = null
  filtro.value = ''
  if (!esEdicion.value) cargarContadores()
})

/** Muestra el error del backend junto a su campo; si no es de un campo, en el aviso general. */
const mostrarErrorDeGuardado = (fallo) => {
  const mensaje = fallo?.mensaje ?? 'No se pudo guardar el cliente. Intenta de nuevo.'
  const campo = campoDeErrorCliente(mensaje)
  if (campo) {
    erroresCampo[campo] = mensaje
    enfocarPrimerError()
  } else {
    errorGeneral.value = mensaje
  }
}

const guardar = async () => {
  if (guardando.value) return
  errorGeneral.value = ''

  // Un cliente antiguo sin clave se puede editar sin asignársela; si ya tenía, no puede quedar vacía.
  const { valido, errores } = validarClienteCatalogo(form, {
    claveObligatoria: !esEdicion.value || inicial.clave !== '',
  })
  for (const campo of CAMPOS) erroresCampo[campo] = errores[campo] ?? null
  if (!valido) {
    enfocarPrimerError()
    return
  }

  // Al editar, solo viaja lo que cambió; sin cambios no hay nada que guardar.
  const cambios = esEdicion.value ? cambiosDeCliente(inicial, form) : null
  if (esEdicion.value && Object.keys(cambios).length === 0) {
    dialogoAbierto.value = false
    return
  }

  guardando.value = true
  try {
    const cliente = esEdicion.value
      ? await editarCliente(props.cliente.id, cambios)
      : await crearCliente({ ...form, contadores: form.contadores })
    dialogoAbierto.value = false
    emit('guardado', cliente, esEdicion.value)
  } catch (fallo) {
    mostrarErrorDeGuardado(fallo)
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.catalogo-cliente {
  width: 100%;
  max-width: 560px;
  min-width: 0;
  border-radius: 12px;
}

.catalogo-cliente__form,
.catalogo-cliente__cuerpo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.catalogo-cliente__titulo {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.catalogo-cliente__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

/* Dos campos por fila en pantallas anchas; en el celular, uno bajo otro. */
.catalogo-cliente__fila {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.catalogo-cliente__fila > * {
  flex: 1 1 200px;
  min-width: 0;
}

.catalogo-cliente__clave {
  flex: 1 1 160px;
}

.catalogo-cliente :deep(.catalogo-cliente__mayusculas) {
  text-transform: uppercase;
}

.catalogo-cliente__principal {
  margin-left: 4px;
  font-weight: 600;
}

.catalogo-cliente__aviso {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 0 0;
  padding: 8px 12px;
  border: 1px solid var(--dg-aviso-borde);
  border-radius: 8px;
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-texto);
  font-size: 0.85rem;
  line-height: 1.45;
}

/* .form-group, .form-label, .required-mark, .form-help y .error-banner viven en app.scss. */
</style>
