# FASE 6 — SISTEMA DE SCORE DE CLIENTES (A/B/C)

> **Objetivo:** Implementar un sistema de puntuación de comportamiento de pago por cliente, calculado automáticamente con base en el historial real de amortizaciones, que el usuario puede sobreescribir manualmente si lo considera necesario.  
> **Prioridad:** Media–Alta.  
> **Duración estimada:** 3–4 días de desarrollo  
> **Prerequisito:** Fases 1, 2, 3 completadas.

---

## 6.1 CONTEXTO Y PROPÓSITO

La misión (sección 8) requiere:

> "El sistema debe generar un **score por rangos: A, B, C**."
> - A = mejor comportamiento de pago.
> - C = peor comportamiento de pago.

El score es esencial para que los administradores tomen decisiones rápidas al revisar un cliente:
- ¿Le doy otro préstamo?
- ¿Con qué tasa?
- ¿Cuánto capital máximo?

### Decisión acordada (del grill-me):
- El score se calcula **automáticamente** desde el historial.
- El usuario puede **sobreescribir** manualmente el score si considera que no es justo.

---

## 6.2 MODELO DE CÁLCULO DEL SCORE

### 6.2.1 Variables base del cálculo

El score se calcula sobre los préstamos pasados del cliente. Para cada préstamo se evalúa:

| Variable | Descripción | Peso |
|----------|-------------|------|
| `tasa_puntualidad` | % de cuotas pagadas a tiempo (antes o en la fecha de vencimiento) | 40% |
| `tasa_completitud` | % de cuotas pagadas completamente (sin quedar como "Parcial") | 25% |
| `tasa_liquidacion` | Si el préstamo fue liquidado completamente (0 o 1) | 20% |
| `dias_atraso_promedio` | Promedio de días de atraso en cuotas con retraso | 15% |

### 6.2.2 Algoritmo de clasificación

```typescript
// src/lib/scoreLogic.ts

export interface ScoreData {
  cuotasTotales: number;
  cuotasPagadasATiempo: number;
  cuotasPagadasCompletas: number;
  prestamosLiquidados: number;
  prestamosTotales: number;
  diasAtrasoPromedio: number;
  scoreNumerico: number;    // 0–100
  scoreLetra: 'A' | 'B' | 'C' | null;
  sobreescrito: boolean;    // Si fue modificado manualmente
  scoreManual?: 'A' | 'B' | 'C';
}

export function calcularScoreCliente(
  prestamos: Prestamo[],
  amortizaciones: Amortizacion[]
): ScoreData {
  if (prestamos.length === 0) {
    return {
      cuotasTotales: 0,
      cuotasPagadasATiempo: 0,
      cuotasPagadasCompletas: 0,
      prestamosLiquidados: 0,
      prestamosTotales: 0,
      diasAtrasoPromedio: 0,
      scoreNumerico: 0,
      scoreLetra: null,  // Sin historial suficiente
      sobreescrito: false
    };
  }
  
  let cuotasTotales = 0;
  let cuotasPagadasATiempo = 0;
  let cuotasPagadasCompletas = 0;
  let diasAtrasoTotal = 0;
  let cuotasConAtraso = 0;
  let prestamosLiquidados = 0;
  
  for (const prestamo of prestamos) {
    const pagosDelPrestamo = amortizaciones.filter(a => a.prestamo_id === prestamo.id);
    
    if (prestamo.estado === 'pagado') {
      prestamosLiquidados++;
    }
    
    const schedule = buildPaymentSchedule(prestamo, pagosDelPrestamo);
    const cuotasSaldadas = schedule.cuotas.filter(c => c.estado === 'Saldada');
    
    cuotasTotales += schedule.cuotas.length;
    cuotasPagadasCompletas += cuotasSaldadas.length;
    
    // Evaluar puntualidad: cuota pagada "a tiempo" si se pagó antes o en la fecha de vencimiento
    for (const cuota of cuotasSaldadas) {
      const fechaVenc = new Date(cuota.fechaVencimiento);
      const pagosDeLaCuota = pagosDelPrestamo.filter(p => {
        const fechaPago = new Date(p.fecha_pago);
        return fechaPago <= fechaVenc;
      });
      
      if (pagosDeLaCuota.length > 0) {
        cuotasPagadasATiempo++;
      } else {
        // Cuota pagada con atraso: calcular días
        const pagoDespues = pagosDelPrestamo.filter(p => {
          return new Date(p.fecha_pago) > fechaVenc;
        }).sort((a, b) => new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime())[0];
        
        if (pagoDespues) {
          const diasAtraso = Math.floor(
            (new Date(pagoDespues.fecha_pago).getTime() - fechaVenc.getTime()) / (24 * 60 * 60 * 1000)
          );
          diasAtrasoTotal += diasAtraso;
          cuotasConAtraso++;
        }
      }
    }
  }
  
  const diasAtrasoPromedio = cuotasConAtraso > 0 
    ? round2(diasAtrasoTotal / cuotasConAtraso) 
    : 0;
  
  // Calcular score numérico (0–100)
  const tasaPuntualidad = cuotasTotales > 0 ? cuotasPagadasATiempo / cuotasTotales : 0;
  const tasaCompletitud = cuotasTotales > 0 ? cuotasPagadasCompletas / cuotasTotales : 0;
  const tasaLiquidacion = prestamos.length > 0 ? prestamosLiquidados / prestamos.length : 0;
  const puntuacionAtraso = Math.max(0, 1 - (diasAtrasoPromedio / 30)); // 30 días = 0 puntos
  
  const scoreNumerico = round2(
    (tasaPuntualidad * 40) +
    (tasaCompletitud * 25) +
    (tasaLiquidacion * 20) +
    (puntuacionAtraso * 15)
  );
  
  let scoreLetra: 'A' | 'B' | 'C';
  if (scoreNumerico >= 70) scoreLetra = 'A';
  else if (scoreNumerico >= 40) scoreLetra = 'B';
  else scoreLetra = 'C';
  
  return {
    cuotasTotales,
    cuotasPagadasATiempo,
    cuotasPagadasCompletas,
    prestamosLiquidados,
    prestamosTotales: prestamos.length,
    diasAtrasoPromedio,
    scoreNumerico,
    scoreLetra,
    sobreescrito: false
  };
}
```

