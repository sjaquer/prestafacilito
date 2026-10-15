import { clasificarCobro, GrupoCobro } from "../../lib/cobranza";
import { diasHasta } from "../../lib/fechas";

/** Fila de /api/dashboard/home: un préstamo o un alquiler con su estado de cobro. */
export interface ItemCobroApi {
  prestamo_id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_apodo?: string;
  cliente_telefono?: string;
  score?: "A" | "B" | "C" | null;
  es_alquiler?: boolean;
  descripcion_inmueble?: string;
  monto_capital: number;
  tasa_interes_porcentaje: number;
  tipo_prestamo: string;
  fecha_emision: string;
  fecha_vencimiento?: string;
  dia_vencimiento_mes: string;
  cuota_actual: number;
  cuota_exigible: number;
  cuota_pagado: number;
  cuota_numero: number;
  total_cuotas: number;
  cuotas_debiendo?: number;
  dias_restantes?: number;
  estado_pago_mes: "atrasado" | "pendiente" | "pagado" | "estancado";
  saldo_pendiente: number;
  monto_atrasado?: number;
  mora_acumulada?: number;
  ultimo_pago_fecha?: string | null;
  dias_atraso: number;
}

/** Item listo para la vista: agrega el grupo de cobro, los días al vencimiento y el monto a cobrar. */
export interface ItemCobro extends ItemCobroApi {
  grupo: GrupoCobro;
  /** Días hasta el vencimiento (negativo = vencido). */
  dias: number | null;
  /** Lo que conviene cobrar ahora: lo atrasado si hay atraso; si no, la cuota del mes. */
  montoACobrar: number;
}

export function prepararItems(items: ItemCobroApi[], hoy = new Date()): ItemCobro[] {
  return items.map((it) => {
    const atrasadas = it.cuotas_debiendo || 0;
    const sinPendiente = it.estado_pago_mes === "pagado" && atrasadas === 0;
    const grupo = clasificarCobro({ fechaProxima: it.dia_vencimiento_mes, atrasadas, sinPendiente }, hoy);
    const dias = diasHasta(it.dia_vencimiento_mes, hoy);
    const montoACobrar =
      grupo === "vencido"
        ? Number(it.monto_atrasado) || Number(it.cuota_exigible) || 0
        : grupo === "al_dia"
        ? 0
        : Number(it.cuota_exigible) || 0;
    // dias_restantes del servidor no es fiable para préstamos (siempre 0); se usa el cálculo local
    return { ...it, grupo, dias, montoACobrar, dias_restantes: dias !== null && dias > 0 ? dias : 0 };
  });
}

const PRIORIDAD: Record<GrupoCobro, number> = { vencido: 0, hoy: 1, semana: 2, despues: 3, al_dia: 4 };

/** Orden de trabajo: primero lo más urgente; dentro del grupo, por fecha (más antiguo primero). */
export const ordenarPorUrgencia = (a: ItemCobro, b: ItemCobro) =>
  PRIORIDAD[a.grupo] - PRIORIDAD[b.grupo] || (a.dias ?? 9999) - (b.dias ?? 9999);
