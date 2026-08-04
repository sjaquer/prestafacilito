import { Amortizacion, CuotaPrestamo, EstadoDeudaPrestamo, Prestamo, AjustePrestamo } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
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

export interface BuildScheduleOptions {
  ajustes?: AjustePrestamo[];
  referenceDate?: Date;
}

export const buildPaymentSchedule = (
  prestamo: Prestamo,
  pagos: Amortizacion[] = [],
  options: BuildScheduleOptions = {}
): EstadoDeudaPrestamo => {
  const ajustes: AjustePrestamo[] = (options.ajustes || []).filter((a) => a.activo);
  const referenceDate: Date = options.referenceDate || new Date();

  const capitalInicial = toNumber(prestamo.monto_capital);
  const tasaMensual = toNumber(prestamo.tasa_interes_porcentaje) / 100;
  const emisionDate = normalizeDate(prestamo.fecha_emision);
  const now = normalizeDate(referenceDate);

  // Ordenar pagos por fecha
  const pagosOrdenados = [...pagos]
    .map((p) => ({
      ...p,
      montoVal: toNumber(p.monto),
      dateVal: normalizeDate(p.fecha_pago),
    }))
    .filter((p) => p.montoVal > EPSILON && !Number.isNaN(p.dateVal.getTime()))
    .sort((a, b) => a.dateVal.getTime() - b.dateVal.getTime());

  // Determinar hasta qué fecha iterar los meses
  let maxDate = new Date(now);
  for (const p of pagosOrdenados) {
    if (p.dateVal > maxDate) {
      maxDate = new Date(p.dateVal);
    }
  }

  // Calcular meses mínimos transcurridos (al menos 1 mes proyectado)
  const totalMonthsToCalculate = Math.max(
    1,
    (maxDate.getFullYear() - emisionDate.getFullYear()) * 12 +
      (maxDate.getMonth() - emisionDate.getMonth()) +
      1
  );

  const cuotas: CuotaPrestamo[] = [];
  let capitalRestante = capitalInicial;
  let moraAcumulada = 0;
  let totalPagado = 0;
  let mesesSinPagoConsec = 0;
  let tieneAjustesActivos = false;
  let interesCongelado = false;
  let fechaCongelamientoHasta: string | null = null;
  let totalBeneficioAplicado = 0;

  for (let i = 0; i < totalMonthsToCalculate; i++) {
    if (capitalRestante <= EPSILON && moraAcumulada <= EPSILON && i > 0) {
      // El préstamo fue saldado en un mes previo
      break;
    }

    const startDatePeriod = addMonthsClamped(emisionDate, i);
    const endDatePeriod = addMonthsClamped(emisionDate, i + 1);

    const capitalInicioMes = capitalRestante;
    const interesMes = round2(capitalInicioMes * tasaMensual);

    // Ajustes de congelamiento de interés
    const congelarTemp = ajustes.find(
      (a) =>
        a.tipo === "congelar_interes_temporal" &&
        normalizeDate(a.fecha_inicio).getTime() <= endDatePeriod.getTime() &&
        (!a.fecha_fin || normalizeDate(a.fecha_fin).getTime() >= endDatePeriod.getTime())
    );

    const isCongelada = !!congelarTemp;
    const interesEfectivo = isCongelada ? 0 : interesMes;

    if (isCongelada && congelarTemp) {
      tieneAjustesActivos = true;
      interesCongelado = true;
      totalBeneficioAplicado = round2(totalBeneficioAplicado + interesMes);
      if (
        !fechaCongelamientoHasta ||
        (congelarTemp.fecha_fin &&
          new Date(congelarTemp.fecha_fin).getTime() >
            new Date(fechaCongelamientoHasta).getTime())
      ) {
        fechaCongelamientoHasta = congelarTemp.fecha_fin || "indefinido";
      }
    }

    const moraMesInicio = moraAcumulada;
    const cuotaMinima = round2(interesEfectivo + moraMesInicio);

    // Pagos pertenecientes a este período (entre startDatePeriod y endDatePeriod inclusive)
    const pagosMes = pagosOrdenados.filter((p) => {
      const t = p.dateVal.getTime();
      const startBound = startDatePeriod.getTime();
      const endBound = endDatePeriod.getTime();
      return i === 0
        ? (t >= startBound && t <= endBound)
        : (t > startBound && t <= endBound);
    });

    const abonoMes = round2(pagosMes.reduce((sum, p) => sum + p.montoVal, 0));
    totalPagado = round2(totalPagado + abonoMes);

    let aplicadoMora = 0;
    let aplicadoInteres = 0;
    let aplicadoCapital = 0;
    let moraGenerada = 0;
    let estadoCuota: "Saldada" | "Pendiente" | "Vencida" | "Parcial" | "SinPago" | "PagoIncompleto" = "Pendiente";

    if (abonoMes <= EPSILON) {
      // Sin abono en este mes
      moraGenerada = interesEfectivo;
      moraAcumulada = round2(moraAcumulada + interesEfectivo);
      mesesSinPagoConsec++;
      estadoCuota = endDatePeriod.getTime() <= now.getTime() ? "SinPago" : "Pendiente";
    } else {
      mesesSinPagoConsec = 0; // Se realizó un abono, rompe la racha sin pago

      let restanteAbono = abonoMes;

      // 1. Cubrir mora acumulada previa
      if (moraMesInicio > EPSILON) {
        aplicadoMora = round2(Math.min(moraMesInicio, restanteAbono));
        restanteAbono = round2(restanteAbono - aplicadoMora);
      }

      // 2. Cubrir interés del período actual
      if (restanteAbono > EPSILON && interesEfectivo > EPSILON) {
        aplicadoInteres = round2(Math.min(interesEfectivo, restanteAbono));
        restanteAbono = round2(restanteAbono - aplicadoInteres);
      }

      // 3. Excedente va directamente al capital global
      if (restanteAbono > EPSILON) {
        aplicadoCapital = round2(Math.min(capitalRestante, restanteAbono));
        restanteAbono = round2(restanteAbono - aplicadoCapital);
        capitalRestante = round2(Math.max(0, capitalRestante - aplicadoCapital));
      }

      // Calcular nueva mora acumulada para el próximo mes
      const moraNoCubierta = round2(moraMesInicio - aplicadoMora);
      const interesNoCubierto = round2(interesEfectivo - aplicadoInteres);
      moraGenerada = interesNoCubierto;
      moraAcumulada = round2(moraNoCubierta + interesNoCubierto);

      if (abonoMes < cuotaMinima - EPSILON) {
        estadoCuota = "PagoIncompleto";
      } else {
        estadoCuota = "Saldada";
      }
    }

    const pagosRecibidosFormat = pagosMes.map((p) => ({
      id: p.id,
      fecha: p.fecha_pago,
      monto: p.montoVal,
      aplicadoInteres: round2(Math.min(p.montoVal, interesEfectivo)),
      aplicadoCapital: round2(Math.max(0, p.montoVal - interesEfectivo)),
      metodo_pago: p.metodo_pago,
      comprobante_url: p.comprobante_url,
    }));

    const diasVencidos = Math.max(
      0,
      Math.ceil((now.getTime() - endDatePeriod.getTime()) / DAY_MS)
    );

    cuotas.push({
      numero: i + 1,
      fechaVencimiento: formatIsoDate(endDatePeriod),
      capitalPendiente: capitalInicioMes,
      interesPendiente: round2(Math.max(0, interesEfectivo - aplicadoInteres)),
      moraPendiente: moraAcumulada,
      penalidad: 0,
      cargosAdicionales: 0,
      montoCuotaBase: cuotaMinima,
      montoExigible: round2(Math.max(0, cuotaMinima - abonoMes)),
      pagosRecibidos: pagosRecibidosFormat,
      pagado: abonoMes,
      saldoPendiente: round2(Math.max(0, cuotaMinima - abonoMes)),
      diasVencidos,
      estado: estadoCuota,
      ajustesAplicados: isCongelada && congelarTemp ? [congelarTemp.id] : [],
      interesOriginal: interesMes,
      congelada: isCongelada,
      moraOriginal: moraMesInicio,
      capitalAmortizado: aplicadoCapital,
      capitalAmortizadoPagado: aplicadoCapital,
      interesPagado: aplicadoInteres,
      moraPagado: aplicadoMora,
      esPagoIncompleto: abonoMes > EPSILON && abonoMes < cuotaMinima - EPSILON,
      moraGenerada,
    });
  }

  const capitalPendiente = capitalRestante;
  const interesPendiente = cuotas.length > 0 ? cuotas[cuotas.length - 1].interesPendiente : 0;
  const totalExigible = round2(capitalPendiente + moraAcumulada);

  const cuotaSiguiente = cuotas.find((c) => c.estado !== "Saldada") || null;
  const cuotasVencidasDetalle = cuotas.filter(
    (c) => c.estado === "SinPago" || c.estado === "PagoIncompleto" || c.estado === "Vencida"
  );

  const cuotasPendientes = cuotas.filter((c) => c.estado !== "Saldada").length;
  const cuotasVencidas = cuotasVencidasDetalle.length;
  const esEstancado = mesesSinPagoConsec > 2;

  return {
    resumen: {
      totalCuotas: cuotas.length,
      cuotasPendientes,
      cuotasVencidas,
      capitalPendiente,
      interesPendiente,
      moraAcumulada,
      penalidadesAcumuladas: 0,
      cargosAdicionalesAcumulados: 0,
      totalExigible,
      totalPagado,
      saldoPendiente: totalExigible,
      mesesSinPago: mesesSinPagoConsec,
      esEstancado,
      mesesTranscurridos: cuotas.length,
    },
    cuotas,
    cuotaSiguiente,
    cuotasVencidasDetalle,
    planAyuda: {
      tieneAjustesActivos,
      interesCongelado,
      fechaCongelamientoHasta,
      moraEliminada: false,
      totalBeneficioAplicado,
    },
  };
};

export const classifyPayment = (
  paymentAmount: number,
  debtState: EstadoDeudaPrestamo,
  _paymentDateStr?: string
) => {
  const amount = toNumber(paymentAmount);
  if (amount <= EPSILON) {
    return "Pago inválido";
  }

  const totalExigible = debtState.resumen.totalExigible;
  const nextQuota = debtState.cuotaSiguiente;
  const cuotaMinima = nextQuota ? nextQuota.montoCuotaBase : debtState.resumen.interesPendiente;

  if (amount >= totalExigible - EPSILON && totalExigible > EPSILON) {
    if (amount > totalExigible + EPSILON) {
      return "Pago con excedente";
    }
    return "Liquidación total";
  }

  if (amount < cuotaMinima - EPSILON) {
    return "Pago incompleto";
  }

  if (Math.abs(amount - cuotaMinima) <= EPSILON) {
    return "Pago mínimo";
  }

  if (amount > cuotaMinima) {
    return "Pago con amortización";
  }

  return "Amortización a capital";
};
