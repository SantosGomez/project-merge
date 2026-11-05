---
name: Seguimiento de Proyectos
description: Estado de urgencia de casos y auditorías de los contadores de Grupo DelGrow S.C.
colors:
  primary: "#111e30"
  secondary: "#5abbf1"
  texto: "#102a43"
  texto-secundario: "#334e68"
  texto-tenue: "#486581"
  acento: "#1f5f99"
  foco: "#0b5cad"
  superficie: "#ffffff"
  fondo-panel: "#f7f9fc"
  fondo-suave: "#f5f8fb"
  fondo-hover: "#f0f6fc"
  fondo-seleccion: "#e6f0fb"
  borde: "#dbe4ee"
  borde-fuerte: "#c9d4e0"
  error: "#a3231b"
  error-fondo: "#fdecea"
  exito: "#1b5e20"
  exito-fondo: "#e6f4ea"
  importante: "#b45309"
  importante-fondo: "#fff4d6"
  estado-pendiente: "#b45309"
  estado-en-proceso: "#1f5f99"
  estado-finalizado: "#2f855a"
  prioridad-alta: "#b71c1c"
  prioridad-media: "#8a5800"
  prioridad-baja: "#1b5e20"
  texto-claro: "#ffffff"
typography:
  title:
    fontFamily: "Matter, Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
  headline:
    fontFamily: "Matter, Roboto, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 600
  body:
    fontFamily: "Matter, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  body-small:
    fontFamily: "Matter, Roboto, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
  label:
    fontFamily: "Matter, Roboto, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 500
rounded:
  sm: "4px"
  md: "8px"
  field: "10px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.texto-claro}"
    rounded: "{rounded.sm}"
    height: "44px"
  button-flat-acento:
    textColor: "{colors.acento}"
    height: "44px"
  input-moderno:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.field}"
  menu-seleccion:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.lg}"
    padding: "6px"
  chip-estado:
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  nav-lateral:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.texto-claro}"
    width: "250px"
---

# Design System: Seguimiento de Proyectos

<!-- Documento generado con la skill impeccable (document, modo scan) a partir del código del 2026-11-05. Los encabezados van en inglés porque la herramienta los lee por nombre. -->

## Overview

**Creative North Star: "El expediente ordenado"**

Como un buen archivo contable: limpio, metódico y confiable, con cada dato en su lugar. La app es una herramienta de trabajo diario en escritorio, así que la densidad es media y la jerarquía la marcan el peso del texto, el orden y el color de estado, no la decoración. Lo urgente (vencidos, críticos, prioridad alta, «Importante») es lo único que levanta la voz; todo lo demás se mantiene en azules marino y grises fríos.

El marco es el de las apps de Grupo DelGrow S.C.: menú lateral oscuro de altura completa con logo, nombre de la empresa y de la app, y el contenido sobre superficies blancas y fondos de panel muy claros. Los componentes son modernos y suaves: esquinas redondeadas, sombras difusas de poca opacidad y transiciones breves que confirman cada acción sin llamar la atención.

**Key Characteristics:**
- Marco oscuro (menú lateral `primary`) con contenido claro.
- Color de estado con significado fijo, siempre acompañado de texto.
- Campos y selectores redondeados (10 px) con anillo de foco suave.
- Sombras difusas en azul marino a baja opacidad; nunca negras.
- Todo en español, con tooltips en cada acción.

## Colors

Azules marino y grises fríos de base; el color cálido o saturado se reserva para estados y urgencias.

### Primary
- **Azul Marino Despacho** (`primary`): el menú lateral, la barra móvil y los botones principales (`color="primary"`). Es la identidad DelGrow.
- **Azul Acento** (`acento`): botones planos secundarios («Ver ficha», «Mensajes», «Imprimir»), enlaces e iconos de acción.
- **Azul Foco** (`foco`): anillo de foco y selección; ayuda a la navegación con teclado.

### Secondary
- **Celeste DelGrow** (`secondary`): detalles de marca dentro del menú lateral oscuro: avatar del usuario, franja izquierda del elemento activo, anillo de foco y textos destacados del menú. No se usa como color de texto sobre fondos claros.

