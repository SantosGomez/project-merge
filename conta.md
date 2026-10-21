---
name: revision-gastos-no-deducibles-v4
description: 'Úsala cuando Alejandra pida identificar gastos no deducibles y revisar/clasificar los CFDI recibidos de una empresa a partir de la metadata del SAT (hoja "Datos"): marca no deducibles, clasifica cada CFDI (requisito indispensable, tipo de gasto, cuenta del catálogo CONTPAQi), avisa posibles activos fijos, revisa REPSE en servicios especializados, retenciones a personas físicas (ISR 10% y 1.25% RESICO) y verifica régimen fiscal y código postal del receptor.'
---

Revisa y clasifica los CFDI recibidos (metadata del SAT). Todo en español (México). No borres la hoja Datos ni el catálogo de cuentas.

## Cuándo usarla

Cuando la usuaria pida "identificar gastos no deducibles", "revisar/clasificar los CFDI recibidos", "clasificar gastos a cuentas contables", "revisar retenciones a personas físicas", "revisar REPSE" o "revisar régimen/CP del receptor", teniendo en el libro:

- Hoja **Datos**: un renglón por CFDI recibido con la metadata del SAT (encabezados en fila 1).
- Hoja de **catálogo de cuentas** CONTPAQi: puede llamarse **Hoja2** o **CUENTAS** (la usuaria la renombra). Número de cuenta en col. A, nombre en col. B (indentado). Serie **5300** = gastos generales; serie **5500** = gastos financieros (5500-001 COMISIONES BANCARIAS, 5500-002 PÉRDIDA CAMBIARIA, 5500-003 INTERESES). Activos fijos = cuentas de balance serie **1xxx** (si existen). Localiza la hoja por contenido (busca "5300-000-000"), no por nombre fijo.

## Columnas clave de la hoja Datos (localízalas por nombre de encabezado, no por letra fija — la usuaria reordena/borra/oculta/inserta columnas y filas)

- `Tipo De Comprobante` (I-Ingreso = gasto; E-Egreso = nota de crédito), `Estatus`, `Validacion EFOS`, `Lista Negra`, `Validacion Art49`
- `Nombre Emisor`, `RFC Emisor`, `Regimen Fiscal Emisor`, `Fecha Emision`
- `SubTotal`, `IVA Trasladado16`, `Total`, `Forma Pago`, `Metodo Pago` (PUE/PPD), `Uso CFDI Receptor`, `UUID`, `Conceptos` (formato "\*\*\* cant | CLAVE8 (descripción) | ...")
- Retenciones: `ISR Retenido`, `ISR Retenido125` (1.25% RESICO), `ISR Retenido10` (10%), `IVA Retenido`, `IVA Retenido4`, `IVA Retenido10.6667%`
- Receptor: `RFC Receptor`, `Nombre Receptor`, `Regimen Fiscal Receptor`, `Domicilio Fiscal Receptor` (CP), `Validacion Codigo Postal`

## Paso 1 — Identificar gastos no deducibles

getUsedRange, mapea encabezados a índices y marca cada CFDI de gasto (tipo I) que cumpla alguno:

- **EFOS**: `Validacion EFOS` ≠ "Limpio"/vacío → Art. 69-B CFF.
- **Cancelado**: `Estatus` = Cancelado.
- **Combustible en efectivo**: gasolina/diésel (15101505/15101514/15101515) con `Forma Pago`=01-Efectivo, cualquier importe → Art. 27-III LISR.
- **Efectivo > $2,000**: `Forma Pago`=01-Efectivo y `Total`>2000 → Art. 27-III LISR.
- **Uso S01-Sin efectos fiscales** → no deducible ni acredita IVA.
- **Multas/recargos/sanciones** (texto en conceptos) → Art. 28-I LISR.
- **Servicios especializados sin REPSE** → ver regla REPSE (Paso 3).
- **Observación (avisa, no es no deducible)**: CFDI PUE con `Forma Pago`=99-Por definir.
  Done when: tienes la lista de UUIDs marcados con su motivo.

## Paso 2 — Hoja "Gastos No Deducibles"

Crea la hoja (si existe, bórrala y recréala) en posición 1, por secciones (una llamada set_cell_range por bloque):

1. **Título** (A1) y periodo/fuente (A2).
2. **CRITERIOS REVISADOS** (Criterio | Fundamento | Resultado).
3. **DETALLE DE COMPROBANTES MARCADOS**: Fecha | Emisor | RFC | Subtotal | Total | Forma Pago | Método | Uso CFDI | UUID | Motivo, más Requisito indispensable | Tipo de gasto | Número de cuenta | Nombre de la cuenta.
4. **Totales**: no deducible confirmado (SUMA) e importe en observación aparte.
   Agrega debajo la revisión de retenciones (Paso 4) y la verificación de receptor (Paso 5).

## Paso 3 — Clasificar TODOS los CFDI en la hoja Datos (4 columnas al final, p. ej. BS:BV)

La usuaria normalmente quiere los 339± CFDI clasificados uno por uno. Columnas, en orden:

