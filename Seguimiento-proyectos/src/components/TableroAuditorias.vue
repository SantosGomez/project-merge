<template>
  <section class="tablero" aria-label="Tablero de auditorías">
    <ScreenLoader v-if="cargando" text="Cargando las auditorías…" />

    <ErrorState
      v-else-if="errorCarga"
      :detail="errorCarga.mensaje ?? 'las auditorías.'"
      @retry="cargar"
    />

    <EmptyState
      v-else-if="auditorias.length === 0"
      title="No hay auditorías registradas"
      message="Cuando los contadores registren auditorías, aquí verás sus indicadores y su avance por fase."
    />

    <template v-else>
      <q-tabs
        v-model="vista"
        dense
        no-caps
        inline-label
        align="left"
        active-color="primary"
        indicator-color="primary"
        class="tablero__tabs"
      >
        <q-tab name="resumen" icon="insights" label="Resumen">
          <q-tooltip>Indicadores de todas las auditorías.</q-tooltip>
        </q-tab>
        <q-tab name="avance" icon="view_timeline" label="Avance">
          <q-tooltip>En qué fase va cada auditoría y qué vence después.</q-tooltip>
        </q-tab>
        <q-tab name="kanban" icon="view_kanban" label="Kanban">
          <q-tooltip>Una columna por fase con la tarjeta de cada auditoría.</q-tooltip>
        </q-tab>
      </q-tabs>

      <q-tab-panels v-model="vista" animated class="tablero__paneles">
        <q-tab-panel name="resumen" class="tablero__panel">
          <div class="tablero__indicadores">
            <q-card
              v-for="indicador in tarjetasIndicadores"
              :key="indicador.clave"
              flat
              bordered
              class="indicador"
              :class="`indicador--${indicador.clave}`"
            >
              <span class="indicador__valor">{{ indicadores[indicador.clave] }}</span>
              <span class="indicador__etiqueta">{{ indicador.etiqueta }}</span>
              <q-tooltip max-width="260px">{{ indicador.ayuda }}</q-tooltip>
            </q-card>
          </div>

          <div class="tablero__graficas">
            <q-card flat bordered class="grafica">
              <q-card-section>
                <h3 class="grafica__titulo">Auditorías por semáforo</h3>
                <p class="grafica__ayuda">Todas las auditorías, incluidas las concluidas.</p>
                <ul class="grafica__barras">
                  <li v-for="barra in barrasSemaforo" :key="barra.semaforo" class="grafica__fila">
                    <span class="grafica__etiqueta">{{ barra.semaforo }}</span>
                    <q-linear-progress
                      :value="barra.proporcion"
                      :color="barra.color"
                      track-color="dg-fondo-suave"
                      size="14px"
                      rounded
                      class="grafica__barra"
                      :aria-label="`${barra.semaforo}: ${barra.valor} de ${auditorias.length}`"
                    />
                    <span class="grafica__valor">{{ barra.valor }}</span>
                  </li>
                </ul>
              </q-card-section>
            </q-card>

            <q-card flat bordered class="grafica">
              <q-card-section>
                <h3 class="grafica__titulo">Activas por fase</h3>
                <p class="grafica__ayuda">
                  Solo auditorías no concluidas, según la fase más avanzada de su bitácora.
                </p>
                <ul class="grafica__barras">
                  <li v-for="barra in barrasFase" :key="barra.id" class="grafica__fila">
                    <span class="grafica__etiqueta">
                      {{ barra.nombre }}
                      <q-tooltip max-width="260px">{{ barra.descripcion }}</q-tooltip>
                    </span>
                    <q-linear-progress
                      :value="barra.proporcion"
                      color="dg-acento"
                      track-color="dg-fondo-suave"
                      size="14px"
                      rounded
                      class="grafica__barra"
                      :aria-label="`${barra.nombre}: ${barra.valor} de ${indicadores.activas} activas`"
                    />
                    <span class="grafica__valor">{{ barra.valor }}</span>
                  </li>
                </ul>
              </q-card-section>
            </q-card>
          </div>

          <q-card flat bordered class="grafica">
            <q-card-section>
              <h3 class="grafica__titulo">Activas por tipo y fase</h3>
              <p class="grafica__ayuda">
                Las columnas de fase cuentan solo las auditorías activas de cada tipo.
              </p>
              <q-markup-table flat dense wrap-cells separator="cell" class="tipo-fase">
                <thead>
                  <tr>
                    <th class="text-left">Tipo de auditoría</th>
                    <th class="text-right">Activas</th>
                    <th class="text-right">Concluidas</th>
                    <th class="text-right">Total</th>
                    <th v-for="fase in fases" :key="fase.id" class="text-right">
                      {{ fase.id }}
                      <q-tooltip>{{ fase.nombre }}</q-tooltip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="fila in tablaTipo.filas" :key="fila.tipo">
                    <td>{{ fila.tipo }}</td>
                    <td class="text-right">{{ fila.activas }}</td>
                    <td class="text-right">{{ fila.concluidas }}</td>
                    <td class="text-right">{{ fila.total }}</td>
                    <td
                      v-for="(cuantas, i) in fila.fases"
                      :key="i"
                      class="text-right"
                      :class="{ 'tipo-fase__cero': !cuantas }"
                    >
                      {{ cuantas }}
                    </td>
                  </tr>
                  <tr class="tipo-fase__total">
                    <td>Total</td>
                    <td class="text-right">{{ tablaTipo.total.activas }}</td>
                    <td class="text-right">{{ tablaTipo.total.concluidas }}</td>
                    <td class="text-right">{{ tablaTipo.total.total }}</td>
                    <td v-for="(cuantas, i) in tablaTipo.total.fases" :key="i" class="text-right">
                      {{ cuantas }}
                    </td>
                  </tr>
                </tbody>
              </q-markup-table>
            </q-card-section>
          </q-card>
        </q-tab-panel>

        <q-tab-panel name="avance" class="tablero__panel">
          <p class="tablero__ayuda">
            ✔ fase cumplida · ● fase actual. Ordenadas por urgencia: primero lo vencido y lo que
            vence antes. Haz clic en una auditoría para abrir su ficha.
          </p>
          <q-markup-table flat bordered dense wrap-cells class="avance">
            <thead>
              <tr>
                <th class="text-left">Cliente</th>
                <th class="text-left">Tipo</th>
                <th class="text-left">Dependencia</th>
                <th v-for="fase in fases" :key="fase.id" class="text-center avance__fase-th">
                  {{ fase.id }}
                  <q-tooltip>{{ fase.nombre }}</q-tooltip>
                </th>
                <th class="text-left">Próximo vencimiento</th>
                <th class="text-left">¿Qué vence?</th>
                <th class="text-left">Días</th>
                <th class="text-left">Semáforo</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="auditoria in auditoriasOrdenadas"
                :key="auditoria.id"
                class="avance__fila"
                tabindex="0"
                @click="verFicha(auditoria.id)"
                @keydown.enter="verFicha(auditoria.id)"
              >
                <td
                  class="avance__cliente"
                  :class="`avance__franja--${claseSemaforo(auditoria.semaforo)}`"
                >
                  {{ auditoria.cliente }}
                  <div class="avance__tenue">Expediente {{ auditoria.noExpediente }}</div>
                </td>
                <td>{{ auditoria.tipoAud }}</td>
                <td>{{ auditoria.dependencia }}</td>
                <td
                  v-for="(marca, i) in marcasDeFases(auditoria.faseActual?.id, auditoria.semaforo)"
                  :key="i"
                  class="text-center"
                  :class="`avance__marca--${marca}`"
                >
                  {{ SIMBOLO_MARCA[marca] }}
                </td>
                <td class="avance__fecha">{{ auditoria.proximoVencimiento || '—' }}</td>
                <td>{{ auditoria.queVence || '—' }}</td>
                <td class="avance__fecha">{{ textoDiasPlazo(auditoria.diasParaVencer) }}</td>
                <td>
                  <span
                    class="avance__semaforo"
                    :class="`avance__semaforo--${claseSemaforo(auditoria.semaforo)}`"
                  >
                    {{ auditoria.semaforo }}
                  </span>
                </td>
              </tr>
            </tbody>
          </q-markup-table>
        </q-tab-panel>

        <q-tab-panel name="kanban" class="tablero__panel">
          <p class="tablero__ayuda">
            ¿En qué fase está cada auditoría? El color de la tarjeta indica su semáforo; la fase
            cambia al registrar eventos en la bitácora. Haz clic en una tarjeta para abrir su ficha.
          </p>
          <div class="kanban" role="list" aria-label="Auditorías por fase">
            <section
              v-for="(columna, i) in columnas"
              :key="i"
              class="kanban__columna"
              role="listitem"
              :aria-label="`${fases[i]?.nombre ?? `Fase ${i + 1}`}: ${columna.length}`"
            >
              <header class="kanban__cabecera">
                <span class="kanban__fase">{{ fases[i]?.nombre ?? `Fase ${i + 1}` }}</span>
                <q-badge rounded color="dg-acento" :label="columna.length" />
                <q-tooltip max-width="260px">{{ fases[i]?.descripcion }}</q-tooltip>
              </header>
              <p v-if="columna.length === 0" class="kanban__vacia">Sin auditorías en esta fase</p>
              <q-card
                v-for="auditoria in columna"
                :key="auditoria.id"
                flat
                bordered
                tabindex="0"
                class="kanban__tarjeta"
                :class="`kanban__tarjeta--${claseSemaforo(auditoria.semaforo)}`"
                @click="verFicha(auditoria.id)"
                @keydown.enter="verFicha(auditoria.id)"
              >
                <span class="kanban__cliente">{{ auditoria.cliente }}</span>
                <span class="kanban__dato">{{ auditoria.tipoAud }}</span>
                <span class="kanban__dato">Expediente {{ auditoria.noExpediente }}</span>
                <span
                  class="avance__semaforo kanban__semaforo"
                  :class="`avance__semaforo--${claseSemaforo(auditoria.semaforo)}`"
                >
                  {{ auditoria.semaforo }}
                </span>
                <span v-if="auditoria.proximoVencimiento" class="kanban__dato">
                  Vence {{ auditoria.proximoVencimiento }} ·
                  {{ textoDiasPlazo(auditoria.diasParaVencer) }}
                </span>
              </q-card>
            </section>
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </template>
  </section>
