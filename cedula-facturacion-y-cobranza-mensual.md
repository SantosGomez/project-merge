---
name: cedula-facturacion-cobranza-mensual
description: Arma la cédula mensual de ingresos facturados (MMFACT) y cobrados (MMCOB) de un transportista a partir del metadata del SAT de CFDI y REP, los XML, los estados de cuenta bancarios y la balanza, y la concilia contra contabilidad y bancos en una pestaña MMCONC separada. Úsala cuando pidan "la cédula de facturación del mes", "ingresos cobrados", "conciliar facturación/cobranza contra contabilidad y bancos", "revisar los REP", "cuadrar el IVA cobrado", "cartera / pendientes de cobro" o "cerrar el mes de ingresos" de una empresa que factura en MXN y USD.
---

# Cédula mensual de facturación y cobranza (ingresos)

## Objetivo

Documentar, por mes, los ingresos **facturados** (CFDI vigentes) y **cobrados** (REP + depósitos bancarios) de la empresa, y cuadrarlos contra la contabilidad (balanza/auxiliar) y contra los estados de cuenta, dejando observaciones por factura según la guía de llenado.

## Cuándo usarla

Al cierre mensual de ingresos de un transportista que emite fletes nacionales e internacionales y factura en MXN y USD (PPD/PUE). Cada mes se agregan las hojas: `MMFACT`, `MMCOB` y la conciliación `MMCONC` (p. ej. `09FACT`, `09COB`, `09CONC`). **(observado)**

## Entradas esperadas

- **Metadata SAT de CFDI emitidos del mes** → hoja `CFDIMES`. **(observado)**
- **Metadata SAT de REP (complementos de pago) del mes** → hoja `PAGOS` (doc relacionado, parcialidad, saldos, traslados/retenciones DR, ruta XML). **(observado)**
- **XML** en ruta tipo `Z:\...\EJERCICIO [AÑO]\XML\[MM MES]\[MM] EMITIDAS\...`. **(observado)**
- **Estados de cuenta del mes** por banco → hojas `BANCO MM [BANCO]` (BBVA, Banregio MXN y USD). **(observado)**
- **Balanza (y auxiliar de clientes, CONTPAQi):** de aquí se captura **a mano** la fila "CONTABILIDAD" y los cargos del auxiliar. **(confirmado por la contadora)**
- **Tipo de cambio DOF diario** → hoja `TC` (Fecha serial | Valor). **(observado)**
- Plantilla del mes anterior (`MM-1 FACT`/`COB`/`CONC`) para copiar formato. **(supuesto, confirmar)**

## Pasos

1. **Reúne las fuentes del mes:** pega el metadata SAT de CFDI y REP en `CFDIMES` y `PAGOS`; ten a la mano XML, estados de cuenta y balanza. Hecho cuando: `CFDIMES` y `PAGOS` tienen los CFDI/REP del mes.
2. **Crea las hojas del mes:** duplica las del mes anterior, renómbralas `MMFACT`/`MMCOB`/`MMCONC` y actualiza títulos (filas 1-3: razón social, concepto, "[MES AÑO]"). Hecho cuando: existen con el mes correcto.
3. **Llena `MMFACT`** (encabezado fila 6; datos desde la 7). Pega solo CFDI **vigentes** de Ingreso. Columnas: `UUID, TIPO, ESTATUS, FECHA EMISION, FECHA TIMBRADO, SERIE, FOLIO, CLIENTE, RFC, DLL, TP, NO OBJETO, TASA 0%, SUB AL 16%, IVA AL 16%, IVA RET, TOTAL, FP, MP, MX, CfdiRELACIONADOS, OBSERVACIONES`.
   - Dólares: `DLL = TOTAL / TP` (`=+Q7/K7`); el resto se pega del metadata.
   - Separa con subtotal: vigentes y **refacturaciones**; las **notas de crédito** (egreso, tipo 30, relación 07) van en `NC`.
4. **Totales de `MMFACT` y CONTABILIDAD:** al pie, `TOTAL VIGENTE (VIGENTES + REFACTURACIONES)` = suma de subtotales; la fila `CONTABILIDAD` se **captura a mano desde la balanza**; `DIFERENCIA = CONTABILIDAD − CÉDULA` en centavos. **(confirmado)** Hecho cuando: todas las DIFERENCIA quedan en centavos.
5. **Observaciones de facturación** (`CÓDIGO | SEVERIDAD | FOLIO(S) | CLIENTE | OBSERVACIÓN`): cancelaciones, sustituciones (04), anticipos, EFOS/listas negras, no objeto vs 0% vs 16%.
6. **Llena `MMCOB`** (un renglón por cobro/REP, agrupado por banco), 4 bloques:
   - **FACTURACIÓN:** CFDI cobrado (REP, estatus, fechas, serie, folio, cliente, RFC, DLLS, TC, importes, TOTAL, MP, UUID).
   - **COBRANZA:** cobrado. Pago total copia la facturación (`T=K…Y=P`); **parcialidad** se sobrescribe con la proporción.
   - **BANCO:** `DEPOSITO, TC, PESOS (=dep×TC), BANCO, FECHA DE COBRO`; `UTL/PERD` para fluctuación USD.
   - **REVISIÓN REP:** `FOLIO FISCAL REP, FECHA PAGO REP, REFERENCIA BANCARIA, PÓLIZA, TOTAL CFDI, NO. PARC., SALDO ANTERIOR, SALDO INSOLUTO, IVA SEGÚN REP, DIF. IVA PROPORCIÓN (=W8-AP8)`.
