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
              :class="indicador.semaforo ? `semaforo--${claseSemaforo(indicador.semaforo)}` : null"
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
                      track-color="dg-fondo-suave"
                      size="14px"
                      rounded
                      class="grafica__barra grafica__barra--semaforo"
                      :class="`semaforo--${barra.clase}`"
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
                  class="avance__cliente avance__franja"
                  :class="`semaforo--${claseSemaforo(auditoria.semaforo)}`"
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
                    class="avance__semaforo semaforo-etiqueta"
                    :class="`semaforo--${claseSemaforo(auditoria.semaforo)}`"
                  >
                    {{ auditoria.semaforo }}
                  </span>
                </td>
              </tr>
            </tbody>
          </q-markup-table>
        </q-tab-panel>

        <q-tab-panel name="kanban" class="tablero__panel">
          <div class="kanban__barra">
            <p class="tablero__ayuda kanban__ayuda">
              ¿En qué fase está cada auditoría? El color de la tarjeta indica su semáforo; la fase
              cambia al registrar eventos en la bitácora. Haz clic en una tarjeta para abrir su
              ficha.
            </p>
            <q-btn
              flat
              no-caps
              color="dg-acento"
              icon="print"
              label="Imprimir reporte"
              class="control-touch"
              @click="imprimirReporte"
            >
              <q-tooltip>Imprime el Kanban o guárdalo como PDF, en hoja horizontal.</q-tooltip>
            </q-btn>
          </div>

          <!-- Encabezado del reporte: solo aparece en la hoja impresa o en el PDF -->
          <div class="reporte-kanban">
            <h2 class="reporte-kanban__titulo">Reporte Kanban de auditorías</h2>
            <p class="reporte-kanban__datos">
              Corte al {{ fechaCorte }} · {{ auditorias.length }} auditorías:
              {{ indicadores.activas }} activas y
              {{ auditorias.length - indicadores.activas }} concluidas. El color de cada tarjeta
              indica su semáforo.
            </p>
          </div>

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
                :class="`semaforo--${claseSemaforo(auditoria.semaforo)}`"
                @click="verFicha(auditoria.id)"
                @keydown.enter="verFicha(auditoria.id)"
              >
                <span class="kanban__cliente">{{ auditoria.cliente }}</span>
                <span class="kanban__dato">{{ auditoria.tipoAud }}</span>
                <span class="kanban__dato">Expediente {{ auditoria.noExpediente }}</span>
                <span
                  class="avance__semaforo kanban__semaforo semaforo-etiqueta"
                  :class="`semaforo--${claseSemaforo(auditoria.semaforo)}`"
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
} from '../utils/tableroAuditorias.js'
import { claseSemaforo, textoDiasPlazo } from '../utils/semaforoAuditoria.js'
import { fechaParaFormulario } from '../utils/fechasCaso.js'
import { hoyLocal } from '../utils/filtrosCasos.js'

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
    semaforo: 'Vencido',
    etiqueta: 'Vencidas',
    ayuda: 'Tienen un plazo pendiente de la bitácora que ya pasó.',
  },
  {
    clave: 'criticas',
    semaforo: 'Crítico',
    etiqueta: 'Críticas (≤ 7 días)',
    ayuda: 'Un plazo pendiente vence en 7 días o menos.',
  },
  {
    clave: 'atencion',
    semaforo: 'Atención',
    etiqueta: 'En atención',
    ayuda: 'Un plazo vence en 20 días o menos, o a la autoridad le quedan 60 días o menos.',
  },
]

const SIMBOLO_MARCA = { cumplida: '✔', actual: '●', pendiente: '' }

const auditorias = ref([])
const fases = ref([])
const cargando = ref(true)
const errorCarga = ref(null)

const indicadores = computed(() => indicadoresAuditorias(auditorias.value))