</template>

<script setup>
import { computed, onActivated, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import ScreenLoader from './ScreenLoader.vue'
import { listarAuditorias, listarFases } from '../services/auditoriaService.js'
import { eventos } from '../services/eventosService.js'
import { SEMAFOROS, contarPorSemaforo, ordenarAuditorias } from '../utils/listaAuditorias.js'
import {
  activasPorFase,
  columnasKanban,
  indicadoresAuditorias,
  marcasDeFases,
  tablaTipoFase,
  textoDiasPlazo,
} from '../utils/tableroAuditorias.js'

const route = useRoute()
const router = useRouter()

// Sub-pestaña en la URL (?vista=avance): al volver de una ficha se regresa a la misma vista.
const VISTAS = ['resumen', 'avance', 'kanban']
const vista = computed({
  get: () => (VISTAS.includes(route.query.vista) ? route.query.vista : 'resumen'),
  set: (valor) => router.replace({ query: { ...route.query, vista: valor } }),
})

const tarjetasIndicadores = [
  { clave: 'activas', etiqueta: 'Activas', ayuda: 'Auditorías que no están concluidas.' },
  {
    clave: 'vencidas',
    etiqueta: 'Vencidas',
    ayuda: 'Tienen un plazo pendiente de la bitácora que ya pasó.',
  },
  {
    clave: 'criticas',
    etiqueta: 'Críticas (≤ 7 días)',
    ayuda: 'Un plazo pendiente vence en 7 días o menos.',
  },
  {
    clave: 'atencion',
    etiqueta: 'En atención',
    ayuda: 'Un plazo vence en 20 días o menos, o a la autoridad le quedan 60 días o menos.',
  },
]

const SEMAFORO_CLASE = {
  Vencido: 'vencido',
  Crítico: 'critico',
  Atención: 'atencion',
  'En tiempo': 'en-tiempo',
  Concluida: 'concluida',
}
const claseSemaforo = (semaforo) => SEMAFORO_CLASE[semaforo] ?? 'en-tiempo'
const SIMBOLO_MARCA = { cumplida: '✔', actual: '●', pendiente: '' }

const auditorias = ref([])
const fases = ref([])
const cargando = ref(true)
const errorCarga = ref(null)

const indicadores = computed(() => indicadoresAuditorias(auditorias.value))

// Color de la barra de cada semáforo (paleta $dg-colores), igual que su franja en la lista.
const COLOR_SEMAFORO = {
  Vencido: 'dg-error',
  Crítico: 'dg-prioridad-alta-borde',
  Atención: 'dg-importante',
  'En tiempo': 'dg-exito-borde',
  Concluida: 'dg-neutro-borde',
}

// Proporción 0-1 para la barra; sin datos, barra vacía.
const proporcion = (valor, total) => (total > 0 ? valor / total : 0)

const barrasSemaforo = computed(() => {
  const conteo = contarPorSemaforo(auditorias.value)
  return SEMAFOROS.map((semaforo) => ({
    semaforo,
    valor: conteo[semaforo],
    proporcion: proporcion(conteo[semaforo], auditorias.value.length),
    color: COLOR_SEMAFORO[semaforo],
  }))
})

const barrasFase = computed(() => {
  const conteo = activasPorFase(auditorias.value)
  return fases.value.map((fase) => ({
    ...fase,
    valor: conteo[fase.id - 1] ?? 0,
    proporcion: proporcion(conteo[fase.id - 1] ?? 0, indicadores.value.activas),
  }))
})

const tablaTipo = computed(() => tablaTipoFase(auditorias.value))
const columnas = computed(() => columnasKanban(auditorias.value))
const auditoriasOrdenadas = computed(() => ordenarAuditorias(auditorias.value, 'urgencia'))

const cargar = async () => {
  cargando.value = true
  errorCarga.value = null
  try {
    const [lista, catalogo] = await Promise.all([listarAuditorias(), listarFases()])
    auditorias.value = lista
    fases.value = catalogo
  } catch (error) {
    errorCarga.value = error
  } finally {
    cargando.value = false
  }
}

/*
 * Tiempo real: cuando alguien registra o edita una auditoría o su bitácora, el servidor avisa
 * y la lista se vuelve a pedir sin loader, para que la vista no parpadee. Si falla, se
 * conservan los datos que ya se ven. Al reconectarse se refresca por si se perdió algún aviso.
 */
const refrescarEnSilencio = async () => {
  if (cargando.value || errorCarga.value) return
  try {
    auditorias.value = await listarAuditorias()
  } catch {
    // Se conserva la lista anterior; el siguiente aviso o la siguiente visita la actualizan.
  }
}

const dejarDeEscuchar = [
  eventos.escuchar('auditoria-actualizada', refrescarEnSilencio),
  eventos.escuchar('reconectado', refrescarEnSilencio),
]
onBeforeUnmount(() => dejarDeEscuchar.forEach((dejar) => dejar()))

// La pestaña vive dentro de un keep-alive: se recarga cada vez que se vuelve a mostrar.
onActivated(cargar)

// El dashboard la llama al registrar una auditoría desde «Asignar auditoría».
defineExpose({ cargar })

const verFicha = (id) => router.push({ name: 'auditoria-ficha', params: { id } })
</script>

<style scoped>
.tablero {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tablero__tabs {
  border-bottom: 1px solid var(--dg-borde);
  color: var(--dg-texto-secundario);
}

.tablero__paneles {
  background: transparent;
}

.tablero__panel {
  padding: 12px 0 0;
}

.tablero__ayuda {
  margin: 0 0 8px;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.tablero__indicadores {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.indicador {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 16px;
  border-left-width: 5px;
  border-radius: 10px;
  background: var(--dg-superficie);
}

.indicador__valor {
  color: var(--dg-texto);
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1.1;
}

.indicador__etiqueta {
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  font-weight: 600;
}

.indicador--activas {
  border-left-color: var(--dg-acento);
}

.indicador--vencidas {
  border-left-color: var(--dg-error);
}

.indicador--criticas {
  border-left-color: var(--dg-prioridad-alta-borde);
}

.indicador--atencion {
  border-left-color: var(--dg-importante);
}

/* Gráficas del resumen: dos tarjetas lado a lado en pantallas anchas */
.tablero__graficas {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  margin: 12px 0;
}

@media (min-width: 1024px) {
  .tablero__graficas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.grafica {
  border-color: var(--dg-borde);
  border-radius: 10px;
  background: var(--dg-superficie);
}

.grafica__titulo {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1rem;
  font-weight: 700;
}

.grafica__ayuda {
  margin: 2px 0 12px;
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
}

.grafica__barras {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.grafica__fila {
  display: grid;
  grid-template-columns: minmax(90px, 40%) minmax(0, 1fr) 32px;
  align-items: center;
  gap: 10px;
}

.grafica__etiqueta {
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.grafica__valor {
  color: var(--dg-texto);
  font-weight: 700;
  text-align: right;
}

.tipo-fase th {
  color: var(--dg-texto-secundario);
  font-weight: 700;
}

.tipo-fase td {
  color: var(--dg-texto);
}

.tipo-fase__cero {
  color: var(--dg-texto-tenue) !important;
}

.tipo-fase__total td {
  background: var(--dg-fondo-suave);
  font-weight: 700;
}

/* Kanban: seis columnas; si no caben, se desplazan de lado dentro de su marco */
.kanban {
  display: grid;
  grid-template-columns: repeat(6, minmax(220px, 1fr));
  gap: 12px;
  padding-bottom: 8px;
  overflow-x: auto;
}

.kanban__columna {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--dg-borde);
  border-radius: 10px;
  background: var(--dg-fondo-suave);
}

.kanban__cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--dg-borde-fuerte);
}

.kanban__fase {
  color: var(--dg-texto);
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1.3;
}

.kanban__vacia {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
}

.kanban__tarjeta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px;
  border-left-width: 5px;
  border-radius: 8px;
  background: var(--dg-superficie);
  cursor: pointer;
}

.kanban__tarjeta:hover {
  background: var(--dg-fondo-hover);
}

.kanban__tarjeta:focus-visible {
  outline: 3px solid var(--dg-foco);
  outline-offset: 2px;
}

.kanban__tarjeta--vencido {
  border-left-color: var(--dg-error);
}

.kanban__tarjeta--critico {
  border-left-color: var(--dg-prioridad-alta-borde);
}

.kanban__tarjeta--atencion {
  border-left-color: var(--dg-importante);
}

.kanban__tarjeta--en-tiempo {
  border-left-color: var(--dg-exito-borde);
}

.kanban__tarjeta--concluida {
  border-left-color: var(--dg-neutro-borde);
}

.kanban__cliente {
  color: var(--dg-texto);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.kanban__dato {
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}

.kanban__semaforo {
  margin: 4px 0 2px;
}

.avance {
  border-color: var(--dg-borde);
  background: var(--dg-superficie);
}

.avance th {
  color: var(--dg-texto-secundario);
  font-weight: 700;
}

.avance td {
  vertical-align: top;
  color: var(--dg-texto);
}

.avance__fila {
  cursor: pointer;
}

.avance__fila:focus-visible {
  outline: 3px solid var(--dg-foco);
  outline-offset: -3px;
}

.avance__fase-th {
  width: 36px;
}

.avance__cliente {
  min-width: 200px;
  font-weight: 700;
}

/* Franja del semáforo en el borde izquierdo de la fila */
.avance__franja--vencido {
  box-shadow: inset 5px 0 0 var(--dg-error);
}

.avance__franja--critico {
  box-shadow: inset 5px 0 0 var(--dg-prioridad-alta-borde);
}

.avance__franja--atencion {
  box-shadow: inset 5px 0 0 var(--dg-importante);
}

.avance__franja--en-tiempo {
  box-shadow: inset 5px 0 0 var(--dg-exito-borde);
}

.avance__franja--concluida {
  box-shadow: inset 5px 0 0 var(--dg-neutro-borde);
}

.avance__tenue {
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
  font-weight: 400;
}

.avance__fecha {
  white-space: nowrap;
}

.avance__marca--cumplida {
  color: var(--dg-exito);
  font-weight: 700;
}

.avance__marca--actual {
  background: var(--dg-fondo-seleccion);
  color: var(--dg-acento);
  font-weight: 700;
}

.avance__semaforo {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.avance__semaforo--vencido {
  background: var(--dg-error);
  color: var(--dg-superficie);
}

.avance__semaforo--critico {
  border: 1px solid var(--dg-prioridad-alta-borde);
  background: var(--dg-prioridad-alta-fondo);
  color: var(--dg-prioridad-alta);
}

.avance__semaforo--atencion {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.avance__semaforo--en-tiempo {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.avance__semaforo--concluida {
  background: var(--dg-neutro-fondo);
  color: var(--dg-texto-secundario);
}
</style>
