<template>
  <div class="informes">
    <q-card flat bordered class="informes__tarjeta" aria-labelledby="informes-filtros-titulo">
      <q-card-section class="informes__filtros">
        <h2 id="informes-filtros-titulo" class="informes__titulo">Informe de horas</h2>
        <p class="informes__ayuda">
          Elige el periodo y, si quieres, un cliente o un tipo de actividad. Solo cuenta el tiempo
          de bloques terminados: el cronómetro en marcha se suma cuando lo detienes. Solo tú ves tu
          informe.
        </p>

        <q-form class="informes__campos" @submit.prevent>
          <div class="informes__campo">
            <label for="informe-desde" class="form-label">Desde</label>
            <q-input
              v-model="periodoTexto.desde"
              for="informe-desde"
              type="text"
              placeholder="DD-MM-AAAA"
              maxlength="10"
              outlined
              dense
              class="input-moderno"
              :error="!!periodo.errores.desde"
              :error-message="periodo.errores.desde"
            >
              <template #append>
                <q-icon
                  name="event"
                  class="informes__calendario-icono"
                  tabindex="0"
                  role="button"
                  aria-label="Abrir calendario de la fecha Desde"
                >
                  <q-tooltip>Elegir la fecha de inicio del periodo en el calendario.</q-tooltip>
                  <q-popup-proxy
                    :breakpoint="700"
                    transition-show="jump-down"
                    transition-hide="jump-up"
                    :transition-duration="180"
                  >
                    <q-date v-model="periodoTexto.desde" mask="DD-MM-YYYY" today-btn>
                      <div class="row justify-end">
                        <q-btn v-close-popup label="Listo" color="primary" flat no-caps />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
              <q-tooltip>Primer día del periodo, con el formato DD-MM-AAAA.</q-tooltip>
            </q-input>
          </div>

          <div class="informes__campo">
            <label for="informe-hasta" class="form-label">Hasta</label>
            <q-input
              v-model="periodoTexto.hasta"
              for="informe-hasta"
              type="text"
              placeholder="DD-MM-AAAA"
              maxlength="10"
              outlined
              dense
              class="input-moderno"
              :error="!!periodo.errores.hasta"
              :error-message="periodo.errores.hasta"
            >
              <template #append>
                <q-icon
                  name="event"
                  class="informes__calendario-icono"
                  tabindex="0"
                  role="button"
                  aria-label="Abrir calendario de la fecha Hasta"
                >
                  <q-tooltip>Elegir la fecha final del periodo en el calendario.</q-tooltip>
                  <q-popup-proxy
                    :breakpoint="700"
                    transition-show="jump-down"
                    transition-hide="jump-up"
                    :transition-duration="180"
                  >
                    <q-date v-model="periodoTexto.hasta" mask="DD-MM-YYYY" today-btn>
                      <div class="row justify-end">
                        <q-btn v-close-popup label="Listo" color="primary" flat no-caps />
                      </div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
              <q-tooltip
                >Último día del periodo, con el formato DD-MM-AAAA (máximo 366 días).</q-tooltip
              >
            </q-input>
          </div>

          <div class="informes__campo informes__campo--boton">
            <q-btn
              outline
              no-caps
              icon="today"
              label="Este mes"
              color="primary"
              class="control-touch boton-presionable"
              @click="irAEsteMes"
            >
              <q-tooltip>Pone el periodo del día 1 al último día del mes actual.</q-tooltip>
            </q-btn>
          </div>

          <div class="informes__campo">
            <label for="informe-cliente" class="form-label">Cliente</label>
            <q-select
              v-model="clienteElegido"
              for="informe-cliente"
              :options="opcionesDeClientes"
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
            >
              <q-tooltip>Muestra solo el tiempo de un cliente. Incluye los desactivados.</q-tooltip>
            </q-select>
          </div>

          <div class="informes__campo">
            <label for="informe-tipo" class="form-label">Tipo de actividad</label>
            <q-select
              v-model="tipoElegido"
              for="informe-tipo"
              :options="opcionesDeTipos"
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
            >
              <q-tooltip
                >Muestra solo el tiempo de un tipo de actividad. Incluye los
                desactivados.</q-tooltip
              >
            </q-select>
          </div>
        </q-form>
      </q-card-section>
    </q-card>

    <ScreenLoader v-if="estado === SCREEN_STATES.loading" text="Cargando tu informe de horas…" />

    <ErrorState
      v-else-if="estado === SCREEN_STATES.error"
      :detail="error?.mensaje ?? 'tu informe de horas.'"
      @retry="cargar()"
    />

    <p v-else-if="!periodo.valido" class="informes__aviso" role="status">
      Corrige las fechas del periodo para ver el informe.
    </p>

    <!-- Al cambiar un filtro el informe anterior se atenúa y una barra avisa que se está actualizando. -->
    <div
      v-else-if="informe"
      class="informes__resultado"
      :class="{ 'informes__resultado--actualizando': actualizando }"
      :aria-busy="actualizando"
    >
      <q-linear-progress
        v-if="actualizando"
        indeterminate
        color="primary"
        class="informes__progreso"
        aria-label="Actualizando el informe"
      />
      <q-card flat bordered class="informes__tarjeta" aria-labelledby="informes-resumen-titulo">
        <q-card-section>
          <div class="informes__cabecera-seccion">
            <h2 id="informes-resumen-titulo" class="informes__titulo">Resumen</h2>
            <q-btn
              unelevated
              no-caps
              icon="download"
              label="Descargar CSV"
              color="primary"
              class="control-touch boton-presionable"
              :disable="informe.bloques.length === 0"
              @click="descargar"
            >
              <q-tooltip>{{
                informe.bloques.length === 0
                  ? 'No hay bloques de tiempo en este periodo para descargar.'
                  : 'Descarga en un archivo CSV, que abre Excel, el detalle del periodo filtrado.'
              }}</q-tooltip>
            </q-btn>
          </div>

          <ul class="informes__cifras" aria-label="Horas del periodo">
            <li v-for="cifra in cifrasDeHoras" :key="cifra.clave" class="informes__cifra">
              <q-icon :name="cifra.icono" color="dg-acento" size="22px" aria-hidden="true" />
              <span class="informes__cifra-valor">{{ cifra.valor }}</span>
              <span class="informes__cifra-etiqueta">{{ cifra.etiqueta }}</span>
              <q-tooltip>{{ cifra.ayuda }}</q-tooltip>
            </li>
          </ul>

          <h3 class="informes__subtitulo">Jornada del periodo</h3>
          <p v-if="!informe.resumen.jornada" class="informes__aviso informes__aviso--suelto">
            No registraste jornadas en este periodo, por eso no se calculan las horas trabajadas,
            las horas extra ni el tiempo sin asignar.
          </p>
          <ul v-else class="informes__cifras" aria-label="Jornada del periodo">
            <li v-for="cifra in cifrasDeJornada" :key="cifra.clave" class="informes__cifra">
              <q-icon :name="cifra.icono" color="dg-acento" size="22px" aria-hidden="true" />
              <span
                class="informes__cifra-valor"
                :class="{ 'informes__cifra-valor--extra': cifra.extra }"
                >{{ cifra.valor }}</span
              >
              <span class="informes__cifra-etiqueta">{{ cifra.etiqueta }}</span>
              <q-tooltip>{{ cifra.ayuda }}</q-tooltip>
            </li>
          </ul>
          <p v-if="informe.resumen.jornada" class="informes__nota">
            La jornada cuenta todos los días con jornada del periodo, sin importar el cliente ni el
            tipo elegidos. Jornada base:
            {{ formatearDuracion(informe.resumen.jornada.jornada_base_minutos) }}
            por día.
          </p>
        </q-card-section>
      </q-card>

      <EmptyState
        v-if="informe.bloques.length === 0"
        title="No registraste tiempo en este periodo."
        message="Cambia las fechas o quita los filtros de cliente y tipo. El tiempo se registra con el cronómetro de la lista del mes."
      />

      <template v-else>
        <div class="informes__barras">
          <q-card
            v-for="seccion in seccionesDeBarras"
            :key="seccion.clave"
            flat
            bordered
            class="informes__tarjeta"
            :aria-labelledby="`informes-${seccion.clave}-titulo`"
          >
            <q-card-section>
              <h2 :id="`informes-${seccion.clave}-titulo`" class="informes__titulo">
                {{ seccion.titulo }}
                <q-tooltip>{{ seccion.ayuda }}</q-tooltip>
              </h2>
              <q-list class="informes__lista-barras" :aria-label="seccion.titulo">
                <q-item v-for="fila in seccion.filas" :key="fila.id" class="informes__barra">
                  <q-item-section>
                    <div class="informes__barra-texto">
                      <span class="informes__barra-nombre">{{ fila.nombre }}</span>
                      <span class="informes__barra-valor">{{ textoDeBarra(fila) }}</span>
                    </div>
                    <q-linear-progress
                      :value="proporcion(fila.minutos, informe.resumen.minutos_total)"
                      rounded
                      size="10px"
                      color="dg-acento"
                      track-color="dg-fondo-seleccion"
                      :aria-label="`${fila.nombre}: ${textoDeBarra(fila)}`"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>

        <q-card flat bordered class="informes__tarjeta" aria-labelledby="informes-detalle-titulo">
          <q-card-section>
            <h2 id="informes-detalle-titulo" class="informes__titulo">Detalle de bloques</h2>
            <p class="informes__ayuda">
              Cada bloque de tiempo del periodo, del más reciente al más antiguo. «A mano» marca el
              tiempo que escribiste tú: su hora de inicio es aproximada.
            </p>
            <q-table
              v-model:pagination="paginaBloques"
              flat
              :rows="filasDeBloques"
              :columns="COLUMNAS_BLOQUES"
              row-key="id"
              :grid="$q.screen.lt.md"
              :rows-per-page-options="[10, 20, 50]"
              aria-label="Detalle de bloques de tiempo"
              class="informes__tabla"
            >
              <template #body-cell-cobrable="props">
                <q-td :props="props">
                  <q-badge
                    :outline="!props.row.cobrable"
                    :color="props.row.cobrable ? 'dg-exito-fondo' : 'dg-texto-tenue'"
                    :text-color="props.row.cobrable ? 'dg-exito' : undefined"
                    :label="props.row.cobrable ? 'Sí' : 'No'"
                  />
                </q-td>
              </template>
              <template #body-cell-manual="props">
                <q-td :props="props">
                  <q-badge v-if="props.row.manual" outline color="dg-texto-tenue" label="A mano">
                    <q-tooltip
                      >Tiempo que agregaste a mano; la hora de inicio es aproximada.</q-tooltip
                    >
                  </q-badge>
                  <span v-else class="informes__sin-dato">—</span>
                </q-td>
              </template>
              <template #item="props">
                <div class="informes__tarjeta-bloque-columna">
                  <q-card flat bordered class="informes__tarjeta-bloque">
                    <q-card-section>
                      <p class="informes__bloque-fecha">
                        {{ props.row.fecha }} · {{ props.row.inicio }} a {{ props.row.fin }}
                      </p>
                      <p class="informes__bloque-cliente">{{ props.row.cliente }}</p>
                      <p class="informes__bloque-tipo">{{ props.row.tipo }}</p>
                      <div class="informes__bloque-pie">
                        <strong>{{ props.row.duracion }}</strong>
                        <q-badge
                          :outline="!props.row.cobrable"
                          :color="props.row.cobrable ? 'dg-exito-fondo' : 'dg-texto-tenue'"
                          :text-color="props.row.cobrable ? 'dg-exito' : undefined"
                          :label="props.row.cobrable ? 'Cobrable' : 'No cobrable'"
                        />
                        <q-badge
                          v-if="props.row.manual"
                          outline
                          color="dg-texto-tenue"
                          label="A mano"
                        >
                          <q-tooltip
                            >Tiempo que agregaste a mano; la hora de inicio es
                            aproximada.</q-tooltip
                          >
                        </q-badge>
                      </div>
                    </q-card-section>
                  </q-card>
                </div>
              </template>
            </q-table>
          </q-card-section>
        </q-card>
      </template>

      <q-card flat bordered class="informes__tarjeta" aria-labelledby="informes-jornadas-titulo">
        <q-card-section>
          <h2 id="informes-jornadas-titulo" class="informes__titulo">Jornadas del periodo</h2>
          <p v-if="informe.jornadas.length === 0" class="informes__aviso informes__aviso--suelto">
            No hay jornadas registradas en este periodo.
          </p>
          <q-table
            v-else
            v-model:pagination="paginaJornadas"
            flat
            :rows="filasDeJornadas"
            :columns="COLUMNAS_JORNADAS"
            row-key="fecha"
            :grid="$q.screen.lt.md"
            :rows-per-page-options="[10, 20, 50]"
            aria-label="Jornadas del periodo"
            class="informes__tabla"
          >
            <template #item="props">
              <div class="informes__tarjeta-bloque-columna">
                <q-card flat bordered class="informes__tarjeta-bloque">
                  <q-card-section>
                    <p class="informes__bloque-fecha">{{ props.row.fecha }}</p>
                    <p class="informes__bloque-tipo">
                      Entrada {{ props.row.entrada }} · Salida a descanso
                      {{ props.row.salida_descanso }} · Regreso {{ props.row.regreso_descanso }} ·
                      Salida {{ props.row.salida }}
                    </p>
                    <div class="informes__bloque-pie">
                      <strong>Trabajado: {{ props.row.trabajado }}</strong>
                      <span
                        class="informes__bloque-extra"
                        :class="{ 'informes__cifra-valor--extra': props.row.hayExtra }"
                        >Extra: {{ props.row.extra }}</span
                      >
                    </div>
                  </q-card-section>
                </q-card>
              </div>
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import ScreenLoader from './ScreenLoader.vue'
import { listarClientes } from '../services/clienteService.js'
import { obtenerTiempo } from '../services/informeService.js'
import { listarTipos } from '../services/tipoActividadService.js'
import { useCronometroStore } from '../stores/cronometro.js'
import { formatearDuracion } from '../utils/actividades.js'
import { fechaParaFormulario } from '../utils/fechasCaso.js'
import {
  armarCsv,
  descargarCsv,
  horasDelBloque,
  nombreArchivoCsv,
  periodoDelMes,
  proporcion,
  textoDeBarra,
  validarPeriodo,
} from '../utils/informes.js'
import { SCREEN_STATES } from '../utils/screenState.js'

