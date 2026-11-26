// Store de sesión del frontend real (RF-01 a RF-10, RF-42 a RF-47).
// Guarda el estado de la sesión, el aviso persistente del cierre voluntario y el
// temporizador de inactividad de 30 minutos (RF-07). No navega ni usa el router:
// expone estado y acciones que consumen las pantallas (T5 a T9).
//
// Inyección de dependencias: `crearSessionStore(dependencias)` permite sustituir
// authService, los servicios de lectura protegida, los ganchos de api.js, el reloj
// (`ahora`) y el programador (`setInterval`/`clearInterval`) en las pruebas. El
// servicio por defecto (`useSessionStore`) usa las implementaciones reales.
//
// Los ganchos de api.js se conectan desde `conectarServicios()`, que el arranque
// de la aplicación (T5/T9) debe llamar una vez: cada petición reinicia
// `ultimaActividad` (RF-07) y un 401 protegido caduca la sesión (RF-42/43).

import { defineStore } from 'pinia'

import {
  ESTADOS_ERROR,
  registrarOnActividad as registrarActividadPorDefecto,
  registrarOnSesionExpirada as registrarSesionExpiradaPorDefecto,
} from '../services/api.js'
import {
  cambiarContrasena as cambiarContrasenaPorDefecto,
  getCambioPendiente as getCambioPendientePorDefecto,
  getPersistente as getPersistentePorDefecto,
  getActividades as getActividadesPorDefecto,
  setActividades as setActividadesPorDefecto,
  getModulos as getModulosPorDefecto,
  setModulos as setModulosPorDefecto,
  getNombre as getNombrePorDefecto,
  getId as getIdPorDefecto,
  getRol as getRolPorDefecto,
  obtenerPerfil as obtenerPerfilPorDefecto,
  limpiarSesion as limpiarSesionPorDefecto,
  login as loginPorDefecto,
  logout as logoutPorDefecto,
  setSesion as setSesionPorDefecto,
} from '../services/authService.js'
import { estaInactivo } from '../utils/inactividad.js'
import { construirError } from '../utils/mensajes.js'
import { RUTA_PRINCIPAL_POR_ROL } from '../utils/constants.js'
import { RUTA_SELECTOR_MODULOS, destinoTrasEntrar, rolDocumentosDe } from '../utils/modulos.js'

/** Minutos sin interacción tras los que la sesión caduca (RF-07). */
export const LIMITE_INACTIVIDAD_MINUTOS = 30

/** Con «Mantener sesión iniciada»: 7 días sin interacción (igual que el backend). */
export const LIMITE_INACTIVIDAD_PERSISTENTE_MINUTOS = 7 * 24 * 60

/** Cada cuánto comprueba el temporizador si la sesión superó el límite. */
export const INTERVALO_INACTIVIDAD_MS = 60 * 1000

/** Pantalla principal de cada perfil con pantalla asignada (Definiciones). */
export const PANTALLA_PRINCIPAL = RUTA_PRINCIPAL_POR_ROL

/** Pantalla donde la persona crea su contraseña tras entrar con la asignada. */
export const RUTA_CAMBIO_CONTRASENA = '/cambiar-contrasena'

/** Tipos de aviso persistente de cierre (RF-46 con revocación, RF-47 sin ella). */
export const TIPOS_AVISO = Object.freeze({
  CIERRE: 'cierre',
  REVOCACION: 'revocacion',
})

/** Texto del aviso tras un cierre con revocación confirmada (RF-46). */
export const TEXTO_AVISO_CIERRE = 'Sesión cerrada.'

/** Texto del aviso tras restablecer la contraseña de la cuenta propia (historia 9b). */
export const TEXTO_AVISO_CONTRASENA_NUEVA =
  'Contraseña restablecida correctamente. Inicia sesión con la contraseña nueva.'

/** Texto del aviso con tres partes cuando no se pudo revocar en el backend (RF-47). */
export const TEXTO_AVISO_REVOCACION = construirError(
  'la sesión se cerró en este equipo pero no se pudo confirmar la revocación en el servidor',
  'el cierre de sesión',
  'iniciar sesión de nuevo cuando desee usar la aplicación',
).mensaje

