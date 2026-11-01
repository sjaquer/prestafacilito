-- ============================================================================
-- Activar Row Level Security (RLS) en todo el esquema público
-- ============================================================================
--
-- ✅ APLICADA el 2026-11-01 vía MCP. Verificado: las 10 tablas con RLS forzado, la vista con
--    security_invoker, anon sin acceso a tablas ni a Storage, y la app (service_role) funcionando.
--
-- Pendiente manual: rotar la clave anon (Settings → API), porque estuvo en uso con acceso total.
--
-- Efecto: nadie puede leer ni escribir datos con la clave anon/authenticated
-- (por ejemplo, alguien que obtenga la URL del proyecto y la clave pública).
-- Solo el backend, con service_role, tiene acceso.
-- ============================================================================

BEGIN;

-- 1. RLS en todas las tablas del esquema público (incluye las que no figuran en
--    el esquema base, como configuracion_sistema, score_clientes o respaldos_archivos).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t.tablename);
    RAISE NOTICE 'RLS activado en %', t.tablename;
  END LOOP;
END $$;

-- 2. Las vistas se ejecutan con permisos del dueño y saltarían RLS:
--    forzar que respeten los permisos de quien consulta (Postgres 15+).
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT viewname FROM pg_views WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v.viewname);
    RAISE NOTICE 'security_invoker activado en vista %', v.viewname;
  END LOOP;
END $$;

-- 3. Defensa adicional: quitar privilegios directos a los roles públicos.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Y para tablas que se creen en el futuro:
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

COMMIT;

-- ============================================================================
-- Verificación (ejecutar después): todas las filas deben mostrar rowsecurity = true
-- ============================================================================
-- SELECT tablename, rowsecurity, forcerowsecurity
-- FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- ============================================================================
-- Reversión (solo si algo falla tras ejecutar):
-- ============================================================================
-- DO $$ DECLARE t record; BEGIN
--   FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
--     EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', t.tablename);
--     EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tablename);
--   END LOOP;
-- END $$;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
