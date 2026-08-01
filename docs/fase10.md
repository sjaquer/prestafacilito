# FASE 10 — GOOGLE CALENDAR MEJORADO + DASHBOARD/BI REAL

> **Objetivo:** (A) Mejorar la integración con Google Calendar para que los eventos de cuotas se creen, actualicen y eliminen de forma confiable y completa. (B) Implementar el Dashboard/BI con estadísticas y gráficas reales calculadas en el servidor, sin IA generativa.  
> **Prioridad:** Media.  
> **Duración estimada:** 4–5 días de desarrollo  
> **Prerequisito:** Fases 1–3 completadas. Las fases 4–9 aportarán datos más completos al Dashboard.

---

## 10.1 PARTE A — GOOGLE CALENDAR MEJORADO

### 10.1.1 Contexto

La integración actual con Google Calendar existe pero tiene problemas:
- Los eventos se crean al registrar préstamos, pero no siempre se limpian al modificarlos.
- No existe sincronización para alquileres (nueva entidad de la Fase 8).
- No hay eventos de "pago recibido" que le recuerden al administrador quién pagó cuándo.
- La función `syncLoanScheduleToGoogleCalendar` no tiene reintentos ante fallos de red.

### 10.1.2 Estrategia de sincronización

**Modelo de eventos en el calendario:**

| Tipo de evento | Cuándo se crea | Cuándo se actualiza | Cuándo se elimina |
|---------------|----------------|--------------------|--------------------|
| Cuota de préstamo pendiente | Al crear el préstamo | Al cambiar monto/fecha | Al pagar la cuota |
| Cuota de préstamo vencida | Se marca automáticamente | Al registrar el pago tardío | Al saldar la cuota |
| Pago recibido (solo lectura) | Al registrar el pago | Nunca | Al eliminar el pago |
| Mes de alquiler | Al crear el contrato | Al cambiar el monto mensual | Al pagar el mes |
| Contrato finalizado | Al finalizar el contrato (1 evento) | Nunca | Nunca |

### 10.1.3 Formato de los eventos

**Cuota de préstamo pendiente:**
```
📅 Título: "Cuota 3/6 — Juan Pérez — S/ 483.33"
📍 Descripción: 
   Préstamo personal
   Capital original: S/ 2,000.00
   Interés del mes: S/ 66.67
   Capital a amortizar: S/ 333.33
   Saldo restante tras pago: S/ 1,333.33
   Método de pago preferido: Yape / 999 888 777
🏷️ Color: Rojo (pendiente) → Verde (al pagar)
⏰ Recordatorio: 1 día antes
```

**Pago recibido:**
```
📅 Título: "✅ PAGO — Juan Pérez — S/ 483.33 (Yape)"
📍 Descripción:
   Pago recibido para Cuota 3/6
   Método: Yape
   Imputado: S/ 66.67 a interés, S/ 416.66 a capital
🏷️ Color: Verde
```

---

### TAREA 10.1.4 — Refactorizar `syncLoanScheduleToGoogleCalendar`

**Nuevo comportamiento de la función:**

```typescript
// services/google-calendar.ts
export async function syncLoanScheduleToGoogleCalendar(prestamoId: string): Promise<void> {
  const [prestamoRes, pagosRes, ajustesRes] = await Promise.all([
    supabase.from("prestamos").select("*").eq("id", prestamoId).single(),
    supabase.from("amortizaciones").select("*").eq("prestamo_id", prestamoId),
    supabase.from("ajustes_prestamo").select("*").eq("prestamo_id", prestamoId)
  ]);
  
  const prestamo = prestamoRes.data;
  const pagos = pagosRes.data || [];
  const ajustes = ajustesRes.data || [];
  
  if (!prestamo) return;
  
  // Obtener cliente para el nombre
  const { data: cliente } = await supabase
    .from("clientes")
    .select("nombre_completo, apodo, telefono")
    .eq("id", prestamo.cliente_id)
    .single();
  
  const schedule = buildPaymentSchedule(prestamo, pagos, { ajustes });
  const accessToken = await getGoogleDriveAccessToken();
  const calendarId = getGoogleCalendarId(); // Nueva variable de entorno
  
  // Para cada cuota en el cronograma
  for (const cuota of schedule.cuotas) {
    const eventoId = `prestafacilito-${prestamoId}-cuota-${cuota.numero}`;
    
    if (cuota.estado === 'Saldada') {
      // Eliminar el evento de cuota pendiente (ya fue pagada)
      await eliminarEventoCalendar(accessToken, calendarId, eventoId);
    } else {
      // Crear o actualizar el evento de cuota pendiente
      await upsertEventoCalendar(accessToken, calendarId, {
        id: eventoId,
        summary: `Cuota ${cuota.numero}/${schedule.cuotas.length} — ${cliente?.nombre_completo} — S/ ${cuota.montoExigible}`,
        description: formatDescripcionCuota(prestamo, cuota, cliente),
        start: { date: cuota.fechaVencimiento },
        end: { date: cuota.fechaVencimiento },
        colorId: cuota.estado === 'Vencida' ? '11' : '5', // Rojo o amarillo
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }] }
      });
    }
  }
}
```

