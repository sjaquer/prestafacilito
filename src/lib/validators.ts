/**
 * Utilidades de validación para PrestaFacilito
 */

/**
 * Valida un Documento Nacional de Identidad peruano (DNI) - 8 dígitos numéricos
 */
export function validateDNI(dni: string): boolean {
  if (!dni) return false;
  const cleaned = dni.trim().replace(/\D/g, "");
  return cleaned.length === 8;
}

/**
 * Valida un Registro Único de Contribuyentes peruano (RUC) - 11 dígitos numéricos
 */
export function validateRUC(ruc: string): boolean {
  if (!ruc) return false;
  const cleaned = ruc.trim().replace(/\D/g, "");
  return cleaned.length === 11 && ["10", "15", "17", "20"].includes(cleaned.slice(0, 2));
}

/**
 * Valida formato básico de correo electrónico
 */
export function validateEmail(email: string): boolean {
  if (!email) return true; // Opcional
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
}

/**
 * Valida un número de teléfono móvil en Perú (9 dígitos)
 */
export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, "");
  // Puede incluir prefijo de país 51
  return (cleaned.length === 9 && cleaned.startsWith("9")) || 
         (cleaned.length === 11 && cleaned.startsWith("519"));
}

/**
 * Valida el monto de un préstamo
 */
export function validateLoanAmount(amount: number): { valid: boolean; error?: string } {
  if (amount <= 0) {
    return { valid: false, error: "El monto del capital debe ser mayor a 0" };
  }
  if (amount > 10000000) {
    return { valid: false, error: "El monto no puede exceder los S/. 10,000,000" };
  }
  return { valid: true };
}

/**
 * Valida la tasa de interés mensual (0% a 100%)
 */
export function validateInterestRate(rate: number): { valid: boolean; error?: string } {
  if (rate < 0) {
    return { valid: false, error: "La tasa de interés no puede ser negativa" };
  }
  if (rate > 100) {
    return { valid: false, error: "La tasa de interés no puede superar el 100%" };
  }
  return { valid: true };
}
