/**
 * Cuentas de cobro — fuente única de verdad.
 *
 * Cada pago guarda en `metodo_pago` un texto. Los pagos nuevos usan el nombre exacto de
 * una cuenta; los antiguos pueden tener textos sueltos ("Yape", "BCP", "Transferencia BBVA"),
 * que se reconocen mediante `alias`. Lo que no se reconoce queda en "Sin identificar"
 * (no se adivina el titular), así los totales siempre cuadran y se puede corregir.
 */

export type Titular = "Sebastián" | "Roberto" | "Efectivo";

export interface Cuenta {
  id: string;
  nombre: string;
  titular: Titular;
  /** Clases Tailwind para el acento de color de la cuenta. */
  color: { dot: string; bar: string; badge: string };
  /** Textos antiguos que también corresponden a esta cuenta. */
  alias: string[];
}

export const CUENTAS: Cuenta[] = [
  {
    id: "bcp-sebastian",
    nombre: "BCP / Yape (Sebastián)",
    titular: "Sebastián",
    color: { dot: "bg-blue-600", bar: "bg-blue-500", badge: "bg-blue-50 text-blue-800 border-blue-200" },
    alias: ["BCP", "Yape", "Transferencia BCP"],
  },
  {
    id: "bcp-roberto",
    nombre: "BCP / Yape (Roberto)",
    titular: "Roberto",
    color: { dot: "bg-indigo-600", bar: "bg-indigo-500", badge: "bg-indigo-50 text-indigo-800 border-indigo-200" },
    alias: [],
  },
  {
    id: "interbank-sebastian",
    nombre: "Interbank / Plin (Sebastián)",
    titular: "Sebastián",
    color: { dot: "bg-emerald-600", bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    alias: ["Interbank", "Plin", "Transferencia Interbank"],
  },
  {
    id: "interbank-roberto",
    nombre: "Interbank / Plin (Roberto)",
    titular: "Roberto",
    color: { dot: "bg-teal-600", bar: "bg-teal-500", badge: "bg-teal-50 text-teal-800 border-teal-200" },
    alias: [],
  },
  {
    id: "bbva-roberto",
    nombre: "BBVA (Roberto)",
    titular: "Roberto",
    color: { dot: "bg-sky-600", bar: "bg-sky-500", badge: "bg-sky-50 text-sky-800 border-sky-200" },
    alias: ["BBVA", "Transferencia BBVA"],
  },
  {
    id: "scotiabank-roberto",
    nombre: "Scotiabank (Roberto)",
    titular: "Roberto",
    color: { dot: "bg-rose-600", bar: "bg-rose-500", badge: "bg-rose-50 text-rose-800 border-rose-200" },
    alias: ["Scotiabank", "Transferencia Scotiabank"],
  },
  {
    id: "efectivo",
    nombre: "Efectivo",
    titular: "Efectivo",
    color: { dot: "bg-amber-500", bar: "bg-amber-500", badge: "bg-amber-50 text-amber-800 border-amber-200" },
    alias: ["Cash"],
  },
];

export const SIN_IDENTIFICAR_ID = "sin-identificar";

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const INDICE = new Map<string, Cuenta>();
for (const c of CUENTAS) {
  INDICE.set(normalizar(c.nombre), c);
  for (const a of c.alias) INDICE.set(normalizar(a), c);
}

// Palabras clave por banco: [palabras, id cuenta Sebastián, id cuenta Roberto]
const BANCOS: [string[], string | null, string | null][] = [
  [["bcp", "yape"], "bcp-sebastian", "bcp-roberto"],
  [["interbank", "plin"], "interbank-sebastian", "interbank-roberto"],
  [["bbva"], null, "bbva-roberto"],
  [["scotiabank", "scotia"], null, "scotiabank-roberto"],
];

/** Devuelve la cuenta a la que corresponde un `metodo_pago`, o `null` si no se reconoce. */
export function resolverCuenta(metodoPago: string | null | undefined): Cuenta | null {
  if (!metodoPago) return null;
  const texto = normalizar(metodoPago);
  const exacta = INDICE.get(texto);
  if (exacta) return exacta;

  if (/\befectivo\b/.test(texto)) return CUENTAS.find((c) => c.id === "efectivo")!;

  // Texto libre: banco + titular explícito (ej. "Yape Roberto")
  const mencionaSebastian = texto.includes("sebastian");
  const mencionaRoberto = texto.includes("roberto");
  for (const [palabras, idSeb, idRob] of BANCOS) {
    if (!palabras.some((p) => texto.includes(p))) continue;
    const id = mencionaRoberto ? idRob : mencionaSebastian ? idSeb : idSeb ?? idRob;
    return CUENTAS.find((c) => c.id === id) || null;
  }
  return null;
}

/** Si el texto guardado no es el nombre oficial (es un alias antiguo o no se reconoce). */
export const esMetodoAntiguo = (metodoPago: string | null | undefined) =>
  !!metodoPago && !CUENTAS.some((c) => c.nombre === metodoPago);

export interface ResumenCuenta {
  id: string;
  nombre: string;
  titular: Titular | "Sin identificar";
  total: number;
  cantidad: number;
  cuenta: Cuenta | null;
}

/** Agrupa montos por cuenta. Incluye "Sin identificar" solo si hay pagos sin cuenta reconocida. */
export function agruparPorCuenta<T extends { monto: number; metodo_pago?: string | null }>(pagos: T[]): ResumenCuenta[] {
  const mapa = new Map<string, ResumenCuenta>(
    CUENTAS.map((c) => [c.id, { id: c.id, nombre: c.nombre, titular: c.titular, total: 0, cantidad: 0, cuenta: c }])
  );
  const sinId: ResumenCuenta = { id: SIN_IDENTIFICAR_ID, nombre: "Sin identificar", titular: "Sin identificar", total: 0, cantidad: 0, cuenta: null };

  for (const p of pagos) {
    const cuenta = resolverCuenta(p.metodo_pago);
    const destino = cuenta ? mapa.get(cuenta.id)! : sinId;
    destino.total += Number(p.monto) || 0;
    destino.cantidad += 1;
  }

  const resultado = [...mapa.values()];
  if (sinId.cantidad > 0) resultado.push(sinId);
  return resultado;
}

/** Totales por titular, derivados de las cuentas (mismo criterio que el desglose por cuenta). */
export function agruparPorTitular<T extends { monto: number; metodo_pago?: string | null }>(pagos: T[]) {
  const totales: Record<string, { total: number; cantidad: number }> = {};
  for (const r of agruparPorCuenta(pagos)) {
    const t = (totales[r.titular] ||= { total: 0, cantidad: 0 });
    t.total += r.total;
    t.cantidad += r.cantidad;
  }
  return totales;
}
