-- MIGRACIÓN FASE 6: Tabla score_clientes y actualización de la vista resumen_financiero_clientes

CREATE TABLE IF NOT EXISTS score_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE UNIQUE,
  
  -- Score calculado automáticamente
  score_numerico NUMERIC(5,2) DEFAULT 0,
  score_letra TEXT CHECK (score_letra IN ('A', 'B', 'C')) DEFAULT NULL,
  
  -- Datos del cálculo (para transparencia)
  cuotas_totales INTEGER DEFAULT 0,
  cuotas_a_tiempo INTEGER DEFAULT 0,
  cuotas_completas INTEGER DEFAULT 0,
  prestamos_liquidados INTEGER DEFAULT 0,
  prestamos_totales INTEGER DEFAULT 0,
  dias_atraso_promedio NUMERIC(6,2) DEFAULT 0,
  
  -- Override manual
  score_manual TEXT CHECK (score_manual IN ('A', 'B', 'C')) DEFAULT NULL,
  motivo_override TEXT DEFAULT '',
  
  -- Auditoría
  ultima_actualizacion TIMESTAMPTZ DEFAULT clock_timestamp()
);

COMMENT ON TABLE score_clientes IS 'Score de comportamiento de pago por cliente. Calculado automáticamente, con posibilidad de override manual.';
COMMENT ON COLUMN score_clientes.score_manual IS 'Si está presente, sobreescribe el score calculado automáticamente.';

-- Actualizar vista resumen_financiero_clientes para incluir score_efectivo
CREATE OR REPLACE VIEW resumen_financiero_clientes AS
SELECT
  c.id,
  c.nombre_completo,
  c.apodo,
  c.telefono,
  c.direccion,
  c.fecha_registro,
  COALESCE(sc.score_manual, sc.score_letra) AS score_efectivo,
  sc.score_numerico,
  (sc.score_manual IS NOT NULL) AS score_sobreescrito,
  COALESCE(COUNT(DISTINCT p.id), 0) AS total_prestamos,
  COALESCE(SUM(CASE WHEN p.estado = 'activo' THEN p.monto_capital ELSE 0 END), 0) AS capital_activo_total,
  COALESCE(COUNT(DISTINCT al.id), 0) AS total_alquileres
FROM clientes c
LEFT JOIN prestamos p ON c.id = p.cliente_id
LEFT JOIN alquileres al ON c.id = al.cliente_id
LEFT JOIN score_clientes sc ON c.id = sc.cliente_id
GROUP BY 
  c.id, c.nombre_completo, c.apodo, c.telefono, c.direccion, c.fecha_registro,
  sc.score_manual, sc.score_letra, sc.score_numerico;
