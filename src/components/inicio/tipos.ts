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
  congelado?: boolean;
  /** Solo alquileres */
  renta_mensual?: number;
  proximo_cobro: string | null;
  /** Lo que debe pagar en la próxima fecha para quedar al día. */
  monto_proximo: number;
  /** Dinero vencido sin pagar (interés atrasado en préstamos, mensualidades vencidas en alquileres). */
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
  /** No hay nada que cobrar en la próxima fecha (ej. cuota con interés congelado). */
  sinCobro: boolean;
  /** Tiene algo atrasado y además hoy le vence otra cuota: se cobra todo para dejarlo al día. */
  venceHoyTambien: boolean;
  /** Tiene algo atrasado y su próxima cuota vence mañana (sale también en la pestaña "Mañana"). */
  venceMananaTambien: boolean;
  /** Tiene algo atrasado y su próxima cuota vence en 2 a 7 días (sale también en "Esta semana"). */
  venceSemanaTambien: boolean;
}

export function prepararItems(items: ItemCobroApi[], hoy = new Date()): ItemCobro[] {
  return items.map((it) => {
    const atrasadas = it.atrasado > 0.009 ? it.cuotas_atrasadas || 1 : 0;
    let grupo = clasificarCobro({ fechaProxima: it.proximo_cobro, atrasadas }, hoy);
    // Sin nada que cobrar en la próxima fecha (ej. interés congelado): va al final, pero se rotula "Sin cobro"
    const sinCobro = !atrasadas && it.monto_proximo <= 0.009;
    if (sinCobro) grupo = "despues";
    const dias = diasHasta(it.proximo_cobro, hoy);
    const esAtraso = grupo === "atrasado" || grupo === "estancado";
    // Si además hoy vence otra cuota, lo que hay que cobrar hoy es lo atrasado + la de hoy (monto_proximo ya lo suma)
    const venceHoyTambien = esAtraso && dias === 0 && it.monto_proximo > it.atrasado + 0.009;
    const venceMananaTambien = esAtraso && dias === 1;
    const venceSemanaTambien = esAtraso && dias !== null && dias >= 2 && dias <= 7;
    const montoACobrar = venceHoyTambien ? it.monto_proximo : esAtraso ? it.atrasado : it.monto_proximo;
    return { ...it, grupo, dias, montoACobrar, sinCobro, venceHoyTambien, venceMananaTambien, venceSemanaTambien };
  });
}

const PRIORIDAD: Record<GrupoCobro, number> = { atrasado: 0, hoy: 1, manana: 2, semana: 3, despues: 4, estancado: 5 };

/** Orden de trabajo: lo más urgente primero; dentro del grupo, por fecha (los atrasados, por antigüedad). */
export const ordenarPorUrgencia = (a: ItemCobro, b: ItemCobro) =>
  PRIORIDAD[a.grupo] - PRIORIDAD[b.grupo] ||
  String(a.debe_desde || a.proximo_cobro || "9999").localeCompare(String(b.debe_desde || b.proximo_cobro || "9999"));
