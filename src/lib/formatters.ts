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

