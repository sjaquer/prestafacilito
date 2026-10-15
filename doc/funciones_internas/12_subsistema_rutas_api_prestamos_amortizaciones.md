# ⚙️ Módulo Interno: API REST de Préstamos y Amortizaciones (`prestamos.routes.ts`)

- **Ubicación del Código Fuente**: [`routes/prestamos.routes.ts`](file:///home/sjaquer/Downloads/prestafacilito/routes/prestamos.routes.ts)
- **Routers Exportados**: `prestamosRouter` (`/api/prestamos`), `amortizacionesRouter` (`/api/amortizaciones`)
- **Propósito**: Gestionar la originación de créditos, registro de cobranzas diarias, edición y anulación de amortizaciones con recálculo automático de saldos y sincronización con Google Calendar.

---

## 📡 1. Endpoints de Préstamos (`/api/prestamos`)

### 1.1. `POST /api/prestamos` — Crear Préstamo
- **Payload**:
  ```json
  {
    "cliente_id": "uuid-cliente",
    "tipo_prestamo": "Personal" | "Garantía" | "Comercial",
    "monto_capital": 5000,
    "tasa_interes_porcentaje": 10,
    "fecha_emision": "2026-08-25",
    "dia_vencimiento_mes": 25,
    "notas": "Préstamo para mercadería"
  }
  ```
- **Lógica**: Inserta el préstamo en Supabase en estado `'activo'` y dispara la sincronización asíncrona de la primera cuota en Google Calendar.

---

### 1.2. `POST /api/prestamos/:id/pagos` — Registrar Cobro / Abono
- **Payload**:
  ```json
  {
    "monto": 500,
    "fecha_pago": "2026-08-25",
    "metodo_pago": "Efectivo" | "Transferencia BCP" | "Yape" | "Plin",
    "tipo_movimiento": "Pago mínimo" (opcional),
    "comprobante_url": "/api/vouchers/proxy/123" (opcional),
    "voucher_drive_file_id": "1abc..." (opcional)
  }
  ```
- **Flujo de Ejecución**:
  1. Valida que `monto > 0`.
  2. Obtiene amortizaciones y ajustes previos del préstamo.
  3. Ejecuta `classifyPayment` si no se especificó un tipo de movimiento manual.
  4. Inserta el registro en la tabla `amortizaciones`.
  5. Recalcula el saldo con `buildPaymentSchedule`.
  6. Si el saldo pendiente es $\le 0.01$, actualiza el estado del préstamo a `'pagado'`.
  7. Sincroniza la cuota pagada en Google Calendar.
  8. Retorna el nuevo estado, la deuda actualizada y el cronograma recalculado.

---

### 1.3. `POST /api/prestamos/autoseleccionar` — Autoselección Inteligente
- Permite al cajero u operador ingresar el DNI del cliente y el monto recibido para que el sistema sugiera automáticamente el préstamo más antiguo o cuya cuota coincida exactamente con el monto pagado.

---

### 1.4. `POST /api/prestamos/:id/ajustes` — Plan de Ayuda
- Aplica acuerdos de alivio financiero (`tipo: "congelar_interes_temporal"`).
- Registra `monto_antes`, `monto_despues`, `fecha_inicio`, `fecha_fin`, `usuario` y `motivo`.

---

## 💳 2. Endpoints de Amortizaciones (`/api/amortizaciones`)

### 2.1. `PUT /api/amortizaciones/:id` — Editar Pago
- Permite corregir la fecha, monto o método de pago de una amortización.
- Recalcula el cronograma del préstamo y actualiza su estado (si pasó de `pagado` a `activo` o viceversa).

### 2.2. `DELETE /api/amortizaciones/:id` — Anular / Eliminar Pago
- Anula un cobro erróneo o cheque devuelto.
- Reversa el saldo en el cronograma financiero y actualiza Google Calendar.

### 2.3. `POST /api/amortizaciones/:id/voucher` — Adjuntar Comprobante
- Asocia una o múltiples URLs de vouchers de Google Drive a la amortización (`comprobante_url`, `voucher_drive_file_id`).
- Soporta tanto URLs directas como carga de base64 desde el servidor.
