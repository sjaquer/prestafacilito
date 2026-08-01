import { Amortizacion, CuotaPrestamo, EstadoDeudaPrestamo, Prestamo, AjustePrestamo } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INSTALLMENTS = 3;
const EPSILON = 0.01;

export const round2 = (n: number): number => {
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

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

export interface BuildScheduleOptions {
  ajustes?: AjustePrestamo[];
  referenceDate?: Date;
}

export const buildPaymentSchedule = (
  prestamo: Prestamo,
  pagos: Amortizacion[] = [],
  options: BuildScheduleOptions = {}
): EstadoDeudaPrestamo => {
  const ajustes: AjustePrestamo[] = (options.ajustes || []).filter(a => a.activo);
  const referenceDate: Date = options.referenceDate || new Date();

  const capital = toNumber(prestamo.monto_capital);
  const tasaMensual = toNumber(prestamo.tasa_interes_porcentaje) / 100;
  const emisionDate = normalizeDate(prestamo.fecha_emision);
  const now = normalizeDate(referenceDate);
  const totalCuotas = getInstallmentCount(prestamo);

  // Amortización de capital constante por cuota (método francés adaptativo)
  const amortizacionCapitalPorCuota = round2(capital / totalCuotas);

  // Generar el cronograma teórico de cuotas
  const cuotas: CuotaPrestamo[] = [];
  let capitalRestante = capital;
  let tieneAjustesActivos = false;
  let interesCongelado = false;
  let fechaCongelamientoHasta: string | null = null;
  let totalBeneficioAplicado = 0;

  for (let i = 0; i < totalCuotas; i++) {
    const fechaVencimiento = addMonthsClamped(emisionDate, i + 1);
    const interesMes = round2(capitalRestante * tasaMensual);

    // Verificar si hay ajuste de congelamiento de interés para esta cuota
    const congelarTemp = ajustes.find(
      (a) => a.tipo === "congelar_interes_temporal" &&
             normalizeDate(a.fecha_inicio).getTime() <= fechaVencimiento.getTime() &&
             (!a.fecha_fin || normalizeDate(a.fecha_fin).getTime() >= fechaVencimiento.getTime())
    );

    const isCongelada = !!congelarTemp;
    const interesEfectivo = isCongelada ? 0 : interesMes;

    if (isCongelada && congelarTemp) {
      tieneAjustesActivos = true;
      interesCongelado = true;
      totalBeneficioAplicado = round2(totalBeneficioAplicado + interesMes);
      if (!fechaCongelamientoHasta || (congelarTemp.fecha_fin && new Date(congelarTemp.fecha_fin).getTime() > new Date(fechaCongelamientoHasta).getTime())) {
        fechaCongelamientoHasta = congelarTemp.fecha_fin || "indefinido";
      }
    }

    const cuotaMes = round2(amortizacionCapitalPorCuota + interesEfectivo);

    cuotas.push({
      numero: i + 1,
      fechaVencimiento: formatIsoDate(fechaVencimiento),
      capitalPendiente: capitalRestante,
      interesPendiente: interesEfectivo,
      montoCuotaBase: cuotaMes,
      montoExigible: cuotaMes,
      capitalAmortizado: amortizacionCapitalPorCuota,
      pagado: 0,
      saldoPendiente: cuotaMes,
      estado: fechaVencimiento.getTime() <= now.getTime() ? "Vencida" : "Pendiente",
      diasVencidos: Math.max(0, Math.ceil((now.getTime() - fechaVencimiento.getTime()) / DAY_MS)),
      moraPendiente: 0,
      penalidad: 0,
      cargosAdicionales: 0,
      interesOriginal: interesMes,
      congelada: isCongelada,
      ajustesAplicados: isCongelada && congelarTemp ? [congelarTemp.id] : []
    });

    capitalRestante = round2(capitalRestante - amortizacionCapitalPorCuota);
  }

  // Aplicar pagos reales en orden cronológico
  const pagosOrdenados = [...pagos]
    .map(p => ({ ...p, montoVal: toNumber(p.monto), dateVal: normalizeDate(p.fecha_pago) }))
    .filter(p => p.montoVal > EPSILON && !Number.isNaN(p.dateVal.getTime()))
    .sort((a, b) => a.dateVal.getTime() - b.dateVal.getTime());

  let totalPagado = 0;

  for (const pago of pagosOrdenados) {
    let remaining = pago.montoVal;
    totalPagado = round2(totalPagado + remaining);

    for (const cuota of cuotas) {
      if (remaining <= EPSILON) break;
      if (cuota.estado === "Saldada") continue;

      // 1. Pagar el interés pendiente de la cuota
      if (cuota.interesPendiente > EPSILON) {
        const pagoInteres = round2(Math.min(cuota.interesPendiente, remaining));
        cuota.interesPendiente = round2(cuota.interesPendiente - pagoInteres);
        cuota.interesPagado = round2((cuota.interesPagado || 0) + pagoInteres);
        remaining = round2(remaining - pagoInteres);
      }

      // 2. Pagar la amortización de capital de la cuota
      if (remaining > EPSILON && cuota.capitalAmortizado && cuota.capitalAmortizado > 0) {
        const capitalCuotaPendiente = round2((cuota.capitalAmortizado || 0) - (cuota.capitalAmortizadoPagado || 0));
        if (capitalCuotaPendiente > EPSILON) {
          const pagoCapital = round2(Math.min(capitalCuotaPendiente, remaining));
          cuota.capitalAmortizadoPagado = round2((cuota.capitalAmortizadoPagado || 0) + pagoCapital);
          remaining = round2(remaining - pagoCapital);
        }
      }

      // Actualizar totales de la cuota
      const interesPagado = (cuota.interesOriginal || 0) - cuota.interesPendiente;
      const capitalPagado = cuota.capitalAmortizadoPagado || 0;
      cuota.pagado = round2(interesPagado + capitalPagado);
      cuota.saldoPendiente = round2(cuota.interesPendiente + Math.max(0, (cuota.capitalAmortizado || 0) - capitalPagado));
      cuota.montoExigible = cuota.saldoPendiente;

      if (cuota.saldoPendiente <= EPSILON) {
        cuota.estado = "Saldada";
      } else if (cuota.pagado > EPSILON) {
        cuota.estado = "Parcial";
      }
    }

    // Excedente se aplica como adelanto a la siguiente cuota no saldada
    if (remaining > EPSILON) {
      const siguienteCuota = cuotas.find(c => c.estado !== "Saldada");
      if (siguienteCuota) {
        const aplicadoInteres = round2(Math.min(siguienteCuota.interesPendiente, remaining));
        siguienteCuota.interesPendiente = round2(siguienteCuota.interesPendiente - aplicadoInteres);
        siguienteCuota.interesPagado = round2((siguienteCuota.interesPagado || 0) + aplicadoInteres);
        remaining = round2(remaining - aplicadoInteres);
        siguienteCuota.pagado = round2(siguienteCuota.pagado + aplicadoInteres);

        if (remaining > EPSILON && siguienteCuota.capitalAmortizado) {
          const capitalCuotaPendiente = round2(siguienteCuota.capitalAmortizado - (siguienteCuota.capitalAmortizadoPagado || 0));
          const pagoCap = round2(Math.min(capitalCuotaPendiente, remaining));
          siguienteCuota.capitalAmortizadoPagado = round2((siguienteCuota.capitalAmortizadoPagado || 0) + pagoCap);
          siguienteCuota.pagado = round2(siguienteCuota.pagado + pagoCap);
          remaining = round2(remaining - pagoCap);
        }

        siguienteCuota.saldoPendiente = round2(siguienteCuota.interesPendiente + Math.max(0, (siguienteCuota.capitalAmortizado || 0) - (siguienteCuota.capitalAmortizadoPagado || 0)));
        siguienteCuota.montoExigible = siguienteCuota.saldoPendiente;
        if (siguienteCuota.saldoPendiente <= EPSILON) {
          siguienteCuota.estado = "Saldada";
        }
      }
    }
  }

  // Recalcular estados y días de atraso al momento actual
  for (const cuota of cuotas) {
    const duePoint = normalizeDate(cuota.fechaVencimiento);
    const diasVencidos = Math.max(0, Math.ceil((now.getTime() - duePoint.getTime()) / DAY_MS));
    cuota.diasVencidos = diasVencidos;

    if (cuota.estado === "Saldada") {
      cuota.saldoPendiente = 0;
      cuota.montoExigible = 0;
      continue;
    }

    if (cuota.pagado > EPSILON) {
      cuota.estado = "Parcial";
    } else {
      cuota.estado = duePoint.getTime() <= now.getTime() ? "Vencida" : "Pendiente";
    }
  }

  const cuotasVencidasDetalle = cuotas.filter(
    (c) => c.estado === "Vencida" || (c.estado === "Parcial" && c.diasVencidos > 0)
  );
  const cuotaSiguiente = cuotas.find((c) => c.estado !== "Saldada") || null;

  const capitalPendiente = round2(cuotas.reduce((sum, c) => sum + Math.max(0, (c.capitalAmortizado || 0) - (c.capitalAmortizadoPagado || 0)), 0));
  const interesPendiente = round2(cuotas.reduce((sum, c) => sum + c.interesPendiente, 0));
  const saldoPendiente = round2(capitalPendiente + interesPendiente);

  const cuotasPendientes = cuotas.filter((c) => c.estado !== "Saldada").length;
  const cuotasVencidas = cuotas.filter((c) => c.estado === "Vencida").length;

  return {
    resumen: {
      totalCuotas,
      cuotasPendientes,
      cuotasVencidas,
      capitalPendiente,
      interesPendiente,
      moraAcumulada: 0,
      penalidadesAcumuladas: 0,
      cargosAdicionalesAcumulados: 0,
      totalExigible: saldoPendiente,
      totalPagado,
      saldoPendiente
    },
    cuotas,
    cuotaSiguiente,
    cuotasVencidasDetalle,
    planAyuda: {
      tieneAjustesActivos,
      interesCongelado,
      fechaCongelamientoHasta,
      moraEliminada: false,
      totalBeneficioAplicado
    }
  };
};

export const classifyPayment = (
  paymentAmount: number,
  debtState: EstadoDeudaPrestamo,
  paymentDateStr?: string
) => {
  const nextQuota = debtState.cuotaSiguiente;
  const totalDebt = debtState.resumen.totalExigible;
  const amount = toNumber(paymentAmount);

  if (amount >= totalDebt - EPSILON) {
    return "Liquidación total";
  }

  const hasOverdue = debtState.cuotasVencidasDetalle && debtState.cuotasVencidasDetalle.length > 0;

  if (nextQuota) {
    const expected = nextQuota.montoExigible;
    if (Math.abs(amount - expected) <= EPSILON) {
      return "Pago exacto de cuota";
    }

    const paymentDate = paymentDateStr ? normalizeDate(paymentDateStr) : new Date();
    const isFutureQuota = normalizeDate(nextQuota.fechaVencimiento).getTime() > paymentDate.getTime();

    if (!hasOverdue && isFutureQuota) {
      return "Pago adelantado / múltiple";
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
