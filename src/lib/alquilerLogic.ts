// src/lib/alquilerLogic.ts
// Lógica de negocio exclusiva para contratos de alquiler.

import { round2, toNumber, normalizeDate } from './loanLogic.js';

export interface AlquilerContrato {
  id: string;
  cliente_id: string;
  monto_mensual: number;
  descripcion_inmueble?: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  estado: 'activo' | 'finalizado';
  notas?: string;
}

export interface PagoAlquiler {
  id: string;
  alquiler_id: string;
  monto: number;
  fecha_pago: string;
  periodo_mes: number;
  periodo_anio: number;
  metodo_pago?: string;
  comprobante_url?: string | null;
  voucher_drive_file_id?: string | null;
  es_pago_completo?: boolean;
}

export interface MesAlquiler {
  numero: number;
  anio: number;
  mes: number;
  fechaVencimiento: string;
  montoEsperado: number;
  montoPagado: number;
  saldoPendiente: number;
  estado: 'Saldada' | 'Parcial' | 'Pendiente' | 'Vencida';
  diasVencidos: number;
  diasRestantes: number;
  /** Pagos registrados para este mes (el mes que se eligió al registrarlos). */
  pagos: PagoAlquiler[];
  /** Parte de montoPagado que viene de pagos de más en otros meses. */
  cubiertoConExcedente: number;
}

export interface EstadoAlquiler {
  mesesGenerados: MesAlquiler[];
  totalPagado: number;
  /** Todo lo que falta pagar de los meses generados, incluido el del mes en curso aunque aún no venza. */
  totalPendiente: number;
  /** Solo lo ya vencido (lo que se debe "a la fecha"). */
  totalVencido: number;
  mesesAtrasados: number;
  mesSiguiente: MesAlquiler | null;
  diaCobroFijo: number;
  diasRestantesProximoCobro: number;
}

export function buildAlquilerSchedule(
  alquiler: AlquilerContrato,
  pagos: PagoAlquiler[],
  referenceDate: Date = new Date()
): EstadoAlquiler {
  const fechaInicio = normalizeDate(alquiler.fecha_inicio);
  const now = normalizeDate(referenceDate);
  const montoMensual = toNumber(alquiler.monto_mensual);
  
  const diaCobroFijo = fechaInicio.getDate();

  // El primer vencimiento de alquiler ocurre 1 mes después del inicio del contrato (o el mismo mes si el pago es por adelantado)
  // Generar meses desde fechaInicio hasta now
  const fechaLimite = alquiler.fecha_fin 
    ? new Date(Math.min(now.getTime(), normalizeDate(alquiler.fecha_fin).getTime()))
    : now;

  // Total acumulado pagado por el inquilino
  const totalPagado = round2(pagos.reduce((sum, p) => sum + toNumber(p.monto), 0));

  // 1. Calendario de mensualidades: la primera vence 1 mes después del inicio del contrato
  const calendario: { anio: number; mes: number; fechaVencimiento: Date }[] = [];
  let mesActual = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth() + 1, 1);
  while ((mesActual <= fechaLimite || calendario.length < 1) && calendario.length < 120) {
    const lastDay = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0).getDate();
    calendario.push({
      anio: mesActual.getFullYear(),
      mes: mesActual.getMonth() + 1,
      fechaVencimiento: new Date(mesActual.getFullYear(), mesActual.getMonth(), Math.min(diaCobroFijo, lastDay)),
    });
    mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1);
  }

  // 2. Cada pago cuenta para el mes que se eligió al registrarlo, hasta completar la renta de ese mes
  const delMes = (anio: number, mes: number) => pagos.filter((p) => p.periodo_mes === mes && p.periodo_anio === anio);
  const primero = calendario[0];
  const pagadoPropio = calendario.map((m) => {
    const suma = round2(delMes(m.anio, m.mes).reduce((s, p) => s + toNumber(p.monto), 0));
    return round2(Math.min(montoMensual, suma));
  });

  // 3. Lo pagado de más en un mes (o para un mes anterior al contrato) cubre los meses impagos más antiguos.
  //    Los pagos para meses futuros que aún no llegan se guardan para su mes.
  const excedenteMeses = calendario.reduce(
    (s, m, i) => s + round2(delMes(m.anio, m.mes).reduce((t, p) => t + toNumber(p.monto), 0) - pagadoPropio[i]),
    0
  );
  const antesDelContrato = pagos
    .filter((p) => primero && (p.periodo_anio < primero.anio || (p.periodo_anio === primero.anio && p.periodo_mes < primero.mes)))
    .reduce((s, p) => s + toNumber(p.monto), 0);
  let excedente = round2(excedenteMeses + antesDelContrato);

  const meses: MesAlquiler[] = calendario.map((m, i) => {
    const faltaPropio = round2(montoMensual - pagadoPropio[i]);
    const cubiertoConExcedente = round2(Math.min(faltaPropio, excedente));
    excedente = round2(excedente - cubiertoConExcedente);
    const montoPagadoMes = round2(pagadoPropio[i] + cubiertoConExcedente);
    const saldoPendiente = round2(Math.max(0, montoMensual - montoPagadoMes));
    const fechaVencimiento = m.fechaVencimiento;

    const diasVencidos = fechaVencimiento < now
      ? Math.floor((now.getTime() - fechaVencimiento.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    const diasRestantes = fechaVencimiento >= now
      ? Math.ceil((fechaVencimiento.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    let estado: MesAlquiler['estado'];
    if (saldoPendiente <= 0) estado = 'Saldada';
    else if (montoPagadoMes > 0) estado = 'Parcial';
    else if (fechaVencimiento < now) estado = 'Vencida';
    else estado = 'Pendiente';

    const yyyy = fechaVencimiento.getFullYear();
    const mm = String(fechaVencimiento.getMonth() + 1).padStart(2, '0');
    const dd = String(fechaVencimiento.getDate()).padStart(2, '0');

    return {
      numero: i + 1,
      anio: m.anio,
      mes: m.mes,
      fechaVencimiento: `${yyyy}-${mm}-${dd}`,
      montoEsperado: montoMensual,
      montoPagado: montoPagadoMes,
      saldoPendiente,
      estado,
      diasVencidos,
      diasRestantes,
      pagos: delMes(m.anio, m.mes),
      cubiertoConExcedente,
    };
  });

  const totalPendiente = round2(meses.reduce((sum, m) => sum + m.saldoPendiente, 0));
  const totalVencido = round2(meses.filter((m) => m.diasVencidos > 0).reduce((sum, m) => sum + m.saldoPendiente, 0));
  const mesesAtrasados = meses.filter(m => m.estado === 'Vencida' || 
    (m.estado === 'Parcial' && m.diasVencidos > 0)).length;
  const mesSiguiente = meses.find(m => m.estado !== 'Saldada') || null;
  const diasRestantesProximoCobro = mesSiguiente ? mesSiguiente.diasRestantes : 0;

  return {
    mesesGenerados: meses,
    totalPagado,
    totalPendiente,
    totalVencido,
    mesesAtrasados,
    mesSiguiente,
    diaCobroFijo,
    diasRestantesProximoCobro
  };
}
