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
  esEstancado?: boolean;
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

  const esLiquidado = res.capitalPendiente <= 0.01 && res.moraAcumulada <= 0.01;

  // (independientemente de si luego se realizó un abono posterior)
  // Esto captura el caso de: pagar el período 2 saltando el 1 → el 1 sigue contando como vencida
  const cuotasVencidasTotal = res.cuotasVencidas ?? 0;
  const esEstancado = prestamo.estado === "estancado" || cuotasVencidasTotal >= 3;

  let estadoCuotaMes: EstadoCuotaMes = "pendiente_mes";
  if (esLiquidado) {
    estadoCuotaMes = "al_dia";
  } else if (esEstancado || cuotasVencidasTotal > 1) {
    estadoCuotaMes = "mora_acumulada";
  } else if (cuotasVencidasTotal === 1) {
    estadoCuotaMes = "mora_mes";
  }

  const nextQuota = debtState.cuotaSiguiente;

  // montoTotalAtrasado = mora acumulada + suma de cuotas mínimas no cubiertas en períodos vencidos
  const cuotasVencidasDetalle = debtState.cuotasVencidasDetalle ?? [];
  const montoVencidoTotal = round2(
    cuotasVencidasDetalle.reduce((sum, c) => sum + (c.saldoPendiente ?? 0), 0) + res.moraAcumulada
  );

  return {
    prestamoId: prestamo.id,
    clienteNombre: (prestamo as any).cliente_nombre || "",
    estadoCuotaMes,
    cuotasAtrasadas: cuotasVencidasTotal,
    montoCuotaActual: nextQuota ? nextQuota.montoCuotaBase : 0,
    fechaCuotaActual: nextQuota ? nextQuota.fechaVencimiento : "",
    diasAtraso: nextQuota ? nextQuota.diasVencidos : 0,
    diasRestantes: 0,
    montoTotalAtrasado: montoVencidoTotal,
    saldoPendiente: res.saldoPendiente,
    moraAcumulada: res.moraAcumulada,
    ultimoPagoFecha: ultimoPago?.fecha_pago,
    ultimoPagoMonto: ultimoPago ? Number(ultimoPago.monto) : undefined,
    esEstancado
  };
}
