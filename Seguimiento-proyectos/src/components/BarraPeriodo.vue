<template>
  <header class="barra-periodo">
    <div class="barra-periodo__fila barra-periodo__fila--principal">
      <div class="barra-periodo__grupo-izq">
        <div class="barra-periodo__titulo">
          <h2 class="barra-periodo__periodo" aria-live="polite">{{ periodo }}</h2>
          <p v-if="agenda" class="barra-periodo__agenda">{{ agenda }}</p>
        </div>

        <div class="barra-periodo__navegacion" role="group" aria-label="Moverse por el calendario">
          <q-btn
            outline
            no-caps
            dense
            color="primary"
            icon="chevron_left"
            aria-label="Periodo anterior"
            class="control-touch boton-presionable"
            @click="emit('anterior')"
          >
            <q-tooltip :delay="500" max-width="320px">Va al periodo anterior.</q-tooltip>
          </q-btn>
          <q-btn
            outline
            no-caps
            dense
            color="primary"
            label="Hoy"
            padding="4px 12px"
            class="control-touch boton-presionable"
            @click="emit('hoy')"
          >
            <q-tooltip :delay="500" max-width="320px">Vuelve al día de hoy.</q-tooltip>
          </q-btn>
          <q-btn
            outline
            no-caps
            dense
            color="primary"
            icon="chevron_right"
            aria-label="Periodo siguiente"
            class="control-touch boton-presionable"
            @click="emit('siguiente')"
          >
            <q-tooltip :delay="500" max-width="320px">Va al periodo siguiente.</q-tooltip>
          </q-btn>
        </div>

        <q-btn-toggle
          v-if="!compacto"
          :model-value="vista"
          :options="opcionesDeVista"
          no-caps
          unelevated
          toggle-color="primary"
          color="dg-superficie"
          text-color="primary"
          class="barra-periodo__vistas"
          aria-label="Elegir cómo ver el calendario"
          @update:model-value="(nueva) => emit('update:vista', nueva)"
        />
      </div>

      <div v-if="!compacto" class="barra-periodo__grupo-der">
        <div v-if="$slots.proxima" class="barra-periodo__proxima">
          <slot name="proxima"></slot>
        </div>

        <div class="barra-periodo__opciones">
          <slot name="opciones"></slot>
        </div>

        <div class="barra-periodo__acciones">
          <slot name="acciones"></slot>
        </div>
      </div>
    </div>

    <!-- Celular: selector de vistas y opciones plegables -->
    <div v-if="compacto" class="barra-periodo__fila barra-periodo__fila--vista">
      <q-btn-toggle
        :model-value="vista"
        :options="opcionesDeVista"
        no-caps
        unelevated
        toggle-color="primary"
        color="dg-superficie"
        text-color="primary"
        class="barra-periodo__vistas"
        aria-label="Elegir cómo ver el calendario"
        @update:model-value="(nueva) => emit('update:vista', nueva)"
      />
    </div>

    <div v-if="compacto && $slots.proxima" class="barra-periodo__proxima-movil">
      <slot name="proxima"></slot>
    </div>

    <q-expansion-item
      v-if="compacto"
      dense
      icon="tune"
      label="Opciones de la vista"
      class="barra-periodo__plegable"
      header-class="control-touch"
    >
      <div class="barra-periodo__opciones barra-periodo__opciones--plegadas">
        <slot name="opciones"></slot>
      </div>
    </q-expansion-item>

    <p v-if="guia && !compacto" class="barra-periodo__guia">{{ guia }}</p>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'

/*
 * Cabecera de «Mi Calendario». Fila 1: el periodo en grande, ‹ Hoy › y las acciones (slot `acciones`).
 * Fila 2: el selector de vista y las opciones (slot `opciones`: «Ver agenda de» y el interruptor de
 * vencimientos). Solo presenta: la vista, el periodo y los textos llegan por props y los clics salen por eventos.
 * En menos de 600 px la guía se oculta, las acciones las pinta la pantalla (botón flotante) y las opciones
 * se pliegan en «Opciones de la vista».
 */
defineProps({
  /** Texto del periodo («noviembre de 2026», «16 – 20 de noviembre de 2026»…). */
  periodo: { type: String, required: true },
  /** Vista elegida: 'anio', 'mes', 'semana' o 'dia'. */
  vista: { type: String, required: true },
  /** Opciones del selector de vista, `{ label, value }`. */
  opcionesDeVista: { type: Array, required: true },
  /** Una línea de guía; no se muestra en celular. */
  guia: { type: String, default: '' },
  /** Agenda que se ve cuando no es la propia («Agenda de Ana»); solo se muestra en celular. */
  agenda: { type: String, default: '' },
})

const emit = defineEmits(['update:vista', 'anterior', 'hoy', 'siguiente'])

const $q = useQuasar()
const compacto = computed(() => $q.screen.lt.sm)
</script>

<style scoped>
.barra-periodo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.barra-periodo__fila {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.barra-periodo__fila--principal {
  justify-content: space-between;
}

.barra-periodo__grupo-izq {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.barra-periodo__grupo-der {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 12px;
  margin-left: auto;
}

.barra-periodo__titulo {
  flex: 0 0 auto;
}

.barra-periodo__periodo {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.barra-periodo__agenda {
  margin: 2px 0 0;
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
}

.barra-periodo__navegacion {
  display: flex;
  gap: 6px;
}

.barra-periodo__acciones {
  display: flex;
  align-items: center;
}

.barra-periodo__vistas {
  border: 1px solid var(--dg-borde-fuerte);
  border-radius: 6px;
}

.barra-periodo__vistas :deep(.q-btn) {
  min-height: 44px;
  min-width: 44px;
}

.barra-periodo__proxima {
  display: flex;
  align-items: center;
}

.barra-periodo__proxima-movil {
  margin-top: 4px;
}

.barra-periodo__opciones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

/* En una cuadrícula de una columna no cuenta el `flex-basis` de los controles (340 px del selector). */
.barra-periodo__opciones--plegadas {
  display: grid;
  justify-content: stretch;
  padding: 8px 4px 4px;
}

.barra-periodo__plegable {
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
  background: var(--dg-superficie);
  color: var(--dg-texto);
}

.barra-periodo__guia {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.4;
}

/* Celular: el periodo y la navegación comparten la fila 1, y el selector de vista ocupa todo el ancho. */
@media (max-width: 599px) {
  .barra-periodo {
    gap: 8px;
    margin-bottom: 8px;
  }

  .barra-periodo__titulo {
    flex-basis: 140px;
  }

  .barra-periodo__periodo {
    font-size: 1.1rem;
    white-space: normal;
  }

  .barra-periodo__vistas {
    display: flex;
    flex: 1 1 100%;
  }

  .barra-periodo__vistas :deep(.q-btn) {
    flex: 1 1 0;
    padding-inline: 4px;
  }
}
</style>
