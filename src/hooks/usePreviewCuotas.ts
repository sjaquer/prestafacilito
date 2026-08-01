import { useMemo } from "react";
import { round2 } from "../lib/loanLogic";

export interface PreviewCuotaItem {
  numero: number;
  interes: number;
  amortizacion: number;
  cuotaTotal: number;
  capitalRestante: number;
}

export interface PreviewCuotasResult {
  cuotas: PreviewCuotaItem[];
  totalAPagar: number;
  totalIntereses: number;
  amortizacionFija: number;
}

export function usePreviewCuotas(
  capital: number,
  tasaMensual: number,
  numeroCuotas: number
): PreviewCuotasResult | null {
  return useMemo(() => {
    if (!capital || !numeroCuotas || capital <= 0 || numeroCuotas <= 0) {
      return null;
    }

    const tasaFraccion = (tasaMensual || 0) / 100;
    const amortCapital = round2(capital / numeroCuotas);
    const cuotas: PreviewCuotaItem[] = [];
    let capitalRestante = capital;
    let totalIntereses = 0;

    for (let i = 0; i < numeroCuotas; i++) {
      const interesMes = round2(capitalRestante * tasaFraccion);
      const cuotaTotal = round2(amortCapital + interesMes);
      totalIntereses = round2(totalIntereses + interesMes);
      const siguienteCapital = Math.max(0, round2(capitalRestante - amortCapital));

      cuotas.push({
        numero: i + 1,
        interes: interesMes,
        amortizacion: amortCapital,
        cuotaTotal,
        capitalRestante: siguienteCapital
      });

      capitalRestante = siguienteCapital;
    }

    return {
      cuotas,
      totalAPagar: round2(capital + totalIntereses),
      totalIntereses,
      amortizacionFija: amortCapital
    };
  }, [capital, tasaMensual, numeroCuotas]);
}
