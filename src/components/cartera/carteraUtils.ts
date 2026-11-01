import { GrupoPrestamo, ResumenPrestamo } from "../../lib/resumenPrestamo";
import { hoyISO } from "../../lib/fechas";

export const ESTADO_FILTROS: { value: "todos" | GrupoPrestamo; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "atrasado", label: "Atrasados" },
  { value: "hoy", label: "Cobrar hoy" },
  { value: "manana", label: "Mañana" },
  { value: "semana", label: "Esta semana" },
  { value: "despues", label: "Más adelante" },
  { value: "estancado", label: "Estancados" },
  { value: "liquidado", label: "Liquidados" },
];

export const estadoFiltroClass = (value: string, active: boolean) => {
  if (!active) return "bg-white border-slate-200 text-slate-600 hover:bg-slate-50";
  if (value === "atrasado") return "bg-rose-600 border-rose-600 text-white";
  if (value === "hoy") return "bg-amber-500 border-amber-500 text-white";
  if (value === "estancado" || value === "liquidado") return "bg-slate-600 border-slate-600 text-white";
  return "bg-slate-900 border-slate-900 text-white";
};

export interface CarteraFilters {
  searchTerm: string;
  estado: string;
  tipo: string;
  fechaMin: string;
  fechaMax: string;
  montoMin: string;
  montoMax: string;
}

export const EMPTY_FILTERS: CarteraFilters = {
  searchTerm: "",
  estado: "todos",
  tipo: "todos",
  fechaMin: "",
  fechaMax: "",
  montoMin: "",
  montoMax: "",
};

export const hasAdvancedFilters = (f: CarteraFilters) =>
  f.tipo !== "todos" || !!f.fechaMin || !!f.fechaMax || !!f.montoMin || !!f.montoMax;

export const hasAnyFilter = (f: CarteraFilters) => hasAdvancedFilters(f) || f.estado !== "todos" || !!f.searchTerm;

/** Filtra la cartera por búsqueda, grupo de cobro, tipo, rango de fechas de emisión y monto. */
export const filterLoans = (prestamos: any[], grupoDe: (p: any) => GrupoPrestamo, f: CarteraFilters) =>
  prestamos.filter((p) => {
    if (f.searchTerm) {
      const q = f.searchTerm.toLowerCase();
      if (!p.cliente_nombre?.toLowerCase().includes(q) && !p.tipo_prestamo?.toLowerCase().includes(q)) return false;
    }
    if (f.estado !== "todos" && grupoDe(p) !== f.estado) return false;
    if (f.tipo !== "todos" && p.tipo_prestamo !== f.tipo) return false;
    if (f.fechaMin && p.fecha_emision < f.fechaMin) return false;
    if (f.fechaMax && p.fecha_emision > f.fechaMax) return false;
    const capital = parseFloat(p.monto_capital) || 0;
    if (f.montoMin && capital < parseFloat(f.montoMin)) return false;
    if (f.montoMax && capital > parseFloat(f.montoMax)) return false;
    return true;
  });

const csvCell = (value: unknown) => {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const ETIQUETA: Record<GrupoPrestamo, string> = {
  atrasado: "Atrasado",
  hoy: "Cobrar hoy",
  manana: "Mañana",
  semana: "Esta semana",
  despues: "Más adelante",
  estancado: "Estancado",
  liquidado: "Liquidado",
};

export const exportCarteraCsv = (loans: any[], resumenDe: (p: any) => ResumenPrestamo) => {
  const headers = ["Cliente", "Tipo", "Prestado (S/)", "Tasa %", "Emisión", "Estado", "Capital restante (S/)", "Interés mes (S/)", "A cobrar (S/)", "Fecha", "Cuotas atrasadas"];
  const rows = loans.map((p) => {
    const r = resumenDe(p);
    return [
      p.cliente_nombre,
      p.tipo_prestamo,
      p.monto_capital,
      p.tasa_interes_porcentaje,
      p.fecha_emision,
      ETIQUETA[r.grupo],
      r.capitalRestante.toFixed(2),
      r.grupo === "liquidado" ? "" : r.interesMes.toFixed(2),
      r.grupo === "liquidado" ? "" : r.aCobrar.toFixed(2),
      r.fecha || "",
      r.cuotasAtrasadas || "",
    ];
  });

  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  // BOM para que Excel reconozca UTF-8 (tildes y ñ)
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cartera_${hoyISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