/*
 * Informes de horas de «Mis actividades»: horas por cliente y por tipo de un periodo, jornadas del
 * periodo, detalle de bloques y descarga del CSV. La agregación la hace el servidor; aquí solo se pintan
 * sus resultados. Sin tarifas ni importes. Cada quien ve solo lo suyo.
 */

const $q = useQuasar()
const cronometro = useCronometroStore()

const TODOS = 'todos'
const SIN_DATO = '—'

const periodoTexto = ref(periodoDelMes())
const clienteElegido = ref(TODOS)
const tipoElegido = ref(TODOS)
const clientes = ref([])
const tipos = ref([])

const informe = ref(null)
const cargando = ref(true)
const error = ref(null)
// Periodo con el que se pidió el informe que se muestra (el nombre del CSV sale de aquí, no de lo que se está escribiendo).
const periodoDelInforme = ref(null)

const paginaBloques = ref({ page: 1, rowsPerPage: 10 })
const paginaJornadas = ref({ page: 1, rowsPerPage: 10 })

const periodo = computed(() => validarPeriodo(periodoTexto.value))
const filtroDe = (valor) => (valor === TODOS ? null : valor)

const estado = computed(() => {
  if (error.value) return SCREEN_STATES.error
  if (cargando.value && !informe.value) return SCREEN_STATES.loading
  return SCREEN_STATES.content
})

