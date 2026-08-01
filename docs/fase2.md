# FASE 2 — REFACTORIZACIÓN DE BASE DE DATOS Y CORRECCIÓN DEL SCHEMA

> **Objetivo:** Dejar el schema de BD alineado con la misión, los tipos TypeScript, y preparado para las nuevas entidades de las fases siguientes.  
> **Prioridad:** Alta — Sin un schema correcto, las fases 3–10 construirán sobre bases incorrectas.  
> **Duración estimada:** 2–3 días de desarrollo  
> **Prerequisito:** Fase 1 completada.

---

## 2.1 CONTEXTO Y PROPÓSITO

La base de datos actual tiene varias inconsistencias:
- Campos en TypeScript que no existen en SQL (y viceversa).
- Una tabla `logs` que debe eliminarse.
- Cálculos incorrectos en la vista SQL de clientes.
- Campos nuevos requeridos por la misión que no existen (`apodo`, `notas`).
- RLS habilitado sin policies (potencialmente bloqueante).
- No existe tabla `alquileres` (la lógica está mezclada en préstamos).
- No existe tabla/mecanismo para el score A/B/C.

Esta fase ejecuta todas las migraciones SQL necesarias y actualiza los tipos TypeScript para que coincidan exactamente con la BD real.

---

## 2.2 TAREAS DETALLADAS

### TAREA 2.2.1 — Eliminar la tabla `logs`

**SQL de migración:**
```sql
-- MIGRACIÓN: Eliminar tabla logs
DROP TABLE IF EXISTS logs CASCADE;
```

**Nota:** El `CASCADE` eliminará cualquier dependencia referencial existente.

**Verificación:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'logs';
-- Debe devolver 0 filas
```

---

### TAREA 2.2.2 — Agregar campo `apodo` a la tabla `clientes`

**Requerimiento:** Misión sección 7.2.

**SQL de migración:**
```sql
-- MIGRACIÓN: Agregar campo apodo a clientes
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS apodo TEXT DEFAULT '';

COMMENT ON COLUMN clientes.apodo IS 'Alias o apodo del cliente para facilitar su identificación en búsquedas.';
```

**Actualizar el type TypeScript `Cliente`:**
```typescript
export interface Cliente {
  id: string;
  nombre_completo: string;
  apodo: string;          // ← NUEVO
  telefono: string;
  observaciones: string;
  fecha_registro: string;
  direccion?: string;
  numero_cuenta?: string;
  banco_cuenta?: string;
  informacion_adicional?: string;
  drive_folder_id?: string;
  // Campos calculados desde la vista
  prestamos_activos?: number;
  total_prestamos?: number;
  capital_total_prestado?: number;
  total_exigible?: number;
  total_amortizado?: number;
  score?: 'A' | 'B' | 'C' | null;  // ← NUEVO (Fase 6)
}
```

---

### TAREA 2.2.3 — Agregar campo `notas` a la tabla `prestamos`

**Requerimiento:** El campo existe en el type TypeScript pero no en la BD.

**SQL de migración:**
```sql
-- MIGRACIÓN: Agregar campo notas a prestamos
ALTER TABLE prestamos
ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT '';

COMMENT ON COLUMN prestamos.notas IS 'Notas libres del administrador sobre este préstamo.';
```

---

### TAREA 2.2.4 — Eliminar campo `configuracion_ayuda` del type TypeScript

**Requerimiento:** Este campo no existe en BD. Eliminarlo del type para evitar confusión.

**Actualizar `src/types.ts`:**
```typescript
export interface Prestamo {
  id: string;
  cliente_id: string;
  monto_capital: number;
  tasa_interes_porcentaje: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: 'activo' | 'pagado';
  tipo_prestamo: string;
  notas?: string;  // ← ahora sí existe en BD
  // configuracion_ayuda eliminado ← ELIMINADO
}
```

---

### TAREA 2.2.5 — Simplificar la tabla `ajustes_prestamo`

**Requerimiento:** Simplificar de 6 tipos a 2 tipos (decisión acordada en el grill-me).

**SQL de migración:**
```sql
-- MIGRACIÓN: Simplificar tipos de ajuste
-- Paso 1: Archivar ajustes del tipo a eliminar (convertirlos a 'congelar_interes_temporal')
UPDATE ajustes_prestamo
SET tipo = 'congelar_interes_temporal'
WHERE tipo IN ('congelar_interes_permanente', 'eliminar_interes_cuota');

