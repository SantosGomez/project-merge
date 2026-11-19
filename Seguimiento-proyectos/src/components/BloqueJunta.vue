<template>
  <component
    :is="ocupada ? 'div' : QBtn"
    v-bind="atributosDeLaRaiz"
    :class="[
      base,
      { [`${base}--ocupada`]: ocupada },
      { [`${base}--por-confirmar`]: !ocupada && junta.estado === 'por_confirmar' },
      { [`${base}--cancelada`]: !ocupada && junta.estado === 'cancelada' },
      { 'junta-etiqueta--mes': formato === 'mes', 'junta-etiqueta--arriba': formato === 'arriba' },
      { 'junta-bloque--compacto': compacto, 'junta--resaltada': resaltada },
      { 'boton-presionable': !ocupada },
    ]"
    :aria-label="nombreAccesible"
    @click.stop="alHacerClic"
  >
    <span class="junta-bloque__cuerpo">
      <span class="junta-bloque__linea">
        <span
          v-if="formato === 'arriba'"
          class="junta-bloque__titulo junta-bloque__titulo--libre"
          >{{ textoArriba }}</span
        >
        <template v-else>
          <span
            class="junta-bloque__hora"
            :class="{ 'junta-bloque__hora--solo-compacto': formato === 'bloque' }"
            >{{ hora }}</span
          >
          <span v-if="formato === 'mes'" class="junta-bloque__separador" aria-hidden="true">·</span>
          <q-icon v-if="conCandado" name="lock" size="12px" aria-hidden="true" />
          <span class="junta-bloque__titulo">{{ titulo }}</span>
        </template>
      </span>
      <span v-if="formato === 'bloque'" class="junta-bloque__horario">{{ horario }}</span>
      <span v-if="organiza" class="junta-bloque__organiza">{{ organiza }}</span>
      <span v-if="marcas.length > 0" class="junta-bloque__marcas">
        <MarcaJunta
          v-for="(marca, posicion) in marcas"
          :key="marca"
          :texto="marca"
          :solo-icono="soloIconoEnMarca(posicion)"
        />
      </span>
      <span v-if="nota" class="junta-bloque__nota">{{ nota }}</span>
    </span>
  </component>
</template>

<script setup>
import { computed } from 'vue'
import { QBtn } from 'quasar'

import MarcaJunta from './MarcaJunta.vue'
import {
  esBloqueCompacto,
  esJuntaOcupada,
  etiquetaDeJuntaOcupada,
  horaEnElDia,
  horarioDeJunta,
  marcasDeJunta,
} from '../utils/juntas.js'

/*
 * Un solo bloque de junta para Semana, Día y Mes, con cuatro variantes de estado: normal, «Por confirmar»
 * (rayado con borde de aviso), «Cancelada» (neutra y tachada) y «Ocupado» o ajena (rayado neutro, sin ficha).
 * `formato` dice dónde va: 'bloque' (cuadrícula de Semana y Día), 'mes' (una fila del Mes) o 'arriba'
 * (etiqueta de una junta fuera de 8:00 a 19:00, en la franja de arriba del día).
 * Es compacto (una sola línea «11:30 Título») con 45 px de alto o menos, o con 120 px de ancho o menos: el alto
 * lo decide `esBloqueCompacto` aquí; el ancho lo decide la consulta de contenedor de los estilos, porque solo el
 * navegador sabe cuánto mide. En el calendario no hay tooltips: el `aria-label` da el contexto.
 */
