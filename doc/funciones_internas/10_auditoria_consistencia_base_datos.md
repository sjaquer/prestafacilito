# ⚙️ Módulo Interno: Script de Auditoría de Consistencia de Datos (`audit-database-consistency.ts`)

- **Ubicación del Código Fuente**: [`scripts/audit-database-consistency.ts`](file:///home/sjaquer/Downloads/prestafacilito/scripts/audit-database-consistency.ts)
- **Comando de Ejecución**: `npm run test:audit`
- **Propósito**: Ejecutar un chequeo de integridad matemática y de consistencia lógica entre los estados registrados en la base de datos de Supabase y los cálculos del motor financiero (`loanLogic` y `alquilerLogic`), detectando discrepancias o desincronizaciones de cartera.

---

## 🔍 1. Validaciones Realizadas

El script ejecuta dos baterías de verificación:

### 1.1. Auditoría de Préstamos y Amortizaciones
1. **Recálculo de Estado**:
   - Por cada préstamo, recupera sus amortizaciones y ajustes asociados.
   - Ejecuta `buildPaymentSchedule(p, pagosP, { ajustes: ajustesP, referenceDate: hoy })`.
2. **Comparación de Estados (`estado` en BD vs Calculado)**:
   - Si `capitalPendiente <= 0.01` y `moraAcumulada <= 0.01` $\rightarrow$ El estado en BD debe ser `'liquidado'` o `'pagado'`.
   - Si `cuotasVencidasTotal >= 3` $\rightarrow$ El estado esperado es `'estancado'`.
   - Si el préstamo tiene saldo pendiente y menos de 3 cuotas impagas $\rightarrow$ El estado esperado es `'activo'`.
3. **Detección de Discrepancia**: Si el estado registrado difiere del calculado, se genera un registro de advertencia con el desglose exacto de saldos.

---

### 1.2. Auditoría de Contratos de Alquiler
1. Por cada contrato de alquiler activo, ejecuta `buildAlquilerSchedule(alq, pagosAlqP, hoy)`.
2. Si el inquilino acumula una deuda superior a 3 mensualidades (`totalPendiente > alq.monto_mensual * 3`), el script lo clasifica como contrato en riesgo de cobranza judicial.

---

## 📄 2. Formato del Registro de Discrepancias

Las discrepancias detectadas se muestran en la consola y se registran en [`audit_logs/discrepancies_history.json`](file:///home/sjaquer/Downloads/prestafacilito/audit_logs/discrepancies_history.json):

```json
{
  "timestamp": "2026-08-25T13:00:00.000Z",
  "totalPrestamosAuditados": 150,
  "totalAlquileresAuditados": 24,
  "discrepanciasEncontradas": 0,
  "discrepancias": []
}
```

---

## 🚀 3. Integración en CI/CD y Despliegues

El script está configurado en `package.json` dentro del pipeline de verificación general:
```bash
npm run test:all   # Ejecuta pruebas unitarias (loanLogic + scoreLogic) y la auditoría de BD
```