// Ya hay un informe a la vista y se está pidiendo otro (cambió el periodo o un filtro).
const actualizando = computed(() => cargando.value && Boolean(informe.value))

const opcionesDeClientes = computed(() => [
  { label: 'Todos los clientes', value: TODOS },
  ...clientes.value.map((cliente) => ({
    label: cliente.activo ? cliente.nombre : `${cliente.nombre} (desactivado)`,
    value: cliente.id,
  })),
])
const opcionesDeTipos = computed(() => [
  { label: 'Todos los tipos', value: TODOS },
  ...tipos.value.map((tipo) => ({
    label: tipo.activo ? tipo.nombre : `${tipo.nombre} (desactivado)`,
    value: tipo.id,
  })),
])

const cifrasDeHoras = computed(() => {
  const resumen = informe.value.resumen
  return [
    {
      clave: 'total',
      icono: 'schedule',
      valor: formatearDuracion(resumen.minutos_total),
      etiqueta: 'Horas totales',
      ayuda: 'Todo el tiempo de bloques terminados en el periodo y con los filtros elegidos.',
    },
    {
      clave: 'cobrables',
      icono: 'payments',
      valor: formatearDuracion(resumen.minutos_cobrables),
      etiqueta: 'Cobrables',
      ayuda: 'Tiempo de bloques marcados como cobrables cuando se registraron.',
    },
    {
      clave: 'no-cobrables',
      icono: 'money_off',
      valor: formatearDuracion(resumen.minutos_no_cobrables),
      etiqueta: 'No cobrables',
      ayuda: 'Tiempo de bloques que no estaban marcados como cobrables cuando se registraron.',
    },
    {
      clave: 'dias',
      icono: 'event_available',
      valor: String(resumen.dias_con_tiempo),
      etiqueta:
        resumen.dias_con_tiempo === 1 ? 'Día con tiempo registrado' : 'Días con tiempo registrado',
      ayuda: 'Días del periodo en los que empezó al menos un bloque de tiempo.',
    },
  ]
})

