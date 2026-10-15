import { calcularEstadoMora } from "../../lib/moraLogic";
import { buildPaymentSchedule } from "../../lib/loanLogic";

export interface ClienteMoraResumen {
  tieneMora: boolean;
  totalCuotasAtrasadas: number;
  totalMontoAtrasado: number;
  proximaCuotaFecha: string;
  proximaCuotaMonto: number;
  proximaCuotaTipo: string;
}

/** Resume la situación de mora del cliente a partir de sus préstamos activos. */
export const resumirMoraCliente = (clientLoans: any[], amortizaciones: any[]): ClienteMoraResumen => {
  const estados = clientLoans
    .filter((l) => l.estado === "activo")
    .map((l) => ({ ...calcularEstadoMora(l, amortizaciones, new Date()), tipo_prestamo: l.tipo_prestamo }));

  const cuotasEnMora = estados.filter((e) => ["mora_mes", "mora_acumulada"].includes(e.estadoCuotaMes));
  const tieneMora = cuotasEnMora.length > 0;

  let proximaCuotaFecha = "";
  let proximaCuotaMonto = 0;
  let proximaCuotaTipo = "";

  if (!tieneMora) {
    const [proxima] = estados
      .filter((e) => e.estadoCuotaMes === "pendiente_mes")
      .sort((a, b) => new Date(a.fechaCuotaActual).getTime() - new Date(b.fechaCuotaActual).getTime());
    if (proxima) {
      proximaCuotaFecha = proxima.fechaCuotaActual;
      proximaCuotaMonto = proxima.montoCuotaActual;
      proximaCuotaTipo = proxima.tipo_prestamo;
    }
  }

  return {
    tieneMora,
    totalCuotasAtrasadas: cuotasEnMora.reduce((sum, e) => sum + e.cuotasAtrasadas, 0),
    totalMontoAtrasado: cuotasEnMora.reduce((sum, e) => sum + e.moraAcumulada, 0),
    proximaCuotaFecha,
    proximaCuotaMonto,
    proximaCuotaTipo,
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
