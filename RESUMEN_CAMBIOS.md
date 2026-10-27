# Resumen de cambios — DelGrow Estado Contadores

Fecha: 27 de octubre de 2026

## 1. Bienvenida AdminDashboardPage.vue — colores a paleta `$dg-colores`

**Archivo:** `Seguimiento-proyectos/src/pages/AdminDashboardPage.vue`

Se reemplazaron 3 valores hexadecimales sueltos en el `<style scoped>` por variables CSS de la paleta `$dg-colores`, cumpliendo el estándar de AGENTS.md (línea 97: "nunca un hexadecimal suelto en un componente").

| Línea | Elemento | Antes | Después | Paleta |
|-------|----------|-------|---------|--------|
| 358 | `.dashboard-page__title` | `color: #102a43;` | `color: var(--dg-texto);` | `texto` |
| 366 | `.dashboard-page__lead` | `color: #486581;` | `color: var(--dg-texto-tenue);` | `texto-tenue` |
| 378 | `.dashboard-page__directory-btn:focus-visible` | `outline: 3px solid #0b5cad !important;` | `outline: 3px solid var(--dg-foco) !important;` | `foco` |

**No se modificaron:** estructura del template, tipografías, márgenes, bordes, iconos ni tooltips.

**Commit:** `7bc308a` (push a `origin/main`)

## 2. ResumenEquipo.vue y DonaEstados.vue — tarjetas KPI y gráfica en una sola fila horizontal

**Archivos:**
- `Seguimiento-proyectos/src/components/ResumenEquipo.vue`
- `Seguimiento-proyectos/src/components/DonaEstados.vue`

Se corrigió el colapso vertical de las tarjetas KPI provocado por el contenedor previo, unificando las 3 tarjetas de indicadores y la gráfica en una sola fila compacta y armónica en pantallas de escritorio.

### Cambios realizados:

1. **`ResumenEquipo.vue`:**
   - **Template:** Se retiró el contenedor envolvente `<div class="resumen-equipo__tarjetas-contenedor">` para evitar el colapso vertical del grid.
   - **Contenedor principal (`.resumen-equipo__contenido`):** Se definió en flex horizontal (`flex-wrap: nowrap; align-items: stretch; gap: 12px;`) para que las tarjetas y la dona compartan una sola línea en pantallas grandes/medianas (con `@media (max-width: 960px)` para adaptación fluida en pantallas pequeñas).
   - **Grid de tarjetas (`.resumen-equipo__tarjetas`):** Configurado con `grid-template-columns: repeat(3, minmax(0, 1fr))` para que las 3 tarjetas KPI se mantengan fijas en 3 columnas horizontales de ancho equilibrado.
   - **Dona (`.dona-estados`):** Asignado `flex: 1.3 1 300px` para alinearse al lado de los KPIs con la misma altura de fila.

2. **`DonaEstados.vue`:**
   - Gráfica SVG compactada a `90px × 90px` y `.dona-estados__cuerpo` con `flex-wrap: nowrap`, manteniendo el gráfico y la leyenda lado a lado.
   - Alineación vertical centrada (`justify-content: center`), garantizando que la altura de la tarjeta de la dona coincida naturalmente con la altura de las tarjetas KPI (~130 px), eliminando espacios vacíos en blanco.

**Resultado:**
- En escritorio (≥ 960px): Todas las cards (KPIs + gráfica) ocupan una sola fila horizontal compacta y legible de un vistazo.
- Los paneles principales de la página («Contadores del equipo» y «Detalle de casos») quedan visibles de inmediato sin requerir scroll innecesario.
- En móvil y pantallas estrechas: Se adaptan responsivamente sin desbordes.

## Verificación

- `node --test` (frontend): 524 de 527 pruebas pasando (las 3 fallas preexistentes corresponden al «Volver» de `MaquetaLayout.vue`).
- `quasar build`: compilación exitosa sin errores de build.

## MEMORY.md

Actualizado con la entrada de los cambios de colores en `AdminDashboardPage.vue`.

---

**Estado:** Todos los cambios implementados, verificados y pushed a `origin/main`.