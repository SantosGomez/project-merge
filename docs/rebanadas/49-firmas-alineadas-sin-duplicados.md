# 49 — Firmas alineadas y sin duplicados en Recepción

- **Riesgo:** medio (lógica del formulario de Recepción y del lienzo de firma)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`)
- **Estado:** refinada

## Historia

Como recepcionista, quiero que la firma aparezca justo donde el cliente pone el dedo y que, después de registrar una entrega, el formulario quede listo para la siguiente sin arrastrar datos ni permitir registrar dos veces lo mismo.

## Problema (revisión UI/UX del 2026-11-25, comprobado en navegador)

1. **Firma desalineada:** a 375 px el lienzo dibuja con un ancho interno de 322 px y se muestra a 293 px; el trazo queda ~10 % desplazado del dedo. El tamaño se toma una sola vez en `onMounted` (mientras `SeccionAnimada` aún mueve la página), no usa `devicePixelRatio` (la firma sale borrosa en el acuse) y el lienzo se inicializa dos veces (dos `onMounted` en `IndexPage.vue`). Con ratón y táctil por separado, el trazo se corta al salir del borde y un toque no deja punto.
2. **Duplicados:** si un adjunto pasa de 25 MB, `onSubmit` registra el documento pero **no** limpia el formulario (`if (archivosRechazados.length === 0) resetForm()`); otro clic en «Registrar» crea otro folio.
3. **Datos arrastrados:** `resetForm` no limpia `observaciones`, así que pasan a la siguiente entrega.
4. Los botones «Limpiar» de cada firma miden 23 px (mínimo táctil 44 px).

## Decisión del usuario (2026-11-25)

- Tras registrar con éxito se **conservan** empresa, cliente, tipo de documento, periodo, prioridad y vía de entrega (el mismo cliente suele entregar varios documentos). Se **limpian** asunto, departamento, contador asignado, observaciones, archivos y ambas firmas.
- Aprobado el archivo nuevo `composables/lienzoFirma.js` con su prueba.

## Criterios de aceptación

1. `composables/lienzoFirma.js` (lógica pura, sin DOM real):
   - `medidasDelLienzo({ anchoCss, altoCss, dpr })` → `{ ancho, alto, escala }` en píxeles internos (`Math.round(css × dpr)`; `dpr` inválido o ausente cuenta como 1).
   - `posicionEnLienzo(rect, evento)` → `{ x, y }` en coordenadas CSS relativas al lienzo (con `clientX/clientY` del evento de puntero).
2. `IndexPage.vue`:
   - Un solo punto de inicialización de los lienzos (se elimina el `onMounted` duplicado).
   - Cada lienzo se mide con `ResizeObserver`; al cambiar de tamaño se ajustan `width/height` internos con `medidasDelLienzo`, se aplica `ctx.setTransform(escala, 0, 0, escala, 0, 0)` y se repinta el trazo que hubiera (no se pierde la firma al girar o redimensionar). Los observadores se desconectan en `onBeforeUnmount`.
   - Eventos `pointerdown/pointermove/pointerup/pointercancel` con `setPointerCapture`; un toque sin movimiento deja un punto visible. `touch-action: none` se conserva.
   - La tinta sigue tomándose de `--q-primary` (sin hexadecimales nuevos).
   - La firma enviada y la del acuse siguen saliendo de `toDataURL()` leído **antes** de armar el payload (no romper ese orden).
   - Los botones «Limpiar» de las firmas miden al menos 44 px de alto (`.control-touch` o equivalente existente).
3. Registro:
   - Tras una respuesta con folio, el formulario se limpia **siempre**, haya o no adjuntos descartados por tamaño; el aviso de descartados se conserva tal cual.
   - `resetForm` limpia también `observaciones` y conserva empresa, cliente, tipo, periodo, prioridad y vía.
   - Si la API falla, el formulario **no** se limpia (comportamiento actual).
4. Pruebas: unidad de `lienzoFirma.js` y pruebas de texto/estructura de `IndexPage.vue` siguiendo el estilo de `IndexPage.*.test.js` (un solo `onMounted` de lienzos, eventos `pointer`, `ResizeObserver`, limpieza incondicional tras éxito, `observaciones` en `resetForm`). Cada prueba nueva debe fallar sin el cambio.
5. Navegador (lo hace el orquestador): firma a 375 px y en escritorio, trazo bajo el dedo/puntero, firma nítida en el acuse, registro con limpieza correcta.

## Archivos autorizados

- `Seguimiento-proyectos/src/modulos/documentos/composables/lienzoFirma.js` (nuevo) y `lienzoFirma.test.js` (nuevo)
- `Seguimiento-proyectos/src/modulos/documentos/pages/IndexPage.vue`
- `Seguimiento-proyectos/src/modulos/documentos/pages/IndexPage.firmas.test.js` (nuevo) y, si alguna prueba existente de `IndexPage.*.test.js` choca con el cambio, ajustarla explicando por qué

Fuera de esta lista, el implementer para y pregunta. Sin cambios de backend.

## Notas del orquestador

- Leer `.claude/skills/impeccable/reference/craft-floor.md` antes de editar.
- No cambiar el orden de lectura de los lienzos ni `acuseData` (ver «Errores a evitar» de `MEMORY.md`).
- No tocar `SeccionAnimada`, textos, orden de secciones ni otros hallazgos de la revisión: van en otras rebanadas.

---

## Reporte del implementer

1. Rebanada completada: lienzos de firma de Recepción medidos con `ResizeObserver` y `devicePixelRatio`, eventos pointer con captura, punto con un toque, repintado al redimensionar, un solo `onMounted` de lienzos, botones «Limpiar» con `control-touch`; limpieza incondicional del formulario tras registrar y `observaciones` en `resetForm`.
2. Archivos modificados: `composables/lienzoFirma.js` y `lienzoFirma.test.js` (nuevos), `pages/IndexPage.vue`, `pages/IndexPage.firmas.test.js` (nuevo). Ninguna prueba existente tuvo que ajustarse.
3. Prueba en rojo y por qué falló: `lienzoFirma.test.js` falló por módulo inexistente (ERR_MODULE_NOT_FOUND). `IndexPage.firmas.test.js` falló 8 de 9 aserciones antes del cambio (doble `getContext`, sin `ResizeObserver`, sin `medidasDelLienzo`/`devicePixelRatio`/`setTransform`, eventos mouse/touch en vez de pointer, sin `arc`, «Limpiar» sin `control-touch`, `resetForm()` condicionado a `archivosRechazados.length === 0`, sin `form.observaciones = ''`). La novena (tinta `--q-primary` y `toDataURL()` antes del payload) pasa antes y después: es guardia de no regresión.
4. Puertas: `npm run lint:check` verde; `npx prettier --check` verde en los 4 archivos tocados (en `src/modulos/documentos` completo avisa `logica/estadosDocumento.js` y `logica/normalizar.js`, que no toqué); `npm run build` verde; `node --test` 2188 pruebas, 2188 pasan, 0 fallan. Navegador: lo hace el orquestador.

## Revisión y navegador (orquestador, 2026-11-25)

- `reviewer` (opus): **aprobada**, sin hallazgos bloqueantes; confirmó que 8 de 9 pruebas de fuente y `lienzoFirma.test.js` fallan sin el cambio, y que el acuse muestra la firma de mayor resolución sin deformarla (`object-fit: contain`; `/doc` acepta 2 MB).
- Navegador con `admin_seed` en 9001: a 375 px el lienzo mide 586×240 internos para 293×120 CSS (`devicePixelRatio` 2); un trazo arrastrado deja tinta en inicio, medio y fin bajo el puntero y nada fuera; un toque deja punto; al pasar a 1280 px el lienzo se remide (428 px) y la firma se conserva. Botones «Limpiar» de firma: 44 px. No se registró un documento en el navegador (crearía datos y archivos en la carpeta de clientes); la limpieza tras registrar queda cubierta por pruebas.

## Opcionales (no aplicados)

1. Multitáctil: con dos dedos el segundo `pointerdown` reemplaza el trazo y la línea salta entre dedos. Arreglo: `if (!e.isPrimary) return` en `empezar`.
2. Al reducir el lienzo (girar a vertical), la parte del trazo fuera del nuevo ancho no se ve (reaparece si crece). Escalar la firma sería otra decisión de diseño.
3. Usar `contentRect` del `ResizeObserver` en vez de `clientWidth` (diferencia ≤0,5 px).
4. La prueba de fuente de `repintar` solo comprueba el nombre, no que ocurra al redimensionar.
