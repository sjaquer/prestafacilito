# DOCUMENTACIÓN TÉCNICA DE BASE DE DATOS (SUPABASE / POSTGRESQL)

## PrestaFacilito — Esquema Oficial Unificado

Este documento describe la estructura exacta de tablas, campos, tipos de datos y vistas SQL activas en la base de datos de Supabase del proyecto **PrestaFacilito** (`mvusegasjopczjziupts`).

---

## 1. Tablas Principales

### 1.1 `public.clientes`
Almacena el directorio principal de personas prestatarias e inquilinos.

| Columna | Tipo | Nulable | Descripción |
|---|---|---|---|
| `id` | `uuid` | NO | Clave primaria (`gen_random_uuid()`) |
| `nombre_completo` | `text` | NO | Nombre y apellidos del cliente |
| `apodo` | `text` | SÍ | Alias o apodo comercial para reconocimieto rápido |
| `telefono` | `text` | SÍ | Número de teléfono sanitizado con código de país (ej. `519...`) |
| `direccion` | `text` | SÍ | Dirección de residencia |
| `numero_cuenta` | `text` | SÍ | Número de cuenta bancaria o CCI |
| `banco_cuenta` | `text` | SÍ | Banco emisor (BCP, BBVA, Interbank, Yape, etc.) |
| `informacion_adicional` | `text` | SÍ | Notas libres |
| `drive_folder_id` | `text` | SÍ | ID de la carpeta contenedora en Google Drive |
| `fecha_registro` | `date` | SÍ | Fecha de alta en el sistema |

---

### 1.2 `public.prestamos`
Almacena los contratos de préstamos personales o comerciales.

| Columna | Tipo | Nulable | Descripción |
|---|---|---|---|
| `id` | `uuid` | NO | Clave primaria |
| `cliente_id` | `uuid` | NO | FK $\rightarrow$ `clientes(id)` |
| `monto_capital` | `numeric` | NO | Monto del capital desembolsado en Soles (S/.) |
| `tasa_interes_porcentaje` | `numeric` | SÍ | Tasa mensual de interés (0% – 35%) |
| `fecha_emision` | `date` | SÍ | Fecha de otorgamiento del préstamo |
| `fecha_vencimiento` | `date` | SÍ | Fecha límite pactada o día de cobro de cuota mensual |
| `estado` | `text` | SÍ | `'activo'` o `'pagado'` |
| `tipo_prestamo` | `text` | SÍ | Categoría: `'Personal'`, `'Negocio'`, `'Alquiler de Casa'`, etc. |
| `configuracion_ayuda` | `jsonb` | SÍ | Parámetros auxiliares de cálculo |
| `google_calendar_events` | `jsonb` | SÍ | IDs de eventos vinculados en Google Calendar |
| `notas` | `text` | SÍ | Observaciones particulares |

---

### 1.3 `public.amortizaciones`
Registro de abonos, pagos de cuotas e intereses de préstamos.

| Columna | Tipo | Nulable | Descripción |
|---|---|---|---|
| `id` | `uuid` | NO | Clave primaria |
| `prestamo_id` | `uuid` | NO | FK $\rightarrow$ `prestamos(id)` |
| `tipo_movimiento` | `text` | SÍ | `'Amortización parcial'`, `'Pago adelantado / múltiple'`, etc. |
| `monto` | `numeric` | NO | Monto cobrado efectivamente en Soles (S/.) |
| `fecha_pago` | `date` | SÍ | Fecha del comprobante de pago |
| `metodo_pago` | `text` | SÍ | `'Efectivo'`, `'Yape'`, `'Plin'`, `'Transferencia BBVA'`, etc. |
| `comprobante_url` | `text` | SÍ | URL del proxy local `/api/vouchers/proxy/...` |
| `voucher_drive_file_id` | `text` | SÍ | ID del archivo subido a Google Drive |

---

### 1.4 `public.alquileres`
Contratos de arrendamiento de propiedades inmuebles.

| Columna | Tipo | Nulable | Descripción |
|---|---|---|---|
| `id` | `uuid` | NO | Clave primaria |
| `cliente_id` | `uuid` | NO | FK $\rightarrow$ `clientes(id)` (Inquilino) |
| `monto_mensual` | `numeric` | NO | Renta mensual fija pactada |
| `descripcion_inmueble` | `text` | SÍ | Nombre o dirección del predio/local |
| `fecha_inicio` | `date` | NO | Fecha de inicio del contrato |
| `fecha_fin` | `date` | SÍ | Fecha de término acordada |
| `estado` | `text` | SÍ | `'activo'` o `'finalizado'` |
| `notas` | `text` | SÍ | Comentarios adicionales |
| `google_calendar_events` | `jsonb` | SÍ | Identificadores de eventos en Google Calendar |
| `fecha_registro` | `timestamp` | SÍ | Marca de tiempo de creación |

---

