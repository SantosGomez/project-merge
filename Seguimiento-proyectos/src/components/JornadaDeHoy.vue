<template>
  <q-card flat bordered class="jornada" role="region" aria-labelledby="jornada-titulo">
    <q-expansion-item
      v-model="desplegada"
      class="jornada__plegable"
      header-class="jornada__cabecera"
      toggle-aria-label="Plegar o desplegar Mi jornada de hoy"
    >
      <template #header>
        <q-item-section avatar class="jornada__avatar">
          <q-icon name="schedule" color="dg-acento" size="28px" aria-hidden="true" />
        </q-item-section>
        <q-item-section class="jornada__encabezado">
          <q-item-label id="jornada-titulo" class="jornada__titulo">Mi jornada de hoy</q-item-label>
          <q-item-label caption class="jornada__resumen">
            {{ cargando ? 'Cargando tu jornada…' : errorCarga ? 'No se pudo cargar.' : resumen }}
          </q-item-label>
        </q-item-section>
        <q-tooltip>
          Registra tu entrada, tu descanso y tu salida. Solo tú ves tu jornada: nadie más, ni el
          administrador ni tu contador.
        </q-tooltip>
      </template>

      <q-separator />

      <q-card-section class="jornada__cuerpo">
        <ScreenLoader v-if="cargando" text="Cargando tu jornada de hoy…" />

        <ErrorState v-else-if="errorCarga" :detail="errorCarga.mensaje" @retry="cargar()" />

        <template v-else>
          <q-list class="jornada__horas" aria-label="Las cuatro horas de tu jornada de hoy">
            <q-item v-for="paso in PASOS" :key="paso" dense class="jornada__hora">
              <q-item-section>
                <q-item-label caption class="jornada__hora-etiqueta">
                  {{ ETIQUETAS_DE_PASO[paso] }}
                </q-item-label>
                <q-item-label
                  class="jornada__hora-valor"
                  :class="{ 'jornada__hora-valor--vacia': !jornada?.[paso] }"
                >
                  {{ jornada?.[paso] ?? 'Sin registrar' }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div class="jornada__acciones">
            <q-btn
              v-if="siguiente"
              unelevated
              no-caps
              color="primary"
              :icon="siguiente.icono"
              :label="siguiente.etiqueta"
              class="control-touch boton-presionable"
              :loading="marcando"
              :disable="marcando"
              @click="marcar(siguiente.paso)"
            >
              <q-tooltip>
                Guarda la hora actual del servidor como tu
                {{ ETIQUETAS_DE_PASO[siguiente.paso].toLowerCase() }}.
              </q-tooltip>
            </q-btn>
            <q-btn
              v-if="salidaDirecta"
              outline
              no-caps
              color="primary"
              icon="logout"
              label="Registrar salida"
              class="control-touch boton-presionable"
              :loading="marcando"
              :disable="marcando"
              @click="marcar('salida')"
            >
              <q-tooltip>Termina tu jornada sin tomar descanso.</q-tooltip>
            </q-btn>
            <p v-if="!siguiente" class="jornada__cerrada">
              Ya registraste tu salida de hoy. Si alguna hora está mal, usa «Corregir horas».
            </p>
          </div>

          <div class="jornada__metricas">
            <p class="jornada__trabajadas" :class="{ 'jornada__trabajadas--extra': horas.extra }">
              <q-icon name="hourglass_top" size="20px" aria-hidden="true" />
              {{ horas.texto }}
              <q-tooltip>
                Tiempo trabajado hoy, de tu entrada a tu salida sin contar el descanso. Si tu
                jornada sigue abierta, cuenta hasta ahora.
              </q-tooltip>
            </p>
            <q-linear-progress
              :value="avance"
              rounded
              size="10px"
              :color="horas.extra ? 'dg-exito' : 'dg-acento'"
              track-color="dg-borde"
              class="jornada__barra"
              :aria-label="`Avance de la jornada base de ${etiquetaBase}`"
            />
            <p class="jornada__asignado">
              {{ textoAsignado }}
              <q-tooltip>
                «Asignado» es el tiempo de hoy que ya está en bloques de tiempo de tus actividades.
                «Sin asignar» es lo que trabajaste y todavía no está en ninguna. Un cronómetro en
                marcha cuenta cuando lo detienes.
              </q-tooltip>
            </p>
          </div>

          <div class="jornada__pie">
            <q-btn
              flat
              no-caps
              color="primary"
              icon="edit_calendar"
              label="Corregir horas"
              class="control-touch boton-presionable"
              @click="dialogoCorregir = true"
            >
              <q-tooltip>
                Cambia las horas de hoy o de un día anterior si olvidaste registrarlas o se
                registraron mal.
              </q-tooltip>
            </q-btn>

            <div class="jornada__base">
              <label for="jornada-base" class="form-label">Jornada base por día</label>
              <q-select
                for="jornada-base"
                :model-value="jornadaBase"
                :options="OPCIONES_JORNADA_BASE"
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
                class="selector-moderno jornada__base-selector"
                :disable="guardandoBase"
                :loading="guardandoBase"
                @update:model-value="cambiarJornadaBase"
                @popup-show="selectorAbierto = true"
                @popup-hide="selectorAbierto = false"
              >
                <template #prepend><q-icon name="timelapse" aria-hidden="true" /></template>
                <q-tooltip v-if="!selectorAbierto">
                  Horas que te toca trabajar por día. Con ella se compara lo que llevas y se
                  calculan las horas extra. De 1 a 16 horas, en medias horas.
                </q-tooltip>
              </q-select>
            </div>
          </div>
        </template>
      </q-card-section>
    </q-expansion-item>

    <JornadaFormDialog v-model="dialogoCorregir" @guardado="alGuardarCorreccion" />
  </q-card>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import ErrorState from './ErrorState.vue'
import JornadaFormDialog from './JornadaFormDialog.vue'
import ScreenLoader from './ScreenLoader.vue'
import { guardarAjustes, marcarPaso, obtenerHoy } from '../services/jornadaService.js'
import { useCronometroStore } from '../stores/cronometro.js'
import { formatearDuracion } from '../utils/actividades.js'
import {
  ETIQUETAS_DE_PASO,
  OPCIONES_JORNADA_BASE,
  PASOS,
  guardarJornadaPlegada,
  jornadaAbierta,
  leerJornadaPlegada,
  puedeSalirSinDescanso,
  resumenDeJornada,
  siguientePaso,
  textoDeHorasTrabajadas,
  textoDeTiempoAsignado,
} from '../utils/jornada.js'

/*
 * «Mi jornada de hoy»: las cuatro horas del día (entrada, salida a descanso, regreso y salida), un solo
 * botón con el paso que sigue, lo trabajado contra la jornada base y cuánto de eso está asignado a bloques
 * de tiempo. Cada paso guarda la hora del servidor. Solo la ve y la cambia su dueño. La tarjeta se puede
 * plegar y recuerda cómo quedó. Se vuelve a leer en silencio al volver a la ventana, cada minuto mientras
 * la jornada está abierta y cuando cambia el tiempo registrado (cronómetro o bloques a mano).
 */
const $q = useQuasar()
const cronometro = useCronometroStore()

const desplegada = ref(!leerJornadaPlegada())
watch(desplegada, (valor) => guardarJornadaPlegada(!valor))

const jornada = ref(null)
const minutosTrabajados = ref(0)
const minutosActividades = ref(0)
const jornadaBase = ref(480)
const cargando = ref(true)
const errorCarga = ref(null)
const marcando = ref(false)
const guardandoBase = ref(false)
const dialogoCorregir = ref(false)
// Con la lista abierta el tooltip taparía las opciones.
const selectorAbierto = ref(false)

const siguiente = computed(() => siguientePaso(jornada.value))
const salidaDirecta = computed(() => puedeSalirSinDescanso(jornada.value))
const etiquetaBase = computed(() => formatearDuracion(jornadaBase.value))
const horas = computed(() =>
  textoDeHorasTrabajadas({
    minutos: minutosTrabajados.value,
    baseMinutos: jornadaBase.value,
    cerrada: Boolean(jornada.value?.salida),
  }),
)
const avance = computed(() => Math.min(1, minutosTrabajados.value / jornadaBase.value))
const textoAsignado = computed(() =>
  textoDeTiempoAsignado({
    trabajados: minutosTrabajados.value,
    asignados: minutosActividades.value,
  }),
)
const resumen = computed(() => resumenDeJornada(jornada.value, minutosTrabajados.value))

// Cada lectura lleva un número: si una respuesta vieja llega después de una nueva, se descarta.
let ultimaLectura = 0

/**
 * Lee la jornada de hoy. En silencio (al volver a la ventana, cada minuto) un fallo no cambia lo que se
 * mostraba ni se presenta como fallo de un guardado.
 * @param {{ silencioso?: boolean }} [opciones]
 */
const cargar = async ({ silencioso = false } = {}) => {
  const lectura = (ultimaLectura += 1)
  if (!silencioso) {
    cargando.value = true
    errorCarga.value = null
  }
  try {
    const datos = await obtenerHoy()
    if (lectura !== ultimaLectura) return
    jornada.value = datos.jornada
    minutosTrabajados.value = datos.minutos_trabajados
    minutosActividades.value = datos.minutos_actividades
    jornadaBase.value = datos.jornada_base_minutos
    errorCarga.value = null
  } catch (error) {
    if (!silencioso && lectura === ultimaLectura) errorCarga.value = error
  } finally {
    if (!silencioso && lectura === ultimaLectura) cargando.value = false
  }
}

const marcar = async (paso) => {
  if (marcando.value) return
  marcando.value = true
  try {
    const guardada = await marcarPaso(paso)
    jornada.value = guardada
    $q.notify({
      type: 'positive',
      message: `${ETIQUETAS_DE_PASO[paso]} registrada a las ${guardada[paso]}.`,
      timeout: 4000,
    })
    await cargar({ silencioso: true })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'No se pudo registrar este paso de tu jornada.',
      caption: error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
    })
    // Un conflicto casi siempre es una pantalla desactualizada (lo registraste en otro dispositivo).
    if (error?.codigoHttp === 409) await cargar({ silencioso: true })
  } finally {
    marcando.value = false
  }
}

