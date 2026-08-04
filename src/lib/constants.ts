// ============================================================
// MÉTODOS DE PAGO — Fuente única de verdad para toda la app
// ============================================================

export const METODOS_PAGO = [
  "BCP / Yape (Sebastián)",
  "BCP / Yape (Roberto)",
  "Interbank / Plin (Sebastián)",
  "Interbank / Plin (Roberto)",
  "BBVA (Roberto)",
  "Scotiabank (Roberto)",
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
    nombre: "BCP / Yape (Sebastián)",
    colorClass: "bg-blue-600",
    borderClass: "border-blue-250",
    textClass: "text-blue-700",
    badgeClass: "bg-blue-50 text-blue-800 border border-blue-200",
    metodos: ["BCP / Yape (Sebastián)", "BCP", "Yape", "Transferencia BCP"],
  },
  {
    nombre: "BCP / Yape (Roberto)",
    colorClass: "bg-indigo-600",
    borderClass: "border-indigo-250",
    textClass: "text-indigo-700",
    badgeClass: "bg-indigo-50 text-indigo-800 border border-indigo-200",
    metodos: ["BCP / Yape (Roberto)"],
  },
  {
    nombre: "Interbank / Plin (Sebastián)",
    colorClass: "bg-emerald-600",
    borderClass: "border-emerald-250",
    textClass: "text-emerald-700",
    badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    metodos: ["Interbank / Plin (Sebastián)", "Interbank", "Plin", "Transferencia Interbank"],
  },
  {
    nombre: "Interbank / Plin (Roberto)",
    colorClass: "bg-teal-600",
    borderClass: "border-teal-250",
    textClass: "text-teal-700",
    badgeClass: "bg-teal-50 text-teal-800 border border-teal-200",
    metodos: ["Interbank / Plin (Roberto)"],
  },
  {
    nombre: "BBVA (Roberto)",
    colorClass: "bg-sky-600",
    borderClass: "border-sky-250",
    textClass: "text-sky-700",
    badgeClass: "bg-sky-50 text-sky-800 border border-sky-200",
    metodos: ["BBVA (Roberto)", "BBVA", "Transferencia BBVA"],
  },
  {
    nombre: "Scotiabank (Roberto)",
    colorClass: "bg-rose-600",
    borderClass: "border-rose-250",
    textClass: "text-rose-700",
    badgeClass: "bg-rose-50 text-rose-800 border border-rose-200",
    metodos: ["Scotiabank (Roberto)", "Scotiabank", "Transferencia Scotiabank"],
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
  if (!metodoPago) return null;
  const exact = BANCO_GRUPOS.find((b) => b.metodos.includes(metodoPago) || b.nombre === metodoPago);
  if (exact) return exact;
  const partial = BANCO_GRUPOS.find((b) => metodoPago.toLowerCase().includes(b.nombre.toLowerCase().split(" ")[0]));
  if (partial) return partial;
  return {
    nombre: metodoPago,
    colorClass: "bg-slate-600",
    borderClass: "border-slate-250",
    textClass: "text-slate-700",
    badgeClass: "bg-slate-50 text-slate-800 border border-slate-200",
    metodos: [metodoPago],
  };
}