// Proporción 0-1 para la barra; sin datos, barra vacía.
const proporcion = (valor, total) => (total > 0 ? valor / total : 0)

const barrasSemaforo = computed(() => {
  const conteo = contarPorSemaforo(auditorias.value)
  return SEMAFOROS.map((semaforo) => ({
    semaforo,
    valor: conteo[semaforo],
    proporcion: proporcion(conteo[semaforo], auditorias.value.length),
    clase: claseSemaforo(semaforo),
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

// Reporte del Kanban: el diálogo del navegador permite imprimir o guardar como PDF.
const fechaCorte = computed(() => fechaParaFormulario(hoyLocal()))
const imprimirReporte = () => window.print()
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
  /* Color del semáforo que cuenta la tarjeta; «Activas» no es un semáforo y usa el acento */
  border-left-color: var(--semaforo-color, var(--dg-acento));
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

/* Cada barra de semáforo toma su color de la clase global semaforo--<clase> */
.grafica__barra--semaforo {
  color: var(--semaforo-color);
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

.kanban__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
  margin-bottom: 8px;
}

.kanban__ayuda {
  flex: 1 1 280px;
  margin: 0;
}

/* El encabezado del reporte solo sale al imprimir */
.reporte-kanban {
  display: none;
}

.reporte-kanban__titulo {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.2rem;
  font-weight: 700;
}

.reporte-kanban__datos {
  margin: 2px 0 10px;
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
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
  border-left-color: var(--semaforo-color);
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
.avance__franja {
  box-shadow: inset 5px 0 0 var(--semaforo-color);
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

/* El reporte del Kanban se imprime en hoja horizontal (página con nombre, solo para el Kanban) */
@page kanban {
  size: landscape;
  margin: 10mm;
}

/*
 * Impresión del Kanban: solo el encabezado del reporte y las seis columnas, sin menú, barras,
 * pestañas ni botones. `body:has(.kanban)` limita estas reglas a cuando el Kanban está a la vista.
 */
@media print {
  :global(body:has(.kanban) .q-drawer),
  :global(body:has(.kanban) .q-header),
  :global(body:has(.kanban) .page-header),
  :global(body:has(.kanban) .q-btn),
  :global(body:has(.kanban) .q-tabs),
  :global(body:has(.kanban) .dashboard-page__head),
  :global(body:has(.kanban) .kanban__ayuda) {
    display: none !important;
  }

  /* Todo el documento en la página horizontal: si solo el Kanban la usara, el navegador
     cortaría la hoja antes y después de él y lo acomodaría con el ancho vertical */
  :global(body:has(.kanban)) {
    page: kanban;
  }

  :global(body:has(.kanban) .q-page-container) {
    padding: 0 !important;
  }

  /* Sin la altura mínima de pantalla completa: con ella sobraba una hoja en blanco al final */
  :global(body:has(.kanban) .q-layout),
  :global(body:has(.kanban) .q-page-container),
  :global(body:has(.kanban) .q-page) {
    min-height: 0 !important;
  }

  :global(body:has(.kanban) .dashboard-page) {
    padding: 0;
  }

  /* La hoja horizontal cae en el rango de tableta del dashboard (720 px centrados): todo el ancho */
  :global(body:has(.kanban) .dashboard-page__inner) {
    max-width: none !important;
    margin: 0 !important;
  }

  .reporte-kanban {
    display: block;
  }

  .kanban {
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 6px;
    overflow: visible;
  }

  .kanban__columna {
    padding: 6px;
  }

  .kanban__fase {
    font-size: 0.75rem;
  }

  .kanban__tarjeta {
    padding: 6px;
    break-inside: avoid;
  }

  .kanban__cliente {
    font-size: 0.8rem;
  }

  .kanban__dato {
    font-size: 0.7rem;
  }

  /* Que el navegador imprima los colores de las franjas y etiquetas del semáforo */
  .kanban__columna,
  .kanban__tarjeta {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
</style>
