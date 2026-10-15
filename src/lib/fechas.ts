/**
 * Utilidades de fecha en hora LOCAL.
 *
 * `new Date().toISOString()` devuelve la fecha en UTC: en Perú (UTC-5), desde las 7 p. m.
 * eso ya es "mañana". Para fechas de calendario (YYYY-MM-DD) siempre usar estas funciones.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha local en formato YYYY-MM-DD. */
export const toISODateLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Hoy en formato YYYY-MM-DD (hora local). */
export const hoyISO = () => toISODateLocal(new Date());

/** Convierte "YYYY-MM-DD" (o ISO con hora) a medianoche local. */
export const parseISODateLocal = (fecha: string) => new Date(`${fecha.split("T")[0]}T00:00:00`);

/** Días desde hoy hasta la fecha: negativo si ya pasó, 0 si es hoy. `null` si no hay fecha. */
export const diasHasta = (fecha: string | null | undefined, hoy: Date = new Date()): number | null => {
  if (!fecha) return null;
  const objetivo = parseISODateLocal(fecha);
  if (Number.isNaN(objetivo.getTime())) return null;
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((objetivo.getTime() - base.getTime()) / 86400000);
};

/** Texto corto relativo: "Hoy", "Mañana", "En 3 días", "Hace 5 días". */
export const textoRelativo = (dias: number | null) => {
  if (dias === null) return "Sin fecha";
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias === -1) return "Ayer";
  return dias > 0 ? `En ${dias} días` : `Hace ${Math.abs(dias)} días`;
};
