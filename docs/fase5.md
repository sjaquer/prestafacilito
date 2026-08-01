# FASE 5 — REDISEÑO DE LA PÁGINA DE DETALLE DE PRÉSTAMO

> **Objetivo:** Implementar la vista única e integrada del préstamo que muestra cronológicamente el estado del capital, los intereses y cada abono realizado, con desglose explícito de cuánto de cada pago fue a interés y cuánto a capital.  
> **Prioridad:** Alta — Es la pantalla de referencia diaria para verificar el estado de un deudor.  
> **Duración estimada:** 3–5 días de desarrollo  
> **Prerequisito:** Fases 1, 2, 3 completadas.

---

## 5.1 CONTEXTO Y PROPÓSITO

La misión (sección 5) establece que el detalle de préstamo debe ser:

> "Vista única y clara para revisar el estado completo de un préstamo: cómo se calcula el interés, cómo baja el capital, cómo se amortiza o liquida."

### Problemas que resuelve:
- **P-037:** La UI actual separa "cronograma de cuotas" de "historial de pagos". Deben ser una sola vista.
- La vista actual es visualmente compleja (muchas tablas, muchos números sin contexto).
- No muestra explícitamente cuánto de cada abono fue a interés y cuánto a capital.

### Comparación: Situación actual vs. Objetivo

| Aspecto | Situación Actual | Objetivo |
|---------|-----------------|----------|
| Estructura | Dos secciones separadas | Una sola vista cronológica |
| Desglose de pagos | No visible | Explícito: X% interés, Y% capital |
| Visibilidad del saldo | Mostrada en múltiples lugares | Una sola línea de estado actual |
| Complejidad visual | Alta (tablas, badges, múltiples estados) | Baja (timeline simple y claro) |

---

## 5.2 DISEÑO DE LA NUEVA VISTA DE DETALLE

### Sección de Cabecera (siempre visible):

```
╔══════════════════════════════════════════════════════════════╗
║  ← Volver   PRÉSTAMO DE JUAN PÉREZ                          ║
║  Capital inicial: S/ 5,000.00 | Tasa: 10%/mes | 6 cuotas   ║
║  Emisión: 01 Ene 2027 | Vencimiento: 30 Jun 2027            ║
╠══════════════════════════════════════════════════════════════╣
║  ESTADO ACTUAL                                              ║
║  Capital Restante: S/ 3,333.33 (de S/ 5,000)               ║
║  Total pagado hasta hoy: S/ 2,033.33                        ║
║  Saldo total pendiente: S/ 4,116.67 (capital + intereses)   ║
║  Estado: 🟡 ACTIVO                                          ║
╚══════════════════════════════════════════════════════════════╝
```

### Sección del Timeline Cronológico:

```
CRONOGRAMA DE AMORTIZACIÓN — VISTA CRONOLÓGICA

MES 1 — Cuota 1 (vence 01 Feb 2027)
┌─────────────────────────────────────────────────────────────┐
│ Capital al inicio del mes: S/ 5,000.00                      │
│ Interés del mes (10%):    + S/   500.00                     │
│ Cuota esperada:             S/   833.33 + S/ 500.00         │
├─────────────────────────────────────────────────────────────┤
│ ✅ Pago recibido (15 Ene 2027): S/ 1,333.33               │
│    → A interés:  S/   500.00                                │
│    → A capital:  S/   833.33                                │
│ Capital restante: S/ 4,166.67                               │
└─────────────────────────────────────────────────────────────┘

MES 2 — Cuota 2 (vence 01 Mar 2027)
┌─────────────────────────────────────────────────────────────┐
│ Capital al inicio del mes: S/ 4,166.67                      │
│ Interés del mes (10%):    + S/   416.67                     │
│ Cuota esperada:             S/   833.33 + S/ 416.67         │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ Pago parcial (05 Feb 2027): S/ 500.00                  │
│    → A interés:  S/   416.67                                │
│    → A capital:  S/    83.33                                │
│ Capital restante: S/ 4,083.34                               │
│ 🟡 PENDIENTE — Faltan S/ 750.00 para completar la cuota   │
└─────────────────────────────────────────────────────────────┘

MES 3 — Cuota 3 (vence 01 Abr 2027) — PRÓXIMA
┌─────────────────────────────────────────────────────────────┐
│ Capital al inicio del mes: S/ 4,083.34                      │
│ Interés del mes (10%):    + S/   408.33                     │
│ Cuota proyectada:           S/ 1,241.67                     │
├─────────────────────────────────────────────────────────────┤
│ ⏳ SIN PAGO REGISTRADO                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 5.3 TAREAS DETALLADAS

### TAREA 5.3.1 — Actualizar el endpoint `GET /api/prestamos/:id`

El endpoint debe devolver la información estructurada para el timeline. Se añade un campo nuevo: `timeline`:

```typescript
interface TimelineMes {
  numero: number;
  fechaVencimiento: string;
  capitalInicioMes: number;
  interesMes: number;
  cuotaEsperada: number;       // interés + amortización capital
  amortizacionCapital: number; // Parte de capital que corresponde a esta cuota
  
