<template>
  <q-dialog
    v-model="dialogoAbierto"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="casos-auxiliar-titulo"
    @show="cargar"
  >
    <q-card class="casos-auxiliar">
      <q-card-section class="casos-auxiliar__cabecera">
        <div class="casos-auxiliar__cabecera-texto">
          <h2 id="casos-auxiliar-titulo" class="casos-auxiliar__titulo">
            Casos importantes de {{ cuenta?.nombre }}
          </h2>
          <p class="casos-auxiliar__ayuda">
            Un auxiliar no puede marcar casos como importantes: aquí están los que su contador marcó
            para que les des seguimiento.
          </p>
        </div>
        <q-btn
          v-close-popup
          flat
          round
          icon="close"
          aria-label="Cerrar los casos del auxiliar"
          class="control-touch boton-presionable"
        >
          <q-tooltip>Cierra los casos y vuelve al directorio.</q-tooltip>
        </q-btn>
      </q-card-section>

      <q-separator />

      <q-card-section class="casos-auxiliar__cuerpo">
        <DetalleContador
          v-model:filtros="filtros"
          auxiliar
          :contador="cuenta"
          :estado="estado"
          :filas="filas"
          :paginacion="paginacion"
          :guardando="guardando"
          :error="error"
          @cambiar-pagina="(p) => (pagina = p)"
          @cambiar-prioridad="cambiarPrioridad"
          @reintentar="cargar"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import DetalleContador from './DetalleContador.vue'
import { cambiarPrioridadComoAdmin } from '../services/caseService.js'
import { getCasosPorContador } from '../services/counterService.js'
import { PRIORITY_LABELS } from '../utils/constants.js'
import { casoAFila } from '../utils/filasVista.js'
import { FILTROS_INICIALES, filtrarCasos, hoyLocal, paginar } from '../utils/filtrosCasos.js'
import { screenState } from '../utils/screenState.js'

/*
 * Casos importantes de un auxiliar, para el administrador, desde el directorio de usuarios.
 * El auxiliar no marca «Importante»: lo hace su contador, y así el caso llega al administrador.
 * Reutiliza el detalle del dashboard (`DetalleContador`), con cambio de prioridad incluido.
 */
const props = defineProps({
  /** Fila del directorio (`{ id, nombre }`) del auxiliar, o null. */
  cuenta: { type: Object, default: null },
})

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const $q = useQuasar()

const casos = ref([])
const cargando = ref(false)
const error = ref(null)
const guardando = ref(false)

const filtros = ref({ ...FILTROS_INICIALES, estado: 'todos' })
const pagina = ref(1)
const POR_PAGINA = 10

watch(filtros, () => {
  pagina.value = 1
})

const estado = computed(() =>
  // Mientras no hay cuenta se muestra la carga: el diálogo aún no terminó de abrirse.
  screenState({ loading: cargando.value || !props.cuenta, error: error.value, rows: casos.value }),
)

const paginacion = computed(() =>
  paginar(filtrarCasos(casos.value, filtros.value, hoyLocal()), pagina.value, POR_PAGINA),
)

const filas = computed(() => paginacion.value.elementos.map(casoAFila))

// Descarta la respuesta de un auxiliar anterior si se abrió otro antes de que llegara.
let peticion = 0

const cargar = async () => {
  if (!props.cuenta) return
  const actual = ++peticion
  cargando.value = true
  error.value = null
  casos.value = []
  filtros.value = { ...FILTROS_INICIALES, estado: 'todos' }
  try {
    const recibidos = await getCasosPorContador(props.cuenta.id, { soloImportantes: true })
    if (actual === peticion) casos.value = recibidos
  } catch (fallo) {
    if (actual === peticion) error.value = fallo ?? { mensaje: 'los casos de este auxiliar.' }
  } finally {
    if (actual === peticion) cargando.value = false
  }
}

/** Pide confirmación y cambia la prioridad; el backend avisa al auxiliar y el vencimiento no cambia. */
const cambiarPrioridad = (caso, prioridad) => {
  if (prioridad === caso.priority || guardando.value) return

  const nombre = props.cuenta?.nombre ?? 'el auxiliar'
  $q.dialog({
    title: 'Cambiar prioridad',
    message:
      `La prioridad de «${caso.client}» pasará de ${PRIORITY_LABELS[caso.priority]} a ` +
      `${PRIORITY_LABELS[prioridad]} y se avisará a ${nombre}. La fecha de vencimiento no cambia.`,
    cancel: { label: 'Cancelar', flat: true, noCaps: true },
    ok: { label: 'Cambiar prioridad', color: 'primary', unelevated: true, noCaps: true },
    persistent: true,
    transitionShow: 'dialogo-entra',
    transitionHide: 'dialogo-sale',
    transitionDuration: 220,
  }).onOk(() => guardarPrioridad(caso, prioridad, nombre))
}

/** Guarda la prioridad ya confirmada; si falla, el aviso permite reintentar sin volver a confirmar. */
const guardarPrioridad = async (caso, prioridad, nombre) => {
  if (guardando.value) return
  guardando.value = true
  try {
    const actualizado = await cambiarPrioridadComoAdmin(caso.id, prioridad)
    casos.value = casos.value.map((uno) =>
      String(uno.id) === String(actualizado.id) ? { ...uno, ...actualizado } : uno,
    )
    $q.notify({ type: 'positive', message: `Prioridad actualizada. Se avisó a ${nombre}.` })
  } catch (fallo) {
    $q.notify({
      type: 'negative',
      message: fallo?.mensaje ?? 'No se pudo cambiar la prioridad. Inténtalo de nuevo.',
      timeout: 8000,
      actions: [
        {
          label: 'Reintentar',
          color: 'white',
          noCaps: true,
          handler: () => guardarPrioridad(caso, prioridad, nombre),
        },
      ],
    })
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.casos-auxiliar {
  width: min(900px, calc(100vw - 32px));
  max-width: none !important;
  max-height: 85vh;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.casos-auxiliar__cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 12px 24px;
}

.casos-auxiliar__cabecera-texto {
  min-width: 0;
}

.casos-auxiliar__titulo {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.casos-auxiliar__ayuda {
  margin: 4px 0 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.casos-auxiliar__cuerpo {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 24px 20px;
  background: var(--dg-fondo-panel);
}

@media (max-width: 599px) {
  .casos-auxiliar__cabecera {
    padding: 12px 8px 8px 16px;
  }

  .casos-auxiliar__cuerpo {
    padding: 12px 16px 16px;
  }
}
</style>
