import { diasHasta } from "./fechas";
import { generarMensajeCobroPredeterminado } from "./formatters";
import { estandarizarTelefono } from "../../helpers/telefono";

/**
 * Clasificación de cobros para la vista de trabajo diario.
 * Solo ordena y agrupa lo que ya calcula el servidor; no recalcula deudas.
 */
export type GrupoCobro = "vencido" | "hoy" | "semana" | "despues" | "al_dia";

export const GRUPOS_COBRO: { id: GrupoCobro; label: string; corto: string }[] = [
  { id: "vencido", label: "Vencidos", corto: "Vencidos" },
  { id: "hoy", label: "Vencen hoy", corto: "Hoy" },
  { id: "semana", label: "Próximos 7 días", corto: "7 días" },
  { id: "despues", label: "Más adelante", corto: "Después" },
  { id: "al_dia", label: "Al día / pagados", corto: "Al día" },
];

export const ESTILO_GRUPO: Record<GrupoCobro, { dot: string; texto: string; pill: string; borde: string }> = {
  vencido: { dot: "bg-rose-500", texto: "text-rose-700", pill: "bg-rose-100 text-rose-800", borde: "border-l-rose-500" },
  hoy: { dot: "bg-amber-500", texto: "text-amber-700", pill: "bg-amber-100 text-amber-800", borde: "border-l-amber-500" },
  semana: { dot: "bg-sky-500", texto: "text-sky-700", pill: "bg-sky-100 text-sky-800", borde: "border-l-sky-500" },
  despues: { dot: "bg-slate-300", texto: "text-slate-600", pill: "bg-slate-100 text-slate-700", borde: "border-l-slate-300" },
  al_dia: { dot: "bg-emerald-500", texto: "text-emerald-700", pill: "bg-emerald-100 text-emerald-800", borde: "border-l-emerald-500" },
};

interface DatosClasificacion {
  /** Fecha (YYYY-MM-DD) de la próxima cuota/mensualidad sin pagar. */
  fechaProxima?: string | null;
  /** Cuotas o mensualidades ya vencidas sin cubrir. */
  atrasadas?: number;
  /** Préstamo liquidado o sin nada pendiente. */
  sinPendiente?: boolean;
}

export function clasificarCobro({ fechaProxima, atrasadas = 0, sinPendiente = false }: DatosClasificacion, hoy = new Date()): GrupoCobro {
  if (sinPendiente) return "al_dia";
  if (atrasadas > 0) return "vencido";
  const dias = diasHasta(fechaProxima, hoy);
  if (dias === null) return "al_dia";
  if (dias < 0) return "vencido";
  if (dias === 0) return "hoy";
  if (dias <= 7) return "semana";
  return "despues";
}

/** Enlace de WhatsApp con mensaje de cobro, o `null` si no hay teléfono válido. */
export function linkCobroWhatsApp(
  telefono: string | null | undefined,
  datos: { esAlquiler?: boolean; fechaVencimiento?: string; diasAtraso?: number; atrasado?: boolean; monto?: number }
): string | null {
  const numero = estandarizarTelefono(telefono || "");
  if (numero.length < 9) return null;
  const mensaje = generarMensajeCobroPredeterminado({
    tipoPrestamo: datos.esAlquiler ? "Alquiler de Casa" : "Préstamo",
    fechaVencimiento: datos.fechaVencimiento,
    diasAtraso: datos.diasAtraso,
    estadoCuotaMes: datos.atrasado ? "mora_mes" : undefined,
    monto: datos.monto,
  });
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
