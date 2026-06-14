// ============================================================
// MÉTODOS DE PAGO — Fuente única de verdad para toda la app
// ============================================================

export const METODOS_PAGO = [
  "Yape",
  "Plin",
  "Transferencia BCP",
  "Transferencia Interbank",
  "Transferencia BBVA",
  "Transferencia Scotiabank",
  "Efectivo",
] as const;

export type MetodoPago = (typeof METODOS_PAGO)[number];

// ============================================================
// AGRUPACIÓN BANCO ↔ MÉTODOS
// ============================================================

export interface BancoConfig {
  nombre: string;
  colorClass: string;          // Tailwind bg-*
  borderClass: string;         // Tailwind border-*
  textClass: string;           // Tailwind text-*
  badgeClass: string;          // Completo para badges
  metodos: readonly string[];
}

export const BANCO_GRUPOS: BancoConfig[] = [
  {
    nombre: "BCP",
    colorClass: "bg-blue-600",
    borderClass: "border-blue-250",
    textClass: "text-blue-700",
    badgeClass: "bg-blue-50 text-blue-800 border border-blue-200",
    metodos: ["Transferencia BCP", "Yape"],
  },
  {
    nombre: "Interbank",
    colorClass: "bg-emerald-600",
    borderClass: "border-emerald-250",
    textClass: "text-emerald-700",
    badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    metodos: ["Transferencia Interbank", "Plin"],
  },
  {
    nombre: "BBVA",
    colorClass: "bg-sky-600",
    borderClass: "border-sky-250",
    textClass: "text-sky-700",
    badgeClass: "bg-sky-50 text-sky-800 border border-sky-200",
    metodos: ["Transferencia BBVA"],
  },
  {
    nombre: "Scotiabank",
    colorClass: "bg-rose-600",
    borderClass: "border-rose-250",
    textClass: "text-rose-700",
    badgeClass: "bg-rose-50 text-rose-800 border border-rose-200",
    metodos: ["Transferencia Scotiabank"],
  },
  {
    nombre: "Efectivo",
    colorClass: "bg-amber-600",
    borderClass: "border-amber-250",
    textClass: "text-amber-700",
    badgeClass: "bg-amber-50 text-amber-800 border border-amber-200",
    metodos: ["Efectivo"],
  },
];

/** Devuelve el BancoConfig para un metodo_pago dado. */
export function getBancoForMetodo(metodoPago: string): BancoConfig | null {
  return BANCO_GRUPOS.find((b) => b.metodos.includes(metodoPago)) ?? null;
}
