import { normalizeDate, round2, toNumber, addMonthsClamped, formatIsoDate } from "./loanLogic.js";

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
  prestamo: any,
  amortizaciones: any[],
  hoy: Date = new Date()
): EstadoMoraCliente {
  const pagosDelPrestamo = amortizaciones.filter(a => a.prestamo_id === prestamo.id);
  const pagosSorted = [...pagosDelPrestamo].sort((a, b) => new Date(a.fecha_pago).getTime() - new Date(b.fecha_pago).getTime());
  const ultimoPago = pagosSorted[pagosSorted.length - 1] || null;

  const totalPagado = round2(pagosDelPrestamo.reduce((sum, p) => sum + toNumber(p.monto), 0));
  const montoCapital = toNumber(prestamo.monto_capital);
  const tasaMensual = toNumber(prestamo.tasa_interes_porcentaje) / 100;
  const cuotaBase = tasaMensual > 0 ? round2(montoCapital * tasaMensual) : montoCapital;

  const todayStart = normalizeDate(hoy);
  const emisionDate = normalizeDate(prestamo.fecha_emision);

  // Si el préstamo ya está pagado o saldado
  const saldoPendienteTotal = round2(Math.max(0, (montoCapital + (tasaMensual > 0 ? (cuotaBase * 12) : 0)) - totalPagado));
  if (prestamo.estado === "pagado" || saldoPendienteTotal <= 0.01) {
    return {
      prestamoId: prestamo.id,
      clienteNombre: prestamo.cliente_nombre || "",
      estadoCuotaMes: "al_dia",
      cuotasAtrasadas: 0,
      montoCuotaActual: 0,
      fechaCuotaActual: "",
      diasAtraso: 0,
      diasRestantes: 0,
      montoTotalAtrasado: 0,
      saldoPendiente: 0,
      moraAcumulada: 0,
      ultimoPagoFecha: ultimoPago?.fecha_pago,
      ultimoPagoMonto: ultimoPago ? Number(ultimoPago.monto) : undefined
    };
  }

  // Generar los períodos mensuales acumulados desde emisión hasta hoy
  let saldoPagosDisponibles = totalPagado;
  let periodDate = addMonthsClamped(emisionDate, 1);
  let cuotasAtrasadas = 0;
  let primerFechaVencimientoUnpaid: Date | null = null;
  let primerMontoUnpaid = cuotaBase;
  let totalMontoAtrasado = 0;
  let i = 1;

  while (periodDate <= todayStart || i === 1) {
    const cubierto = round2(Math.min(cuotaBase, saldoPagosDisponibles));
    saldoPagosDisponibles = round2(Math.max(0, saldoPagosDisponibles - cubierto));

    if (cubierto < (cuotaBase - 0.01)) {
      // Período no cubierto completamente
      if (!primerFechaVencimientoUnpaid) {
        primerFechaVencimientoUnpaid = periodDate;
        primerMontoUnpaid = round2(cuotaBase - cubierto);
      }

      if (periodDate < todayStart) {
        cuotasAtrasadas++;
        totalMontoAtrasado = round2(totalMontoAtrasado + (cuotaBase - cubierto));
      }
    }

    periodDate = addMonthsClamped(emisionDate, i + 1);
    i++;
    if (i > 120) break; // Límite de seguridad
  }

  // Si no se encontró ningún período pendiente del pasado, evaluar la siguiente cuota futura
  const fechaCuotaVenc = primerFechaVencimientoUnpaid || periodDate;
  const fechaCuotaStr = formatIsoDate(fechaCuotaVenc);

  let estadoCuotaMes: EstadoCuotaMes = "pendiente_mes";
  let diasAtraso = 0;
  let diasRestantes = 0;

  if (fechaCuotaVenc < todayStart && cuotasAtrasadas > 0) {
    diasAtraso = Math.floor((todayStart.getTime() - fechaCuotaVenc.getTime()) / (24 * 60 * 60 * 1000));
    estadoCuotaMes = cuotasAtrasadas > 1 ? "mora_acumulada" : "mora_mes";
  } else {
    estadoCuotaMes = "pendiente_mes";
    diasAtraso = 0;
    diasRestantes = Math.max(0, Math.ceil((fechaCuotaVenc.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000)));
    cuotasAtrasadas = 0;
  }

  return {
    prestamoId: prestamo.id,
    clienteNombre: prestamo.cliente_nombre || "",
    estadoCuotaMes,
    cuotasAtrasadas,
    montoCuotaActual: cuotaBase,
    fechaCuotaActual: fechaCuotaStr,
    diasAtraso,
    diasRestantes,
    montoTotalAtrasado: totalMontoAtrasado,
    saldoPendiente: round2(Math.max(0, montoCapital - totalPagado)),
    moraAcumulada: 0,
    ultimoPagoFecha: ultimoPago?.fecha_pago,
    ultimoPagoMonto: ultimoPago ? Number(ultimoPago.monto) : undefined
  };
}