### 1.5 `public.pagos_alquiler`
Historial de pagos de mensualidades de alquiler por período.

| Columna | Tipo | Nulable | Descripción |
|---|---|---|---|
| `id` | `uuid` | NO | Clave primaria |
| `alquiler_id` | `uuid` | NO | FK $\rightarrow$ `alquileres(id)` |
| `monto` | `numeric` | NO | Monto abonado por la renta |
| `fecha_pago` | `date` | NO | Fecha del depósito/cobro |
| `periodo_mes` | `integer` | NO | Mes de la mensualidad cubierta (1–12) |
| `periodo_anio` | `integer` | NO | Año de la mensualidad cubierta (ej. 2026) |
| `metodo_pago` | `text` | SÍ | Medio de pago utilizado |
| `comprobante_url` | `text` | SÍ | URL del comprobante/proxy |
| `voucher_drive_file_id` | `text` | SÍ | ID en Google Drive |
| `es_pago_completo` | `boolean` | SÍ | `true` si cubrió la renta completa |
| `fecha_registro` | `timestamp` | SÍ | Fecha de registro |

---

### 1.6 `public.score_clientes`
Evaluación de comportamiento de pago A/B/C por cliente.

| Columna | Tipo | Nulable | Descripción |
|---|---|---|---|
| `id` | `uuid` | NO | Clave primaria |
| `cliente_id` | `uuid` | NO | FK $\rightarrow$ `clientes(id)` |
| `score_letra` | `text` | SÍ | `'A'`, `'B'`, `'C'` (Calculado algorítmicamente) |
| `score_numerico` | `numeric` | SÍ | Puntuación de 0 a 100 |
| `score_manual` | `text` | SÍ | Sobreescritura manual ejercida por el usuario |
| `motivo_override` | `text` | SÍ | Explicación del ajuste de categoría |
| `ultima_actualizacion` | `timestamp` | SÍ | Fecha de cálculo |

---

### 1.7 `public.ajustes_prestamo`
Registro de acuerdos de facilidad de pago o congelamiento de intereses.

| Columna | Tipo | Nulable | Descripción |
|---|---|---|---|
| `id` | `uuid` | NO | Clave primaria |
| `prestamo_id` | `uuid` | NO | FK $\rightarrow$ `prestamos(id)` |
| `tipo` | `text` | NO | `'congelar_interes_temporal'`, `'reestructuracion'`, etc. |
| `cuota_numero` | `integer` | SÍ | Número de cuota donde se aplica |
| `fecha_inicio` | `date` | NO | Inicio de la suspensión de interés |
| `fecha_fin` | `date` | SÍ | Término de la suspensión |
| `descripcion` | `text` | SÍ | Detalle del acuerdo |
| `usuario` | `text` | NO | Usuario que autorizó |
| `motivo` | `text` | NO | Justificación del arreglo |
| `activo` | `boolean` | SÍ | Estado del ajuste |

---

## 2. Vista de Agregación SQL

### `public.resumen_financiero_clientes`

```sql
DROP VIEW IF EXISTS public.resumen_financiero_clientes CASCADE;

CREATE VIEW public.resumen_financiero_clientes AS
SELECT 
  c.id,
  c.nombre_completo,
  c.apodo,
  c.telefono,
  c.direccion,
  c.fecha_registro,
  c.numero_cuenta,
  c.banco_cuenta,
  c.informacion_adicional,
  c.drive_folder_id,
  COALESCE(sc.score_manual, sc.score_letra) AS score_efectivo,
  sc.score_numerico,
  (sc.score_manual IS NOT NULL) AS score_sobreescrito,
  COUNT(DISTINCT CASE WHEN p.estado = 'activo' THEN p.id END)::integer AS prestamos_activos,
  COUNT(DISTINCT CASE WHEN p.estado = 'pagado' THEN p.id END)::integer AS prestamos_liquidados,
  COUNT(DISTINCT p.id)::integer AS total_prestamos,
  COALESCE(SUM(p.monto_capital), 0) AS capital_total_prestado,
  COALESCE(SUM(CASE WHEN p.estado = 'activo' THEN p.monto_capital ELSE 0 END), 0) AS capital_activo_total,
  COUNT(DISTINCT CASE WHEN al.estado = 'activo' THEN al.id END)::integer AS alquileres_activos,
  COUNT(DISTINCT al.id)::integer AS total_alquileres
FROM public.clientes c
LEFT JOIN public.prestamos p ON c.id = p.cliente_id
LEFT JOIN public.alquileres al ON c.id = al.cliente_id
LEFT JOIN public.score_clientes sc ON c.id = sc.cliente_id
GROUP BY 
  c.id, c.nombre_completo, c.apodo, c.telefono, c.direccion, c.fecha_registro, 
  c.numero_cuenta, c.banco_cuenta, c.informacion_adicional, c.drive_folder_id, 
  sc.score_manual, sc.score_letra, sc.score_numerico;
```
