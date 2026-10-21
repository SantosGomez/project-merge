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
import MaquetaLayout from '../layouts/MaquetaLayout.vue'
import { SCREEN_IDS, useMaquetaStore } from '../stores/maqueta.js'
import { PROFILES } from '../utils/constants.js'
import { accessDenied } from './accessState.js'

/*
 * Rutas de la maqueta (plan 001, sección 5). Sustituyen a las rutas automáticas
 * de la plantilla de Quasar: las cinco pantallas y una redirección para la raíz.
 * Las pantallas internas comparten `MaquetaLayout` (título, regreso y simulaciones).
 */
const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
    meta: { titulo: 'Inicio de sesión' },
  },
  {
    path: '/',
    component: MaquetaLayout,
    children: [
      // Abrir la maqueta sin dirección concreta lleva siempre a P-1 (RF-1).
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
          perfil: PROFILES.administrador,
          screenId: SCREEN_IDS.directory,
          titulo: 'Directorio de contadores',
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
    ],
  },
]

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

  // Guard único de acceso: sesión (RF-5) y perfil (RF-6).
  Router.beforeEach((to) => {
    const maqueta = useMaquetaStore()

    accessDenied.value = false

    // P-1 se mantiene abierta aunque haya sesión: volver a entrar no la cierra (RF-10).
    if (to.meta.requiereSesion && !maqueta.isAuthenticated) {
      return { name: 'login', query: { aviso: 'sesion' }, replace: true }
    }

    // La dirección se conserva; el layout muestra el aviso con la vuelta al perfil (RF-6).
    if (to.meta.perfil && maqueta.session?.profile !== to.meta.perfil) {
      accessDenied.value = true
    }

    return true
  })

  return Router
})
