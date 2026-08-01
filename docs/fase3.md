# FASE 3 — REFACTORIZACIÓN DEL MOTOR DE PRÉSTAMOS Y SEPARACIÓN DE ALQUILERES

> **Objetivo:** Implementar el modelo de cuotas francés adaptativo como motor principal de préstamos, separar completamente la lógica de alquileres, y simplificar el motor eliminando la lógica de mora acumulada y la Liquidación Express.  
> **Prioridad:** Alta — Define la lógica financiera central del sistema.  
> **Duración estimada:** 5–7 días de desarrollo  
> **Prerequisito:** Fases 1 y 2 completadas.

---

## 3.1 CONTEXTO Y PROPÓSITO

Esta es la fase más técnica y delicada del proyecto. El motor de cálculo de cuotas (`loanLogic.ts`) es el corazón del sistema — cualquier error aquí se propaga a todos los cálculos financieros.

### Problemas que resuelve:
- **P-011:** Contradicción entre modelo francés (misión) y modelo americano (implementación actual).
- **P-012:** Lógica de alquileres mezclada en `loanLogic.ts`.
- **P-013:** Código de mora diaria que nunca se usa pero añade complejidad.
- **P-014:** Sistema de ajustes sobre-ingenierizado.
- **P-018:** Liquidación Express sin documentar.

### Modelo financiero a implementar:

**Sistema Francés Adaptativo:**
- Capital inicial → dividido en N cuotas iguales de amortización de capital.
- Cada mes se calcula el interés sobre el capital RESTANTE (no el inicial).
- La cuota mensual = (Capital Inicial / N) + (Capital Restante × Tasa Mensual).
- Las cuotas van decreciendo naturalmente porque el interés baja al bajar el capital.
- Si el cliente paga menos de la cuota, el capital NO amortizado se lleva al mes siguiente.
- Si el cliente paga más, el excedente amortiza capital adicional.

**Ejemplo para S/100, 10%, 2 cuotas (de la misión):**
```
Amortización mensual fija = 100/2 = S/50
Cuota 1: Interés = 100 × 10% = S/10  → Cuota = S/50 + S/10 = S/60. Capital restante = S/50
Cuota 2: Interés = 50 × 10% = S/5   → Cuota = S/50 + S/5  = S/55. Capital restante = S/0
```

---

## 3.2 TAREAS DETALLADAS

### TAREA 3.2.1 — Reescribir `buildPaymentSchedule` con el modelo francés

**Nuevo algoritmo:**

```typescript
// Estructura limpia del nuevo buildPaymentSchedule
export const buildPaymentSchedule = (
  prestamo: Prestamo,
  pagos: Amortizacion[] = [],
  options: BuildScheduleOptions = {}
): EstadoDeudaPrestamo => {
  const { ajustes = [], referenceDate = new Date() } = options;
  
  const capital = toNumber(prestamo.monto_capital);
  const tasaMensual = toNumber(prestamo.tasa_interes_porcentaje) / 100;
  const emisionDate = normalizeDate(prestamo.fecha_emision);
  const now = normalizeDate(referenceDate);
  const totalCuotas = getInstallmentCount(prestamo);
  
  // Amortización de capital constante por cuota (el "pilar" del método francés)
  const amortizacionCapitalPorCuota = round2(capital / totalCuotas);
  
  // Generar el cronograma teórico de cuotas
  const cuotas: CuotaPrestamo[] = [];
  let capitalRestante = capital;
  
  for (let i = 0; i < totalCuotas; i++) {
    const fechaVencimiento = addMonthsClamped(emisionDate, i + 1);
    const interesMes = round2(capitalRestante * tasaMensual);
    
    // Verificar si hay ajuste de congelamiento de interés para esta cuota
    const interesCongelado = tieneCongelamientoActivo(ajustes, fechaVencimiento);
    const interesEfectivo = interesCongelado ? 0 : interesMes;
    
    const cuotaMes = round2(amortizacionCapitalPorCuota + interesEfectivo);
    
    cuotas.push({
      numero: i + 1,
      fechaVencimiento: formatIsoDate(fechaVencimiento),
      capitalPendiente: capitalRestante,
      interesPendiente: interesEfectivo,
      montoCuotaBase: cuotaMes,
      montoExigible: cuotaMes,
      capitalAmortizado: amortizacionCapitalPorCuota,
      // Estado inicial antes de aplicar pagos
      pagado: 0,
      saldoPendiente: cuotaMes,
      estado: fechaVencimiento <= now ? 'Vencida' : 'Pendiente',
      diasVencidos: 0,
      moraPendiente: 0,
      penalidad: 0,
      cargosAdicionales: 0,
      interesOriginal: interesMes,
      congelada: interesCongelado,
    });
    
    capitalRestante = round2(capitalRestante - amortizacionCapitalPorCuota);
  }
  
  // Aplicar los pagos reales al cronograma
  const pagosOrdenados = [...pagos]
    .filter(p => toNumber(p.monto) > EPSILON)
    .sort((a, b) => new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime());
  
  aplicarPagosAlCronograma(cuotas, pagosOrdenados);
  
  // Actualizar estados finales
  actualizarEstados(cuotas, now);
  
  return construirResumen(cuotas, pagos);
};
```

