import { proximoCobroPrestamo } from "../../lib/proximoCobro";
import { hoyISO } from "../../lib/fechas";
import { buildPaymentSchedule } from "../../lib/loanLogic";

export interface ClienteMoraResumen {
  tieneMora: boolean;
  totalCuotasAtrasadas: number;
  totalMontoAtrasado: number;
  proximaCuotaFecha: string;
  proximaCuotaMonto: number;
  proximaCuotaTipo: string;
}

/** Resume lo atrasado y el próximo cobro del cliente (misma regla que Inicio). */
export const resumirMoraCliente = (clientLoans: any[], amortizaciones: any[]): ClienteMoraResumen => {
  const hoy = hoyISO();
  const estados = clientLoans
    .filter((l) => l.estado !== "pagado" && l.estado !== "liquidado")
    .map((l) => {
      const pagos = amortizaciones.filter((a) => a.prestamo_id === l.id);
      const deuda = buildPaymentSchedule(l, pagos, { ajustes: l.ajustes || [], referenceDate: new Date(`${hoy}T12:00:00`) });
      return { deuda, prox: proximoCobroPrestamo(deuda, l.fecha_emision, hoy), tipo: l.tipo_prestamo };
    })
    .filter((e) => !e.prox.liquidado);

  const atrasados = estados.filter((e) => e.prox.atrasado);
  const proxima = estados
    .filter((e) => !e.prox.atrasado && e.prox.fecha)
    .sort((a, b) => String(a.prox.fecha).localeCompare(String(b.prox.fecha)))[0];

  return {
    tieneMora: atrasados.length > 0,
    totalCuotasAtrasadas: atrasados.reduce((sum, e) => sum + e.prox.cuotasAtrasadas, 0),
    totalMontoAtrasado: atrasados.reduce((sum, e) => sum + e.prox.moraVencida, 0),
    proximaCuotaFecha: atrasados.length ? "" : proxima?.prox.fecha || "",
    proximaCuotaMonto: proxima?.prox.cuota?.saldoPendiente || 0,
    proximaCuotaTipo: proxima?.tipo || "",
  };
};

export interface DistribucionFinanciera {
  capitalTotal: number;
  capitalAmortizado: number;
  capitalPct: number;
  interesTotal: number;
  interesPagado: number;
  interesPct: number;
  moraTotal: number;
  moraPagado: number;
  moraPct: number;
}

/** Distribución agregada de capital, interés y mora cobrados del cliente (excluye alquileres). */
export const calcularDistribucionFinanciera = (
  clientLoans: any[],
  amortizaciones: any[]
): DistribucionFinanciera | null => {
  if (clientLoans.length === 0) return null;

  let capitalTotal = 0;
  let capitalAmortizado = 0;
  let interesTotal = 0;
  let interesPagado = 0;
  let moraTotal = 0;
  let moraPagado = 0;

  clientLoans.forEach((loan) => {
    if (loan.tipo_prestamo === "Alquiler de Casa") return;

    const pagosDelPrestamo = amortizaciones.filter((a) => a.prestamo_id === loan.id);
    const computed = buildPaymentSchedule(loan, pagosDelPrestamo, { ajustes: [], referenceDate: new Date() });

    const capTotal = Number(loan.monto_capital) || 0;
    const capPendiente = Number(computed.resumen?.capitalPendiente) || 0;

    const intPagado = computed.cuotas?.reduce((sum: number, c: any) => sum + (c.interesPagado || 0), 0) || 0;
    const intPendiente = Number(computed.resumen?.interesPendiente) || 0;

    const morPagado = computed.cuotas?.reduce((sum: number, c: any) => sum + (c.moraPagado || 0), 0) || 0;
    const morPendiente = Number(computed.resumen?.moraAcumulada) || 0;

    capitalTotal += capTotal;
    capitalAmortizado += Math.max(0, capTotal - capPendiente);
    interesTotal += intPagado + intPendiente;
    interesPagado += intPagado;
    moraTotal += morPagado + morPendiente;
    moraPagado += morPagado;
  });

  const pct = (part: number, total: number) => Math.min(100, total > 0 ? (part / total) * 100 : 0);

  return {
    capitalTotal,
    capitalAmortizado,
    capitalPct: pct(capitalAmortizado, capitalTotal),
    interesTotal,
    interesPagado,
    interesPct: pct(interesPagado, interesTotal),
    moraTotal,
    moraPagado,
    moraPct: pct(moraPagado, moraTotal),
  };
};
