<template>
  <q-page class="q-pa-md fondo-pagina">
    <SeccionAnimada>
      <div class="row justify-center">
        <div class="col-12 col-md-10 col-lg-8">
          <!-- Encabezado de la Vista -->
          <q-card class="q-mb-md bg-white shadow-1 rounded-borders">
            <q-card-section class="row items-center q-col-gutter-sm q-pb-none">
              <!-- `col-12 col-sm` en ambos: en móvil se apilan, porque con `col` a secas
                 el bloque de texto se encoge (flex-grow) para dejarle sitio al chip
                 y el título se partía en dos líneas al lado del folio. -->
              <div class="col-12 col-sm">
                <div class="text-h5 text-weight-bold text-primary">Recepción de Documentos</div>
                <div class="text-subtitle2 text-grey-8">
                  Módulo de registro e ingesta de comprobantes contables y fiscales
                </div>
              </div>
              <div class="col-12 col-sm-auto">
                <!-- El folio lo asigna el servidor al guardar (T26). Antes esta vista
                   inventaba uno con números aleatorios y mostraba un folio que
                   nunca existió: `DCA-2026-9817` con el folio real `DCA-2026-10003`.
                   El texto del comentario no repite el nombre de la función que
                   sortea, para que el `git grep` de ese nombre siga dando vacío. -->
                <q-chip color="secondary" text-color="primary" icon="history">
                  Folio: <strong class="q-ml-xs">Se asigna al guardar</strong>
                </q-chip>
              </div>
            </q-card-section>
            <q-separator class="q-mt-md" />
          </q-card>

          <!-- Banner de bloqueo si falta catálogo obligatorio -->
          <q-banner
            v-if="formularioBloqueado"
            class="bg-negative text-white q-mb-md"
            icon="warning"
            dense
          >
            {{ mensajeBloqueo }}. El formulario está deshabilitado hasta que se complete el
            catálogo.
          </q-banner>

          <!-- Archivos que no llegaron a la carpeta del cliente: sigue visible al cerrar el acuse -->
          <q-banner
            v-if="archivosPendientes.length && !mostrarAcuse"
            class="aviso-pendientes q-mb-md"
            rounded
          >
            <template #avatar>
              <q-icon name="cloud_off" />
            </template>
            {{ textoArchivosPendientes(archivosPendientes) }} El documento sí quedó registrado.
            <template #action>
              <q-btn
                flat
                icon="refresh"
                label="Reintentar"
                :loading="reintentando"
                :disable="subiendoArchivos"
                @click="reintentarPendientes"
              >
                <q-tooltip
                  >Volver a intentar guardar estos archivos en la carpeta del cliente</q-tooltip
                >
              </q-btn>
            </template>
          </q-banner>

          <!-- Formulario Principal -->
          <q-card class="shadow-2 bg-white rounded-borders">
            <q-card-section>
              <q-form @submit="onSubmit" class="q-gutter-y-md">
                <!-- Sección 1: Datos de la Entidad -->
                <div class="text-h6 text-weight-bold text-grey-8 row items-center">
                  <q-icon name="business" class="q-mr-xs text-primary" size="20px" />
                  1. Selección de Cliente y Empresa Receptora
                </div>

                <div class="row q-col-gutter-md">
                  <div class="col-12 col-sm-6">
                    <q-select
                      v-model="form.empresaDca"
                      :options="opcionesEmpresasDca"
                      label="Empresa del Grupo DCA Receptora *"
                      name="empresaDca"
                      autocomplete="off"
                      outlined
                      dense
                      options-dense
                      dropdown-icon="expand_more"
                      popup-content-class="menu-seleccion-custom"
                      transition-show="jump-down"
                      transition-hide="jump-up"
                      class="selector-moderno"
                      :disable="formularioBloqueado"
                      :rules="[(val) => !!val || 'Seleccione la empresa receptora']"
                    >
                      <template #prepend>
                        <q-icon name="account_balance" color="primary" />
                      </template>
                      <template #selected-item="scope">
                        <span class="text-weight-medium text-primary ellipsis">
                          {{ scope.opt?.label ?? scope.opt }}
                        </span>
                      </template>
                      <template #option="{ itemProps, opt, selected }">
                        <q-item
                          v-bind="itemProps"
                          :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                        >
                          <q-item-section avatar class="item-seccion-icono">
                            <q-icon
                              name="corporate_fare"
                              size="18px"
                              :class="selected ? 'text-primary' : 'text-grey-8'"
                            />
                          </q-item-section>
                          <q-item-section>
                            <q-item-label class="text-weight-medium">
                              {{ opt?.label ?? opt }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section v-if="selected" side>
                            <q-icon name="check" size="16px" color="primary" />
                          </q-item-section>
                        </q-item>
                      </template>
                    </q-select>
                  </div>

                  <div class="col-12 col-sm-6">
                    <!--
                    El cliente se elige en un modal con búsqueda y cuadrícula
                    (`SelectorClienteDialogo`). El campo es de solo lectura:
                    clic, Enter o Espacio lo abren.
                  -->
                    <q-input
                      :model-value="etiquetaCliente"
                      label="Cliente *"
                      name="cliente"
                      placeholder="Haz clic para buscar y elegir"
                      outlined
                      dense
                      readonly
                      ref="campoCliente"
                      class="campo-cliente selector-moderno"
                      lazy-rules="ondemand"
                      :disable="formularioBloqueado"
                      :rules="[(val) => !!val || 'Elige un cliente']"
                      @click="abrirSelectorCliente"
                      @keydown.enter.prevent="abrirSelectorCliente"
                      @keydown.space.prevent="abrirSelectorCliente"
                    >
                      <template #prepend>
                        <q-icon name="person" color="primary" />
                      </template>
                      <template #append>
                        <q-btn
                          icon="search"
                          flat
                          round
                          dense
                          color="primary"
                          aria-label="Buscar y elegir cliente"
                          :disable="formularioBloqueado"
                          @click.stop="abrirSelectorCliente"
                        >
                          <q-tooltip>Buscar y elegir cliente</q-tooltip>
                        </q-btn>
                      </template>
                      <q-tooltip v-if="etiquetaCliente" :delay="600">{{
                        etiquetaCliente
                      }}</q-tooltip>
                    </q-input>
                    <SelectorClienteDialogo
                      v-model="mostrarSelectorCliente"
                      :clientes="opcionesClientes"
                      :seleccionado="form.cliente"
                      @elegir="elegirCliente"
                    />
                    <AutollenadoDialogo
                      v-model="mostrarAutollenado"
                      :clientes="opcionesClientesFrecuentes"
                      :tipos="tiposRecepcion"
                      @confirmar="onAutollenadoConfirmar"
                    />
                  </div>
                </div>

                <!-- Sección 2: Clasificación Contable -->
                <div class="text-h6 text-weight-bold text-grey-8 row items-center q-pt-sm">
                  <q-icon name="folder" class="q-mr-xs text-primary" size="20px" />
                  2. Clasificación Contable y Periodo
                </div>

                <div class="row q-col-gutter-md">
                  <div class="col-12 col-sm-6">
                    <q-input
                      v-model="form.asunto"
                      label="Asunto del Documento *"
                      name="asunto"
                      autocomplete="off"
                      outlined
                      dense
                      :disable="formularioBloqueado"
                      :rules="[(val) => !!val || 'El asunto es requerido']"
                    />
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-select
                      v-model="form.departamento"
                      :options="opcionesDepartamentos"
                      label="Departamento *"
                      name="departamento"
                      autocomplete="off"
                      outlined
                      dense
                      options-dense
                      dropdown-icon="expand_more"
                      popup-content-class="menu-seleccion-custom"
                      transition-show="jump-down"
                      transition-hide="jump-up"
                      class="selector-moderno"
                      :disable="formularioBloqueado"
                      :rules="[(val) => !!val || 'Seleccione el departamento']"
                    >
                      <template #prepend>
                        <q-icon name="account_tree" color="primary" size="18px" />
                      </template>
                      <template #selected-item="scope">
                        <span class="text-weight-medium text-primary ellipsis">
                          {{ scope.opt?.label ?? scope.opt }}
                        </span>
                      </template>
                      <template #option="{ itemProps, opt, selected }">
                        <q-item
                          v-bind="itemProps"
                          :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                        >
                          <q-item-section avatar class="item-seccion-icono">
                            <q-icon
                              name="folder"
                              size="18px"
                              :class="selected ? 'text-primary' : 'text-grey-8'"
                            />
                          </q-item-section>
                          <q-item-section>
                            <q-item-label class="text-weight-medium">
                              {{ opt?.label ?? opt }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section v-if="selected" side>
                            <q-icon name="check" size="16px" color="primary" />
                          </q-item-section>
                        </q-item>
                      </template>
                    </q-select>
                  </div>
                </div>

                <div class="row q-col-gutter-md">
                  <!-- Selector de Tipo con ellipsis y tooltip -->
                  <div class="col-12 col-sm">
                    <q-select
                      v-model="form.tipoDocumento"
                      :options="opcionesTiposDocumento"
                      label="Tipo de Documento *"
                      name="tipoDocumento"
                      autocomplete="off"
                      outlined
                      dense
                      options-dense
                      dropdown-icon="expand_more"
                      popup-content-class="menu-seleccion-custom"
                      transition-show="jump-down"
                      transition-hide="jump-up"
                      class="selector-moderno"
                      :disable="formularioBloqueado"
                      :rules="[(val) => !!val || 'Seleccione el tipo de documento']"
                    >
                      <template #prepend>
                        <q-icon name="article" color="primary" />
                      </template>
                      <template #selected-item="scope">
                        <span class="text-weight-medium text-primary ellipsis">
                          {{ scope.opt?.label ?? scope.opt }}
                        </span>
                      </template>
                      <template #option="{ itemProps, opt, selected }">
                        <q-item
                          v-bind="itemProps"
                          :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                        >
                          <q-item-section avatar class="item-seccion-icono">
                            <q-icon
                              name="description"
                              size="18px"
                              :class="selected ? 'text-primary' : 'text-grey-8'"
                            />
                          </q-item-section>
                          <q-item-section>
                            <q-item-label class="text-weight-medium">
                              {{ opt?.label ?? opt }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section v-if="selected" side>
                            <q-icon name="check" size="16px" color="primary" />
                          </q-item-section>
                        </q-item>
                      </template>
                    </q-select>

                    <!-- Tooltip: solo cuando ya hay un tipo elegido; sin valor no se
                       muestra nada, para no enseñar un tipo que el usuario no ha
                       seleccionado. Texto plano, sin fondo propio: el tooltip ya es
                       oscuro y un fondo claro dejaría el texto ilegible. -->
                    <q-tooltip v-if="form.tipoDocumento" :delay="500">
                      Tipo de documento seleccionado: {{ form.tipoDocumento }}
                    </q-tooltip>
                  </div>

                  <div class="col-12 col-sm-6">
                    <q-input
                      v-model="form.periodo"
                      mask="####-##"
                      label="Periodo (AAAA-MM) *"
                      name="periodo"
                      autocomplete="off"
                      outlined
                      dense
                      :disable="formularioBloqueado"
                      :rules="[
                        (val) => !!val || 'El periodo es requerido',
                        (val) =>
                          /^\d{4}-(0[1-9]|1[0-2])$/.test(val) || 'Periodo inválido (AAAA-MM)',
                      ]"
                    >
                      <template #prepend>
                        <q-icon name="calendar_month" color="primary" />
                      </template>
                    </q-input>
                  </div>
                </div>

                <!-- Sección 3: Vía de Entrega y Prioridad -->
                <div class="text-h6 text-weight-bold text-grey-8 row items-center q-pt-sm">
                  <q-icon name="assignment_late" class="q-mr-xs text-primary" size="20px" />
                  3. Prioridad y Vía de Entrega
                </div>

                <div class="row q-col-gutter-md">
                  <div class="col-12 col-sm-6 col-md-4">
                    <q-select
                      v-model="form.prioridad"
                      :options="opcionesPrioridades"
                      label="Prioridad *"
                      name="prioridad"
                      autocomplete="off"
                      outlined
                      dense
                      options-dense
                      dropdown-icon="expand_more"
                      popup-content-class="menu-seleccion-custom"
                      transition-show="jump-down"
                      transition-hide="jump-up"
                      class="selector-moderno"
                      :disable="formularioBloqueado"
                    >
                      <template #prepend>
                        <q-icon name="flag" color="primary" size="18px" />
                      </template>
                      <!-- La muestra de color es una señal redundante: el nivel sigue
                         escrito, así que el color nunca es el único canal. -->
                      <template #selected-item="scope">
                        <span class="row items-center no-wrap">
                          <span
                            class="punto-estado-sm"
                            :class="getPrioridadFondo(scope.opt?.value ?? scope.opt)"
                            aria-hidden="true"
                          />
                          <span class="text-weight-medium text-primary ellipsis">
                            {{ scope.opt?.label ?? scope.opt }}
                          </span>
                        </span>
                      </template>
                      <template #option="{ itemProps, opt, selected }">
                        <q-item
                          v-bind="itemProps"
                          :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                        >
                          <q-item-section avatar class="item-seccion-icono">
                            <span
                              class="punto-estado"
                              :class="getPrioridadFondo(opt?.value ?? opt)"
                              aria-hidden="true"
                            />
                          </q-item-section>
                          <q-item-section>
                            <q-item-label class="text-weight-medium">
                              {{ opt?.label ?? opt }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section v-if="selected" side>
                            <q-icon name="check" size="16px" color="primary" />
                          </q-item-section>
                        </q-item>
                      </template>
                    </q-select>
                  </div>
                  <div class="col-12 col-sm-6 col-md-4">
                    <q-input
                      :model-value="formatearFecha(form.fechaLimiteSla)"
                      label="Fecha Límite SLA"
                      name="fechaLimiteSla"
                      autocomplete="off"
                      outlined
                      dense
                      readonly
                      hint="Calculada según la prioridad"
                    />
                  </div>
                  <div class="col-12 col-sm-6 col-md-4">
                    <q-select
                      v-model="form.contadorAsignado"
                      :options="opcionesContadores"
                      label="Contador Asignado (opcional)"
                      name="contadorAsignado"
                      autocomplete="off"
                      outlined
                      dense
                      options-dense
                      use-input
                      dropdown-icon="expand_more"
                      popup-content-class="menu-seleccion-custom"
                      transition-show="jump-down"
                      transition-hide="jump-up"
                      class="selector-moderno"
                      :disable="formularioBloqueado || opcionesContadores.length === 0"
                    >
                      <template #prepend>
                        <q-icon name="person_search" color="primary" size="18px" />
                      </template>
                      <template #selected-item="scope">
                        <span class="text-weight-medium text-primary ellipsis">
                          {{ scope.opt?.label ?? scope.opt }}
                        </span>
                      </template>
                      <template #option="{ itemProps, opt, selected }">
                        <q-item
                          v-bind="itemProps"
                          :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                        >
                          <q-item-section avatar class="item-seccion-icono">
                            <q-icon
                              name="person"
                              size="18px"
                              :class="selected ? 'text-primary' : 'text-grey-8'"
                            />
                          </q-item-section>
                          <q-item-section>
                            <q-item-label class="text-weight-medium">
                              {{ opt?.label ?? opt }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section v-if="selected" side>
                            <q-icon name="check" size="16px" color="primary" />
                          </q-item-section>
                        </q-item>
                      </template>
                    </q-select>
                  </div>
                </div>

                <div class="row q-col-gutter-md">
                  <div class="col-12 col-sm-6">
                    <q-select
                      v-model="form.viaEntrega"
                      :options="['Digital', 'Físico', 'Correo Electrónico']"
                      label="Vía de Entrega *"
                      name="viaEntrega"
                      autocomplete="off"
                      outlined
                      dense
                      options-dense
                      dropdown-icon="expand_more"
                      popup-content-class="menu-seleccion-custom"
                      transition-show="jump-down"
                      transition-hide="jump-up"
                      class="selector-moderno"
                      :disable="formularioBloqueado"
                    >
                      <template #prepend>
                        <q-icon name="local_shipping" color="primary" size="18px" />
                      </template>
                      <template #selected-item="scope">
                        <span class="text-weight-medium text-primary ellipsis">
                          {{ scope.opt?.label ?? scope.opt }}
                        </span>
                      </template>
                      <template #option="{ itemProps, opt, selected }">
                        <q-item
                          v-bind="itemProps"
                          :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                        >
                          <q-item-section avatar class="item-seccion-icono">
                            <q-icon
                              name="send"
                              size="18px"
                              :class="selected ? 'text-primary' : 'text-grey-8'"
                            />
                          </q-item-section>
                          <q-item-section>
                            <q-item-label class="text-weight-medium">
                              {{ opt?.label ?? opt }}
                            </q-item-label>
                          </q-item-section>
                          <q-item-section v-if="selected" side>
                            <q-icon name="check" size="16px" color="primary" />
                          </q-item-section>
                        </q-item>
                      </template>
                    </q-select>
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-toggle
                      v-model="form.notificarCorreo"
                      label="Notificar al cliente por correo al finalizar"
                      name="notificarCorreo"
                      color="primary"
                      :disable="formularioBloqueado"
                    />
                  </div>
                </div>

                <!-- Archivos y firmas... -->
                <div class="text-h6 text-weight-bold text-grey-8 row items-center q-pt-sm">
                  <q-icon name="draw" class="q-mr-xs text-primary" size="20px" />
                  4. Archivos Adjuntos y Firmas
                </div>

                <div class="q-my-sm">
                  <q-file
                    v-model="form.archivos"
                    label="Seleccionar o arrastrar archivos (PDF, XML, ZIP, JPG)"
                    name="archivos"
                    autocomplete="off"
                    outlined
                    multiple
                    use-chips
                    append
                    accept=".pdf, .xml, .zip, .jpg"
                    @update:model-value="validarTamañoArchivos"
                    :disable="formularioBloqueado"
                  >
                    <template #prepend>
                      <q-icon name="attach_file" color="primary" />
                    </template>
                    <template #hint>
                      Formatos aceptados: .pdf, .xml, .zip, .jpg. Tamaño máximo: 25MB por archivo.
                    </template>
                  </q-file>
                </div>

                <div class="row q-col-gutter-md">
                  <div class="col-12 col-sm-6">
                    <q-card
                      flat
                      bordered
                      :class="[
                        'q-pa-sm style-firma-fondo',
                        { 'border-negative': firmaClienteVacia && submitted },
                      ]"
                    >
                      <div class="row items-center justify-between q-mb-xs">
                        <div
                          class="text-caption text-weight-bold"
                          :class="[
                            firmaClienteVacia && submitted ? 'text-negative' : 'text-grey-8',
                          ]"
                        >
                          Firma de Entregado (Cliente) *
                        </div>
                        <q-btn
                          flat
                          dense
                          size="sm"
                          color="negative"
                          icon="clear"
                          label="Limpiar"
                          @click="limpiarFirmaCliente"
                          :disable="formularioBloqueado"
                        >
                          <q-tooltip>Limpiar trazo de la firma del cliente</q-tooltip>
                        </q-btn>
                      </div>
                      <canvas
                        ref="canvasCliente"
                        class="bg-white rounded-borders style-signature-canvas"
                        role="img"
                        aria-label="Firma del cliente, zona para dibujar con el dedo o el ratón"
                        @mousedown="startDrawingCliente"
                        @mousemove="drawCliente"
                        @mouseup="stopDrawingCliente"
                        @mouseleave="stopDrawingCliente"
                        @touchstart.prevent="startDrawingCliente"
                        @touchmove.prevent="drawCliente"
                        @touchend.prevent="stopDrawingCliente"
                        :style="{
                          pointerEvents: formularioBloqueado ? 'none' : 'auto',
                          opacity: formularioBloqueado ? 0.5 : 1,
                        }"
                      ></canvas>
                      <div class="text-caption text-grey-8 text-center q-mt-xs">
                        <q-icon name="gesture" /> Dibuje la firma con el dedo o ratón
                      </div>
                    </q-card>
                  </div>
                  <div class="col-12 col-sm-6">
                    <q-card
                      flat
                      bordered
                      :class="[
                        'q-pa-sm style-firma-fondo',
                        { 'border-negative': firmaRecepcionVacia && submitted },
                      ]"
                    >
                      <div class="row items-center justify-between q-mb-xs">
                        <div
                          class="text-caption text-weight-bold"
                          :class="[
                            firmaRecepcionVacia && submitted ? 'text-negative' : 'text-grey-8',
                          ]"
                        >
                          Firma de Recibido (DCA) *
                        </div>
                        <q-btn
                          flat
                          dense
                          size="sm"
                          color="negative"
                          icon="clear"
                          label="Limpiar"
                          @click="limpiarFirmaRecepcion"
                          :disable="formularioBloqueado"
                        >
                          <q-tooltip>Limpiar trazo de la firma del recepcionista</q-tooltip>
                        </q-btn>
                      </div>
                      <canvas
                        ref="canvasRecepcion"
                        class="bg-white rounded-borders style-signature-canvas"
                        role="img"
                        aria-label="Firma del usuario recepcionista, zona para dibujar con el dedo o el ratón"
                        @mousedown="startDrawingRecepcion"
                        @mousemove="drawRecepcion"
                        @mouseup="stopDrawingRecepcion"
                        @mouseleave="stopDrawingRecepcion"
                        @touchstart.prevent="startDrawingRecepcion"
                        @touchmove.prevent="drawRecepcion"
                        @touchend.prevent="stopDrawingRecepcion"
                        :style="{
                          pointerEvents: formularioBloqueado ? 'none' : 'auto',
                          opacity: formularioBloqueado ? 0.5 : 1,
                        }"
                      ></canvas>
                      <div class="text-caption text-grey-8 text-center q-mt-xs">
                        <q-icon name="edit" /> Firma del usuario recepcionista
                      </div>
                    </q-card>
                  </div>
                </div>

                <q-input
                  v-model="form.observaciones"
                  type="textarea"
                  rows="2"
                  label="Observaciones"
                  name="observaciones"
                  autocomplete="off"
                  outlined
                  dense
                  :disable="formularioBloqueado"
                />

                <div class="row justify-end q-gutter-sm">
                  <q-btn
                    label="Autollenar"
                    color="primary"
                    outline
                    icon="auto_awesome"
                    :disable="!clientesFrecuentes.length || formularioBloqueado"
                    @click="mostrarAutollenado = true"
                  >
                    <q-tooltip>Autollenar con los datos de un cliente frecuente</q-tooltip>
                  </q-btn>
                  <q-btn
                    label="Limpiar"
                    color="grey-8"
                    flat
                    @click="resetForm"
                    :disable="formularioBloqueado"
                  />
                  <q-btn
                    type="submit"
                    label="Registrar y Acuse"
                    color="primary"
                    icon-right="receipt_long"
                    class="q-px-md"
                    :disable="formularioBloqueado || guardando"
                  >
                    <q-tooltip>Registrar la entrega e imprimir acuse de recepción</q-tooltip>
                  </q-btn>
                </div>
              </q-form>
            </q-card-section>
          </q-card>

          <!-- Modal Acuse -->
          <q-dialog
            v-model="mostrarAcuse"
            aria-label="Acuse digital de recepción"
            @show="guardarAcuseEnCarpeta"
          >
            <q-card class="dialogo-acuse">
              <q-card-section class="row items-center bg-primary text-white rounded-borders">
                <q-icon name="verified" size="32px" class="q-mr-sm" />
                <div>
                  <div class="text-h6 text-weight-bold">Acuse Digital de Recepción</div>
                  <div class="text-caption">Grupo DCA — Recepción de Documentación</div>
                </div>
                <q-space />
                <q-btn
                  icon="close"
                  flat
                  round
                  dense
                  aria-label="Cerrar acuse de recepción"
                  v-close-popup
                >
                  <q-tooltip>Cerrar acuse de recepción</q-tooltip>
                </q-btn>
              </q-card-section>

              <q-card-section class="q-pt-md">
                <div
                  class="row justify-between items-center q-mb-md banda-acuse q-pa-sm rounded-borders"
                >
                  <div>
                    <span class="text-caption text-black">Folio de Acuse:</span><br />
                    <strong class="text-subtitle1 text-secondary-black">{{
                      acuseData.folio
                    }}</strong>
                  </div>
                  <div class="text-right">
                    <span class="text-caption text-black">Fecha y Hora:</span><br />
                    <strong class="text-caption">{{
                      formatearFechaHora(acuseData.fechaRecepcion)
                    }}</strong>
                  </div>
                </div>

                <q-list separator dense>
                  <q-item
                    ><q-item-section class="text-grey-8">Empresa:</q-item-section
                    ><q-item-section class="text-right text-weight-bold">{{
                      acuseData.empresa
                    }}</q-item-section></q-item
                  >
                  <q-item
                    ><q-item-section class="text-grey-8">Cliente:</q-item-section
                    ><q-item-section class="text-right text-weight-bold">{{
                      acuseData.cliente
                    }}</q-item-section></q-item
                  >
                  <q-item
                    ><q-item-section class="text-grey-8">Asunto:</q-item-section
                    ><q-item-section class="text-right text-weight-bold">{{
                      acuseData.asunto
                    }}</q-item-section></q-item
                  >
                  <q-item
                    ><q-item-section class="text-grey-8">Departamento:</q-item-section
                    ><q-item-section class="text-right text-weight-bold">{{
                      acuseData.departamento
                    }}</q-item-section></q-item
                  >
                  <q-item
                    ><q-item-section class="text-grey-8">Prioridad:</q-item-section
                    ><q-item-section class="text-right text-weight-bold">{{
                      acuseData.prioridad
                    }}</q-item-section></q-item
                  >
                  <q-item
                    ><q-item-section class="text-grey-8">Vía de Entrega:</q-item-section
                    ><q-item-section class="text-right text-weight-bold">{{
                      acuseData.viaEntrega
                    }}</q-item-section></q-item
                  >
                  <q-item
                    ><q-item-section class="text-grey-8">SLA (Fecha Límite):</q-item-section
                    ><q-item-section class="text-right text-weight-bold">{{
                      formatearFecha(acuseData.fechaLimite)
                    }}</q-item-section></q-item
                  >
                  <q-item
                    ><q-item-section class="text-grey-8">Periodo:</q-item-section
                    ><q-item-section class="text-right text-weight-bold">{{
                      acuseData.periodo
                    }}</q-item-section></q-item
                  >
                  <q-item
                    ><q-item-section class="text-grey-8">Archivos:</q-item-section
                    ><q-item-section class="text-right text-weight-bold">{{
                      acuseData.archivos + ' archivo(s)'
                    }}</q-item-section></q-item
                  >
                </q-list>

                <!-- Sección de Firmas Estampadas en el Acuse -->
                <div class="q-mt-md text-h6 text-weight-bold text-grey-8">
                  Firmas Registradas de Conformidad:
                </div>
                <div class="row q-col-gutter-sm q-mt-xs">
                  <div class="col-6 text-center">
                    <div class="q-pa-xs borde-firma rounded-borders bg-white">
                      <img
                        v-if="acuseData.firmaClienteUrl"
                        :src="acuseData.firmaClienteUrl"
                        alt="Firma del cliente registrada"
                        width="240"
                        height="60"
                        class="firma-imagen"
                      />
                      <div v-else class="sin-firma">Sin firma dibujada</div>
                    </div>
                    <div class="text-caption text-weight-bold q-mt-xs text-grey-8">
                      Firma de Entregado
                    </div>
                    <div class="pie-firma text-grey-8">{{ acuseData.cliente || 'Cliente' }}</div>
                  </div>

                  <div class="col-6 text-center">
                    <div class="q-pa-xs borde-firma rounded-borders bg-white">
                      <img
                        v-if="acuseData.firmaRecepcionUrl"
                        :src="acuseData.firmaRecepcionUrl"
                        alt="Firma del usuario recepcionista registrada"
                        width="240"
                        height="60"
                        class="firma-imagen"
                      />
                      <div v-else class="sin-firma">Sin firma dibujada</div>
                    </div>
                    <div class="text-caption text-weight-bold q-mt-xs text-grey-8">
                      Firma de Recibido
                    </div>
                    <div class="pie-firma text-grey-8">
                      {{ acuseData.empresa || 'Recepción DCA' }}
                    </div>
                  </div>
                </div>

                <div class="q-mt-md nota-acuse q-pa-sm rounded-borders">
                  <strong>Nota:</strong> Este comprobante digital valida la ingesta preliminar de la
                  documentación en el sistema del Grupo DCA para su posterior revisión contable.
                </div>

                <!-- Estado del guardado en la carpeta del cliente -->
                <div aria-live="polite" class="q-mt-md">
                  <div v-if="subiendoArchivos" class="row items-center no-wrap text-grey-8">
                    <q-spinner color="primary" size="18px" class="q-mr-sm" />
                    Guardando los archivos y el acuse en la carpeta del cliente…
                  </div>
                  <div v-else-if="archivosGuardados" class="row items-center no-wrap text-primary">
                    <q-icon name="check_circle" size="18px" class="q-mr-sm" />
                    Los archivos y el acuse quedaron guardados en la carpeta del cliente.
                  </div>
                  <q-banner v-else-if="archivosPendientes.length" class="aviso-pendientes" rounded>
                    <template #avatar>
                      <q-icon name="cloud_off" />
                    </template>
                    {{ textoArchivosPendientes(archivosPendientes) }} El documento sí quedó
                    registrado.
                    <template #action>
                      <q-btn
                        flat
                        icon="refresh"
                        label="Reintentar"
                        :loading="reintentando"
                        @click="reintentarPendientes"
                      >
                        <q-tooltip
                          >Volver a intentar guardar estos archivos en la carpeta del
                          cliente</q-tooltip
                        >
                      </q-btn>
                    </template>
                  </q-banner>
                </div>
              </q-card-section>

              <q-card-actions align="right" class="q-pr-md q-pb-md">
                <q-btn flat label="Cerrar" color="grey-8" v-close-popup />
                <AcuseImprimir ref="acuseComp" :acuse-data="acuseData" />
              </q-card-actions>
            </q-card>
          </q-dialog>
        </div>
      </div>
    </SeccionAnimada>
  </q-page>