### 6.2.3 Umbrales de clasificación

| Rango de Score | Letra | Significado |
|---------------|-------|-------------|
| 70–100 | **A** | Cliente confiable. Paga a tiempo y completamente. |
| 40–69 | **B** | Cliente aceptable. Algunos atrasos o pagos parciales. |
| 0–39 | **C** | Cliente de riesgo. Frecuentes atrasos o préstamos sin liquidar. |
| Sin historial | **null** | Cliente nuevo, sin datos suficientes para evaluar. |

---

## 6.3 TAREAS DETALLADAS

### TAREA 6.3.1 — Crear la tabla `score_clientes` en la BD

```sql
-- MIGRACIÓN: Crear tabla de score de clientes
CREATE TABLE IF NOT EXISTS score_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE UNIQUE,
  
  -- Score calculado automáticamente
  score_numerico NUMERIC(5,2) DEFAULT 0,
  score_letra TEXT CHECK (score_letra IN ('A', 'B', 'C')) DEFAULT NULL,
  
  -- Datos del cálculo (para transparencia)
  cuotas_totales INTEGER DEFAULT 0,
  cuotas_a_tiempo INTEGER DEFAULT 0,
  cuotas_completas INTEGER DEFAULT 0,
  prestamos_liquidados INTEGER DEFAULT 0,
  prestamos_totales INTEGER DEFAULT 0,
  dias_atraso_promedio NUMERIC(6,2) DEFAULT 0,
  
  -- Override manual
  score_manual TEXT CHECK (score_manual IN ('A', 'B', 'C')) DEFAULT NULL,
  motivo_override TEXT DEFAULT '',
  
  -- Auditoría
  ultima_actualizacion TIMESTAMPTZ DEFAULT clock_timestamp()
);

COMMENT ON TABLE score_clientes IS 'Score de comportamiento de pago por cliente. Calculado automáticamente, con posibilidad de override manual.';
COMMENT ON COLUMN score_clientes.score_manual IS 'Si está presente, sobreescribe el score calculado automáticamente.';
```

