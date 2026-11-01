import { round2 } from "./loanLogic.js";

/**
 * Guía de pagos para el cliente al crear un préstamo. Solo informativa: no se guarda ni limita los pagos
 * (el préstamo sigue siendo libre: el mínimo de cada mes es el interés).
 *
 * Simula con las mismas reglas del cálculo de préstamos: cada mes se cobra el interés sobre el capital
 * que queda; lo que se paga primero cubre ese interés y el resto baja el capital.
 */

export interface MesPlan {
  numero: number;
  pago: number;
  interes: number;
  aCapital: number;
  capitalRestante: number;
}

export interface PlanPagos {
  meses: MesPlan[];
  totalPagado: number;
  totalInteres: number;
  /** true si el pago no alcanza ni para el interés: el capital nunca baja. */
  noTermina: boolean;
}

const MAX_MESES = 120;

function simular(capital: number, tasaPct: number, pagoDelMes: (n: number, capital: number, interes: number) => number): PlanPagos {
  const tasa = tasaPct / 100;
  const meses: MesPlan[] = [];
  let restante = round2(capital);
  for (let n = 1; restante > 0.009 && n <= MAX_MESES; n++) {
    const interes = round2(restante * tasa);
    const pago = round2(Math.min(pagoDelMes(n, restante, interes), restante + interes));
    if (pago <= interes + 0.009 && n > 1) {
      return { meses, totalPagado: round2(meses.reduce((s, m) => s + m.pago, 0)), totalInteres: round2(meses.reduce((s, m) => s + m.interes, 0)), noTermina: true };
    }
    const aCapital = round2(Math.max(0, pago - interes));
    restante = round2(restante - aCapital);
    meses.push({ numero: n, pago, interes, aCapital, capitalRestante: restante });
    if (pago <= interes + 0.009) break;
  }
  return {
    meses,
    totalPagado: round2(meses.reduce((s, m) => s + m.pago, 0)),
    totalInteres: round2(meses.reduce((s, m) => s + m.interes, 0)),
    noTermina: restante > 0.009,
  };
}

/** Cuota fija para terminar en `n` meses (la última se ajusta por redondeo). */
export function planCuotaFija(capital: number, tasaPct: number, n: number): PlanPagos | null {
  if (!(capital > 0) || !(n >= 1)) return null;
  const i = tasaPct / 100;
  const cuota = i > 0 ? round2((capital * i) / (1 - Math.pow(1 + i, -n))) : round2(capital / n);
  // En la última cuota se paga exactamente lo que queda (absorbe el redondeo)
  return simular(capital, tasaPct, (mes, restante, interes) => (mes >= n ? restante + interes : cuota));
}

/** Si paga `monto` cada mes: en cuántos meses termina y cuánto interés paga. */
export function planPagoFijo(capital: number, tasaPct: number, monto: number): PlanPagos | null {
  if (!(capital > 0) || !(monto > 0)) return null;
  return simular(capital, tasaPct, () => monto);
}
