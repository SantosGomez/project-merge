// Store de la maqueta: estado solo en memoria, sin persistencia (RF-41).
// Guarda la sesión, los casos, el contador seleccionado y el estado de cada pantalla.
// Ninguna decisión de negocio se resuelve aquí: se delega en src/utils/ y en la semilla.

import { acceptHMRUpdate, defineStore } from 'pinia'

import { exampleAccounts, exampleCases } from '../services/exampleData.js'
import { normalizeCredential, resolveProfile, validateLoginForm } from '../utils/accessRules.js'
import {
  addCase,
  casesByCounter,
  changePriority,
  changeStatus,
  countByStatus,
  validateNewCase,
} from '../utils/caseRules.js'
import { PROFILES } from '../utils/constants.js'

/** Pantallas con datos (P-2 a P-5), con la misma numeración de la spec. P-1 no tiene datos. */
export const SCREEN_IDS = Object.freeze({
  dashboard: 'p2',
  directory: 'p3',
  newCase: 'p4',
  myCases: 'p5',
})

/** Espera de la carga simulada: aproximadamente un segundo (RF-35). */
export const LOADING_DELAY_MS = 1000

/** Códigos que las acciones devuelven a las pantallas cuando no hay resultado de una regla. */
export const STORE_ERROR_CODES = Object.freeze({
  invalidCredentials: 'invalid_credentials',
  noSession: 'no_session',
})

const SCREEN_KEYS = Object.values(SCREEN_IDS)

/** Temporizadores de la carga simulada por pantalla; se cancelan al caducar, cerrar o reiniciar. */
const loadingTimers = new Map()

/** Estado de carga y error en reposo de todas las pantallas con datos. */
const emptyScreens = () =>
  Object.fromEntries(SCREEN_KEYS.map((screenId) => [screenId, { loading: false, error: false }]))

/** Copia de la semilla: los cambios de la maqueta nunca tocan el módulo de datos de ejemplo. */
const seedCases = () => exampleCases.map((oneCase) => ({ ...oneCase }))

const clearLoadingTimer = (screenId) => {
  const timer = loadingTimers.get(screenId)

  if (timer !== undefined) {
    clearTimeout(timer)
    loadingTimers.delete(screenId)
  }
}

const clearAllLoadingTimers = () => {
  for (const screenId of [...loadingTimers.keys()]) {
    clearLoadingTimer(screenId)
  }
}

