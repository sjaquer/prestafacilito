-- PRESTAFACILITO — SCHEMA COMPLETO DE BASE DE DATOS (Fase 2)
-- Base de Datos: PostgreSQL / Supabase

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo TEXT NOT NULL,
  apodo TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  observaciones TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  numero_cuenta TEXT DEFAULT '',
  banco_cuenta TEXT DEFAULT '',
  informacion_adicional TEXT DEFAULT '',
  drive_folder_id TEXT DEFAULT '',
  fecha_registro TIMESTAMPTZ DEFAULT clock_timestamp()
);

COMMENT ON TABLE clientes IS 'Directorio principal de clientes prestatarios y arrendatarios.';
COMMENT ON COLUMN clientes.apodo IS 'Alias o apodo del cliente para facilitar búsquedas.';

-- 2. TABLA: prestamos
CREATE TABLE IF NOT EXISTS prestamos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  monto_capital NUMERIC NOT NULL CHECK (monto_capital > 0),
  tasa_interes_porcentaje NUMERIC NOT NULL DEFAULT 0,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'pagado')),
  tipo_prestamo TEXT DEFAULT 'Personal',
  notas TEXT DEFAULT '',
  migrado_a_alquiler BOOLEAN DEFAULT false,
  google_calendar_events JSONB DEFAULT '[]'::jsonb,
  fecha_registro TIMESTAMPTZ DEFAULT clock_timestamp()
);

COMMENT ON TABLE prestamos IS 'Contratos de préstamos financieros otorgados a los clientes.';

-- 3. TABLA: amortizaciones (Pagos de Préstamos)
CREATE TABLE IF NOT EXISTS amortizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestamo_id UUID NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
  monto NUMERIC NOT NULL CHECK (monto > 0),
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_movimiento TEXT DEFAULT 'Pago Ordinario',
  metodo_pago TEXT DEFAULT 'Efectivo',
  comprobante_url TEXT,
  voucher_drive_file_id TEXT,
  fecha_registro TIMESTAMPTZ DEFAULT clock_timestamp()
);

COMMENT ON TABLE amortizaciones IS 'Historial de pagos y amortizaciones aplicadas a préstamos.';

-- 4. TABLA: ajustes_prestamo (Planes de Ayuda)
CREATE TABLE IF NOT EXISTS ajustes_prestamo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestamo_id UUID NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('congelar_interes_temporal', 'acuerdo_especial')),
  cuota_numero INTEGER,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin DATE,
  descripcion TEXT DEFAULT '',
  usuario TEXT DEFAULT 'sistema',
  motivo TEXT DEFAULT '',
  activo BOOLEAN DEFAULT true,
  fecha_registro TIMESTAMPTZ DEFAULT clock_timestamp()
);

COMMENT ON TABLE ajustes_prestamo IS 'Modificaciones contractuales y congelamiento de intereses.';

-- 5. TABLA: alquileres
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

COMMENT ON TABLE alquileres IS 'Contratos de alquiler de inmuebles independiente de préstamos.';

-- 6. TABLA: pagos_alquiler
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

COMMENT ON TABLE pagos_alquiler IS 'Historial de pagos mensuales de alquileres.';

-- 7. TABLA: documentos_cliente
CREATE TABLE IF NOT EXISTS documentos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL,
  nombre_archivo TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  drive_url TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/pdf',
  observacion TEXT DEFAULT '',
  fecha_subida TIMESTAMPTZ DEFAULT clock_timestamp()
);

COMMENT ON TABLE documentos_cliente IS 'Archivos digitales y comprobantes de identidad de clientes.';

-- 8. VISTA: resumen_financiero_clientes
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