const props = defineProps({
  /** Junta tal como la devuelve la API (o bloque ajeno con `ocupado`). */
  junta: { type: Object, required: true },
  /** 'bloque', 'mes' o 'arriba'. */
  formato: { type: String, default: 'bloque' },
  /** Día AAAA-MM-DD en que se pinta (decide la hora que se muestra). */
  dia: { type: String, default: '' },
  /** Cuenta de la sesión, para «Responder». */
  usuarioId: { type: [Number, String], default: null },
  /** Persona cuya agenda se ve; null en la propia. */
  agendaId: { type: [Number, String], default: null },
  /** Alto del bloque en píxeles (solo formato 'bloque'). */
  alto: { type: Number, default: 0 },
  /** Nota de recorte («Empieza 07:00», «Sigue hasta 20:00»). */
  nota: { type: String, default: '' },
  /** Texto de la etiqueta de arriba del día (formato 'arriba'). */
  textoArriba: { type: String, default: '' },
  /** Anillo de acento de la junta recién guardada. */
  resaltada: { type: Boolean, default: false },
})

const emit = defineEmits(['abrir'])

const AYUDA_OCUPADA = 'No estás invitado a esta junta'

const ocupada = computed(() => esJuntaOcupada(props.junta))
const base = computed(() => (props.formato === 'bloque' ? 'junta-bloque' : 'junta-etiqueta'))
const compacto = computed(() => props.formato === 'bloque' && esBloqueCompacto(props.alto))

// Un bloque ajeno no abre ficha: se enfoca con el teclado y su `aria-label` explica por qué.
const atributosDeLaRaiz = computed(() =>
  ocupada.value
    ? { tabindex: 0, role: 'group' }
    : {
        unelevated: true,
        noCaps: true,
        dense: true,
        align: 'left',
        ripple: false,
        'data-junta-id': props.junta.id,
      },
)

const marcas = computed(() => marcasDeJunta(props.junta, props.usuarioId, props.agendaId))
const horario = computed(() => horarioDeJunta(props.junta))
const hora = computed(() => horaEnElDia(props.junta, props.dia))

// «Ocupado» (junta privada ajena) lleva candado; una pública de otra agenda dice su título y quién organiza.
const conCandado = computed(() => ocupada.value && props.junta.privada === true)
const titulo = computed(() => {
  if (!ocupada.value) return props.junta.titulo
  return props.junta.privada ? etiquetaDeJuntaOcupada(props.junta) : props.junta.titulo
})
const organiza = computed(() =>
  ocupada.value && !props.junta.privada && props.formato !== 'arriba'
    ? `organiza ${props.junta.organizador?.nombre ?? ''}`.trim()
    : '',
)

const nombreAccesible = computed(() => {
  if (ocupada.value) {
    return props.formato === 'arriba'
      ? `${props.textoArriba}. ${AYUDA_OCUPADA}.`
      : `${etiquetaDeJuntaOcupada(props.junta)}, ${horario.value}. ${AYUDA_OCUPADA}.`
  }
  const conMarcas = marcas.value.length > 0 ? `, ${marcas.value.join(' · ')}` : ''
  const detalle = `Junta ${props.junta.titulo}, ${horario.value}${conMarcas}. Abre los datos de la junta.`
  return props.formato === 'arriba' ? `${detalle} ${props.textoArriba}.` : detalle
})

// En un bloque de Semana, Día o Mes solo la primera marca lleva texto (suele ser el estado); las demás van en
// icono para no recortarse. El texto de todas sigue en el `aria-label`.
const soloIconoEnMarca = (posicion) => props.formato !== 'arriba' && posicion > 0

const alHacerClic = () => {
  if (!ocupada.value) emit('abrir', props.junta)
}
</script>

<style scoped>
/* Base: cada bloque es un contenedor, para que los estilos sepan cuánto mide (ver «compacto» abajo). */
.junta-bloque,
.junta-etiqueta {
  container-type: inline-size;
  container-name: bloque;
  max-width: 100%;
  border: 1px solid var(--dg-acento);
  border-radius: 4px;
  background-color: var(--dg-fondo-seleccion);
  color: var(--dg-texto);
  font-size: 0.78rem;
  text-align: left;
}

