# FASE 4 — REDISEÑO DEL HOME (PÁGINA PRINCIPAL OPERATIVA)

> **Objetivo:** Convertir el Home en el centro de control operativo diario: formularios fijos (no modales), lista de deudores del mes completa (sin filtrar por estado de pago), y previsualización de cuotas al crear un préstamo.  
> **Prioridad:** Alta — Es la página que se usa diariamente.  
> **Duración estimada:** 4–6 días de desarrollo  
> **Prerequisito:** Fases 1, 2 y 3 completadas.

---

## 4.1 CONTEXTO Y PROPÓSITO

La página principal actual (`DashboardPage.tsx`) tiene varios problemas críticos:

1. **Formularios como modales** → La misión (4.3) los exige como secciones fijas.
2. **Deudores filtrados por estado de pago** → La misión (4.2) exige mostrar TODOS los del mes.
3. **No hay previsualización de cuotas** → La misión (4.4) lo requiere.
4. **Formulario de nuevo préstamo sin buscador de cliente** → La misión (4.3.A) lo requiere.
5. **El cálculo de mora se hace en el cliente** → Debería venir del servidor (P-049).

Esta fase reescribe completamente el Home con una nueva arquitectura de UI.

---

## 4.2 DISEÑO DE LA NUEVA PÁGINA PRINCIPAL

### Layout General (estructura de columnas):

