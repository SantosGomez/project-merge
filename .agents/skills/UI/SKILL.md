---
name: ui
description: Asistente de UI/UX para sugerir, buscar y adaptar componentes visuales de Uiverse.io a Quasar Framework.
---

# Habilidad UI / Uiverse -> Quasar

Cuando el usuario ejecute esta skill o solicite un componente visual:

1. **Analizar la necesidad:** Identifica el componente que se requiere en la vista (botón, input de búsqueda, loader, un card, modal, etc.).
2. **Consultar Uiverse.io:** Revisa estilos, animaciones y efectos modernos inspirados en [uiverse.io](https://uiverse.io) y crea un componente reutilizable y que tenga que ver con el Proyecto-documentos.
3. **Adaptación a Quasar/Vue 3:**
   - Convierte el HTML/CSS puro de Uiverse a un componente reutilizable de Vue 3 (`<script setup>`).
   - Usa `<style scoped>` o variables CSS/Sass de Quasar (`var(--q-primary)`, etc.) para mantener la identidad visual del proyecto.
   - Si se requiere comportamiento de Quasar (ej. `QBtn`, `QInput`), envuelve o extiende las clases sin romper la accesibilidad.
4. **Respuesta:** Muestra primero una vista previa/explicación del diseño y luego propone el código listo para insertar en la vista correspondiente.