  // Pagos reales recibidos en este período
  pagosRecibidos: {
    id: string;
    fecha: string;
    monto: number;
    aplicadoInteres: number;
    aplicadoCapital: number;
    metodo_pago: string;
    comprobante_url?: string;
  }[];
  
  totalPagado: number;
  capitalRestante: number;
  saldoPendienteCuota: number;  // Cuánto queda por pagar de esta cuota
  estado: 'Saldada' | 'Parcial' | 'Pendiente' | 'Vencida';
  diasVencidos: number;
}
```

**Respuesta completa del endpoint:**
```json
{
  "prestamo": { ...datosDeLaPrestamo... },
  "cliente": { ...datosDelCliente... },
  "resumen": {
    "capitalInicial": 5000,
    "capitalRestante": 3333.33,
    "totalPagado": 2033.33,
    "totalInteresesGenerados": 500,
    "totalInteresesPagados": 416.67,
    "saldoPendiente": 4116.67,
    "totalCuotas": 6,
    "cuotasPagadas": 1,
    "cuotasVencidas": 1,
    "estado": "activo"
  },
  "timeline": [ ...arreglo de TimelineMes... ]
}
```

---

### TAREA 5.3.2 — Crear el componente `TimelineDetallePrestamo`

**Estructura del componente React:**

```typescript
// src/components/prestamo/TimelineDetallePrestamo.tsx

interface Props {
  timeline: TimelineMes[];
  onRegistrarPago: (cuotaNumero: number) => void;
}