1. **Requisito indispensable (Art. 27-I LISR)**: "Sí" para gasto operativo (fletera: peajes, combustible, mantenimiento/refacciones, llantas, gases, internet, software, logística, paquetería, energía, seguros, placas/verificaciones, servicios admin, arrendamiento de transporte, viaje operativo); "Revisar" solo si de verdad dudas.
2. **Tipo de gasto**: "Gasto general" (5300) · "Gasto financiero" (5500) · "Egreso (nota de crédito)" si Tipo=E · "No aplica" (ver regla) · "Revisar - posible activo fijo" (ver regla).
3. **Número de cuenta**.
4. **Nombre de cuenta**: fórmula VLOOKUP al catálogo (auditable, se recalcula): `=IF($BU2="","",IFERROR(VLOOKUP($BU2,CUENTAS!$A:$B,2,FALSE),"(revisar cuenta)"))` (usa el nombre real del catálogo). Para filas "No aplica"/"posible activo fijo" escribe el nombre como texto, no fórmula.
   Escribe requisito/tipo/número como valores (clasificación); el nombre siempre por VLOOKUP. Extrae la clave ProdServ con regex del primer grupo de 8 dígitos de `Conceptos`.

### Regla "No aplica" (no es gasto; marca las 4 columnas = "No aplica")

- **Compra/conversión de divisas** (clave 84121605) → movimiento de tesorería.
- **CFDI de IMSS** (RFC IMS421231I45), **INFONAVIT** (RFC INF7205011ZA) y **autoridades/impuestos** (p. ej. SFG210216AJ9, secretarías de finanzas) → cuotas/aportaciones/impuestos, no gasto deducible por ese CFDI. Identifícalos por RFC del emisor.

### Regla "Posible ACTIVO FIJO" (AVISA; no lo dejes como gasto corriente)

Cuando el CFDI parezca inversión capitalizable (va a activo de balance 1xxx y se deprecia, Arts. 31-34 LISR), NO lo mandes a gasto 5300: márcalo tipo "Revisar - posible activo fijo", número/nombre = "Revisar - posible activo fijo", y repórtalo con fila/emisor/concepto/importe. Señales: compra de unidades/tractocamiones/remolques/motores completos (claves 2510xxxx, 25172000 sistemas completos), maquinaria y equipo, equipo de cómputo/servidores, mobiliario, construcciones/mejoras; montos altos (> $20,000–$50,000 según criterio del despacho) de bien duradero aunque la clave sea genérica o "01010101"; emisores que venden vehículos/maquinaria con importe elevado. Refacciones y consumibles NO son activo fijo (van a MANTTO); la duda es cuando es el bien completo o un componente mayor.

### Regla REPSE — servicios especializados / subcontratación (AVISA)

Reforma de subcontratación 2021: para **deducir** (Art. 27-V LISR) y **acreditar el IVA** (Art. 5-II LIVA) de servicios especializados, el proveedor debe estar inscrito en el **REPSE** (Art. 15 LFT / 15-D CFF) y entregar: registro REPSE vigente, CFDI, y constancias de cumplimiento (declaración y pago de IVA, cuotas obrero-patronales IMSS e INFONAVIT, SUA). Detecta CFDI que puedan ser servicios especializados prestados **con personal del proveedor** y márcalos "Revisar REPSE" (en la columna de requisito o como nota), repórtalos con fila/emisor/importe, y aclara que sin el REPSE y sus constancias el gasto es no deducible y el IVA no acreditable. Señales típicas: **vigilancia/seguridad** (5300-028, clave 92/78111800), **limpieza**, **servicios de logística/maniobras/almacenaje con personal** (5300-044/045/046), **servicios administrativos** (5300-042), **mantenimiento/instalación con personal del proveedor**, inspección/supervisión. NO aplica a compra de bienes (refacciones, llantas, combustible, papelería) ni a servicios profesionales independientes sin personal. Ante la duda, avisa para confirmar si es especializado.

### EVITAR "DIVERSOS": clasifica al máximo; si no sabes, AVISA (no fuerces DIVERSOS)

Manda a 5300-031-000 DIVERSOS lo mínimo. Reglas de empate (fletera):

