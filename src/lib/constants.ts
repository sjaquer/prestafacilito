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
    colorClass: "bg-blue-500",
    borderClass: "border-blue-500/20",
    textClass: "text-blue-400",
    badgeClass: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    metodos: ["Transferencia BCP", "Yape"],
  },
  {
    nombre: "Interbank",
    colorClass: "bg-emerald-500",
    borderClass: "border-emerald-500/20",
    textClass: "text-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    metodos: ["Transferencia Interbank", "Plin"],
  },
  {
    nombre: "BBVA",
    colorClass: "bg-sky-500",
    borderClass: "border-sky-500/20",
    textClass: "text-sky-400",
    badgeClass: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
    metodos: ["Transferencia BBVA"],
  },
  {
    nombre: "Scotiabank",
    colorClass: "bg-rose-500",
    borderClass: "border-rose-500/20",
    textClass: "text-rose-400",
    badgeClass: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    metodos: ["Transferencia Scotiabank"],
  },
  {
    nombre: "Efectivo",
    colorClass: "bg-amber-500",
    borderClass: "border-amber-500/20",
    textClass: "text-amber-400",
    badgeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    metodos: ["Efectivo"],
  },
];

/** Devuelve el BancoConfig para un metodo_pago dado. */
export function getBancoForMetodo(metodoPago: string): BancoConfig | null {
  return BANCO_GRUPOS.find((b) => b.metodos.includes(metodoPago)) ?? null;
}