const cifrasDeJornada = computed(() => {
  const jornada = informe.value.resumen.jornada
  return [
    {
      clave: 'trabajadas',
      icono: 'work_history',
      valor: formatearDuracion(jornada.minutos_trabajados),
      etiqueta: 'Horas trabajadas',
      ayuda: 'Suma de lo trabajado en cada jornada del periodo, sin contar el descanso.',
    },
    {
      clave: 'extra',
      icono: 'more_time',
      valor: formatearDuracion(jornada.minutos_extra),
      etiqueta: 'Horas extra',
      extra: jornada.minutos_extra > 0,
      ayuda: 'Lo que pasó de tu jornada base en cada día, sumado.',
    },
    {
      clave: 'sin-asignar',
      icono: 'hourglass_empty',
      valor: formatearDuracion(jornada.minutos_sin_asignar),
      etiqueta: 'Sin asignar a actividades',
      ayuda: 'Tiempo trabajado que no quedó en ningún bloque de tiempo de actividades.',
    },
  ]
})

const seccionesDeBarras = computed(() => [
  {
    clave: 'por-cliente',
    titulo: 'Horas por cliente',
    ayuda: 'De mayor a menor tiempo registrado. El porcentaje es sobre el total del periodo.',
    filas: informe.value.por_cliente.map((fila) => ({
      id: fila.cliente_id,
      nombre: fila.cliente,
      minutos: fila.minutos,
      porcentaje: fila.porcentaje,
    })),
  },
  {
    clave: 'por-tipo',
    titulo: 'Horas por tipo de actividad',
    ayuda: 'De mayor a menor tiempo registrado. El porcentaje es sobre el total del periodo.',
    filas: informe.value.por_tipo.map((fila) => ({
      id: fila.tipo_id,
      nombre: fila.tipo,
      minutos: fila.minutos,
      porcentaje: fila.porcentaje,
    })),
  },
])

