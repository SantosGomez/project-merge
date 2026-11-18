import { defineRouter } from '#q-app'
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router'

import AdminDashboardPage from '../pages/AdminDashboardPage.vue'
import AuditoriaFichaPage from '../pages/AuditoriaFichaPage.vue'
import AuditoriasPage from '../pages/AuditoriasPage.vue'
import CambiarContrasenaPage from '../pages/CambiarContrasenaPage.vue'
import ContadorDashboardPage from '../pages/ContadorDashboardPage.vue'
import CountersDirectoryPage from '../pages/CountersDirectoryPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import MyCasesPage from '../pages/MyCasesPage.vue'
import ContadorAuxiliaresPage from '../pages/ContadorAuxiliaresPage.vue'
import PaginaNoEncontrada from '../pages/[...path].vue'
import LoginLayout from '../layouts/LoginLayout.vue'
import MaquetaLayout from '../layouts/MaquetaLayout.vue'
import { SCREEN_IDS, useMaquetaStore } from '../stores/maqueta.js'
import { useSessionStore } from '../stores/session.js'
import { decidirAcceso } from '../utils/accessRules.js'
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
    // Tras entrar con la contraseña que asignó el administrador, la persona crea la suya.
    path: '/cambiar-contrasena',
    component: LoginLayout,
    children: [
      {
        path: '',
        name: 'cambiar-contrasena',
        component: CambiarContrasenaPage,
        meta: { requiereSesion: true, titulo: 'Crea tu contraseña' },
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
          titulo: 'Resumen del equipo',
          volverA: 'admin-directorio',
        },
      },
      {
        path: 'admin/directorio',
        name: 'admin-directorio',
        component: CountersDirectoryPage,
        meta: {
          requiereSesion: true,
          perfil: [PROFILES.administrador, PROFILES.sistema, PROFILES.recepcionista],
          screenId: SCREEN_IDS.directory,
          titulo: 'Directorio de usuarios',
          volverA: 'admin-dashboard',
        },
      },
      {
        path: 'auditorias',
        name: 'auditorias',
        component: AuditoriasPage,
        meta: {
          requiereSesion: true,
          perfil: [PROFILES.administrador, PROFILES.contador],
          titulo: 'Auditorías',
        },
      },
      {
        path: 'auditorias/:id(\\d+)',
        name: 'auditoria-ficha',
        component: AuditoriaFichaPage,
        meta: {
          requiereSesion: true,
          perfil: [PROFILES.administrador, PROFILES.contador],
          titulo: 'Ficha de auditoría',
        },
      },
      {
        path: 'contador/registro',
        // La pantalla de registro se unificó en «Mis casos» como diálogo.
        redirect: { name: 'contador-casos' },
      },
      {
        path: 'contador/casos',
        name: 'contador-casos',
        component: MyCasesPage,
        meta: {
          requiereSesion: true,
          perfil: [PROFILES.contador, PROFILES.auxiliar],
          screenId: SCREEN_IDS.myCases,
          titulo: 'Mis casos',
        },
      },
      {
        path: 'contador/auxiliares',
        // «Mis auxiliares» vive ahora dentro de «Mi perfil».
        redirect: { name: 'mi-perfil' },
      },
      {
        path: 'perfil',
        name: 'mi-perfil',
        component: ContadorAuxiliaresPage,
        meta: {
          requiereSesion: true,
          perfil: [PROFILES.contador, PROFILES.auxiliar],
          titulo: 'Mi perfil',
        },
      },
      {
        path: 'contador/dashboard',
        name: 'contador-dashboard',
        component: ContadorDashboardPage,
        meta: {
          requiereSesion: true,
          perfil: [PROFILES.contador, PROFILES.auxiliar],
          titulo: 'Mi resumen',
        },
      },
      // El alta y el restablecimiento de cuentas se hacen en diálogos del directorio.
      { path: 'usuarios/alta', redirect: { name: 'admin-directorio' } },
      { path: 'usuarios/restablecer-contrasena', redirect: { name: 'admin-directorio' } },
    ],
  },
  {
    // Cualquier otra dirección: página 404 con salida, en vez de una pantalla en blanco.
    path: '/:pathMatch(.*)*',
    component: LoginLayout,
    children: [
      {
        path: '',
        name: 'no-encontrada',
        component: PaginaNoEncontrada,
        meta: { titulo: 'Página no encontrada' },
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

    // El perfil de la sesión se lee del almacén en cada navegación (RF-42); el token va en cookie HttpOnly.
    sesion.aplicarSesionGuardada()

    if (arranque === null) {
      sesion.conectarServicios()
      arranque = sesion.restaurarSesion()

      const resultado = await arranque

      if (resultado.estado === 'caducada') {
        // Sesión vencida o 401: P-1 muestra el aviso de sesión caducada (RF-07, RF-42/43).
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

      // Recarga con sesión vigente: se abre la pantalla principal del perfil (RF-44),
      // o la de crear contraseña si la cuenta aún usa la asignada.
      if (resultado.estado === 'valida' && to.name === 'login') {
        return { path: resultado.pantallaPrincipal, replace: true }
      }
    } else {
      await arranque
    }

    sincronizarIdentidadMaqueta(sesion)

    // Con la contraseña asignada solo se puede crear la propia (o volver al login).
    if (sesion.autenticado && sesion.debeCambiarContrasena && !['cambiar-contrasena', 'login'].includes(to.name)) {
      return { name: 'cambiar-contrasena', replace: true }
    }
    if (to.name === 'cambiar-contrasena' && !sesion.debeCambiarContrasena) {
      return sesion.pantallaPrincipal
        ? { path: sesion.pantallaPrincipal, replace: true }
        : { name: 'login', replace: true }
    }

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