### Neutral
- **Tinta** (`texto`): texto principal y títulos.
- **Tinta Media** (`texto-secundario`) y **Tinta Tenue** (`texto-tenue`): textos de apoyo, ayudas y fechas.
- **Papel** (`superficie`): tarjetas, diálogos, menús flotantes.
- **Fondo de Panel** (`fondo-panel`), **Fondo Suave** (`fondo-suave`): fondos de página y de zonas agrupadas.
- **Hover** (`fondo-hover`) y **Selección** (`fondo-seleccion`): respuesta al pasar el cursor y elemento elegido.
- **Borde** (`borde`) y **Borde Firme** (`borde-fuerte`): divisores y contornos de tarjetas y etiquetas.

### Semánticos (estados)
- **Estados del caso**: Pendiente (`estado-pendiente`, ámbar), En proceso (`estado-en-proceso`, azul), Finalizado (`estado-finalizado`, verde).
- **Prioridad**: Alta (`prioridad-alta`), Media (`prioridad-media`), Baja (`prioridad-baja`), cada una con su fondo y borde en la paleta.
- **Semáforo de auditorías**: Vencido, Crítico, En atención, En tiempo, Concluida (clases `.semaforo--*` en `app.scss`).
- **Importante** (`importante`, `importante-fondo`): marca del contador para casos que requieren seguimiento especial.
- **Error** y **Éxito** (`error`, `exito` y sus fondos): avisos y validaciones.

### Named Rules
**La Regla del Paleta Única.** Ningún componente usa un hexadecimal suelto: todo color sale de `$dg-colores` (`color="dg-…"`, `text-dg-*`, `bg-dg-*` o `var(--dg-*)`). Un color nuevo entra a la paleta y, si es texto sobre fondo, a `test/paletaColores.test.js`.

**La Regla del Color con Nombre.** El color nunca es el único indicador: cada estado de color lleva su texto («Finalizado», «Vencido», «Alta»).

**La Regla de la Voz Urgente.** Solo lo urgente levanta la voz. Si todo destaca, nada destaca.

## Typography

**Body Font:** Matter (con Roboto y sans-serif de respaldo)
**Display Font:** Monument Extended está cargada pero no se usa en las pantallas actuales.

**Character:** Una sola familia sans-serif geométrica y limpia, que se lee bien en tablas y listas densas; la jerarquía sale del peso (400 a 700) y del tamaño, no de cambiar de familia.

### Hierarchy
- **Title** (600, 1.5rem): título de página en escritorio (`page-header__title`).
- **Headline** (600, 1.1–1.2rem): títulos de tarjetas, paneles y diálogos.
- **Body** (400, 1rem): nombres de cliente y texto principal.
- **Body Small** (400, 0.9–0.95rem): descripciones y contenido secundario.
- **Label** (500–600, 0.75–0.85rem): fechas, etiquetas de estado, chips, ayudas y contadores.

### Named Rules
**La Regla de la Familia Única.** Matter para todo. La jerarquía se construye con peso y tamaño.

## Layout

- **Escritorio** (principal): menú lateral de 250 px que puede quedar compacto (96 px, solo iconos) y desplegarse al pasar el cursor, o fijarse abierto. Sin barra superior; el título va en el encabezado de la página.
- **Celular**: barra superior delgada (56 px como máximo) con menú y título, y el menú como cajón. Las acciones principales bajan a su propia línea y los selectores ocupan todo el ancho por debajo de 600 px.
- **Puntos de corte** de Quasar: 600 px (sm), 1024 px (md); la tabla de auditorías aparece desde 1024 px y por debajo se usan tarjetas.
- **Ritmo** de 4 px: separaciones habituales de 8, 12, 16 y 24 px.
- **Áreas táctiles** de al menos 44 px (`control-touch`).

## Elevation & Depth

Profundidad con sombras suaves y difusas en azul marino a baja opacidad, apoyadas por bordes sutiles. Las superficies en reposo apenas se separan del fondo; la sombra crece con la interacción (hover) y en lo que flota.

### Shadow Vocabulary
- **Reposo de campo** (`box-shadow: 0 1px 2px rgba(16, 42, 67, 0.04)`): campos y selectores en reposo.
- **Hover de campo** (`box-shadow: 0 2px 6px rgba(16, 42, 67, 0.08)`): al pasar el cursor.
- **Anillo de foco** (`box-shadow: 0 0 0 3px rgba(11, 92, 173, 0.12)`): campo enfocado.
- **Menú flotante** (`box-shadow: 0 4px 16px rgba(16, 42, 67, 0.10), 0 1px 4px rgba(16, 42, 67, 0.06)`): menús de selección.
- **Panel elevado** (`box-shadow: 0 12px 32px rgb(16 42 67 / 12%)`): tarjetas o paneles que se separan claramente del fondo.
- **Barra de estado** (`box-shadow: inset 5px 0 0 var(--semaforo-color)`): franja lateral del semáforo en tarjetas de auditoría.

