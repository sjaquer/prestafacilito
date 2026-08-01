// src/lib/alquilerLogic.ts
// Lógica de negocio exclusiva para contratos de alquiler.
// Los alquileres son completamente distintos a los préstamos:
// - Monto mensual fijo (no hay interés, no hay amortización de capital)
// - El cliente debe pagar el monto mensual o ya lo pagó
// - Se rastrea si pagó o no cada mes calendario

import { round2, toNumber, normalizeDate } from './loanLogic';

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
  numero: number;         // Número de mes relativo al contrato (1, 2, 3...)
  anio: number;
  mes: number;            // Mes calendario (1-12)
  fechaVencimiento: string;
  montoEsperado: number;
  montoPagado: number;
  saldoPendiente: number;
  estado: 'Saldada' | 'Parcial' | 'Pendiente' | 'Vencida';
  diasVencidos: number;
  pagos: PagoAlquiler[];  // Pagos que cubren este mes
}

export interface EstadoAlquiler {
  mesesGenerados: MesAlquiler[];
  totalPagado: number;
  totalPendiente: number;
  mesesAtrasados: number;
  mesSiguiente: MesAlquiler | null;
}

export function buildAlquilerSchedule(
  alquiler: AlquilerContrato,
  pagos: PagoAlquiler[],
  referenceDate: Date = new Date()
): EstadoAlquiler {
  const fechaInicio = normalizeDate(alquiler.fecha_inicio);
  const now = normalizeDate(referenceDate);
  const montoMensual = toNumber(alquiler.monto_mensual);
  
  // Generar todos los meses desde inicio hasta now (o hasta fecha_fin si existe)
  const fechaLimite = alquiler.fecha_fin 
    ? new Date(Math.min(now.getTime(), normalizeDate(alquiler.fecha_fin).getTime()))
    : now;
  
  const meses: MesAlquiler[] = [];
  let mesActual = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), 1);
  let numeroMes = 1;
  
  while (mesActual <= fechaLimite || meses.length < 1) {
    const fechaVencimiento = new Date(mesActual.getFullYear(), mesActual.getMonth(), 
      fechaInicio.getDate());
    
    const pagosDelMes = pagos.filter(p => 
      p.periodo_mes === mesActual.getMonth() + 1 && 
      p.periodo_anio === mesActual.getFullYear()
    );
    
    const montoPagado = round2(pagosDelMes.reduce((sum, p) => sum + toNumber(p.monto), 0));
    const saldoPendiente = round2(Math.max(0, montoMensual - montoPagado));
    const diasVencidos = fechaVencimiento < now 
      ? Math.floor((now.getTime() - fechaVencimiento.getTime()) / (24 * 60 * 60 * 1000))
      : 0;
    
    let estado: MesAlquiler['estado'];
    if (saldoPendiente <= 0) estado = 'Saldada';
    else if (montoPagado > 0) estado = 'Parcial';
    else if (fechaVencimiento < now) estado = 'Vencida';
    else estado = 'Pendiente';
    
    meses.push({
      numero: numeroMes,
      anio: mesActual.getFullYear(),
      mes: mesActual.getMonth() + 1,
      fechaVencimiento: fechaVencimiento.toISOString().split('T')[0],
      montoEsperado: montoMensual,
      montoPagado,
      saldoPendiente,
      estado,
      diasVencidos,
      pagos: pagosDelMes
    });
    
    mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1);
    numeroMes++;
    
    if (numeroMes > 120) break; // Límite de seguridad: 10 años
  }
  
  const totalPagado = round2(pagos.reduce((sum, p) => sum + toNumber(p.monto), 0));
  const totalPendiente = round2(meses.reduce((sum, m) => sum + m.saldoPendiente, 0));
  const mesesAtrasados = meses.filter(m => m.estado === 'Vencida' || 
    (m.estado === 'Parcial' && m.diasVencidos > 0)).length;
  const mesSiguiente = meses.find(m => m.estado !== 'Saldada') || null;
  
  return { mesesGenerados: meses, totalPagado, totalPendiente, mesesAtrasados, mesSiguiente };
}