const COLUMNAS_BLOQUES = [
  { name: 'fecha', label: 'Fecha', field: 'fecha', align: 'left' },
  {
    name: 'cliente',
    label: 'Cliente',
    field: 'cliente',
    align: 'left',
    style: 'min-width: 140px; max-width: 240px; white-space: normal; overflow-wrap: anywhere',
  },
  {
    name: 'tipo',
    label: 'Tipo',
    field: 'tipo',
    align: 'left',
    style: 'min-width: 140px; max-width: 240px; white-space: normal; overflow-wrap: anywhere',
  },
  { name: 'inicio', label: 'Inicio', field: 'inicio', align: 'left' },
  { name: 'fin', label: 'Fin', field: 'fin', align: 'left' },
  { name: 'duracion', label: 'Duración', field: 'duracion', align: 'left' },
  { name: 'cobrable', label: 'Cobrable', field: 'cobrable', align: 'left' },
  { name: 'manual', label: 'A mano', field: 'manual', align: 'left' },
]

const COLUMNAS_JORNADAS = [
  { name: 'fecha', label: 'Fecha', field: 'fecha', align: 'left' },
  { name: 'entrada', label: 'Entrada', field: 'entrada', align: 'left' },
  { name: 'salida_descanso', label: 'Salida a descanso', field: 'salida_descanso', align: 'left' },
  {
    name: 'regreso_descanso',
    label: 'Regreso de descanso',
    field: 'regreso_descanso',
    align: 'left',
  },
  { name: 'salida', label: 'Salida', field: 'salida', align: 'left' },
  { name: 'trabajado', label: 'Trabajado', field: 'trabajado', align: 'left' },
  { name: 'extra', label: 'Extra', field: 'extra', align: 'left' },
]

