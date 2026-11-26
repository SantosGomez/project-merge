<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="contadores-cliente-titulo"
    @show="enfocarSelector"
    @shake="pedirDescartar"
  >
    <q-card class="contadores-cliente">
      <q-form class="contadores-cliente__form" novalidate @submit="guardar">
        <q-card-section>
          <h2 id="contadores-cliente-titulo" class="contadores-cliente__titulo">
            Contadores de «{{ cliente?.nombre }}»
          </h2>
          <p class="contadores-cliente__ayuda">
            Elige quiénes llevan a este cliente. {{ EXPLICACION_PRINCIPAL }} Puedes dejarlo sin
            contadores.
          </p>
        </q-card-section>

        <q-card-section class="contadores-cliente__cuerpo">
          <!-- Cargando: reserva el lugar del campo para que el diálogo no salte. -->
          <div v-if="cargando" class="contadores-cliente__carga" aria-busy="true" role="status">
            <q-skeleton type="rect" height="40px" />
            <span class="sr-only">Cargando los contadores…</span>
          </div>

          <p v-else-if="errorCarga" class="error-banner" role="alert">
            {{ errorCarga.mensaje ?? 'No se pudo cargar la lista de contadores.' }}
            <q-btn
              flat
              dense
              no-caps
              icon="refresh"
              label="Reintentar"
              color="primary"
              class="control-touch boton-presionable"
              @click="cargar"
            />
          </p>

          <div v-else class="form-group">
            <label for="contadores-cliente-selector" class="form-label">Contadores</label>
            <q-select
              ref="selector"
              for="contadores-cliente-selector"
              v-model="seleccion"
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
              :placeholder="seleccion.length === 0 ? 'Sin contadores' : ''"
              class="selector-moderno"
              aria-describedby="contadores-cliente-ayuda"
              :error="!!errorContadores"
              :error-message="errorContadores"
              @filter="filtrar"
              @update:model-value="errorContadores = null"
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
                  <span v-if="scope.index === 0" class="contadores-cliente__principal">
                    · Principal</span
                  >
                </q-chip>
              </template>
              <template #option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label v-if="scope.opt.yaNoElegible" caption>
                      Ya no puede llevar clientes: quítalo para guardar.
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </template>
              <template #no-option>
                <q-item>
                  <q-item-section class="text-dg-texto-secundario">
                    No hay cuentas que coincidan. Solo se ofrecen contadores, auxiliares y personas
                    con rol de Contador en Documentos.
                  </q-item-section>
                </q-item>
              </template>
              <q-tooltip v-if="!errorContadores" anchor="top middle" self="bottom middle">
                Escribe para buscar y elige varias cuentas. La primera que elijas es la principal.
              </q-tooltip>
            </q-select>
            <p id="contadores-cliente-ayuda" class="form-help">
              {{ EXPLICACION_PRINCIPAL }} Para cambiar al principal, quita las cuentas y vuelve a
              elegirlas empezando por quien será el principal.
            </p>
            <p v-if="avisoPrincipal" class="contadores-cliente__aviso" role="status">
              <q-icon name="info" aria-hidden="true" />
              <span>{{ avisoPrincipal }}</span>
            </p>
            <p v-if="seleccion.length === 0" class="form-help">
              Sin contadores: nadie llevará a este cliente hasta que elijas a alguien.
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
            label="Guardar contadores"
            icon="save"
            no-caps
            unelevated
            class="control-touch boton-presionable"
            :loading="guardando"
            :disable="cargando || !!errorCarga || guardando"
          >
            <q-tooltip>Guarda la lista de contadores de este cliente.</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import {
  EXPLICACION_PRINCIPAL,
  avisoPrincipalSinRolDocumentos,
  campoDeErrorCliente,
  listarContadoresElegibles,
  opcionesDeContadores,
  reemplazarContadores,
} from '../services/ajustesService.js'

/*
 * Contadores de un cliente del catálogo (Ajustes > Clientes, solo administrador y sistemas): lista
 * las cuentas que pueden llevar clientes con búsqueda y selección múltiple. El orden de la selección
 * es el de la lista y el primero es el principal. Guarda la lista completa (puede quedar vacía).
 * Emite `guardado` con el cliente actualizado.
 */
const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  /** Fila del catálogo con `id`, `nombre` y `contadores` ([{ id, nombre }], el principal primero). */
  cliente: { type: Object, default: null },
})

const emit = defineEmits(['guardado'])

const $q = useQuasar()
const selector = ref(null)

const elegibles = ref([])
const cargando = ref(false)
const errorCarga = ref(null)
const seleccion = ref([])
// Ids con los que se abrió, en orden: la lista cambia si cambia el contenido o el orden.
const inicial = ref([])
const filtro = ref('')
const errorContadores = ref(null)
const errorGeneral = ref('')
const guardando = ref(false)

// Los contadores que el cliente ya tiene siempre se ofrecen, aunque hayan dejado de ser elegibles.
const opciones = computed(() =>
  opcionesDeContadores(elegibles.value, props.cliente?.contadores ?? []),
)
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
          seleccion.value.includes(o.value) ||
          normalizar(o.label).includes(normalizar(filtro.value)),
      ),
)
const avisoPrincipal = computed(() =>
  avisoPrincipalSinRolDocumentos(seleccion.value, opciones.value),
)
const hayDatosSinGuardar = computed(
  () => JSON.stringify(seleccion.value) !== JSON.stringify(inicial.value),
)

const filtrar = (texto, actualizar) => {
  actualizar(() => {
    filtro.value = texto
  })
}

const cargar = async () => {
  cargando.value = true
  errorCarga.value = null
  try {
    elegibles.value = await listarContadoresElegibles()
  } catch (fallo) {
    errorCarga.value = fallo
  } finally {
    cargando.value = false
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
    message: 'Los cambios que hiciste a los contadores se perderán.',
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

const enfocarSelector = () => {
  nextTick(() => document.getElementById('contadores-cliente-selector')?.focus())
}

// Cada apertura parte de los contadores actuales del cliente y sin errores de la vez anterior.
watch(dialogoAbierto, (abierto) => {
  if (!abierto) return
  seleccion.value = (props.cliente?.contadores ?? []).map((cuenta) => cuenta.id)
  inicial.value = [...seleccion.value]
  filtro.value = ''
  errorContadores.value = null
  errorGeneral.value = ''
  cargar().then(enfocarSelector)
})

const guardar = async () => {
  if (guardando.value) return
  errorGeneral.value = ''
  errorContadores.value = null
  guardando.value = true
  try {
    const cliente = await reemplazarContadores(props.cliente.id, seleccion.value)
    dialogoAbierto.value = false
    emit('guardado', cliente)
  } catch (fallo) {
    const mensaje = fallo?.mensaje ?? 'No se pudieron guardar los contadores. Intenta de nuevo.'
    // Un error de contadores va junto al campo; cualquier otro (cliente no encontrado…), al aviso general.
    if (campoDeErrorCliente(mensaje) === 'contadores') errorContadores.value = mensaje
    else errorGeneral.value = mensaje
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.contadores-cliente {
  width: 100%;
  max-width: 520px;
  min-width: 0;
  border-radius: 12px;
}

.contadores-cliente__form,
.contadores-cliente__cuerpo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.contadores-cliente__titulo {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.contadores-cliente__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.contadores-cliente__principal {
  margin-left: 4px;
  font-weight: 600;
}

.contadores-cliente__aviso {
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

/* .form-group, .form-label, .form-help y .error-banner viven en app.scss. */
</style>
