import React from "react";
import { Landmark, Activity, AlertTriangle, CalendarClock } from "lucide-react";
import { formatCurrency } from "../../lib/formatters";

interface KpiProps {
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
  accent: string;
  valueClass?: string;
  onClick?: () => void;
}

const Kpi: React.FC<KpiProps> = ({ label, value, hint, icon, accent, valueClass = "text-slate-900", onClick }) => {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
        <span className={`p-1 rounded-lg ${accent}`}>{icon}</span>
      </div>
      <span className={`mt-1.5 block text-lg sm:text-xl font-black font-mono leading-tight ${valueClass}`}>{value}</span>
      <span className="text-[11px] text-slate-500 font-semibold">{hint}</span>
    </>
  );
  const cls = "bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:border-slate-300 transition`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
};

interface CarteraKPIsProps {
  capitalPendiente: number;
  activasCount: number;
  vencidosCount: number;
  montoVencido: number;
  hoyCount: number;
  onFiltrar: (grupo: "vencido" | "hoy") => void;
}

export const CarteraKPIs: React.FC<CarteraKPIsProps> = ({
  capitalPendiente,
  activasCount,
  vencidosCount,
  montoVencido,
  hoyCount,
  onFiltrar,
}) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
    <Kpi
      label="Vencidos"
      value={formatCurrency(montoVencido)}
      hint={`${vencidosCount} préstamo${vencidosCount === 1 ? "" : "s"} con atraso`}
      icon={<AlertTriangle size={14} />}
      accent="bg-rose-50 text-rose-600"
      valueClass={vencidosCount ? "text-rose-600" : "text-slate-900"}
      onClick={() => onFiltrar("vencido")}
    />
    <Kpi
      label="Vencen hoy"
      value={hoyCount}
      hint="Cuotas que vencen hoy"
      icon={<CalendarClock size={14} />}
      accent="bg-amber-50 text-amber-600"
      valueClass={hoyCount ? "text-amber-600" : "text-slate-900"}
      onClick={() => onFiltrar("hoy")}
    />
    <Kpi
      label="Capital prestado"
      value={formatCurrency(capitalPendiente)}
      hint="Pendiente de devolver"
      icon={<Landmark size={14} />}
      accent="bg-indigo-50 text-indigo-600"
    />
    <Kpi
      label="Vigentes"
      value={activasCount}
      hint="Préstamos sin liquidar"
      icon={<Activity size={14} />}
      accent="bg-emerald-50 text-emerald-600"
    />
  </div>
);