const comoFecha = (valor) => (valor instanceof Date ? valor : new Date(valor))

const authServicePorDefecto = {
  login: loginPorDefecto,
  logout: logoutPorDefecto,
  cambiarContrasena: cambiarContrasenaPorDefecto,
  obtenerPerfil: obtenerPerfilPorDefecto,
  getRol: getRolPorDefecto,
  getNombre: getNombrePorDefecto,
  getId: getIdPorDefecto,
  getCambioPendiente: getCambioPendientePorDefecto,
  getPersistente: getPersistentePorDefecto,
  getActividades: getActividadesPorDefecto,
  setActividades: setActividadesPorDefecto,
  getModulos: getModulosPorDefecto,
  setModulos: setModulosPorDefecto,
  setSesion: setSesionPorDefecto,
  limpiarSesion: limpiarSesionPorDefecto,
}

/**
 * Crea la definición del store de sesión con dependencias inyectables.
 * @param {Object} [dependencias] - inyección para pruebas.
 * @returns {Function} hook `useSessionStore`.
 */
export const crearSessionStore = (dependencias = {}) => {
  const authService = dependencias.authService ?? authServicePorDefecto
  const registrarActividad = dependencias.registrarOnActividad ?? registrarActividadPorDefecto
  const registrarSesionExpirada =
    dependencias.registrarOnSesionExpirada ?? registrarSesionExpiradaPorDefecto
  const ahora = dependencias.ahora ?? (() => new Date())
  const programar =
    dependencias.setInterval ?? ((funcion, ms) => globalThis.setInterval(funcion, ms))
  const cancelar = dependencias.clearInterval ?? ((id) => globalThis.clearInterval(id))

  // Identificador del temporizador de inactividad; vive en el cierre de la fábrica.
  let temporizador = null

  return defineStore('session', {
    state: () => {
      return {
        /** Perfil de la cuenta: administrador, contador u otro sin pantalla. */
        rol: authService.getRol(),
        /** Nombre de la persona para el menú (login por correo); null en sesiones anteriores. */
        nombre: authService.getNombre(),
        id: authService.getId(),
        /** La persona entró con la contraseña asignada y debe crear la suya. */
        debeCambiarContrasena: authService.getCambioPendiente(),
        /** Eligió «Mantener sesión iniciada»: la sesión sobrevive al cerrar la app. */
        persistente: authService.getPersistente(),
        /** La cuenta tiene el módulo «Mis actividades» (pestaña de «Mis casos»). */
        actividadesHabilitadas: authService.getActividades(),
        /** Módulos de la cuenta ([{ modulo, rol }]) para el selector y el menú (unión con documentos). */
        modulos: authService.getModulos?.() ?? [],
        /** Administradores cuya agenda administra la recepcionista (`[{ id, nombre }]`); solo en memoria. */
        administradoresAtendidos: [],
        /** Bandera de sesión caducada por inactividad, `exp` o 401 (RF-07/43). */
        sesionCaducada: false,
        /** Último momento de actividad en milisegundos (RF-07). */
        ultimaActividad: null,
        /** Aviso persistente de cierre voluntario: `{ texto, tipo }` o null (RF-46/47). */
        avisoSesion: null,
      }
    },

    getters: {
      /** Hay perfil de sesión guardado; la pantalla decide además si el perfil tiene pantalla. */
      autenticado: (state) => Boolean(state.rol),
      /** El perfil tiene pantalla asignada en esta spec (administrador o contador). */
      tienePantalla: (state) => Object.hasOwn(PANTALLA_PRINCIPAL, state.rol),
      /** Ruta de la pantalla principal del perfil, o null si no tiene. */
      pantallaPrincipal: (state) => PANTALLA_PRINCIPAL[state.rol] ?? null,
      esAdministrador: (state) => state.rol === 'administrador',
      esContador: (state) => state.rol === 'contador',
      esAuxiliar: (state) => state.rol === 'auxiliar',
      /** Contador o auxiliar: tiene «Mis casos», «Mi resumen» y la campana de avisos. */
      trabajaCasos: (state) => ['contador', 'auxiliar'].includes(state.rol),
      /** Los 4 roles del calendario ven la campana de avisos; el usuario de sistema no. */
      veCampana: (state) =>
        ['administrador', 'contador', 'auxiliar', 'recepcionista'].includes(state.rol),
      esUsuarioSistema: (state) => state.rol === 'usuarios_de_sistema',
      /** La recepcionista consulta el directorio y usa el calendario; no trabaja casos. */
      esRecepcionista: (state) => state.rol === 'recepcionista',
      /** Nombre que se muestra en el menú; null si la sesión guardada no lo trae. */
      nombreVisible: (state) => state.nombre,
      /** Módulos de la unión con documentos. */
      tieneModulo: (state) => (modulo) => (state.modulos ?? []).some((m) => m.modulo === modulo),
      variosModulos: (state) => (state.modulos ?? []).length > 1,
      /** Rol dentro del módulo de documentos con el nombre que usan sus permisos ('Contador'…), o null. */
      rolDocumentos: (state) => rolDocumentosDe(state.modulos),
    },

    actions: {
      /** Copia en el estado el perfil de sesión que authService tiene guardado (sin token). */
      aplicarSesionGuardada() {
        this.rol = authService.getRol()
        this.nombre = authService.getNombre()
        this.id = authService.getId()
        this.debeCambiarContrasena = authService.getCambioPendiente()
        this.persistente = authService.getPersistente()
        this.actividadesHabilitadas = authService.getActividades()
        this.modulos = authService.getModulos?.() ?? []
      },

      /** Limpia solo el estado reactivo; no toca el almacén ni el temporizador. */
      limpiarEstadoLocal() {
        this.rol = null
        this.nombre = null
        this.id = null
        this.debeCambiarContrasena = false
        this.persistente = false
        this.actividadesHabilitadas = false
        this.modulos = []
        this.administradoresAtendidos = []
        this.ultimaActividad = null
      },

      /** Arranca la comprobación periódica de inactividad (una sola vez). */
      iniciarTemporizador() {
        if (temporizador !== null) {
          return
        }
        temporizador = programar(() => {
          this.comprobarInactividad()
        }, INTERVALO_INACTIVIDAD_MS)
      },

      /** Detiene el temporizador de inactividad si está activo. */
      detenerTemporizador() {
        if (temporizador === null) {
          return
        }
        cancelar(temporizador)
        temporizador = null
      },

      /**
       * Registra actividad del usuario o de una petición (RF-07).
       * @param {Date} [hoy] - momento de la actividad (inyectable en pruebas).
       */
      marcarActividad(hoy = ahora()) {
        const momento = comoFecha(hoy)
        this.ultimaActividad = Number.isNaN(momento.getTime()) ? null : momento.getTime()
      },

      /**
       * Comprueba si pasó el límite sin actividad (30 minutos, o 7 días con «Mantener sesión
       * iniciada»); si es así caduca.
       * Exactamente en el límite la sesión sigue viva (RF-07).
       * @param {Date} [hoy] - momento de la comprobación.
       * @returns {boolean} true si la sesión acaba de caducar.
       */
      comprobarInactividad(hoy = ahora()) {
        if (!this.autenticado || this.ultimaActividad === null) {
          return false
        }
        if (
          !estaInactivo(
            new Date(this.ultimaActividad),
            comoFecha(hoy),
            this.persistente ? LIMITE_INACTIVIDAD_PERSISTENTE_MINUTOS : LIMITE_INACTIVIDAD_MINUTOS,
          )
        ) {
          return false
        }
        this.caducarSesion()
        return true
      },

      /**
       * Caduca la sesión: elimina el perfil guardado, detiene el temporizador y activa la
       * bandera que muestra el aviso de sesión caducada (RF-07, RF-43).
       */
      caducarSesion() {
        authService.limpiarSesion()
        this.limpiarEstadoLocal()
        this.detenerTemporizador()
        this.sesionCaducada = true
        return { caducada: true }
      },

      /**
       * Fija el aviso persistente que muestra P-1 tras un cierre (RF-46/47).
       * @param {string} texto - texto visible del aviso.
       * @param {string} [tipo] - 'cierre' o 'revocacion'.
       */
      fijarAvisoSesion(texto, tipo = TIPOS_AVISO.CIERRE) {
        this.avisoSesion = texto ? { texto, tipo } : null
      },

      /** Limpia el aviso persistente (siguiente acción del usuario en P-1). */
      limpiarAvisoSesion() {
        this.avisoSesion = null
      },

      /**
       * Conecta los ganchos de api.js con este store (RF-07, RF-42, RF-43).
       * Debe llamarse una vez al arrancar la aplicación (T5/T9).
       */
      conectarServicios() {
        registrarActividad(() => {
          this.marcarActividad()
        })
        registrarSesionExpirada(() => {
          this.caducarSesion()
        })
      },

      /**
       * Arranque y recarga de página (plan 4.3, RF-42, RF-44, S8):
       * sin perfil guardado → sin sesión; con perfil, la cookie HttpOnly decide: se comprueba con
       * GET /auth/perfil y, si responde 401 o es de otra cuenta (otra pestaña inició sesión con
       * otro usuario), caduca sin dejar datos ajenos en pantalla.
       * @returns {Promise<{ estado: string, rol?: string, pantallaPrincipal?: string, error?: Object, reintentar?: boolean }>}
       */
      async restaurarSesion() {
        if (!authService.getRol()) {
          this.limpiarEstadoLocal()
          this.detenerTemporizador()
          this.sesionCaducada = false
          return { estado: 'sin_sesion' }
        }

        const momento = comoFecha(ahora())

        this.aplicarSesionGuardada()

        if (!this.tienePantalla) {
          return { estado: 'acceso_denegado', rol: this.rol }
        }

        // Con la contraseña asignada la API responde 403 a toda lectura (incluido el perfil): se va
        // directo a crearla. Si la sesión ya no sirve, el 401 al guardarla caduca la sesión.
        if (this.debeCambiarContrasena) {
          this.sesionCaducada = false
          this.marcarActividad(momento)
          this.iniciarTemporizador()
          return { estado: 'valida', rol: this.rol, pantallaPrincipal: RUTA_CAMBIO_CONTRASENA }
        }

        try {
          const perfil = await authService.obtenerPerfil()
          if (String(perfil?.id) !== String(this.id)) {
            // La cookie es de otra cuenta: la sesión de esta pestaña ya no es suya.
            this.caducarSesion()
            return { estado: 'caducada' }
          }
          // El backend es quien decide quién tiene «Mis actividades»: se refresca la marca guardada.
          const habilitado = perfil?.actividades_habilitadas === true
          authService.setActividades(habilitado)
          this.actividadesHabilitadas = habilitado
          // También decide los módulos (seguimiento, documentos…) y el rol en cada uno.
          if (Array.isArray(perfil?.modulos)) {
            authService.setModulos?.(perfil.modulos)
            this.modulos = authService.getModulos?.() ?? []
          }
          this.administradoresAtendidos = Array.isArray(perfil?.administradores_atendidos)
            ? perfil.administradores_atendidos
            : []
        } catch (error) {
          if (error?.estado === ESTADOS_ERROR.SIN_SESION) {
            this.caducarSesion()
            return { estado: 'caducada', error }
          }
          // Red o servidor: la sesión sigue viva; la pantalla ofrece reintentar.
          return { estado: 'error', error, reintentar: true }
        }

        this.sesionCaducada = false
        this.marcarActividad(momento)
        this.iniciarTemporizador()

        return {
          estado: 'valida',
          rol: this.rol,
          pantallaPrincipal: destinoTrasEntrar(this.modulos, PANTALLA_PRINCIPAL[this.rol]),
        }
      },

      /**
       * Inicia sesión con credenciales reales (RF-01 a RF-10).
       * Si había una sesión viva, la revoca con `authService.logout()` de forma
       * best-effort antes de dejar la nueva en el estado (RF-10): el resultado de
       * logout no bloquea. Un login fallido conserva la sesión previa.
       * @param {string} correo
       * @param {string} password
       * @returns {Promise<Object>} resultado para la pantalla P-1.
       */
      async iniciarSesion(correo, password, mantenerSesion = false) {
        // Enviar credenciales es la siguiente acción del usuario: limpia el aviso (RF-46/47).
        this.avisoSesion = null

        let nueva

        try {
          nueva = await authService.login(correo, password, mantenerSesion)
        } catch (error) {
          return { ok: false, error }
        }

        // La sesión previa de la cookie la revoca el backend al iniciar la nueva (RF-10).
        if (nueva) {
          authService.setSesion(nueva)
        }
        this.aplicarSesionGuardada()
        this.administradoresAtendidos = nueva?.administradoresAtendidos ?? []
        this.sesionCaducada = false
        this.marcarActividad()

        const pantalla = PANTALLA_PRINCIPAL[this.rol] ?? null
        // Con varios módulos se elige primero cuál usar; con solo documentos se entra ahí.
        const destino = pantalla === null ? null : destinoTrasEntrar(this.modulos, pantalla)

        if (pantalla !== null) {
          this.iniciarTemporizador()
        }

        return {
          ok: true,
          rol: this.rol,
          id: this.id,
          // Con la contraseña asignada, primero se crea la propia.
          pantallaPrincipal:
            pantalla !== null && this.debeCambiarContrasena ? RUTA_CAMBIO_CONTRASENA : destino,
          accesoDenegado: pantalla === null,
        }
      },

      /**
       * Reemplaza la contraseña asignada por una propia y quita la marca.
       * @param {string} password - contraseña nueva.
       * @returns {Promise<{ ok: true, pantallaPrincipal: string|null } | { ok: false, error: Object }>}
       */
      async crearContrasenaPropia(password) {
        try {
          await authService.cambiarContrasena(password)
        } catch (error) {
          return { ok: false, error }
        }

        this.debeCambiarContrasena = false
        // Como al iniciar sesión, todas las cuentas pasan por el selector de módulos.
        return { ok: true, pantallaPrincipal: RUTA_SELECTOR_MODULOS }
      },

      /**
       * Cierre voluntario confirmado (plan 4.8, RF-45 a RF-47).
       * Llama a `authService.logout()`; pase lo que pase cierra la sesión local,
       * detiene el temporizador y fija el aviso persistente de P-1.
       * @returns {Promise<{ ok: boolean, avisoSesion: Object }>}
       */
      async cerrarSesionVoluntaria() {
        let resultado

        try {
          resultado = await authService.logout()
        } catch (error) {
          resultado = { ok: false, error }
        }

        const ok = resultado?.ok === true

        authService.limpiarSesion()
        this.limpiarEstadoLocal()
        this.detenerTemporizador()
        this.sesionCaducada = false

        this.fijarAvisoSesion(
          ok ? TEXTO_AVISO_CIERRE : TEXTO_AVISO_REVOCACION,
          ok ? TIPOS_AVISO.CIERRE : TIPOS_AVISO.REVOCACION,
        )

        return { ok, avisoSesion: this.avisoSesion }
      },

      /**
       * Cierra la sesión en este equipo tras restablecer la contraseña de la cuenta propia (9b).
       * No llama a logout: el backend ya revocó el token al restablecer y solo respondería 401.
       */
      cerrarSesionPorContrasenaNueva() {
        authService.limpiarSesion()
        this.limpiarEstadoLocal()
        this.detenerTemporizador()
        this.sesionCaducada = false
        this.fijarAvisoSesion(TEXTO_AVISO_CONTRASENA_NUEVA, TIPOS_AVISO.CIERRE)
      },
    },
  })
}

/** Store de sesión con los servicios reales. */
export const useSessionStore = crearSessionStore()