</template>

<script setup>
import SeccionAnimada from '@/modulos/documentos/components/SeccionAnimada.vue'
import { ref, reactive, onMounted, computed, watch, nextTick } from 'vue'
import { useQuasar } from 'quasar'
import {
  obtenerCatalogos,
  crearDocumento,
  subirArchivo,
  subirAcuse,
  obtenerClientesFrecuentes,
} from '@/modulos/documentos/servicios/api.js'
import { periodoDe, formatearFecha } from '@/modulos/documentos/composables/fechas.js'
import { plazoDeEntrega } from '@/modulos/documentos/composables/plazoEntrega.js'
import { opcionesDeClientes } from '@/modulos/documentos/composables/clientesVista.js'
import {
  subirEnOrden,
  textoArchivosPendientes,
} from '@/modulos/documentos/composables/subidaArchivos.js'
import { aplicarPlantilla, TIPOS_RECEPCION } from '@/modulos/documentos/composables/autollenado.js'
import { esErrorHTTP, detallesDeError } from '@/modulos/documentos/servicios/cliente.js'
import AcuseImprimir from '@/modulos/documentos/components/AcuseImprimir.vue'
import SelectorClienteDialogo from '@/modulos/documentos/components/SelectorClienteDialogo.vue'
import AutollenadoDialogo from '@/modulos/documentos/components/AutollenadoDialogo.vue'

