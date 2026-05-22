-- ========================================================
-- PRESTAFACILITO - ESQUEMA DE BASE DE DATOS SUPABASE (SQL)
-- Copia y pega este script en el SQL Editor de tu consola Supabase.
-- ========================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Eliminar tablas previas en cascada si existen (limpieza)
DROP TABLE IF EXISTS amortizaciones CASCADE;
DROP TABLE IF EXISTS prestamos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS logs CASCADE;

-- 2. Tabla Clientes
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo TEXT NOT NULL,
    telefono TEXT,
    observaciones TEXT,
    fecha_registro DATE DEFAULT CURRENT_DATE
);

-- 3. Tabla Prestamos
CREATE TABLE prestamos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    monto_capital NUMERIC NOT NULL CHECK (monto_capital > 0),
    tasa_interes_porcentaje NUMERIC DEFAULT 0 CHECK (tasa_interes_porcentaje >= 0),
    fecha_emision DATE DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'pagado')),
    tipo_prestamo TEXT DEFAULT 'Personal'
);

-- 4. Tabla Amortizaciones
CREATE TABLE amortizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prestamo_id UUID NOT NULL REFERENCES prestamos(id) ON DELETE CASCADE,
    tipo_movimiento TEXT DEFAULT 'Pago Ordinario',
    monto NUMERIC NOT NULL CHECK (monto > 0),
    fecha_pago DATE DEFAULT CURRENT_DATE,
    metodo_pago TEXT DEFAULT 'Efectivo',
    comprobante_url TEXT
);

-- 5. Tabla Logs
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_hora TIMESTAMPTZ DEFAULT clock_timestamp(),
    usuario TEXT NOT NULL,
    accion TEXT NOT NULL,
    detalles TEXT
);

-- ========================================================
-- CONFIGURACIÓN DE STORAGE (VOUCHERS BUCKET)
-- Asegúrate de crear un Bucket Público llamado "vouchers" en Supabase Storage.
-- ========================================================