const cambiarJornadaBase = async (minutos) => {
  if (guardandoBase.value || minutos === jornadaBase.value) return
  guardandoBase.value = true
  try {
    jornadaBase.value = await guardarAjustes(minutos)
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'No se pudo guardar tu jornada base. Sigue la que tenías.',
      caption: error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
    })
  } finally {
    guardandoBase.value = false
  }
}

const alGuardarCorreccion = () => cargar({ silencioso: true })

const alVolverALaVentana = () => {
  if (document.visibilityState === 'visible') cargar({ silencioso: true })
}

// Mientras la jornada está abierta, el tiempo trabajado crece solo: se relee cada minuto.
let temporizador = null
const apagarReloj = () => {
  if (temporizador !== null) clearInterval(temporizador)
  temporizador = null
}
watch(
  () => jornadaAbierta(jornada.value),
  (abierta) => {
    apagarReloj()
    if (abierta) {
      temporizador = setInterval(() => {
        if (document.visibilityState === 'visible') cargar({ silencioso: true })
      }, 60000)
    }
  },
  { immediate: true },
)

// El tiempo asignado cambia al detener el cronómetro o agregar o borrar bloques.
watch(
  () => cronometro.cambios,
  () => cargar({ silencioso: true }),
)

onMounted(() => {
  cargar()
  document.addEventListener('visibilitychange', alVolverALaVentana)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', alVolverALaVentana)
  apagarReloj()
})
</script>

