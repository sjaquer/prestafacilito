-- Índices en claves foráneas sin cubrir (aviso de rendimiento de Supabase). Aplicada el 2026-11-01 vía MCP.
CREATE INDEX IF NOT EXISTS ajustes_prestamo_prestamo_id_idx ON public.ajustes_prestamo (prestamo_id);
CREATE INDEX IF NOT EXISTS alquileres_cliente_id_idx ON public.alquileres (cliente_id);
CREATE INDEX IF NOT EXISTS documentos_cliente_cliente_id_idx ON public.documentos_cliente (cliente_id);
CREATE INDEX IF NOT EXISTS pagos_alquiler_alquiler_id_idx ON public.pagos_alquiler (alquiler_id);
