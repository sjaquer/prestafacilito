import { Amortizacion, CuotaPrestamo, EstadoDeudaPrestamo, Prestamo } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INSTALLMENTS = 3;
const DEFAULT_LATE_INTEREST_RATE_DAILY = 0.001;
const EPSILON = 0.01;

export const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeDate = (dateValue: string | Date) => {
  if (dateValue instanceof Date) {
    return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
  }
  return new Date(`${dateValue}T00:00:00`);
};

export const formatIsoDate = (dateValue: Date) => dateValue.toISOString().split("T")[0];

export const addMonthsClamped = (dateValue: string | Date, months: number) => {
  const baseDate = normalizeDate(dateValue);

  if (Number.isNaN(baseDate.getTime())) {
    return new Date(NaN);
  }

  const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + months, 1);
  const desiredDay = baseDate.getDate();
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();

  target.setDate(Math.min(desiredDay, lastDay));
  return target;
};

const countMonthlyOccurrences = (startDate: Date, referenceDate: Date) => {
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(referenceDate.getTime())) {
    return 0;
  }

  let count = 0;
  let dueDate = new Date(startDate.getTime());

  while (dueDate.getTime() <= referenceDate.getTime()) {
    count += 1;
    dueDate = addMonthsClamped(dueDate, 1);

    if (count >= 120) {
      break;
    }
  }

  return count;
};

export const getInstallmentCount = (prestamo: Pick<Prestamo, "fecha_emision" | "fecha_vencimiento">) => {
  const emissionDate = normalizeDate(prestamo.fecha_emision);
  const dueDate = prestamo.fecha_vencimiento ? normalizeDate(prestamo.fecha_vencimiento) : null;

  if (!dueDate || Number.isNaN(dueDate.getTime())) {
    return DEFAULT_INSTALLMENTS;
  }

  const diffDays = Math.max(1, Math.round((dueDate.getTime() - emissionDate.getTime()) / DAY_MS));
  const monthsApprox = Math.round(diffDays / 30);
  return Math.max(1, Math.min(120, monthsApprox || DEFAULT_INSTALLMENTS));
};