const $q = useQuasar()
const submitted = ref(false)

// Catálogos desde la base de datos
const catalogos = reactive({
  empresas: [],
  tiposDocumento: [],
  departamentos: [],
  contadores: [],
  clientes: [],
})

// Estado de bloqueo del formulario
const formularioBloqueado = ref(false)
const mensajeBloqueo = ref('')

// Envío en curso. Sin esta bandera el botón se apagaba pero no la función: dos
// clics seguidos llegaban al servidor y quedaban dos documentos con folios distintos.
const guardando = ref(false)

// Opciones para q-select (mapeadas desde catalogos)
const opcionesEmpresasDca = computed(() => catalogos.empresas.map((e) => e.nombre))
// Clientes: el valor es el id y la etiqueta «0001 · Razón social». Se eligen en
// el modal `SelectorClienteDialogo`; el formulario guarda solo el id.
const opcionesClientes = computed(() => opcionesDeClientes(catalogos.clientes))
const mostrarSelectorCliente = ref(false)

// Autollenado: clientes que ya tienen recepciones previas y los tipos de
// recepción del MVP. La lista se carga al montar; si falla, el botón queda
// apagado y el formulario sigue funcionando.
const mostrarAutollenado = ref(false)
const clientesFrecuentes = ref([])
const tiposRecepcion = [...TIPOS_RECEPCION]
const opcionesClientesFrecuentes = computed(() => opcionesDeClientes(clientesFrecuentes.value))
const etiquetaCliente = computed(
  () => opcionesClientes.value.find((o) => o.value === form.cliente)?.label ?? '',
)
const abrirSelectorCliente = () => {
  if (!formularioBloqueado.value) mostrarSelectorCliente.value = true
}
// El campo pierde el foco al abrir el modal: con la validación normal se
// pondría en rojo mientras se elige. Por eso valida solo al enviar
// (`lazy-rules="ondemand"`) y aquí se revalida para quitar un error anterior.
const campoCliente = ref(null)
const elegirCliente = async (id) => {
  form.cliente = id
  onClienteChange(id)
  await nextTick()
  campoCliente.value?.validate()
}
const opcionesTiposDocumento = computed(() => catalogos.tiposDocumento.map((t) => t.nombre))
const opcionesDepartamentos = computed(() => catalogos.departamentos.map((d) => d.nombre))
const opcionesContadores = computed(() => catalogos.contadores.map((c) => c.nombre))

