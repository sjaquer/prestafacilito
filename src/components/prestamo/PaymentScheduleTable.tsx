import React, { useState } from "react";
import { Scissors } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
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
  // Ocultar por defecto las cuotas históricas ya pagadas en préstamos activos para limpiar la pantalla
  const [showPaid, setShowPaid] = useState(loanState !== "activo");
  const isAlquiler = loanType === "Alquiler de Casa";

  // Filtrar cuotas saldadas si se ocultan
  const displayedCuotas = showPaid 
    ? cuotas 
    : cuotas.filter(c => c.estado !== "Saldada");

  const cuotasSaldadasCount = cuotas.filter(c => c.estado === "Saldada").length;

  return (
    <Card variant="simple" className="flex flex-col select-none font-sans bg-white border border-slate-200 shadow-sm rounded-3xl p-5 md:p-6">
      
      {/* Header con toggle de cuotas pagadas */}
      <div className="p-1 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="font-black text-slate-900 text-base tracking-tight leading-none">
            {isAlquiler ? "Calendario de Alquileres" : "Cronograma de Pagos"}
          </h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
            {isAlquiler 
              ? "Registro de mensualidades vencidas y canceladas del contrato"
              : "Calendario de cuotas mensuales amortizables en el tiempo"
            }
          </p>
        </div>

        {cuotasSaldadasCount > 0 && (
          <button
            onClick={() => setShowPaid(!showPaid)}
            className="text-[10px] font-black uppercase tracking-widest px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 transition duration-150 cursor-pointer"
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
          <div className="text-center py-16 text-slate-400 font-bold text-sm">
            {isAlquiler 
              ? "Todas las mensualidades de este contrato de alquiler se encuentran saldadas. 🎉"
              : "Todas las cuotas de este crédito se encuentran saldadas. 🎉"
            }
          </div>
        ) : (
                /* CARD VIEW FOR ALL DEBTS (BOTH DESKTOP & MOBILE) */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {displayedCuotas.map((cuota) => {
                const isExpress = (cuota as any).expressLiquidacion;
                const isVencida = cuota.estado === "Vencida";
                const isCongelada = cuota.congelada;
                const isSaldada = cuota.estado === "Saldada";
                const isParcial = cuota.estado === "Parcial";
                const totalProgramado = (cuota.interesOriginal || 0) + (cuota.moraOriginal || 0);
                const totalPagado = cuota.pagado + (cuota.capitalAmortizado || 0);

                return (
                  <div 
                    key={cuota.numero}
                    className={`relative overflow-hidden bg-white border rounded-3xl p-5 space-y-4 transition-all duration-300 hover:shadow-md hover:border-slate-355 select-none ${
                      isVencida 
                        ? "border-red-300 bg-red-500/[0.015] hover:bg-red-500/[0.025]" 
                        : isSaldada
                          ? "border-slate-200 bg-slate-50/40"
                          : "border-slate-200 hover:border-slate-355"
                    }`}
                  >
                    {/* Left accent indicator line */}
                    <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                      isSaldada 
                        ? "bg-emerald-500" 
                        : isVencida 
                          ? "bg-rose-500 animate-pulse" 
                          : isParcial
                            ? "bg-amber-500"
                            : "bg-slate-300"
                    }`} />

                    <div className="pl-1.5 space-y-3.5">
                      {/* Header: Title and Status */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black text-indigo-650 tracking-wider uppercase">
                              {isAlquiler ? "Alquiler" : "Crédito"}
                            </span>
                            <span className="text-[9px] text-slate-300 font-bold">•</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                              {isAlquiler ? `Mes ${cuota.numero}` : `Cuota ${cuota.numero}`}
                            </span>
                          </div>
                          <h4 className="text-xs font-black text-slate-850 tracking-tight leading-tight">
                            {isAlquiler ? "Mensualidad Arrendamiento" : "Cuota de Crédito"}
                          </h4>
                        </div>

                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider text-[9px] border ${
                          isSaldada 
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                            : isVencida 
                              ? "bg-rose-50 border-rose-200 text-rose-650 animate-pulse" 
                              : isParcial
                                ? "bg-amber-50 border-amber-250 text-amber-700"
                                : "bg-slate-100 border-slate-200 text-slate-650"
                        }`}>
                          {cuota.estado === "Saldada" ? "Saldada" : cuota.estado === "Vencida" ? "Vencida" : cuota.estado === "Parcial" ? "Parcial" : "Pendiente"}
                        </span>
                      </div>

                      {/* Mid Grid Information */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-slate-100/90 text-xs font-bold text-slate-600">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black font-sans">Vencimiento</span>
                          <span className="text-slate-855 font-mono font-bold mt-0.5">
                            {formatDateShort(cuota.fechaVencimiento)}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black font-sans">
                            {isAlquiler ? "Mensualidad" : "Interés"}
                          </span>
                          <span className="text-slate-855 font-mono font-bold mt-0.5">
                            {isExpress ? (
                              <span className="text-amber-600 font-black uppercase text-[10px]">Exonerado (Express)</span>
                            ) : isCongelada ? (
                              <span className="text-emerald-600 font-black uppercase text-[10px]">Congelado</span>
                            ) : (
                              formatCurrency(cuota.interesOriginal || 0)
                            )}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black font-sans">Mora Generada</span>
                          <span className="text-slate-855 font-mono mt-0.5">
                            {cuota.moraOriginal > 0 ? (
                              <span className={cuota.moraPendiente === 0 ? "text-slate-500 font-semibold" : "text-rose-655 font-bold"}>
                                {formatCurrency(cuota.moraOriginal)}
                                {cuota.moraPendiente > 0 && (
                                  <span className="text-[9px] text-rose-500 font-bold block mt-0.5">
                                    ({formatCurrency(cuota.moraPendiente)} pend.)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">S/. 0.00</span>
                            )}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black font-sans">Prog. Total</span>
                          <span className="text-slate-700 font-mono font-bold mt-0.5">
                            {formatCurrency(totalProgramado)}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Totals (Pagado & Saldo Pendiente) */}
                      <div className="pt-3 border-t border-slate-100 flex justify-between items-end gap-2">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black font-sans">Total Pagado</span>
                          <span className="text-emerald-650 font-mono font-black text-sm mt-0.5">
                            {formatCurrency(totalPagado)}
                          </span>
                          {(cuota.interesPagado > 0 || cuota.moraPagado > 0 || cuota.capitalAmortizado > 0) && (
                            <div className="flex flex-col text-[8.5px] text-slate-500 font-semibold mt-1 space-y-0.5 leading-none">
                              {cuota.interesPagado > 0 && (
                                <span>{formatCurrency(cuota.interesPagado)} {isAlquiler ? "Alq." : "Int."}</span>
                              )}
                              {cuota.moraPagado > 0 && (
                                <span>{formatCurrency(cuota.moraPagado)} Mora</span>
                              )}
                              {cuota.capitalAmortizado > 0 && (
                                <span className="text-blue-600 font-bold">+{formatCurrency(cuota.capitalAmortizado)} Cap.</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black font-sans">Saldo Restante</span>
                          <span className={`text-base font-mono font-black mt-0.5 ${
                            cuota.saldoPendiente > 0 ? "text-indigo-950 font-extrabold" : "text-slate-400"
                          }`}>
                            {formatCurrency(cuota.saldoPendiente)}
                          </span>
                        </div>
                      </div>

                      {/* Condonar Interés button for credits */}
                      {loanState === "activo" && cuota.estado !== "Saldada" && !isAlquiler && (
                        <div className="pt-2 border-t border-slate-100/60">
                          <Button
                            onClick={() => onQuickAjuste(cuota.numero)}
                            variant="secondary"
                            size="sm"
                            className="w-full font-bold bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100/80 flex items-center justify-center gap-1.5"
                            icon={<Scissors size={12} />}
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
        )}
      </div>
    </Card>
  );
};