/* Etiqueta del Mes y de la franja de arriba: borde izquierdo de acento más grueso. */
.junta-etiqueta {
  min-height: 24px;
  padding: 1px 6px;
  border-left-width: 3px;
}

/* Todas las filas del Mes miden lo mismo: primera línea «hora · título» y segunda línea para las marcas. */
.junta-etiqueta--mes {
  display: flex;
  width: 100%;
  height: 42px;
  min-height: 42px;
}

/* Etiqueta de arriba del día (junta fuera de 8:00 a 19:00): el texto baja de línea en lugar de recortarse. */
.junta-etiqueta--arriba {
  height: auto;
  padding-block: 2px;
}

/* Junta en Semana y Día: un bloque sobre su franja horaria. */
.junta-bloque {
  position: absolute;
  z-index: 1;
  overflow: hidden;
  padding: 2px 6px;
  border-left-width: 4px;
  border-radius: 6px;
  font-size: 0.8rem;
}

.junta-bloque :deep(.q-btn__content),
.junta-etiqueta :deep(.q-btn__content) {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  justify-content: flex-start;
  min-width: 0;
  width: 100%;
  height: 100%;
}

.junta-bloque__cuerpo {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
  max-width: 100%;
  width: 100%;
  line-height: 1.25;
  text-align: left;
}

.junta-etiqueta--mes .junta-bloque__cuerpo {
  gap: 2px;
}

.junta-bloque__linea {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
}

.junta-bloque__hora {
  flex: none;
  font-weight: 700;
}

/* En Semana y Día la hora va en la línea de horario; solo el modo compacto la muestra antes del título. */
.junta-bloque__hora--solo-compacto {
  display: none;
}

.junta-bloque__separador {
  flex: none;
}