// Prioridad se queda hardcoded (no viene de catálogo)
const opcionesPrioridades = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE']

// Periodo: un único valor AAAA-MM, inicializado al mes en curso (ver onMounted)

// Formato de fecha con Intl, para no depender de un formato escrito a mano.
// El formateo de la fecha (sin hora) lo pone el módulo compartido
// (`@/composables/fechas`), que ya vive en `formatearFecha`.
const LOCALE = 'es-MX'
const fmtFechaHora = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const formatearFechaHora = (valor) => (valor ? fmtFechaHora.format(new Date(valor)) : '—')

// Señal de urgencia de la prioridad, con el mismo escalón semántico que usa la
// columna de prioridad en `DireccionamientoPage.vue`. URGENTE $negative, ALTA
// $warning, MEDIA $info y BAJA neutro, porque es la que no requiere atención.
const getPrioridadFondo = (prioridad) => {
  if (prioridad === 'URGENTE') return 'bg-negative'
  if (prioridad === 'ALTA') return 'bg-warning'
  if (prioridad === 'MEDIA') return 'bg-info'
  return 'fondo-prioridad-baja'
}

const form = reactive({
  empresaDca: null,
  cliente: null,
  asunto: '',
  departamento: null,
  tipoDocumento: null,
  periodo: periodoDe(new Date()) || '',
  prioridad: 'MEDIA',
  fechaLimiteSla: '',
  contadorAsignado: null,
  viaEntrega: 'Digital',
  notificarCorreo: false,
  recibidoPor: 'Recepción DCA',
  archivos: null,
  observaciones: '',
})

