<template>
  <div class="modulos-fondo" aria-hidden="true"></div>
  <main class="modulos-page">
    <div class="modulos-page__intro">
      <q-img
        class="modulos-page__logo"
        src="logos/PNG/DELGROW_LOGO-OF.png"
        alt="DelGrow Business Solutions"
        fit="contain"
        no-spinner
      />
      <h1 class="modulos-page__titulo">
        ¡Hola{{ session.nombreVisible ? `, ${session.nombreVisible}` : '' }}!
      </h1>
      <p class="modulos-page__lead">
        Elige el módulo con el que quieres trabajar hoy. Puedes cambiar de área en cualquier momento
        desde el menú.
      </p>
    </div>

    <nav class="modulos-page__lista" aria-label="Módulos disponibles">
      <!-- Sin acceso la tarjeta se ve apagada pero sigue enfocable: al pulsarla avisa y no navega. -->
      <component
        :is="modulo.tieneAcceso ? RouterLink : 'button'"
        v-for="modulo in modulos"
        :key="modulo.clave"
        :to="modulo.tieneAcceso ? modulo.destino : undefined"
        :type="modulo.tieneAcceso ? undefined : 'button'"
        class="modulo-tarjeta boton-presionable"
        :class="{ 'modulo-tarjeta--sin-acceso': !modulo.tieneAcceso }"
        :aria-disabled="modulo.tieneAcceso ? undefined : 'true'"
        :aria-label="
          modulo.tieneAcceso
            ? `Entrar a ${modulo.nombre}${modulo.rol ? ` como ${modulo.rol}` : ''}`
            : `${modulo.nombre}: sin acceso. Pulsa para saber por qué.`
        "
        @click="modulo.tieneAcceso ? undefined : avisarSinAcceso(modulo)"
      >
        <div class="modulo-tarjeta__media">
          <q-img
            :src="modulo.imagen"
            alt=""
            fit="cover"
            no-spinner
            class="modulo-tarjeta__imagen"
          />
          <q-chip
            v-if="modulo.rol && modulo.tieneAcceso"
            dense
            color="primary"
            text-color="dg-texto-claro"
            class="modulo-tarjeta__rol"
          >
            {{ modulo.rol }}
          </q-chip>
        </div>

        <div class="modulo-tarjeta__cuerpo">
          <div class="modulo-tarjeta__textos">
            <div class="modulo-tarjeta__titulo-fila">
              <q-icon :name="modulo.icono" class="modulo-tarjeta__icono" aria-hidden="true" />
              <span class="modulo-tarjeta__nombre">{{ modulo.nombre }}</span>
            </div>
            <span class="modulo-tarjeta__descripcion">{{ modulo.descripcion }}</span>
          </div>

          <div class="modulo-tarjeta__pie" aria-hidden="true">
            <span class="modulo-tarjeta__accion">{{
              modulo.tieneAcceso ? 'Entrar al módulo' : 'Sin acceso'
            }}</span>
            <q-icon
              :name="modulo.tieneAcceso ? 'arrow_forward' : 'lock'"
              class="modulo-tarjeta__flecha"
            />
          </div>
        </div>
      </component>
    </nav>

    <div class="modulos-page__acciones">
      <q-btn
        unelevated
        no-caps
        type="button"
        class="boton-cerrar-sesion"
        aria-label="Cerrar sesión"
        :loading="cerrando"
        @click="cerrarSesion"
      >
        <span class="boton-cerrar-sesion__icono" aria-hidden="true">
          <q-icon name="logout" size="20px" />
        </span>
        <span class="boton-cerrar-sesion__texto">Cerrar sesión</span>
      </q-btn>
      <q-btn
        v-if="veAjustes"
        unelevated
        no-caps
        type="button"
        class="boton-ajustes"
        aria-label="Ajustes"
        @click="abrirAjustes"
      >
        <span class="boton-ajustes__icono" aria-hidden="true">
          <q-icon name="settings" size="20px" />
        </span>
        <span class="boton-ajustes__texto">Ajustes</span>
        <q-tooltip>Usuarios y clientes del despacho</q-tooltip>
      </q-btn>
    </div>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { RouterLink, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session.js'
import {
  DATOS_MODULO,
  MODULOS,
  RUTA_DOCUMENTOS,
  mensajeSinAccesoModulo,
  puedeAbrirAjustes,
  tieneAccesoSeguimiento,
} from '../utils/modulos.js'
import { RUTA_PRINCIPAL_POR_ROL } from '../utils/constants.js'
import { formatearRol } from '../utils/formateadores.js'
import imgSeguimiento from '../assets/imagenes/organizacion-empresarial.jpg'
import imgDocumentos from '../assets/imagenes/recepcionDocs.jpg'

/*
 * Selector de módulo de la app unida (status-conta + Recepción de documentos). Toda cuenta llega
 * aquí al entrar; desde el menú se vuelve para cambiar de módulo. Los dos módulos se muestran
 * siempre: el que la cuenta no tiene queda apagado y avisa al pulsarlo. «Ajustes» (usuarios y
 * clientes) es un botón aparte, solo para administrador, sistemas y recepcionista.
 */
const $q = useQuasar()
const session = useSessionStore()
const router = useRouter()
const cerrando = ref(false)

const veAjustes = computed(() => puedeAbrirAjustes(session.rol))

const modulos = computed(() => [
  {
    clave: MODULOS.seguimiento,
    ...DATOS_MODULO[MODULOS.seguimiento],
    tieneAcceso: tieneAccesoSeguimiento(session.modulos, session.rol),
    destino: RUTA_PRINCIPAL_POR_ROL[session.rol],
    rol: formatearRol(session.rol),
    imagen: imgSeguimiento,
  },
  {
    clave: MODULOS.documentos,
    ...DATOS_MODULO[MODULOS.documentos],
    tieneAcceso: Boolean(session.rolDocumentos),
    destino: RUTA_DOCUMENTOS,
    rol: session.rolDocumentos,
    imagen: imgDocumentos,
  },
])

const avisarSinAcceso = (modulo) => {
  $q.notify({ type: 'warning', message: mensajeSinAccesoModulo(modulo.nombre) })
}

const abrirAjustes = () => {
  router.push({ name: 'ajustes' })
}

const cerrarSesion = async () => {
  if (cerrando.value) return
  cerrando.value = true
  try {
    await session.cerrarSesionVoluntaria()
    await router.replace({ name: 'login' })
  } finally {
    cerrando.value = false
  }
}
</script>

<style scoped>
.modulos-fondo {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-color: var(--dg-fondo-suave);
  background-image:
    radial-gradient(color-mix(in srgb, var(--q-primary) 12%, transparent) 1.5px, transparent 0),
    radial-gradient(
      circle at 18% 15%,
      color-mix(in srgb, var(--dg-acento) 14%, transparent) 0%,
      transparent 48%
    ),
    radial-gradient(
      circle at 85% 82%,
      color-mix(in srgb, var(--q-primary) 12%, transparent) 0%,
      transparent 52%
    );
  background-size:
    28px 28px,
    100% 100%,
    100% 100%;
  background-position:
    -5px -5px,
    0 0,
    0 0;
}

.modulos-page {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 740px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.modulos-page__intro {
  text-align: center;
}

.modulos-page__logo {
  width: 168px;
  height: 56px;
  margin: 0 auto 16px;
}

.modulos-page__titulo {
  margin: 0;
  font-size: 1.75rem;
  line-height: 1.2;
  font-weight: 700;
  color: var(--dg-texto);
}

.modulos-page__lead {
  margin: 8px 0 0;
  color: var(--dg-texto-secundario);
}

.modulos-page__lista {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}

@media (min-width: 600px) {
  .modulos-page__lista {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.modulo-tarjeta {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--dg-borde);
  border-radius: 18px;
  background: color-mix(in srgb, var(--dg-superficie) 82%, transparent);
  backdrop-filter: blur(10px);
  box-shadow: var(--dg-sombra-tarjeta);
  color: var(--dg-texto);
  text-decoration: none;
  transition:
    transform 0.25s var(--dg-curva-salida),
    border-color 0.25s var(--dg-curva-salida),
    background-color 0.25s var(--dg-curva-salida),
    box-shadow 0.25s var(--dg-curva-salida);
}

.modulo-tarjeta {
  /* La tarjeta sin acceso es un button: se le quitan los estilos del navegador. */
  width: 100%;
  padding: 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.modulo-tarjeta:hover {
  transform: translateY(-4px) scale(1.015);
  border-color: var(--dg-acento);
  background: var(--dg-superficie);
  box-shadow: 0 18px 36px color-mix(in srgb, var(--q-primary) 16%, transparent);
}

.modulo-tarjeta:focus-visible {
  outline: 3px solid var(--dg-foco);
  outline-offset: 2px;
}

.modulo-tarjeta--sin-acceso {
  background: color-mix(in srgb, var(--dg-fondo-panel) 82%, transparent);
  box-shadow: none;
  color: var(--dg-texto-secundario);
}

.modulo-tarjeta--sin-acceso:hover {
  transform: none;
  border-color: var(--dg-borde-fuerte);
  background: var(--dg-fondo-panel);
  box-shadow: none;
}

.modulo-tarjeta--sin-acceso .modulo-tarjeta__imagen {
  filter: grayscale(1);
  opacity: 0.55;
}

.modulo-tarjeta--sin-acceso:hover .modulo-tarjeta__imagen,
.modulo-tarjeta--sin-acceso:hover .modulo-tarjeta__flecha {
  transform: none;
}

.modulo-tarjeta--sin-acceso .modulo-tarjeta__icono,
.modulo-tarjeta--sin-acceso .modulo-tarjeta__pie {
  color: var(--dg-texto-secundario);
}

.modulo-tarjeta__media {
  position: relative;
  height: 156px;
  overflow: hidden;
  background: var(--dg-fondo-hover);
}

.modulo-tarjeta__imagen {
  width: 100%;
  height: 100%;
  transition: transform 0.35s var(--dg-curva-salida);
}

.modulo-tarjeta:hover .modulo-tarjeta__imagen {
  transform: scale(1.04);
}

.modulo-tarjeta__rol {
  position: absolute;
  top: 12px;
  right: 12px;
  margin: 0;
  font-weight: 600;
  box-shadow: var(--dg-sombra-tarjeta);
}

.modulo-tarjeta__cuerpo {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 18px;
  flex: 1;
  padding: 20px 22px 22px;
}

.modulo-tarjeta__textos {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.modulo-tarjeta__titulo-fila {
  display: flex;
  align-items: center;
  gap: 10px;
}

.modulo-tarjeta__icono {
  flex: none;
  font-size: 22px;
  color: var(--q-primary);
}

.modulo-tarjeta__nombre {
  font-size: 1.15rem;
  line-height: 1.25;
  font-weight: 700;
}

.modulo-tarjeta__descripcion {
  color: var(--dg-texto-secundario);
  font-size: 0.92rem;
  line-height: 1.45;
}

.modulo-tarjeta__pie {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--dg-borde);
  color: var(--dg-acento);
  font-size: 0.9rem;
  font-weight: 600;
}

.modulo-tarjeta__flecha {
  font-size: 20px;
  transition: transform 0.25s var(--dg-curva-salida);
}

.modulo-tarjeta:hover .modulo-tarjeta__flecha {
  transform: translateX(4px);
}

.modulos-page__acciones {
  display: flex;
  justify-content: center;
}

.boton-cerrar-sesion {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 45px;
  min-width: 45px;
  height: 45px;
  min-height: 45px;
  padding: 0;
  border: none;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--dg-error);
  color: var(--dg-texto-claro);
  box-shadow: var(--dg-sombra-tarjeta);
  transition:
    width 0.3s var(--dg-curva-salida),
    border-radius 0.3s var(--dg-curva-salida),
    background-color 0.2s var(--dg-curva-salida),
    transform 0.15s var(--dg-curva-salida);
}

.boton-cerrar-sesion :deep(.q-btn__content) {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  flex-wrap: nowrap;
}

.boton-cerrar-sesion__icono {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex-shrink: 0;
  transition:
    width 0.3s var(--dg-curva-salida),
    padding-left 0.3s var(--dg-curva-salida);
}

.boton-cerrar-sesion__texto {
  position: absolute;
  right: 0;
  width: 0;
  opacity: 0;
  white-space: nowrap;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--dg-texto-claro);
  transition:
    opacity 0.3s var(--dg-curva-salida),
    width 0.3s var(--dg-curva-salida),
    padding-right 0.3s var(--dg-curva-salida);
}

.boton-cerrar-sesion:hover,
.boton-cerrar-sesion:focus-visible {
  width: 168px;
  border-radius: 40px;
  background-color: var(--dg-error-oscuro);
}

.boton-cerrar-sesion:hover .boton-cerrar-sesion__icono,
.boton-cerrar-sesion:focus-visible .boton-cerrar-sesion__icono {
  width: 30%;
  padding-left: 14px;
}

.boton-cerrar-sesion:hover .boton-cerrar-sesion__texto,
.boton-cerrar-sesion:focus-visible .boton-cerrar-sesion__texto {
  opacity: 1;
  width: 70%;
  padding-right: 14px;
}

.boton-cerrar-sesion:active {
  transform: translate(2px, 2px);
}

@media (hover: none) {
  .boton-cerrar-sesion {
    width: 168px;
    border-radius: 40px;
  }

  .boton-cerrar-sesion__icono {
    width: 30%;
    padding-left: 14px;
  }

  .boton-cerrar-sesion__texto {
    opacity: 1;
    width: 70%;
    padding-right: 14px;
  }

  .boton-ajustes {
    width: 168px;
    border-radius: 40px;
  }

  .boton-ajustes__icono {
    width: 30%;
    padding-left: 14px;
  }

  .boton-ajustes__texto {
    opacity: 1;
    width: 70%;
    padding-right: 14px;
  }
}

/* «Ajustes» comparte la mecánica de «Cerrar sesión»: círculo que se expande al pasar el mouse. */
.boton-ajustes {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 45px;
  min-width: 45px;
  height: 45px;
  min-height: 45px;
  margin-left: 15px;
  padding: 0;
  border: none;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--q-primary);
  color: var(--dg-texto-claro);
  box-shadow: var(--dg-sombra-tarjeta);
  transition:
    width 0.3s var(--dg-curva-salida),
    border-radius 0.3s var(--dg-curva-salida),
    background-color 0.2s var(--dg-curva-salida),
    transform 0.15s var(--dg-curva-salida);
}

.boton-ajustes :deep(.q-btn__content) {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  flex-wrap: nowrap;
}

.boton-ajustes__icono {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex-shrink: 0;
  transition:
    width 0.3s var(--dg-curva-salida),
    padding-left 0.3s var(--dg-curva-salida);
}

.boton-ajustes__texto {
  position: absolute;
  right: 0;
  width: 0;
  opacity: 0;
  white-space: nowrap;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--dg-texto-claro);
  transition:
    opacity 0.3s var(--dg-curva-salida),
    width 0.3s var(--dg-curva-salida),
    padding-right 0.3s var(--dg-curva-salida);
}

