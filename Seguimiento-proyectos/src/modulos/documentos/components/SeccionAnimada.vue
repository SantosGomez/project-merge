<template>
  <!--
    Animación de entrada de las vistas (Animated Content de vue-bits, con gsap).
    Cada hijo directo es una sección y aparece por su cuenta, en orden
    aleatorio: desenfoque de 12px, 40px de desplazamiento, 1 s y barrido desde
    la izquierda. Con «reducir movimiento» activado el contenido sale sin
    animar (lo resuelve AnimatedContent).
  -->
  <AnimatedContent
    :distance="40"
    direction="vertical"
    :duration="1"
    ease="power3.out"
    :blur="12"
    :stagger="0.08"
    :threshold="0.1"
    wipe="left"
    stagger-from="random"
    :class-name="clase"
  >
    <slot />
  </AnimatedContent>
</template>

<script setup>
import AnimatedContent from '@/modulos/documentos/components/vuebits/AnimatedContent.vue'

// Clase opcional del contenedor (p. ej. para centrar una tarjeta en el login)
defineProps({
  clase: { type: String, default: '' },
})
</script>
