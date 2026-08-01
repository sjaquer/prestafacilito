-- FASE 2: REFACTORIZACIÓN DE BASE DE DATOS Y CORRECCIÓN DEL SCHEMA

-- 2.2.1: Eliminar la tabla logs
DROP TABLE IF EXISTS logs CASCADE;

-- 2.2.2: Agregar campo apodo a clientes
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS apodo TEXT DEFAULT '';
COMMENT ON COLUMN clientes.apodo IS 'Alias o apodo del cliente para facilitar su identificación en búsquedas.';

-- 2.2.3: Agregar campo notas a prestamos
ALTER TABLE prestamos
ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT '';
COMMENT ON COLUMN prestamos.notas IS 'Notas libres del administrador sobre este préstamo.';

-- 2.2.5: Simplificar la tabla ajustes_prestamo
UPDATE ajustes_prestamo
SET tipo = 'congelar_interes_temporal'
WHERE tipo IN ('congelar_interes_permanente', 'eliminar_interes_cuota');

UPDATE ajustes_prestamo
SET tipo = 'acuerdo_especial',
    descripcion = CONCAT('(Migrado de tipo: ', tipo, ') ', COALESCE(descripcion, ''))
WHERE tipo IN ('reducir_mora', 'eliminar_mora', 'periodo_gracia');

ALTER TABLE ajustes_prestamo
DROP CONSTRAINT IF EXISTS ajustes_prestamo_tipo_check;

ALTER TABLE ajustes_prestamo
ADD CONSTRAINT ajustes_prestamo_tipo_check
CHECK (tipo IN ('congelar_interes_temporal', 'acuerdo_especial'));

ALTER TABLE ajustes_prestamo
DROP COLUMN IF EXISTS monto_afectado,
DROP COLUMN IF EXISTS monto_antes,
DROP COLUMN IF EXISTS monto_despues,
DROP COLUMN IF EXISTS periodo_gracia_dias;

-- 2.2.6: Crear la tabla alquileres y pagos_alquiler
CREATE TABLE IF NOT EXISTS alquileres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  monto_mensual NUMERIC NOT NULL CHECK (monto_mensual > 0),
  descripcion_inmueble TEXT DEFAULT '',
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin DATE,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado')),
  notas TEXT DEFAULT '',
  google_calendar_events JSONB DEFAULT '[]'::jsonb,
  fecha_registro TIMESTAMPTZ DEFAULT clock_timestamp()
);

COMMENT ON TABLE alquileres IS 'Contratos de alquiler de inmuebles. Entidad separada de préstamos.';
COMMENT ON COLUMN alquileres.monto_mensual IS 'Monto fijo a pagar cada mes por concepto de alquiler.';

CREATE TABLE IF NOT EXISTS pagos_alquiler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alquiler_id UUID NOT NULL REFERENCES alquileres(id) ON DELETE CASCADE,
  monto NUMERIC NOT NULL CHECK (monto > 0),
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  periodo_mes INTEGER NOT NULL,
  periodo_anio INTEGER NOT NULL,
  metodo_pago TEXT DEFAULT 'Efectivo',
  comprobante_url TEXT,
  voucher_drive_file_id TEXT,
  es_pago_completo BOOLEAN DEFAULT true,
  fecha_registro TIMESTAMPTZ DEFAULT clock_timestamp()
);

COMMENT ON TABLE pagos_alquiler IS 'Historial de pagos de alquiler por mes. Un registro por pago recibido.';

-- 2.2.7: Migrar datos existentes de alquileres
ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS migrado_a_alquiler BOOLEAN DEFAULT false;

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
  p.monto_capital,
  COALESCE(p.notas, ''),
  p.fecha_emision,
  p.fecha_vencimiento,
  CASE WHEN p.estado = 'activo' THEN 'activo' ELSE 'finalizado' END,
  '',
  p.fecha_emision
FROM prestamos p
WHERE p.tipo_prestamo = 'Alquiler de Casa'
ON CONFLICT (id) DO NOTHING;

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
  al.id,
  a.monto AS monto,
  a.fecha_pago,
  EXTRACT(MONTH FROM a.fecha_pago)::INTEGER AS periodo_mes,
  EXTRACT(YEAR FROM a.fecha_pago)::INTEGER AS periodo_anio,
  a.metodo_pago,
  a.comprobante_url,
  a.voucher_drive_file_id
FROM amortizaciones a
JOIN prestamos p ON a.prestamo_id = p.id AND p.tipo_prestamo = 'Alquiler de Casa'
JOIN alquileres al ON al.id = p.id
ON CONFLICT DO NOTHING;

UPDATE prestamos SET migrado_a_alquiler = true WHERE tipo_prestamo = 'Alquiler de Casa';

-- 2.2.8: Actualizar la vista resumen_financiero_clientes
DROP VIEW IF EXISTS resumen_financiero_clientes CASCADE;

CREATE VIEW resumen_financiero_clientes AS
SELECT
  c.id,
  c.id AS cliente_id,
  c.nombre_completo,
  c.apodo,
  c.telefono,
  c.observaciones,
  c.fecha_registro,
  c.direccion,
  c.numero_cuenta,
  c.banco_cuenta,
  c.informacion_adicional,
  c.drive_folder_id,
  COALESCE(COUNT(p.id) FILTER (WHERE (p.migrado_a_alquiler IS NULL OR p.migrado_a_alquiler = false)), 0) AS total_prestamos,
  COALESCE(COUNT(p.id) FILTER (WHERE p.estado = 'activo' AND (p.migrado_a_alquiler IS NULL OR p.migrado_a_alquiler = false)), 0) AS prestamos_activos,
  COALESCE(COUNT(p.id) FILTER (WHERE p.estado = 'pagado' AND (p.migrado_a_alquiler IS NULL OR p.migrado_a_alquiler = false)), 0) AS prestamos_liquidados,
  COALESCE(SUM(p.monto_capital) FILTER (WHERE (p.migrado_a_alquiler IS NULL OR p.migrado_a_alquiler = false)), 0) AS capital_total_prestado,
  COALESCE((
    SELECT SUM(a.monto)
    FROM amortizaciones a
    JOIN prestamos pr ON a.prestamo_id = pr.id
    WHERE pr.cliente_id = c.id
      AND (pr.migrado_a_alquiler IS NULL OR pr.migrado_a_alquiler = false)
  ), 0) AS total_amortizado,
  COALESCE(COUNT(al.id) FILTER (WHERE al.estado = 'activo'), 0) AS alquileres_activos
FROM clientes c
LEFT JOIN prestamos p ON c.id = p.cliente_id
LEFT JOIN alquileres al ON c.id = al.cliente_id
GROUP BY c.id, c.nombre_completo, c.apodo, c.telefono, c.observaciones,
         c.fecha_registro, c.direccion, c.numero_cuenta, c.banco_cuenta,
         c.informacion_adicional, c.drive_folder_id;
