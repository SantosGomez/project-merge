<template>
  <section class="atencion" aria-labelledby="atencion-titulo">
    <div class="atencion__encabezado">
      <h2 id="atencion-titulo" class="atencion__titulo">Requiere atención</h2>
      <p class="atencion__ayuda">
        Cuenta solo casos importantes, auditorías sin completar y entregas pendientes. Elige una
        cifra para ver su lista.
      </p>
    </div>

    <ul class="atencion__cifras">
      <li v-for="cifra in cifrasVisibles" :key="cifra.clave" class="atencion__item">
        <q-btn
          v-if="cifra.valor > 0"
          flat
          no-caps
          :class="[
            'atencion__cifra',
            `atencion__cifra--${cifra.tono}`,
            'boton-presionable',
            { 'atencion__cifra--activa': activo === cifra.clave },
          ]"
          :data-rango="cifra.clave"
          :aria-pressed="String(activo === cifra.clave)"
          :aria-label="`${cifra.titulo}: ${cifra.valor}. ${cifra.ayuda}`"
          @click="emit('elegir', cifra.clave)"
        >
          <span class="atencion__valor"><ContadorRodante :valor="cifra.valor" /></span>
          <span class="atencion__nombre">{{ cifra.titulo }}</span>
          <span class="atencion__detalle">{{ cifra.cuenta }}</span>
          <q-tooltip max-width="280px">{{ cifra.ayuda }}</q-tooltip>
        </q-btn>
        <div v-else class="atencion__cifra atencion__cifra--neutro atencion__cifra--cero">
          <span class="atencion__valor">0</span>
          <span class="atencion__nombre">{{ cifra.titulo }}</span>
          <span class="atencion__detalle">{{ cifra.cuenta }}</span>
          <q-tooltip max-width="280px">{{ cifra.ayuda }} No hay nada en este grupo.</q-tooltip>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed } from 'vue'

import ContadorRodante from './ContadorRodante.vue'

/*
 * Franja «Requiere atención» del dashboard del administrador: cuatro cifras que abren su lista.
 * Una cifra en 0 queda en tono neutro y no es botón. Es solo presentación: las cifras llegan
 * calculadas (`cifrasDeAtencion`).
 */
const props = defineProps({
  /** `{ vencidos, hoy, semana, entregas }`. */
  cifras: { type: Object, required: true },
  /** Rango abierto en el modo día, o null. */
  activo: { type: String, default: null },
})

const emit = defineEmits(['elegir'])

const DEFINICION = [
  {
    clave: 'vencidos',
    titulo: 'Vencidos',
    cuenta: 'casos, auditorías y entregas',
    tono: 'error',
    ayuda: 'Casos importantes, auditorías y entregas cuya fecha de vencimiento ya pasó.',
  },
  {
    clave: 'hoy',
    titulo: 'Vencen hoy',
    cuenta: 'casos, auditorías y entregas',
    tono: 'aviso',
    ayuda: 'Casos importantes, auditorías y entregas que vencen hoy.',
  },
  {
    clave: 'semana',
    titulo: 'Esta semana',
    cuenta: 'casos, auditorías y entregas, de hoy a 7 días',
    tono: 'aviso',
    ayuda: 'Lo que vence de hoy a los próximos 7 días.',
  },
  {
    clave: 'entregas',
    titulo: 'Entregas pendientes',
    cuenta: 'entregas de auditoría, de hoy a 7 días',
    tono: 'info',
    ayuda: 'Entregas de auditoría que vencen de hoy a los próximos 7 días.',
  },
]

const cifrasVisibles = computed(() =>
  DEFINICION.map((cifra) => ({ ...cifra, valor: props.cifras[cifra.clave] ?? 0 })),
)
</script>

<style scoped>
.atencion {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--dg-borde);
  border-radius: 12px;
  background: var(--dg-fondo-panel);
}

.atencion__encabezado {
  margin-bottom: 10px;
}

.atencion__titulo {
  margin: 0 0 2px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.3;
}

.atencion__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.atencion__cifras {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 1024px) {
  .atencion__cifras {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.atencion__item {
  min-width: 0;
}

.atencion__cifra {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--dg-borde);
  border-radius: 10px;
  background: var(--dg-superficie);
  text-align: left;
}

/* El texto interior de q-btn se centra solo: se alinea a la izquierda como las cifras sin botón */
.atencion__cifra :deep(.q-btn__content) {
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}

.atencion__valor {
  color: var(--dg-texto);
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
}

.atencion__nombre {
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  font-weight: 600;
}

.atencion__detalle {
  color: var(--dg-texto-tenue);
  font-size: 0.75rem;
  line-height: 1.3;
}

.atencion__cifra--error {
  border-color: var(--dg-error-borde-suave);
  background: var(--dg-error-fondo-suave);
}

.atencion__cifra--error .atencion__valor {
  color: var(--dg-error);
}

.atencion__cifra--error .atencion__detalle {
  color: var(--dg-error-texto);
}

.atencion__cifra--aviso {
  border-color: var(--dg-aviso-borde);
  background: var(--dg-aviso-fondo);
}

.atencion__cifra--aviso .atencion__valor,
.atencion__cifra--aviso .atencion__nombre,
.atencion__cifra--aviso .atencion__detalle {
  color: var(--dg-aviso-texto);
}

.atencion__cifra--info {
  border-color: var(--dg-info-borde);
  background: var(--dg-info-fondo);
}

.atencion__cifra--info .atencion__valor,
.atencion__cifra--info .atencion__nombre,
.atencion__cifra--info .atencion__detalle {
  color: var(--dg-info-texto);
}

/* Con 0 no hay nada que abrir: tono neutro, sin relieve y sin cursor de botón */
.atencion__cifra--cero {
  border-color: var(--dg-borde);
  background: var(--dg-fondo-suave);
  cursor: default;
}

.atencion__cifra--cero .atencion__valor,
.atencion__cifra--cero .atencion__nombre,
.atencion__cifra--cero .atencion__detalle {
  color: var(--dg-texto-tenue);
}

.atencion__cifra--activa {
  outline: 2px solid var(--dg-acento);
  outline-offset: 1px;
}

.atencion__cifra:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}
</style>
