import { clasificarCobro, GrupoCobro } from "../../lib/cobranza";
import { diasHasta } from "../../lib/fechas";

/** Fila de /api/dashboard/home: un préstamo o alquiler vigente con lo que hay que cobrar. */
export interface ItemCobroApi {
  id: string;
  es_alquiler: boolean;
  cliente_id: string;
  cliente_nombre: string;
  cliente_apodo?: string;
  cliente_telefono?: string;
  score?: "A" | "B" | "C" | null;
  tipo: string;
  descripcion_inmueble?: string;
  /** Solo préstamos */
  monto_original?: number;
  tasa?: number;
  capital_restante?: number;
  interes_mes?: number;
  /** Solo alquileres */
  renta_mensual?: number;
  proximo_cobro: string | null;
  /** Lo que debe pagar en la próxima fecha para quedar al día. */
  monto_proximo: number;
  /** Dinero vencido sin pagar (mora en préstamos, mensualidades vencidas en alquileres). */
  atrasado: number;
  cuotas_atrasadas: number;
  debe_desde: string | null;
  saldo_pendiente: number;
  ultimo_pago_fecha: string | null;
}

/** Item listo para la vista: grupo de cobro, días a la próxima fecha y monto a cobrar ahora. */
export interface ItemCobro extends ItemCobroApi {
  grupo: GrupoCobro;
  dias: number | null;
  /** Atrasados: lo vencido. Resto: lo que vence en la próxima fecha. */
  montoACobrar: number;
}

export function prepararItems(items: ItemCobroApi[], hoy = new Date()): ItemCobro[] {
  return items.map((it) => {
    const grupo = clasificarCobro({ fechaProxima: it.proximo_cobro, atrasadas: it.atrasado > 0.009 ? it.cuotas_atrasadas || 1 : 0 }, hoy);
    const montoACobrar = grupo === "atrasado" || grupo === "estancado" ? it.atrasado : it.monto_proximo;
    return { ...it, grupo, dias: diasHasta(it.proximo_cobro, hoy), montoACobrar };
  });
}

const PRIORIDAD: Record<GrupoCobro, number> = { atrasado: 0, hoy: 1, manana: 2, semana: 3, despues: 4, estancado: 5 };

/** Orden de trabajo: lo más urgente primero; dentro del grupo, por fecha (los atrasados, por antigüedad). */
export const ordenarPorUrgencia = (a: ItemCobro, b: ItemCobro) =>
  PRIORIDAD[a.grupo] - PRIORIDAD[b.grupo] ||
  String(a.debe_desde || a.proximo_cobro || "9999").localeCompare(String(b.debe_desde || b.proximo_cobro || "9999"));