<style scoped>
.jornada {
  margin: 0 0 16px;
  border-radius: 12px;
  border-color: var(--dg-borde);
  min-width: 0;
}

.jornada__plegable :deep(.jornada__cabecera) {
  min-height: 56px;
}

.jornada__avatar {
  min-width: 0;
}

.jornada__encabezado {
  min-width: 0;
}

.jornada__titulo {
  color: var(--dg-texto);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.3;
}

.jornada__resumen {
  color: var(--dg-texto-secundario);
  overflow-wrap: anywhere;
}

.jornada__cuerpo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

/* En escritorio los botones y el avance comparten renglón: la lista del mes queda más cerca. */
@media (min-width: 900px) {
  .jornada__cuerpo {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 12px 24px;
  }

  .jornada__cuerpo > * {
    grid-column: 1 / -1;
  }

  .jornada__cuerpo > .jornada__acciones {
    grid-column: 1;
    max-width: 420px;
  }

  .jornada__cuerpo > .jornada__metricas {
    grid-column: 2;
  }
}

.jornada__horas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 0;
}

@media (min-width: 700px) {
  .jornada__horas {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.jornada__hora {
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
  background: var(--dg-fondo-panel);
}

.jornada__hora-etiqueta {
  color: var(--dg-texto-secundario);
}

.jornada__hora-valor {
  color: var(--dg-texto);
  font-size: 1.15rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.jornada__hora-valor--vacia {
  color: var(--dg-texto-tenue);
  font-size: 0.95rem;
  font-weight: 400;
  /* Misma altura de línea que una hora registrada: las cuatro casillas miden igual. */
  line-height: 1.38rem;
}

.jornada__acciones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.jornada__cerrada {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
}

.jornada__metricas {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.jornada__trabajadas {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.1rem;
  font-weight: 700;
  cursor: help;
}

.jornada__trabajadas--extra {
  color: var(--dg-exito);
}

.jornada__asignado {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  cursor: help;
  overflow-wrap: anywhere;
}

.jornada__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px 12px;
  padding-top: 8px;
  border-top: 1px solid var(--dg-borde);
}

.jornada__base {
  min-width: 0;
}

.jornada__base-selector {
  min-width: 180px;
}
</style>