// Recalcular fecha límite cuando cambia la prioridad
watch(
  () => form.prioridad,
  (nuevaPrioridad) => {
    if (nuevaPrioridad) {
      try {
        const fecha = plazoDeEntrega(nuevaPrioridad, new Date())
        const f = fecha
        form.fechaLimiteSla = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
      } catch (e) {
        console.error('Error calculando SLA:', e)
        form.fechaLimiteSla = ''
      }
    }
  },
  { immediate: true },
)

const calcularSla = () => {
  // Ya no se usa directamente; el watch lo hace automáticamente.
  // Se mantiene por compatibilidad si se llama desde algún lado.
  try {
    const fecha = plazoDeEntrega(form.prioridad, new Date())
    const f = fecha
    form.fechaLimiteSla = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
  } catch (e) {
    console.error('Error calculando SLA:', e)
  }
}

const onClienteChange = (val) => {
  if (val) form.contadorAsignado = 'CP. Carlos Ruiz'
}

// Confirmación del modal de autollenado: vuelca la plantilla del tipo elegido y
// fija el cliente. No toca periodo, archivos ni firmas (los decide la persona en
// cada entrega) y revalida el campo de cliente como al elegirlo a mano.
const onAutollenadoConfirmar = async ({ clienteId, tipoRecepcion }) => {
  aplicarPlantilla(tipoRecepcion, form)
  form.cliente = clienteId
  onClienteChange(clienteId)
  mostrarAutollenado.value = false
  await nextTick()
  campoCliente.value?.validate()
}
const validarTamañoArchivos = (files) => {
  if (!files) return
  for (const file of files) {
    if (file.size > 25 * 1024 * 1024) {
      $q.notify({ type: 'warning', message: 'Archivo ' + file.name + ' excede 25MB' })
      form.archivos = form.archivos.filter((f) => f !== file)
    }
  }
}

