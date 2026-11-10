# Flujo de trabajo con subagentes

Cómo se reparte el trabajo entre Claude Code y opencode. Las reglas del proyecto (puertas, datos de prueba, puertos) están en AGENTS.md; este documento solo dice quién hace qué.

## Roles

| Rol | Dónde | Modelo | Qué hace |
|---|---|---|---|
| Orquestador | Sesión principal de Claude Code | Opus | Refina con el usuario, asigna riesgo, delega, integra, actualiza MEMORY.md y hace los commits. |
| Implementer | `.claude/agents/` o `.opencode/agents/` | Sonnet / modelo gratuito | Una rebanada con TDD y sus puertas. |
| Reviewer | `.claude/agents/` o `.opencode/agents/` | Sonnet / modelo gratuito | Revisión independiente, sin modificar nada. |
| Explorador | `Explore` de Claude o opencode | Haiku / modelo gratuito | Localiza archivos y pruebas afectadas. Solo lee. |
| Consultor | Claude Code | Fable (uso puntual) | Decisiones difíciles: esquema de datos, depuración que se resiste, revisión final de una rebanada de riesgo alto. |

## Riesgo de una rebanada

Lo asigna el orquestador al refinar y queda escrito en el archivo de la rebanada.

| Riesgo | Ejemplos | Implementa | Revisa |
|---|---|---|---|
| Bajo | Textos, estilos, ajustes de interfaz, CRUD que copia un patrón existente | opencode | Claude (Sonnet) |
| Medio | Lógica nueva en store o controladores, filtros, diálogos con validación | opencode (tras 2 fallos pasa a Claude) | Claude (Sonnet) |
| Alto | Autenticación, roles y permisos, migraciones o esquema, fechas, datos de producción | Claude (Sonnet) | opencode y después revisión final del orquestador |

Siempre en opencode: explorar, correr puertas, limpiar datos de prueba y redactar documentación. Siempre en Claude: refinar con el usuario, decidir, MEMORY.md y commits.

## Ciclo de una rebanada

1. **Refinar** (orquestador + usuario): criterios de aceptación, archivos autorizados y riesgo. Se crea `docs/rebanadas/NN-nombre.md` desde `docs/rebanadas/00-plantilla.md`.
2. **Implementar**: el implementer lee el archivo de la rebanada y responde con su reporte; el orquestador lo copia al final del archivo.
3. **Revisar**: el reviewer lee el archivo y el diff, y responde con su veredicto (no puede editar); el orquestador lo copia al archivo. No recibe la opinión del orquestador.
4. **Corregir**: con «CAMBIOS NECESARIOS» vuelve al implementer. Máximo 2 vueltas; después decide el usuario.
5. **Cerrar** (orquestador): verificación en navegador, MEMORY.md y propuesta de commit. El push solo con permiso del usuario.

## Reglas de convivencia

- Por turnos: nunca trabajan las dos herramientas a la vez sobre el mismo checkout.
- En paralelo solo trabajo de lectura (explorar, evaluar, revisar con enfoques distintos).
- Implementar, migrar la base, MEMORY.md y commits van siempre en serie.
- Solo el orquestador edita MEMORY.md; los demás lo reportan en «Para la memoria».

## Lanzar opencode desde Claude Code

```bash
opencode run --agent implementer --auto --title "NN-nombre" "Implementa la rebanada de docs/rebanadas/NN-nombre.md"
```

```bash
opencode run --agent reviewer --auto --title "NN-nombre-revision" "Revisa la rebanada de docs/rebanadas/NN-nombre.md"
```

`--auto` aprueba los permisos que el agente no tiene prohibidos (el reviewer tiene prohibido editar). Con `-m <proveedor/modelo>` se cambia el modelo si el del agente llegó a su límite.

## Modelos gratuitos de respaldo (opencode)

Prueba del 2026-11-10: leer `docs/constitution.md` con una herramienta y contestar cuántos principios tiene. Solo comprueba que el modelo responde y usa herramientas; aún no mide calidad para programar.

**Límites:** los `opencode/*` son de OpenCode Zen y no comparten el tope diario de OpenRouter. La mayoría de los `openrouter/*:free` comparten un solo tope diario («free-models-per-day»); cuando se agota, caen todos juntos.

**Si el modelo de un agente da límite, cambiar en este orden** (con `-m`):

1. La misma familia en OpenCode Zen, si existe: `openrouter/nvidia/nemotron-3.5-super-vl:free` → `opencode/nemotron-3.5-super-vl-free`; igual con `nemotron-3.5-lightning`, `inkling-2-small` y `flint`.
2. `opencode/deepseek-v4.1-flash-free` (lento, ~30 s, pero respondió bien).
3. `opencode/glm-5.3-flash-free`, `opencode/minimax-m3.1-flash-free`, `opencode/longcat-2.5-free`.
4. OpenRouter que funcionaron con el tope agotado: `openrouter/openrouter/free` (elige modelo solo), `openrouter/thinkingmachines/inkling-2-small:free`, `openrouter/xingchen-agi/xing4.0-29b-a4b:free`.

| Resultado | Modelos |
|---|---|
| Respondieron bien (2-8 s) | `opencode/beam-free`, `flint-40b-free`, `glm-5.3-flash-free`, `iceman-free`, `inkling-2-small-free`, `longcat-2.5-free`, `minimax-m3.1-flash-free`, `nemotron-3.5-lightning-free`, `nemotron-3.5-super-vl-free`; `openrouter/openrouter/free`, `openrouter/thinkingmachines/inkling-2-small:free` |
| Respondieron bien, lentos | `opencode/deepseek-v4.1-flash-free` (31 s), `openrouter/xingchen-agi/xing4.0-29b-a4b:free` (51 s) |
| Se colgó (150 s) | `opencode/mimo-v2.6-flash-free` |
| Tope diario agotado (por probar otro día) | `openrouter/cohere/north-mini-code`, `google/gemma-4-26b-a4b-it`, `google/gemma-4-31b-it`, `liquid/lfm-2.5-2.6b`, `liquid/lfm-3-1.7b`, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`, `nvidia/nemotron-3-ultra-550b-a55b`, `nvidia/nemotron-3.5-lightning`, `nvidia/nemotron-3.5-super-vl`, `recursive/flint-v1.0` (todos `:free`) |

Pendiente: segunda ronda con una tarea real (escribir una prueba en rojo) para decidir qué modelos sirven de implementer y cuáles solo para tareas sencillas.
