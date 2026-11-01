-- ============================================================================
-- Seguridad por defecto para todo lo que se cree en el futuro en el esquema public.
-- Aplicada el 2026-11-01 vía MCP. No toca las tablas existentes (ver 20261015_enable_rls.sql).
-- Verificado: una tabla nueva nace con RLS forzado y sin privilegios para anon.
-- ============================================================================

-- 1. Objetos nuevos: sin privilegios para los roles públicos (anon / authenticated).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- 2. Toda tabla nueva en public nace con RLS activado y forzado.
CREATE OR REPLACE FUNCTION public.rls_por_defecto()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type = 'table'
      AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', obj.object_identity);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', obj.object_identity);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.rls_por_defecto() FROM PUBLIC, anon, authenticated;

DROP EVENT TRIGGER IF EXISTS rls_por_defecto;
CREATE EVENT TRIGGER rls_por_defecto
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION public.rls_por_defecto();