// Cargar catálogos al montar
onMounted(async () => {
  try {
    // `cliente.js` (T15) devuelve el cuerpo pelado de la respuesta —sin envolver en
    // `{ status, body }`— y ya lanza en el error, así que los catálogos se leen de
    // la raíz del objeto. Antes se probaba `respuesta.status === 200 &&
    // respuesta.body`, que nunca era cierto: la respuesta se descartaba entera y el
    // formulario quedaba bloqueado con "Error desconocido".
    const respuesta = await obtenerCatalogos()
    catalogos.empresas = respuesta?.empresas ?? []
    catalogos.tiposDocumento = respuesta?.tiposDocumento ?? []
    catalogos.departamentos = respuesta?.departamentos ?? []
    catalogos.contadores = respuesta?.contadores ?? []
    catalogos.clientes = respuesta?.clientes ?? []

    // Verificar catálogos obligatorios
    const obligatorios = [
      { clave: 'empresas', nombre: 'empresas' },
      { clave: 'tiposDocumento', nombre: 'tipos de documento' },
      { clave: 'departamentos', nombre: 'departamentos' },
      { clave: 'clientes', nombre: 'clientes' },
    ]

    for (const cat of obligatorios) {
      if (catalogos[cat.clave].length === 0) {
        formularioBloqueado.value = true
        mensajeBloqueo.value = 'Falta catálogo: ' + cat.nombre
        break
      }
    }

    // Contadores: si vacío, no bloquea, solo avisa en consola
    if (catalogos.contadores.length === 0) {
      console.warn('Catálogo de contadores vacío (opcional)')
    }

    // Periodo por defecto = mes actual
    form.periodo = periodoDe(new Date()) || ''

    // Empresa por defecto: la primera si existe
    if (catalogos.empresas.length > 0 && !form.empresaDca) {
      form.empresaDca = catalogos.empresas[0].nombre
    }

    // Clientes con recepciones previas para el autollenado. Va en su propio
    // try/catch: si el endpoint falla, el formulario sigue operativo y solo el
    // botón de autollenar queda apagado.
    try {
      const respuestaFrecuentes = await obtenerClientesFrecuentes()
      clientesFrecuentes.value = respuestaFrecuentes?.clientes ?? []
    } catch (error) {
      console.warn('No se pudieron cargar los clientes frecuentes:', error)
    }

    // Fecha límite SLA inicial (el watch ya lo hace, pero por si acaso)
    calcularSla()
  } catch (error) {
    console.error('Error cargando catálogos:', error)
    formularioBloqueado.value = true
    mensajeBloqueo.value = 'Error de conexión al cargar catálogos'
  }

  // Inicializar canvas
  const tinta = tintaInstitucional()
  ;[canvasCliente.value, canvasRecepcion.value].forEach((c) => {
    c.width = c.offsetWidth
    c.height = c.offsetHeight
    const ctx = c.getContext('2d')
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = tinta
    if (c === canvasCliente.value) ctxCliente = ctx
    else ctxRecepcion = ctx
  })
})

const mostrarAcuse = ref(false)
const acuseComp = ref(null)

// Archivos de la recepción (adjuntos y acuse) que se guardan en la carpeta del
// cliente. El documento ya está registrado: si un archivo falla, se avisa y se
// puede reintentar. Cada pendiente lleva el id y el folio de SU documento, para
// que reintentar nunca lo suba a otra recepción posterior.
let porGuardar = null
const archivosPendientes = ref([])
const subiendoArchivos = ref(false)
const archivosGuardados = ref(false)
const reintentando = ref(false)

const generarAcuse = async () => {
  const blob = await acuseComp.value?.generarPdf()
  if (!blob) throw new Error('Abre el acuse para volver a generarlo.')
  return blob
}

const subirElemento = async (elemento) => {
  if (elemento.tipo === 'acuse') {
    // Si el PDF no se pudo generar antes, se intenta otra vez aquí.
    if (!elemento.archivo) elemento.archivo = await generarAcuse()
    return subirAcuse(elemento.documentoId, elemento.archivo, elemento.folio)
  }
  return subirArchivo(elemento.documentoId, elemento.archivo)
}