### Named Rules
**La Regla de la Sombra Marina.** Las sombras usan el azul de la tinta (`rgba(16, 42, 67, …)`), nunca negro puro, y no pasan de 12 % de opacidad.

## Shapes

Esquinas suaves y consistentes: 4 px en botones y elementos pequeños, 8 px en tarjetas, avisos y opciones de menú, 10 px en campos y selectores, 12 px en menús flotantes y 16 px en paneles grandes. Las etiquetas de estado y los contadores son píldoras (999 px). Los puntos de estado son círculos de 8 y 10 px. Las tarjetas de caso y de auditoría marcan su estado con un borde o franja izquierda de 4–5 px.

## Components

### Buttons
- **Shape:** esquinas de 4 px (Quasar por defecto), alto táctil de 44 px.
- **Primary:** fondo `primary`, texto blanco, sin mayúsculas (`no-caps`), con icono a la izquierda.
- **Flat / Outline:** acciones secundarias en `acento` o `primary` con contorno («Editar»).
- **FAB:** acción principal del celular, abajo a la derecha (registrar auditoría).
- **Focus:** contorno de 2 px en `currentColor`.

### Chips y etiquetas
- **Estado y semáforo:** píldoras con fondo claro, texto y borde del color del estado (`.semaforo-etiqueta`, `PriorityTag`).
- **Filtros:** `q-chip` seleccionable; activo en `primary` con texto blanco, inactivo con contorno gris.

### Cards / Containers
- **Corner Style:** 8 px.
- **Background:** `superficie` sobre `fondo-panel`.
- **Shadow Strategy:** ver Elevation & Depth; borde `borde` como apoyo (`flat bordered`).
- **Border:** franja izquierda de color para estados (Importante en ámbar, Finalizado en verde, semáforo en auditorías).
- **Internal Padding:** 12–16 px.

### Inputs / Fields
- **Style:** `outlined dense`, fondo blanco, esquinas de 10 px, borde sutil y sombra de reposo (`input-moderno`, `selector-moderno`).
- **Focus:** anillo azul suave de 3 px; el chevron del selector gira con una transición breve.
- **Selectores:** icono semántico a la izquierda, valor en peso medio, punto de color si es estado o prioridad, y menú flotante redondeado con marca de selección.
- **Error:** mensaje bajo el campo en `error-campo`, con qué ocurrió, sobre qué dato y qué hacer.

### Navigation
- **Menú lateral oscuro** de altura completa con logo, «Grupo DelGrow S.C.» y «Seguimiento de Proyectos»; secciones por rol; elemento activo con fondo blanco al 10 % y franja izquierda celeste de 3 px; foco en celeste; usuario (iniciales, nombre y rol) y cierre de sesión al pie.
- **Celular:** barra superior delgada con botón de menú y título recortado con «…».

### Lista de casos (CasoItem)
Fila con nombre del cliente, etiqueta de prioridad, fechas e indicadores; borde izquierdo ámbar si es «Importante» y verde si está Finalizado (el verde gana).

## Do's and Don'ts

### Do:
- **Do** sacar todo color de `$dg-colores` y acompañar cada color de estado con su texto.
- **Do** usar componentes de Quasar en todas las vistas; HTML nativo solo cuando Quasar no tiene equivalente (la excepción acordada es el SVG de la dona «Casos por estado»).
- **Do** usar el patrón `selector-moderno` / `input-moderno` en campos y selectores nuevos.
- **Do** poner tooltip en cada acción y textos en español sin ambigüedad.
- **Do** mantener áreas táctiles de al menos 44 px y foco visible.

### Don't:
- **Don't** escribir un hexadecimal suelto en un componente.
- **Don't** usar sombras negras ni de más de 12 % de opacidad.
- **Don't** usar el color como único indicador de un estado.
- **Don't** agregar una segunda familia tipográfica a las pantallas de trabajo.