-- Paso 2: Archivar ajustes de mora (convertirlos a 'acuerdo_especial')
UPDATE ajustes_prestamo
SET tipo = 'acuerdo_especial',
    descripcion = CONCAT('(Migrado de tipo: ', tipo, ') ', COALESCE(descripcion, ''))
WHERE tipo IN ('reducir_mora', 'eliminar_mora', 'periodo_gracia');

-- Paso 3: Actualizar el CHECK constraint
ALTER TABLE ajustes_prestamo
DROP CONSTRAINT IF EXISTS ajustes_prestamo_tipo_check;

ALTER TABLE ajustes_prestamo
ADD CONSTRAINT ajustes_prestamo_tipo_check
CHECK (tipo IN ('congelar_interes_temporal', 'acuerdo_especial'));
```

**Actualizar el type TypeScript `AjustePrestamo`:**
```typescript
export interface AjustePrestamo {
  id: string;
  prestamo_id: string;
  tipo: 'congelar_interes_temporal' | 'acuerdo_especial';  // ← Simplificado
  cuota_numero?: number;          // Solo para congelar_interes_temporal
  fecha_inicio: string;
  fecha_fin?: string;             // Solo para congelar_interes_temporal
  descripcion?: string;           // Para acuerdo_especial: texto libre
  usuario: string;
  motivo: string;
  fecha_registro: string;
  activo: boolean;
  // Campos eliminados: monto_afectado, monto_antes, monto_despues, periodo_gracia_dias
}
```

**SQL: Eliminar columnas obsoletas:**
```sql
-- MIGRACIÓN: Eliminar columnas de ajustes no necesarias
ALTER TABLE ajustes_prestamo
DROP COLUMN IF EXISTS monto_afectado,
DROP COLUMN IF EXISTS monto_antes,
DROP COLUMN IF EXISTS monto_despues,
DROP COLUMN IF EXISTS periodo_gracia_dias;
```

---

### TAREA 2.2.6 — Crear la tabla `alquileres`

**Requerimiento:** Decisión acordada — los alquileres tienen tabla propia.

**SQL de migración:**
```sql
-- MIGRACIÓN: Crear tabla alquileres
CREATE TABLE IF NOT EXISTS alquileres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  
  -- Datos del contrato
  monto_mensual NUMERIC NOT NULL CHECK (monto_mensual > 0),
  descripcion_inmueble TEXT DEFAULT '',  -- Ej: "Casa Calle Los Pinos 123"
  
  -- Fechas del contrato
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin DATE,                        -- NULL = contrato indefinido/activo
  
  -- Estado
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado')),
  
  -- Integración
  notas TEXT DEFAULT '',
  google_calendar_events JSONB DEFAULT '[]'::jsonb,
  
  -- Auditoría
  fecha_registro TIMESTAMPTZ DEFAULT clock_timestamp()
);

COMMENT ON TABLE alquileres IS 'Contratos de alquiler de inmuebles. Entidad separada de préstamos.';
COMMENT ON COLUMN alquileres.monto_mensual IS 'Monto fijo a pagar cada mes por concepto de alquiler.';
```

**SQL: Crear tabla de pagos de alquiler:**
```sql
-- MIGRACIÓN: Crear tabla pagos_alquiler
CREATE TABLE IF NOT EXISTS pagos_alquiler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alquiler_id UUID NOT NULL REFERENCES alquileres(id) ON DELETE CASCADE,
  
  -- Datos del pago
  monto NUMERIC NOT NULL CHECK (monto > 0),
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  periodo_mes INTEGER NOT NULL,          -- Número de mes al que corresponde (1, 2, 3...)
  periodo_anio INTEGER NOT NULL,         -- Año al que corresponde
  
  -- Método y comprobante
  metodo_pago TEXT DEFAULT 'Efectivo',
  comprobante_url TEXT,
  voucher_drive_file_id TEXT,
  
  -- Estado
  es_pago_completo BOOLEAN DEFAULT true, -- false si fue pago parcial
  
  -- Auditoría
  fecha_registro TIMESTAMPTZ DEFAULT clock_timestamp()
);