---

### TAREA 6.3.2 — Crear el módulo `scoreLogic.ts`

**Archivo:** `src/lib/scoreLogic.ts`

Implementar la función `calcularScoreCliente` como se describió en la sección 6.2.

---

### TAREA 6.3.3 — Crear el endpoint `GET /api/clientes/:id/score`

```typescript
// Calcula o recupera el score de un cliente
// 1. Busca en tabla score_clientes
// 2. Si existe y fue calculado hace menos de 24h, devuelve el valor cacheado
// 3. Si no, recalcula y guarda en score_clientes
// 4. Si tiene score_manual, devuelve ese como el score efectivo

app.get("/api/clientes/:id/score", requireAuth, async (req, res) => {
  const clienteId = req.params.id;
  
  // Obtener préstamos y amortizaciones del cliente
  const [prestamosRes, amortRes, scoreRes] = await Promise.all([
    supabase.from("prestamos").select("*").eq("cliente_id", clienteId),
    supabase.from("amortizaciones").select("*"), // Filtrado en el cálculo
    supabase.from("score_clientes").select("*").eq("cliente_id", clienteId).maybeSingle()
  ]);
  
  const prestamos = prestamosRes.data || [];
  const amortizaciones = amortRes.data || [];
  const scoreExistente = scoreRes.data;
  
  // Calcular score
  const scoreData = calcularScoreCliente(prestamos, amortizaciones);
  
  // Guardar/actualizar en BD
  await supabase.from("score_clientes").upsert({
    cliente_id: clienteId,
    score_numerico: scoreData.scoreNumerico,
    score_letra: scoreData.scoreLetra,
    cuotas_totales: scoreData.cuotasTotales,
    cuotas_a_tiempo: scoreData.cuotasPagadasATiempo,
    cuotas_completas: scoreData.cuotasPagadasCompletas,
    prestamos_liquidados: scoreData.prestamosLiquidados,
    prestamos_totales: scoreData.prestamosTotales,
    dias_atraso_promedio: scoreData.diasAtrasoPromedio,
    ultima_actualizacion: new Date().toISOString()
  }, { onConflict: 'cliente_id' });
  
  const scoreEfectivo = scoreExistente?.score_manual || scoreData.scoreLetra;
  
  res.json({
    scoreNumerico: scoreData.scoreNumerico,
    scoreLetra: scoreData.scoreLetra,
    scoreEfectivo,     // Lo que se muestra al usuario
    sobreescrito: !!scoreExistente?.score_manual,
    motivoOverride: scoreExistente?.motivo_override || null,
    detalle: {
      cuotasTotales: scoreData.cuotasTotales,
      cuotasPagadasATiempo: scoreData.cuotasPagadasATiempo,
      cuotasPagadasCompletas: scoreData.cuotasPagadasCompletas,
      prestamosLiquidados: scoreData.prestamosLiquidados,
      prestamosTotales: scoreData.prestamosTotales,
      diasAtrasoPromedio: scoreData.diasAtrasoPromedio
    }
  });
});
```

---

### TAREA 6.3.4 — Crear el endpoint `PUT /api/clientes/:id/score/override`

```typescript
// Permite al usuario sobreescribir manualmente el score de un cliente
app.put("/api/clientes/:id/score/override", requireAuth, async (req, res) => {
  const { score_manual, motivo } = req.body;
  
  if (!['A', 'B', 'C', null].includes(score_manual)) {
    return res.status(400).json({ error: "Score debe ser A, B, C o null (para quitar el override)" });
  }
  
  await supabase.from("score_clientes").upsert({
    cliente_id: req.params.id,
    score_manual: score_manual || null,
    motivo_override: motivo || '',
    ultima_actualizacion: new Date().toISOString()
  }, { onConflict: 'cliente_id' });
  
  res.json({ success: true, scoreManual: score_manual });
});
```

---

### TAREA 6.3.5 — Actualizar la vista `resumen_financiero_clientes` para incluir el score