const guardarAcuseEnCarpeta = async () => {
  const pendiente = porGuardar
  if (!pendiente) return
  porGuardar = null

  const { documentoId, folio } = pendiente
  const acuse = { nombre: `acuse-${folio}.pdf`, tipo: 'acuse', documentoId, folio, archivo: null }
  try {
    acuse.archivo = await generarAcuse()
  } catch {
    // Queda sin PDF: `subirElemento` lo vuelve a generar y, si falla, va a pendientes.
  }
  const elementos = [
    acuse,
    ...pendiente.adjuntos.map((archivo) => ({
      nombre: archivo.name,
      tipo: 'adjunto',
      documentoId,
      folio,
      archivo,
    })),
  ]

  subiendoArchivos.value = true
  archivosGuardados.value = false
  try {
    const fallidos = await subirEnOrden(elementos, subirElemento)
    archivosPendientes.value = [...archivosPendientes.value, ...fallidos]
    archivosGuardados.value = fallidos.length === 0
  } finally {
    subiendoArchivos.value = false
  }
}

const reintentarPendientes = async () => {
  if (reintentando.value) return
  reintentando.value = true
  subiendoArchivos.value = true
  try {
    archivosPendientes.value = await subirEnOrden(archivosPendientes.value, subirElemento)
    if (archivosPendientes.value.length === 0) {
      archivosGuardados.value = true
      $q.notify({
        type: 'positive',
        message: 'Los archivos ya se guardaron en la carpeta del cliente',
      })
    }
  } finally {
    subiendoArchivos.value = false
    reintentando.value = false
  }
}
const acuseData = reactive({
  folio: '',
  periodo: '',
  fechaRecepcion: '',
  fechaLimite: '',
  // Las imágenes del comprobante. Van aquí y no en `firmaClienteUrl` /
  // `firmaRecepcionUrl` porque el diálogo se pinta después de `resetForm()`, que
  // vacía esos refs: leerlos mostraba siempre "Sin firma dibujada" aunque las
  // firmas sí estuvieran guardadas.
  firmaClienteUrl: '',
  firmaRecepcionUrl: '',
  archivos: 0,
  empresa: '',
  cliente: '',
  asunto: '',
  departamento: '',
  prioridad: '',
  viaEntrega: '',
  notificarCorreo: false,
  observaciones: '',
})
const firmaClienteUrl = ref('')
const firmaRecepcionUrl = ref('')

// Canvas
const canvasCliente = ref(null)
const canvasRecepcion = ref(null)
const firmaClienteVacia = ref(true)
const firmaRecepcionVacia = ref(true)
let ctxCliente = null,
  ctxRecepcion = null
let isDrawingC = false,
  isDrawingR = false

// La tinta se toma de la variable CSS que Quasar publica con la paleta, en vez de
// un hexadecimal fijo, para que siga a $primary si algún día cambia.
const tintaInstitucional = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--q-primary').trim() || '#111e30'

onMounted(() => {
  const tinta = tintaInstitucional()
  ;[canvasCliente.value, canvasRecepcion.value].forEach((c) => {
    c.width = c.offsetWidth
    c.height = c.offsetHeight
    const ctx = c.getContext('2d')
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = tinta
    if (c === canvasCliente.value) ctxCliente = ctx
    else ctxRecepcion = ctx
  })
})

const getPos = (canvas, e) => {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left,
    y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top,
  }
}

const startDrawing = (e, canvas, ctx, isVacia) => {
  const pos = getPos(canvas, e)
  ctx.beginPath()
  ctx.moveTo(pos.x, pos.y)
  isVacia.value = false
  return true
}

const startDrawingCliente = (e) => {
  isDrawingC = startDrawing(e, canvasCliente.value, ctxCliente, firmaClienteVacia)
}
const drawCliente = (e) => {
  if (isDrawingC) {
    const pos = getPos(canvasCliente.value, e)
    ctxCliente.lineTo(pos.x, pos.y)
    ctxCliente.stroke()
  }
}
const stopDrawingCliente = () => {
  isDrawingC = false
}
const limpiarFirmaCliente = () => {
  ctxCliente.clearRect(0, 0, canvasCliente.value.width, canvasCliente.value.height)
  firmaClienteVacia.value = true
}

const startDrawingRecepcion = (e) => {
  isDrawingR = startDrawing(e, canvasRecepcion.value, ctxRecepcion, firmaRecepcionVacia)
}
const drawRecepcion = (e) => {
  if (isDrawingR) {
    const pos = getPos(canvasRecepcion.value, e)
    ctxRecepcion.lineTo(pos.x, pos.y)
    ctxRecepcion.stroke()
  }
}
const stopDrawingRecepcion = () => {
  isDrawingR = false
}
const limpiarFirmaRecepcion = () => {
  ctxRecepcion.clearRect(0, 0, canvasRecepcion.value.width, canvasRecepcion.value.height)
  firmaRecepcionVacia.value = true
}

