# ⚙️ Módulo Interno: Motor de Scoring Crediticio (`scoreLogic.ts`)

- **Ubicación del Código Fuente**: [`src/lib/scoreLogic.ts`](file:///home/sjaquer/Downloads/prestafacilito/src/lib/scoreLogic.ts)
- **Pruebas Automatizadas**: [`src/lib/__tests__/scoreLogic.test.ts`](file:///home/sjaquer/Downloads/prestafacilito/src/lib/__tests__/scoreLogic.test.ts)
- **Propósito**: Calcular de forma objetiva la calificación crediticia (Score numérico de 0 a 100 y Letra A/B/C) de un cliente a partir de su historial financiero en la plataforma.

---

## 📋 1. Interfaces y Estructura de Datos

```typescript
export interface ScoreData {
  cuotasTotales: number;
  cuotasPagadasATiempo: number;
  cuotasPagadasCompletas: number;
  prestamosLiquidados: number;
  prestamosTotales: number;
  diasAtrasoPromedio: number;
  scoreNumerico: number; // 0–100
  scoreLetra: "A" | "B" | "C" | null;
  sobreescrito: boolean;
  scoreManual?: "A" | "B" | "C" | null;
}
```

---

## 🧮 2. Algoritmo Ponderado de Scoring

La puntuación final se calcula mediante una suma ponderada de 4 factores clave:

$$\text{Score Numérico} = (T_{\text{puntualidad}} \times 40) + (T_{\text{completitud}} \times 25) + (T_{\text{liquidación}} \times 20) + (P_{\text{atraso}} \times 15)$$

### Desglose de Factores:
1. **Tasa de Puntualidad (Peso: 40%)**:
   $$T_{\text{puntualidad}} = \frac{\text{Cuotas pagadas en o antes de la fecha de vencimiento}}{\text{Cuotas Totales Devengadas}}$$
2. **Tasa de Completitud (Peso: 25%)**:
   $$T_{\text{completitud}} = \frac{\text{Cuotas saldadas al 100\%}}{\text{Cuotas Totales Devengadas}}$$
3. **Tasa de Liquidación de Préstamos (Peso: 20%)**:
   $$T_{\text{liquidación}} = \frac{\text{Préstamos en estado 'pagado'}}{\text{Total de Préstamos Históricos}}$$
4. **Puntuación por Días de Atraso (Peso: 15%)**:
   $$P_{\text{atraso}} = \max\left(0, 1 - \frac{\text{Días de Atraso Promedio}}{30}\right)$$

---

## 🏷️ 3. Mapeo a Letras y Rango de Decisión

| Score Numérico | Calificación | Categoría | Interpretación Financiera |
| :---: | :---: | :---: | :--- |
| **70.00 – 100.00** | **A** | 🟢 Excelente | Cliente puntual, bajo riesgo de mora. Elegible para mejores tasas y montos mayores. |
| **40.00 – 69.99** | **B** | 🟡 Regular | Cliente con demoras leves pero cumplidor. Requiere seguimiento estándar. |
| **0.00 – 39.99** | **C** | 🔴 Alto Riesgo | Cliente moroso o con atrasos severos (>30 días). No se recomienda nuevo crédito sin garantía líquida. |
| **Sin Préstamos** | **null** | ⚪ Nuevo | Cliente nuevo sin historial previo evaluado. |

---

## 🛠️ 4. Función: `calcularScoreCliente`

```typescript
export function calcularScoreCliente(
  prestamos: Prestamo[],
  amortizaciones: Amortizacion[]
): ScoreData;
```

### Manejo de Casos Especiales:
- **Cliente sin préstamos**: Retorna `scoreNumerico: 0` y `scoreLetra: null`.
- **Sobreescritura Manual**: Si el campo `score` en la tabla `clientes` fue modificado manualmente por un Administrador, la interfaz visual respeta el `scoreManual` pero muestra el desglose del score calculado para auditoría.