/** Siguiente identificador de caso: continúa la numeración de la semilla. */
const nextCaseId = (cases) => {
  const highest = cases.reduce((max, oneCase) => {
    const match = /^case-(\d+)$/.exec(oneCase.id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `case-${String(highest + 1).padStart(2, '0')}`
}

export const useMaquetaStore = defineStore('maqueta', {
  state: () => ({
    /** Sesión simulada: `{ profile, account, counterId }` o `null` sin sesión (RF-2, RF-8). */
    session: null,
    /** Casos de la maqueta: copia de la semilla que cambia solo en memoria (RF-25, RF-41). */
    cases: seedCases(),
    /** Contador cuyo detalle se muestra en P-2 (RF-13, RF-17). */
    selectedCounterId: null,
    /** Aviso de sesión caducada que consume P-1 tras "Simular caducidad" (RF-7). */
    sessionExpired: false,
    /** Carga y error de cada pantalla con datos (RF-35, RF-37). */
    screens: emptyScreens(),
  }),

  getters: {
    isAuthenticated: (state) => state.session !== null,
    isAdmin: (state) => state.session?.profile === PROFILES.administrador,
    isCounter: (state) => state.session?.profile === PROFILES.contador,
    currentCounterId: (state) => state.session?.counterId ?? null,
    /** Casos propios del contador conectado (RF-33, RNF-6). */
    myCases() {
      return casesByCounter(this.cases, this.currentCounterId)
    },
    /** Conteos por estado de un contador, siempre con las tres claves (RF-12). */
    countsFor: (state) => (counterId) => countByStatus(casesByCounter(state.cases, counterId)),
  },

  actions: {
    /**
     * Inicia sesión con una cuenta de ejemplo (RF-2, RF-3, RF-4, RF-8, RF-10).
     * Devuelve `{ valid, missing, errorCode, profile }`; la navegación la resuelve el router.
     */
    login(username, password) {
      clearAllLoadingTimers()

      const { valid, missing } = validateLoginForm(username, password)

      if (!valid) {
        return { valid: false, missing, errorCode: null, profile: null }
      }

      const profile = resolveProfile(username, password, exampleAccounts)

      if (profile === null) {
        return {
          valid: false,
          missing: [],
          errorCode: STORE_ERROR_CODES.invalidCredentials,
          profile: null,
        }
      }

      const account = exampleAccounts.find(
        (oneAccount) => oneAccount.username === normalizeCredential(username),
      )

      // Solo se guarda la identidad: la contraseña de ejemplo no se conserva.
      this.session = {
        profile,
        account: account.username,
        counterId: account.counterId ?? null,
      }
      this.sessionExpired = false
      this.selectedCounterId = null
      this.screens = emptyScreens()

      return { valid: true, missing: [], errorCode: null, profile }
    },

    /** Cierra la sesión sin perder los cambios de la maqueta (RF-7, RF-41). */
    logout() {
      clearAllLoadingTimers()
      this.session = null
      this.sessionExpired = false
      this.selectedCounterId = null
      this.screens = emptyScreens()
    },

    /** Selecciona el contador cuyo detalle se ve en P-2 (RF-13, RF-15, RF-17). */
    selectCounter(counterId) {
      this.selectedCounterId = counterId ?? null
    },

    /**
     * Carga los datos de una pantalla con la espera simulada (RF-35).
     * La pantalla decide cuándo entrar; aquí solo se marca la carga y se cierra al segundo.
     */
    startScreenLoad(screenId) {
      const screen = this.screens[screenId]

      if (!screen) {
        return
      }

      clearLoadingTimer(screenId)
      screen.error = false
      screen.loading = true

      const timer = setTimeout(() => {
        loadingTimers.delete(screenId)

        const currentScreen = this.screens[screenId]

        if (currentScreen) {
          currentScreen.loading = false
        }
      }, LOADING_DELAY_MS)

      loadingTimers.set(screenId, timer)
    },

    /** Reintenta la carga y, en P-2, descarta la selección anterior (RF-37). */
    retryScreen(screenId) {
      if (!this.screens[screenId]) {
        return
      }

      if (screenId === SCREEN_IDS.dashboard) {
        this.selectedCounterId = null
      }

      this.startScreenLoad(screenId)
    },

    /** "Simular error": sustituye lo que muestre la pantalla por el error (RF-37, RF-38). */
    simulateError(screenId) {
      const screen = this.screens[screenId]

      if (!screen) {
        return
      }

      clearLoadingTimer(screenId)
      screen.loading = false
      screen.error = true
    },

    /** "Simular caducidad": cierra la sesión y deja las pantallas sin datos (RF-7). */
    simulateExpiry() {
      clearAllLoadingTimers()
      this.session = null
      this.sessionExpired = true
      this.selectedCounterId = null
      this.screens = emptyScreens()
    },

    /**
     * Registra un caso propio del contador conectado (RF-21 a RF-26).
     * Valida y da de alta con `caseRules`; devuelve `{ valid, errorCode, case }`.
     */
    registerCase({ client, priority } = {}) {
      const counterId = this.currentCounterId

      if (counterId === null) {
        return { valid: false, errorCode: STORE_ERROR_CODES.noSession, case: null }
      }

      const validation = validateNewCase({ client, priority })

      if (!validation.valid) {
        return { valid: false, errorCode: validation.errorCode, case: null }
      }

      this.cases = addCase(this.cases, {
        client,
        priority,
        counterId,
        nextId: nextCaseId(this.cases),
      })

      return { valid: true, errorCode: null, case: this.cases[this.cases.length - 1] }
    },

    /** Cambia el estado de un caso sin restricciones (RF-30, RF-32). */
    changeCaseStatus(caseId, status) {
      this.cases = changeStatus(this.cases, caseId, status)
    },

    /** Cambia la prioridad de un caso sin restricciones (RF-31, RF-32). */
    changeCasePriority(caseId, priority) {
      this.cases = changePriority(this.cases, caseId, priority)
    },

    /** Reinicia todo a la semilla de `exampleData.js`, sin persistencia (RF-41). */
    resetToSeed() {
      clearAllLoadingTimers()
      this.session = null
      this.sessionExpired = false
      this.cases = seedCases()
      this.selectedCounterId = null
      this.screens = emptyScreens()
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMaquetaStore, import.meta.hot))
}
