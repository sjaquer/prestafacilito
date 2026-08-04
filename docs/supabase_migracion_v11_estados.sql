-- 1. Ampliar los estados permitidos
ALTER TABLE prestamos DROP CONSTRAINT IF EXISTS prestamos_estado_check;
ALTER TABLE prestamos ADD CONSTRAINT prestamos_estado_check 
  CHECK (estado IN ('activo', 'pagado', 'liquidado', 'estancado'));

-- 2. Migrar registros históricos 'pagado' → 'liquidado'
UPDATE prestamos SET estado = 'liquidado' WHERE estado = 'pagado';

-- 3. Actualizar vista para reconocer nuevos estados
CREATE OR REPLACE VIEW public.resumen_financiero_clientes AS
SELECT 
  c.id, c.nombre_completo, c.apodo, c.telefono, c.direccion, c.fecha_registro,
  c.numero_cuenta, c.banco_cuenta, c.informacion_adicional, c.drive_folder_id,
  COALESCE(sc.score_manual, sc.score_letra) AS score_efectivo,
  sc.score_numerico,
  (sc.score_manual IS NOT NULL) AS score_sobreescrito,
  -- Activos = activo O estancado (ambos tienen capital pendiente)
  COUNT(DISTINCT CASE WHEN p.estado IN ('activo','estancado') THEN p.id END)::integer AS prestamos_activos,
  -- Liquidados = liquidado O pagado (retrocompatibilidad)
  COUNT(DISTINCT CASE WHEN p.estado IN ('pagado','liquidado') THEN p.id END)::integer AS prestamos_liquidados,
  COUNT(DISTINCT p.id)::integer AS total_prestamos,
  COALESCE(SUM(p.monto_capital), 0) AS capital_total_prestado,
  COUNT(DISTINCT CASE WHEN al.estado = 'activo' THEN al.id END)::integer AS alquileres_activos,
  COUNT(DISTINCT al.id)::integer AS total_alquileres
FROM public.clientes c
LEFT JOIN public.prestamos p ON c.id = p.cliente_id
LEFT JOIN public.alquileres al ON c.id = al.cliente_id
LEFT JOIN public.score_clientes sc ON c.id = sc.cliente_id
GROUP BY c.id, c.nombre_completo, c.apodo, c.telefono, c.direccion, c.fecha_registro,
         c.numero_cuenta, c.banco_cuenta, c.informacion_adicional, c.drive_folder_id,
         sc.score_manual, sc.score_letra, sc.score_numerico;
