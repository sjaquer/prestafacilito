import { Prestamo, Amortizacion, AjustePrestamo } from "../types";
import { buildPaymentSchedule, round2 } from "./loanLogic.js";
import { proximoCobroPrestamo } from "./proximoCobro.js";

export interface ScoreData {
  /** Cuotas ya vencidas que tenían algo que pagar (las congeladas o al 0 % no cuentan). */
  cuotasTotales: number;
  /** De esas, las que se cubrieron completas dentro de su mes. */
  cuotasPagadasATiempo: number;
  /** Igual que a tiempo (se mantiene por compatibilidad con la ficha del cliente). */
  cuotasPagadasCompletas: number;
  prestamosLiquidados: number;
  prestamosTotales: number;
  /** Días promedio de atraso de las cuotas que hoy siguen sin cubrir. */
  diasAtrasoPromedio: number;
  /** Cuotas atrasadas hoy, sumando todos sus préstamos. */
  cuotasAtrasadasHoy: number;
  scoreNumerico: number; // 0–100
  scoreLetra: "A" | "B" | "C" | null;
  sobreescrito: boolean;
  scoreManual?: "A" | "B" | "C" | null;
}

const SIN_HISTORIAL = {
  cuotasTotales: 0,
  cuotasPagadasATiempo: 0,
  cuotasPagadasCompletas: 0,
  diasAtrasoPromedio: 0,
  cuotasAtrasadasHoy: 0,
  scoreNumerico: 0,
  scoreLetra: null,
  sobreescrito: false,
} as const;

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Score de comportamiento de pago (A/B/C). Usa el mismo cálculo de préstamos que el resto de la app
 * (con sus congelamientos) y no modifica ningún monto: solo resume cómo viene pagando el cliente.
 *
 *   Puntualidad   50 pts · cuotas vencidas cubiertas completas dentro de su mes
 *   Al día hoy    25 pts · se restan 8 por cada cuota atrasada actual
 *   Liquidados    15 pts · préstamos ya pagados por completo
 *   Días atraso   10 pts · días promedio de atraso de lo que sigue sin cubrir (0 días = 10, 60+ = 0)
 *
 * A: 70 o más · B: 40 a 69 · C: menos de 40. Sin cuotas vencidas todavía: sin score.
 */
export function calcularScoreCliente(
  prestamos: Prestamo[],
  amortizaciones: Amortizacion[],
  ajustes: AjustePrestamo[] = [],
  hoy: Date = new Date()
): ScoreData {
  if (!prestamos || prestamos.length === 0) return { ...SIN_HISTORIAL, prestamosLiquidados: 0, prestamosTotales: 0 };

  const hoyIso = isoLocal(hoy);
  let cuotasTotales = 0;
  let aTiempo = 0;
  let prestamosLiquidados = 0;
  let cuotasAtrasadasHoy = 0;
  const diasAtraso: number[] = [];

  for (const prestamo of prestamos) {
    const pagos = amortizaciones.filter((a) => a.prestamo_id === prestamo.id);
    const ajustesDelPrestamo = ajustes.filter((a) => a.prestamo_id === prestamo.id && a.activo);
    const deuda = buildPaymentSchedule(prestamo, pagos, { ajustes: ajustesDelPrestamo, referenceDate: hoy });
    const prox = proximoCobroPrestamo(deuda, prestamo.fecha_emision, hoyIso);

    if (prox.liquidado || ["pagado", "liquidado"].includes(String(prestamo.estado))) prestamosLiquidados++;
    if (prox.atrasado) cuotasAtrasadasHoy += prox.cuotasAtrasadas;

    for (const cuota of deuda.cuotas) {
      // Solo cuotas ya vencidas con algo que pagar (las congeladas y las de 0 % no suman ni restan)
      if (cuota.fechaVencimiento >= hoyIso || cuota.montoCuotaBase <= 0.009) continue;
      cuotasTotales++;
      if (cuota.estado === "Saldada") aTiempo++;
      else if (cuota.saldoPendiente > 0.009) diasAtraso.push(cuota.diasVencidos);
    }
  }

  if (cuotasTotales === 0) return { ...SIN_HISTORIAL, prestamosLiquidados, prestamosTotales: prestamos.length };

  const diasAtrasoPromedio = diasAtraso.length ? round2(diasAtraso.reduce((s, d) => s + d, 0) / diasAtraso.length) : 0;
  const puntualidad = aTiempo / cuotasTotales;
  const liquidacion = prestamosLiquidados / prestamos.length;
  const alDia = Math.max(0, 25 - 8 * cuotasAtrasadasHoy);
  const porDias = Math.max(0, 1 - diasAtrasoPromedio / 60) * 10;

  const scoreNumerico = round2(puntualidad * 50 + alDia + liquidacion * 15 + porDias);
  const scoreLetra: "A" | "B" | "C" = scoreNumerico >= 70 ? "A" : scoreNumerico >= 40 ? "B" : "C";

  return {
    cuotasTotales,
    cuotasPagadasATiempo: aTiempo,
    cuotasPagadasCompletas: aTiempo,
    prestamosLiquidados,
    prestamosTotales: prestamos.length,
    diasAtrasoPromedio,
    cuotasAtrasadasHoy,
    scoreNumerico,
    scoreLetra,
    sobreescrito: false,
  };
}
