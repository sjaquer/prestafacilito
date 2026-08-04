import { buildPaymentSchedule, round2, toNumber } from "./loanLogic.js";
import { Prestamo, Amortizacion } from "../types.js";

export type EstadoCuotaMes = "al_dia" | "pendiente_mes" | "mora_mes" | "mora_acumulada" | "sin_cuotas";

export interface EstadoMoraCliente {
  prestamoId: string;
  clienteNombre: string;
  estadoCuotaMes: EstadoCuotaMes;
  cuotasAtrasadas: number;
  montoCuotaActual: number;
  fechaCuotaActual: string;
  diasAtraso: number;
  diasRestantes: number;
  montoTotalAtrasado: number;
  saldoPendiente: number;
  moraAcumulada: number;
  ultimoPagoFecha?: string;
  ultimoPagoMonto?: number;
}

export function calcularEstadoMora(
  prestamo: Prestamo,
  amortizaciones: Amortizacion[],
  hoy: Date = new Date()
): EstadoMoraCliente {
  const pagosDelPrestamo = amortizaciones.filter((a) => a.prestamo_id === prestamo.id);
  const pagosSorted = [...pagosDelPrestamo].sort(
    (a, b) => new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime()
  );
  const ultimoPago = pagosSorted[pagosSorted.length - 1] || null;

  const debtState = buildPaymentSchedule(prestamo, pagosDelPrestamo, { referenceDate: hoy });
  const res = debtState.resumen;

  const esLiquidado = res.saldoPendiente <= 0.01 || prestamo.estado === "liquidado" || prestamo.estado === "pagado";
  const esEstancado = prestamo.estado === "estancado" || (res.mesesSinPago ?? 0) > 2;

  let estadoCuotaMes: EstadoCuotaMes = "pendiente_mes";
  if (esLiquidado) {
    estadoCuotaMes = "al_dia";
  } else if (esEstancado || (res.mesesSinPago ?? 0) > 1) {
    estadoCuotaMes = "mora_acumulada";
  } else if ((res.mesesSinPago ?? 0) === 1) {
    estadoCuotaMes = "mora_mes";
  }

  const nextQuota = debtState.cuotaSiguiente;

  return {
    prestamoId: prestamo.id,
    clienteNombre: (prestamo as any).cliente_nombre || "",
    estadoCuotaMes,
    cuotasAtrasadas: res.mesesSinPago ?? 0,
    montoCuotaActual: nextQuota ? nextQuota.montoCuotaBase : 0,
    fechaCuotaActual: nextQuota ? nextQuota.fechaVencimiento : "",
    diasAtraso: nextQuota ? nextQuota.diasVencidos : 0,
    diasRestantes: 0,
    montoTotalAtrasado: res.moraAcumulada,
    saldoPendiente: res.saldoPendiente,
    moraAcumulada: res.moraAcumulada,
    ultimoPagoFecha: ultimoPago?.fecha_pago,
    ultimoPagoMonto: ultimoPago ? Number(ultimoPago.monto) : undefined,
  };
}
