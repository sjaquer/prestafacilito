import { Amortizacion, CuotaPrestamo, EstadoDeudaPrestamo, Prestamo, AjustePrestamo, PlanAyudaCliente } from "../types";

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
  ajustesOrReferenceDate?: AjustePrestamo[] | Date,
  referenceDateOrRate?: Date | number,
  lateInterestRateDailyInput?: number
): EstadoDeudaPrestamo => {
  let ajustes: AjustePrestamo[] = [];
  let referenceDate = new Date();
  let lateInterestRateDaily = DEFAULT_LATE_INTEREST_RATE_DAILY;

  if (ajustesOrReferenceDate instanceof Date) {
    referenceDate = ajustesOrReferenceDate;
    if (typeof referenceDateOrRate === "number") {
      lateInterestRateDaily = referenceDateOrRate;
    }
  } else {
    if (Array.isArray(ajustesOrReferenceDate)) {
      ajustes = ajustesOrReferenceDate;
    }
    if (referenceDateOrRate instanceof Date) {
      referenceDate = referenceDateOrRate;
    }
    if (typeof lateInterestRateDailyInput === "number") {
      lateInterestRateDaily = lateInterestRateDailyInput;
    }
  }

  const capital = toNumber(prestamo.monto_capital);
  const tasaInteres = toNumber(prestamo.tasa_interes_porcentaje);

  const emissionDate = normalizeDate(prestamo.fecha_emision);
  const now = normalizeDate(referenceDate);

  // La primera cuota SIEMPRE es emisionDate + 1 mes.
  // fecha_vencimiento es la fecha de la ÚLTIMA cuota, no la primera.
  const firstDueDate = addMonthsClamped(emissionDate, 1);

  // Filtrar ajustes activos
  const activeAjustes = (ajustes || []).filter((a) => a.activo);

  // Período de gracia: 7 días global para todos los préstamos
  const periodoGraciaDias = 7;

  // Determinar cuántas cuotas generar.
  // Si hay fecha_vencimiento, generamos cuotas hasta ahí (o hasta "now" si es posterior).
  // Si no, generamos cuotas hasta "now".
  const lastDueDate = prestamo.fecha_vencimiento && !Number.isNaN(normalizeDate(prestamo.fecha_vencimiento).getTime())
    ? normalizeDate(prestamo.fecha_vencimiento)
    : null;
  const limitDate = lastDueDate
    ? new Date(Math.max(now.getTime(), lastDueDate.getTime()))
    : now;

  const totalCuotasProgramadas = Math.max(1, countMonthlyOccurrences(firstDueDate, limitDate));

  // Crear la lista de eventos cronológicos (cuotas y pagos)
  interface TimelineEvent {
    tipo: "cuota" | "pago";
    fecha: Date;
    fechaStr: string;
    numero?: number;
    pago?: {
      id: string;
      monto: number;
      raw: Amortizacion;
    };
  }

  const events: TimelineEvent[] = [];

  // Agregar cuotas a la línea de tiempo
  for (let i = 0; i < totalCuotasProgramadas; i++) {
    const duePoint = addMonthsClamped(firstDueDate, i);
    events.push({
      tipo: "cuota",
      fecha: duePoint,
      fechaStr: formatIsoDate(duePoint),
      numero: i + 1
    });
  }

  // Filtrar y agregar pagos válidos realizados hasta la fecha de referencia
  const validPayments = pagos
    .map((pago) => ({
      ...pago,
      montoNormalizado: toNumber(pago.monto),
      fechaNormalizada: normalizeDate(pago.fecha_pago)
    }))
    .filter((pago) => pago.montoNormalizado > EPSILON && !Number.isNaN(pago.fechaNormalizada.getTime()) && pago.fechaNormalizada.getTime() <= now.getTime());

  for (const pago of validPayments) {
    events.push({
      tipo: "pago",
      fecha: pago.fechaNormalizada,
      fechaStr: formatIsoDate(pago.fechaNormalizada),
      pago: {
        id: pago.id,
        monto: pago.montoNormalizado,
        raw: pago
      }
    });
  }

  // Ordenar eventos cronológicamente
  // En caso de misma fecha: la cuota vence primero, luego se aplica el pago.
  events.sort((a, b) => {
    const diff = a.fecha.getTime() - b.fecha.getTime();
    if (diff !== 0) return diff;
    if (a.tipo === "cuota" && b.tipo === "pago") return -1;
    if (a.tipo === "pago" && b.tipo === "cuota") return 1;
    return 0;
  });

  let currentCapital = capital;
  const processedCuotas: CuotaPrestamo[] = [];
  let accumulatedCapitalAmortizado = 0;

  // Variables para rastrear el resumen del plan de ayuda
  let totalBeneficioAplicado = 0;
  let interesCongelado = false;
  let fechaCongelamientoHasta: string | null = null;
  let moraEliminada = false;

  // Simulación paso a paso en el tiempo
  for (const event of events) {
    if (event.tipo === "cuota") {
      const numero = event.numero!;
      const duePoint = event.fecha;
      const fechaVencimiento = event.fechaStr;

      // Calcular interés mensual base basado en el capital pendiente actual
      const originalInterest = currentCapital * (tasaInteres / 100);
      let monthlyInterest = originalInterest;

      // Evaluar ajustes de interés activos sobre esta cuota
      const ajustesAplicados: string[] = [];
      let isCongelada = false;

      // A. Congelar interés permanente
      const congelarPerm = activeAjustes.find(
        (a) => a.tipo === "congelar_interes_permanente" && normalizeDate(a.fecha_inicio).getTime() <= duePoint.getTime()
      );
      if (congelarPerm) {
        monthlyInterest = 0;
        isCongelada = true;
        ajustesAplicados.push(congelarPerm.id);
        interesCongelado = true;
      }

      // B. Congelar interés temporal
      const congelarTemp = activeAjustes.find(
        (a) => a.tipo === "congelar_interes_temporal" &&
               normalizeDate(a.fecha_inicio).getTime() <= duePoint.getTime() &&
               (!a.fecha_fin || normalizeDate(a.fecha_fin).getTime() >= duePoint.getTime())
      );
      if (congelarTemp && !isCongelada) {
        monthlyInterest = 0;
        isCongelada = true;
        ajustesAplicados.push(congelarTemp.id);
        interesCongelado = true;
        if (!fechaCongelamientoHasta || new Date(congelarTemp.fecha_fin || "").getTime() > new Date(fechaCongelamientoHasta).getTime()) {
          fechaCongelamientoHasta = congelarTemp.fecha_fin || "permanente";
        }
      }

      // C. Eliminar interés cuota específica
      const eliminarIntCuota = activeAjustes.find(
        (a) => a.tipo === "eliminar_interes_cuota" && a.cuota_numero === numero
      );
      if (eliminarIntCuota && !isCongelada) {
        monthlyInterest = 0;
        isCongelada = true;
        ajustesAplicados.push(eliminarIntCuota.id);
      }

      if (isCongelada) {
        totalBeneficioAplicado += originalInterest;
      }

      const initCapitalAmortizado = numero === 1 ? accumulatedCapitalAmortizado : 0;
      if (numero === 1) {
        accumulatedCapitalAmortizado = 0;
      }

      processedCuotas.push({
        numero,
        fechaVencimiento,
        capitalPendiente: currentCapital,
        interesPendiente: monthlyInterest,
        moraPendiente: 0,
        penalidad: 0,
        cargosAdicionales: 0,
        // montoCuotaBase = interés ORIGINAL (antes de ajustes), para que la UI pueda mostrarlo
        montoCuotaBase: originalInterest,
        montoExigible: monthlyInterest,
        pagado: 0,
        saldoPendiente: monthlyInterest,
        diasVencidos: 0,
        estado: duePoint.getTime() <= now.getTime() ? "Vencida" : "Pendiente",
        ajustesAplicados,
        interesOriginal: originalInterest,
        congelada: isCongelada,
        moraOriginal: 0,
        capitalAmortizado: initCapitalAmortizado
      });

    } else if (event.tipo === "pago") {
      const paymentDate = event.fecha;
      let remaining = event.pago!.monto;

      // Distribuir el pago a las cuotas vencidas/pendientes generadas hasta el momento
      for (const cuota of processedCuotas) {
        if (remaining <= EPSILON) break;
        if (cuota.estado === "Saldada") continue;

        // Calcular mora acumulada de esta cuota al momento del pago
        const diasVencidosAlPago = Math.max(0, Math.ceil((paymentDate.getTime() - normalizeDate(cuota.fechaVencimiento).getTime()) / DAY_MS));
        
        let originalMora = 0;
        let mora = 0;

        if (diasVencidosAlPago > periodoGraciaDias) {
          originalMora = cuota.interesPendiente * lateInterestRateDaily * diasVencidosAlPago;
          mora = originalMora;

          // Aplicar ajustes sobre la mora
          const eliminarMoraAdj = activeAjustes.find((a) => a.tipo === "eliminar_mora");
          if (eliminarMoraAdj) {
            mora = 0;
            moraEliminada = true;
            if (!cuota.ajustesAplicados?.includes(eliminarMoraAdj.id)) {
              cuota.ajustesAplicados = [...(cuota.ajustesAplicados || []), eliminarMoraAdj.id];
            }
          } else {
            const reducirMoraAdj = activeAjustes.find((a) => a.tipo === "reducir_mora");
            if (reducirMoraAdj) {
              const porcentaje = toNumber(reducirMoraAdj.monto_afectado);
              mora = originalMora * (1 - porcentaje / 100);
              if (!cuota.ajustesAplicados?.includes(reducirMoraAdj.id)) {
                cuota.ajustesAplicados = [...(cuota.ajustesAplicados || []), reducirMoraAdj.id];
              }
            }
          }
        }

        const beneficioMora = originalMora - mora;
        totalBeneficioAplicado += beneficioMora;

        // Pagar la mora primero
        let pagoMora = 0;
        if (mora > 0) {
          pagoMora = Math.min(mora, remaining);
          remaining -= pagoMora;
          mora -= pagoMora;
        }

        // Pagar el interés de la cuota
        let pagoInteres = 0;
        if (cuota.interesPendiente > 0 && remaining > 0) {
          pagoInteres = Math.min(cuota.interesPendiente, remaining);
          remaining -= pagoInteres;
          cuota.interesPendiente -= pagoInteres;
        }

        cuota.pagado += (pagoMora + pagoInteres);
        cuota.moraPendiente = mora;
        cuota.saldoPendiente = cuota.interesPendiente;
        cuota.montoExigible = cuota.interesPendiente + cuota.moraPendiente;

        if (cuota.interesPendiente <= EPSILON && cuota.moraPendiente <= EPSILON) {
          cuota.estado = "Saldada";
        } else if (cuota.pagado > EPSILON) {
          const duePoint = normalizeDate(cuota.fechaVencimiento);
          cuota.estado = duePoint.getTime() <= paymentDate.getTime() ? "Parcial" : "Pendiente";
        }
      }

      // Si aún queda saldo del pago, reduce el capital (Pago Anticipado / Amortización de Capital)
      if (remaining > EPSILON) {
        const lastCuota = processedCuotas[processedCuotas.length - 1];
        if (lastCuota) {
          lastCuota.capitalAmortizado = (lastCuota.capitalAmortizado || 0) + remaining;
        } else {
          accumulatedCapitalAmortizado += remaining;
        }
        currentCapital = Math.max(0, currentCapital - remaining);
        remaining = 0;
      }
    }
  }

  // Actualizar el estado final de las cuotas al momento actual (referenceDate)
  for (const cuota of processedCuotas) {
    const duePoint = normalizeDate(cuota.fechaVencimiento);
    const diasVencidos = Math.max(0, Math.ceil((now.getTime() - duePoint.getTime()) / DAY_MS));
    cuota.diasVencidos = diasVencidos;

    if (cuota.estado === "Saldada") {
      cuota.moraPendiente = 0;
      cuota.moraOriginal = 0;
      cuota.saldoPendiente = 0;
      cuota.montoExigible = 0;
      continue;
    }

    let originalMora = 0;
    let mora = 0;

    if (diasVencidos > periodoGraciaDias) {
      originalMora = cuota.interesPendiente * lateInterestRateDaily * diasVencidos;
      mora = originalMora;

      // Aplicar ajustes sobre la mora
      const eliminarMoraAdj = activeAjustes.find((a) => a.tipo === "eliminar_mora");
      if (eliminarMoraAdj) {
        mora = 0;
        moraEliminada = true;
        if (!cuota.ajustesAplicados?.includes(eliminarMoraAdj.id)) {
          cuota.ajustesAplicados = [...(cuota.ajustesAplicados || []), eliminarMoraAdj.id];
        }
      } else {
        const reducirMoraAdj = activeAjustes.find((a) => a.tipo === "reducir_mora");
        if (reducirMoraAdj) {
          const porcentaje = toNumber(reducirMoraAdj.monto_afectado);
          mora = originalMora * (1 - porcentaje / 100);
          if (!cuota.ajustesAplicados?.includes(reducirMoraAdj.id)) {
            cuota.ajustesAplicados = [...(cuota.ajustesAplicados || []), reducirMoraAdj.id];
          }
        }
      }
    }

    cuota.moraOriginal = originalMora;
    cuota.moraPendiente = mora;
    cuota.saldoPendiente = cuota.interesPendiente;
    cuota.montoExigible = cuota.interesPendiente + cuota.moraPendiente + cuota.penalidad + cuota.cargosAdicionales;

    if (cuota.interesPendiente <= EPSILON && cuota.moraPendiente <= EPSILON) {
      cuota.estado = "Saldada";
    } else if (cuota.pagado > EPSILON) {
      cuota.estado = "Parcial";
    } else {
      cuota.estado = duePoint.getTime() <= now.getTime() ? "Vencida" : "Pendiente";
    }
  }

  const cuotasVencidasDetalle = processedCuotas.filter(
    (cuota) => cuota.estado === "Vencida" || (cuota.estado === "Parcial" && cuota.diasVencidos > 0)
  );
  const cuotaSiguiente = processedCuotas.find((cuota) => cuota.estado !== "Saldada") || null;

  const totalPagado = validPayments.reduce((sum, pago) => sum + pago.montoNormalizado, 0);
  const capitalPendiente = currentCapital;
  const interesPendiente = processedCuotas.reduce((sum, cuota) => sum + cuota.interesPendiente, 0);
  const moraAcumulada = processedCuotas.reduce((sum, cuota) => sum + cuota.moraPendiente, 0);
  const penalidadesAcumuladas = processedCuotas.reduce((sum, cuota) => sum + cuota.penalidad, 0);
  const cargosAdicionalesAcumulados = processedCuotas.reduce((sum, cuota) => sum + cuota.cargosAdicionales, 0);
  const saldoPendiente = capitalPendiente + interesPendiente + moraAcumulada + penalidadesAcumuladas + cargosAdicionalesAcumulados;
  
  const cuotasPendientes = processedCuotas.filter((cuota) => cuota.estado !== "Saldada").length;
  const cuotasVencidas = processedCuotas.filter((cuota) => cuota.estado === "Vencida").length;

  const tieneAjustesActivos = activeAjustes.length > 0;
  const planAyuda: PlanAyudaCliente = {
    tieneAjustesActivos,
    interesCongelado,
    fechaCongelamientoHasta,
    moraEliminada,
    totalBeneficioAplicado
  };

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
    cuotas: processedCuotas,
    cuotaSiguiente,
    cuotasVencidasDetalle,
    planAyuda
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