7. **Estados de cuenta** en `BANCO MM [BANCO]`: liga cada depósito a su REP e **identifica los que NO son cobranza** (préstamos, traspasos propios, devoluciones) para cuadrar banco sin duplicar ingresos.
8. **Cuadra `MMCOB`** (`TOTAL CÉDULA` = suma de subtotales por banco): IVA cobrado vs `[CUENTA 2104]`, IVA ret. vs `[CUENTA 1109]`, bancos/pesos vs `[CUENTA 1102]`; y depósitos vs `EDO DE CUENTA` por banco. Hecho cuando: diferencias en centavos.
9. **Genera la pestaña `MMCONC`** (conciliación factura por factura, **SIEMPRE separada**): **(confirmado)**
   - **Resumen con control en cero** (facturación vigente − cargos contables = 0).
   - **Facturas vigentes vs cargos contables** (por factura: póliza, diferencia, estatus).
   - **Canceladas del mes**.
   - **Cargos del auxiliar de clientes vs CFDI vigente**.
     Hecho cuando: el control del resumen da cero y cada factura queda conciliada o explicada.
10. **Actualiza la cartera** en `CLIENTES [AÑO]` ("INGRESOS PENDIENTES DE COBRO"): saldos insolutos. `CLIENTES` = año anterior.
11. **Redacta las observaciones del mes** en `MMCOB`: REP incluidos/excluidos por fecha de pago, parcialidades y saldo, proporción REP vs factura, compra de divisas y pérdida/ganancia cambiaria, traspasos entre cuentas.

## Formato de salida

- Tres hojas por mes: `MMFACT`, `MMCOB` y `MMCONC` (separada). **(confirmado)**
- `CLIENTES [AÑO]` con cartera actualizada; bloques de observaciones por factura y del mes.

## Reglas y criterios

- **Conciliación en pestaña separada `MMCONC`** (nunca embebida), con resumen en cero, vigentes vs cargos, canceladas y auxiliar vs CFDI. _Por qué:_ auditoría trazable. **(confirmado)**
- **CONTABILIDAD manual** desde balanza cada mes; si no se actualiza, la DIFERENCIA miente. **(confirmado)**
- **Parcialidades:** deja solo la parcialidad pendiente; `TOTAL = total CFDI − pagado` y prorratea subtotal, IVA y retenciones por `importe original × saldo / total original`, anotando en OBSERVACIONES. _Por qué:_ el cobro parcial no traslada el IVA completo.
- **Corte por fecha de pago del REP:** solo REP pagados en el mes; los pagados el mes siguiente van en `MM+1 COB`. _Por qué:_ el IVA se causa al cobro.
- **Depósitos que no son cobranza** se registran para cuadrar banco pero **no** suman a cobranza.
- **USD:** TC del DOF (hoja `TC`); el TC del REP debe coincidir; fluctuación a `UTL/PERD`.
- **Signos:** notas de crédito/egresos en negativo en `NC`.
- **Color amarillo** = dato de contabilidad pendiente o que requiere atención.
- **Nombres de hojas:** `MMFACT`, `MMCOB`, `MMCONC`, `BANCO MM [BANCO]`, `CLIENTES [AÑO]`, `CFDIMES`, `PAGOS`, `TC`, `NC`.
- **Redondeo:** 2 decimales; diferencias de cuadre en centavos.

## Ejemplos

- **Factura total (MXN):** `[FOLIO]` `[CLIENTE]` `[RFC]`, SUB `[IMPORTE]`, IVA 16% `[IMPORTE]`, TOTAL `[IMPORTE]`, MP=PPD; en `MMCOB` COBRANZA copia la facturación.
- **Factura USD:** TOTAL `[IMPORTE]` USD, `DLL=TOTAL/TP`; banco `PESOS=DEPOSITO×TC`, diferencia de TC a `UTL/PERD`.
- **Parcialidad:** `[FOLIO]` parc. 1 en REP `[FOLIO_REP]`; TOTAL = total − pagado, bases e IVA prorrateados, saldo insoluto por cobrar; nota en OBSERVACIONES.

## Errores frecuentes

1. **No actualizar la fila CONTABILIDAD** (se captura a mano de balanza): la DIFERENCIA miente. **(confirmado)**
2. **Títulos de hoja desactualizados** (`NC` decía "ENERO 2026" con datos de julio): revisar filas 1-3 al duplicar.
3. **Fechas en formato mixto** en BANCO (serial `46212` vs `14/09/2026`): homologar antes de ligar.
4. **Hojas duplicadas residuales** (`07COB (2)`, `02COB (2)`): eliminar o aislar.
5. **Conciliación embebida en vez de `MMCONC`** separada: migrarla a hoja aparte. **(confirmado)**
6. **Bloque COBRANZA por fórmula `=K8`…**: sobrescribir manualmente en parcialidades; si no, arrastra IVA de más.
7. **TC tecleado a mano en `MMFACT`** (no hace lookup a `TC`): riesgo de error.
8. **Pólizas omitidas "por instrucción"**: por defecto SÍ se capturan salvo indicación contraria.
9. **Catálogos largos** (uso CFDI, formas de pago, códigos de observación, cuentas): mover a archivo de referencia si crece.

## Pendientes por confirmar

- Herramienta/portal exacto del **metadata SAT** de CFDI y REP. **(supuesto)**
- Números de cuenta definitivos del cuadre de cobranza. **(observado: 2104 / 1109 / 1102, por confirmar)**
- Reglas del despacho no visibles en el libro (formato de fecha objetivo, paleta de colores oficial).