.boton-ajustes:hover,
.boton-ajustes:focus-visible {
  width: 168px;
  border-radius: 40px;
  background-color: var(--dg-acento);
}

.boton-ajustes:hover .boton-ajustes__icono,
.boton-ajustes:focus-visible .boton-ajustes__icono {
  width: 30%;
  padding-left: 14px;
}

.boton-ajustes:hover .boton-ajustes__texto,
.boton-ajustes:focus-visible .boton-ajustes__texto {
  opacity: 1;
  width: 70%;
  padding-right: 14px;
}

/* El q-btn trae un contorno interior con !important (app.scss): aquí se pide el anillo exterior. */
.boton-ajustes:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

.boton-ajustes:active {
  transform: translate(2px, 2px);
}

@media (prefers-reduced-motion: reduce) {
  .modulo-tarjeta,
  .modulo-tarjeta__imagen,
  .modulo-tarjeta__flecha,
  .boton-ajustes__icono,
  .boton-ajustes__texto,
  .boton-cerrar-sesion,
  .boton-cerrar-sesion__icono,
  .boton-cerrar-sesion__texto,
  .boton-ajustes {
    transition: none;
  }

  .modulo-tarjeta:hover,
  .modulo-tarjeta:hover .modulo-tarjeta__imagen,
  .modulo-tarjeta:hover .modulo-tarjeta__flecha,
  .boton-cerrar-sesion:active,
  .boton-ajustes:active {
    transform: none;
  }
}
</style>
