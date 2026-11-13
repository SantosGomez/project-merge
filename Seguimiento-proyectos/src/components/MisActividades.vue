<template>
  <div class="mis-actividades">
    <p class="mis-actividades__lead">
      Arma aquí tu propio catálogo: tus clientes y las actividades que repites cada mes. Después
      podrás registrar tus actividades eligiendo un cliente y un tipo. Solo tú ves esta información.
    </p>

    <div class="mis-actividades__secciones">
      <MisClientes />
      <MisTiposActividad />
    </div>
  </div>
</template>

<script setup>
import MisClientes from './MisClientes.vue'
import MisTiposActividad from './MisTiposActividad.vue'
</script>

<style scoped>
.mis-actividades__lead {
  margin: 0 0 16px;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
}

.mis-actividades__secciones {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

@media (min-width: 1024px) {
  .mis-actividades__secciones {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
