import React, { useMemo } from "react";
import {
  ShieldCheck, Shield, ShieldAlert, TrendingUp, DollarSign,
  TrendingDown, CheckCircle2, Clock
} from "lucide-react";
import { Cliente } from "../../types";
import { Card } from "../ui/Card";
import { formatCurrency } from "../../lib/formatters";

interface ClientFinancialSummaryProps {
  cliente: Cliente;
}

export const ClientFinancialSummary: React.FC<ClientFinancialSummaryProps> = ({ cliente }) => {
  const activeLoans = cliente.prestamos_activos || 0;
  const totalLoans = cliente.total_prestamos || 0;
  const historicalLoans = Math.max(0, totalLoans - activeLoans);
  const exigible = Number(cliente.total_exigible) || 0;
  const amortizado = Number(cliente.total_amortizado) || 0;
  const outstanding = Math.max(0, exigible - amortizado);

  // Compute stats
  const payPercentage = useMemo(() => {
    if (exigible <= 0) return 100;
    return Math.min(100, Math.round((amortizado / exigible) * 100));
  }, [exigible, amortizado]);

  const assessment = useMemo(() => {
    let level: "Excelente" | "Bajo" | "Medio" | "Alto";
    let score = 100;
    let color = "";
    let bg = "";
    let Icon = ShieldCheck;

    if (activeLoans > 1 || outstanding > 1500) {
      level = "Alto";
      score = activeLoans > 2 ? 25 : 45;
      color = "text-rose-400";
      bg = "bg-rose-500/10 border-rose-500/20";
      Icon = ShieldAlert;
    } else if (activeLoans === 1 || outstanding > 0) {
      level = "Medio";
      score = 70;
      color = "text-amber-400";
      bg = "bg-amber-500/10 border-amber-500/20";
      Icon = Shield;
    } else if (totalLoans > 0) {
      level = "Excelente";
      score = 98;
      color = "text-emerald-400";
      bg = "bg-emerald-500/10 border-emerald-500/20";
      Icon = ShieldCheck;
    } else {
      level = "Bajo";
      score = 90;
      color = "text-blue-400";
      bg = "bg-blue-500/10 border-blue-500/20";
      Icon = Shield;
    }

    return { level, score, color, bg, Icon };
  }, [activeLoans, totalLoans, outstanding]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Score de Confianza */}
      <Card variant="simple" className="flex flex-col justify-between p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-550 uppercase tracking-widest block">Índice de Confianza</span>
            <span className="text-2xl font-black text-white mt-1 block">Score {assessment.score}/100</span>
          </div>
          <div className={`w-10 h-10 rounded-xl ${assessment.bg} border flex items-center justify-center`}>
            <assessment.Icon size={18} className={assessment.color} />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div 
              className={`h-full rounded-full transition-all duration-700 ${
                assessment.level === "Excelente" ? "bg-emerald-500" :
                assessment.level === "Bajo" ? "bg-blue-550" :
                assessment.level === "Medio" ? "bg-amber-500" : "bg-rose-500"
              }`} 
              style={{ width: `${assessment.score}%` }} 
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-black text-slate-550 uppercase tracking-wider">
            <span>Riesgo {assessment.level}</span>
            <span>Historial: {totalLoans} Deudas</span>
          </div>
        </div>
      </Card>

      {/* Saldo deudor actual */}
      <Card variant="simple" className="flex flex-col justify-between p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-555 uppercase tracking-widest block">Saldo Pendiente</span>
            <span className="text-2xl font-black text-rose-400 font-mono mt-1 block">
              {formatCurrency(outstanding)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <TrendingUp size={18} className="text-rose-400" />
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
            <span>Proporción de Pago:</span>
            <span className="text-white font-bold">{payPercentage}%</span>
          </div>
          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${payPercentage}%` }} />
          </div>
        </div>
      </Card>

      {/* Resumen amortizado */}
      <Card variant="simple" className="flex flex-col justify-between p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-555 uppercase tracking-widest block">Historial Liquidado</span>
            <span className="text-2xl font-black text-emerald-450 font-mono mt-1 block">
              {formatCurrency(amortizado)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <TrendingDown size={18} className="text-emerald-400" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs font-semibold text-slate-400 select-none">
          <div className="flex items-center gap-1">
            <Clock size={12} className="text-indigo-400" />
            <span>{activeLoans} Activo{activeLoans !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-450" />
            <span>{historicalLoans} Cancelado{historicalLoans !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
