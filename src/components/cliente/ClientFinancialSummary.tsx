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
      {/* Progreso de Pago (Reemplaza Score de Confianza / Score Map) */}
      <Card variant="simple" className="flex flex-col justify-between p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-550 uppercase tracking-widest block">Progreso de Pago</span>
            <span className="text-2xl font-black text-white mt-1 block">{payPercentage}%</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <CheckCircle2 size={18} className="text-indigo-400" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full rounded-full transition-all duration-700 bg-indigo-500" 
              style={{ width: `${payPercentage}%` }} 
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-black text-slate-550 uppercase tracking-wider">
            <span>Amortizado vs Exigible</span>
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

        <div className="mt-4 flex items-center gap-1 text-[10px] font-black text-slate-550 uppercase tracking-wider select-none">
          <Clock size={11} className="text-rose-400 shrink-0" />
          <span>{activeLoans} Crédito{activeLoans !== 1 ? "s" : ""} Activo{activeLoans !== 1 ? "s" : ""}</span>
        </div>
      </Card>

      {/* Resumen amortizado */}
      <Card variant="simple" className="flex flex-col justify-between p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-555 uppercase tracking-widest block">Total Liquidado</span>
            <span className="text-2xl font-black text-emerald-450 font-mono mt-1 block">
              {formatCurrency(amortizado)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <TrendingDown size={18} className="text-emerald-400" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-1 text-[10px] font-black text-slate-550 uppercase tracking-wider select-none">
          <CheckCircle2 size={11} className="text-emerald-450 shrink-0" />
          <span>{historicalLoans} Crédito{historicalLoans !== 1 ? "s" : ""} Finalizado{historicalLoans !== 1 ? "s" : ""}</span>
        </div>
      </Card>
    </div>
  );
};