const filasDeBloques = computed(() =>
  (informe.value?.bloques ?? []).map((bloque) => ({
    ...bloque,
    ...horasDelBloque(bloque),
    fecha: fechaParaFormulario(bloque.fecha),
    duracion: formatearDuracion(bloque.minutos),
  })),
)

const filasDeJornadas = computed(() =>
  (informe.value?.jornadas ?? []).map((jornada) => ({
    fecha: fechaParaFormulario(jornada.fecha),
    entrada: jornada.entrada ?? SIN_DATO,
    salida_descanso: jornada.salida_descanso ?? SIN_DATO,
    regreso_descanso: jornada.regreso_descanso ?? SIN_DATO,
    salida: jornada.salida ?? SIN_DATO,
    trabajado: formatearDuracion(jornada.minutos_trabajados),
    extra: formatearDuracion(jornada.minutos_extra),
    hayExtra: jornada.minutos_extra > 0,
  })),
)

// Evita que una respuesta lenta de un periodo anterior pise la del que se ve ahora.
let secuencia = 0

// En silencio no se muestra la carga ni el error: si falla, se queda lo que ya había.
const cargar = async ({ silencioso = false } = {}) => {
  if (!periodo.value.valido) return
  const actual = ++secuencia
  const pedido = { desde: periodo.value.desde, hasta: periodo.value.hasta }
  if (!silencioso) {
    cargando.value = true
    error.value = null
  }
  try {
    const resultado = await obtenerTiempo({
      ...pedido,
      cliente_id: filtroDe(clienteElegido.value),
      tipo_id: filtroDe(tipoElegido.value),
    })
    if (actual !== secuencia) return
    informe.value = resultado
    periodoDelInforme.value = pedido
    error.value = null
  } catch (fallo) {
    if (actual !== secuencia || silencioso) return
    error.value = fallo
  } finally {
    if (actual === secuencia) cargando.value = false
  }
}

const cargarOpciones = async () => {
  try {
    const [listaClientes, listaTipos] = await Promise.all([listarClientes(), listarTipos()])
    clientes.value = listaClientes
    tipos.value = listaTipos
  } catch {
    // Sin las listas solo faltan los filtros; el informe sigue disponible y su propio error se muestra aparte.
  }
}

const irAEsteMes = () => {
  periodoTexto.value = periodoDelMes()
}

// Cambiar el periodo (ya válido) o un filtro vuelve a pedir el informe.
watch(
  () => [periodo.value.desde, periodo.value.hasta, clienteElegido.value, tipoElegido.value],
  () => cargar(),
)
watch(informe, () => {
  paginaBloques.value = { ...paginaBloques.value, page: 1 }
  paginaJornadas.value = { ...paginaJornadas.value, page: 1 }
})

// Al detener un cronómetro o cambiar bloques de tiempo se relee el informe sin pantalla de carga.
watch(
  () => cronometro.cambios,
  () => cargar({ silencioso: true }),
)

const alVolverALaVentana = () => {
  if (document.visibilityState === 'visible') cargar({ silencioso: true })
}