**Función `aplicarPagosAlCronograma`:**

```typescript
function aplicarPagosAlCronograma(cuotas: CuotaPrestamo[], pagos: Amortizacion[]) {
  for (const pago of pagos) {
    let remaining = toNumber(pago.monto);
    
    // Distribuir el pago en orden cronológico de cuotas no saldadas
    for (const cuota of cuotas) {
      if (remaining <= EPSILON) break;
      if (cuota.estado === 'Saldada') continue;
      
      // 1. Pagar el interés pendiente de la cuota
      if (cuota.interesPendiente > EPSILON) {
        const pagoInteres = round2(Math.min(cuota.interesPendiente, remaining));
        cuota.interesPendiente = round2(cuota.interesPendiente - pagoInteres);
        remaining = round2(remaining - pagoInteres);
      }
      
      // 2. Si cubrió el interés, pagar la amortización de capital
      if (remaining > EPSILON && cuota.capitalAmortizado > 0) {
        const capitalPendienteCuota = round2(
          cuota.capitalAmortizado - (cuota.capitalAmortizadoPagado || 0)
        );
        if (capitalPendienteCuota > EPSILON) {
          const pagoCapital = round2(Math.min(capitalPendienteCuota, remaining));
          cuota.capitalAmortizadoPagado = round2((cuota.capitalAmortizadoPagado || 0) + pagoCapital);
          remaining = round2(remaining - pagoCapital);
        }
      }
      
      // Actualizar totales de la cuota
      cuota.pagado = round2(
        (cuota.interesOriginal - cuota.interesPendiente) + 
        (cuota.capitalAmortizadoPagado || 0)
      );
      cuota.saldoPendiente = round2(cuota.interesPendiente + 
        Math.max(0, cuota.capitalAmortizado - (cuota.capitalAmortizadoPagado || 0)));
      cuota.montoExigible = cuota.saldoPendiente;
      
      if (cuota.saldoPendiente <= EPSILON) {
        cuota.estado = 'Saldada';
      } else if (cuota.pagado > EPSILON) {
        cuota.estado = 'Parcial';
      }
    }
    
    // Si sobra dinero, aplicar como adelanto a la siguiente cuota no saldada
    if (remaining > EPSILON) {
      const siguienteCuota = cuotas.find(c => c.estado !== 'Saldada');
      if (siguienteCuota) {
        // El excedente se aplica al interés de la siguiente cuota
        const aplicadoInteres = round2(Math.min(siguienteCuota.interesPendiente, remaining));
        siguienteCuota.interesPendiente = round2(siguienteCuota.interesPendiente - aplicadoInteres);
        remaining = round2(remaining - aplicadoInteres);
        siguienteCuota.pagado = round2(siguienteCuota.pagado + aplicadoInteres);
      }
    }
  }
}
```

