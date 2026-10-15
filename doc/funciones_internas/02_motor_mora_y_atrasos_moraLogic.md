# ⚙️ Módulo Interno: Motor de Mora y Detección de Atrasos (`moraLogic.ts`)

- **Ubicación del Código Fuente**: [`src/lib/moraLogic.ts`](file:///home/sjaquer/Downloads/prestafacilito/src/lib/moraLogic.ts)
- **Dependencias Directas**: [`src/lib/loanLogic.ts`](file:///home/sjaquer/Downloads/prestafacilito/src/lib/loanLogic.ts)
- **Propósito**: Evaluar el estado de morosidad en tiempo real de cada préstamo y cliente, calculando las cuotas vencidas, días de atraso, monto exigible atrasado y determinando si el préstamo califica como cartera vencida o estancada.

---

## 📋 1. Interfaces y Tipos TypeScript

### 1.1. `EstadoCuotaMes`
Clasificación cualitativa del estado de la deuda mensual:
```typescript
export type EstadoCuotaMes = 
  | "al_dia"           // Préstamo liquidado o cuotas al día
  | "pendiente_mes"    // Período actual en curso sin vencimiento
  | "mora_mes"         // Exactamente 1 cuota vencida
  | "mora_acumulada"   // 2 o más cuotas vencidas o préstamo estancado
  | "sin_cuotas";      // Préstamo recién creado sin cronograma devengado
```

### 1.2. `EstadoMoraCliente`
Estructura de respuesta con métricas para la cartera y alertas del dashboard:
```typescript
export interface EstadoMoraCliente {
  prestamoId: string;
  clienteNombre: string;
  estadoCuotaMes: EstadoCuotaMes;
  cuotasAtrasadas: number;
  montoCuotaActual: number;
  fechaCuotaActual: string;
  diasAtraso: number;
  diasRestantes: number;
  montoTotalAtrasado: number;
  saldoPendiente: number;
  moraAcumulada: number;
  ultimoPagoFecha?: string;
  ultimoPagoMonto?: number;
  esEstancado?: boolean;
}
```

---

## 🔍 2. Función Principal: `calcularEstadoMora`

```typescript
export function calcularEstadoMora(
  prestamo: Prestamo,
  amortizaciones: Amortizacion[],
  hoy: Date = new Date()
): EstadoMoraCliente;
```

### Algoritmo de Evaluación:
1. **Filtrado y Ordenamiento**: Filtra los pagos asociados al `prestamo.id` y los ordena cronológicamente para identificar el `ultimoPago`.
2. **Construcción del Cronograma**: Invoca a `buildPaymentSchedule(prestamo, pagosDelPrestamo, { referenceDate: hoy })`.
3. **Detección de Liquidación**:
   - Si `capitalPendiente <= 0.01` y `moraAcumulada <= 0.01` $\rightarrow$ `estadoCuotaMes = "al_dia"`.
4. **Detección de Préstamo Estancado**:
   - Si `cuotasVencidasTotal >= 3` o `prestamo.estado === "estancado"` $\rightarrow$ `esEstancado = true`.
5. **Cálculo de Monto Total Atrasado**:
   $$\text{Monto Atrasado Total} = \sum (\text{Saldo Pendiente de Cuotas Vencidas}) + \text{Mora Acumulada}$$
6. **Extracción de Próxima Cuota Exigible**:
   - Extrae `fechaCuotaActual`, `montoCuotaActual` y `diasAtraso` desde `cuotaSiguiente`.

---

## 📊 3. Consumo en la Interfaz de Usuario

Este módulo alimenta directamente:
- **`ClientAlerts.tsx`**: Genera tarjetas de advertencia para clientes con moras mayores a 15 y 30 días.
- **`DebtPortfolioTable.tsx` / `CarteraPage.tsx`**: Pinta los semáforos de cobranza (verde, amarillo, rojo).
- **`DeudoresMesList.tsx`**: Listado de cobranza diaria del operador.
