import React, { useMemo } from "react";
import { Landmark, Wallet, Target, Activity, TrendingUp, ShieldAlert } from "lucide-react";
import { Card } from "../ui/Card";
import { formatCurrency } from "../../lib/formatters";

interface KPICardsProps {
  totalCapitalPrestado: number;
  totalRecuperado: number;
  activeLoansCount: number;
  overdueLoansCount: number;
  totalExigible: number;
  totalMoraCartera?: number;
}

export const KPICards: React.FC<KPICardsProps> = ({
  totalCapitalPrestado,
  totalRecuperado,
  activeLoansCount,
  overdueLoansCount,
  totalExigible,
  totalMoraCartera = 0,
}) => {
  const recoveryRate = useMemo(() => {
    if (totalExigible <= 0) return 0;
    return Math.min(100, (totalRecuperado / totalExigible) * 100);
  }, [totalRecuperado, totalExigible]);

  const healthRate = useMemo(() => {
    if (activeLoansCount <= 0) return 100;
    return Math.max(0, 100 - (overdueLoansCount / activeLoansCount) * 100);
  }, [activeLoansCount, overdueLoansCount]);

  const saldoPendiente = useMemo(() => {
    return Math.max(0, totalExigible - totalRecuperado);
  }, [totalExigible, totalRecuperado]);

  return (
    <div id="metrics-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
      {/* Capital Colocado */}
      <Card variant="bento" hoverable className="relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 shadow-sm" />
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-500">
            Capital Colocado
          </span>
          <div className="p-1.5 bg-indigo-500/10 rounded-lg">
            <Landmark size={16} className="text-indigo-400" />
          </div>
        </div>
        <div className="mt-4">
          <span className="text-xl md:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight font-mono block">
            {formatCurrency(totalCapitalPrestado)}
          </span>
          <p className="text-[10px] md:text-[11px] text-slate-500 font-bold mt-2.5 uppercase tracking-wider">
            Flujo emitido acumulado
          </p>
        </div>
      </Card>

      {/* Monto Cobrado */}
      <Card variant="bento" hoverable className="relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 shadow-sm" />
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-500">
            Monto Cobrado
          </span>
          <div className="p-1.5 bg-emerald-500/10 rounded-lg">
            <Wallet size={16} className="text-emerald-400" />
          </div>
        </div>
        <div className="mt-4">
          <span className="text-xl md:text-2xl lg:text-3xl font-black text-emerald-450 tracking-tight font-mono block">
            {formatCurrency(totalRecuperado)}
          </span>
          <p className="text-[10px] md:text-[11px] text-emerald-500/80 font-bold mt-2.5 flex items-center gap-1.5">
            <TrendingUp size={12} className="shrink-0" />
            <span>{recoveryRate.toFixed(1)}% recuperado</span>
          </p>
        </div>
      </Card>

      {/* Saldo Exigible */}
      <Card variant="bento" hoverable className="relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 shadow-sm" />
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-500">
            Saldo Exigible
          </span>
          <div className="p-1.5 bg-blue-500/10 rounded-lg">
            <Target size={16} className="text-blue-400" />
          </div>
        </div>
        <div className="mt-4">
          <span className="text-xl md:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight font-mono block">
            {formatCurrency(saldoPendiente)}
          </span>
          <p className="text-[10px] md:text-[11px] text-slate-500 font-bold mt-2.5 uppercase tracking-wider">
            Capital + Interés deudor
          </p>
        </div>
      </Card>

      {/* Salud Cartera */}
      <Card variant="bento" hoverable className="relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500 shadow-sm" />
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-gray-500">
            Salud Cartera
          </span>
          <div className="p-1.5 bg-rose-500/10 rounded-lg">
            <Activity size={16} className="text-rose-450" />
          </div>
        </div>
        <div className="mt-4">
          <span className={`text-xl md:text-2xl lg:text-3xl font-black tracking-tight font-mono block ${overdueLoansCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {healthRate.toFixed(0)}%
          </span>
          <p className="text-[10px] md:text-[11px] font-bold mt-2.5 flex items-center gap-1.5 uppercase tracking-wider">
            <span className={overdueLoansCount > 0 ? "text-rose-400" : "text-slate-500"}>
              {overdueLoansCount} retrasados
            </span>
          </p>
        </div>
      </Card>

      {/* Mora Acumulada Cartera */}
      <Card variant="bento" hoverable className="relative overflow-hidden group">
        <div className={`absolute top-0 left-0 w-1.5 h-full shadow-sm ${totalMoraCartera > 0 ? "bg-amber-500" : "bg-slate-300"}`} />
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-500">
            Mora Cartera
          </span>
          <div className={`p-1.5 rounded-lg ${totalMoraCartera > 0 ? "bg-amber-500/10" : "bg-slate-100"}`}>
            <ShieldAlert size={16} className={totalMoraCartera > 0 ? "text-amber-500" : "text-slate-400"} />
          </div>
        </div>
        <div className="mt-4">
          <span className={`text-xl md:text-2xl lg:text-3xl font-black tracking-tight font-mono block ${totalMoraCartera > 0 ? "text-amber-600" : "text-slate-400"}`}>
            {formatCurrency(totalMoraCartera)}
          </span>
          <p className="text-[10px] md:text-[11px] text-slate-500 font-bold mt-2.5 uppercase tracking-wider">
            {totalMoraCartera > 0 ? "Pendiente de cobro" : "Sin mora activa"}
          </p>
        </div>
      </Card>
    </div>
  );
};