---

### TAREA 3.2.2 — Eliminar la lógica de mora acumulada del motor

**Qué eliminar:**
- Variables: `lateInterestRateDaily`, `moraPendiente`, `moraAcumulada`, `moraOriginal`, `moraPagado`, `moraCobrada`.
- Funciones: `DEFAULT_LATE_INTEREST_RATE_DAILY`, todo el bloque de cálculo de mora en el loop de pagos.
- En `CuotaPrestamo` type: eliminar `moraPendiente`, `moraOriginal`, `moraPagado`.
- En `ResumenDeudaPrestamo` type: eliminar `moraAcumulada`.

**Qué mantener (solo visual):**
```typescript
// En CuotaPrestamo, mantener:
diasVencidos: number;  // Días de atraso (calculado para mostrar en UI)
```

La UI mostrará "X días de atraso" como información, pero sin cargo monetario adicional.

---

### TAREA 3.2.3 — Eliminar la "Liquidación Express"

**Qué eliminar:**
- En `loanLogic.ts`: Toda la lógica de `esElegibleLiquidacionExpress` y `montoLiquidacionExpress` (líneas 677–695).
- En `ResumenDeudaPrestamo` type: Eliminar `esElegibleLiquidacionExpress` y `montoLiquidacionExpress`.
- En `classifyPayment`: Eliminar el case de "Liquidación Express".
- En el servidor: Eliminar referencias en los endpoints y en el type de validación de tipos de movimiento.

---

### TAREA 3.2.4 — Crear el módulo `alquilerLogic.ts` separado

**Crear `src/lib/alquilerLogic.ts`:**

```typescript
// src/lib/alquilerLogic.ts
// Lógica de negocio exclusiva para contratos de alquiler.
// Los alquileres son completamente distintos a los préstamos:
// - Monto mensual fijo (no hay interés, no hay amortización de capital)
// - El cliente debe pagar el monto mensual o ya lo pagó
// - Se rastrea si pagó o no cada mes calendario

import { round2, toNumber, normalizeDate } from './loanLogic';

export interface AlquilerContrato {
  id: string;
  cliente_id: string;
  monto_mensual: number;
  descripcion_inmueble: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  estado: 'activo' | 'finalizado';
  notas?: string;
}

export interface PagoAlquiler {
  id: string;
  alquiler_id: string;
  monto: number;
  fecha_pago: string;
  periodo_mes: number;
  periodo_anio: number;
  metodo_pago: string;
  es_pago_completo: boolean;
}

export interface MesAlquiler {
  numero: number;         // Número de mes relativo al contrato (1, 2, 3...)
  anio: number;
  mes: number;            // Mes calendario (1-12)
  fechaVencimiento: string;
  montoEsperado: number;
  montoPagado: number;
  saldoPendiente: number;
  estado: 'Saldada' | 'Parcial' | 'Pendiente' | 'Vencida';
  diasVencidos: number;
  pagos: PagoAlquiler[];  // Pagos que cubren este mes
}

export interface EstadoAlquiler {
  mesesGenerados: MesAlquiler[];
  totalPagado: number;
  totalPendiente: number;
  mesesAtrasados: number;
  mesSiguiente: MesAlquiler | null;
}

export function buildAlquilerSchedule(
  alquiler: AlquilerContrato,
  pagos: PagoAlquiler[],
  referenceDate: Date = new Date()
): EstadoAlquiler {
  const fechaInicio = normalizeDate(alquiler.fecha_inicio);
  const now = normalizeDate(referenceDate);
  const montoMensual = toNumber(alquiler.monto_mensual);
  
  // Generar todos los meses desde inicio hasta now (o hasta fecha_fin si existe)
  const fechaLimite = alquiler.fecha_fin 
    ? new Date(Math.min(now.getTime(), normalizeDate(alquiler.fecha_fin).getTime()))
    : now;
  
  const meses: MesAlquiler[] = [];
  let mesActual = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth() + 1, 1);
  let numeroMes = 1;
  
  while (mesActual <= fechaLimite || meses.length < 1) {
    const fechaVencimiento = new Date(mesActual.getFullYear(), mesActual.getMonth(), 
      fechaInicio.getDate());
    
    const pagosDelMes = pagos.filter(p => 
      p.periodo_mes === mesActual.getMonth() + 1 && 
      p.periodo_anio === mesActual.getFullYear()
    );
    
    const montoPagado = round2(pagosDelMes.reduce((sum, p) => sum + toNumber(p.monto), 0));
    const saldoPendiente = round2(Math.max(0, montoMensual - montoPagado));
    const diasVencidos = fechaVencimiento < now 
      ? Math.floor((now.getTime() - fechaVencimiento.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    
    let estado: MesAlquiler['estado'];
    if (saldoPendiente <= 0) estado = 'Saldada';
    else if (montoPagado > 0) estado = 'Parcial';
    else if (fechaVencimiento < now) estado = 'Vencida';
    else estado = 'Pendiente';
    
    meses.push({
      numero: numeroMes,
      anio: mesActual.getFullYear(),
      mes: mesActual.getMonth() + 1,
      fechaVencimiento: fechaVencimiento.toISOString().split('T')[0],
      montoEsperado: montoMensual,
      montoPagado,
      saldoPendiente,
      estado,
      diasVencidos,
      pagos: pagosDelMes
    });
    
    mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1);
    numeroMes++;
    
    if (numeroMes > 120) break; // Límite de seguridad: 10 años
  }
  
  const totalPagado = round2(pagos.reduce((sum, p) => sum + toNumber(p.monto), 0));
  const totalPendiente = round2(meses.reduce((sum, m) => sum + m.saldoPendiente, 0));
  const mesesAtrasados = meses.filter(m => m.estado === 'Vencida' || 
    (m.estado === 'Parcial' && m.diasVencidos > 0)).length;
  const mesSiguiente = meses.find(m => m.estado !== 'Saldada') || null;
  
  return { mesesGenerados: meses, totalPagado, totalPendiente, mesesAtrasados, mesSiguiente };
}
```

