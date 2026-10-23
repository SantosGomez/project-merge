<template>
  <section class="aviso-sesion" role="alert" :aria-labelledby="titleId">
    <h2 :id="titleId" class="aviso-sesion__title">Sesión caducada</h2>

    <p class="aviso-sesion__part">
      <strong class="aviso-sesion__part-label">Qué ocurrió:</strong>
      la sesión caducó por inactividad o porque el token expiró.
    </p>

    <p class="aviso-sesion__part">
      <strong class="aviso-sesion__part-label">Sobre qué dato o acción:</strong>
      su sesión actual.
    </p>

    <p class="aviso-sesion__part">
      <strong class="aviso-sesion__part-label">Qué hacer:</strong>
      inicie sesión de nuevo.
    </p>

    <q-btn
      class="aviso-sesion__button control-touch"
      color="primary"
      no-caps
      icon="login"
      label="Ir a inicio de sesión"
      :to="{ name: 'login' }"
    >
      <q-tooltip>Inicia sesión de nuevo para continuar usando la aplicación.</q-tooltip>
    </q-btn>

    <!-- Ayuda contextual accesible por puntero, foco y toque (RNF-03). -->
    <section class="aviso-sesion__help" aria-labelledby="aviso-sesion-help-title">
      <h3 id="aviso-sesion-help-title" class="aviso-sesion__help-title">
        Por qué ves este aviso
      </h3>
      <ul class="aviso-sesion__help-list">
        <li>
          La sesión se cerró automáticamente tras 30 minutos sin actividad o porque el token expiró.
        </li>
        <li>
          El token ya no está guardado en esta pestaña, así que no se muestran datos ni la carga.
        </li>
        <li>
          Pulsa «Ir a inicio de sesión» y vuelve a entrar con tu cuenta.
        </li>
      </ul>
    </section>
  </section>
</template>

<script setup>
import { useId } from 'vue'

const titleId = useId()
</script>

<style scoped>
.aviso-sesion {
  max-width: 560px;
  margin: 0 auto;
  padding: 8px 0;
  text-align: center;
}

.aviso-sesion__title {
  margin: 0 0 12px;
  color: #7a1f1a;
  font-size: clamp(1.3rem, 5vw, 1.6rem);
  line-height: 1.2;
}

.aviso-sesion__part {
  margin: 0 0 8px;
  color: #334e68;
  font-size: 1rem;
  line-height: 1.5;
}

.aviso-sesion__part-label {
  color: #7a1f1a;
  font-weight: 600;
}

.aviso-sesion__button {
  min-width: 44px;
  min-height: 44px;
  margin-top: 12px;
}

.aviso-sesion__button:focus-visible {
  outline: 3px solid #0b5cad !important;
  outline-offset: 2px;
}

.aviso-sesion__help {
  margin-top: 24px;
  padding: 16px;
  border-left: 4px solid #1f5f99;
  border-radius: 8px;
  background: #f0f6fc;
  text-align: left;
}

.aviso-sesion__help-title {
  margin: 0 0 8px;
  color: #102a43;
  font-size: 1rem;
}

.aviso-sesion__help-list {
  margin: 0;
  padding-left: 20px;
  color: #334e68;
  font-size: 0.95rem;
  line-height: 1.5;
}

.aviso-sesion__help-list li + li {
  margin-top: 6px;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}
</style>