- Peaje 95111602/95111603/95111615 → 5300-022-001 CAMINOS Y PUENTES
- Diésel 15101505 → 5300-012-001; Gasolina 15101514/15101515 → 5300-012-002; lubricantes/aceites 1512 → 5300-012-003
- Llantas 25172503 → 5300-037-000; Gases/refrigerante 24131513/12142100 → 5300-036-000
- **Refacciones y partes de camión → 5300-017-000 MANTTO DE EQ DE TRANSPORTE.** Incluye mantenimiento 78181508/78181500/72154500 y prefijos de autopartes: 2010, 2012, 2315, 2411, 2413, 2516, 2517, 2610, 2611, 2612, 2713, 3010, 3026, 3116, 3117, 3118, 3120, 3126, 3141, 3912, 4014, 4016, 4017, 4111. También diluyentes/pintura 3121 y emisores refaccionaria/autopartes. (Si es el bien completo/componente mayor caro → posible activo fijo.)
- Herramientas 2711/2712 → 5300-043-000
- Telecom 81161700 → 5300-016-000; Software/datos 8111/4323 → 5300-040-000
- Hotel/viaje 9011, bus 78111802 → 5300-021-000; Leasing vehículos 78111809 → 5300-041-000
- Logística 81141601/78141500/72141505 → 5300-044-000; Paquetería 78102200 → 5300-024-000
- Energía 83101800 → 5300-006-000; Agua embotellada 50202301 → 5300-014-000
- Papelería 4411/4412/1411 → 5300-003-000; Facturación/contable/admin 84111506/84111500 → 5300-042-000
- Publicidad/ventas 80141600 → 5300-010-000; Médicos 8510/8512 → 5300-034-000; Impuestos/derechos 9316 → 5300-030-000; Verificación/emisiones 77102002 → 5300-039-000; Mantto/inspección de edificios 81141805/7210 → 5300-018-000
- **Bancos** 84121500 / cobro de deuda 84101704 / asistencia financiera 84101501 → 5500-001-000 COMISIONES BANCARIAS; **alquiler financiero** 84121607 → 5500-003-000 INTERESES
- **Clave "01010101 – No existe en el catálogo"**: el emisor no puso clave real; deduce por emisor e importe; si no es claro (financieras, montos altos que podrían ser activo fijo), NO lo mandes a DIVERSOS: déjalo "Revisar" y avisa con fila/emisor/concepto/importe.
  Si no hay regla ni certeza, repórtalo (fila/emisor/concepto/importe) en vez de forzar DIVERSOS.
  Done when: las 4 columnas llenas en los 339± renglones, el VLOOKUP resuelve el nombre, no queda "(revisar cuenta)", y en el chat listaste cada CFDI sin clasificar, cada posible activo fijo y cada posible servicio especializado (REPSE). Re-lee texto renderizado y la distribución por cuenta; la suma debe igualar el total de CFDI.

## Paso 4 — Retenciones a personas físicas

Emisores PF = RFC de 13 caracteres. Tabla: Emisor | RFC | Régimen | Base | ISR 1.25% retenido | ISR 1.25% esperado | Diferencia | Estatus, con **SUMIFS contra Datos**:

- Base = `=SUMIFS(Datos!$Z:$Z,Datos!$R:$R,$B<fila>)`; 1.25% retenido = SUMIFS sobre `ISR Retenido125`.
- 1.25% esperado = `=IF(LEFT($C<fila>,3)="626",$D<fila>*0.0125,0)` (RESICO rég. 626; Art. 113-J LISR).
- Estatus = `=IF(ABS(Diferencia)<0.5,IF(esperado>0,"OK - 1.25% correcto","Sin retención aplicable (bienes)"),"REVISAR")`.
  Nota: **ISR 10% + IVA 10.6667%** (Arts. 106 LISR y 1-A LIVA) solo a honorarios/servicios profesionales de PF rég. 612; compra de bienes y reparaciones empresariales NO lo causan. Marca en rojo cualquier PF 612 con servicio que pueda ser profesional (inspección, dictámenes) y calcula el 10% e IVA que faltaría.
  Done when: todas las PF RESICO salen "OK" y están señalados los posibles casos de 10%.

## Paso 5 — Datos del receptor (CFDI 4.0)

Tabla: Concepto | Valor esperado | CFDI que coinciden | CFDI distintos | Estatus, con **COUNTIF contra Datos** para RFC receptor, `Regimen Fiscal Receptor` (601 persona moral) y `Domicilio Fiscal Receptor` (CP). Distintos = total − coinciden; Estatus = `=IF(distintos=0,"OK - todos coinciden","REVISAR")`. Añade estado/municipio del CP desde `Validacion Codigo Postal`. Es consistencia interna; cotejar contra la Constancia de Situación Fiscal.
Done when: las 3 filas muestran coinciden=total, distintos=0.

## Formato (estándar del despacho)

- Español (México). Encabezados de sección: negritas, fondo #1F4E78, letra blanca. Encabezados de tabla: negritas, fondo #D9E1F2.
- Moneda `$#,##0.00`; fechas `dd/mm/yyyy`; bordes delgados #BFBFBF.
- Usa fórmulas (SUMIFS/COUNTIF/VLOOKUP/IF) en lo que deba recalcular; la clasificación por clave se escribe como valor.
- Al terminar, re-lee el texto renderizado (get_cell_ranges o .text) de importes, fechas, estatus y nombres de cuenta.

## Reporte final

Resume: monto no deducible y desglose, casos en observación, distribución por cuenta (incl. serie 5500 y filas "No aplica"), **posibles activos fijos**, **posibles servicios especializados a validar REPSE**, retenciones (1.25% y 10%), verificación de receptor, y **la lista de CFDI que no pudiste clasificar**. Señala lo que NO se pudo validar sin documentos externos (Constancia de Situación Fiscal, registro y constancias REPSE, XML con clave real, naturaleza del servicio).