.junta-bloque__titulo {
  min-width: 0;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.junta-etiqueta--mes .junta-bloque__titulo {
  font-weight: 400;
}

.junta-bloque__titulo--libre {
  overflow: visible;
  font-weight: 400;
  white-space: normal;
  overflow-wrap: anywhere;
}

.junta-bloque__horario,
.junta-bloque__organiza,
.junta-bloque__nota {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.junta-bloque__nota {
  font-size: 0.74rem;
  font-weight: 600;
}

.junta-bloque__organiza {
  font-size: 0.74rem;
}

.junta-bloque__marcas {
  display: flex;
  flex-wrap: nowrap;
  gap: 3px;
  max-width: 100%;
  overflow: hidden;
}

.junta-etiqueta--arriba .junta-bloque__marcas {
  flex-wrap: wrap;
}

/* «Por confirmar»: rayado con borde de aviso. */
.junta-etiqueta--por-confirmar,
.junta-bloque--por-confirmar {
  border-color: var(--dg-aviso-borde);
  background-color: var(--dg-superficie);
  background-image: repeating-linear-gradient(
    135deg,
    var(--dg-aviso-fondo) 0,
    var(--dg-aviso-fondo) 6px,
    var(--dg-superficie) 6px,
    var(--dg-superficie) 12px
  );
  color: var(--dg-aviso-texto);
}

/* «Cancelada»: neutra y con el título tachado (no es un error, así que no va en rojo). */
.junta-etiqueta--cancelada,
.junta-bloque--cancelada {
  border-color: var(--dg-neutro-borde);
  background-color: var(--dg-neutro-fondo);
  color: var(--dg-texto-tenue);
}

.junta-etiqueta--cancelada .junta-bloque__titulo,
.junta-bloque--cancelada .junta-bloque__titulo {
  text-decoration: line-through;
}

/* «Ocupado» o ajena: rayado neutro, sin ficha. El candado y el texto lo dicen; el rayado solo refuerza. */
.junta-etiqueta--ocupada,
.junta-bloque--ocupada {
  border-color: var(--dg-neutro-borde);
  background-color: var(--dg-fondo-panel);
  background-image: repeating-linear-gradient(
    135deg,
    var(--dg-neutro-fondo) 0,
    var(--dg-neutro-fondo) 6px,
    var(--dg-fondo-panel) 6px,
    var(--dg-fondo-panel) 12px
  );
  color: var(--dg-texto-secundario);
  cursor: default;
}

/* Un solo anillo de foco para todos los bloques (con !important: app.scss pinta el de los botones así); el enfocado sube sobre los vecinos. */
.junta-bloque:focus-visible,
.junta-etiqueta:focus-visible {
  z-index: 3;
  outline: 2px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

/*
 * Compacto: una sola línea «11:30 Título» con la hora en negrita. Aplica con 45 px de alto o menos (clase) y
 * con 120 px de ancho o menos (consulta de contenedor: 100 px de contenido, que son 120 con relleno y borde).
 * En compacto las marcas no se pintan (no caben junto al título; siguen en el `aria-label`). Los dos bloques son iguales a propósito: una consulta de contenedor no puede compartir selector con una clase.
 */
.junta-bloque--compacto .junta-bloque__cuerpo {
  flex-direction: row;
  align-items: baseline;
  gap: 4px;
}

.junta-bloque--compacto .junta-bloque__linea {
  flex: 1;
}

.junta-bloque--compacto .junta-bloque__hora--solo-compacto {
  display: inline;
}

.junta-bloque--compacto .junta-bloque__marcas,
.junta-bloque--compacto .junta-bloque__horario,
.junta-bloque--compacto .junta-bloque__organiza,
.junta-bloque--compacto .junta-bloque__nota {
  display: none;
}

@container bloque (max-width: 100px) {
  .junta-bloque .junta-bloque__cuerpo {
    flex-direction: row;
    align-items: baseline;
    gap: 4px;
  }

  .junta-bloque .junta-bloque__linea {
    flex: 1;
  }

  .junta-bloque .junta-bloque__hora--solo-compacto {
    display: inline;
  }

  .junta-bloque .junta-bloque__marcas,
  .junta-bloque .junta-bloque__horario,
  .junta-bloque .junta-bloque__organiza,
  .junta-bloque .junta-bloque__nota {
    display: none;
  }

  /* En cualquier formato, si no cabe, las marcas quedan en icono (el texto sigue en el aria-label). */
  .junta-bloque__marcas :deep(.marca-junta__texto) {
    display: none;
  }
}

/* Hover: solo con mouse (en táctil se queda pegado). Refuerza el estado, no lo cambia. */
@media (hover: hover) and (pointer: fine) {
  .junta-bloque,
  .junta-etiqueta {
    transition:
      background-color 120ms ease,
      box-shadow 120ms ease;
  }

  .junta-bloque:hover,
  .junta-etiqueta:hover {
    background-color: var(--dg-fondo-hover);
  }

  .junta-etiqueta--por-confirmar:hover,
  .junta-bloque--por-confirmar:hover {
    background-color: var(--dg-superficie);
    box-shadow: inset 0 0 0 1px var(--dg-aviso-borde);
  }

  .junta-etiqueta--cancelada:hover,
  .junta-bloque--cancelada:hover {
    background-color: var(--dg-neutro-fondo);
    box-shadow: inset 0 0 0 1px var(--dg-neutro-borde);
  }

  .junta-etiqueta--ocupada:hover,
  .junta-bloque--ocupada:hover {
    background-color: var(--dg-fondo-panel);
  }
}

/* Junta recién guardada: anillo de acento con una transición corta (la quita la pantalla a los 3 s). */
.junta-etiqueta.junta--resaltada,
.junta-bloque.junta--resaltada {
  z-index: 2;
  box-shadow: 0 0 0 2px var(--dg-acento);
  transition: box-shadow 200ms var(--dg-curva-salida);
}

@media (prefers-reduced-motion: reduce) {
  .junta-etiqueta,
  .junta-bloque {
    transition: none !important;
  }
}
</style>
