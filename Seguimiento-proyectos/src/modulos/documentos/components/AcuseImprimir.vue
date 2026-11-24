<template>
  <q-btn
    icon="print"
    label="Imprimir Acuse"
    color="primary"
    aria-label="Imprimir acuse digital de recepción"
    :loading="generando"
    :disable="generando"
    @click="imprimirPdf"
  />

  <!--
    Zona imprimible: se construye a partir de `acuseData` y se convierte en PDF
    con html2pdf.js. Vive fuera de pantalla (`left: -10000px`) pero **no** con
    `display: none`, porque html2canvas necesita que el elemento tenga tamaño
    real para dibujarlo.
  -->
  <Teleport to="body">
    <!--
      Zona imprimible teleported al body para evitar que cualquier `overflow`
      o transformación del `q-dialog` recorte el elemento al capturarlo con
      html2canvas.
    -->
    <div class="zona-impresion" aria-hidden="true">
      <div ref="paginaAcuse" class="pagina-acuse">
        <!-- Encabezado institucional -->
        <header class="encabezado-acuse">
          <h1 class="titulo-monument">Acuse Digital de Recepción</h1>
          <p class="subtitulo">Grupo DCA — Recepción de Documentación</p>
        </header>

        <!-- Banda del folio y la fecha de recepción -->
        <section class="banda-folio">
          <div class="bloque-folio">
            <span class="etiqueta">Folio de Acuse:</span>
            <strong class="valor-folio">{{ acuseData.folio || '—' }}</strong>
          </div>
          <div class="bloque-fecha">
            <span class="etiqueta">Fecha y Hora:</span>
            <strong class="valor-fecha">{{ formatearFechaHora(acuseData.fechaRecepcion) }}</strong>
          </div>
        </section>

        <!-- Datos del documento -->
        <section class="datos-acuse">
          <div class="fila-dato">
            <span class="label-dato">Empresa:</span>
            <span class="valor-dato">{{ acuseData.empresa || '—' }}</span>
          </div>
          <div class="fila-dato">
            <span class="label-dato">Cliente:</span>
            <span class="valor-dato">{{ acuseData.cliente || '—' }}</span>
          </div>
          <div class="fila-dato">
            <span class="label-dato">Asunto:</span>
            <span class="valor-dato">{{ acuseData.asunto || '—' }}</span>
          </div>
          <div class="fila-dato">
            <span class="label-dato">Departamento:</span>
            <span class="valor-dato">{{ acuseData.departamento || '—' }}</span>
          </div>
          <div class="fila-dato">
            <span class="label-dato">Prioridad:</span>
            <span class="valor-dato">{{ acuseData.prioridad || '—' }}</span>
          </div>
          <div class="fila-dato">
            <span class="label-dato">Vía de Entrega:</span>
            <span class="valor-dato">{{ acuseData.viaEntrega || '—' }}</span>
          </div>
          <div class="fila-dato">
            <span class="label-dato">SLA (Fecha Límite):</span>
            <span class="valor-dato">{{ formatearFecha(acuseData.fechaLimite) }}</span>
          </div>
          <div class="fila-dato">
            <span class="label-dato">Periodo:</span>
            <span class="valor-dato">{{ acuseData.periodo || '—' }}</span>
          </div>
          <div class="fila-dato">
            <span class="label-dato">Archivos:</span>
            <span class="valor-dato">
              {{
                acuseData.archivos === undefined || acuseData.archivos === null
                  ? '—'
                  : acuseData.archivos + ' archivo(s)'
              }}
            </span>
          </div>
        </section>

        <!-- Firmas registradas -->
        <section class="seccion-firmas">
          <h2 class="titulo-firmas">Firmas Registradas de Conformidad</h2>
          <div class="bloques-firmas">
            <div class="bloque-firma">
              <div class="marco-firma">
                <img
                  v-if="acuseData.firmaClienteUrl"
                  :src="acuseData.firmaClienteUrl"
                  alt="Firma del cliente registrada"
                  class="imagen-firma"
                />
                <div v-else class="sin-firma">Sin firma dibujada</div>
              </div>
              <div class="pie-firma">
                <strong>Firma de Entregado</strong><br />
                <span>{{ acuseData.cliente || 'Cliente' }}</span>
              </div>
            </div>
            <div class="bloque-firma">
              <div class="marco-firma">
                <img
                  v-if="acuseData.firmaRecepcionUrl"
                  :src="acuseData.firmaRecepcionUrl"
                  alt="Firma del usuario recepcionista registrada"
                  class="imagen-firma"
                />
                <div v-else class="sin-firma">Sin firma dibujada</div>
              </div>
              <div class="pie-firma">
                <strong>Firma de Recibido</strong><br />
                <span>{{ acuseData.empresa || 'Recepción DCA' }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Nota al pie -->
        <aside class="nota-acuse">
          <strong>Nota:</strong> Este comprobante digital valida la ingesta preliminar de la
          documentación en el sistema del Grupo DCA para su posterior revisión contable.
        </aside>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import { formatearFecha } from '@/modulos/documentos/composables/fechas.js'
import html2pdf from 'html2pdf.js'

const props = defineProps({
  acuseData: {
    type: Object,
    default: () => ({}),
  },
})

/**
 * Hoja del acuse que html2pdf convierte en PDF. Es la hoja interior y no la zona
 * `.zona-impresion`: html2pdf clona lo que recibe dentro de su propio contenedor,
 * y el clon de la zona conservaba su `left: -10000px`, así que el PDF salía en
 * blanco.
 */
const paginaAcuse = ref(null)

// Formato de fecha y hora en local. `fechas.js` solo formatea fechas de solo
// día (`AAAA-MM-DD`); la fecha y hora de recepción es un valor completo, así que
// aquí va su propio `Intl.DateTimeFormat`, como en las demás vistas.
const LOCALE = 'es-MX'
const fmtFechaHora = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const formatearFechaHora = (valor) => {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fmtFechaHora.format(fecha)
}

/** Configuración del PDF, la misma para imprimirlo y para guardarlo. */
const opcionesPdf = () => ({
  margin: [8, 8, 8, 8],
  filename: `acuse-${props.acuseData.folio || 'dca'}.pdf`,
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
})

/** Espera a que las fuentes estén cargadas para que el PDF no salga con otra tipografía. */
const esperarFuentes = async () => {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready.catch(() => {})
  }
}

