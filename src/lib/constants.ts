// ============================================================
// MÉTODOS DE PAGO — derivados de las cuentas de cobro (src/lib/cuentas.ts)
// ============================================================
import { CUENTAS } from "./cuentas";

export const METODOS_PAGO: readonly string[] = CUENTAS.map((c) => c.nombre);

export type MetodoPago = string;