```
╔══════════════════════════════════════════════════════════════╗
║  HEADER: "Centro de Control - [Mes Actual]"                  ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  [COLUMNA IZQUIERDA — 40%]    [COLUMNA DERECHA — 60%]       ║
║                                                              ║
║  ┌─────────────────────┐       ┌─────────────────────────┐  ║
║  │ SECCIÓN A:          │       │ SECCIÓN C:              │  ║
║  │ Crear Nuevo         │       │ Deudores del Mes        │  ║
║  │ Préstamo            │       │ Actual                  │  ║
║  │                     │       │                         │  ║
║  │ [Formulario fijo]   │       │ [Lista de tarjetas de   │  ║
║  │                     │       │  deudores]              │  ║
║  │ → Previsualización  │       │                         │  ║
║  │   de cuotas         │       │ Mostrar TODOS los que   │  ║
║  └─────────────────────┘       │ tienen cuota en el mes  │  ║
║                                │ actual, paguen o no.    │  ║
║  ┌─────────────────────┐       └─────────────────────────┘  ║
║  │ SECCIÓN B:          │                                     ║
║  │ Registrar Pago      │                                     ║
║  │                     │                                     ║
║  │ [Formulario fijo]   │                                     ║
║  └─────────────────────┘                                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 4.3 TAREAS DETALLADAS

### TAREA 4.3.1 — Implementar la Sección A: Formulario de "Crear Nuevo Préstamo"

**Campos del formulario:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| Cliente | Autocomplete | Busca por nombre o apodo. Muestra dropdown de coincidencias. Botón "+ Nuevo cliente" inline. |
| Capital | Número | Monto a prestar (S/ Soles) |
| Tasa de Interés | Número | Porcentaje mensual (0%–35%) |
| Número de Cuotas | Número | Cuántas cuotas mensuales (1–120) |
| Fecha de Emisión | Fecha | Por defecto: hoy |
| Tipo de Préstamo | Select | Personal, Negocio, Hipotecario |
| Notas | Textarea (opcional) | Campo libre |

**Previsualización de cuotas (TAREA 4.3.1.A):**

Debajo del formulario, de forma reactiva (sin botón, se actualiza al escribir):

```
╔══════════════════════════════════╗
║  PREVISUALIZACIÓN DE CUOTAS      ║
║  Capital: S/ 1,000 | Tasa: 15%  ║
║  Cuotas: 3                       ║
╠══════════════════════════════════╣
║  Cuota 1  | S/ 483.33 | Ene 2027 ║
║  Cuota 2  | S/ 433.33 | Feb 2027 ║
║  Cuota 3  | S/ 383.34 | Mar 2027 ║
╠══════════════════════════════════╣
║  Total a pagar: S/ 1,300.00      ║
║  Total intereses: S/ 300.00      ║
╚══════════════════════════════════╝
```

**Implementación del cálculo en el cliente (TypeScript):**

```typescript
// Hook: usePreviewCuotas.ts
export function usePreviewCuotas(capital: number, tasaMensual: number, numeroCuotas: number) {
  return useMemo(() => {
    if (!capital || !numeroCuotas || capital <= 0 || numeroCuotas <= 0) return null;
    
    const amortCapital = round2(capital / numeroCuotas);
    const cuotas = [];
    let capitalRestante = capital;
    let totalIntereses = 0;
    
    for (let i = 0; i < numeroCuotas; i++) {
      const interesMes = round2(capitalRestante * (tasaMensual / 100));
      const cuotaTotal = round2(amortCapital + interesMes);
      totalIntereses = round2(totalIntereses + interesMes);
      
      cuotas.push({
        numero: i + 1,
        interes: interesMes,
        amortizacion: amortCapital,
        cuotaTotal,
        capitalRestante: round2(capitalRestante - amortCapital)
      });
      
      capitalRestante = round2(capitalRestante - amortCapital);
    }
    
    return {
      cuotas,
      totalAPagar: round2(capital + totalIntereses),
      totalIntereses
    };
  }, [capital, tasaMensual, numeroCuotas]);
}
```

**Buscador de cliente (TAREA 4.3.1.B):**

```typescript
// Componente: ClienteAutocomplete.tsx
// - Input de texto libre
// - Al escribir ≥ 2 caracteres, filtra clientes por nombre_completo o apodo
// - Muestra dropdown con máx 8 resultados
// - Al seleccionar, guarda el cliente_id en el formulario
// - Botón "+ Crear cliente rápido" que abre un mini-formulario inline (sin modal):
//   Solo pide: nombre_completo, apodo, telefono → crea el cliente y lo selecciona automáticamente
```

---

### TAREA 4.3.2 — Implementar la Sección B: Formulario de "Registrar Pago"

**Campos del formulario:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| Cliente | Autocomplete | Busca el cliente |
| Préstamo | Select dinámico | Se carga después de seleccionar el cliente. Muestra sus préstamos activos. |
| Monto | Número | Monto del abono (S/ Soles) |
| Fecha del Pago | Fecha | Por defecto: hoy |
| Método de Pago | Select | Efectivo, Yape, Plin, Transferencia, Otro |
| Comprobante (opcional) | File/Camera | Subida de imagen del voucher |

**Comportamiento del formulario:**
- Al seleccionar el préstamo, mostrar abajo: saldo pendiente actual, última cuota pagada, cuota actual a pagar.
- Autodetectar si el monto ingresado corresponde a la cuota exacta, liquidación total, o pago parcial.
- Al registrar el pago, limpiar el formulario y actualizar la lista de deudores del mes automáticamente (sin recargar la página).

---

### TAREA 4.3.3 — Implementar la Sección C: Lista de Deudores del Mes

**Regla central (misión 4.2):**

> Mostrar a **TODOS** los deudores cuya próxima cuota vence dentro del mes actual, sin importar si ya pagaron.

**Algoritmo para determinar quién aparece:**

```typescript
function obtenerDeudoresDelMes(prestamos: Prestamo[], referenceDate: Date): Prestamo[] {
  const inicioMes = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const finMes = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  
  return prestamos.filter(p => {
    if (p.estado !== 'activo') return false;
    // La fecha de vencimiento definida al crear el préstamo
    const fechaVenc = normalizeDate(p.fecha_vencimiento || p.fecha_emision);
    // El día de vencimiento de este mes
    const diaVencimientoMes = new Date(
      referenceDate.getFullYear(), 
      referenceDate.getMonth(), 
      fechaVenc.getDate()
    );
    return diaVencimientoMes >= inicioMes && diaVencimientoMes <= finMes;
  });
}
```

**Diseño de la tarjeta de cada deudor:**

```
╔═══════════════════════════════════════════════╗
║  👤 Juan Pérez (Juancho)                Score: A ║
║  ─────────────────────────────────────────────  ║
║  Capital: S/ 5,000    Tasa: 10%/mes           ║
║  Cuota este mes: S/ 583.33                    ║
║  Vence el: 15 de enero                        ║
║                                               ║
║  Estado: [✅ PAGADO] / [⏳ PENDIENTE] / [🚨 ATRASADO] ║
║                                               ║
║  [Ver Detalle]  [Registrar Pago]  [WhatsApp] ║
╚═══════════════════════════════════════════════╝
```

**Información de cada tarjeta:**
- Nombre completo y apodo entre paréntesis (si existe).
- Capital original prestado y tasa de interés.
- Monto de la cuota de este mes.
- Fecha de vencimiento específica de este mes.
- Estado visual: PAGADO (si ya registró el pago del mes) / PENDIENTE (aún no vence) / ATRASADO (ya venció sin pagar).
- Botón "Registrar Pago" → rellena el formulario B automáticamente con este cliente/préstamo.
- Botón "WhatsApp" → genera el link con el mensaje predeterminado.
- Score del cliente (A/B/C) — si ya fue calculado en Fase 6.

**Ordenamiento de la lista:**
1. Primero: ATRASADOS (rojo).
2. Segundo: PENDIENTES (amarillo, los que no han vencido este mes).
3. Tercero: PAGADOS (verde).

---

### TAREA 4.3.4 — Actualizar el endpoint del Home en el servidor

**Nuevo endpoint: `GET /api/home`**

```typescript
// Devuelve todo lo que necesita el Home en una sola llamada:
{
  deudoresDelMes: [
    {
      prestamo_id: string,
      cliente_id: string,
      cliente_nombre: string,
      cliente_apodo: string,
      cliente_telefono: string,
      score: 'A' | 'B' | 'C' | null,
      monto_capital: number,
      tasa_interes_porcentaje: number,
      fecha_vencimiento: string,         // Fecha fija de referencia del préstamo
      dia_vencimiento_mes: string,       // Fecha exacta de este mes
      cuota_actual: number,              // Monto de la cuota de este mes
      estado_pago_mes: 'pagado' | 'pendiente' | 'atrasado',
      saldo_pendiente: number,
      dias_atraso: number                // 0 si no está atrasado
    }
  ],
  resumenCartera: {
    totalActivoCount: number,
    totalCapitalEnCirculacion: number,
    totalCobradoEsteMes: number,
    prestamosAtrasadosCount: number
  }
}
```

**Por qué un endpoint dedicado:**
- El cálculo del estado de pago del mes requiere `buildPaymentSchedule` por cada préstamo activo.
- Es mejor hacerlo en el servidor (Node.js) que en el cliente (browser) para no congelar la UI.
- Una sola llamada HTTP vs. múltiples (P-049 resuelto).

---

### TAREA 4.3.5 — Eliminar el modal `NewLoanModal` y las dependencias de la UI de modales

**Qué eliminar:**
- `src/components/dashboard/NewLoanModal.tsx` → eliminar archivo.
- Importación y uso de `NewLoanModal` en `DashboardPage.tsx`.
- Estado `showNewLoanModal` y su lógica de apertura/cierre.
- Cualquier otro modal del Home que sea reemplazado por secciones fijas.

**Qué conservar:**
- El hook `usePrestamos` (sigue siendo necesario).
- El hook `useClientes` (necesario para el autocomplete).

---

### TAREA 4.3.6 — Responsive design

La página debe ser usable en:
- **Desktop** (≥1200px): Layout de 2 columnas como se describió.
- **Tablet** (768px–1199px): Columnas apiladas (formularios arriba, lista abajo).
- **Mobile** (< 768px): Una columna, formularios colapsables con botón de "desplegar".

---

## 4.4 WIREFRAMES DE REFERENCIA

### Estado "Pendiente" de la tarjeta de deudor:
```
┌─────────────────────────────────────────────────────────────┐
│ ⏳ PENDIENTE                                    Score: [B]  │
│ María García  (Mary)                                         │
│ ─────────────────────────────────────────────────────────── │
│ Capital prestado: S/ 2,000.00 | Tasa: 8% mensual           │
│ Cuota de enero:  S/ 326.67                                  │
│ Vence: 20 de enero 2027                                     │
├─────────────────────────────────────────────────────────────┤
│ [📋 Ver Detalle]  [💰 Registrar Pago]  [💬 WhatsApp]       │
└─────────────────────────────────────────────────────────────┘
```

### Estado "Pagado":
```
┌─────────────────────────────────────────────────────────────┐
│ ✅ PAGADO                                       Score: [A]  │
│ Carlos Rodríguez  (Carlitos)                                │
│ ─────────────────────────────────────────────────────────── │
│ Capital prestado: S/ 3,000.00 | Tasa: 10% mensual         │
│ Cuota de enero:  S/ 430.00   ✓ Pagado el 15 ene           │
│ Vence: 20 de enero 2027                                     │
├─────────────────────────────────────────────────────────────┤
│ [📋 Ver Detalle]  [💰 Pago Adicional]  [💬 WhatsApp]       │
└─────────────────────────────────────────────────────────────┘
```

---

## 4.5 PRUEBAS Y VERIFICACIÓN

1. **Formulario de nuevo préstamo:**
   - Ingresar capital S/100, tasa 10%, 2 cuotas → previsualización debe mostrar S/60 y S/55.
   - Buscar cliente por apodo → debe aparecer en el autocomplete.
   - Crear cliente rápido inline → debe quedar seleccionado sin navegar a otra página.
   - Guardar préstamo → debe aparecer en la lista de deudores si el mes de su primera cuota es el mes actual.

2. **Formulario de registrar pago:**
   - Seleccionar cliente → deben cargarse sus préstamos activos en el selector.
   - Registrar pago → la tarjeta del deudor en la Sección C debe actualizarse a "PAGADO".

3. **Lista de deudores:**
   - Crear un préstamo que ya tiene el pago del mes registrado → debe aparecer en la lista (estado "PAGADO").
   - Crear un préstamo con fecha vencida → debe aparecer primero (estado "ATRASADO").
   - Crear un préstamo cuya cuota vence en el mes siguiente → NO debe aparecer en la lista.

---

## 4.6 RIESGOS

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| La UI de secciones fijas consume mucho espacio en pantalla | Media | Diseñar con formularios compactos; usar secciones colapsables en mobile. |
| El autocomplete de clientes es lento con muchos clientes | Baja | El proyecto tiene ≤50 clientes. Filtrar en el cliente directamente. |
| El endpoint `/api/home` tarda en calcular `buildPaymentSchedule` para todos | Media | Calcular solo préstamos activos del mes actual, no todos. |

---

## 4.7 DEPENDENCIAS

- **Prerequisitos:** Fases 1, 2, 3 completadas.
- **Bloquea:** Ninguna fase posterior depende del Home.
- **Paralelo posible:** Puede desarrollarse parcialmente en paralelo con Fase 5 (detalle de préstamo).
