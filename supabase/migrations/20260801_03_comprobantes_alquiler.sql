-- FASE 9: VOUCHERS Y DOCUMENTOS MEJORADOS
-- Asegurar columnas en la tabla pagos_alquiler

ALTER TABLE pagos_alquiler
ADD COLUMN IF NOT EXISTS voucher_drive_file_id TEXT;

ALTER TABLE pagos_alquiler
ADD COLUMN IF NOT EXISTS comprobante_url TEXT;
