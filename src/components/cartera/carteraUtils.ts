import { EstadoMoraCliente } from "../../lib/moraLogic";

const DAY_MS = 24 * 60 * 60 * 1000;

export const ESTADO_FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "al_dia", label: "Al día" },
  { value: "pendiente_mes", label: "Por vencer" },
  { value: "mora_mes", label: "Por cobrar" },
  { value: "mora_acumulada", label: "Cuentas pend." },
  { value: "pagado", label: "Pagados" },
] as const;

export const estadoFiltroClass = (value: string, active: boolean) => {
  if (!active) return "text-slate-500 hover:text-slate-700";
  if (value === "mora_mes" || value === "mora_acumulada") return "bg-rose-600 text-white shadow-md";
  if (value === "pagado") return "bg-slate-700 text-white";
  return "bg-indigo-650 text-white shadow-md shadow-indigo-650/10";
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
  f.estado !== "todos" || f.tipo !== "todos" || !!f.fechaMin || !!f.fechaMax || !!f.montoMin || !!f.montoMax;

export const hasAnyFilter = (f: CarteraFilters) => hasAdvancedFilters(f) || !!f.searchTerm;

/** Días entre hoy (00:00) y una fecha ISO (YYYY-MM-DD). Negativo si ya pasó. */
export const daysUntil = (dateValue: string | null | undefined, today: Date) => {
  if (!dateValue) return 0;
  const dueDate = new Date(`${dateValue}T00:00:00`);
  return Math.ceil((dueDate.getTime() - today.getTime()) / DAY_MS);
};

export const isEnMora = (mora: EstadoMoraCliente) =>
  mora.estadoCuotaMes === "mora_mes" || mora.estadoCuotaMes === "mora_acumulada";

/** Color del punto indicador según el estado de la cuota del mes. */
export const getIndicatorColor = (mora: EstadoMoraCliente | undefined, today: Date) => {
  if (!mora) return "bg-slate-300";
  switch (mora.estadoCuotaMes) {
    case "al_dia":
      return "bg-emerald-500";
    case "pendiente_mes":
      return Math.max(0, daysUntil(mora.fechaCuotaActual, today)) < 7 ? "bg-amber-400 animate-pulse" : "bg-blue-400";
    case "mora_mes":
      return "bg-rose-500";
    case "mora_acumulada":
      return "bg-purple-600";
    default:
      return "bg-slate-300";
  }
};

export const ESTADO_CUOTA_BADGE: Record<EstadoMoraCliente["estadoCuotaMes"], string> = {
  al_dia: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pendiente_mes: "bg-blue-50 text-blue-700 border-blue-200",
  mora_mes: "bg-amber-50 text-amber-700 border-amber-200",
  mora_acumulada: "bg-rose-50 text-rose-700 border-rose-200",
  sin_cuotas: "bg-slate-50 text-slate-500 border-slate-200",
};

export const getEstadoCuotaLabel = (mora: EstadoMoraCliente, compact = false) => {
  switch (mora.estadoCuotaMes) {
    case "al_dia":
      return "Al día";
    case "pendiente_mes":
      return "Por vencer";
    case "mora_mes":
      return "Mora";
    case "mora_acumulada":
      return compact ? `${mora.cuotasAtrasadas} atrasadas` : `${mora.cuotasAtrasadas} cuotas atrasadas`;
    default:
      return "Sin cuotas";
  }
};

/** Filtra la cartera aplicando búsqueda, estado, tipo, rango de fechas y montos. */
export const filterLoans = (
  prestamos: any[],
  moraById: Map<string, EstadoMoraCliente>,
  f: CarteraFilters
) =>
  prestamos.filter((p) => {
    if (f.searchTerm) {
      const query = f.searchTerm.toLowerCase();
      const clientMatch = p.cliente_nombre?.toLowerCase().includes(query);
      const typeMatch = p.tipo_prestamo?.toLowerCase().includes(query);
      if (!clientMatch && !typeMatch) return false;
    }

    if (f.estado !== "todos") {
      if (f.estado === "pagado") {
        if (p.estado !== "pagado") return false;
      } else {
        const mora = moraById.get(p.id);
        if (p.estado !== "activo" || !mora) return false;
        if (f.estado === "mora") {
          if (!isEnMora(mora)) return false;
        } else if (f.estado === "activo") {
          if (!["al_dia", "pendiente_mes"].includes(mora.estadoCuotaMes)) return false;
        } else if (mora.estadoCuotaMes !== f.estado) {
          return false;
        }
      }
    }

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

export const exportCarteraCsv = (loans: any[], today: Date) => {
  const headers = ["Prestatario", "Monto Capital (S/.)", "Tasa Interes %", "Fecha Emision", "Fecha Vencimiento", "Tipo", "Dias Estado", "Estado"];
  const rows = loans.map((p) => {
    const remaining = daysUntil(p.fecha_vencimiento, today);
    let statusStr = p.estado === "pagado" ? "Pagado" : "Activo";
    let daysStr = "";

    if (p.estado === "activo") {
      if (remaining < 0) {
        statusStr = "Por cobrar";
        daysStr = `Vencido hace ${Math.abs(remaining)} dias`;
      } else if (remaining === 0) {
        daysStr = "Vence hoy";
      } else {
        daysStr = `Quedan ${remaining} dias`;
      }
    }

    return [p.cliente_nombre, p.monto_capital, p.tasa_interes_porcentaje, p.fecha_emision, p.fecha_vencimiento || "", p.tipo_prestamo, daysStr, statusStr];
  });

  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  // BOM para que Excel reconozca UTF-8 (tildes y ñ)
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cartera_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
