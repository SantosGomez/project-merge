<template>
  <q-page class="auxiliares-page">
    <div class="perfil-page__rejilla">
      <q-card flat bordered class="perfil-page__tarjeta perfil-page__cuenta" aria-labelledby="perfil-titulo-cuenta">
        <q-card-section>
          <h2 id="perfil-titulo-cuenta" class="perfil-page__titulo-seccion">Mi cuenta</h2>

          <div class="perfil-cuenta__identidad">
            <q-avatar class="perfil-cuenta__avatar" size="44px" font-size="0.95rem" aria-hidden="true">{{ inicialesCuenta }}</q-avatar>
            <div class="perfil-cuenta__textos">
              <p class="perfil-cuenta__nombre">{{ perfil?.nombre ?? session.nombreVisible }}</p>
              <p class="perfil-cuenta__rol">{{ formatearRol(perfil?.rol ?? session.rol) }}</p>
            </div>
          </div>

          <ErrorState
            v-if="errorPerfil"
            :detail="mensajeErrorPerfil"
            @retry="cargarPerfil"
          />

          <q-list v-else class="perfil-cuenta__datos" aria-label="Datos de tu cuenta">
            <q-item class="perfil-dato">
              <q-item-section avatar>
                <q-icon name="mail" class="text-dg-texto-tenue" aria-hidden="true" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption class="perfil-dato__etiqueta">Correo</q-item-label>
                <q-skeleton v-if="cargandoPerfil" type="text" width="70%" />
                <q-item-label v-else class="perfil-dato__valor">{{ perfil?.correo }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item class="perfil-dato">
              <q-item-section avatar>
                <q-icon name="event" class="text-dg-texto-tenue" aria-hidden="true" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption class="perfil-dato__etiqueta">Cuenta creada el</q-item-label>
                <q-skeleton v-if="cargandoPerfil" type="text" width="50%" />
                <q-item-label v-else class="perfil-dato__valor">{{ cuentaCreada }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item class="perfil-dato">
              <q-item-section avatar>
                <q-icon name="login" class="text-dg-texto-tenue" aria-hidden="true" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption class="perfil-dato__etiqueta">Último inicio de sesión</q-item-label>
                <q-skeleton v-if="cargandoPerfil" type="text" width="60%" />
                <q-item-label v-else class="perfil-dato__valor">{{ ultimoInicio || 'Sin registro' }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <q-btn
            v-if="CAMBIO_CONTRASENA_HABILITADO"
            outline
            no-caps
            color="primary"
            icon="lock_reset"
            label="Cambiar contraseña"
            class="control-touch boton-presionable perfil-cuenta__cambiar-contrasena"
            @click="dialogoContrasenaAbierto = true"
          >
            <q-tooltip>Cambia tu contraseña escribiendo primero la actual.</q-tooltip>
          </q-btn>
        </q-card-section>
      </q-card>

      <div class="perfil-page__derecha">
      <section v-if="session.esContador" aria-labelledby="perfil-titulo-auxiliares">
        <q-card flat bordered class="perfil-page__tarjeta">
          <q-card-section>
            <div class="auxiliares-page__head">
              <h2 id="perfil-titulo-auxiliares" class="perfil-page__titulo-seccion auxiliares-page__title">Mis auxiliares</h2>
              <p class="auxiliares-page__lead">
                Aquí están los auxiliares que te apoyan con tus casos. Pueden cambiar el estado
                de tus casos y tú recibirás un aviso cada vez que lo hagan. Tú puedes agregar o quitar
                auxiliares, y el despacho también puede hacerlo; si lo hace, te llegará un aviso.
              </p>
              <q-btn
                unelevated
                no-caps
                color="primary"
                icon="person_add"
                label="Agregar auxiliar"
                class="control-touch boton-presionable auxiliares-page__agregar"
                @click="dialogoAgregarAbierto = true"
              >
                <q-tooltip>Elige de la lista a quienes te ayudarán con tus casos.</q-tooltip>
              </q-btn>
            </div>

            <ScreenLoader v-if="screenStateName === SCREEN_STATES.loading" text="Cargando tus auxiliares…" />

            <ErrorState
              v-else-if="screenStateName === SCREEN_STATES.error"
              :detail="mensajeError"
              @retry="retry"
            />

            <div v-else class="auxiliares-page__lista">
              <q-item-label header class="auxiliares-page__lista-titulo">
                Tus auxiliares actuales
              </q-item-label>

              <q-list
                v-if="auxiliares.auxiliares.length > 0"
                bordered
                separator
                class="auxiliares-page__q-list"
                aria-label="Tus auxiliares"
              >
                <q-item v-for="auxiliar in auxiliares.auxiliares" :key="auxiliar.id" class="auxiliar-item">
                  <q-item-section avatar>
                    <q-avatar class="auxiliar-item__avatar" size="36px" font-size="0.8rem" aria-hidden="true">{{ inicialesDe(auxiliar.nombre) }}</q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="auxiliar-item__nombre">{{ auxiliar.nombre }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn
                      flat
                      no-caps
                      dense
                      color="dg-error"
                      icon="person_remove"
                      label="Quitar"
                      class="control-touch boton-presionable"
                      :aria-label="`Quitar a ${auxiliar.nombre} como auxiliar`"
                      :disable="guardando"
                      @click="confirmarQuitar(auxiliar)"
                    >
                      <q-tooltip>Deja de contar con esta persona como tu auxiliar.</q-tooltip>
                    </q-btn>
                  </q-item-section>
                </q-item>
              </q-list>

              <EmptyState
                v-else
                title="Todavía no tienes auxiliares"
                message="Agrega a quienes te ayudarán: verán tus casos y podrán cambiar su estado."
                action-label="Agregar auxiliar"
                @action="dialogoAgregarAbierto = true"
              />
            </div>
          </q-card-section>
        </q-card>
      </section>

      <section v-if="session.esAuxiliar" aria-labelledby="perfil-titulo-contador">
        <q-card flat bordered class="perfil-page__tarjeta">
          <q-card-section>
            <h2 id="perfil-titulo-contador" class="perfil-page__titulo-seccion">Contador que apoyas</h2>

            <q-list v-if="cargandoContadores" aria-label="Cargando el contador que apoyas">
              <q-item>
                <q-item-section avatar>
                  <q-skeleton type="QAvatar" />
                </q-item-section>
                <q-item-section>
                  <q-skeleton type="text" width="60%" />
                  <q-skeleton type="text" width="90%" />
                </q-item-section>
              </q-item>
            </q-list>

            <ErrorState
              v-else-if="errorContadores"
              :detail="errorContadores.mensaje ?? 'el contador que apoyas.'"
              @retry="cargarContadoresQueApoyo"
            />

            <q-list
              v-else-if="contadoresQueApoyo.length > 0"
              bordered
              separator
              class="auxiliares-page__q-list"
              aria-label="Contador que apoyas"
            >
              <q-item v-for="contador in contadoresQueApoyo" :key="contador.id" class="auxiliar-item">
                <q-item-section avatar>
                  <q-avatar class="auxiliar-item__avatar" size="36px" font-size="0.8rem" aria-hidden="true">{{ inicialesDe(contador.nombre) }}</q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label class="auxiliar-item__nombre">{{ contador.nombre }}</q-item-label>
                  <q-item-label caption class="perfil-dato__etiqueta">
                    Apoyas a {{ contador.nombre }} con sus casos: ves sus casos y puedes cambiar su estado.
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>

            <EmptyState
              v-else
              title="Todavía no apoyas a ningún contador"
              message="El despacho o un contador puede agregarte a su equipo; te llegará un aviso."
            />
          </q-card-section>
        </q-card>
      </section>

      <section aria-labelledby="perfil-titulo-cartera">
        <q-card flat bordered class="perfil-page__tarjeta">
          <q-card-section>
            <div class="cartera__cabecera">
              <h2 id="perfil-titulo-cartera" class="perfil-page__titulo-seccion cartera__titulo">Mi cartera de clientes</h2>
              <span v-if="!cases.cargando && !cases.error" class="cartera__total">{{ textoTotalClientes }}</span>
            </div>
            <p class="auxiliares-page__lead cartera__ayuda">
              Tu cartera se arma con los clientes de tus casos; no es un catálogo aparte.
              Aquí ves cuántos casos abiertos tienes con cada cliente.
            </p>

            <ScreenLoader v-if="cases.cargando" text="Cargando tu cartera de clientes…" />

            <ErrorState
              v-else-if="cases.error"
              :detail="cases.error?.mensaje ?? 'tus casos.'"
              @retry="cases.cargarCasos()"
            />

            <EmptyState
              v-else-if="cartera.length === 0"
              title="Todavía no tienes clientes"
              message="Aparecerán aquí cuando registres casos."
            >
              <template #action>
                <q-btn
                  unelevated
                  no-caps
                  color="primary"
                  label="Ir a mis casos"
                  class="control-touch boton-presionable"
                  :to="{ name: 'contador-casos' }"
                >
                  <q-tooltip>Abre «Mis casos» para registrar tu primer caso.</q-tooltip>
                </q-btn>
              </template>
            </EmptyState>

            <div v-else class="auxiliares-page__lista">
              <q-input
                v-if="cartera.length > CLIENTES_SIN_BUSCADOR"
                v-model="busquedaCliente"
                dense
                outlined
                clearable
                label="Buscar cliente"
                for="cartera-buscar"
                class="cartera__buscador"
              >
                <template #prepend>
                  <q-icon name="search" aria-hidden="true" />
                </template>
                <q-tooltip>Escribe parte del nombre; no importan mayúsculas ni acentos.</q-tooltip>
              </q-input>

              <p v-if="clientesVisibles.length === 0" class="cartera__sin-resultados" role="status">
                Ningún cliente coincide con «{{ busquedaCliente }}». Revisa el nombre o borra la búsqueda.
              </p>

              <q-list
                v-else
                bordered
                separator
                class="auxiliares-page__q-list"
                :class="{ 'cartera__lista--scroll': cartera.length > CLIENTES_SIN_BUSCADOR }"
                aria-label="Tus clientes"
              >
                <q-item v-for="cliente in clientesVisibles" :key="cliente.clave" class="cartera-item">
                  <q-item-section>
                    <q-item-label class="cartera-item__nombre">{{ cliente.nombre }}</q-item-label>
                    <q-item-label v-if="cliente.importante" class="cartera-item__marca">
                      <q-chip dense square icon="star" class="cartera-item__importante">
                        Importante
                        <q-tooltip>Tiene al menos un caso abierto marcado como importante.</q-tooltip>
                      </q-chip>
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side class="cartera-item__cifras">
                    <span class="cartera-item__abiertos">{{ textoAbiertos(cliente.abiertos) }}</span>
                    <span class="cartera-item__finalizados">{{ textoFinalizados(cliente.finalizados) }}</span>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
          </q-card-section>
        </q-card>
      </section>
      </div>
    </div>

    <AgregarAuxiliaresDialog v-if="session.esContador" v-model="dialogoAgregarAbierto" @asignados="alAsignar" />
    <CambiarContrasenaDialog v-if="CAMBIO_CONTRASENA_HABILITADO" v-model="dialogoContrasenaAbierto" />
  </q-page>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'

import AgregarAuxiliaresDialog from '../components/AgregarAuxiliaresDialog.vue'
import CambiarContrasenaDialog from '../components/CambiarContrasenaDialog.vue'
import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { SCREEN_STATES } from '../utils/screenState.js'
import { carteraDeClientes } from '../utils/carteraClientes.js'
import { fechaParaFormulario } from '../utils/fechasCaso.js'
import { filtrarContadores } from '../utils/filtrosCasos.js'
import { formatearIniciales, formatearRol } from '../utils/formateadores.js'
import { obtenerPerfil } from '../services/authService.js'
import { useAuxiliaresStore } from '../stores/auxiliares.js'
import { useCasesStore } from '../stores/cases.js'
import { useSessionStore } from '../stores/session.js'

const auxiliares = useAuxiliaresStore()
const session = useSessionStore()
const cases = useCasesStore()
const $q = useQuasar()

const dialogoAgregarAbierto = ref(false)
const dialogoContrasenaAbierto = ref(false)

// «Cambiar contraseña» está desactivado de momento (decisión del usuario, 2026-11-11).
// Para volver a mostrar el botón y el diálogo basta con poner true.
const CAMBIO_CONTRASENA_HABILITADO = false

// «Mi cuenta»: datos de la cuenta de la sesión. Si fallan, solo esa sección muestra el error.
const perfil = ref(null)
const cargandoPerfil = ref(true)
const errorPerfil = ref(null)

const mensajeErrorPerfil = computed(() => errorPerfil.value?.mensaje ?? 'los datos de tu cuenta.')
const inicialesCuenta = computed(() => formatearIniciales(perfil.value?.nombre ?? session.nombreVisible))
const cuentaCreada = computed(() => fechaParaFormulario(perfil.value?.creado_en))
// DD-MM-AAAA HH:mm; la API entrega AAAA-MM-DD HH:mm:ss en hora local.
const ultimoInicio = computed(() => {
  const texto = perfil.value?.ultimo_acceso_en
  return texto ? `${fechaParaFormulario(texto)} ${texto.slice(11, 16)}` : ''
})

const cargarPerfil = async () => {
  cargandoPerfil.value = true
  errorPerfil.value = null
  try {
    perfil.value = await obtenerPerfil()
  } catch (error) {
    errorPerfil.value = error ?? {}
  } finally {
    cargandoPerfil.value = false
  }
}

// «Contador que apoyas» (solo auxiliar): la acción del store no guarda estado, la lista es de esta vista.
const contadoresQueApoyo = ref([])
const cargandoContadores = ref(false)
const errorContadores = ref(null)

const cargarContadoresQueApoyo = async () => {
  cargandoContadores.value = true
  errorContadores.value = null
  const resultado = await auxiliares.listarContadoresQueMeTienenComoAuxiliar(Number(session.id))
  if (resultado.ok) {
    contadoresQueApoyo.value = resultado.contadores ?? []
  } else {
    errorContadores.value = resultado.error ?? {}
  }
  cargandoContadores.value = false
}

// «Mi cartera de clientes»: sale de los casos propios del store; con más clientes que este
// número la lista se desplaza y aparece el buscador.
const CLIENTES_SIN_BUSCADOR = 8
const busquedaCliente = ref('')

const cartera = computed(() => carteraDeClientes(cases.casos, Number(session.id)))
const clientesVisibles = computed(() => filtrarContadores(cartera.value, busquedaCliente.value ?? ''))
const textoTotalClientes = computed(() =>
  cartera.value.length === 1 ? '1 cliente' : `${cartera.value.length} clientes`,
)
const textoAbiertos = (n) => (n === 0 ? 'Sin casos abiertos' : n === 1 ? '1 abierto' : `${n} abiertos`)
const textoFinalizados = (n) => (n === 1 ? '1 finalizado' : `${n} finalizados`)

const screenStateName = computed(() => {
  if (auxiliares.cargando) return SCREEN_STATES.loading
  if (auxiliares.error) return SCREEN_STATES.error
  return SCREEN_STATES.content
})

const mensajeError = computed(() => auxiliares.error?.mensaje ?? 'tus auxiliares.')
const guardando = computed(() => auxiliares.guardando)

const inicialesDe = (nombre) => {
  return nombre
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Resultado del diálogo «Agregar auxiliares»: si alguno falló, se dice cuál y por qué.
const alAsignar = ({ asignados, fallidos }) => {
  if (asignados > 0) {
    $q.notify({
      type: 'positive',
      message: asignados === 1 ? 'Auxiliar asignado.' : `${asignados} auxiliares asignados.`,
    })
  }
  if (fallidos.length > 0) {
    $q.notify({
      type: 'negative',
      message: fallidos.length === 1 ? 'No se pudo asignar a un auxiliar.' : `No se pudo asignar a ${fallidos.length} auxiliares.`,
      caption: fallidos[0].error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
    })
  }
}

const DIALOGO = { transitionShow: 'dialogo-entra', transitionHide: 'dialogo-sale', transitionDuration: 220 }

// Quitar se confirma: un toque basta y el auxiliar deja de ver tus casos.
const confirmarQuitar = (auxiliar) => {
  $q.dialog({
    ...DIALOGO,
    title: '¿Quitar auxiliar?',
    message: `${auxiliar.nombre} dejará de ver tus casos y de poder cambiar su estado. Se le avisará, y también a los administradores.`,
    cancel: { label: 'Cancelar', flat: true, noCaps: true, class: 'control-touch boton-presionable' },
    ok: { label: 'Quitar', color: 'dg-error', noCaps: true, unelevated: true, class: 'control-touch boton-presionable' },
    focus: 'cancel',
  }).onOk(async () => {
    const resultado = await auxiliares.quitarAuxiliar(Number(session.id), auxiliar.id)
    if (resultado.ok) {
      $q.notify({ type: 'positive', message: `${auxiliar.nombre} ya no es tu auxiliar.` })
    } else {
      $q.notify({
        type: 'negative',
        message: 'No se pudo quitar el auxiliar.',
        caption: resultado.error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
        timeout: 8000,
      })
    }
  })
}

const retry = () => {
  auxiliares.reintentar()
}

onMounted(() => {
  cargarPerfil()
  cases.cargarCasos()
  // El auxiliar no gestiona auxiliares: no se piden sus datos.
  if (session.esContador) {
    auxiliares.cargarAuxiliares(Number(session.id))
  }
  if (session.esAuxiliar) {
    cargarContadoresQueApoyo()
  }
})
</script>

<style scoped>
.auxiliares-page {
  padding: 16px;
}

.auxiliares-page__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 16px;
}

.auxiliares-page__title {
  flex: 1 0 100%;
}

/* Una columna en celular y tableta; desde 1024 px «Mi cuenta» queda fija a la izquierda. */
.perfil-page__rejilla {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.perfil-page__tarjeta {
  border-color: var(--dg-borde);
  border-radius: 8px;
}

.perfil-page__titulo-seccion {
  margin: 0 0 12px;
  color: var(--dg-texto);
  font-size: 1.1rem;
  font-weight: 600;
}

.perfil-cuenta__identidad {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.perfil-cuenta__avatar {
  flex: 0 0 auto;
  background: var(--q-secondary);
  color: var(--q-primary);
  font-weight: 600;
}

.perfil-cuenta__textos {
  min-width: 0;
}

.perfil-cuenta__nombre,
.perfil-cuenta__rol {
  margin: 0;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.perfil-cuenta__nombre {
  color: var(--dg-texto);
  font-weight: 600;
}

.perfil-cuenta__rol {
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
}

.perfil-cuenta__cambiar-contrasena {
  margin-top: 12px;
}

.perfil-dato {
  padding-right: 0;
  padding-left: 0;
}

.perfil-dato__etiqueta {
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
}

.perfil-dato__valor {
  color: var(--dg-texto);
  overflow-wrap: anywhere;
}

.auxiliares-page__lead {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
  flex: 1 1 260px;
  min-width: 0;
}

.auxiliares-page__agregar {
  flex: 0 0 auto;
}

.auxiliares-page__lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auxiliares-page__lista-titulo {
  margin: 0;
  padding: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

/* El tamaño va en las props de q-avatar: un font-size aquí lo encogía a 14 px. */
.auxiliar-item__avatar {
  background: var(--dg-fondo-seleccion);
  color: var(--dg-acento);
  font-weight: 600;
}

.auxiliar-item__nombre {
  color: var(--dg-texto);
  overflow-wrap: anywhere;
}

.auxiliares-page__q-list {
  border-color: var(--dg-borde);
  border-radius: 10px;
  overflow: hidden;
}

/* En el celular el botón ocupa todo el ancho, bajo el texto */
@media (max-width: 599px) {
  .auxiliares-page__agregar {
    flex: 1 1 100%;
  }
}

@media (min-width: 1024px) {
  .auxiliares-page {
    padding: 20px 24px;
  }

  .perfil-page__rejilla {
    flex-direction: row;
    align-items: flex-start;
  }

  .perfil-page__cuenta {
    flex: 0 0 340px;
  }

  .perfil-page__derecha {
    flex: 1 1 0;
    min-width: 0;
  }
}

/* Columna derecha: «Mis auxiliares» (solo contador) y «Mi cartera de clientes» una bajo otra. */
.perfil-page__derecha {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cartera__cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  margin-bottom: 8px;
}

.cartera__titulo {
  margin-bottom: 0;
}

.cartera__total {
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.cartera__ayuda {
  margin-bottom: 16px;
}

.cartera__sin-resultados {
  margin: 0;
  padding: 12px 0;
  color: var(--dg-texto-secundario);
  overflow-wrap: anywhere;
}

/* Más de 8 clientes: la lista se desplaza dentro de la tarjeta. */
.cartera__lista--scroll {
  max-height: 420px;
  overflow-y: auto;
}

.cartera-item__nombre {
  color: var(--dg-texto);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.cartera-item__marca {
  margin-top: 4px;
}

/* Solo «Importante» lleva color, y siempre junto a su texto e icono. */
.cartera-item__importante {
  margin: 0;
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
  font-weight: 600;
}

.cartera-item__cifras {
  align-items: flex-end;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.cartera-item__abiertos {
  color: var(--dg-texto);
  font-size: 0.9rem;
  font-weight: 600;
}

.cartera-item__finalizados {
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
}
</style>
