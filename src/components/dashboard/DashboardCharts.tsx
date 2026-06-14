import React, { useMemo } from "react";
import { Building2, Landmark, Banknote } from "lucide-react";
import { Card } from "../ui/Card";
import { formatCurrency } from "../../lib/formatters";
import { Amortizacion } from "../../types";
import { BANCO_GRUPOS, getBancoForMetodo } from "../../lib/constants";

interface DashboardChartsProps {
  amortizaciones: Amortizacion[];
  totalExigible: number;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  amortizaciones,
  totalExigible,
}) => {
  const totalIngresos = useMemo(() => {
    return amortizaciones.reduce((sum, a) => sum + (parseFloat(String(a.monto)) || 0), 0);
  }, [amortizaciones]);

  const saldoPendiente = useMemo(() => {
    return Math.max(0, totalExigible - totalIngresos);
  }, [totalExigible, totalIngresos]);

  const recoveryRate = useMemo(() => {
    if (totalExigible <= 0) return 0;
    return Math.min(100, (totalIngresos / totalExigible) * 100);
  }, [totalIngresos, totalExigible]);

  const bancoDist = useMemo(() => {
    return BANCO_GRUPOS.map((banco) => {
      const pagosBanco = amortizaciones.filter(a => banco.metodos.includes(a.metodo_pago));
      const totalBanco = pagosBanco.reduce((sum, a) => sum + (parseFloat(String(a.monto)) || 0), 0);
      const pct = totalIngresos > 0 ? (totalBanco / totalIngresos) * 100 : 0;
      const ultimoPago = pagosBanco.sort((a, b) => new Date(b.fecha_pago).getTime() - new Date(a.fecha_pago).getTime())[0];
      return { ...banco, total: totalBanco, pct, ultimoPago, count: pagosBanco.length };
    }).filter(b => b.total > 0 || amortizaciones.length === 0);
  }, [amortizaciones, totalIngresos]);

  if (amortizaciones.length === 0) return null;

  return (
    <div className="space-y-6 select-none">
      {/* 1. GRÁFICA DE BALANCE DE RETORNO */}
      <Card variant="bento">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 gap-3 text-xs">
          <div>
            <span className="badge-success mb-2 w-fit">Retorno</span>
            <h3 className="font-black text-slate-800 text-base tracking-tight">Visualizador de cartera y retorno</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
               Dinero amortizado frente a saldo restante
            </p>
          </div>
          <div className="font-mono text-right text-[11px] md:text-xs bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
            <span className="text-emerald-700 font-black">{recoveryRate.toFixed(1)}%</span> Cobrado ·{" "}
            <span className="text-indigo-650 font-black">{(100 - recoveryRate).toFixed(1)}%</span> Pendiente
          </div>
        </div>
        
        {/* Barra bicolor */}
        <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden p-1 border border-slate-200/80 flex relative shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700 ease-out rounded-full shadow-sm" 
            style={{ width: `${recoveryRate}%` }} 
          />
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700 ease-out rounded-full shadow-sm ml-1" 
            style={{ width: `calc(${100 - recoveryRate}% - 4px)` }} 
          />
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-500 mt-4 gap-2.5 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.5)] shrink-0" /> 
            Amortizado real: <strong className="text-slate-800 font-mono">{formatCurrency(totalIngresos)}</strong>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_6px_rgba(99,102,241,0.5)] shrink-0" /> 
            Saldo pendiente: <strong className="text-slate-800 font-mono">{formatCurrency(saldoPendiente)}</strong>
          </span>
        </div>
      </Card>

      {/* 2. DISTRIBUCIÓN POR ENTIDAD BANCARIA */}
      {bancoDist.some(b => b.total > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">Distribución por Entidad Bancaria</h2>
              <p className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mt-1.5">Saldo esperado por cuenta según pagos registrados</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <Building2 size={14} className="text-slate-500" />
              <span>{bancoDist.filter(b => b.total > 0).length} entidades activas</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {bancoDist.filter(b => b.total > 0).map((banco) => (
              <div
                key={banco.nombre}
                className={`bg-white border ${banco.borderClass} rounded-3xl p-5 relative overflow-hidden group hover:bg-slate-50/50 hover:shadow-md transition-all duration-300`}
              >
                {/* Barra lateral */}
                <div className={`absolute top-0 left-0 w-1 h-full ${banco.colorClass} opacity-80`} />

                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${banco.borderClass}`} style={{ background: 'rgba(0,0,0,0.01)' }}>
                    <Landmark size={14} className={banco.textClass} />
                  </div>
                  <span className={`text-[8.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${banco.badgeClass}`}>
                    {banco.count} pago{banco.count !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="mb-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">{banco.nombre}</span>
                  <span className={`text-xl font-black font-mono tracking-tight ${banco.textClass}`}>
                    {formatCurrency(banco.total)}
                  </span>
                </div>

                {/* Barra de proporción */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${banco.colorClass} rounded-full transition-all duration-700`}
                    style={{ width: `${Math.min(100, banco.pct)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[9px] font-extrabold ${banco.textClass}`}>{banco.pct.toFixed(1)}%</span>
                  {banco.ultimoPago && (
                    <span className="text-[8px] text-slate-500 font-bold">
                      Último: {new Date(`${banco.ultimoPago.fecha_pago}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>

                {/* Metodos */}
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {banco.metodos.map(m => (
                    <span key={m} className="text-[7px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Resumen total proporcional */}
          {totalIngresos > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-slate-550 uppercase tracking-widest flex items-center gap-1.5">
                  <Banknote size={12} className="text-emerald-700" />
                  Distribución total de ingresos
                </span>
                <span className="text-[11px] font-black text-slate-900 font-mono">{formatCurrency(totalIngresos)}</span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                {bancoDist.filter(b => b.total > 0).map((banco) => (
                  <div
                    key={banco.nombre}
                    title={`${banco.nombre}: ${formatCurrency(banco.total)} (${banco.pct.toFixed(1)}%)`}
                    className={`h-full ${banco.colorClass} rounded-full transition-all duration-700 cursor-default`}
                    style={{ width: `${banco.pct}%`, minWidth: banco.pct > 0 ? '4px' : '0' }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                {bancoDist.filter(b => b.total > 0).map((banco) => (
                  <span key={banco.nombre} className={`flex items-center gap-1.5 text-[9px] font-bold ${banco.textClass}`}>
                    <span className={`w-2 h-2 rounded-full ${banco.colorClass}`} />
                    {banco.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
