-- FASE 10: TABLA DE CONFIGURACION DE SISTEMA PARA RESPALDOS
CREATE TABLE IF NOT EXISTS configuracion_sistema (
  id INT PRIMARY KEY DEFAULT 1,
  ultima_fecha_backup TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insertar fila inicial si no existe
INSERT INTO configuracion_sistema (id, ultima_fecha_backup)
VALUES (1, NOW())
ON CONFLICT (id) DO NOTHING;
