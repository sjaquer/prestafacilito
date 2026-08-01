import React from "react";
import { CheckCircle2, AlertTriangle, Clock, Calendar, ArrowRight, ShieldCheck, FileText } from "lucide-react";

export interface TimelinePagoItem {
  id: string;
  fecha: string;
  monto: number;
  aplicadoInteres: number;
  aplicadoCapital: number;
  metodo_pago: string;
  comprobante_url?: string | null;
}

export interface TimelineMesItem {
  numero: number;
  fechaVencimiento: string;
  capitalInicioMes: number;
  interesMes: number;
  cuotaEsperada: number;
  amortizacionCapital: number;
  pagosRecibidos: TimelinePagoItem[];
  totalPagado: number;
  capitalRestante: number;
  saldoPendienteCuota: number;
  estado: "Saldada" | "Parcial" | "Pendiente" | "Vencida";
  diasVencidos: number;
  congelada?: boolean;
}

interface TimelineDetallePrestamoProps {
  timeline: TimelineMesItem[];
  onVerVoucher?: (url: string) => void;
}

export const TimelineDetallePrestamo: React.FC<TimelineDetallePrestamoProps> = ({
  timeline,
  onVerVoucher
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          Cronograma de Amortización — Vista Cronológica
        </h3>
        <span className="text-xs text-slate-500 font-medium">Modelo Francés Adaptativo</span>
      </div>

      <div className="space-y-4">
        {timeline.map((mes) => {
          const isSaldada = mes.estado === "Saldada";
          const isParcial = mes.estado === "Parcial";
          const isVencida = mes.estado === "Vencida";
          const isPendiente = mes.estado === "Pendiente";

          return (
            <div
              key={mes.numero}
              className={`p-4 rounded-2xl border-l-4 border transition-all space-y-3 ${
                isSaldada
                  ? "border-l-emerald-500 border-slate-200 bg-emerald-50/20"
                  : isParcial
                  ? "border-l-amber-500 border-amber-200 bg-amber-50/20"
                  : isVencida
                  ? "border-l-red-500 border-red-200 bg-red-50/30"
                  : "border-l-slate-400 border-slate-200 bg-slate-50/40"
              }`}
            >
              {/* Encabezado del Mes */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    MES {mes.numero} — Cuota {mes.numero}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Vence: {mes.fechaVencimiento}
                  </span>
                  {mes.congelada && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Interés Congelado
                    </span>
                  )}
                </div>

                {/* Badge de Estado */}
                <div>
                  {isSaldada && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> SALDADA
                    </span>
                  )}
                  {isParcial && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold">
                      <Clock className="w-3.5 h-3.5" /> PARCIAL
                    </span>
                  )}
                  {isVencida && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-800 border border-red-200 rounded-lg text-xs font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" /> VENCIDA ({mes.diasVencidos}d)
                    </span>
                  )}
                  {isPendiente && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold">
                      <Clock className="w-3.5 h-3.5" /> PENDIENTE
                    </span>
                  )}
                </div>
              </div>

              {/* Fila de Datos del Mes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-white border border-slate-200/70 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Capital Inicio Mes</span>
                  <span className="font-semibold text-slate-800">S/ {mes.capitalInicioMes.toFixed(2)}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Interés del Mes</span>
                  <span className="font-semibold text-amber-600">S/ {mes.interesMes.toFixed(2)}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Amortización Capital</span>
                  <span className="font-semibold text-emerald-600">S/ {mes.amortizacionCapital.toFixed(2)}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Cuota Esperada</span>
                  <span className="font-bold text-slate-900">S/ {mes.cuotaEsperada.toFixed(2)}</span>
                </div>
              </div>

              {/* Desglose Explícito de Pagos Recibidos en este Mes */}
              {mes.pagosRecibidos && mes.pagosRecibidos.length > 0 ? (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    Pagos Registrados para esta Cuota:
                  </span>
                  <div className="space-y-1.5">
                    {mes.pagosRecibidos.map((pago) => (
                      <div
                        key={pago.id}
                        className="p-2.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-800">✅ S/ {pago.monto.toFixed(2)}</span>
                          <span className="text-slate-500 font-medium">({pago.fecha})</span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-600">
                            {pago.metodo_pago}
                          </span>
                        </div>

                        {/* Desglose Explícito de Interés vs Capital */}
                        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-700">
                          <span className="text-amber-700">
                            Interés: <span className="font-bold">S/ {pago.aplicadoInteres.toFixed(2)}</span>
                          </span>
                          <span className="text-emerald-700">
                            Capital: <span className="font-bold">S/ {pago.aplicadoCapital.toFixed(2)}</span>
                          </span>

                          {pago.comprobante_url && onVerVoucher && (
                            <button
                              type="button"
                              onClick={() => onVerVoucher(pago.comprobante_url!)}
                              className="p-1 text-slate-500 hover:text-indigo-600 transition-colors"
                              title="Ver Comprobante"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-100/50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sin pagos registrados en esta cuota.</span>
                </div>
              )}

              {/* Fila de Cierre del Mes */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs font-medium text-slate-700">
                <div className="flex items-center gap-1.5">
                  <span>Capital Restante tras esta cuota:</span>
                  <span className="font-bold text-slate-900">S/ {mes.capitalRestante.toFixed(2)}</span>
                </div>

                {mes.saldoPendienteCuota > 0 && (
                  <div className="text-amber-700 font-semibold flex items-center gap-1">
                    <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                    <span>Faltan S/ {mes.saldoPendienteCuota.toFixed(2)} para completar la cuota</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