---

### TAREA 3.2.5 — Crear la ruta API para alquileres

**Crear `routes/alquileres.routes.ts`** con los siguientes endpoints:

```
GET    /api/alquileres              → Lista todos los alquileres activos con estado
GET    /api/alquileres/:id          → Detalle de un alquiler + historial de pagos + estado por mes
POST   /api/alquileres              → Crear nuevo contrato de alquiler
PUT    /api/alquileres/:id          → Actualizar contrato (monto, fechas, notas)
POST   /api/alquileres/:id/pagos    → Registrar pago de alquiler
DELETE /api/alquileres/:id/pagos/:pagoId → Eliminar pago de alquiler
```

---

### TAREA 3.2.6 — Eliminar el bloque `if (prestamo.tipo_prestamo === "Alquiler de Casa")` de `loanLogic.ts`

**Qué hacer:**
- Eliminar el bloque `if` de alquiler de casa (líneas 103–242 de `loanLogic.ts`).
- El archivo quedará solo con la lógica de préstamos.
- Los alquileres ahora usan `alquilerLogic.ts`.

---

### TAREA 3.2.7 — Crear tests unitarios para el nuevo motor

**Crear `src/lib/__tests__/loanLogic.test.ts`:**

```typescript
import { buildPaymentSchedule } from '../loanLogic';

describe('buildPaymentSchedule — Modelo Francés Adaptativo', () => {
  // Caso base de la misión: S/100, 10%, 2 cuotas
  test('S/100 al 10% en 2 cuotas produce cuotas de S/60 y S/55', () => {
    const prestamo = {
      monto_capital: 100,
      tasa_interes_porcentaje: 10,
      fecha_emision: '2026-01-01',
      fecha_vencimiento: '2026-03-01',
      estado: 'activo' as const,
      tipo_prestamo: 'Personal',
      id: 'test-1',
      cliente_id: 'cliente-1'
    };
    
    const resultado = buildPaymentSchedule(prestamo, []);
    expect(resultado.cuotas[0].montoCuotaBase).toBe(60);
    expect(resultado.cuotas[1].montoCuotaBase).toBe(55);
  });
  
  // Más casos de prueba...
});
```

