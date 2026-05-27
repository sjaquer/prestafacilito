import React, { useState } from "react";
import { Scissors, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Tooltip } from "../ui/Tooltip";
import { formatCurrency, formatDateShort } from "../../lib/formatters";
import { CuotaPrestamo } from "../../types";

interface PaymentScheduleTableProps {
  cuotas: CuotaPrestamo[];
  onQuickAjuste: (cuotaNumero: number) => void;
  loanState: "activo" | "pagado";
}

export const PaymentScheduleTable: React.FC<PaymentScheduleTableProps> = ({
  cuotas,
  onQuickAjuste,
  loanState,
}) => {
  const [showPaid, setShowPaid] = useState(false);

  // Filtrar cuotas saldadas si se ocultan
  const displayedCuotas = showPaid 
    ? cuotas 
    : cuotas.filter(c => c.estado !== "Saldada");

  const cuotasSaldadasCount = cuotas.filter(c => c.estado === "Saldada").length;

  return (
    <Card variant="simple" className="flex flex-col select-none font-sans">
      
      {/* Header con toggle de cuotas pagadas */}
      <div className="p-1 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="font-black text-white text-base tracking-tight leading-none">Cronograma de Pagos</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
            Calendario de cuotas mensuales amortizables en el tiempo
          </p>
        </div>

        {cuotasSaldadasCount > 0 && (
          <button
            onClick={() => setShowPaid(!showPaid)}
            className="text-[10px] font-black uppercase tracking-widest px-3.5 py-2 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 text-slate-300 hover:text-white transition duration-150 cursor-pointer"
          >
            {showPaid ? "Ocultar Cuotas Saldadas" : `Mostrar Cuotas Saldadas (${cuotasSaldadasCount})`}
          </button>
        )}
      </div>

      <div className="mt-5">
        {displayedCuotas.length === 0 ? (
          <div className="text-center py-16 text-slate-500 font-bold text-sm">
            Todas las cuotas de este crédito se encuentran saldadas. 🎉
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block table-scroll-x">
              <table className="w-full text-left border-collapse data-table font-sans">
                <thead>
                  <tr className="bg-white/2 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 select-none">
                    <th className="px-4 py-3">N° Cuota</th>
                    <th className="px-4 py-3">Vencimiento</th>
                    <th className="px-4 py-3">Interés Esperado</th>
                    <th className="px-4 py-3">Mora Acumulada</th>
                    <th className="px-4 py-3">Total Exigible</th>
                    <th className="px-4 py-3">Total Pagado</th>
                    <th className="px-4 py-3">Saldo Restante</th>
                    <th className="px-4 py-3">Estado Plazo</th>
                    {loanState === "activo" && <th className="px-4 py-3 text-right">Ajuste</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300 text-xs md:text-sm font-semibold">
                  {displayedCuotas.map((cuota) => {
                    const isVencida = cuota.estado === "Vencida";
                    const isCongelada = cuota.congelada;
                    const hasMora = cuota.moraPendiente > 0;
                    
                    return (
                      <tr 
                        key={cuota.numero} 
                        className={`transition duration-150 hover:bg-white/[0.015] ${
                          isVencida ? "bg-rose-500/[0.01] hover:bg-rose-500/[0.02]" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-400 font-bold text-center">
                          {cuota.numero}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {formatDateShort(cuota.fechaVencimiento)}
                        </td>
                        
                        {/* Interés esperado (con tachado si está congelado) */}
                        <td className="px-4 py-3 font-mono">
                          {isCongelada ? (
                            <div className="flex flex-col">
                              <span className="line-through text-slate-500 text-[11px]">
                                {formatCurrency(cuota.interesOriginal || 0)}
                              </span>
                              <span className="text-emerald-400 text-xs font-black uppercase">
                                Congelado
                              </span>
                            </div>
                          ) : (
                            <span>{formatCurrency(cuota.interesOriginal || 0)}</span>
                          )}
                        </td>

                        {/* Mora acumulada */}
                        <td className="px-4 py-3 font-mono">
                          {hasMora ? (
                            <span className="text-rose-400 font-extrabold">
                              {formatCurrency(cuota.moraPendiente)}
                            </span>
                          ) : (
                            <span className="text-slate-500">S/. 0.00</span>
                          )}
                        </td>

                        {/* Total exigible */}
                        <td className="px-4 py-3 font-mono text-white font-extrabold">
                          {formatCurrency(cuota.montoExigible)}
                        </td>

                        {/* Total pagado */}
                        <td className="px-4 py-3 font-mono text-emerald-450">
                          {cuota.pagado > 0 ? (
                            <span>{formatCurrency(cuota.pagado)}</span>
                          ) : (
                            <span className="text-slate-500">S/. 0.00</span>
                          )}
                        </td>

                        {/* Saldo restante */}
                        <td className="px-4 py-3 font-mono text-white font-extrabold">
                          {formatCurrency(cuota.saldoPendiente)}
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider text-[9px] border ${
                            cuota.estado === "Saldada" 
                              ? "bg-slate-700/10 border-slate-700/15 text-slate-400" 
                              : cuota.estado === "Vencida" 
                                ? "bg-rose-500/10 border-rose-500/20 text-rose-350 animate-pulse" 
                                : cuota.estado === "Parcial"
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                  : "bg-white/5 border-white/8 text-slate-300"
                          }`}>
                            {cuota.estado === "Saldada" ? "Saldada" : cuota.estado === "Vencida" ? "Vencida" : cuota.estado === "Parcial" ? "Parcial" : "Pendiente"}
                          </span>
                        </td>

                        {/* Ajuste rápido */}
                        {loanState === "activo" && (
                          <td className="px-4 py-3 text-right">
                            {cuota.estado !== "Saldada" && (
                              <button
                                onClick={() => onQuickAjuste(cuota.numero)}
                                className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/15 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition duration-150 cursor-pointer border-none"
                                title="Ajuste rápido: congelar interés de cuota"
                              >
                                <Scissors size={12} />
                              </button>
                            )}
                          </td>
                        )}

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE LIST VIEW */}
            <div className="md:hidden space-y-3.5">
              {displayedCuotas.map((cuota) => {
                const isVencida = cuota.estado === "Vencida";
                const isCongelada = cuota.congelada;
                const hasMora = cuota.moraPendiente > 0;

                return (
                  <div 
                    key={cuota.numero}
                    className={`bg-white/[0.015] border rounded-2xl p-4 space-y-3 transition duration-150 ${
                      isVencida ? "border-rose-500/20 bg-rose-500/[0.02]" : "border-white/5"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-indigo-455">
                        CUOTA N° {cuota.numero}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider text-[9px] border ${
                        cuota.estado === "Saldada" 
                          ? "bg-slate-700/10 border-slate-700/15 text-slate-400" 
                          : cuota.estado === "Vencida" 
                            ? "bg-rose-500/10 border-rose-500/20 text-rose-350" 
                            : cuota.estado === "Parcial"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                              : "bg-white/5 border-white/8 text-slate-300"
                      }`}>
                        {cuota.estado === "Saldada" ? "Saldada" : cuota.estado === "Vencida" ? "Vencida" : cuota.estado === "Parcial" ? "Parcial" : "Pendiente"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 text-xs font-semibold">
                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[10px] uppercase tracking-wide">Vencimiento</span>
                        <span className="text-white mt-0.5 font-mono">{formatDateShort(cuota.fechaVencimiento)}</span>
                      </div>
                      
                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[10px] uppercase tracking-wide">Interés</span>
                        <span className="text-white mt-0.5 font-mono">
                          {isCongelada ? (
                            <span className="text-emerald-400">Congelado</span>
                          ) : (
                            formatCurrency(cuota.interesOriginal || 0)
                          )}
                        </span>
                      </div>

                      {hasMora && (
                        <div className="flex flex-col">
                          <span className="text-rose-500 text-[10px] uppercase tracking-wide">Mora</span>
                          <span className="text-rose-400 mt-0.5 font-mono font-extrabold">{formatCurrency(cuota.moraPendiente)}</span>
                        </div>
                      )}

                      <div className="flex flex-col col-span-2 pt-2 border-t border-white/5 flex flex-row justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-slate-500 text-[10px] uppercase tracking-wide">Saldo Pendiente</span>
                          <span className="text-white text-sm font-black font-mono mt-0.5">{formatCurrency(cuota.saldoPendiente)}</span>
                        </div>
                        {loanState === "activo" && cuota.estado !== "Saldada" && (
                          <Button
                            onClick={() => onQuickAjuste(cuota.numero)}
                            variant="secondary"
                            size="sm"
                            icon={<Scissors size={11} />}
                          >
                            Congelar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

    </Card>
  );
};
