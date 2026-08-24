/**
 * Utilidades de formateo para toda la aplicación PrestaFacilito
 */

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
export function formatDate(dateValue: string | Date): string {
  if (!dateValue) return "";
  const date = typeof dateValue === "string" ? new Date(`${dateValue}T00:00:00`) : dateValue;
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
  const date = typeof dateValue === "string" ? new Date(`${dateValue}T00:00:00`) : dateValue;
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
  const date = typeof dateValue === "string" ? new Date(`${dateValue}T00:00:00`) : dateValue;
  if (Number.isNaN(date.getTime())) return "";
  
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formatea una fecha de manera relativa (ej: "hace 2 días", "en 3 días", "hoy")
 */
export function formatRelativeDate(dateValue: string | Date): string {
  if (!dateValue) return "";
  const date = typeof dateValue === "string" ? new Date(`${dateValue}T00:00:00`) : dateValue;
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "mañana";
  if (diffDays === -1) return "ayer";
  if (diffDays > 1) return `en ${diffDays} días`;
  return `hace ${Math.abs(diffDays)} días`;
}

/**
 * Limpia y formatea un número de teléfono agregando prefijo +51 si corresponde
 */
export function formatPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 9 && cleaned.startsWith("9")) {
    return `+51 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("51")) {
    return `+51 ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 11)}`;
  }
  return phone;
}

/**
 * Redondea un número a 2 decimales para evitar problemas de precisión en coma flotante.
 */
export const round2 = (n: number): number => {
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

/**
 * Mapea el usuario actual a su nombre real para mensajes y saludos.
 */
export function getNombreUsuario(username: string | null): string {
  if (!username) return "Sebastián";
  const nameMap: Record<string, string> = {
    sjaquer: "Sebastián",
    rjaque: "Roberto"
  };
  return nameMap[username.toLowerCase()] || "Sebastián";
}

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
 * Resuelve y normaliza la URL de un comprobante para poder visualizarlo en el navegador.
 * Convierte enlaces directos de Google Drive a través del proxy seguro del backend (/api/vouchers/proxy/:fileId).
 */
export function resolveVoucherUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Si viene serializado en JSON o lista separada por comas, tomar el primero
  const urls = parseVoucherUrls(trimmed);
  const target = (urls[0] || trimmed).trim();

  if (!target) return "";

  // Si ya es un proxy local, un data URI o un blob URL
  if (
    target.startsWith("/api/vouchers/proxy/") || 
    target.startsWith("/api/documentos/proxy/") ||
    target.startsWith("data:") ||
    target.startsWith("blob:")
  ) {
    return target;
  }

  // Extraer File ID de enlaces de Google Drive (ej: /file/d/ID, ?id=ID, /d/ID)
  const match = target.match(/(?:\/file\/d\/|\?id=|&id=|\/d\/)([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `/api/vouchers/proxy/${match[1]}`;
  }

  // Si es un ID de archivo de Google Drive puro
  if (/^[a-zA-Z0-9_-]{25,55}$/.test(target)) {
    return `/api/vouchers/proxy/${target}`;
  }

  return target;
}

/**
 * Resuelve y normaliza la URL de un documento de cliente para poder visualizarlo o descargarlo.
 */
export function resolveDocumentUrl(doc: { drive_file_id?: string; drive_url?: string } | string | null | undefined): string {
  if (!doc) return "";
  if (typeof doc === "string") {
    const trimmed = doc.trim();
    if (!trimmed) return "";
    if (
      trimmed.startsWith("/api/documentos/proxy/") || 
      trimmed.startsWith("/api/vouchers/proxy/") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:")
    ) {
      return trimmed;
    }
    const match = trimmed.match(/(?:\/file\/d\/|\?id=|&id=|\/d\/)([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `/api/documentos/proxy/${match[1]}`;
    if (/^[a-zA-Z0-9_-]{25,55}$/.test(trimmed)) return `/api/documentos/proxy/${trimmed}`;
    return trimmed;
  }
  if (doc.drive_file_id) {
    return `/api/documentos/proxy/${doc.drive_file_id}`;
  }
  if (doc.drive_url) {
    return resolveDocumentUrl(doc.drive_url);
  }
  return "";
}

/**
 * Normaliza el nombre del cliente a Title Case (primera letra de cada palabra en mayúscula, el resto minúscula)
 */
export function normalizeClientName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
 * Genera un mensaje de cobro o recordatorio predeterminado listo para WhatsApp.
 */
export function generarMensajeCobroPredeterminado({
  clienteNombre,
  tipoPrestamo,
  monto,
  fechaVencimiento,
  estadoCuotaMes,
  cuotasAtrasadas,
}: {
  clienteNombre: string;
  tipoPrestamo: string;
  remitenteRaw?: string | null;
  monto: number;
  fechaVencimiento: string;
  estadoCuotaMes?: string;
  cuotasAtrasadas?: number;
}): string {
  const nombreNormalizado = normalizeClientName(clienteNombre);
  const saludo = getSaludoPorHora();
  const esAlquiler = tipoPrestamo === "Alquiler de Casa";
  const esMora = estadoCuotaMes && ["mora_mes", "mora_acumulada"].includes(estadoCuotaMes);
  const formattedMonto = formatCurrency(monto);

  let diffDays = 0;
  if (fechaVencimiento) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = typeof fechaVencimiento === "string" ? fechaVencimiento.split("T")[0] : "";
    const dueDate = new Date(`${dateStr}T00:00:00`);
    dueDate.setHours(0, 0, 0, 0);
    diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  }

  const tipo = esAlquiler ? "mensualidad de alquiler" : "cuota";

  if (esMora) {
    const detalleMora = cuotasAtrasadas && cuotasAtrasadas > 1 
      ? `(${cuotasAtrasadas} meses vencidos)` 
      : `(vencida)`;
    return `¡Hola! ${saludo} ${nombreNormalizado}. 😊 Quería recordarle amablemente que su ${tipo} de ${formattedMonto} está pendiente de pago ${detalleMora}. Le agradecería regularizarlo y enviarme el comprobante. ¡Muchas gracias!`;
  }

  let tiempoVencimiento = "";
  if (diffDays === 0) {
    tiempoVencimiento = "vence el día de hoy";
  } else if (diffDays === 1) {
    tiempoVencimiento = "vence el día de mañana";
  } else if (diffDays < 0) {
    tiempoVencimiento = "ya venció";
  } else {
    tiempoVencimiento = `vence el ${formatDateWithDay(fechaVencimiento)}`;
  }

  return `¡Hola! ${saludo} ${nombreNormalizado}. 😊 Quería recordarle amablemente que su ${tipo} de ${formattedMonto} está a punto de vencer (${tiempoVencimiento}). Quedo atento al envío del comprobante de pago. ¡Muchas gracias!`;
}


