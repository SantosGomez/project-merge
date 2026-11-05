# Product

<!-- impeccable:product-schema 1 -->

<!-- Los encabezados van en inglés porque la herramienta de la skill impeccable los lee por nombre; el contenido va en español. -->

## Platform

web

## Users

- **Contador** (usuario principal): trabaja en la oficina, en escritorio, durante toda la jornada. Registra y actualiza el estado de sus casos («Mis casos»), consulta «Mi resumen» y da seguimiento a las auditorías que tiene asignadas (bitácora de oficios, requerimientos y actas). El celular es un uso secundario.
- **Administrador**: coordina al equipo de contadores. Revisa la carga de cada contador y los casos urgentes en el dashboard, cambia prioridades, registra auditorías y las asigna.
- **Usuario de sistema**: solo administra cuentas (alta y restablecimiento de contraseña) desde el directorio de usuarios; no ve casos ni auditorías.

## Product Purpose

Herramienta interna de Grupo DelGrow S.C. para saber el estado de urgencia del trabajo de los contadores en casos y clientes importantes, y para dar seguimiento a las auditorías (SAT y estatales).

La app funciona bien cuando:

1. **No se vence ningún plazo**: ningún caso ni plazo de auditoría pasa de su fecha de vencimiento sin que alguien lo vea venir.
2. **La carga del equipo se ve de un vistazo**: el administrador sabe qué contador está saturado y qué es urgente sin preguntar uno por uno.

## Operating Context

- Uso diario en escritorio dentro de la oficina; también como PWA en el celular y como aplicación de escritorio para Windows (.exe con Electron).
- Publicada en Docker; acceso remoto por túnel de Cloudflare.
- Avisos en tiempo real (Server-Sent Events) cuando cambian casos y auditorías.
- La ficha de auditoría se imprime o se guarda como PDF con la bitácora completa.
- Fechas en formato `DD-MM-AAAA` en pantalla, siempre en hora local.

## Capabilities and Constraints

- Roles: `administrador`, `contador`, `usuarios_de_sistema`; cada uno ve solo las secciones de su rol.
- Casos: cliente, estado (Pendiente / En proceso / Finalizado), prioridad, fecha de inicio, fecha de vencimiento (la captura el contador y no depende de la prioridad), descripción, observaciones y marca de «Importante».
- Auditorías: datos generales, contadores asignados, bitácora por fases (6 fases) y semáforo calculado (Vencido, Crítico, En atención, En tiempo, Concluida).
- Frontend en Vue 3 con Quasar v2; backend Express con MariaDB.
- Reglas de trabajo y de dominio en `AGENTS.md` y `docs/constitution.md`: no se agregan campos a formularios que no existan en las tablas, y los cambios se aprueban antes de aplicarse.

## Brand Commitments

- La app se llama «Seguimiento de Proyectos» y comparte la identidad de las demás apps de Grupo DelGrow S.C.: menú lateral oscuro de altura completa con logo, nombre de la empresa y de la app, secciones por rol y usuario con cierre de sesión al pie.
- Todos los textos de la interfaz en español, sin ambigüedad, con tooltips para dar contexto.
- Componentes de Quasar en todas las vistas; colores solo desde la paleta `$dg-colores` (`src/css/quasar.variables.scss`).
- Logos en `Seguimiento-proyectos/public/logos/`.

## Evidence on Hand

- Cuentas reales de contadores (16) en la base; para pruebas se usan cuentas `zz_test_*` que se borran al terminar.
- No hay testimonios, métricas de uso ni capturas de referencia; no se deben inventar.

## Product Principles

1. **Lo urgente se ve primero**: vencimientos, semáforos y prioridades deben destacar sin que el usuario los busque.
2. **El color nunca es el único indicador**: cada estado de color lleva también su texto.
3. **Precisión sobre expresión**: es una herramienta de trabajo diario; la claridad, la consistencia y la velocidad pesan más que la decoración.
4. **Nada se pierde**: lo escrito se conserva si algo falla, y las fechas no se desplazan.

## Accessibility & Inclusion

Estándar WCAG AA: contraste suficiente (los pares de texto y fondo se prueban en `test/paletaColores.test.js`), navegación completa con teclado, foco visible y nombres accesibles en los controles. Áreas táctiles de al menos 44 px.