---

### TAREA 10.1.5 — Agregar función `syncAlquilerToGoogleCalendar`

```typescript
export async function syncAlquilerToGoogleCalendar(alquilerId: string): Promise<void> {
  // Obtener los próximos 3 meses de pagos pendientes
  // Crear/actualizar eventos para cada mes pendiente
  // Eliminar eventos de meses ya pagados
}
```

---

### TAREA 10.1.6 — Agregar variable de entorno `GOOGLE_CALENDAR_ID`

Actualmente el Calendar ID está hardcodeado o usa el calendario "primary". Debería ser configurable:

```env
GOOGLE_CALENDAR_ID=primary   # o el ID del calendario específico
```

---

### TAREA 10.1.7 — Implementar reintentos para las llamadas a Google APIs

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      // Solo reintentar en errores transitorios (429, 503, timeout)
      if (err.status !== 429 && err.status !== 503 && !err.message?.includes('timeout')) throw err;
      const delay = Math.pow(2, attempt) * 1000; // Backoff exponencial: 2s, 4s, 8s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Max retries reached");
}
```

---

## 10.2 PARTE B — DASHBOARD / BI REAL

### 10.2.1 Contexto y decisión

**Decisión acordada (del grill-me):**
> "El análisis IA (Gemini) se elimina completamente. El nuevo Dashboard/BI usa datos reales calculados en el servidor."

El endpoint `/api/ai/reporte-gerencial` y todo el código de Gemini/IA se eliminan. Se reemplaza por un Dashboard con estadísticas reales.

### 10.2.2 Diseño del Dashboard

**Sección 1 — Resumen General (KPIs del mes):**

```
╔════════╗  ╔════════╗  ╔════════╗  ╔════════╗
║ S/ 50K ║  ║  S/ 8K ║  ║   12   ║  ║   3    ║
║Capital ║  ║Cobrado ║  ║Activos ║  ║Atras.  ║
║Total   ║  ║Mes Act.║  ║       ║  ║        ║
╚════════╝  ╚════════╝  ╚════════╝  ╚════════╝
```

**Sección 2 — Gráfica de cobros mensuales (últimos 6 meses):**

```
S/ 10,000  ┤ ██████████
S/  8,000  ┤ ████████  ██████
S/  6,000  ┤ ██████  ████
S/  4,000  ┤ ████
S/  2,000  ┤ ██
S/      0  ┼──────────────────────
            Ago Sep Oct Nov Dic Ene
```

**Sección 3 — Estado de la cartera:**

```
CARTERA DE PRÉSTAMOS ACTIVOS

Por estado de pago del mes:
  ✅ Pagados al día:     7 clientes
  ⏳ Pendientes (aún no vencen): 3 clientes
  🚨 Atrasados:          2 clientes

Por tasa de interés:
  5–9%:    4 préstamos
  10–14%:  5 préstamos
  15–20%:  3 préstamos
