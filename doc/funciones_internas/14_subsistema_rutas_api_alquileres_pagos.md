# ⚙️ Módulo Interno: API REST de Alquileres y Pagos de Renta (`alquileres.routes.ts`)

- **Ubicación del Código Fuente**: [`routes/alquileres.routes.ts`](file:///home/sjaquer/Downloads/prestafacilito/routes/alquileres.routes.ts)
- **Dependencias Directas**: [`src/lib/alquilerLogic.ts`](file:///home/sjaquer/Downloads/prestafacilito/src/lib/alquilerLogic.ts)
- **Propósito**: Gestionar contratos de arrendamiento de inmuebles, cálculo dinámico de meses devengados y adeudados, y registro de pagos mensuales de alquiler con comprobantes enlazados.

---

## 📡 1. Endpoints de Alquileres (`/api/alquileres`)

### 1.1. `GET /api/alquileres` — Listar Contratos
- Obtiene todos los contratos de alquiler con datos del inquilino y calcula en tiempo real `buildAlquilerSchedule`.
- Retorna el listado enriquecido con:
  - `dia_cobro`: Día fijo del mes para el pago de la renta.
  - `dias_restantes`: Días para el próximo vencimiento.
  - `meses_atrasados`: Cantidad de mensualidades vencidas sin pagar.
  - `total_pendiente`: Deuda total acumulada de alquiler.

### 1.2. `POST /api/alquileres` — Crear Contrato
- **Payload**:
  ```json
  {
    "cliente_id": "uuid-inquilino",
    "monto_mensual": 1200,
    "descripcion_inmueble": "Departamento 302, Edificio Los Pinos",
    "fecha_inicio": "2026-08-01",
    "fecha_fin": "2027-08-01",
    "notas": "Incluye mantenimiento y agua"
  }
  ```

### 1.3. `POST /api/alquileres/:id/pagos` — Registrar Pago de Renta
- **Payload**:
  ```json
  {
    "monto": 1200,
    "fecha_pago": "2026-08-25",
    "periodo_mes": 8,
    "periodo_anio": 2026,
    "metodo_pago": "Transferencia BCP",
    "comprobante_url": "/api/vouchers/proxy/456",
    "voucher_drive_file_id": "file_id_drive_456"
  }
  ```
- **Lógica**: Inserta el registro en `pagos_alquiler` y recalcula el estado del contrato.

### 1.4. `DELETE /api/alquileres/pagos/:pagoId` — Eliminar Pago de Renta
- Permite reversar un abono registrado por error.
