# GUÍA — Lógica, Matemática y Gestión de Pagos en PrestaFacilito

> Documento para el **dueño/operador** de la plataforma. Explica, en lenguaje claro,
> **cómo piensa** el sistema: cómo calcula cada préstamo, cómo reparte cada pago,
> qué pasa en cada escenario y qué archivos se encargan de la matemática.

---

## 0. Índice rápido

1. [Cuál es el &#34;cerebro&#34; de la app](#1-cual-es-el-cerebro-de-la-app)
2. [Cómo se arma un préstamo (el cronograma)](#2-como-se-arma-un-prestamo-el-cronograma)
3. [Cómo reparte un pago el sistema](#3-como-reparte-un-pago-el-sistema)
4. [¿Qué pasa cuando…? (escenarios típicos)](#4-que-pasa-cuando-escenarios-tipicos)
5. [Estados de una cuota y de un préstamo](#5-estados-de-una-cuota-y-de-un-prestamo)
6. [Registrar / editar / eliminar un pago](#6-registrar--editar--eliminar-un-pago)
7. [Cómo mide el atraso (mora)](#7-como-mide-el-atraso-mora)
8. [Cómo evalúa el score A/B/C del cliente](#8-como-evalua-el-score-abc-del-cliente)
9. [Los voucher / comprobantes](#9-los-voucher--comprobantes)
10. [Archivos que hacen la matemática](#10-archivos-que-hacen-la-matematica)
11. [Glosario de términos](#11-glosario-de-terminos)

---

## 1. Cuál es el "cerebro" de la app

La matemática de la app vive en estos archivos:

| Archivo                        | Qué hace                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `src/lib/loanLogic.ts`       | **El corazón.** Calcula el cronograma de cuotas, reparte cada pago y clasifica el tipo de pago. |
| `src/lib/moraLogic.ts`       | Mide si el cliente está al día o tiene mora (atraso).                                                |
| `src/lib/scoreLogic.ts`      | Calcula el score A/B/C de cada cliente (0–100).                                                       |
| `src/lib/formatters.ts`      | Formatea montos, fechas, teléfonos, y arma los mensajes de cobro por WhatsApp.                        |
| `src/lib/validators.ts`      | Valida DNI, RUC, teléfono, montos e intereses permitidos.                                             |
| `src/lib/constants.ts`       | La lista única de métodos de pago y su banco.                                                        |
| `routes/prestamos.routes.ts` | Los "puntos de entrada": registrar, editar y eliminar pagos desde el servidor.                         |

Toda la app **recalcula todo desde cero** cada vez: dado el préstamo y su lista de pagos,
vuelve a construir el cronograma día a día. No hay números guardados "de memoria";
todo se vuelve a calcular. Eso significa que **si corriges un pago, todo se recalcula bien.**

---

## 2. Cómo se arma un préstamo (el cronograma)

El sistema usa un modelo **francés adaptativo**: cada mes se amortiza **la misma fracción de capital**
y el interés se cobra sobre el capital aún pendiente, por lo que **la cuota va bajando mes a mes**.

### Datos que necesita cada préstamo

- **Capital** (`monto_capital`): el monto prestado.
- **Tasa mensual** (`tasa_interes_porcentaje`): interés **por mes** (ej. 10 = 10% mensual).
- **Fecha de emisión** (`fecha_emision`) y **fecha de vencimiento** (`fecha_vencimiento`): sirven para saber cuántas cuotas pactadas hay.
- **Estado** (`activo` o `pagado`).

### Cuántas cuotas genera

Se usa el mayor entre:

1. Las cuotas **pactadas** (días entre emisión y vencimiento ÷ 30), y
2. Los **meses transcurridos** desde la emisión hasta hoy (+1).

> Regla importante: **si el préstamo ya está PAGADO o CANCELADO, se congela el cronograma**
> en el mes del último pago. Así **jamás vuelve a generarse interés** después de haberse saldado.
> (Esto se arregló recientemente para que un préstamo pagado no siga "creciendo".)

### Fórmulas por cuota `n`

```
Amortización de capital por cuota = Capital ÷ total de cuotas
Interés del mes n        = Capital restante al inicio de ese mes × tasa mensual
Cuota base del mes n     = Amortización de capital + Interés del mes
```

La cuota baja cada mes porque el interés se calcula sobre cada vez **menos capital**.

### Fecha de vencimiento de cada cuota

Es la fecha de emisión **+ n meses** (ajustando al último día del mes si hace falta).
Ej.: emisión 26/01 → cuota 1 vence 26/02, cuota 2 vence 26/03, etc.

### Interés congelado (ajuste)

Si el préstamo tiene un ajuste **"congelar interés"** que cubre la fecha de una cuota,
esa cuota se calcula **sin interés** (solo amortización de capital). Sirve para dar
beneficios temporales (caso social, acuerdos, etc.).

---

## 3. Cómo reparte un pago el sistema

Cuando registras un abono, el sistema **no lo "guarda tal cual"**: lo *distribuye* sobre las cuotas.
Este es el orden exacto (y fue corregido recientemente):

### Paso 1 — Cubre la primera cuota pendiente (interés + capital)

El pago se aplica a la **primera cuota que todavía no está saldada**, en este orden:

1. Primero paga el **interés pendiente** de esa cuota.
2. Lo que quede paga la **amortización de capital** de esa cuota.

### Paso 2 — El excedente va DIRECTO a bajar capital

Si después de cubrir esa cuota **todavía sobra dinero**, el excedente **reduce el capital**
de las cuotas siguientes. **No cobra interés futuro** con ese excedente.

> Esto corrige el problema anterior donde un pago se "dividía en 2 meses" y cobraba
> interés de dos cuotas. Ahora: si pagaste completo una cuota, esa cuota se sada,
> y lo que sobra baja directamente el capital (adelanto de capital, sin interés fantasma).

### Paso 3 — Si aún sobra y todo el capital está cubierto…

Solo cuando **ya se pagó todo el capital** de todas las cuotas, lo que quede se usa para
**cubrir el interés pendiente**. Esto es lo que permite que una **liquidación total**
(que paga intereses + capital) deje el préstamo en **S/ 0.00**.

### Resumen de lo que produce cada pago

El sistema guarda en cada cuota qué parte fue **interés** y qué parte fue **capital**, y
con eso obtiene los totales del préstamo:

```
Capital pendiente = lo que aún debes de capital
Interés pendiente  = lo que aún debes de interés
Saldo / Deuda total = Capital pendiente + Interés pendiente
```

---

## 4. ¿Qué pasa cuando…? (escenarios típicos)

| Situación                                          | Qué hace el sistema                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Pagas**exactamente** el valor de una cuota    | Sada esa cuota (queda**SALDADA**). No toca las demás.                                                  |
| Pagas la cuota**completa + algo más**        | La cuota se sada y**el sobrante baja capital** de la siguiente cuota (y siguientes).                    |
| Pagas**menos** de una cuota                   | Primero cubre el**interés**, y lo que quede va a **capital**. La cuota queda **PARCIAL**.  |
| Pagas todo lo que se debe (capital + intereses)     | **LIQUIDACIÓN total**: todas las cuotas quedan saldadas y el préstamo pasa a estado **PAGADO**. |
| El pago intenta ser**mayor** a la deuda total | El sistema lo**rechaza** con aviso: no puedes pagar más de lo que debes.                               |
| Creas un pago con fecha futura a la cuota           | Se considera**pago adelantado**: aplica a la siguiente cuota, y el excedente baja capital.              |
| Borras o editas un pago                             | Todo se**recalcula**; si el saldo vuelve a ser > 0, el préstamo regresa a **ACTIVO**.            |
| El préstamo está**PAGADO**                  | El cronograma**se congela**: no aparece ni se cobra más interés.                                      |

### Detalle: cómo se clasifica el tipo de pago

Al registrar, el sistema le pone una etiqueta automática según el monto:

- **Liquidación total** → pagas >= toda la deuda.
- **Pago exacto de cuota** → pagas justo el valor de la siguiente cuota.
- **Pago adelantado / múltiple** → pagas una cuota futura o de más antes de vencer.
- **Amortización parcial** → pagas menos de una cuota completa.
- **Amortización de capital** → cuando el excedente se destina solo a bajar capital.

---

## 5. Estados de una cuota y de un préstamo

### Estado de cada cuota

- **SALDADA** → ya está pagada por completo (saldo S/ 0.00).
- **PARCIAL** → recibió un pago pero aún le falta.
- **VENCIDA** → su fecha de vencimiento ya pasó y no está saldada.
- **PENDIENTE** → aún no vence y no está saldada.

### Estado del préstamo

- **ACTIVO** → aún tiene saldo por cobrar.
- **PAGADO** → saldo S/ 0.00; se congela y no genera más interés.

El sistema **cambia el estado automáticamente** después de registrar, editar o borrar pagos.

---

## 6. Registrar / editar / eliminar un pago

### Registrar (el flujo completo)

1. El sistema **valida** que el monto sea mayor a 0 y **no exceda** la deuda pendiente.
2. **Clasifica** automáticamente el tipo de pago (ver sección 4).
3. Guarda el pago (monto, fecha, método, comprobante opcional).
4. **Recalcula** toda la deuda.
5. Si el saldo quedó en S/ 0.00 → préstamo **PAGADO**.
6. Sincroniza el calendario (si está activo).

**Nota de archivos:** el registro se hace por el endpoint `POST /api/prestamos/:id/pagos`
(el cual ya corregimos; antes un formulario usaba una ruta que no existía).

### Editar

Puedes cambiar fecha, monto, método o reasignar el préstamo al que pertenece el pago.
El sistema **recalcula** el préstamo viejo **y** el nuevo, y ajusta el estado automáticamente.

### Eliminar

Borra el abono y **recalcula** la deuda. Si el préstamo estaba pagado y deja de estarlo,
vuelve automáticamente a **ACTIVO**. **Cuidado:** eliminar un pago reincrementa la deuda del cliente.

---

## 7. Cómo mide el atraso (mora)

`src/lib/moraLogic.ts` te da el **semáforo** rápido de cada préstamo. Usa una **cuota de referencia**
muy simple: *capital × tasa mensual* (o el capital si la tasa es 0).

Recorre mes a mes desde la emisión restando esa cuota de lo pagado, y llega a uno de estos estados:

| Estado             | Significado                                           |
| ------------------ | ----------------------------------------------------- |
| `al_dia`         | Está al corriente (o el préstamo ya está saldado). |
| `pendiente_mes`  | La siguiente cuota aún**no vence**.            |
| `mora_mes`       | Tiene**1 cuota vencida**.                       |
| `mora_acumulada` | Tiene**2 o más cuotas vencidas**.              |

**Datos que te entrega:** cuántas cuotas lleva atrasadas, el monto total atrasado,
los días de atraso, cuántos días faltan para la próxima cuota, fecha y monto de la
próxima cuota, y el último pago registrado.

> Esta lógica también genera los **recordatorios por WhatsApp**: cuando detecta mora
> manda un mensaje de "recordatorio de cuota pendiente"; caso contrario, un mensaje de
> "su cuota está a punto de vencer".

---

## 8. Cómo evalúa el score A/B/C del cliente

`src/lib/scoreLogic.ts` convierte el historial en una nota de **0 a 100**:

| Factor          | Peso | Qué mide                                                              |
| --------------- | ---- | ---------------------------------------------------------------------- |
| Puntualidad     | 40%  | % de cuotas pagadas**a tiempo** (tocó la fecha de vencimiento). |
| Completitud     | 25%  | % de cuotas pagadas**por completo**.                             |
| Liquidación    | 20%  | % de préstamos**liquidados** totalmente.                        |
| Atraso promedio | 15%  | Más atraso = menos puntos (1 − días de atraso promedio ÷ 30).      |

**Resultado en letra:**

- **A** → >= 70 (cliente excelente)
- **B** → entre 40 y 69 (cliente regular)
- **C** → menor a 40 (cliente riesgoso)

> El score tambi�n puede ser **sobreescrito manualmente** (poner A/B/C a mano) por si
> conoces al cliente de otra forma. Esa nota manual gana sobre la automática.

---

## 9. Los voucher / comprobantes

- Un pago puede tener **1 o varios** comprobantes.
- El campo `comprobante_url` guarda: una sola URL, varias separadas por coma, o un **array JSON** de varias.
- La **Galería de Vouchers** muestra **todas** las imágenes/PDF de cada pago en una mini-galería
  (antes solo mostraba la primera — ya corregido).
- Los archivos viven en **Google Drive**; la app los muestra mediante un **proxy** validando que
  el comprobante esté registrado en el sistema (por seguridad).
- Se aceptan **imágenes y PDF**.

---

## 10. Archivos que hacen la matemática

| Archivo                        | Función                                       | Notas clave                                                                            |
| ------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/lib/loanLogic.ts`       | Cronograma + reparto de pagos + clasificación | **El más importante.** Contiene `buildPaymentSchedule` y `classifyPayment`. |
| `src/lib/moraLogic.ts`       | Semáforo de atraso                            | `calcularEstadoMora`. Modelo simplificado para "al día / mora".                     |
| `src/lib/scoreLogic.ts`      | Nota A/B/C                                     | `calcularScoreCliente`.                                                              |
| `src/lib/formatters.ts`      | Formato de dinero/fechas + mensajes            | `formatCurrency`, `parseVoucherUrls`, `generarMensajeCobroPredeterminado`.       |
| `src/lib/validators.ts`      | Reglas de negocio de entrada                   | DNI 8 díg., RUC 11, teléfono +51, montos, intereses 0–100%.                         |
| `src/lib/constants.ts`       | Métodos de pago y bancos                      | Fuente única: Yape, Plin, transferencias, Efectivo.                                   |
| `routes/prestamos.routes.ts` | Endpoints de pagos                             | Registrar, editar, eliminar, validar y recalcular.                                     |
| `src/hooks/usePagos.ts`      | Funciones que usa el frontend                  | Subir voucher, listar, actualizar, eliminar pagos.                                     |

---

## 11. Glosario de términos

- **Cuota** = mensualidad del préstamo.
- **Amortización** = la parte de la cuota que **baja el capital** prestado.
- **Interés** = el costo del dinero de ese mes (monto pendiente × tasa mensual).
- **Cuota base / Cuota esperada** = interés + amortización de ese mes (lo que se espera pagar).
- **Saldo pendiente / Deuda total** = capital pendiente + interés pendiente.
- **Liquidación total** = pago que deja la deuda en **S/ 0.00**.
- **Abono / Amortización (registro)** = cada uno de los pagos guardados del cliente.
- **Pago adelantado** = pagar una cuota antes de que venza; su excedente baja capital.
- **Excedente** = el dinero de un pago que sobra tras cubrir la cuota pendiente; **va a capital**.
- **Mora** = cuota(s) vencida(s) sin pagar.
- **Score** = calificación del riesgo del cliente (A/B/C).

---

*Este documento describe la lógica vigente del sistema. Cada vez que se cambie el reparto
de pagos o el cálculo de cuotas, actualiza este documento.*
