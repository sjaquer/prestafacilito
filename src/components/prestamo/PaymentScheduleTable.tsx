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
          <>
            {isAlquiler ? (
              /* CARD VIEW FOR RENTALS (BOTH DESKTOP & MOBILE) */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {displayedCuotas.map((cuota) => {
                  const isVencida = cuota.estado === "Vencida";
                  const isCongelada = cuota.congelada;
                  const isSaldada = cuota.estado === "Saldada";
                  const isParcial = cuota.estado === "Parcial";
                  const totalProgramado = (cuota.interesOriginal || 0) + (cuota.moraOriginal || 0);
                  const totalPagado = cuota.pagado + (cuota.capitalAmortizado || 0);

                  return (
                    <div 
                      key={cuota.numero}
                      className={`relative overflow-hidden bg-white border rounded-3xl p-5 space-y-4 transition-all duration-300 hover:shadow-md hover:border-slate-350 select-none ${
                        isVencida 
                          ? "border-red-300 bg-red-500/[0.015] hover:bg-red-500/[0.025]" 
                          : isSaldada
                            ? "border-slate-200 bg-slate-50/40"
                            : "border-slate-200 hover:border-slate-350"
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
                                Alquiler
                              </span>
                              <span className="text-[9px] text-slate-300 font-bold">•</span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                Mes {cuota.numero}
                              </span>
                            </div>
                            <h4 className="text-xs font-black text-slate-850 tracking-tight leading-tight">
                              Mensualidad Arrendamiento
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
                            <span className="text-slate-850 font-mono font-bold mt-0.5">
                              {formatDateShort(cuota.fechaVencimiento)}
                            </span>
                          </div>

                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black font-sans">Mensualidad</span>
                            <span className="text-slate-850 font-mono font-bold mt-0.5">
                              {isCongelada ? (
                                <span className="text-emerald-600 font-black uppercase text-[10px]">Congelado</span>
                              ) : (
                                formatCurrency(cuota.interesOriginal || 0)
                              )}
                            </span>
                          </div>

                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black font-sans">Mora Generada</span>
                            <span className="text-slate-850 font-mono mt-0.5">
                              {cuota.moraOriginal > 0 ? (
                                <span className={cuota.moraPendiente === 0 ? "text-slate-500 font-semibold" : "text-rose-650 font-bold"}>
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

                        {/* Footer Totals (Pagado & Saldo Pendiente) */}
                        <div className="pt-3 border-t border-slate-100 flex justify-between items-end gap-2">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black font-sans">Total Pagado</span>
                            <span className="text-emerald-650 font-mono font-black text-sm mt-0.5">
                              {formatCurrency(totalPagado)}
                            </span>
                            {(cuota.interesPagado > 0 || cuota.moraPagado > 0) && (
                              <div className="flex flex-col text-[8.5px] text-slate-500 font-semibold mt-1 space-y-0.5 leading-none">
                                {cuota.interesPagado > 0 && (
                                  <span>{formatCurrency(cuota.interesPagado)} Alq.</span>
                                )}
                                {cuota.moraPagado > 0 && (
                                  <span>{formatCurrency(cuota.moraPagado)} Mora</span>
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
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TRADITIONAL CREDIT VIEW: TABLE FOR DESKTOP, CARDS FOR MOBILE */
              <>
                {/* DESKTOP TABLE */}
                <div className="hidden md:block table-scroll-x rounded-2xl border border-slate-150 overflow-hidden">
                  <table className="w-full text-left border-collapse data-table font-sans">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 select-none">
                        <th className="px-4 py-3">N° Mes</th>
                        <th className="px-4 py-3">Vencimiento</th>
                        <th className="px-4 py-3">{isAlquiler ? "Mensualidad" : "Interés Esperado"}</th>
                        <th className="px-4 py-3">Mora Generada</th>
                        <th className="px-4 py-3">Total Programado</th>
                        <th className="px-4 py-3">Total Pagado</th>
                        <th className="px-4 py-3">Saldo Restante</th>
                        <th className="px-4 py-3">Estado Plazo</th>
                        {loanState === "activo" && !isAlquiler && (
                          <th className="sticky right-0 px-4 py-3 bg-slate-50 border-l border-slate-200 z-10 w-12 shadow-[-8px_0_15px_-5px_rgba(0,0,0,0.05)] text-center">
                            <span className="sr-only">Ajuste</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-xs md:text-sm font-medium">
                      {displayedCuotas.map((cuota) => {
                        const isVencida = cuota.estado === "Vencida";
                        const isCongelada = cuota.congelada;
                        
                        return (
                          <tr 
                            key={cuota.numero} 
                            className={`transition duration-150 group hover:bg-slate-50/80 ${
                              isVencida ? "bg-red-500/[0.015] hover:bg-red-500/[0.03]" : ""
                            }`}
                          >
                            <td className="px-4 py-3 text-slate-400 font-bold text-center">
                              {cuota.numero}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-800 font-semibold">
                              {formatDateShort(cuota.fechaVencimiento)}
                            </td>
                            
                            {/* Interés esperado (con tachado si está congelado) */}
                            <td className="px-4 py-3 font-mono text-slate-800">
                              {isCongelada ? (
                                <div className="flex flex-col">
                                  <span className="line-through text-slate-400 text-[11px]">
                                    {formatCurrency(cuota.interesOriginal || 0)}
                                  </span>
                                  <span className="text-emerald-600 text-xs font-black uppercase">
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
                                  <span className={cuota.moraPendiente === 0 ? "text-slate-500 font-semibold" : "text-red-600 font-extrabold"}>
                                    {formatCurrency(cuota.moraOriginal)}
                                  </span>
                                  {cuota.moraPendiente > 0 ? (
                                    <span className="text-[9px] text-red-500 font-bold">
                                      {formatCurrency(cuota.moraPendiente)} pend.
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-emerald-600 font-bold uppercase">
                                      Saldada
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">S/. 0.00</span>
                              )}
                            </td>

                            {/* Total programado */}
                            <td className="px-4 py-3 font-mono text-slate-700 font-semibold">
                              {formatCurrency((cuota.interesOriginal || 0) + (cuota.moraOriginal || 0))}
                            </td>

                            {/* Total pagado desglosado (con interés, mora y capital) */}
                            <td className="px-4 py-3 font-mono">
                              {cuota.pagado > 0 || cuota.capitalAmortizado > 0 ? (
                                <div className="flex flex-col">
                                  <span className="text-emerald-650 font-extrabold">
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
                                      <span className="text-blue-600 font-bold">+{formatCurrency(cuota.capitalAmortizado)} Cap.</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">S/. 0.00</span>
                              )}
                            </td>

                            {/* Saldo restante */}
                            <td className="px-4 py-3 font-mono text-slate-900 font-extrabold">
                              {cuota.saldoPendiente > 0 ? (
                                <span className="text-slate-900">{formatCurrency(cuota.saldoPendiente)}</span>
                              ) : (
                                <span className="text-slate-400">S/. 0.00</span>
                              )}
                            </td>

                            {/* Estado */}
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider text-[9px] border ${
                                cuota.estado === "Saldada" 
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                                  : cuota.estado === "Vencida" 
                                    ? "bg-red-50 border-red-200 text-red-650 animate-pulse" 
                                    : cuota.estado === "Parcial"
                                      ? "bg-amber-50 border-amber-250 text-amber-700"
                                      : "bg-slate-100 border-slate-200 text-slate-600"
                              }`}>
                                {cuota.estado === "Saldada" ? "Saldada" : cuota.estado === "Vencida" ? "Vencida" : cuota.estado === "Parcial" ? "Parcial" : "Pendiente"}
                              </span>
                            </td>

                            {/* Ajuste rápido sticky */}
                            {loanState === "activo" && !isAlquiler && (
                              <td className="sticky right-0 px-2 py-3 bg-white group-hover:bg-slate-50 border-l border-slate-100 z-10 text-center shadow-[-8px_0_15px_-5px_rgba(0,0,0,0.02)]">
                                {cuota.estado !== "Saldada" && (
                                  <button
                                    onClick={() => onQuickAjuste(cuota.numero)}
                                    className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-600 transition duration-150 cursor-pointer border-none flex items-center justify-center mx-auto"
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
                        className={`bg-white border rounded-2xl p-4 space-y-3.5 transition duration-150 shadow-sm ${
                          isVencida ? "border-red-200 bg-red-50/10" : "border-slate-200"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-indigo-700">
                            {isAlquiler ? `MENSUALIDAD N° ${cuota.numero}` : `CUOTA N° ${cuota.numero}`}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider text-[9px] border ${
                            cuota.estado === "Saldada" 
                              ? "bg-emerald-50 border-emerald-250 text-emerald-700" 
                              : cuota.estado === "Vencida" 
                                ? "bg-red-50 border-red-200 text-red-650" 
                                : cuota.estado === "Parcial"
                                  ? "bg-amber-50 border-amber-250 text-amber-700"
                                  : "bg-slate-100 border-slate-200 text-slate-600"
                          }`}>
                            {cuota.estado === "Saldada" ? "Saldada" : cuota.estado === "Vencida" ? "Vencida" : cuota.estado === "Parcial" ? "Parcial" : "Pendiente"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-y-2.5 text-xs font-medium">
                          <div className="flex flex-col">
                            <span className="text-slate-400 text-[10px] uppercase tracking-wide">Vencimiento</span>
                            <span className="text-slate-800 mt-0.5 font-mono font-semibold">{formatDateShort(cuota.fechaVencimiento)}</span>
                          </div>
                          
                          <div className="flex flex-col">
                            <span className="text-slate-400 text-[10px] uppercase tracking-wide">
                              {isAlquiler ? "Mensualidad" : "Interés"}
                            </span>
                            <span className="text-slate-800 mt-0.5 font-mono font-semibold">
                              {isCongelada ? (
                                <span className="text-emerald-600 font-black uppercase text-[10px]">Congelado</span>
                              ) : (
                                formatCurrency(cuota.interesOriginal || 0)
                              )}
                            </span>
                          </div>

                          <div className="flex flex-col">
                            <span className="text-slate-400 text-[10px] uppercase tracking-wide">Mora Generada</span>
                            <span className="text-slate-800 mt-0.5 font-mono font-semibold">
                              {cuota.moraOriginal > 0 ? (
                                <span className={cuota.moraPendiente === 0 ? "text-slate-500 font-semibold" : "text-red-600 font-bold"}>
                                  {formatCurrency(cuota.moraOriginal)}
                                  {cuota.moraPendiente > 0 && ` (${formatCurrency(cuota.moraPendiente)} pend.)`}
                                </span>
                              ) : (
                                <span className="text-slate-450">S/. 0.00</span>
                              )}
                            </span>
                          </div>

                          <div className="flex flex-col">
                            <span className="text-slate-400 text-[10px] uppercase tracking-wide">Total Programado</span>
                            <span className="text-slate-700 mt-0.5 font-mono font-semibold">
                              {formatCurrency((cuota.interesOriginal || 0) + (cuota.moraOriginal || 0))}
                            </span>
                          </div>

                          <div className="flex flex-row justify-between items-start col-span-2 pt-2.5 border-t border-slate-100">
                            <div className="flex flex-col">
                              <span className="text-slate-400 text-[10px] uppercase tracking-wide">Total Pagado</span>
                              <span className="text-emerald-650 font-mono font-black mt-0.5">
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
                                  <span className="text-blue-600 font-bold">+{formatCurrency(cuota.capitalAmortizado)} Cap.</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end">
                              <span className="text-slate-400 text-[10px] uppercase tracking-wide">Saldo Pendiente</span>
                              <span className="text-slate-900 text-sm font-black font-mono mt-0.5">
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
                                className="w-full h-11 font-bold border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 flex items-center justify-center gap-1.5"
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
              </>
            )}
          </>
        )}
      </div>

    </Card>
  );
};
