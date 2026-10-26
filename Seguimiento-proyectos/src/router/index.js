import { defineRouter } from '#q-app'
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router'

import AdminDashboardPage from '../pages/AdminDashboardPage.vue'
import CountersDirectoryPage from '../pages/CountersDirectoryPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import MyCasesPage from '../pages/MyCasesPage.vue'
import NewCasePage from '../pages/NewCasePage.vue'
import NewUserPage from '../pages/NewUserPage.vue'
import ResetPasswordPage from '../pages/ResetPasswordPage.vue'
import LoginLayout from '../layouts/LoginLayout.vue'
import MaquetaLayout from '../layouts/MaquetaLayout.vue'
import { SCREEN_IDS, useMaquetaStore } from '../stores/maqueta.js'
import { useSessionStore } from '../stores/session.js'
import { PANTALLA_PRINCIPAL_POR_ROL, decidirAcceso } from '../utils/accessRules.js'
import { PROFILES } from '../utils/constants.js'
import { accessDenied, arranqueFallido } from './accessState.js'

/*
 * Rutas de la aplicación (plan 003, sección 2).
 * P-1 usa `LoginLayout` (sin menú interno); P-2 a P-5 comparten `MaquetaLayout`
 * (título, regreso y, hasta T7, los controles de simulación de la maqueta 001).
 * La raíz siempre lleva a P-1.
 */
const routes = [
  {
    path: '/login',
    component: LoginLayout,
    children: [
      {
        path: '',
        name: 'login',
        component: LoginPage,
        meta: { titulo: 'Inicio de sesión' },
      },
    ],
  },
  {
    path: '/',
    component: MaquetaLayout,
    children: [
      // Abrir la aplicación sin dirección concreta lleva siempre a P-1 (RF-01).
      { path: '', redirect: { name: 'login' } },
      {
        path: 'admin/dashboard',
        name: 'admin-dashboard',
        component: AdminDashboardPage,
        meta: {
          requiereSesion: true,
          perfil: PROFILES.administrador,
          screenId: SCREEN_IDS.dashboard,
          titulo: 'Dashboard del administrador',
          volverA: 'admin-directorio',
        },
      },
      {
        path: 'admin/directorio',
        name: 'admin-directorio',
        component: CountersDirectoryPage,
        meta: {
          requiereSesion: true,
          perfil: [PROFILES.administrador, PROFILES.sistema],
          screenId: SCREEN_IDS.directory,
          titulo: 'Directorio de usuarios',
          volverA: 'admin-dashboard',
        },
      },
      {
        path: 'contador/registro',
        name: 'contador-registro',
        component: NewCasePage,
        meta: {
          requiereSesion: true,
          perfil: PROFILES.contador,
          screenId: SCREEN_IDS.newCase,
          titulo: 'Registro de caso',
          volverA: 'contador-casos',
        },
      },
      {
        path: 'contador/casos',
        name: 'contador-casos',
        component: MyCasesPage,
        meta: {
          requiereSesion: true,
          perfil: PROFILES.contador,
          screenId: SCREEN_IDS.myCases,
          titulo: 'Mis casos',
          volverA: 'contador-registro',
        },
      },
      {
        path: 'usuarios/alta',
        name: 'usuarios-alta',
        component: NewUserPage,
        meta: {
          requiereSesion: true,
          perfil: PROFILES.sistema,
          titulo: 'Alta de usuario',
        },
      },
      {
        path: 'usuarios/restablecer-contrasena',
        name: 'usuarios-restablecer',
        component: ResetPasswordPage,
        meta: {
          requiereSesion: true,
          perfil: PROFILES.sistema,
          titulo: 'Restablecer contraseña',
        },
      },
    ],
  },
]

/*
 * Compatibilidad intermedia (T5 a T8): `MaquetaLayout` y `AccessDenied.vue` todavía
 * leen la identidad de `maqueta.js` para elegir la vuelta a la pantalla principal.
 * El guard mantiene esa copia sincronizada con la sesión real; los datos de las
 * pantallas siguen siendo los de ejemplo hasta que T6 a T8 los conecten.
 */
const sincronizarIdentidadMaqueta = (sesion) => {
  const maqueta = useMaquetaStore()

  maqueta.session = sesion.autenticado
    ? { profile: sesion.rol, account: sesion.nombreVisible, counterId: sesion.id }
    : null
}

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default defineRouter((/* { store, ssrContext } */) => {
  const createHistory = import.meta.env.QUASAR_SERVER
    ? createMemoryHistory
    : import.meta.env.QUASAR_VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(import.meta.env.QUASAR_VUE_ROUTER_BASE),
  })

  // Arranque único por carga de la aplicación (plan 4.3): conectar los ganchos de
  // api.js y restaurar la sesión guardada antes de decidir la primera navegación.
  let arranque = null

  // Guard único de acceso: sesión (RF-05), perfil (RF-06) y P-1 abierta con sesión (RF-10).
  Router.beforeEach(async (to) => {
    const sesion = useSessionStore()

    accessDenied.value = false

    // El token y el perfil se leen de sessionStorage en cada navegación (RF-42).
    sesion.aplicarSesionGuardada()

    if (arranque === null) {
      sesion.conectarServicios()
      arranque = sesion.restaurarSesion()

      const resultado = await arranque

      if (resultado.estado === 'caducada') {
        // Token vencido o 401: P-1 muestra el aviso de sesión caducada (RF-07, RF-42/43).
        return { name: 'login', replace: true }
      }

      if (resultado.estado === 'error') {
        // Red o servidor caídos: no se borra la sesión; P-1 ofrece reintentar (RF-36).
        arranqueFallido.value = resultado.error
        return { name: 'login', replace: true }
      }

      if (resultado.estado === 'acceso_denegado') {
        // Perfil sin pantalla asignada: vuelve a P-1 a iniciar sesión con otra cuenta.
        return { name: 'login', query: { aviso: 'perfil' }, replace: true }
      }

      // Recarga con token vigente: se abre la pantalla principal del perfil (RF-44).
      if (resultado.estado === 'valida' && to.name === 'login') {
        return { name: PANTALLA_PRINCIPAL_POR_ROL[resultado.rol], replace: true }
      }
    } else {
      await arranque
    }

    sincronizarIdentidadMaqueta(sesion)

    const decision = decidirAcceso({
      ruta: { requiereSesion: to.meta.requiereSesion === true, perfil: to.meta.perfil ?? null },
      sesion: { autenticado: sesion.autenticado, rol: sesion.rol },
    })

    if (decision.accion === 'ir_login') {
      return { name: 'login', query: { aviso: 'sesion' }, replace: true }
    }

    if (decision.accion === 'denegar') {
      // La dirección se conserva; el layout muestra el aviso con la vuelta al perfil (RF-06).
      accessDenied.value = true
    }

    return true
  })

  return Router
})
