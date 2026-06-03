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
  loanType?: string;
}

export const PaymentScheduleTable: React.FC<PaymentScheduleTableProps> = ({
  cuotas,
  onQuickAjuste,
  loanState,
  loanType,
}) => {
  const [showPaid, setShowPaid] = useState(true);
  const isAlquiler = loanType === "Alquiler de Casa";

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
          <h2 className="font-black text-white text-base tracking-tight leading-none">
            {isAlquiler ? "Calendario de Alquileres" : "Cronograma de Pagos"}
          </h2>
          <p className="text-[10px] text-slate-555 font-bold uppercase tracking-wider mt-1.5">
            {isAlquiler 
              ? "Registro de mensualidades vencidas y canceladas del contrato"
              : "Calendario de cuotas mensuales amortizables en el tiempo"
            }
          </p>
        </div>

        {cuotasSaldadasCount > 0 && (
          <button
            onClick={() => setShowPaid(!showPaid)}
            className="text-[10px] font-black uppercase tracking-widest px-3.5 py-2 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 text-slate-300 hover:text-white transition duration-150 cursor-pointer"
          >
            {showPaid 
              ? (isAlquiler ? "Ocultar Mensualidades Canceladas" : "Ocultar Cuotas Saldadas") 
              : (isAlquiler ? `Mostrar Mensualidades Canceladas (${cuotasSaldadasCount})` : `Mostrar Cuotas Saldadas (${cuotasSaldadasCount})`)
            }
          </button>
        )}
      </div>

      <div className="mt-5">
        {displayedCuotas.length === 0 ? (
          <div className="text-center py-16 text-slate-500 font-bold text-sm">
            {isAlquiler 
              ? "Todas las mensualidades de este contrato de alquiler se encuentran saldadas. 🎉"
              : "Todas las cuotas de este crédito se encuentran saldadas. 🎉"
            }
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block table-scroll-x">
              <table className="w-full text-left border-collapse data-table font-sans">
                <thead>
                  <tr className="bg-white/2 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 select-none">
                    <th className="px-4 py-3">N° Mes</th>
                    <th className="px-4 py-3">Vencimiento</th>
                    <th className="px-4 py-3">{isAlquiler ? "Mensualidad" : "Interés Esperado"}</th>
                    <th className="px-4 py-3">Mora Generada</th>
                    <th className="px-4 py-3">Total Programado</th>
                    <th className="px-4 py-3">Total Pagado</th>
                    <th className="px-4 py-3">Saldo Restante</th>
                    <th className="px-4 py-3">Estado Plazo</th>
                    {loanState === "activo" && !isAlquiler && <th className="px-4 py-3 text-right">Ajuste</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300 text-xs md:text-sm font-semibold">
                  {displayedCuotas.map((cuota) => {
                    const isVencida = cuota.estado === "Vencida";
                    const isCongelada = cuota.congelada;
                    
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
                              <span className="text-emerald-450 text-xs font-black uppercase">
                                Congelado
                              </span>
                            </div>
                          ) : (
                            <span>{formatCurrency(cuota.interesOriginal || 0)}</span>
                          )}
                        </td>

                        {/* Mora generada y su estado */}
                        <td className="px-4 py-3 font-mono">
                          {cuota.moraOriginal > 0 ? (
                            <div className="flex flex-col">
                              <span className={cuota.moraPendiente === 0 ? "text-slate-400 font-semibold" : "text-rose-400 font-extrabold"}>
                                {formatCurrency(cuota.moraOriginal)}
                              </span>
                              {cuota.moraPendiente > 0 ? (
                                <span className="text-[9px] text-rose-500/80 font-bold">
                                  {formatCurrency(cuota.moraPendiente)} pend.
                                </span>
                              ) : (
                                <span className="text-[9px] text-emerald-455 font-bold uppercase">
                                  Saldada
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500">S/. 0.00</span>
                          )}
                        </td>

                        {/* Total programado */}
                        <td className="px-4 py-3 font-mono text-slate-350 font-semibold">
                          {formatCurrency((cuota.interesOriginal || 0) + (cuota.moraOriginal || 0))}
                        </td>

                        {/* Total pagado desglosado (con interés, mora y capital) */}
                        <td className="px-4 py-3 font-mono">
                          {cuota.pagado > 0 || cuota.capitalAmortizado > 0 ? (
                            <div className="flex flex-col">
                              <span className="text-emerald-450 font-extrabold">
                                {formatCurrency(cuota.pagado + (cuota.capitalAmortizado || 0))}
                              </span>
                              <div className="flex flex-col text-[9px] text-slate-500 font-sans font-semibold mt-0.5 space-y-0.5">
                                {cuota.interesPagado > 0 && (
                                  <span>{formatCurrency(cuota.interesPagado)} Int.</span>
                                )}
                                {cuota.moraPagado > 0 && (
                                  <span>{formatCurrency(cuota.moraPagado)} Mora</span>
                                )}
                                {cuota.capitalAmortizado > 0 && (
                                  <span className="text-blue-400 font-bold">+{formatCurrency(cuota.capitalAmortizado)} Cap.</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-550">S/. 0.00</span>
                          )}
                        </td>

                        {/* Saldo restante */}
                        <td className="px-4 py-3 font-mono text-white font-extrabold">
                          {cuota.saldoPendiente > 0 ? (
                            <span className="text-white">{formatCurrency(cuota.saldoPendiente)}</span>
                          ) : (
                            <span className="text-slate-500">S/. 0.00</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider text-[9px] border ${
                            cuota.estado === "Saldada" 
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-450" 
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
                        {loanState === "activo" && !isAlquiler && (
                          <td className="px-4 py-3 text-right">
                            {cuota.estado !== "Saldada" && (
                              <button
                                onClick={() => onQuickAjuste(cuota.numero)}
                                className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/15 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition duration-150 cursor-pointer border-none"
                                title="Ajuste rápido: condonar interés de cuota"
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

                return (
                  <div 
                    key={cuota.numero}
                    className={`bg-white/[0.015] border rounded-2xl p-4 space-y-3 transition duration-150 ${
                      isVencida ? "border-rose-500/20 bg-rose-500/[0.02]" : "border-white/5"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-indigo-455">
                        {isAlquiler ? `MENSUALIDAD N° ${cuota.numero}` : `CUOTA N° ${cuota.numero}`}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider text-[9px] border ${
                        cuota.estado === "Saldada" 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-450" 
                          : cuota.estado === "Vencida" 
                            ? "bg-rose-500/10 border-rose-500/20 text-rose-350" 
                            : cuota.estado === "Parcial"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                              : "bg-white/5 border-white/8 text-slate-300"
                      }`}>
                        {cuota.estado === "Saldada" ? "Saldada" : cuota.estado === "Vencida" ? "Vencida" : cuota.estado === "Parcial" ? "Parcial" : "Pendiente"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2.5 text-xs font-semibold">
                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[10px] uppercase tracking-wide">Vencimiento</span>
                        <span className="text-white mt-0.5 font-mono">{formatDateShort(cuota.fechaVencimiento)}</span>
                      </div>
                      
                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[10px] uppercase tracking-wide">
                          {isAlquiler ? "Mensualidad" : "Interés"}
                        </span>
                        <span className="text-white mt-0.5 font-mono">
                          {isCongelada ? (
                            <span className="text-emerald-450 font-black uppercase text-[10px]">Congelado</span>
                          ) : (
                            formatCurrency(cuota.interesOriginal || 0)
                          )}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[10px] uppercase tracking-wide">Mora Generada</span>
                        <span className="text-white mt-0.5 font-mono">
                          {cuota.moraOriginal > 0 ? (
                            <span className={cuota.moraPendiente === 0 ? "text-slate-400 font-semibold" : "text-rose-450 font-bold"}>
                              {formatCurrency(cuota.moraOriginal)}
                              {cuota.moraPendiente > 0 && ` (${formatCurrency(cuota.moraPendiente)} pend.)`}
                            </span>
                          ) : (
                            <span className="text-slate-500">S/. 0.00</span>
                          )}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[10px] uppercase tracking-wide">Total Programado</span>
                        <span className="text-slate-355 mt-0.5 font-mono">
                          {formatCurrency((cuota.interesOriginal || 0) + (cuota.moraOriginal || 0))}
                        </span>
                      </div>

                      <div className="flex flex-col col-span-2 pt-2 border-t border-white/5 flex flex-row justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-slate-500 text-[10px] uppercase tracking-wide">Total Pagado</span>
                          <span className="text-emerald-450 font-mono font-extrabold mt-0.5">
                            {formatCurrency(cuota.pagado + (cuota.capitalAmortizado || 0))}
                          </span>
                          <div className="flex flex-col text-[9px] text-slate-500 font-sans font-semibold mt-1 space-y-0.5">
                            {cuota.interesPagado > 0 && (
                              <span>{formatCurrency(cuota.interesPagado)} Int.</span>
                            )}
                            {cuota.moraPagado > 0 && (
                              <span>{formatCurrency(cuota.moraPagado)} Mora</span>
                            )}
                            {cuota.capitalAmortizado > 0 && (
                              <span className="text-blue-400 font-bold">+{formatCurrency(cuota.capitalAmortizado)} Cap.</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-slate-500 text-[10px] uppercase tracking-wide">Saldo Pendiente</span>
                          <span className="text-white text-sm font-black font-mono mt-0.5">
                            {formatCurrency(cuota.saldoPendiente)}
                          </span>
                        </div>
                      </div>

                      {loanState === "activo" && cuota.estado !== "Saldada" && !isAlquiler && (
                        <div className="col-span-2 pt-1.5">
                          <Button
                            onClick={() => onQuickAjuste(cuota.numero)}
                            variant="secondary"
                            size="sm"
                            className="w-full h-8 font-bold border-none"
                            icon={<Scissors size={11} />}
                          >
                            Condonar Interés de Cuota
                          </Button>
                        </div>
                      )}
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
