# Flujo de trabajo con subagentes

Cómo se reparte el trabajo entre los modelos de Anthropic en Claude Code. Las reglas del proyecto (puertas, datos de prueba, puertos) están en AGENTS.md; este documento solo dice quién hace qué.

Desde el 2026-11-10 el flujo usa solo modelos de Anthropic: opencode con modelos gratuitos tardaba demasiado por rebanada. Lo de opencode queda en el anexo, por si se retoma.

## Roles

| Rol | Dónde | Modelo | Qué hace |
|---|---|---|---|
| Orquestador | Sesión principal | Opus | Refina con el usuario, asigna riesgo, delega, integra, actualiza MEMORY.md y hace los commits. |
| Implementer | `.claude/agents/implementer.md` | Sonnet | Una rebanada con TDD y sus puertas. |
| Reviewer | `.claude/agents/reviewer.md` | Sonnet | Revisión independiente de riesgo medio, sin modificar nada. |
| Reviewer ligero | `.claude/agents/reviewer-ligero.md` | Haiku | Revisión de riesgo bajo, sin modificar nada. |
| Explorador | Agente `Explore` | Haiku | Localiza archivos y pruebas afectadas. Solo lee. |
| Consultor | Agente con modelo `fable` | Fable (uso puntual) | Decisiones difíciles y revisión de riesgo alto. |

Los alias `sonnet`, `haiku` y `opus` apuntan siempre a la versión más reciente; no fijar IDs de versiones anteriores (Haiku 4.5 cuesta 10 veces más que Haiku 5.5).

## Riesgo de una rebanada

Lo asigna el orquestador al refinar y queda escrito en el archivo de la rebanada.

| Riesgo | Ejemplos | Implementa | Revisa |
|---|---|---|---|
| Bajo | Textos, estilos, ajustes de interfaz, CRUD que copia un patrón existente | Sonnet (`implementer`) | Haiku (`reviewer-ligero`) |
| Medio | Lógica nueva en store o controladores, filtros, diálogos con validación | Sonnet (`implementer`) | Sonnet (`reviewer`, instancia nueva) |
| Alto | Autenticación, roles y permisos, migraciones o esquema, fechas, datos de producción | Sonnet (`implementer`) | `reviewer` con modelo Fable; Opus si la cuota de Fable va alta |

- Si `reviewer-ligero` responde «ESCALAR: requiere reviewer», se repite la revisión con `reviewer`.
- Para riesgo alto, el orquestador lanza `reviewer` cambiando el modelo en la llamada (`model: fable` u `opus`); no hace falta otro agente.
- Explorar y correr puertas: Haiku. Decidir y diseñar: el orquestador, o Fable cuando la decisión es difícil.

## Consumo de referencia (plan Team, 2026-11-10)

- Fable tiene cuota semanal propia, pero su uso también movió la cuota semanal de todos los modelos y el límite de 5 horas.
- Análisis de solo lectura (propuesta de equipos): ~2 % de la cuota de Fable.
- Rebanada de riesgo alto completa con Fable como orquestador e implementador: ~7 % de Fable, ~4 % del semanal general y ~21 % del límite de 5 horas.
- Por eso Fable no implementa: revisa o decide, y el trabajo de volumen va con Sonnet y Haiku.

## Ciclo de una rebanada

1. **Refinar** (orquestador + usuario): criterios de aceptación, archivos autorizados y riesgo. Se crea `docs/rebanadas/NN-nombre.md` desde `docs/rebanadas/00-plantilla.md`.
2. **Implementar**: el implementer lee el archivo de la rebanada y responde con su reporte; el orquestador lo copia al final del archivo.
3. **Revisar**: el reviewer que toque según el riesgo lee el archivo y el diff, y responde con su veredicto (no puede editar); el orquestador lo copia al archivo. No recibe la opinión del orquestador.
4. **Corregir**: con «CAMBIOS NECESARIOS» vuelve al implementer. Máximo 2 vueltas; después decide el usuario.
5. **Cerrar** (orquestador): verificación en navegador, MEMORY.md y propuesta de commit. El push solo con permiso del usuario.

## Reglas de convivencia

- En paralelo solo trabajo de lectura (explorar, evaluar, revisar con enfoques distintos).
- Implementar, migrar la base, MEMORY.md y commits van siempre en serie, y nunca dos sesiones escribiendo en el mismo checkout.
- Solo el orquestador edita MEMORY.md; los demás lo reportan en «Para la memoria».

---

## Anexo: opencode con modelos gratuitos (opcional, en pausa)

Los agentes de `.opencode/agents/` siguen en el repositorio pero no forman parte del flujo. En la práctica una rebanada tardó mucho más que con Claude (límites diarios, reintentos y modelos lentos).

Lanzar desde Claude Code:

```bash
opencode run --agent reviewer --auto --title "NN-nombre-revision" "Revisa la rebanada de docs/rebanadas/NN-nombre.md"
```

`--auto` aprueba los permisos que el agente no tiene prohibidos; `-m <proveedor/modelo>` cambia el modelo.

Prueba del 2026-11-10 (leer un archivo con una herramienta; no mide calidad para programar):

- Los `opencode/*` (OpenCode Zen) no comparten el tope diario de OpenRouter; la mayoría de los `openrouter/*:free` sí comparten uno solo.
- Respondieron bien: `opencode/beam-free`, `flint-40b-free`, `glm-5.3-flash-free`, `iceman-free`, `inkling-2-small-free`, `longcat-2.5-free`, `minimax-m3.1-flash-free`, `nemotron-3.5-lightning-free`, `nemotron-3.5-super-vl-free`, `deepseek-v4.1-flash-free` (lento); `openrouter/openrouter/free`, `openrouter/thinkingmachines/inkling-2-small:free`, `openrouter/xingchen-agi/xing4.0-29b-a4b:free` (lento).
- Se colgó: `opencode/mimo-v2.6-flash-free`.
- Orden de respaldo: el mismo modelo en OpenCode Zen → `opencode/deepseek-v4.1-flash-free` → `glm-5.3-flash-free` / `minimax-m3.1-flash-free` / `longcat-2.5-free` → los tres de OpenRouter que respondieron.
