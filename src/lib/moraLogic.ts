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
  amortizaciones: any[], // tabla completa de amortizaciones (pagos)
  hoy: Date = new Date()
): EstadoMoraCliente {
  // Filtrar amortizaciones de este préstamo
  const pagosDelPrestamo = amortizaciones.filter(a => a.prestamo_id === prestamo.id);
  const ajustes = prestamo.ajustes || [];
  
  // Calcular el cronograma de cuotas usando la lógica de negocio oficial del sistema
  const schedule = buildPaymentSchedule(prestamo, pagosDelPrestamo, ajustes, hoy);
  const cuotas = schedule.cuotas;

  // Buscar último pago registrado
  const pagosSorted = [...pagosDelPrestamo].sort((a, b) => new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime());
  const ultimoPago = pagosSorted[pagosSorted.length - 1] || null;

  if (cuotas.length === 0) {
    return {
      prestamoId: prestamo.id,
      clienteNombre: prestamo.cliente_nombre || "",
      estadoCuotaMes: "sin_cuotas",
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

  const todayStart = new Date(hoy);
  todayStart.setHours(0, 0, 0, 0);

  // Cuotas vencidas y no pagadas (mora real)
  const cuotasEnMora = cuotas.filter(c => {
    const fechaCuota = new Date(c.fechaVencimiento + "T00:00:00");
    return fechaCuota < todayStart && c.estado !== "Saldada";
  });

  // Cuota del mes actual (próxima cuota pendiente no vencida)
  const cuotaActual = cuotas.find(c => {
    const fechaCuota = new Date(c.fechaVencimiento + "T00:00:00");
    return fechaCuota >= todayStart && c.estado !== "Saldada";
  });

  const diasAtraso = cuotasEnMora.length > 0
    ? Math.floor((todayStart.getTime() - new Date(cuotasEnMora[0].fechaVencimiento + "T00:00:00").getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  const montoTotalAtrasado = cuotasEnMora.reduce((sum, c) => sum + (c.saldoPendiente || 0), 0);

  let estadoCuotaMes: EstadoCuotaMes;
  if (cuotasEnMora.length > 1) estadoCuotaMes = "mora_acumulada";
  else if (cuotasEnMora.length === 1) estadoCuotaMes = "mora_mes";
  else if (!cuotaActual) estadoCuotaMes = "al_dia"; // todas pagadas
  else estadoCuotaMes = "pendiente_mes"; // cuota futura aún no vence

  return {
    prestamoId: prestamo.id,
    clienteNombre: prestamo.cliente_nombre || "",
    estadoCuotaMes,
    cuotasAtrasadas: cuotasEnMora.length,
    montoCuotaActual: cuotaActual ? cuotaActual.montoExigible || 0 : 0,
    fechaCuotaActual: cuotaActual?.fechaVencimiento || "",
    diasAtraso,
    montoTotalAtrasado,
    saldoPendiente: schedule.resumen.saldoPendiente || 0,
    moraAcumulada: schedule.resumen.moraAcumulada || 0,
    ultimoPagoFecha: ultimoPago?.fecha_pago,
    ultimoPagoMonto: ultimoPago ? Number(ultimoPago.monto) : undefined
  };
}
