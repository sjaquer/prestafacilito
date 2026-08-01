import { Prestamo, Amortizacion } from "../types";
import { buildPaymentSchedule, round2, normalizeDate } from "./loanLogic";

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

export function calcularScoreCliente(
  prestamos: Prestamo[],
  amortizaciones: Amortizacion[]
): ScoreData {
  if (!prestamos || prestamos.length === 0) {
    return {
      cuotasTotales: 0,
      cuotasPagadasATiempo: 0,
      cuotasPagadasCompletas: 0,
      prestamosLiquidados: 0,
      prestamosTotales: 0,
      diasAtrasoPromedio: 0,
      scoreNumerico: 0,
      scoreLetra: null,
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
    const pagosDelPrestamo = amortizaciones.filter(
      (a) => a.prestamo_id === prestamo.id
    );

    if (prestamo.estado === "pagado") {
      prestamosLiquidados++;
    }

    const schedule = buildPaymentSchedule(prestamo, pagosDelPrestamo);
    const cuotasSaldadas = schedule.cuotas.filter((c) => c.estado === "Saldada");

    cuotasTotales += schedule.cuotas.length;
    cuotasPagadasCompletas += cuotasSaldadas.length;

    for (const cuota of cuotasSaldadas) {
      const fechaVenc = normalizeDate(cuota.fechaVencimiento);
      const pagosDeLaCuota = pagosDelPrestamo.filter((p) => {
        const fechaPago = normalizeDate(p.fecha_pago);
        return fechaPago <= fechaVenc;
      });

      if (pagosDeLaCuota.length > 0) {
        cuotasPagadasATiempo++;
      } else {
        const pagoDespues = pagosDelPrestamo
          .filter((p) => normalizeDate(p.fecha_pago) > fechaVenc)
          .sort(
            (a, b) =>
              normalizeDate(a.fecha_pago).getTime() -
              normalizeDate(b.fecha_pago).getTime()
          )[0];

        if (pagoDespues) {
          const diasAtraso = Math.floor(
            (normalizeDate(pagoDespues.fecha_pago).getTime() -
              fechaVenc.getTime()) /
              (24 * 60 * 60 * 1000)
          );
          diasAtrasoTotal += Math.max(0, diasAtraso);
          cuotasConAtraso++;
        }
      }
    }
  }

  const diasAtrasoPromedio =
    cuotasConAtraso > 0 ? round2(diasAtrasoTotal / cuotasConAtraso) : 0;

  const tasaPuntualidad =
    cuotasTotales > 0 ? cuotasPagadasATiempo / cuotasTotales : 0;
  const tasaCompletitud =
    cuotasTotales > 0 ? cuotasPagadasCompletas / cuotasTotales : 0;
  const tasaLiquidacion =
    prestamos.length > 0 ? prestamosLiquidados / prestamos.length : 0;
  const puntuacionAtraso = Math.max(0, 1 - diasAtrasoPromedio / 30);

  const scoreNumerico = round2(
    tasaPuntualidad * 40 +
      tasaCompletitud * 25 +
      tasaLiquidacion * 20 +
      puntuacionAtraso * 15
  );

  let scoreLetra: "A" | "B" | "C";
  if (scoreNumerico >= 70) scoreLetra = "A";
  else if (scoreNumerico >= 40) scoreLetra = "B";
  else scoreLetra = "C";

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