const descargar = () => {
  if (!informe.value || !periodoDelInforme.value) return
  const { desde, hasta } = periodoDelInforme.value
  const nombre = nombreArchivoCsv(desde, hasta)
  try {
    descargarCsv(armarCsv(informe.value.bloques), nombre)
    $q.notify({ type: 'positive', message: `Se descargó ${nombre}.` })
  } catch {
    $q.notify({
      type: 'negative',
      message: 'No se pudo descargar el archivo CSV.',
      caption: 'Vuelve a intentarlo; si sigue fallando, recarga la página.',
      timeout: 8000,
    })
  }
}

onMounted(() => {
  cargarOpciones()
  cargar()
  document.addEventListener('visibilitychange', alVolverALaVentana)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', alVolverALaVentana))
</script>

<style scoped>
.informes {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.informes__resultado {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.informes__resultado > .informes__tarjeta,
.informes__resultado > .informes__barras {
  transition: opacity 150ms var(--dg-curva-salida);
}

.informes__resultado--actualizando > .informes__tarjeta,
.informes__resultado--actualizando > .informes__barras {
  opacity: 0.55;
}

/* Sobre el hueco entre tarjetas: no empuja el contenido al aparecer. */
.informes__progreso {
  position: absolute;
  top: -10px;
  right: 0;
  left: 0;
  border-radius: 2px;
}

.informes__tarjeta {
  border-radius: 12px;
  border-color: var(--dg-borde);
  min-width: 0;
}

.informes__titulo {
  margin: 0 0 4px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.3;
}

.informes__subtitulo {
  margin: 16px 0 8px;
  color: var(--dg-texto);
  font-size: 1rem;
  font-weight: 600;
}

.informes__ayuda,
.informes__nota {
  margin: 0 0 12px;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.informes__nota {
  margin: 8px 0 0;
}

.informes__aviso {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
}

.informes__aviso--suelto {
  margin: 0 0 4px;
}

/* Filtros: una columna en celular y varias en pantallas anchas. */
.informes__campos {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

@media (min-width: 600px) {
  .informes__campos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .informes__campos {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.informes__campo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.informes__campo--boton {
  justify-content: flex-start;
}

/* Junto a «Desde» y «Hasta»: baja lo que mide la etiqueta para quedar a la altura de los campos, sin estirarse. */
@media (min-width: 600px) {
  .informes__campo--boton {
    align-items: flex-start;
    padding-top: 24px;
  }
}

.informes__calendario-icono {
  cursor: pointer;
}

.informes__calendario-icono:focus-visible {
  outline: 3px solid var(--dg-foco);
  outline-offset: 2px;
}

.informes__cabecera-seccion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin-bottom: 8px;
}

.informes__cabecera-seccion .informes__titulo {
  margin: 0;
}

.informes__cifras {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 900px) {
  .informes__cifras {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.informes__cifra {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
  background: var(--dg-fondo-panel);
  cursor: help;
}

.informes__cifra-valor {
  color: var(--dg-texto);
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.informes__cifra-valor--extra {
  color: var(--dg-exito);
}

.informes__cifra-etiqueta {
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
}

.informes__barras {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

@media (min-width: 1024px) {
  .informes__barras {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.informes__lista-barras {
  padding: 0;
}

.informes__barra {
  padding-right: 0;
  padding-left: 0;
}

.informes__barra-texto {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 2px 12px;
  margin-bottom: 4px;
}

.informes__barra-nombre {
  min-width: 0;
  color: var(--dg-texto);
  overflow-wrap: anywhere;
}

.informes__barra-valor {
  color: var(--dg-texto-secundario);
  font-variant-numeric: tabular-nums;
}

.informes__tabla {
  background: transparent;
}

.informes__sin-dato {
  color: var(--dg-texto-tenue);
}

/* Tarjetas del detalle en pantallas angostas (el q-table en modo cuadrícula). */
.informes__tarjeta-bloque-columna {
  width: 100%;
  padding: 4px 0;
}

.informes__tarjeta-bloque {
  border-radius: 8px;
  border-color: var(--dg-borde);
}

.informes__bloque-fecha {
  margin: 0 0 4px;
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.informes__bloque-cliente {
  margin: 0;
  color: var(--dg-texto);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.informes__bloque-tipo {
  margin: 0 0 8px;
  color: var(--dg-texto-secundario);
  overflow-wrap: anywhere;
}

.informes__bloque-pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  color: var(--dg-texto);
}
</style>
