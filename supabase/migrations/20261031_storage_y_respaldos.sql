-- ============================================================================
-- Supabase Storage para fotos/documentos + control de respaldos semanales en Drive
-- ============================================================================
--
-- Requisito: el backend debe usar la clave service_role (ver 20261015_enable_rls.sql).
-- Ejecutar en Supabase → SQL Editor. Es idempotente: se puede correr más de una vez.
-- ============================================================================

BEGIN;

-- 1. Bucket PRIVADO "archivos" (comprobantes/ y clientes/).
--    Sin políticas en storage.objects: anon/authenticated no pueden leer ni subir nada.
--    Solo el backend (service_role) accede, y sirve los archivos en /api/archivos/... con sesión.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('archivos', 'archivos', false, 10485760)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

-- 2. Documentos de clientes: la ruta en Storage pasa a ser la referencia principal.
--    drive_file_id / drive_url quedan solo para los documentos antiguos (y como respaldo).
ALTER TABLE public.documentos_cliente ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.documentos_cliente ALTER COLUMN drive_file_id DROP NOT NULL;
ALTER TABLE public.documentos_cliente ALTER COLUMN drive_url DROP NOT NULL;
COMMENT ON COLUMN public.documentos_cliente.storage_path IS 'Ruta del archivo en el bucket privado "archivos" de Supabase Storage.';

-- 3. Ciclo de respaldo: se marca al subir el Excel y se limpia cuando todas las fotos están copiadas.
ALTER TABLE public.configuracion_sistema ADD COLUMN IF NOT EXISTS respaldo_iniciado_en TIMESTAMPTZ;
COMMENT ON COLUMN public.configuracion_sistema.ultima_fecha_backup IS 'Último respaldo COMPLETO en Google Drive (Excel + archivos).';

-- 4. Qué archivos de Storage ya tienen copia en Drive (para subir solo lo nuevo cada semana).
CREATE TABLE IF NOT EXISTS public.respaldos_archivos (
  ruta TEXT PRIMARY KEY,
  drive_file_id TEXT,
  nota TEXT DEFAULT '',
  respaldado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.respaldos_archivos IS 'Archivos de Storage copiados a Google Drive. drive_file_id NULL = no se pudo copiar (ver nota).';

-- 5. Misma protección que el resto de tablas (por si 20261015_enable_rls.sql ya se ejecutó antes).
ALTER TABLE public.respaldos_archivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respaldos_archivos FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.respaldos_archivos FROM anon, authenticated;

COMMIT;

-- Verificación:
-- SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'archivos';   -- public = false
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'documentos_cliente';
