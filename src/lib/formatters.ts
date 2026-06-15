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
 * Genera un mensaje de cobro o recordatorio predeterminado listo para WhatsApp.
 */
export function generarMensajeCobroPredeterminado({
  clienteNombre,
  tipoPrestamo,
  remitenteRaw,
  monto,
  fechaVencimiento,
  estadoCuotaMes,
  cuotasAtrasadas,
}: {
  clienteNombre: string;
  tipoPrestamo: string;
  remitenteRaw: string | null;
  monto: number;
  fechaVencimiento: string;
  estadoCuotaMes?: string;
  cuotasAtrasadas?: number;
}): string {
  const remitente = getNombreUsuario(remitenteRaw);
  
  const NOMBRES_FEMENINOS = new Set([
    "maria", "ana", "lucia", "sofia", "elena", "carmen", "rosa", "claudia", "andrea", "patricia",
    "laura", "diana", "gloria", "monica", "sandra", "alejandra", "valentina", "gabriela", "lorena",
    "jessica", "vanessa", "adriana", "paola", "natalia", "carolina", "fernanda", "daniela", "sara",
    "isabel", "pilar", "julia", "alicia", "beatriz", "cristina", "irene", "mariana", "raquel",
    "silvia", "yolanda", "angela", "consuelo", "esperanza", "graciela", "luz", "mercedes", "norma",
    "olga", "rebeca", "susana", "veronica", "wendy", "xiomara", "yasmin", "zoraida", "pamela",
    "karina", "brenda", "gisela", "rocio", "miriam", "nancy", "marisol", "milagros", "flor",
    "liliana", "estela", "cecilia", "catalina", "evelyn", "fabiola", "helen", "iliana"
  ]);
  const primerNombre = clienteNombre.trim().split(/\s+/)[0].toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tratamiento = NOMBRES_FEMENINOS.has(primerNombre) ? "SRA." : "SR.";

  const isAlquiler = tipoPrestamo === "Alquiler de Casa";
  const isMora = estadoCuotaMes && ["mora_mes", "mora_acumulada"].includes(estadoCuotaMes);
  const formattedMonto = formatCurrency(monto);
  const nombreMayus = clienteNombre.toUpperCase();

  let diffDays = 0;
  if (fechaVencimiento) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = typeof fechaVencimiento === "string" ? fechaVencimiento.split("T")[0] : "";
    const dueDate = new Date(`${dateStr}T00:00:00`);
    dueDate.setHours(0, 0, 0, 0);
    diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  }

  const intro = `¡Hola, ${tratamiento} ${nombreMayus}! Te saluda ${remitente}.\n\n`;

  if (isAlquiler) {
    if (isMora) {
      const mesesTexto = cuotasAtrasadas && cuotasAtrasadas > 1 ? `${cuotasAtrasadas} meses atrasados` : "1 mes atrasado";
      return `${intro}Te escribo para recordarte amablemente tu mensualidad de alquiler vencida pendiente de pago de ${formattedMonto} (${mesesTexto}). Agradezco tu apoyo en regularizarlo a la brevedad y enviarme el voucher de pago una vez realizado el abono. ¡Muchas gracias y que tengas un excelente día!`;
    } else if (diffDays === 0) {
      return `${intro}Te escribo para recordarte amablemente que el día de hoy vence tu mensualidad de alquiler de ${formattedMonto}. Agradezco tu puntualidad y que por favor me compartas el voucher de pago cuando lo realices. ¡Muchas gracias y que tengas un excelente día!`;
    } else if (diffDays === 1) {
      return `${intro}Te escribo para recordarte amablemente que el día de mañana vence tu mensualidad de alquiler de ${formattedMonto}. Agradezco tu puntualidad y que por favor me compartas el voucher de pago cuando lo realices. ¡Muchas gracias y que tengas un excelente día!`;
    } else {
      const fecha = formatDateWithDay(fechaVencimiento);
      return `${intro}Te escribo para recordarte amablemente tu mensualidad de alquiler de ${formattedMonto} con vencimiento el ${fecha}. Te agradecería si me compartes el voucher de pago una vez que realices el abono. ¡Muchas gracias y que tengas un excelente día!`;
    }
  } else {
    if (isMora) {
      const cuotasTexto = cuotasAtrasadas && cuotasAtrasadas > 1 ? `${cuotasAtrasadas} cuotas sin pagar` : "1 cuota sin pagar";
      return `${intro}Te escribo para recordarte amablemente tu cuota vencida de ${formattedMonto} (${cuotasTexto}). Agradezco tu pronta regularización para no seguir generando mora, y que por favor me envíes el voucher de pago una vez realizado el abono. ¡Muchas gracias y que tengas un excelente día!`;
    } else if (diffDays === 0) {
      return `${intro}Te escribo para recordarte amablemente que el día de hoy vence tu cuota de ${formattedMonto}. Agradezco tu puntualidad para evitar intereses o mora, y que por favor me compartas el voucher de pago cuando lo realices. ¡Muchas gracias y que tengas un excelente día!`;
    } else if (diffDays === 1) {
      return `${intro}Te escribo para recordarte amablemente que el día de mañana vence tu cuota de ${formattedMonto}. Agradezco tu puntualidad para evitar intereses o mora, y que por favor me compartas el voucher de pago cuando lo realices. ¡Muchas gracias y que tengas un excelente día!`;
    } else {
      const fecha = formatDateWithDay(fechaVencimiento);
      return `${intro}Te escribo para recordarte amablemente tu cuota de ${formattedMonto} con vencimiento el ${fecha} para no generar intereses. Te agradecería si me compartes el voucher de pago una vez que realices el abono. ¡Muchas gracias y que tengas un excelente día!`;
    }
  }
}