COMMENT ON TABLE pagos_alquiler IS 'Historial de pagos de alquiler por mes. Un registro por pago recibido.';
```

---

### TAREA 2.2.7 — Migrar datos existentes de alquileres

**SQL de migración:**
```sql
-- MIGRACIÓN: Mover alquileres existentes de prestamos a alquileres
-- PASO 1: Insertar alquileres existentes en la nueva tabla
INSERT INTO alquileres (
  id,
  cliente_id,
  monto_mensual,
  descripcion_inmueble,
  fecha_inicio,
  fecha_fin,
  estado,
  notas,
  fecha_registro
)
SELECT
  p.id,
  p.cliente_id,
  p.monto_capital,       -- En préstamos de alquiler, capital = monto mensual
  COALESCE(p.notas, ''),
  p.fecha_emision,
  p.fecha_vencimiento,
  CASE WHEN p.estado = 'activo' THEN 'activo' ELSE 'finalizado' END,
  '',
  p.fecha_emision
FROM prestamos p
WHERE p.tipo_prestamo = 'Alquiler de Casa';

-- PASO 2: Migrar pagos de alquiler
-- Los pagos se infieren del número de mes relativo a fecha_inicio
INSERT INTO pagos_alquiler (
  alquiler_id,
  monto,
  fecha_pago,
  periodo_mes,
  periodo_anio,
  metodo_pago,
  comprobante_url,
  voucher_drive_file_id
)
SELECT
  a.monto AS monto,
  a.fecha_pago,
  EXTRACT(MONTH FROM a.fecha_pago)::INTEGER AS periodo_mes,
  EXTRACT(YEAR FROM a.fecha_pago)::INTEGER AS periodo_anio,
  a.metodo_pago,
  a.comprobante_url,
  a.voucher_drive_file_id
FROM amortizaciones a
JOIN prestamos p ON a.prestamo_id = p.id
  AND p.tipo_prestamo = 'Alquiler de Casa'
JOIN alquileres al ON al.id = p.id;

-- PASO 3: Marcar los préstamos de alquiler como migrados (no eliminar aún, esperar confirmación)
-- Se eliminarán en la Fase 3 después de validar la migración
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS migrado_a_alquiler BOOLEAN DEFAULT false;
UPDATE prestamos SET migrado_a_alquiler = true WHERE tipo_prestamo = 'Alquiler de Casa';
```

> **⚠️ IMPORTANTE:** Los registros de alquiler en `prestamos` NO se eliminan en esta fase. Se marcan con `migrado_a_alquiler = true`. La eliminación definitiva ocurre en la Fase 3, después de verificar que la migración fue exitosa.

---

### TAREA 2.2.8 — Actualizar la vista `resumen_financiero_clientes`

**Requerimiento:** La vista actual calcula `total_exigible` incorrectamente (usa interés simple sin considerar pagos). Se debe eliminar ese cálculo erróneo.

**SQL de migración:**
```sql
-- MIGRACIÓN: Actualizar vista de resumen financiero
CREATE OR REPLACE VIEW resumen_financiero_clientes AS
SELECT
  c.id,
  c.id AS cliente_id,
  c.nombre_completo,
  c.apodo,                        -- ← NUEVO
  c.telefono,
  c.observaciones,
  c.fecha_registro,
  c.direccion,
  c.numero_cuenta,
  c.banco_cuenta,
  c.informacion_adicional,
  c.drive_folder_id,
  
  -- Conteos de préstamos (excluyendo alquileres migrados)
  COALESCE(COUNT(p.id) FILTER (WHERE (p.migrado_a_alquiler IS NULL OR p.migrado_a_alquiler = false)), 0) AS total_prestamos,
  COALESCE(COUNT(p.id) FILTER (WHERE p.estado = 'activo' AND (p.migrado_a_alquiler IS NULL OR p.migrado_a_alquiler = false)), 0) AS prestamos_activos,
  COALESCE(COUNT(p.id) FILTER (WHERE p.estado = 'pagado' AND (p.migrado_a_alquiler IS NULL OR p.migrado_a_alquiler = false)), 0) AS prestamos_liquidados,
  
  -- Capital total prestado (solo préstamos, no alquileres)
  COALESCE(SUM(p.monto_capital) FILTER (WHERE (p.migrado_a_alquiler IS NULL OR p.migrado_a_alquiler = false)), 0) AS capital_total_prestado,
  
  -- Total amortizado (pagos recibidos de préstamos)
  COALESCE((
    SELECT SUM(a.monto)
    FROM amortizaciones a
    JOIN prestamos pr ON a.prestamo_id = pr.id
    WHERE pr.cliente_id = c.id
      AND (pr.migrado_a_alquiler IS NULL OR pr.migrado_a_alquiler = false)
  ), 0) AS total_amortizado,
  
  -- Alquileres activos
  COALESCE(COUNT(al.id) FILTER (WHERE al.estado = 'activo'), 0) AS alquileres_activos