```

**Sección 4 — Top 5 clientes por capital activo:**

```
Juan Pérez          S/ 12,000.00  [A] →
María García        S/  8,500.00  [B] →
Carlos Rodríguez    S/  7,000.00  [A] →
Ana Lima            S/  5,000.00  [B] →
Pedro Soto          S/  4,500.00  [C] →
```

---

### TAREA 10.2.3 — Crear el endpoint `GET /api/bi/resumen`

```typescript
app.get("/api/bi/resumen", requireAuth, async (req, res) => {
  // 1. Cargar todos los datos necesarios en paralelo
  const [prestamosRes, amortRes, alquileresRes, pagosAlqRes, clientesRes] = await Promise.all([
    supabase.from("prestamos").select("*"),
    supabase.from("amortizaciones").select("*"),
    supabase.from("alquileres").select("*"),
    supabase.from("pagos_alquiler").select("*"),
    supabase.from("resumen_financiero_clientes").select("*")
  ]);
  
  const prestamos = prestamosRes.data || [];
  const amortizaciones = amortRes.data || [];
  const alquileres = alquileresRes.data || [];
  const pagosAlquiler = pagosAlqRes.data || [];
  const clientes = clientesRes.data || [];
  
  const now = new Date();
  const inicioMesActual = new Date(now.getFullYear(), now.getMonth(), 1);
  const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  // 2. Calcular KPIs
  const prestamosActivos = prestamos.filter(p => p.estado === 'activo');
  const prestamosPagados = prestamos.filter(p => p.estado === 'pagado');
  
  // Capital total en circulación (solo activos)
  const capitalEnCirculacion = prestamosActivos.reduce(
    (sum, p) => sum + toNumber(p.monto_capital), 0
  );
  
  // Calcular saldos pendientes reales con buildPaymentSchedule
  let saldoPendienteTotal = 0;
  let prestamosAtrasadosCount = 0;
  
  for (const p of prestamosActivos) {
    const pagos = amortizaciones.filter(a => a.prestamo_id === p.id);
    const estado = buildPaymentSchedule(p, pagos);
    saldoPendienteTotal += estado.resumen.saldoPendiente;
    if (estado.resumen.cuotasVencidas > 0) prestamosAtrasadosCount++;
  }
  
  // Cobros del mes actual (amortizaciones + pagos de alquiler)
  const cobradoMesActual = [
    ...amortizaciones.filter(a => new Date(a.fecha_pago) >= inicioMesActual),
    ...pagosAlquiler.filter(p => new Date(p.fecha_pago) >= inicioMesActual)
  ].reduce((sum, p) => sum + toNumber(p.monto), 0);
  
  // Cobros mes anterior
  const cobradoMesAnterior = [
    ...amortizaciones.filter(a => {
      const fecha = new Date(a.fecha_pago);
      return fecha >= inicioMesAnterior && fecha < inicioMesActual;
    }),
    ...pagosAlquiler.filter(p => {
      const fecha = new Date(p.fecha_pago);
      return fecha >= inicioMesAnterior && fecha < inicioMesActual;
    })
  ].reduce((sum, p) => sum + toNumber(p.monto), 0);
  
  // 3. Histórico de cobros mensual (últimos 6 meses)
  const historial = [];
  for (let i = 5; i >= 0; i--) {
    const inicioMes = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const finMes = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    const cobrado = [
      ...amortizaciones.filter(a => {
        const f = new Date(a.fecha_pago);
        return f >= inicioMes && f <= finMes;
      }),
      ...pagosAlquiler.filter(p => {
        const f = new Date(p.fecha_pago);
        return f >= inicioMes && f <= finMes;
      })
    ].reduce((sum, p) => sum + toNumber(p.monto), 0);
    
    historial.push({
      mes: inicioMes.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }),
      cobrado: round2(cobrado)
    });
  }
  
  // 4. Top 5 clientes por capital activo (desde la vista)
  const top5Clientes = clientes
    .filter(c => c.prestamos_activos > 0)
    .sort((a, b) => toNumber(b.capital_total_prestado) - toNumber(a.capital_total_prestado))
    .slice(0, 5)
    .map(c => ({
      id: c.id,
      nombre: c.nombre_completo,
      apodo: c.apodo,
      capitalActivo: toNumber(c.capital_total_prestado),
      prestamosActivos: c.prestamos_activos,
      score: c.score_efectivo || null
    }));
  
  res.json({
    kpis: {
      capitalEnCirculacion: round2(capitalEnCirculacion),
      saldoPendienteTotal: round2(saldoPendienteTotal),
      cobradoMesActual: round2(cobradoMesActual),
      cobradoMesAnterior: round2(cobradoMesAnterior),
      prestamosActivosCount: prestamosActivos.length,
      prestamosPagadosCount: prestamosPagados.length,
      prestamosAtrasadosCount,
      totalClientes: clientes.length,
      alquileresActivos: alquileres.filter(a => a.estado === 'activo').length
    },
    historialCobros: historial,
    top5Clientes
  });
});
```

---

### TAREA 10.2.4 — Crear la página `DashboardBIPage.tsx`

**Componentes a implementar:**

```typescript
// src/pages/DashboardBIPage.tsx
// Secciones:
// 1. KPIsRow (4 tarjetas de resumen)
// 2. GraficaCobrosHistorial (gráfica de barras — últimos 6 meses)
// 3. EstadoCartera (distribución por estado de pago)
// 4. Top5Clientes (lista con score y capital)
```

**Gráfica de barras (usando una librería ligera):**

Se recomienda usar `chart.js` con `react-chartjs-2` (ya puede estar instalado) o, si no, una gráfica SVG hecha a mano para evitar dependencias:

```typescript
// Gráfica SVG simple para el historial de cobros
const GraficaBarras: React.FC<{ data: { mes: string; cobrado: number }[] }> = ({ data }) => {
  const max = Math.max(...data.map(d => d.cobrado));
  
  return (
    <svg viewBox="0 0 600 200" className="grafica-barras">
      {data.map((d, i) => {
        const altura = (d.cobrado / max) * 160;
        const x = i * 90 + 30;
        return (
          <g key={d.mes}>
            <rect x={x} y={200 - altura - 30} width={60} height={altura}
              fill="#3b82f6" rx={4} />
            <text x={x + 30} y={195} textAnchor="middle" fontSize={11}>
              {d.mes}
            </text>
            <text x={x + 30} y={200 - altura - 35} textAnchor="middle" fontSize={10}>
              S/{(d.cobrado / 1000).toFixed(1)}K
            </text>
          </g>
        );
      })}
    </svg>
  );
};
```

---

### TAREA 10.2.5 — Eliminar el endpoint de IA y el código de Gemini

**Qué eliminar:**
- Endpoint `POST /api/ai/reporte-gerencial` (líneas 2175–2400 de `server-app.ts`).
- Importación de `@google/generative-ai`.
- Variable `ai` (instancia del modelo Gemini).
- La línea de `.env` con `GOOGLE_AI_API_KEY` (o dejar con instrucción de que ya no es necesaria).

**Qué actualizar en el frontend:**
- Eliminar cualquier componente o página que consumía el reporte de IA.
- Reemplazar con el link al nuevo Dashboard/BI.

---

### TAREA 10.2.6 — Actualizar la navegación

El menú de navegación debe quedar así:

```
🏠 Home (Centro de Control)
👥 Clientes
📊 Cartera (lista de préstamos)
🏠 Alquileres
📈 Dashboard / BI
📅 Calendario        ← Enlace a Google Calendar (abre en nueva pestaña)
```

Eliminar del menú:
- "Análisis IA" / "Reporte Gerencial".
- "Bitácora" (ya eliminada en Fase 1).
- "Reportes" (el placeholder vacío eliminado en Fase 1).

---

## 10.3 PRUEBAS Y VERIFICACIÓN

### Google Calendar:

1. **Crear préstamo:** Verificar que se crean eventos en el calendario para cada cuota.
2. **Registrar pago:** Verificar que el evento de la cuota pagada se elimina del calendario.
3. **Editar fecha de cuota:** Verificar que el evento se actualiza con la nueva fecha.
4. **Finalizar alquiler:** Verificar que los eventos futuros del alquiler se eliminan.

### Dashboard/BI:

5. **KPIs correctos:** El "Capital en circulación" debe coincidir con la suma manual de los préstamos activos.
6. **Gráfica histórica:** El mes actual debe mostrar el total real de cobros registrados.
7. **Top 5 clientes:** Verificar que los 5 primeros son los de mayor capital activo.

---

## 10.4 RIESGOS

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| El ID del evento de Calendar (`prestafacilito-{prestamoId}-cuota-{n}`) excede el límite de Google | Baja | Los IDs de Calendar pueden tener hasta 1024 chars. Los UUIDs de Supabase tienen 36. Safe. |
| El Dashboard es lento porque llama a `buildPaymentSchedule` para todos los préstamos activos | Media | Calcular solo una vez al cargar y cachear el resultado por 5 minutos. |
| La eliminación de Gemini rompe alguna otra funcionalidad | Baja | Buscar todas las referencias a `@google/generative-ai` y `GOOGLE_AI_API_KEY` antes de eliminar. |

---

## 10.5 DEPENDENCIAS

- **Prerequisitos:** Fase 1 (para la reestructura del servidor), Fase 3 (para `buildPaymentSchedule`).
- **Paralelo posible:** La Parte B (Dashboard/BI) puede desarrollarse en paralelo con las Fases 4–9.
- **Esta es la última fase.** El proyecto está completo.

---

## RESUMEN DEL ROADMAP COMPLETO

| Fase | Nombre | Prioridad | Duración Est. |
|------|--------|-----------|---------------|
| 1 | Limpieza Estructural | 🔴 Crítica | 4–6 días |
| 2 | Refactorización de BD | 🔴 Alta | 2–3 días |
| 3 | Motor de Préstamos + Alquileres | 🔴 Alta | 5–7 días |
| 4 | Rediseño del Home | 🔴 Alta | 4–6 días |
| 5 | Detalle de Préstamo | 🟠 Alta | 3–5 días |
| 6 | Score A/B/C | 🟠 Media-Alta | 3–4 días |
| 7 | Gestión de Clientes | 🟠 Media | 3–4 días |
| 8 | Módulo de Alquileres (UI) | 🟠 Media | 3–4 días |
| 9 | Vouchers y Documentos | 🟡 Media-Baja | 2–3 días |
| 10 | Calendar + Dashboard/BI | 🟡 Media | 4–5 días |
| | **TOTAL** | | **33–47 días** |
