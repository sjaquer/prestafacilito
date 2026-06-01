import { Amortizacion, CuotaPrestamo, EstadoDeudaPrestamo, Prestamo, AjustePrestamo, PlanAyudaCliente } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INSTALLMENTS = 3;
const DEFAULT_LATE_INTEREST_RATE_DAILY = 0.001;
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

  // Bypassear lógica de préstamos tradicionales para Alquiler de Casa (Contrato de Arrendamiento)
  if (prestamo.tipo_prestamo === "Alquiler de Casa") {
    const capital = toNumber(prestamo.monto_capital);
    const emissionDate = normalizeDate(prestamo.fecha_emision);
    const now = normalizeDate(referenceDate);

    // La primera cuota es emisionDate + 1 mes
    const firstDueDate = addMonthsClamped(emissionDate, 1);

    // Determinar cuántas cuotas generar
    const lastDueDate = prestamo.fecha_vencimiento && !Number.isNaN(normalizeDate(prestamo.fecha_vencimiento).getTime())
      ? normalizeDate(prestamo.fecha_vencimiento)
      : null;
    const limitDate = lastDueDate
      ? new Date(Math.max(now.getTime(), lastDueDate.getTime()))
      : now;

    const totalCuotasProgramadas = Math.max(1, countMonthlyOccurrences(firstDueDate, limitDate));
    const montoMensual = round2(capital / totalCuotasProgramadas);

    const processedCuotas: CuotaPrestamo[] = [];

    // 1. Generar todas las cuotas (mensualidades de alquiler fijas)
    for (let i = 0; i < totalCuotasProgramadas; i++) {
      const duePoint = addMonthsClamped(firstDueDate, i);
      processedCuotas.push({
        numero: i + 1,
        fechaVencimiento: formatIsoDate(duePoint),
        capitalPendiente: round2(capital - (i * montoMensual)),
        interesPendiente: montoMensual, // Representa la mensualidad de alquiler esperada
        moraPendiente: 0,
        penalidad: 0,
        cargosAdicionales: 0,
        montoCuotaBase: montoMensual,
        montoExigible: montoMensual,
        pagado: 0,
        saldoPendiente: montoMensual,
        diasVencidos: 0,
        estado: duePoint.getTime() <= now.getTime() ? "Vencida" : "Pendiente",
        interesOriginal: montoMensual,
        congelada: false,
        moraOriginal: 0,
        capitalAmortizado: 0,
        interesPagado: 0,
        moraPagado: 0,
      });
    }

    // 2. Procesar pagos recibidos y distribuirlos secuencialmente
    const sortedPayments = pagos
      .map(p => ({ ...p, montoVal: toNumber(p.monto), dateVal: normalizeDate(p.fecha_pago) }))
      .filter(p => p.montoVal > EPSILON && !Number.isNaN(p.dateVal.getTime()) && p.dateVal.getTime() <= now.getTime())
      .sort((a, b) => a.dateVal.getTime() - b.dateVal.getTime());

    let totalPagado = 0;
    for (const pago of sortedPayments) {
      let remaining = pago.montoVal;
      totalPagado = round2(totalPagado + remaining);

      for (const cuota of processedCuotas) {
        if (remaining <= EPSILON) break;
        if (cuota.estado === "Saldada") continue;

        // El abono de alquiler reduce el saldo del mes correspondiente
        const pagoAlquiler = round2(Math.min(cuota.interesPendiente, remaining));
        remaining = round2(remaining - pagoAlquiler);
        cuota.interesPendiente = round2(cuota.interesPendiente - pagoAlquiler);
        cuota.interesPagado = round2((cuota.interesPagado || 0) + pagoAlquiler);
        
        cuota.pagado = round2(cuota.interesPagado);
        cuota.saldoPendiente = round2(cuota.interesPendiente);
        cuota.montoExigible = round2(cuota.interesPendiente);

        if (cuota.interesPendiente <= EPSILON) {
          cuota.estado = "Saldada";
        } else {
          cuota.estado = "Parcial";
        }
      }

      // Registro de adelantos excepcionales
      if (remaining > EPSILON) {
        const lastCuota = processedCuotas[processedCuotas.length - 1];
        if (lastCuota) {
          lastCuota.capitalAmortizado = round2((lastCuota.capitalAmortizado || 0) + remaining);
        }
      }
    }

    // 3. Recalcular días de vencimiento para cuotas impagas
    for (const cuota of processedCuotas) {
      const duePoint = normalizeDate(cuota.fechaVencimiento);
      const diasVencidos = Math.max(0, Math.ceil((now.getTime() - duePoint.getTime()) / DAY_MS));
      cuota.diasVencidos = diasVencidos;

      if (cuota.estado !== "Saldada") {
        if (cuota.pagado > EPSILON) {
          cuota.estado = "Parcial";
        } else {
          cuota.estado = duePoint.getTime() <= now.getTime() ? "Vencida" : "Pendiente";
        }
      }
    }

    const cuotasVencidasDetalle = processedCuotas.filter(
      (cuota) => cuota.estado === "Vencida" || (cuota.estado === "Parcial" && cuota.diasVencidos > 0)
    );
    const cuotaSiguiente = processedCuotas.find((cuota) => cuota.estado !== "Saldada") || null;

    const totalAlquilerPagado = processedCuotas.reduce((sum, c) => sum + (c.interesPagado || 0), 0);
    const capitalPendiente = round2(Math.max(0, capital - totalAlquilerPagado));
    const saldoPendiente = capitalPendiente;

    const cuotasPendientes = processedCuotas.filter((cuota) => cuota.estado !== "Saldada").length;
    const cuotasVencidas = processedCuotas.filter((cuota) => cuota.estado === "Vencida").length;

    return {
      resumen: {
        totalCuotas: totalCuotasProgramadas,
        cuotasPendientes,
        cuotasVencidas,
        capitalPendiente,
        interesPendiente: 0,
        moraAcumulada: 0,
        penalidadesAcumuladas: 0,
        cargosAdicionalesAcumulados: 0,
        totalExigible: saldoPendiente,
        totalPagado,
        saldoPendiente
      },
      cuotas: processedCuotas,
      cuotaSiguiente,
      cuotasVencidasDetalle,
      planAyuda: {
        tieneAjustesActivos: false,
        interesCongelado: false,
        fechaCongelamientoHasta: null,
        moraEliminada: false,
        totalBeneficioAplicado: 0
      }
    };
  }

  const capital = toNumber(prestamo.monto_capital);
  const tasaInteres = toNumber(prestamo.tasa_interes_porcentaje);

  const emissionDate = normalizeDate(prestamo.fecha_emision);
  const now = normalizeDate(referenceDate);

  // La primera cuota SIEMPRE es emisionDate + 1 mes.
  const firstDueDate = addMonthsClamped(emissionDate, 1);

  // Filtrar ajustes activos
  const activeAjustes = (ajustes || []).filter((a) => a.activo);

  // Determinar cuántas cuotas generar.
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
      const originalInterest = round2(currentCapital * (tasaInteres / 100));
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
        totalBeneficioAplicado = round2(totalBeneficioAplicado + originalInterest);
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
        capitalAmortizado: initCapitalAmortizado,
        interesPagado: 0,
        moraPagado: 0,
        ultimoCalculoMoraDate: duePoint
      });

    } else if (event.tipo === "pago") {
      const paymentDate = event.fecha;
      let remaining = event.pago!.monto;

      // Primero calcular y acumular mora para todas las cuotas vencidas hasta la fecha de este pago
      for (const cuota of processedCuotas) {
        if (cuota.estado === "Saldada") continue;

        const gracePeriodAdj = activeAjustes.find((a) => a.tipo === "periodo_gracia");
        const periodoGraciaDias = gracePeriodAdj ? toNumber(gracePeriodAdj.periodo_gracia_dias) : 7;

        const totalDiasDesdeVencimiento = Math.max(0, Math.ceil((paymentDate.getTime() - normalizeDate(cuota.fechaVencimiento).getTime()) / DAY_MS));
        
        let newMora = 0;
        if (totalDiasDesdeVencimiento > periodoGraciaDias) {
          const baseDate = cuota.moraOriginal === 0 ? normalizeDate(cuota.fechaVencimiento) : cuota.ultimoCalculoMoraDate!;
          const diasParaCalcular = Math.max(0, Math.ceil((paymentDate.getTime() - baseDate.getTime()) / DAY_MS));
          newMora = round2(cuota.interesPendiente * lateInterestRateDaily * diasParaCalcular);
        }

        if (newMora > 0) {
          let originalMora = newMora;
          let adjustedMora = originalMora;

          // Aplicar ajustes sobre la mora
          const eliminarMoraAdj = activeAjustes.find((a) => a.tipo === "eliminar_mora");
          if (eliminarMoraAdj) {
            adjustedMora = 0;
            moraEliminada = true;
            if (!cuota.ajustesAplicados?.includes(eliminarMoraAdj.id)) {
              cuota.ajustesAplicados = [...(cuota.ajustesAplicados || []), eliminarMoraAdj.id];
            }
          } else {
            const reducirMoraAdj = activeAjustes.find((a) => a.tipo === "reducir_mora");
            if (reducirMoraAdj) {
              const porcentaje = toNumber(reducirMoraAdj.monto_afectado);
              adjustedMora = round2(originalMora * (1 - porcentaje / 100));
              if (!cuota.ajustesAplicados?.includes(reducirMoraAdj.id)) {
                cuota.ajustesAplicados = [...(cuota.ajustesAplicados || []), reducirMoraAdj.id];
              }
            }
          }

          const beneficioMora = round2(originalMora - adjustedMora);
          totalBeneficioAplicado = round2(totalBeneficioAplicado + beneficioMora);

          cuota.moraOriginal = round2((cuota.moraOriginal || 0) + originalMora);
          cuota.moraPendiente = round2((cuota.moraPendiente || 0) + adjustedMora);
        }
        
        cuota.ultimoCalculoMoraDate = paymentDate;
      }

      // Distribuir el pago a las cuotas vencidas/pendientes generadas hasta el momento
      for (const cuota of processedCuotas) {
        if (remaining <= EPSILON) break;
        if (cuota.estado === "Saldada") continue;

        // Pagar la mora primero
        let pagoMora = 0;
        if (cuota.moraPendiente > 0) {
          pagoMora = round2(Math.min(cuota.moraPendiente, remaining));
          remaining = round2(remaining - pagoMora);
          cuota.moraPendiente = round2(cuota.moraPendiente - pagoMora);
          cuota.moraPagado = round2((cuota.moraPagado || 0) + pagoMora);
        }

        // Pagar el interés de la cuota
        let pagoInteres = 0;
        if (cuota.interesPendiente > 0 && remaining > 0) {
          pagoInteres = round2(Math.min(cuota.interesPendiente, remaining));
          remaining = round2(remaining - pagoInteres);
          cuota.interesPendiente = round2(cuota.interesPendiente - pagoInteres);
          cuota.interesPagado = round2((cuota.interesPagado || 0) + pagoInteres);
        }

        cuota.pagado = round2((cuota.moraPagado || 0) + (cuota.interesPagado || 0));
        cuota.saldoPendiente = round2(cuota.interesPendiente + cuota.moraPendiente);
        cuota.montoExigible = round2(cuota.interesPendiente + cuota.moraPendiente + cuota.penalidad + cuota.cargosAdicionales);

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
          lastCuota.capitalAmortizado = round2((lastCuota.capitalAmortizado || 0) + remaining);
        } else {
          accumulatedCapitalAmortizado = round2(accumulatedCapitalAmortizado + remaining);
        }
        currentCapital = round2(Math.max(0, currentCapital - remaining));
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
      cuota.saldoPendiente = 0;
      cuota.montoExigible = 0;
      continue;
    }

    const gracePeriodAdj = activeAjustes.find((a) => a.tipo === "periodo_gracia");
    const periodoGraciaDias = gracePeriodAdj ? toNumber(gracePeriodAdj.periodo_gracia_dias) : 7;

    const totalDiasDesdeVencimiento = Math.max(0, Math.ceil((now.getTime() - duePoint.getTime()) / DAY_MS));
    
    let newMora = 0;
    if (totalDiasDesdeVencimiento > periodoGraciaDias) {
      const baseDate = cuota.moraOriginal === 0 ? normalizeDate(cuota.fechaVencimiento) : cuota.ultimoCalculoMoraDate!;
      const diasParaCalcular = Math.max(0, Math.ceil((now.getTime() - baseDate.getTime()) / DAY_MS));
      newMora = round2(cuota.interesPendiente * lateInterestRateDaily * diasParaCalcular);
    }

    if (newMora > 0) {
      let originalMora = newMora;
      let adjustedMora = originalMora;

      // Aplicar ajustes sobre la mora
      const eliminarMoraAdj = activeAjustes.find((a) => a.tipo === "eliminar_mora");
      if (eliminarMoraAdj) {
        adjustedMora = 0;
        moraEliminada = true;
        if (!cuota.ajustesAplicados?.includes(eliminarMoraAdj.id)) {
          cuota.ajustesAplicados = [...(cuota.ajustesAplicados || []), eliminarMoraAdj.id];
        }
      } else {
        const reducirMoraAdj = activeAjustes.find((a) => a.tipo === "reducir_mora");
        if (reducirMoraAdj) {
          const porcentaje = toNumber(reducirMoraAdj.monto_afectado);
          adjustedMora = round2(originalMora * (1 - porcentaje / 100));
          if (!cuota.ajustesAplicados?.includes(reducirMoraAdj.id)) {
            cuota.ajustesAplicados = [...(cuota.ajustesAplicados || []), reducirMoraAdj.id];
          }
        }
      }

      const beneficioMora = round2(originalMora - adjustedMora);
      totalBeneficioAplicado = round2(totalBeneficioAplicado + beneficioMora);

      cuota.moraOriginal = round2((cuota.moraOriginal || 0) + originalMora);
      cuota.moraPendiente = round2((cuota.moraPendiente || 0) + adjustedMora);
    }

    cuota.ultimoCalculoMoraDate = now;
    cuota.saldoPendiente = round2(cuota.interesPendiente + cuota.moraPendiente);
    cuota.montoExigible = round2(cuota.interesPendiente + cuota.moraPendiente + cuota.penalidad + cuota.cargosAdicionales);

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

  const totalPagado = round2(validPayments.reduce((sum, pago) => sum + pago.montoNormalizado, 0));
  const capitalPendiente = round2(currentCapital);
  const interesPendiente = round2(processedCuotas.reduce((sum, cuota) => sum + cuota.interesPendiente, 0));
  const moraAcumulada = round2(processedCuotas.reduce((sum, cuota) => sum + cuota.moraPendiente, 0));
  const penalidadesAcumuladas = round2(processedCuotas.reduce((sum, cuota) => sum + cuota.penalidad, 0));
  const cargosAdicionalesAcumulados = round2(processedCuotas.reduce((sum, cuota) => sum + cuota.cargosAdicionales, 0));
  const saldoPendiente = round2(capitalPendiente + interesPendiente + moraAcumulada + penalidadesAcumuladas + cargosAdicionalesAcumulados);
  
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