FROM clientes c
LEFT JOIN prestamos p ON c.id = p.cliente_id
LEFT JOIN alquileres al ON c.id = al.cliente_id
GROUP BY c.id, c.nombre_completo, c.apodo, c.telefono, c.observaciones,
         c.fecha_registro, c.direccion, c.numero_cuenta, c.banco_cuenta,
         c.informacion_adicional, c.drive_folder_id;
```

**Nota:** El campo `total_exigible` se elimina de la vista porque solo puede calcularse correctamente con `buildPaymentSchedule` en el servidor.

---

### TAREA 2.2.9 — Actualizar los endpoints de API para incluir `apodo` y `notas`

**En `routes/clientes.routes.ts`:**
- `POST /api/clientes`: Incluir `apodo` en el insert.
- `PUT /api/clientes/:id`: Incluir `apodo` en el update.
- Asegurarse de que la respuesta incluye `apodo`.

**En `routes/prestamos.routes.ts`:**
- `POST /api/prestamos`: Incluir `notas` en el insert.
- `PUT /api/prestamos/:id`: Incluir `notas` en el update.

---

### TAREA 2.2.10 — Archivar `supabase_schema.sql` y crear uno actualizado

**Qué hacer:**
- Renombrar `supabase_schema.sql` → `supabase_schema_v1_legacy.sql` (referencia histórica).
- Crear `supabase_schema.sql` con el schema completo actualizado (incluyendo todas las tablas y la nueva vista).

---

## 2.3 PRUEBAS Y VERIFICACIÓN

1. **Verificar tabla logs eliminada:**
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'logs'; -- 0 filas
```

2. **Verificar campo `apodo` existe:**
```sql
SELECT apodo FROM clientes LIMIT 1;
```

3. **Verificar campo `notas` en prestamos:**
```sql
SELECT notas FROM prestamos LIMIT 1;
```

4. **Verificar tabla `alquileres` creada:**
```sql
SELECT COUNT(*) FROM alquileres; -- Debe mostrar los alquileres migrados
```

5. **Verificar tipos de ajuste:**
```sql
SELECT DISTINCT tipo FROM ajustes_prestamo;
-- Solo debe mostrar: congelar_interes_temporal, acuerdo_especial
```

6. **Verificar vista actualizada:**
```sql
SELECT nombre_completo, apodo, prestamos_activos, prestamos_liquidados FROM resumen_financiero_clientes LIMIT 5;
```

---

## 2.4 RIESGOS

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Error en la migración de alquileres | Media | Ejecutar la migración en un entorno de staging primero. Hacer backup antes. |
| Pérdida de datos al simplificar ajustes | Baja | Los tipos antiguos se convierten a los nuevos, no se eliminan. |
| Vista rota por cambio de schema | Media | Probar la vista después de cada cambio con `SELECT * FROM resumen_financiero_clientes LIMIT 1`. |

---

## 2.5 DEPENDENCIAS

- **Prerequisito:** Fase 1 completada.
- **Bloquea:** Fase 3 (nueva lógica de alquileres), Fase 6 (score de clientes).
