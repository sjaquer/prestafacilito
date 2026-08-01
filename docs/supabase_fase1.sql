-- FASE 1: Limpieza de Base de Datos y Configuración de RLS

-- 1. Eliminar la tabla de logs/bitácora por completo
DROP TABLE IF EXISTS logs;

-- 2. Deshabilitar RLS en las tablas activas ya que el backend accede mediante service role / backend único
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos DISABLE ROW LEVEL SECURITY;
ALTER TABLE amortizaciones DISABLE ROW LEVEL SECURITY;
ALTER TABLE ajustes_prestamo DISABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_cliente DISABLE ROW LEVEL SECURITY;
