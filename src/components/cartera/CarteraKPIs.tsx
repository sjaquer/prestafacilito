import React from "react";
import { Landmark, Activity, AlertTriangle, Target } from "lucide-react";
import { Card } from "../ui/Card";
import { formatCurrency } from "../../lib/formatters";

interface KpiProps {
  label: string;
  value: React.ReactNode;
  hint: string;
  icon: React.ReactNode;
  accent: string;
  iconClass: string;
  valueClass?: string;
}

const Kpi: React.FC<KpiProps> = ({ label, value, hint, icon, accent, iconClass, valueClass = "text-slate-900" }) => (
  <Card variant="bento" className="relative overflow-hidden group">
    <div className={`absolute top-0 left-0 w-1 h-full ${accent}`} />
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <div className={`p-1 rounded-lg ${iconClass}`}>{icon}</div>
    </div>
    <div className="mt-2.5">
      <span className={`text-lg sm:text-xl font-black font-mono block leading-none ${valueClass}`}>{value}</span>
      <span className="text-[8px] text-slate-500 font-bold uppercase mt-1 block">{hint}</span>
    </div>
  </Card>
);

interface CarteraKPIsProps {
  totalColocado: number;
  activasCount: number;
  enMoraCount: number;
  totalExigible: number;
}

export const CarteraKPIs: React.FC<CarteraKPIsProps> = ({ totalColocado, activasCount, enMoraCount, totalExigible }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <Kpi
      label="Capital Colocado"
      value={formatCurrency(totalColocado)}
      hint="Suma de capital directo"
      icon={<Landmark size={14} />}
      accent="bg-indigo-600"
      iconClass="bg-indigo-50 text-indigo-600"
    />
    <Kpi
      label="Deudas Activas"
      value={`${activasCount} préstamos`}
      hint="Préstamos vigentes"
      icon={<Activity size={14} />}
      accent="bg-emerald-600"
      iconClass="bg-emerald-50 text-emerald-600"
    />
    <Kpi
      label="Pendiente de Cobro"
      value={`${enMoraCount} créditos`}
      hint="Cuotas pendientes de cobro"
      icon={<AlertTriangle size={14} />}
      accent="bg-amber-500"
      iconClass="bg-amber-50 text-amber-600"
      valueClass="text-amber-600"
    />
    <Kpi
      label="Retorno Estimado"
      value={formatCurrency(totalExigible)}
      hint="Capital + Interés total"
      icon={<Target size={14} />}
      accent="bg-blue-600"
      iconClass="bg-blue-50 text-blue-600"
    />
  </div>
);
