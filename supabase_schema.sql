-- PrestaFacilito — Supabase Schema (actualizado v2)
-- Última actualización: 2026-05-26

-- =============================================
-- TABLA: clientes
-- =============================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo TEXT NOT NULL,
  telefono TEXT DEFAULT '',
  observaciones TEXT DEFAULT '',
  fecha_registro DATE DEFAULT CURRENT_DATE,
  -- Campos ampliados v2
  direccion TEXT DEFAULT '',
  numero_cuenta TEXT DEFAULT '',          -- Texto libre para datos bancarios
  banco_cuenta TEXT DEFAULT '',           -- Nombre del banco asociado a la cuenta
  informacion_adicional TEXT DEFAULT '',  -- Campo libre para info extra
  drive_folder_id TEXT DEFAULT ''         -- ID de subcarpeta en Google Drive para documentos
);

-- =============================================
-- TABLA: prestamos
-- =============================================
CREATE TABLE IF NOT EXISTS prestamos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  monto_capital NUMERIC NOT NULL CHECK (monto_capital > 0),
  tasa_interes_porcentaje NUMERIC DEFAULT 0 CHECK (tasa_interes_porcentaje >= 0),
  fecha_emision DATE DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'pagado')),
  tipo_prestamo TEXT DEFAULT 'Personal',
  google_calendar_events JSONB DEFAULT '[]'::jsonb -- IDs de eventos de Google Calendar para recordatorios
);

-- =============================================
-- TABLA: amortizaciones
-- =============================================
CREATE TABLE IF NOT EXISTS amortizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestamo_id UUID NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
  tipo_movimiento TEXT DEFAULT 'Pago Ordinario',
  monto NUMERIC NOT NULL CHECK (monto > 0),
  fecha_pago DATE DEFAULT CURRENT_DATE,
  metodo_pago TEXT DEFAULT 'Efectivo',
  comprobante_url TEXT,
  voucher_drive_file_id TEXT          -- ID del archivo de voucher en Google Drive
);

-- =============================================
-- TABLA: ajustes_prestamo
-- =============================================
CREATE TABLE IF NOT EXISTS ajustes_prestamo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestamo_id UUID NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'congelar_interes_temporal',
    'congelar_interes_permanente',
    'eliminar_interes_cuota',
    'reducir_mora',
    'eliminar_mora',
    'periodo_gracia'
  )),
  monto_afectado NUMERIC DEFAULT 0,
  monto_antes NUMERIC DEFAULT 0,
  monto_despues NUMERIC DEFAULT 0,
  cuota_numero INTEGER,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  periodo_gracia_dias INTEGER DEFAULT 0,
  descripcion TEXT,
  usuario TEXT NOT NULL,
  motivo TEXT NOT NULL,
  fecha_registro TIMESTAMPTZ DEFAULT clock_timestamp(),
  activo BOOLEAN DEFAULT true
);

-- =============================================
-- TABLA: documentos_cliente (NUEVA v2)
-- =============================================
CREATE TABLE IF NOT EXISTS documentos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL CHECK (tipo_documento IN (
    'dni_frontal', 'dni_reverso', 'recibo_luz', 'recibo_agua', 'foto_cliente', 'otro'
  )),
  nombre_archivo TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  drive_url TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/octet-stream',
  fecha_subida TIMESTAMPTZ DEFAULT clock_timestamp(),
  observacion TEXT DEFAULT ''
);

-- =============================================
-- TABLA: logs
-- =============================================
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_hora TIMESTAMPTZ DEFAULT clock_timestamp(),
  usuario TEXT NOT NULL,
  accion TEXT NOT NULL,
  detalles TEXT
);

-- =============================================
-- VISTA: resumen_financiero_clientes
-- =============================================
CREATE OR REPLACE VIEW resumen_financiero_clientes AS
 SELECT c.id,
    c.id AS cliente_id,
    c.nombre_completo,
    c.telefono,
    c.observaciones,
    c.fecha_registro,
    c.direccion,
    c.numero_cuenta,
    c.banco_cuenta,
    c.informacion_adicional,
    c.drive_folder_id,
    COALESCE(count(p.id), 0::bigint) AS total_prestamos,
    COALESCE(sum(
        CASE WHEN p.estado = 'activo' THEN 1 ELSE 0 END
    ), 0::bigint) AS prestamos_activos,
    COALESCE(sum(p.monto_capital), 0::numeric) AS capital_total_prestado,
    COALESCE(sum(p.monto_capital * (1 + p.tasa_interes_porcentaje / 100)), 0::numeric) AS total_exigible,
    COALESCE((
        SELECT sum(a.monto) FROM amortizaciones a
        JOIN prestamos pr ON a.prestamo_id = pr.id
        WHERE pr.cliente_id = c.id
    ), 0::numeric) AS total_amortizado
 FROM clientes c
 LEFT JOIN prestamos p ON c.id = p.cliente_id
 GROUP BY c.id, c.nombre_completo, c.telefono, c.observaciones, c.fecha_registro,
          c.direccion, c.numero_cuenta, c.banco_cuenta, c.informacion_adicional, c.drive_folder_id;

-- =============================================
-- STORAGE: bucket vouchers (vouchers de pago)
-- =============================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('vouchers', 'vouchers', true)
-- ON CONFLICT (id) DO NOTHING;

-- =============================================
-- SEGURIDAD: Habilitar Row Level Security (RLS)
-- =============================================
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE amortizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes_prestamo ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

