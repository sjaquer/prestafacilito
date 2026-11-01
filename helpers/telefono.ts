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

