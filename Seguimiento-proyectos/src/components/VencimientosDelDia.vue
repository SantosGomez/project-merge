<template>
  <section class="venc" aria-labelledby="venc-titulo">
    <div class="venc__encabezado">
      <h2 id="venc-titulo" ref="encabezado" class="venc__titulo" tabindex="-1">{{ titulo }}</h2>
      <q-chip
        removable
        dense
        color="primary"
        text-color="dg-superficie"
        class="venc__chip control-touch"
        :label="etiquetaChip"
        remove-aria-label="Volver a la vista general"
        @remove="emit('volver')"
      >
        <q-tooltip>Volver a la vista general</q-tooltip>
      </q-chip>
    </div>

    <q-tabs
      v-model="pestana"
      no-caps
      inline-label
      align="left"
      active-color="primary"
      indicator-color="primary"
      class="venc__tabs"
    >
      <q-tab
        name="casos"
        icon="assignment"
        label="Casos"
        :aria-label="`Casos, ${grupos.casos.length}`"
      >
        <q-badge
          color="dg-fondo-seleccion"
          text-color="dg-texto"
          class="q-ml-sm"
          :label="grupos.casos.length"
        />
        <q-tooltip>Casos importantes de esta lista.</q-tooltip>
      </q-tab>
      <q-tab
        name="auditorias"
        icon="fact_check"
        label="Auditorías"
        :aria-label="`Auditorías, ${grupos.auditorias.length}`"
      >
        <q-badge
          color="dg-fondo-seleccion"
          text-color="dg-texto"
          class="q-ml-sm"
          :label="grupos.auditorias.length"
        />
        <q-tooltip>Vencimientos de auditoría y entregas de esta lista.</q-tooltip>
      </q-tab>
    </q-tabs>

    <div class="venc__cuerpo">
      <p v-if="grupos[pestana].length === 0" class="venc__nada" role="status">{{ textoVacio }}</p>

      <template v-else>
        <section
          v-for="bloque in bloques"
          :key="bloque.clave"
          class="venc__grupo"
          :aria-label="bloque.titulo ? undefined : 'Casos'"
          :aria-labelledby="bloque.titulo ? `venc-grupo-${bloque.clave}` : undefined"
        >
          <h3 v-if="bloque.titulo" :id="`venc-grupo-${bloque.clave}`" class="venc__grupo-titulo">
            {{ bloque.titulo }}
            <q-badge
              color="dg-fondo-seleccion"
              text-color="dg-texto"
              :label="bloque.elementos.length"
              :aria-label="`${bloque.elementos.length} en este grupo`"
            />
          </h3>

          <q-list separator class="venc__lista" :aria-label="bloque.titulo || 'Casos'">
            <q-item v-for="elemento in bloque.elementos" :key="elemento.clave" class="venc__fila">
              <q-item-section class="venc__principal">
                <q-item-label class="venc__cliente">{{ elemento.titulo }}</q-item-label>
                <q-item-label v-if="elemento.detalle" caption class="venc__detalle">
                  {{ elemento.detalle }}
                </q-item-label>
                <q-item-label caption class="venc__marcas">
                  <q-badge
                    :color="ESTILO_DE_URGENCIA[urgenciaDeElemento(elemento)].fondo"
                    :text-color="ESTILO_DE_URGENCIA[urgenciaDeElemento(elemento)].texto"
                    class="venc__etiqueta"
                  >
                    <q-icon
                      :name="ESTILO_DE_URGENCIA[urgenciaDeElemento(elemento)].icono"
                      size="14px"
                      aria-hidden="true"
                      class="q-mr-xs"
                    />
                    {{ textoDeUrgencia(urgenciaDeElemento(elemento)) }}
                    <q-tooltip>{{
                      ESTILO_DE_URGENCIA[urgenciaDeElemento(elemento)].ayuda
                    }}</q-tooltip>
                  </q-badge>
                  <span v-if="mostrarFecha" class="venc__fecha"
                    >Vence el {{ tituloDeDia(elemento.vence).toLowerCase() }}</span
                  >
                  <span class="venc__contador">{{ textoDeContador(elemento) }}</span>
                </q-item-label>
              </q-item-section>
              <q-item-section side class="venc__lado">
                <q-btn
                  flat
                  no-caps
                  dense
                  color="primary"
                  icon="visibility"
                  label="Ver"
                  class="control-touch boton-presionable"
                  :aria-label="`Ver ${etiquetaDeVer(elemento)} de ${elemento.titulo}`"
                  v-bind="enlaceDeVer(elemento)"
                  @click="alVer(elemento)"
                >
                  <q-tooltip>{{ ayudaDeVer(elemento) }}</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </section>
      </template>
    </div>

    <CasoDetalleDialog v-if="casoEnDetalle" v-model="detalleAbierto" :caso="casoEnDetalle" />
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import CasoDetalleDialog from './CasoDetalleDialog.vue'
import {
  agruparPorPestana,
  pestanaDelDia,
  textoDeUrgencia,
  urgenciaDe,
} from '../utils/calendarioAdministrador.js'
import { tituloDeDia } from '../utils/actividades.js'

/*
 * Modo día / rango del dashboard del administrador: lo que vence un día (o lo que abre una cifra
 * de la franja) en dos pestañas, Casos y Auditorías. Si la pestaña elegida queda vacía se abre la
 * otra. «Esc» o el chip regresan a la vista general. El foco y el desplazamiento al encabezado los maneja la página.
 */
const props = defineProps({
  /** Elementos del día o del rango, ya filtrados por contador y ordenados. */
  elementos: { type: Array, required: true },
  titulo: { type: String, required: true },
  /** Texto del chip que regresa a la vista general («12 nov»). */
  etiquetaChip: { type: String, required: true },
  hoy: { type: String, required: true },
  /** En un rango hay varios días: cada renglón dice su fecha. */
  mostrarFecha: { type: Boolean, default: false },
  textoVacio: { type: String, default: 'Nada vence este día.' },
})

