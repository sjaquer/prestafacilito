/**
 * Utilidades de formateo para toda la aplicación PrestaFacilito
 */
// Con extensión .js: este archivo también lo carga el servidor, y Node (Vercel) no resuelve imports sin extensión
import { ARCHIVOS_PREFIX, driveIdDeUrl, esUrlDeProxyDrive, urlDeRuta } from "./archivos.js";

/**
 * Formatea un valor numérico a moneda en Soles Peruanos (S/.)
 */
export function formatCurrency(amount: unknown): string {
  const numeric = typeof amount === "number" ? amount : Number.parseFloat(String(amount ?? 0)) || 0;
  return `S/. ${numeric.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formatea una fecha a un formato legible en español (ej: "26 de mayo de 2026")
 */
/**
 * Convierte a Date: "YYYY-MM-DD" se toma como fecha local (sin desfase de zona horaria);
 * un timestamp completo ("2026-01-10T10:00:00Z") se respeta tal cual.
 */
function aFecha(dateValue: string | Date): Date {
  if (dateValue instanceof Date) return dateValue;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? new Date(`${dateValue}T00:00:00`) : new Date(dateValue);
}

export function formatDate(dateValue: string | Date): string {
  if (!dateValue) return "";
  const date = aFecha(dateValue);
  if (Number.isNaN(date.getTime())) return "Fecha inválida";
  
  return date.toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Formatea una fecha con el día de la semana (ej: "Viernes 26 de mayo del 2026")
 */
export function formatDateWithDay(dateValue: string | Date): string {
  if (!dateValue) return "";
  const date = aFecha(dateValue);
  if (Number.isNaN(date.getTime())) return "Fecha inválida";
  
  const dayName = date.toLocaleDateString("es-PE", { weekday: "long" });
  const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const formatted = date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  
  return `${dayCapitalized} ${formatted}`;
}

/**
 * Formatea una fecha a un formato corto (ej: "26/05/2026")
 */
export function formatDateShort(dateValue: string | Date): string {
  if (!dateValue) return "";
  const date = aFecha(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Redondea un número a 2 decimales para evitar problemas de precisión en coma flotante.
 */
export const round2 = (n: number): number => {
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

/**
 * Parsea un string que puede contener una URL única, una lista separada por comas, 
 * o un array serializado en JSON con múltiples URLs de comprobantes.
 */
export function parseVoucherUrls(comprobanteUrl: string | null | undefined): string[] {
  if (!comprobanteUrl) return [];
  const trimmed = comprobanteUrl.trim();
  if (!trimmed) return [];
  
  try {
    if (trimmed.startsWith("[")) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(url => String(url).trim()).filter(Boolean);
      }
    }
  } catch (e) {
    // Falla el parseo JSON, continuar con otros métodos
  }

  if (trimmed.includes(",")) {
    return trimmed.split(",").map(url => url.trim()).filter(Boolean);
  }

  return [trimmed];
}

/**
 * URL para ver un comprobante en el navegador. Acepta el valor guardado en comprobante_url
 * (una URL o varias en JSON) y devuelve la primera: los archivos de Storage (/api/archivos/...)
 * se usan tal cual; los enlaces antiguos de Google Drive pasan por el proxy del backend.
 */
export function resolveVoucherUrl(url: string | null | undefined): string {
  const target = (parseVoucherUrls(url)[0] || "").trim();
  if (!target) return "";
  if (target.startsWith(ARCHIVOS_PREFIX) || esUrlDeProxyDrive(target) || target.startsWith("data:") || target.startsWith("blob:")) {
    return target;
  }
  const driveId = driveIdDeUrl(target);
  return driveId ? `/api/vouchers/proxy/${driveId}` : target;
}

/** URL para ver o descargar un documento de cliente (Storage primero; Drive para los antiguos). */
export function resolveDocumentUrl(
  doc: { storage_path?: string | null; drive_file_id?: string | null; drive_url?: string | null } | null | undefined
): string {
  if (!doc) return "";
  if (doc.storage_path) return urlDeRuta(doc.storage_path);
  const driveId = doc.drive_file_id || driveIdDeUrl(doc.drive_url);
  return driveId ? `/api/documentos/proxy/${driveId}` : doc.drive_url || "";
}

/**
 * Genera un saludo dinámico según la hora del día
 */
export function getSaludoPorHora(): string {
  const hora = new Date().getHours();
  if (hora >= 6 && hora < 12) {
    return "Buenos días";
  } else if (hora >= 12 && hora < 19) {
    return "Buenas tardes";
  } else {
    return "Buenas noches";
  }
}

/**
 * Genera un mensaje de cobro con información mínima listo para WhatsApp:
 * - Solo saluda (ej: "Hola, buenos días.")
 * - Indica que se comunica para coordinar el cobro del préstamo / alquiler
 * - Indica si vence hoy o hace cuántos días venció
 * - Sin monto mínimo, sin nombre directo, simple y directo.
 */
export function generarMensajeCobroPredeterminado(opciones: Parameters<typeof mensajeCobroBase>[0]): string {
  const base = mensajeCobroBase(opciones);
  return opciones.monto && opciones.monto > 0.009
    ? `${base} El monto a pagar es ${formatCurrency(opciones.monto)}.`
    : base;
}

function mensajeCobroBase({
  tipoPrestamo,
  fechaVencimiento,
  estadoCuotaMes,
  diasAtraso,
}: {
  clienteNombre?: string;
  tipoPrestamo?: string;
  remitenteRaw?: string | null;
  monto?: number;
  fechaVencimiento?: string;
  estadoCuotaMes?: string;
  cuotasAtrasadas?: number;
  diasAtraso?: number;
}): string {
  const saludo = getSaludoPorHora();
  const esAlquiler = tipoPrestamo === "Alquiler de Casa" || tipoPrestamo?.toLowerCase().includes("alquiler");
  const asunto = esAlquiler ? "del alquiler" : "del préstamo";
  const unidad = esAlquiler ? "su mensualidad" : "su cuota";

  let diffDays = 0;
  if (fechaVencimiento) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = typeof fechaVencimiento === "string" ? fechaVencimiento.split("T")[0] : "";
    const dueDate = new Date(`${dateStr}T00:00:00`);
    dueDate.setHours(0, 0, 0, 0);
    diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  }

  // Días de atraso explícitos o calculados
  const diasVencidos = diasAtraso !== undefined && diasAtraso > 0
    ? diasAtraso
    : (diffDays < 0 ? Math.abs(diffDays) : 0);

  const esMora = (estadoCuotaMes && ["mora_mes", "mora_acumulada"].includes(estadoCuotaMes)) || diasVencidos > 0;

  if (esMora && diasVencidos > 0) {
    const diasTexto = diasVencidos === 1 ? "1 día" : `${diasVencidos} días`;
    return `Hola, ${saludo.toLowerCase()}. Le escribo para coordinar el cobro ${asunto}. Le recuerdo que ${unidad} venció hace ${diasTexto}.`;
  }

  if (esMora) {
    return `Hola, ${saludo.toLowerCase()}. Le escribo para coordinar el cobro ${asunto}. Le recuerdo que ${unidad} se encuentra vencida.`;
  }

  if (diffDays === 0) {
    return `Hola, ${saludo.toLowerCase()}. Le escribo para coordinar el cobro ${asunto}. Le recuerdo que hoy vence ${unidad}.`;
  }

  if (diffDays === 1) {
    return `Hola, ${saludo.toLowerCase()}. Le escribo para coordinar el cobro ${asunto}. Le recuerdo que ${unidad} vence el día de mañana.`;
  }

  if (fechaVencimiento) {
    return `Hola, ${saludo.toLowerCase()}. Le escribo para coordinar el cobro ${asunto}. Le recuerdo que ${unidad} vence el ${formatDateWithDay(fechaVencimiento)}.`;
  }

  return `Hola, ${saludo.toLowerCase()}. Le escribo para coordinar el cobro ${asunto}.`;
}



/** Monto compacto para casillas y listas: "S/ 2,000" o "S/ 70.50" (sin decimales si son cero). */
export function formatSoles(amount: unknown): string {
  const n = typeof amount === "number" ? amount : Number.parseFloat(String(amount ?? 0)) || 0;
  const entero = Math.abs(n - Math.round(n)) < 0.005;
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: entero ? 0 : 2, maximumFractionDigits: entero ? 0 : 2 })}`;
}

/** Fecha corta legible: "5 set" (o "5 set 2025" si no es del año actual). */
export function formatFechaCorta(fecha: string | null | undefined): string {
  if (!fecha) return "";
  const [y, m, d] = String(fecha).slice(0, 10).split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return "";
  const opciones: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (y !== new Date().getFullYear()) opciones.year = "numeric";
  return date.toLocaleDateString("es-PE", opciones).replace(".", "");
}
