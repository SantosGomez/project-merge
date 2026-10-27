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
      <q-list dense class="aviso-sesion__help-list">
        <q-item class="aviso-sesion__help-item">
          <q-item-section avatar class="aviso-sesion__help-icono">
            <q-icon name="info" size="18px" color="dg-acento" aria-hidden="true" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="aviso-sesion__help-texto">La sesión se cerró automáticamente tras 30 minutos sin actividad o porque el token expiró.</q-item-label>
          </q-item-section>
        </q-item>
        <q-item class="aviso-sesion__help-item">
          <q-item-section avatar class="aviso-sesion__help-icono">
            <q-icon name="info" size="18px" color="dg-acento" aria-hidden="true" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="aviso-sesion__help-texto">El token ya no está guardado en esta pestaña, así que no se muestran datos ni la carga.</q-item-label>
          </q-item-section>
        </q-item>
        <q-item class="aviso-sesion__help-item">
          <q-item-section avatar class="aviso-sesion__help-icono">
            <q-icon name="info" size="18px" color="dg-acento" aria-hidden="true" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="aviso-sesion__help-texto">Pulsa «Ir a inicio de sesión» y vuelve a entrar con tu cuenta.</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
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
  color: var(--dg-error-oscuro);
  font-size: clamp(1.3rem, 5vw, 1.6rem);
  line-height: 1.2;
}

.aviso-sesion__part {
  margin: 0 0 8px;
  color: var(--dg-texto-secundario);
  font-size: 1rem;
  line-height: 1.5;
}

.aviso-sesion__part-label {
  color: var(--dg-error-oscuro);
  font-weight: 600;
}

.aviso-sesion__button {
  min-width: 44px;
  min-height: 44px;
  margin-top: 12px;
}

.aviso-sesion__button:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

.aviso-sesion__help {
  margin-top: 24px;
  padding: 16px;
  border-left: 4px solid var(--dg-acento);
  border-radius: 8px;
  background: var(--dg-fondo-hover);
  text-align: left;
}

.aviso-sesion__help-title {
  margin: 0 0 8px;
  color: var(--dg-texto);
  font-size: 1rem;
}

.aviso-sesion__help-list {
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
}

/* Sin el alto mínimo ni el relleno de q-item: cada punto ocupa lo que su texto. */
.aviso-sesion__help-item {
  min-height: 0;
  padding: 0;
}

.aviso-sesion__help-item + .aviso-sesion__help-item {
  margin-top: 6px;
}

.aviso-sesion__help-icono {
  min-width: 26px;
  padding-top: 2px;
  justify-content: flex-start;
}

/* q-item-label trae line-height de 1.2em con !important; se conserva el 1.5 de la ayuda. */
.aviso-sesion__help-texto {
  line-height: 1.5 !important;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}
</style>