export const buildPaymentSchedule = (
  prestamo: Prestamo,
  pagos: Amortizacion[] = [],
  referenceDate: Date = new Date(),
  lateInterestRateDaily = DEFAULT_LATE_INTEREST_RATE_DAILY
): EstadoDeudaPrestamo => {
  const capital = toNumber(prestamo.monto_capital);
  const tasaInteres = toNumber(prestamo.tasa_interes_porcentaje);

  const emissionDate = normalizeDate(prestamo.fecha_emision);
  const now = normalizeDate(referenceDate);
  const firstDueDate = prestamo.fecha_vencimiento && !Number.isNaN(normalizeDate(prestamo.fecha_vencimiento).getTime())
    ? normalizeDate(prestamo.fecha_vencimiento)
    : addMonthsClamped(emissionDate, 1);

  const monthlyInterest = capital * (tasaInteres / 100);
  const validPayments = pagos
    .map((pago) => ({
      ...pago,
      montoNormalizado: toNumber(pago.monto),
      fechaNormalizada: normalizeDate(pago.fecha_pago)
    }))
    .filter((pago) => pago.montoNormalizado > EPSILON && !Number.isNaN(pago.fechaNormalizada.getTime()) && pago.fechaNormalizada.getTime() <= now.getTime())
    .sort((a, b) => a.fechaNormalizada.getTime() - b.fechaNormalizada.getTime());

  const totalPagado = validPayments.reduce((sum, pago) => sum + pago.montoNormalizado, 0);
  let remainingToAllocate = totalPagado;

  const totalCuotasProgramadas = Math.max(1, countMonthlyOccurrences(firstDueDate, now));

  const cuotas: CuotaPrestamo[] = Array.from({ length: totalCuotasProgramadas }).map((_, index) => {
    const numero = index + 1;
    const duePoint = addMonthsClamped(firstDueDate, index);
    const fechaVencimiento = formatIsoDate(duePoint);
    const cuotaVencida = duePoint.getTime() <= now.getTime();
    const pagoAplicado = cuotaVencida ? Math.min(monthlyInterest, remainingToAllocate) : 0;
    remainingToAllocate = Math.max(0, remainingToAllocate - pagoAplicado);

    const interesPendiente = Math.max(0, monthlyInterest - pagoAplicado);
    const saldoPendienteBase = interesPendiente;
    const diasVencidos = Math.max(0, Math.ceil((now.getTime() - normalizeDate(fechaVencimiento).getTime()) / DAY_MS));
    const moraPendiente = saldoPendienteBase > 0 && diasVencidos > 0
      ? saldoPendienteBase * lateInterestRateDaily * diasVencidos
      : 0;

    const penalidad = 0;
    const cargosAdicionales = 0;
    const montoExigible = saldoPendienteBase + moraPendiente + penalidad + cargosAdicionales;

    let estado: CuotaPrestamo["estado"] = cuotaVencida ? "Vencida" : "Pendiente";
    if (pagoAplicado >= monthlyInterest - EPSILON) {
      estado = "Saldada";
    } else if (pagoAplicado > EPSILON) {
      estado = cuotaVencida ? "Parcial" : "Pendiente";
    }

    return {
      numero,
      fechaVencimiento,
      capitalPendiente: 0,
      interesPendiente,
      moraPendiente,
      penalidad,
      cargosAdicionales,
      montoCuotaBase: monthlyInterest,
      montoExigible,
      pagado: pagoAplicado,
      saldoPendiente: saldoPendienteBase,
      diasVencidos,
      estado
    };
  });

  const cuotasVencidasDetalle = cuotas.filter((cuota) => cuota.estado === "Vencida" || (cuota.estado === "Parcial" && cuota.diasVencidos > 0));
  const cuotaSiguiente = cuotas.find((cuota) => cuota.estado !== "Saldada") || null;

  const capitalPendiente = Math.max(0, capital - Math.max(0, remainingToAllocate));
  const interesPendiente = cuotas.reduce((sum, cuota) => sum + cuota.interesPendiente, 0);
  const moraAcumulada = cuotas.reduce((sum, cuota) => sum + cuota.moraPendiente, 0);
  const penalidadesAcumuladas = cuotas.reduce((sum, cuota) => sum + cuota.penalidad, 0);
  const cargosAdicionalesAcumulados = cuotas.reduce((sum, cuota) => sum + cuota.cargosAdicionales, 0);
  const saldoPendiente = capitalPendiente + interesPendiente + moraAcumulada + penalidadesAcumuladas + cargosAdicionalesAcumulados;
  const cuotasPendientes = cuotas.filter((cuota) => cuota.estado !== "Saldada").length;
  const cuotasVencidas = cuotas.filter((cuota) => cuota.estado === "Vencida").length;

  return {
    resumen: {
      totalCuotas: totalCuotasProgramadas,
      cuotasPendientes,
      cuotasVencidas,
      capitalPendiente,
      interesPendiente,
      moraAcumulada,
      penalidadesAcumuladas,
      cargosAdicionalesAcumulados,
      totalExigible: saldoPendiente,
      totalPagado,
      saldoPendiente
    },
    cuotas,
    cuotaSiguiente,
    cuotasVencidasDetalle
  };
};

export const classifyPayment = (
  paymentAmount: number,
  debtState: EstadoDeudaPrestamo
) => {
  const nextQuota = debtState.cuotaSiguiente;
  const totalDebt = debtState.resumen.totalExigible;
  const amount = toNumber(paymentAmount);

  if (amount >= totalDebt - EPSILON) {
    return "Liquidación total";
  }

  if (nextQuota) {
    const expected = nextQuota.montoExigible;
    if (Math.abs(amount - expected) <= EPSILON) {
      return "Pago exacto de cuota";
    }
    if (amount < expected) {
      return "Amortización parcial";
    }
    if (amount > expected && amount < totalDebt) {
      return "Pago adelantado / múltiple";
    }
  }

  return amount > 0 ? "Amortización parcial" : "Pago inválido";
};