const emit = defineEmits(['volver'])

const grupos = computed(() => agruparPorPestana(props.elementos))
const pestana = ref(pestanaDelDia(grupos.value, 'casos'))

// Si la pestaña abierta queda vacía (otro día, otro filtro) se abre la otra con contenido.
watch(grupos, (nuevos) => {
  pestana.value = pestanaDelDia(nuevos, pestana.value)
})

// Casos en un solo bloque; Auditorías en dos subgrupos (vencimientos y entregas) si tienen contenido.
const bloques = computed(() =>
  pestana.value === 'casos'
    ? [{ clave: 'casos', titulo: null, elementos: grupos.value.casos }]
    : [
        {
          clave: 'vencimientos',
          titulo: 'Vencimientos de auditoría',
          elementos: grupos.value.vencimientos,
        },
        { clave: 'entregas', titulo: 'Entregas de auditoría', elementos: grupos.value.entregas },
      ].filter((bloque) => bloque.elementos.length > 0),
)

const ESTILO_DE_URGENCIA = {
  vencido: {
    fondo: 'dg-error-fondo',
    texto: 'dg-error',
    icono: 'error_outline',
    ayuda: 'La fecha de vencimiento ya pasó.',
  },
  pronto: {
    fondo: 'dg-vence-pronto-fondo',
    texto: 'dg-aviso-texto',
    icono: 'schedule',
    ayuda: 'Vence hoy o en los próximos 3 días.',
  },
  'a-tiempo': {
    fondo: 'dg-exito-fondo',
    texto: 'dg-exito',
    icono: 'check_circle_outline',
    ayuda: 'Todavía faltan más de 3 días.',
  },
}

const urgenciaDeElemento = (elemento) => urgenciaDe(elemento.vence, props.hoy)

const textoDeContador = (elemento) => {
  const nombres = elemento.contadores.map((c) => c.nombre).join(', ') || 'Sin contador'
  const base = `Contador: ${nombres}`
  return elemento.deAuxiliar ? `${base} · de ${elemento.deAuxiliar}` : base
}

const etiquetaDeVer = (elemento) =>
  ({ caso: 'el caso', auditoria: 'la auditoría', entrega: 'la auditoría de la entrega' })[
    elemento.tipo
  ]
const ayudaDeVer = (elemento) =>
  elemento.tipo === 'caso'
    ? 'Abre la ficha del caso, solo para consultar.'
    : 'Abre la ficha de la auditoría.'

// Casos: abren la ficha en un diálogo; auditorías y entregas llevan a la ficha de la auditoría.
const enlaceDeVer = (elemento) =>
  elemento.tipo === 'caso'
    ? {}
    : { to: { name: 'auditoria-ficha', params: { id: elemento.auditoriaId } } }

const detalleAbierto = ref(false)
const casoEnDetalle = ref(null)
const alVer = (elemento) => {
  if (elemento.tipo !== 'caso') return
  casoEnDetalle.value = elemento.caso
  detalleAbierto.value = true
}

// «Esc» vuelve a la vista general, salvo que haya un diálogo o un menú abierto (ellos lo usan primero).
const alTeclear = (evento) => {
  if (evento.key !== 'Escape' || evento.defaultPrevented) return
  if (detalleAbierto.value || document.querySelector('.q-dialog, .q-menu')) return
  emit('volver')
}

const encabezado = ref(null)

/**
 * Lleva el foco al encabezado y lo deja a la vista. En celular (`alInicio`) queda arriba de la
 * pantalla para que la lista no se pierda debajo del calendario.
 */
const enfocar = ({ alInicio = false } = {}) => {
  encabezado.value?.focus({ preventScroll: true })
  encabezado.value?.scrollIntoView({ block: alInicio ? 'start' : 'nearest' })
}
defineExpose({ enfocar })

onMounted(() => document.addEventListener('keydown', alTeclear))
onBeforeUnmount(() => document.removeEventListener('keydown', alTeclear))
</script>

<style scoped>
.venc {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--dg-borde);
  border-radius: 12px;
  background: var(--dg-fondo-panel);
}

.venc__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 4px;
}

.venc__titulo {
  /* El encabezado de la barra superior (celular) no debe tapar el título al desplazarse */
  scroll-margin-top: 72px;
  flex: 1 1 220px;
  min-width: 0;
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.venc__titulo:focus-visible {
  outline: 3px solid var(--dg-foco);
  outline-offset: 2px;
}

.venc__chip {
  margin: 0;
}

.venc__tabs {
  border-bottom: 1px solid var(--dg-borde);
  color: var(--dg-texto-secundario);
}

.venc__cuerpo {
  padding-top: 12px;
}

.venc__nada {
  margin: 0;
  padding: 20px 16px;
  border: 1px dashed var(--dg-borde-discontinuo);
  border-radius: 10px;
  background: var(--dg-superficie);
  color: var(--dg-texto-secundario);
  text-align: center;
}

.venc__grupo + .venc__grupo {
  margin-top: 16px;
}

.venc__fila {
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 4px 0;
}

.venc__principal {
  flex: 1 1 220px;
  min-width: 0;
}

.venc__lado {
  padding-left: 0;
}

.venc__cliente {
  color: var(--dg-texto);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.venc__detalle {
  color: var(--dg-texto-secundario);
  overflow-wrap: anywhere;
}

.venc__marcas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.venc__contador,
.venc__fecha {
  color: var(--dg-texto-secundario);
  overflow-wrap: anywhere;
}

.venc__etiqueta {
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 700;
}

.venc__grupo-titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.3;
}
</style>