/**
 * Genera el PDF del acuse y lo descarga.
 *
 * `html2pdf.js` se importa de forma **estática**: con import dinámico
 * (`await import('html2pdf.js')`) el dev server de Vite lo servía como
 * `/node_modules/.vite/deps/html2pdf.js` y devolvía HTML en lugar de un
 * módulo JS, así que `modulo.default` quedaba `undefined` y la generación
 * moría antes de `.from()`. El import estático lo resuelve el optimizador de
 * dependencias de Vite tanto en dev como en build.
 *
 * La bandera `generando` evita que dos clics seguidos disparen dos
 * descargas del mismo acuse.
 */
const generando = ref(false)

const imprimirPdf = async () => {
  if (generando.value) return
  generando.value = true
  try {
    if (!paginaAcuse.value) {
      console.error('No se encontró la hoja del acuse')
      return
    }
    await esperarFuentes()
    await html2pdf().from(paginaAcuse.value).set(opcionesPdf()).save()
  } catch (e) {
    console.error('Error al generar el PDF del acuse:', e)
  } finally {
    generando.value = false
  }
}

/**
 * Genera el PDF del acuse como Blob, para guardarlo en la carpeta del cliente.
 * Lanza si la hoja todavía no existe: quien llama decide qué avisar.
 */
const generarPdf = async () => {
  if (!paginaAcuse.value) throw new Error('El acuse todavía no está listo para generarse.')
  await esperarFuentes()
  return html2pdf().from(paginaAcuse.value).set(opcionesPdf()).outputPdf('blob')
}

defineExpose({ generarPdf })
</script>

