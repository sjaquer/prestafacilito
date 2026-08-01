import { buildPaymentSchedule } from "./loanLogic";

export type EstadoCuotaMes = "al_dia" | "pendiente_mes" | "mora_mes" | "mora_acumulada" | "sin_cuotas";

export interface EstadoMoraCliente {
  prestamoId: string;
  clienteNombre: string;
  estadoCuotaMes: EstadoCuotaMes;
  cuotasAtrasadas: number;
  montoCuotaActual: number;
  fechaCuotaActual: string;
  diasAtraso: number;
  montoTotalAtrasado: number;
  saldoPendiente: number;
  moraAcumulada: number;
  ultimoPagoFecha?: string;
  ultimoPagoMonto?: number;
}

export function calcularEstadoMora(
  prestamo: any,
  amortizaciones: any[],
  hoy: Date = new Date()
): EstadoMoraCliente {
  const pagosDelPrestamo = amortizaciones.filter(a => a.prestamo_id === prestamo.id);
  const ajustes = prestamo.ajustes || [];
  
  const schedule = buildPaymentSchedule(prestamo, pagosDelPrestamo, { ajustes, referenceDate: hoy });
  const cuotas = schedule.cuotas;

  const pagosSorted = [...pagosDelPrestamo].sort((a, b) => new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime());
  const ultimoPago = pagosSorted[pagosSorted.length - 1] || null;

  const todayStart = new Date(hoy);
  todayStart.setHours(0, 0, 0, 0);

  if (prestamo.estado === "pagado" || schedule.resumen.saldoPendiente <= 0.01) {
    return {
      prestamoId: prestamo.id,
      clienteNombre: prestamo.cliente_nombre || "",
      estadoCuotaMes: "al_dia",
      cuotasAtrasadas: 0,
      montoCuotaActual: 0,
      fechaCuotaActual: "",
      diasAtraso: 0,
      montoTotalAtrasado: 0,
      saldoPendiente: 0,
      moraAcumulada: 0,
      ultimoPagoFecha: ultimoPago?.fecha_pago,
      ultimoPagoMonto: ultimoPago ? Number(ultimoPago.monto) : undefined
    };
  }

  // Extraer el día de vencimiento habitual (e.g. 5)
  const baseDateStr = prestamo.fecha_vencimiento || prestamo.fecha_emision;
  const dayOfLoan = baseDateStr ? parseInt(baseDateStr.split("-")[2] || "5", 10) : 5;

  let refYear = todayStart.getFullYear();
  let refMonth = todayStart.getMonth();

  // Si hubo un pago en el mes anterior o más reciente, el periodo actual vence en refYear/refMonth en el día dayOfLoan
  if (ultimoPago) {
    const dUltimo = new Date(ultimoPago.fecha_pago + "T00:00:00");
    // Si el último pago fue en el mes actual o mes anterior, la cuota vigente es la de este mes
    const ultYear = dUltimo.getFullYear();
    const ultMonth = dUltimo.getMonth();

    if (ultYear === refYear && ultMonth === refMonth) {
      // Ya pagó el mes actual -> la siguiente cuota vence el próximo mes
      refMonth = refMonth + 1;
      if (refMonth > 11) {
        refMonth = 0;
        refYear = refYear + 1;
      }
    }
  }

  const lastDayOfMonth = new Date(refYear, refMonth + 1, 0).getDate();
  const targetDay = Math.min(Math.max(1, dayOfLoan), lastDayOfMonth);
  const fechaCuotaVenc = new Date(refYear, refMonth, targetDay);
  const fechaCuotaStr = fechaCuotaVenc.toISOString().split("T")[0];

  const cuotaMesMonto = cuotas[0] ? cuotas[0].montoCuotaBase : ((Number(prestamo.monto_capital) || 0) * ((Number(prestamo.tasa_interes_porcentaje) || 0) / 100));

  let estadoCuotaMes: EstadoCuotaMes = "pendiente_mes";
  let diasAtraso = 0;
  let cuotasAtrasadas = 0;

  if (todayStart > fechaCuotaVenc) {
    diasAtraso = Math.floor((todayStart.getTime() - fechaCuotaVenc.getTime()) / (24 * 60 * 60 * 1000));
    cuotasAtrasadas = Math.max(1, Math.ceil(diasAtraso / 30));
    estadoCuotaMes = cuotasAtrasadas > 1 ? "mora_acumulada" : "mora_mes";
  } else {
    estadoCuotaMes = "pendiente_mes";
    diasAtraso = 0;
    cuotasAtrasadas = 0;
  }

  return {
    prestamoId: prestamo.id,
    clienteNombre: prestamo.cliente_nombre || "",
    estadoCuotaMes,
    cuotasAtrasadas,
    montoCuotaActual: cuotaMesMonto,
    fechaCuotaActual: fechaCuotaStr,
    diasAtraso,
    montoTotalAtrasado: cuotasAtrasadas > 0 ? schedule.resumen.saldoPendiente : 0,
    saldoPendiente: schedule.resumen.saldoPendiente || 0,
    moraAcumulada: 0,
    ultimoPagoFecha: ultimoPago?.fecha_pago,
    ultimoPagoMonto: ultimoPago ? Number(ultimoPago.monto) : undefined
  };
}