const onSubmit = async () => {
  // Guarda de reentrada: `:disable` apaga el botón, pero no cubre el envío en
  // curso, y dos clics seguidos llegaban al servidor con dos documentos distintos.
  if (guardando.value) return

  submitted.value = true
  if (firmaClienteVacia.value || firmaRecepcionVacia.value) {
    $q.notify({ type: 'warning', message: 'Ambas firmas son obligatorias para el registro' })
    return
  }

  // 1. Validación previa de adjuntos: separar los > 25 MB
  const LIMITE_BYTES = 25 * 1024 * 1024
  const archivosValidos = []
  const archivosRechazados = []

  if (form.archivos && form.archivos.length > 0) {
    for (const file of form.archivos) {
      if (file.size > LIMITE_BYTES) {
        archivosRechazados.push({
          nombre: file.name,
          tamanoMB: (file.size / (1024 * 1024)).toFixed(1),
        })
      } else {
        archivosValidos.push(file)
      }
    }
  }

  // Avisar de rechazados pero NO abortar
  if (archivosRechazados.length > 0) {
    const lista = archivosRechazados.map((a) => `${a.nombre} (${a.tamanoMB} MB)`).join(', ')
    $q.notify({
      type: 'warning',
      message: `Los siguientes archivos superan 25 MB y no se adjuntaron: ${lista}`,
      timeout: 8000,
    })
  }

  // 2. Leer los lienzos ANTES de armar el payload. Antes se leían 29 líneas más
  // abajo, así que `firmaClienteUrl.value` seguía vacío y el primer clic siempre
  // terminaba en un 400 VALIDACION con "faltan las firmas".
  const firmaClienteCapturada = canvasCliente.value.toDataURL()
  const firmaRecepcionCapturada = canvasRecepcion.value.toDataURL()
  firmaClienteUrl.value = firmaClienteCapturada
  firmaRecepcionUrl.value = firmaRecepcionCapturada

  // 3. Preparar datos para la API (usar IDs de catálogos, no nombres)
  const empresaSel = catalogos.empresas.find((e) => e.nombre === form.empresaDca)
  const clienteSel = catalogos.clientes.find((c) => c.id === form.cliente)
  const tipoSel = catalogos.tiposDocumento.find((t) => t.nombre === form.tipoDocumento)
  const deptoSel = catalogos.departamentos.find((d) => d.nombre === form.departamento)

  const datos = {
    clienteId: clienteSel?.id,
    empresaId: empresaSel?.id,
    tipoDocId: tipoSel?.id,
    departamentoId: deptoSel?.id,
    asunto: form.asunto,
    prioridad: form.prioridad,
    periodo: form.periodo,
    viaEntrega:
      form.viaEntrega === 'Digital'
        ? 'DIGITAL'
        : form.viaEntrega === 'Físico'
          ? 'PRESENCIAL'
          : form.viaEntrega === 'Correo Electrónico'
            ? 'CORREO'
            : 'OTRO',
    observaciones: form.observaciones || null,
    fechaLimiteSla: form.fechaLimiteSla, // ya viene del watch con plazoDeEntrega, sin Z
    notificarCorreo: form.notificarCorreo,
    firmaCliente: firmaClienteCapturada,
    firmaRecep: firmaRecepcionCapturada,
    adjuntos: archivosValidos.map((f) => ({
      nombreOriginal: f.name,
      mimeType: f.type,
      tamanoBytes: f.size,
    })),
  }

  guardando.value = true
  try {
    // 4. Llamada a la API. Igual que los catálogos, `cliente.js` devuelve el cuerpo
    // pelado: el folio y los datos del acuse vienen en la raíz de la respuesta.
    const cuerpo = await crearDocumento(datos)

    if (!cuerpo || !cuerpo.folio) {
      throw new Error('Respuesta inesperada del servidor')
    }

    // 5. En éxito: guardar respuesta del servidor en acuseData
    acuseData.folio = cuerpo.folio
    acuseData.periodo = cuerpo.periodo
    acuseData.fechaRecepcion = cuerpo.fechaRecepcion
    acuseData.fechaLimite = cuerpo.fechaLimite
    // El comprobante guarda las MISMAS lecturas del lienzo que se acabaron de
    // enviar, no `cuerpo.firmas`: el servidor solo devuelve `true`/`true` (los
    // booleanos de `Backend/src/rutas/documentos.js`), nunca las imágenes.
    acuseData.firmaClienteUrl = firmaClienteCapturada
    acuseData.firmaRecepcionUrl = firmaRecepcionCapturada
    acuseData.archivos = archivosValidos.length
    acuseData.empresa = form.empresaDca
    acuseData.cliente = clienteSel?.razonSocial
    acuseData.asunto = form.asunto
    acuseData.departamento = form.departamento
    acuseData.prioridad = form.prioridad
    acuseData.viaEntrega = form.viaEntrega
    acuseData.notificarCorreo = form.notificarCorreo
    acuseData.observaciones = form.observaciones

    // Los archivos se guardan en la carpeta del cliente cuando el acuse ya se
    // mostró (`@show` del diálogo), porque el PDF se genera desde su hoja.
    porGuardar = { documentoId: cuerpo.id, folio: cuerpo.folio, adjuntos: archivosValidos }

    // Mostrar modal de acuse
    mostrarAcuse.value = true

    // 6. Limpiar formulario SOLO si no hubo rechazados de adjuntos
    if (archivosRechazados.length === 0) {
      resetForm()
    }

    $q.notify({ type: 'positive', message: 'Documento registrado con folio ' + cuerpo.folio })
  } catch (error) {
    // 7. En error: mensaje traducido del cliente.js, formulario NO se limpia
    let mensaje = 'Error al registrar el documento'
    if (esErrorHTTP(error)) {
      mensaje = error.message
      // Si es error de validación, mostrar campos faltantes
      if (error.codigo === 'VALIDACION') {
        const faltantes = detallesDeError(error)?.faltantes
        if (faltantes && faltantes.length > 0) {
          mensaje += ': ' + faltantes.join(', ')
        }
      }
    } else if (error instanceof Error) {
      mensaje = error.message
    }
    $q.notify({ type: 'negative', message: mensaje, timeout: 8000 })
  } finally {
    // El botón vuelve a encenderse pase lo que pase: si no, un error de red
    // dejaba el formulario bloqueado para siempre.
    guardando.value = false
  }
}

const resetForm = () => {
  submitted.value = false
  form.asunto = ''
  form.departamento = null
  form.contadorAsignado = null
  form.archivos = null
  limpiarFirmaCliente()
  limpiarFirmaRecepcion()
  firmaClienteUrl.value = ''
  firmaRecepcionUrl.value = ''
}
</script>

<style lang="scss" scoped>
/* Fondo de la página con un neutro de la paleta institucional (en lugar de `bg-grey-2`) */
/* Aviso de archivos sin guardar: $warning con texto oscuro (9.88:1), como el semáforo */
.aviso-pendientes {
  background-color: $warning;
  color: $primary;
}

/* El campo de cliente abre el modal: que el cursor lo diga */
.campo-cliente :deep(.q-field__control),
.campo-cliente :deep(input) {
  cursor: pointer;
}

/* Diálogo del acuse: las medidas van en clase, no en estilo en línea */
.dialogo-acuse {
  width: 580px;
  max-width: 95vw;
  max-height: 85vh;
  overscroll-behavior: contain;
}

/* Banda del folio y la fecha dentro del acuse */
.banda-acuse {
  background-color: $secondary;
}

/* Prioridad BAJA: neutro institucional, porque es la que no requiere atención */
.fondo-prioridad-baja {
  background-color: $secondary-white-alternative;
}

/* Cifra pendiente con cliente: usa el blanco alternativo institucional */
.fondo-cifra-pendiente-cliente {
  background-color: $secondary-white-alternative;
}

/* Cifra neutra/sin categoría: fondo institucional neutro */
.fondo-cifra-neutra {
  background-color: $secondary-white-alternative;
}

/* Marco de las firmas estampadas en el acuse. Antes el borde era de 1px en
   $secondary-white-alternative y no se veía nada; el comprobante impreso
   necesita que se distinga la firma del resto. */
.borde-firma {
  border: 1px solid $secondary-white;
}

/* La imagen declara width y height en el marcado para que el marco no salte al
   mostrarse; el CSS solo la adapta al ancho disponible. */
.firma-imagen {
  max-width: 100%;
  object-fit: contain;
}

.sin-firma {
  height: 60px;
  line-height: 60px;
  color: $primary;
}

/* Pie de firma: 0.8rem es más legible que el 0.7rem que llevaba en línea */
.pie-firma {
  font-size: 0.8rem;
}

/* Nota al pie del acuse: neutro institucional (en lugar de `bg-grey-2`) */
.nota-acuse {
  background-color: $secondary-white-alternative;
  color: $primary;
  font-size: 0.8rem;
}

.style-signature-canvas {
  touch-action: none;
  cursor: crosshair;
  width: 100%;
  height: 120px;
}
.border-negative {
  border: 2px solid $negative;
}
/* Fondo de las tarjetas de firma: neutro institucional sólido, el mismo que
   usan las cajas de firma de `DireccionamientoPage.vue`. */
.style-firma-fondo {
  background-color: $secondary-white-alternative;
}
</style>
