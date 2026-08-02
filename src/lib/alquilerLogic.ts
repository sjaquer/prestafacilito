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
  pagos: PagoAlquiler[];
}

export interface EstadoAlquiler {
  mesesGenerados: MesAlquiler[];
  totalPagado: number;
  totalPendiente: number;
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
  let saldoDisponible = totalPagado;

  const meses: MesAlquiler[] = [];
  // Primer periodo de renta vence 1 mes después del inicio (o el mes siguiente si día cobro es fijo)
  let mesActual = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth() + 1, 1);
  let numeroMes = 1;

  while (mesActual <= fechaLimite || meses.length < 1) {
    const lastDay = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(diaCobroFijo, lastDay);
    const fechaVencimiento = new Date(mesActual.getFullYear(), mesActual.getMonth(), targetDay);
    
    // Aplicar saldo disponible de pagos acumulados a esta mensualidad
    const montoPagadoMes = round2(Math.min(montoMensual, saldoDisponible));
    saldoDisponible = round2(Math.max(0, saldoDisponible - montoPagadoMes));
    const saldoPendiente = round2(Math.max(0, montoMensual - montoPagadoMes));

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
    const fechaVencStr = `${yyyy}-${mm}-${dd}`;

    const pagosDelMes = pagos.filter(p => 
      p.periodo_mes === mesActual.getMonth() + 1 && 
      p.periodo_anio === mesActual.getFullYear()
    );

    meses.push({
      numero: numeroMes,
      anio: mesActual.getFullYear(),
      mes: mesActual.getMonth() + 1,
      fechaVencimiento: fechaVencStr,
      montoEsperado: montoMensual,
      montoPagado: montoPagadoMes,
      saldoPendiente,
      estado,
      diasVencidos,
      diasRestantes,
      pagos: pagosDelMes
    });
    
    mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1);
    numeroMes++;
    
    if (numeroMes > 120) break;
  }
  
  const totalPendiente = round2(meses.reduce((sum, m) => sum + m.saldoPendiente, 0));
  const mesesAtrasados = meses.filter(m => m.estado === 'Vencida' || 
    (m.estado === 'Parcial' && m.diasVencidos > 0)).length;
  const mesSiguiente = meses.find(m => m.estado !== 'Saldada') || null;
  const diasRestantesProximoCobro = mesSiguiente ? mesSiguiente.diasRestantes : 0;

  return {
    mesesGenerados: meses,
    totalPagado,
    totalPendiente,
    mesesAtrasados,
    mesSiguiente,
    diaCobroFijo,
    diasRestantesProximoCobro
  };
}
