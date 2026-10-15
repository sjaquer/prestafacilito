# ⚙️ Módulo Interno: Business Intelligence y Métricas Gerenciales (`bi.routes.ts`)

- **Ubicación del Código Fuente**: [`routes/bi.routes.ts`](file:///home/sjaquer/Downloads/prestafacilito/routes/bi.routes.ts) y [`routes/dashboard.routes.ts`](file:///home/sjaquer/Downloads/prestafacilito/routes/dashboard.routes.ts)
- **Integraciones**: Supabase PostgreSQL, Google Gemini SDK (`@google/genai`)
- **Propósito**: Calcular métricas de salud financiera, rentabilidad, evolución temporal de recaudaciones, distribución de riesgo de clientes y generación automatizada de informes gerenciales asistidos por IA.

---

## 📈 1. KPIs Financieros Calculados en Tiempo Real (`GET /api/bi/resumen`)

```typescript
export interface BIResumenResponse {
  capitalEnCirculacion: number;     // Capital activo vivo prestado
  saldoPendienteTotal: number;      // Total exigible (capital + moras acumuladas)
  prestamosAtrasadosCount: number;  // Número de préstamos con cuotas vencidas
  cobradoMesActual: number;         // Cobranza acumulada en el mes en curso (préstamos + alquileres)
  cobradoMesAnterior: number;       // Cobranza acumulada del mes cerrado anterior
  crecimientoMensualPorcentaje: number; // Tasa de crecimiento vs mes previo
  historialCobros: Array<{          // Array de los últimos 6 meses para gráficas
    mes: string;
    prestamos: number;
    alquileres: number;
    total: number;
  }>;
  distribucionRiesgo: {             // Desglose de cartera según Score A, B, C
    scoreA: number;
    scoreB: number;
    scoreC: number;
  };
  topDeudores: Array<{              // Principales clientes con mayor saldo pendiente
    clienteNombre: string;
    montoDeuda: number;
    diasAtrasoMax: number;
  }>;
}
```

---

## 🤖 2. Generación de Diagnóstico Financiero con IA (`POST /api/bi/generar-reporte-ia`)

El sistema utiliza el modelo **Google Gemini** para transformar los datos crudos de cartera en un reporte ejecutivo en lenguaje natural:

```typescript
router.post("/generar-reporte-ia", requireAuth, async (req, res) => {
  // 1. Recopila las métricas del resumen de BI
  // 2. Construye un prompt contextualizado con la cartera de préstamos y alquileres
  // 3. Invoca a @google/genai con modelo 'gemini-2.5-flash'
  // 4. Retorna el análisis con 3 secciones:
  //    a) Diagnóstico de Liquidez y Recuperación
  //    b) Estratificación de Cartera de Alto Riesgo
  //    c) 3 Recomendaciones Operativas Inmediatas
});
```

---

## 🖥️ 3. Componentes Visuales del Frontend

- **`KPICards.tsx`**: Tarjetas métricas con micrográficas Sparkline y variaciones porcentuales.
- **`MonthlyTrendChart.tsx`**: Gráfica de barras SVG interactiva mostrando los 6 últimos meses.
- **`LoanDistributionChart.tsx`**: Gráfica de pastel de distribución de tipos de préstamo (Personal, Garantía, Comercial).
- **`ReporteCobrosImagen.tsx`**: Generador de imagen PNG lista para compartir en WhatsApp con la recaudación del día.