---

### TAREA 3.2.8 — Actualizar el endpoint de detalle de préstamo

El endpoint `GET /api/prestamos/:id` debe devolver el resultado del nuevo `buildPaymentSchedule` con la nueva estructura de datos. Asegurarse de que:
- No devuelve campos de mora acumulada.
- No devuelve `esElegibleLiquidacionExpress`.
- Devuelve el desglose correcto por cuota (capital amortizado, interés, estado).

---

### TAREA 3.2.9 — Eliminar el campo `migrado_a_alquiler` después de validar

**Qué hacer:**

Después de verificar que la migración de datos de alquileres fue exitosa (todos los datos aparecen correctamente en la tabla `alquileres`):

```sql
-- Solo ejecutar después de VALIDAR la migración
DELETE FROM amortizaciones
WHERE prestamo_id IN (SELECT id FROM prestamos WHERE migrado_a_alquiler = true);

DELETE FROM prestamos WHERE migrado_a_alquiler = true;

ALTER TABLE prestamos DROP COLUMN IF EXISTS migrado_a_alquiler;
```

---

## 3.3 TABLAS DE REFERENCIA — MODELO FINANCIERO

### Ejemplo completo: Préstamo S/1000, 15%, 3 cuotas

| Cuota | Capital Inicial | Interés (15%) | Amort. Capital | Cuota Total | Capital Restante |
|-------|----------------|---------------|----------------|-------------|-----------------|
| 1 | S/1000.00 | S/150.00 | S/333.33 | S/483.33 | S/666.67 |
| 2 | S/666.67 | S/100.00 | S/333.33 | S/433.33 | S/333.34 |
| 3 | S/333.34 | S/50.00 | S/333.34 | S/383.34 | S/0.00 |
| **Total** | | **S/300.00** | **S/1000.00** | **S/1300.00** | |

### Reglas de imputación de pagos:
1. El pago se aplica primero al **interés pendiente** de la cuota.
2. El excedente se aplica a la **amortización de capital** de la cuota.
3. Si aún sobra, se aplica como **adelanto** al interés de la siguiente cuota.
4. Si el pago es insuficiente para cubrir el interés, la cuota queda "Parcial" y la diferencia de interés queda pendiente.

---

## 3.4 PRUEBAS Y VERIFICACIÓN

1. **Test unitario del modelo:** Ejecutar `npm test` — todos los tests de `loanLogic.test.ts` deben pasar.
2. **Verificar ejemplo de la misión:** Crear préstamo S/100 al 10% con 2 cuotas → cuota 1 debe ser S/60, cuota 2 debe ser S/55.
3. **Verificar pago parcial:** Registrar un pago menor a la cuota → la cuota debe quedar en estado "Parcial" con el saldo correcto.
4. **Verificar liquidación total:** Registrar el monto exacto del saldo pendiente → el préstamo debe pasar a estado "pagado".
5. **Verificar alquiler:** Crear un alquiler nuevo con `monto_mensual = 500` → verificar que el mes actual aparece como "Pendiente" con monto exigible = S/500.

---

## 3.5 RIESGOS

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Cambio de modelo financiero afecta préstamos existentes | Alta | Los préstamos existentes tienen pagos registrados que quedan intactos. El cambio afecta solo cómo se proyectan las cuotas futuras. |
| Tests revelan inconsistencias en el nuevo modelo | Media | Escribir tests PRIMERO (TDD) para definir el comportamiento esperado. |
| Pérdida de datos en la migración de alquileres | Baja | Mantener `migrado_a_alquiler = true` hasta validación manual. |

---

## 3.6 DEPENDENCIAS

- **Prerequisitos:** Fases 1 y 2 completadas.
- **Bloquea:** Fase 4 (UI del Home con previsualización), Fase 5 (detalle de préstamo).
