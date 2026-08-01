-- FASE 3: LIMPIEZA DE PRÉSTAMOS MIGRADOS Y COLUMNA OBSOLETA

DROP VIEW IF EXISTS resumen_financiero_clientes CASCADE;

DELETE FROM amortizaciones
WHERE prestamo_id IN (SELECT id FROM prestamos WHERE migrado_a_alquiler = true);

DELETE FROM prestamos WHERE migrado_a_alquiler = true;

ALTER TABLE prestamos DROP COLUMN IF EXISTS migrado_a_alquiler;

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
  COALESCE(COUNT(p.id), 0) AS total_prestamos,
  COALESCE(COUNT(p.id) FILTER (WHERE p.estado = 'activo'), 0) AS prestamos_activos,
  COALESCE(COUNT(p.id) FILTER (WHERE p.estado = 'pagado'), 0) AS prestamos_liquidados,
  COALESCE(SUM(p.monto_capital), 0) AS capital_total_prestado,
  COALESCE((
    SELECT SUM(a.monto)
    FROM amortizaciones a
    JOIN prestamos pr ON a.prestamo_id = pr.id
    WHERE pr.cliente_id = c.id
  ), 0) AS total_amortizado,
  COALESCE(COUNT(al.id) FILTER (WHERE al.estado = 'activo'), 0) AS alquileres_activos
FROM clientes c
LEFT JOIN prestamos p ON c.id = p.cliente_id
LEFT JOIN alquileres al ON c.id = al.cliente_id
GROUP BY c.id, c.nombre_completo, c.apodo, c.telefono, c.observaciones,
         c.fecha_registro, c.direccion, c.numero_cuenta, c.banco_cuenta,
         c.informacion_adicional, c.drive_folder_id;
