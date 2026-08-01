/**
 * Estandariza el número de teléfono para Perú (+51).
 * Si el número tiene 9 dígitos y empieza con 9, agrega el prefijo 51.
 */
export function estandarizarTelefono(tel: string): string {
  if (!tel) return '';
  const soloDigitos = tel.replace(/\D/g, '');
  if (soloDigitos.startsWith('51') && soloDigitos.length === 11) return soloDigitos;
  if (soloDigitos.length === 9 && soloDigitos.startsWith('9')) return `51${soloDigitos}`;
  return soloDigitos;
}

/**
 * Helper para comparación de diferencias en ediciones.
 */
export function getDiffDescription(oldObj: any, newObj: any, fields: Record<string, string>): string {
  const changes: string[] = [];
  for (const [key, label] of Object.entries(fields)) {
    const oldVal = oldObj[key] !== undefined && oldObj[key] !== null ? String(oldObj[key]) : "";
    const newVal = newObj[key] !== undefined && newObj[key] !== null ? String(newObj[key]) : "";
    if (oldVal.trim() !== newVal.trim()) {
      changes.push(`${label}: "${oldVal}" ➔ "${newVal}"`);
    }
  }
  return changes.length > 0 ? `Cambios: ${changes.join(" | ")}` : "Sin modificaciones relevantes.";
}