export const TimelineDetallePrestamo: React.FC<Props> = ({ timeline, onRegistrarPago }) => {
  return (
    <div className="timeline-container">
      {timeline.map((mes) => (
        <TimelineMesCard key={mes.numero} mes={mes} onRegistrarPago={onRegistrarPago} />
      ))}
    </div>
  );
};
```

**Estilos y colores por estado:**
- `Saldada`: borde izquierdo verde, icono ✅
- `Parcial`: borde izquierdo naranja, icono ⚠️
- `Vencida`: borde izquierdo rojo, icono 🚨
- `Pendiente`: borde izquierdo gris azulado, icono ⏳

---

### TAREA 5.3.3 — Implementar el formulario de "Nuevo Pago" dentro del detalle

Dentro de la página de detalle del préstamo, debe existir un **panel de registro de pago fijo** (no modal):

```
╔══════════════════════════════════════════════════╗
║  REGISTRAR NUEVO PAGO                            ║
║  ─────────────────────────────────────────────  ║
║  Cuota pendiente:  S/ 1,250.00                  ║
║  Capital restante: S/ 4,166.67                  ║
║                                                  ║
║  Monto: [_____________]  S/                     ║
║  Fecha: [___________]                            ║
║  Método: [Efectivo ▼]                           ║
║  Comprobante: [📎 Adjuntar voucher]             ║
║                                                  ║
║  [Guardar Pago]                                  ║
╚══════════════════════════════════════════════════╝
```

Al registrar el pago:
- El timeline se actualiza en tiempo real sin recargar la página.
- Si el préstamo queda liquidado, mostrar un banner de "PRÉSTAMO LIQUIDADO ✅".

---

### TAREA 5.3.4 — Panel de acciones del préstamo

En la cabecera, un menú de acciones secundarias:

```
[ ✏️ Editar Préstamo ] [ 📅 Sincronizar Calendario ] [ 📂 Documentos ]
```

**Editar Préstamo:**
- Permite cambiar: `fecha_vencimiento`, `notas`, `tasa_interes_porcentaje` (si el préstamo está activo).
- No permite cambiar `monto_capital` ni `fecha_emision` (integridad financiera).

**Sincronizar Calendario:**
- Botón que dispara manualmente `syncLoanScheduleToGoogleCalendar`.

**Documentos:**
- Enlaza a la sección de Vouchers/Documentos del cliente (Fase 9).

---

### TAREA 5.3.5 — Eliminar las pestañas/tabs separados de "Cronograma" y "Pagos"

**Qué eliminar de `PrestamoDetallePage.tsx`:**
- Cualquier selector de tab/pestaña entre "Cuotas", "Pagos realizados", u otras vistas separadas.
- Toda la lógica de estado de tab activo (`activeTab`, `selectedTab`, etc.).

**Qué reemplazar:**
- Una sola sección de timeline como se describe en esta fase.

---

### TAREA 5.3.6 — Sección de ajustes simplificada

Implementar el sistema de ajustes simplificado (2 tipos, acordado en el grill-me):

```
AJUSTES DEL PRÉSTAMO
  ─────────────────────────────────────────────────
  [+ Congelar interés de un mes] [+ Registrar acuerdo especial]
  
  Ajustes activos:
  ┌──────────────────────────────────────────────────────┐
  │ Congelar interés  │ Cuota 3 │ Activo │ [Desactivar] │
  └──────────────────────────────────────────────────────┘
```

**Formulario "Congelar interés de un mes":**
- Campo: número de cuota a congelar.
- Al activar, el interés de esa cuota se muestra como S/0 en el timeline.

**Formulario "Registrar acuerdo especial":**
- Campo: texto libre describiendo el acuerdo.
- Se guarda como `tipo = 'acuerdo_especial'` en la tabla `ajustes_prestamo`.
- Se muestra como nota informativa en el timeline, no afecta los cálculos.

---

## 5.4 PRUEBAS Y VERIFICACIÓN

1. **Timeline correcto con el modelo francés:**
   - Crear préstamo S/1000, 10%, 3 cuotas.
   - Verificar que el timeline muestra:
     - Mes 1: Capital=S/1000, Interés=S/100, Cuota=S/433.33
     - Mes 2: Capital=S/666.67, Interés=S/66.67, Cuota=S/400
     - Mes 3: Capital=S/333.33, Interés=S/33.33, Cuota=S/366.67

2. **Desglose de pago:**
   - Registrar un pago de S/433.33 para la cuota 1.
   - En el timeline debe mostrarse: "A interés: S/100.00, A capital: S/333.33".

3. **Pago parcial:**
   - Registrar un pago de S/80 (menos que el interés de S/100).
   - La cuota 1 debe quedar en estado "Parcial", saldo pendiente = S/353.33.

4. **Ajuste de congelar interés:**
   - Activar "Congelar interés" para la cuota 2.
   - El interés de la cuota 2 en el timeline debe mostrarse como S/0.

---

## 5.5 RIESGOS

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Timeline complejo de calcular para préstamos con muchos pagos | Baja | El sistema tiene ≤10 años de data (≤120 cuotas). Cálculo es O(n). |
| Usuarios confundidos por el desglose interés/capital | Media | Añadir tooltips explicativos: "¿Qué significa esto?". |
| La eliminación de tabs rompe flujos de usuarios existentes | Baja | El nuevo timeline muestra más información que antes. |

---

## 5.6 DEPENDENCIAS

- **Prerequisitos:** Fases 1, 2, 3 completadas.
- **Paralelo posible:** Puede desarrollarse en paralelo con Fase 4.
- **No bloquea:** Las fases 6, 7, 8, 9, 10 pueden iniciarse mientras esta se completa.
