# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- Spec 001 (frontend Quasar/Vue 3): completa, 5 pantallas, tests 105/105, lint y build verdes.
- backend/ creado con package.json (express, mysql2, jsonwebtoken, argon2, dotenv, cors), `npm install` ejecutado.
- T2 completada: `backend/src/utils/passwordUtils.js` (Argon2id) y `backend/src/utils/validationUtils.js` (validaciones RF-02, RF-19, RF-20, RF-21); tests en verde.
- T3 y T4 completadas: `backend/src/utils/tokenUtils.js`, `dateUtils.js`, `errorUtils.js`; tests en verde (5 suites, 0 fail).
- T5 completada: tests de modelos y seed creados en rojo (userModel, caseModel, seed).
- **T6 completada:** implementados `backend/src/config/db.js` (pool mysql2, exporta `query`), `backend/src/models/UserModel.js` (findByUsername, create, findById, findAll), `backend/src/models/CaseModel.js` (findById, findByCounter, countByStatus con ceros, create, updateStatus, updatePriority), `backend/src/utils/seed.js` (seedDatabase idempotente, tablas + admin + contador con Argon2id), `backend/.env`. Verificación: `node --test test/userModel.test.js test/caseModel.test.js test/seed.test.js` → 3 suites, 3 pass, 0 fail (MariaDB local, DB `delgrow_contadores`).
- **T7-T10 completadas:** middlewares de autenticación, roles y propiedad; controladores y rutas de la API; `backend/src/app.js` y `backend/src/server.js` cableados (servidor en puerto 3000, seed ejecutado, endpoints montados). Verificación: `node --test` desde `backend/` → 15 pass, 1 fail (`mock_exp.test.js`, pre-existente, incompatibilidad de Node.js, no relacionado con T10); los 25 criterios de finalización de la spec 002 cubiertos; **spec 002 completa y aprobada por el reviewer (@reviewer)**.

## Decisiones (y por qué)

- Tests de backend con `node --test`, sin paquetes adicionales (Constitución Principio 2).
- Funciones puras en `backend/src/utils/`, síncronas, con `hoy` inyectado para ser deterministas (plan sección 3).
- Mensajes de error con tres partes en español: qué ocurrió, sobre qué, qué hacer (RF-23, RNF-5, RNF-6).
- Fechas en hora local, formato YYYY-MM-DD HH:mm:ss (RNF-2).
- MariaDB con mysql2 como pool de conexiones; seed crea tablas IF NOT EXISTS e inserta solo si faltan usuarios (idempotente, RF-27).

## Aprendizajes y errores a evitar

- No crear implementación en T3: solo tests, deben fallar primero (en rojo).
- PowerShell no soporta `&&` ni `||`; usar comandos separados.
- `node --test` desde `backend/` para ejecutar tests de CommonJS.
- MariaDB debe estar en ejecución antes de correr tests de modelos/seed (puerto 3306, root sin contraseña en XAMPP).

## Próximos pasos

- No hay tareas pendientes en la spec 002: las 10 tareas (T1-T10) y los 25 criterios de finalización están cubiertos, T10 verificada y marcada [x], y la spec está completa y aprobada por el reviewer (@reviewer).