```sql
-- MIGRACIÓN: Agregar score a la vista de clientes
CREATE OR REPLACE VIEW resumen_financiero_clientes AS
SELECT
  c.*,
  -- ... (campos existentes de la vista de la Fase 2) ...
  COALESCE(sc.score_manual, sc.score_letra) AS score_efectivo,
  sc.score_numerico,
  sc.score_manual IS NOT NULL AS score_sobreescrito
FROM clientes c
LEFT JOIN prestamos p ON c.id = p.cliente_id AND (p.migrado_a_alquiler IS NULL OR NOT p.migrado_a_alquiler)
LEFT JOIN alquileres al ON c.id = al.cliente_id
LEFT JOIN score_clientes sc ON c.id = sc.cliente_id
GROUP BY c.id, ..., sc.score_manual, sc.score_letra, sc.score_numerico;
```

---

### TAREA 6.3.6 — Implementar el badge de Score en la UI

**Componente `ScoreBadge.tsx`:**

```typescript
// src/components/ui/ScoreBadge.tsx
interface Props {
  score: 'A' | 'B' | 'C' | null;
  sobreescrito?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SCORE_CONFIG = {
  'A': { color: '#10b981', bg: '#d1fae5', label: 'Excelente' },
  'B': { color: '#f59e0b', bg: '#fef3c7', label: 'Regular' },
  'C': { color: '#ef4444', bg: '#fee2e2', label: 'Riesgo' },
};

export const ScoreBadge: React.FC<Props> = ({ score, sobreescrito, size = 'md' }) => {
  if (!score) return <span className="score-badge score-sin-datos">S/D</span>;
  
  const config = SCORE_CONFIG[score];
  
  return (
    <span
      className={`score-badge score-${score.toLowerCase()} score-${size}`}
      style={{ color: config.color, backgroundColor: config.bg }}
      title={`${config.label}${sobreescrito ? ' (Score manual)' : ''}`}
    >
      {score}
      {sobreescrito && <span className="score-override-dot">●</span>}
    </span>
  );
};
```

---

### TAREA 6.3.7 — Panel de score en el detalle del cliente

En `ClienteDetallePage.tsx`, agregar una sección de Score:

```
╔══════════════════════════════════════════════════════════════╗
║  SCORE DE COMPORTAMIENTO DE PAGO                            ║
╠══════════════════════════════════════════════════════════════╣
║  Score calculado: [A] 85.3/100                              ║
║  ─────────────────────────────────────────────────────────  ║
║  • Cuotas a tiempo: 12/15 (80%)                            ║
║  • Cuotas completas: 14/15 (93%)                           ║
║  • Préstamos liquidados: 2/3 (67%)                         ║
║  • Atraso promedio: 5 días                                  ║
║  ─────────────────────────────────────────────────────────  ║
║  [Sobreescribir Score Manualmente]                          ║
╚══════════════════════════════════════════════════════════════╝
```

**Modal de override:**
```
Cambiar Score Manualmente
Score actual: A (calculado)
Nuevo score: [ A ] [ B ] [ C ]
Motivo: [______________________]
[Guardar] [Cancelar]
```

---

## 6.4 PRUEBAS Y VERIFICACIÓN

1. **Cliente sin historial:** Score debe ser `null` (sin datos).
2. **Cliente perfecto:** 10/10 cuotas a tiempo, 10/10 completas, 2/2 préstamos liquidados → Score A.
3. **Cliente regular:** Mezcla de pagos a tiempo y atrasados → Score B.
4. **Cliente de riesgo:** Mayoría de pagos atrasados, préstamos sin liquidar → Score C.
5. **Override manual:** Cambiar score de C a B, verificar que el badge muestra B con indicador de override.
6. **Quitar override:** Poner `score_manual = null`, verificar que vuelve al score calculado.

---

## 6.5 RIESGOS

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| El algoritmo de score es percibido como injusto | Media | Mostrar siempre el detalle del cálculo. Permitir override manual. |
| Clientes con poco historial tienen score inestable | Alta | Para clientes con ≤2 préstamos, mostrar "Historial insuficiente" en lugar de score C. |

---

## 6.6 DEPENDENCIAS

- **Prerequisitos:** Fases 1, 2, 3 completadas.
- **Bloquea:** El score aparece en la lista de clientes (Fase 7) y en las tarjetas del Home (Fase 4).
