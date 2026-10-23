import { defineStore } from '#q-app'
import { createPinia } from 'pinia'

import { useCasesStore } from './cases.js'
import { useCountersStore } from './counters.js'
import { useCounterStore } from './example-store.js'
import { useMaquetaStore } from './maqueta.js'
import { useSessionStore } from './session.js'

/*
 * If not building with SSR mode, you can
 * directly export the Store instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Store instance.
 */

/**
 * Registro único de los stores de la aplicación.
 * Los stores nuevos (sesión, contadores y casos) conviven con los de la maqueta
 * de la spec 001, que se conservan aunque las pantallas dejen de usarlos.
 */
export const stores = Object.freeze({
  sesion: useSessionStore,
  contadores: useCountersStore,
  casos: useCasesStore,
  maqueta: useMaquetaStore,
  ejemplo: useCounterStore,
})

export default defineStore((/* { ssrContext } */) => {
  const pinia = createPinia()

  // You can add Pinia plugins here
  // pinia.use(SomePiniaPlugin)

  return pinia
})