<style lang="scss" scoped>
/* Diseño institucional del acuse impreso: paleta `$primary` / `$secondary` y
   MonumentExtended para el título. Sin `text-uppercase` y sin clases Material.
   Contraste: texto blanco sobre `$primary` (12.4:1) y texto negro sobre
   `$secondary` (10.4:1); `$secondary-white` solo se usa en bordes, nunca
   como color de texto. */

.zona-impresion {
  position: fixed;
  left: -10000px;
  top: 0;
  width: 190mm;
  background-color: #ffffff;
  color: $primary;
  font-family: 'Matter', 'Roboto', sans-serif;
  /* z-index oculto eliminado: podría hacer que html2canvas lo capture vacío. */
}

.pagina-acuse {
  box-sizing: border-box;
  width: 100%;
  padding: 10mm 8mm;
  background-color: #ffffff;
  /* Van aquí y no solo en la zona: el clon de html2pdf no hereda de ella. */
  color: $primary;
  font-family: 'Matter', 'Roboto', sans-serif;
}

.encabezado-acuse {
  background-color: $primary;
  color: #ffffff;
  padding: 7mm 6mm;
  border-radius: 4px 4px 0 0;
}

.titulo-monument {
  font-family: 'MonumentExtended', sans-serif;
  font-weight: 700;
  font-size: 20pt;
  line-height: 1.15;
  margin: 0 0 3mm 0;
  color: #ffffff;
}

.subtitulo {
  font-family: 'Matter', 'Roboto', sans-serif;
  font-size: 9pt;
  margin: 0;
  color: #ffffff;
}

.banda-folio {
  background-color: $secondary;
  color: $secondary-black;
  padding: 5mm 6mm;
  border-radius: 0 0 4px 4px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 7mm;
}

.bloque-folio,
.bloque-fecha {
  display: flex;
  flex-direction: column;
}

.etiqueta {
  font-size: 7.5pt;
  color: $secondary-black;
}

.valor-folio,
.valor-fecha {
  font-size: 12pt;
  font-weight: 700;
  color: $secondary-black;
  line-height: 1.2;
}

.datos-acuse {
  border-top: 1.5pt solid $primary;
  border-bottom: 0.5pt solid $secondary-white;
  padding: 3mm 0;
}

.fila-dato {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 1.5mm 0;
  border-bottom: 0.5pt solid $secondary-white-alternative;
}

.fila-dato:last-child {
  border-bottom: none;
}

.label-dato {
  flex: 1 1 auto;
  font-size: 9.5pt;
  font-weight: 500;
  color: $primary;
}

.valor-dato {
  flex: 0 0 55%;
  font-size: 9.5pt;
  font-weight: 600;
  color: $secondary-black;
  text-align: right;
}

.seccion-firmas {
  margin-top: 6mm;
}

.titulo-firmas {
  font-family: 'Matter', 'Roboto', sans-serif;
  font-size: 11pt;
  font-weight: 700;
  margin: 0 0 3mm 0;
  color: $primary;
}

.bloques-firmas {
  display: flex;
  gap: 8mm;
  justify-content: space-between;
}

.bloque-firma {
  flex: 1 1 48%;
  text-align: center;
}

.marco-firma {
  border: 0.75pt solid $secondary-white;
  border-radius: 4px;
  background-color: #ffffff;
  padding: 4mm 2mm;
  min-height: 26mm;
}

.imagen-firma {
  display: block;
  max-width: 100%;
  max-height: 18mm;
  margin: 0 auto;
  object-fit: contain;
}

.sin-firma {
  height: 18mm;
  line-height: 18mm;
  font-size: 9pt;
  color: $primary;
}

.pie-firma {
  margin-top: 2mm;
  font-size: 8pt;
  line-height: 1.35;
  color: $primary;
}

.nota-acuse {
  margin-top: 7mm;
  padding: 3mm 4mm;
  background-color: $secondary-white-alternative;
  color: $primary;
  font-size: 8pt;
  line-height: 1.35;
  border-radius: 4px;
}
</style>
