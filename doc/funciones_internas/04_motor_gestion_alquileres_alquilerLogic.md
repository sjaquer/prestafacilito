# ⚙️ Módulo Interno: Motor de Gestión de Alquileres (`alquilerLogic.ts`)

- **Ubicación del Código Fuente**: [`src/lib/alquilerLogic.ts`](file:///home/sjaquer/Downloads/prestafacilito/src/lib/alquilerLogic.ts)
- **Dependencias Directas**: [`src/lib/loanLogic.ts`](file:///home/sjaquer/Downloads/prestafacilito/src/lib/loanLogic.ts) (funciones `round2`, `toNumber`, `normalizeDate`)
- **Propósito**: Administrar el ciclo de vida de los contratos de alquiler de inmuebles, calcular cronogramas de renta mensual, aplicar pagos en orden cronológico (FIFO), determinar mensualidades adeudadas y días de atraso.

---

## 📋 1. Interfaces y Tipos TypeScript

### 1.1. `AlquilerContrato`
```typescript
export interface AlquilerContrato {
  id: string;
  cliente_id: string;
  monto_mensual: number;
  descripcion_inmueble?: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  estado: 'activo' | 'finalizado';
  notas?: string;
}
```

### 1.2. `PagoAlquiler`
```typescript
export interface PagoAlquiler {
  id: string;
  alquiler_id: string;
  monto: number;
  fecha_pago: string;
  periodo_mes: number;
  periodo_anio: number;
  metodo_pago?: string;
  comprobante_url?: string | null;
  voucher_drive_file_id?: string | null;
  es_pago_completo?: boolean;
}
```

### 1.3. `EstadoAlquiler` y `MesAlquiler`
```typescript
export interface MesAlquiler {
  numero: number;
  anio: number;
  mes: number;
  fechaVencimiento: string;
  montoEsperado: number;
  montoPagado: number;
  saldoPendiente: number;
  estado: 'Saldada' | 'Parcial' | 'Pendiente' | 'Vencida';
  diasVencidos: number;
  diasRestantes: number;
  pagos: PagoAlquiler[];
}

export interface EstadoAlquiler {
  mesesGenerados: MesAlquiler[];
  totalPagado: number;
  totalPendiente: number;
  mesesAtrasados: number;
  mesSiguiente: MesAlquiler | null;
  diaCobroFijo: number;
  diasRestantesProximoCobro: number;
}
```

---

## 🔄 2. Algoritmo de Cálculo: `buildAlquilerSchedule`

```typescript
export function buildAlquilerSchedule(
  alquiler: AlquilerContrato,
  pagos: PagoAlquiler[],
  referenceDate: Date = new Date()
): EstadoAlquiler;
```

### Pasos de Ejecución:
1. **Fijación del Día de Cobro**:
   - `diaCobroFijo = fechaInicio.getDate()`.
   - Cada mensualidad subsiguiente vencerá el día fijado del mes correspondiente (ajustando a 28/29/30 si el mes tiene menos días).
2. **Saldo Disponible Acumulado**:
   - Se totalizan todos los abonos realizados por el inquilino: `totalPagado = sum(pagos.monto)`.
   - Se inicializa `saldoDisponible = totalPagado`.
3. **Iteración Mensual FIFO**:
   - Por cada mes devengado desde el inicio del contrato hasta la fecha actual (`now`) o `fecha_fin`:
     - `montoPagadoMes = min(montoMensual, saldoDisponible)`
     - `saldoDisponible = max(0, saldoDisponible - montoPagadoMes)`
     - `saldoPendiente = max(0, montoMensual - montoPagadoMes)`
4. **Determinación de Estados Mensuales**:
   - `saldoPendiente <= 0` $\rightarrow$ `'Saldada'`
   - `montoPagadoMes > 0` $\rightarrow$ `'Parcial'`
   - `fechaVencimiento < now` $\rightarrow$ `'Vencida'`
   - En caso contrario $\rightarrow$ `'Pendiente'`
5. **Detección de Atrasos**:
   - `mesesAtrasados`: Cuenta los meses en estado `'Vencida'` o `'Parcial'` con días vencidos mayores a 0.
   - `mesSiguiente`: Primer mes no saldado.

---

## 💡 3. Diferencia Clave con Préstamos

A diferencia de los préstamos financieros donde existe amortización de capital e interés compuesto por mora, en los **alquileres**:
- La renta mensual es fija.
- Los abonos se imputan estrictamente a saldar mensualidades completas en orden de antigüedad (FIFO).
- Permite vincular contratos de arrendamiento a clientes ya registrados en la base de datos de prestatarios.
