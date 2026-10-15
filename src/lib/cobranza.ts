import { diasHasta } from "./fechas";
import { generarMensajeCobroPredeterminado } from "./formatters";
import { estandarizarTelefono } from "../../helpers/telefono";

/**
 * Clasificación de cobros para la vista de trabajo diario.
 * Solo ordena y agrupa lo que ya calcula el servidor; no recalcula deudas.
 */
export type GrupoCobro = "atrasado" | "hoy" | "manana" | "semana" | "despues" | "estancado";

/** Cuotas atrasadas a partir de las cuales un cobro se considera estancado (se muestra aparte). */
export const CUOTAS_ESTANCADO = 5;

/** Grupos que se muestran como pestañas, en orden de urgencia (los estancados van en su propia sección). */
export const GRUPOS_COBRO: { id: Exclude<GrupoCobro, "estancado">; label: string }[] = [
  { id: "atrasado", label: "Atrasados" },
  { id: "hoy", label: "Cobrar hoy" },
  { id: "manana", label: "Mañana" },
  { id: "semana", label: "Esta semana" },
  { id: "despues", label: "Más adelante" },
];

/**
 * Colores por grupo. La tarjeta entera lleva el color del grupo (no solo un borde),
 * para distinguir el estado de un vistazo.
 */
export const ESTILO_GRUPO: Record<GrupoCobro, { dot: string; texto: string; pill: string; tarjeta: string; etiqueta: string }> = {
  atrasado: { dot: "bg-rose-500", texto: "text-rose-700", pill: "bg-rose-600 text-white", tarjeta: "bg-rose-50 border-rose-200", etiqueta: "Atrasado" },
  hoy: { dot: "bg-amber-500", texto: "text-amber-800", pill: "bg-amber-500 text-white", tarjeta: "bg-amber-50 border-amber-200", etiqueta: "Cobrar hoy" },
  manana: { dot: "bg-sky-500", texto: "text-sky-800", pill: "bg-sky-600 text-white", tarjeta: "bg-sky-50 border-sky-200", etiqueta: "Mañana" },
  semana: { dot: "bg-indigo-400", texto: "text-indigo-800", pill: "bg-indigo-600 text-white", tarjeta: "bg-indigo-50/60 border-indigo-200", etiqueta: "Esta semana" },
  despues: { dot: "bg-slate-400", texto: "text-slate-600", pill: "bg-slate-200 text-slate-700", tarjeta: "bg-white border-slate-200", etiqueta: "Más adelante" },
  estancado: { dot: "bg-slate-500", texto: "text-slate-600", pill: "bg-slate-600 text-white", tarjeta: "bg-slate-100 border-slate-200", etiqueta: "Estancado" },
};

interface DatosClasificacion {
  /** Próxima fecha de cobro (YYYY-MM-DD), desde hoy. */
  fechaProxima?: string | null;
  /** Cuotas o mensualidades vencidas con dinero aún sin pagar. */
  atrasadas?: number;
}

export function clasificarCobro({ fechaProxima, atrasadas = 0 }: DatosClasificacion, hoy = new Date()): GrupoCobro {
  if (atrasadas >= CUOTAS_ESTANCADO) return "estancado";
  if (atrasadas > 0) return "atrasado";
  const dias = diasHasta(fechaProxima, hoy);
  if (dias === null || dias > 7) return "despues";
  if (dias <= 0) return "hoy";
  if (dias === 1) return "manana";
  return "semana";
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
