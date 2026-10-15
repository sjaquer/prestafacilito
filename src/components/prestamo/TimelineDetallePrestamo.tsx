import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  FileText,
  Paperclip,
  Loader2,
  Snowflake,
  Info,
} from "lucide-react";
import { subirVoucher } from "../../lib/imageCompression";
import { formatCurrency, formatDate, resolveVoucherUrl } from "../../lib/formatters";
import { useFeedback } from "../ui/Feedback";

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
  estado: "Saldada" | "Parcial" | "Pendiente" | "Vencida" | "SinPago" | "PagoIncompleto";
  diasVencidos: number;
  congelada?: boolean;
}

interface TimelineDetallePrestamoProps {
  timeline: TimelineMesItem[];
  onVerVoucher: (url: string) => void;
  onVoucherAdjuntado?: () => void;
}

const ESTADO_UI: Record<
  TimelineMesItem["estado"],
  { label: string; dot: string; pill: string; Icon: React.ElementType }
> = {
  Saldada: { label: "Pagado", dot: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
  Parcial: { label: "Parcial", dot: "bg-amber-500", pill: "bg-amber-100 text-amber-800", Icon: AlertTriangle },
  PagoIncompleto: { label: "Incompleto", dot: "bg-amber-500", pill: "bg-amber-100 text-amber-800", Icon: AlertTriangle },
  SinPago: { label: "Sin pago", dot: "bg-rose-500", pill: "bg-rose-100 text-rose-800", Icon: AlertTriangle },
  Vencida: { label: "Vencida", dot: "bg-rose-500", pill: "bg-rose-100 text-rose-800", Icon: AlertTriangle },
  Pendiente: { label: "Por vencer", dot: "bg-slate-300", pill: "bg-slate-100 text-slate-700", Icon: Clock },
};

const Dato: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className = "text-slate-800" }) => (
  <div>
    <span className="text-[10px] text-slate-400 block font-semibold">{label}</span>
    <span className={`font-bold font-mono ${className}`}>{value}</span>
  </div>
);

export const TimelineDetallePrestamo: React.FC<TimelineDetallePrestamoProps> = ({
  timeline,
  onVerVoucher,
  onVoucherAdjuntado,
}) => {
  const { notify } = useFeedback();
  const [uploadingPagoId, setUploadingPagoId] = useState<string | null>(null);
  // Los meses ya pagados empiezan plegados; los pendientes o con problemas, abiertos
  const [abiertos, setAbiertos] = useState<Set<number>>(
    () => new Set(timeline.filter((m) => m.estado !== "Saldada").map((m) => m.numero))
  );

  const toggle = (numero: number) =>
    setAbiertos((prev) => {
      const next = new Set(prev);
      next.has(numero) ? next.delete(numero) : next.add(numero);
      return next;
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, pagoId: string) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setUploadingPagoId(pagoId);
    try {
      const { url, driveFileId } = await subirVoucher(file);
      const res = await fetch(`/api/amortizaciones/${pagoId}/voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comprobante_url: url, voucher_drive_file_id: driveFileId }),
      });
      if (!res.ok) throw new Error("El archivo se subió pero no se pudo vincular al pago");
      notify("Comprobante adjuntado", "success");
      onVoucherAdjuntado?.();
    } catch (err: any) {
      notify("Error al subir el comprobante: " + (err.message || "Error desconocido"));
    } finally {
      setUploadingPagoId(null);
      input.value = "";
    }
  };

  if (timeline.length === 0) {
    return <p className="text-xs text-slate-500 py-4 text-center">Aún no hay meses generados para este préstamo.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500 leading-relaxed flex gap-1.5 bg-slate-50 border border-slate-200/70 rounded-xl p-2.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
        <span>
          Cada mes se cobra interés sobre el capital pendiente. Cada abono cubre primero la mora, luego el interés del
          mes, y el resto reduce el capital.
        </span>
      </p>

      <ol className="relative space-y-2">
        {timeline.map((mes) => {
          const ui = ESTADO_UI[mes.estado] || ESTADO_UI.Pendiente;
          const abierto = abiertos.has(mes.numero);
          const etiquetaEstado = mes.estado === "Vencida" && mes.diasVencidos > 0 ? `Vencida ${mes.diasVencidos}d` : ui.label;

          return (
            <li key={mes.numero} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(mes.numero)}
                aria-expanded={abierto}
                className="w-full flex items-center gap-3 px-3.5 py-3 text-left bg-transparent border-none cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ui.dot}`} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                    Mes {mes.numero}
                    {mes.congelada && <Snowflake className="w-3.5 h-3.5 text-sky-500" aria-label="Interés congelado" />}
                  </span>
                  <span className="block text-[11px] text-slate-500 font-semibold">Vence {formatDate(mes.fechaVencimiento)}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-xs font-black font-mono text-slate-800">
                    {formatCurrency(mes.totalPagado)}
                    <span className="text-slate-400 font-bold"> / {formatCurrency(mes.cuotaEsperada)}</span>
                  </span>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${ui.pill}`}>
                    {etiquetaEstado}
                  </span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} />
              </button>

              {abierto && (
                <div className="px-3.5 pb-3.5 space-y-3 border-t border-slate-100 pt-3">
                  {mes.congelada && (
                    <p className="text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                      <Snowflake className="w-3.5 h-3.5" /> Interés congelado este mes: no se cobra interés.
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <Dato label="Capital al inicio" value={formatCurrency(mes.capitalInicioMes)} />
                    <Dato label="Interés del mes" value={formatCurrency(mes.interesMes)} className="text-amber-600" />
                    <Dato label="Mínimo del mes" value={formatCurrency(mes.cuotaEsperada)} className="text-slate-900" />
                    <Dato label="Abonado a capital" value={formatCurrency(mes.amortizacionCapital)} className="text-emerald-600" />
                  </div>

                  {mes.pagosRecibidos?.length > 0 ? (
                    <ul className="space-y-1.5">
                      {mes.pagosRecibidos.map((pago) => (
                        <li
                          key={pago.id}
                          className="p-2.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-emerald-800 font-mono">{formatCurrency(pago.monto)}</span>
                            <span className="text-[11px] text-slate-600 font-semibold truncate">
                              {formatDate(pago.fecha)} · {pago.metodo_pago}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold text-slate-600">
                              Interés <b className="text-amber-700">{formatCurrency(pago.aplicadoInteres)}</b> · Capital{" "}
                              <b className="text-emerald-700">{formatCurrency(pago.aplicadoCapital)}</b>
                            </span>
                            {pago.comprobante_url ? (
                              <button
                                type="button"
                                onClick={() => onVerVoucher(resolveVoucherUrl(pago.comprobante_url))}
                                className="px-2 py-1 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="w-3 h-3" /> Comprobante
                              </button>
                            ) : (
                              <label
                                className={`px-2 py-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                                  uploadingPagoId === pago.id ? "cursor-wait opacity-70" : "cursor-pointer"
                                }`}
                              >
                                {uploadingPagoId === pago.id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin text-indigo-600" /> Subiendo...
                                  </>
                                ) : (
                                  <>
                                    <Paperclip className="w-3 h-3 text-slate-400" /> Adjuntar
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  onChange={(e) => handleFileChange(e, pago.id)}
                                  className="hidden"
                                  disabled={uploadingPagoId === pago.id}
                                />
                              </label>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="p-2.5 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Sin pagos en este mes.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-600">
                    <span>
                      Capital tras este mes: <b className="text-slate-900 font-mono">{formatCurrency(mes.capitalRestante)}</b>
                    </span>
                    {mes.saldoPendienteCuota > 0 && (
                      <span className="text-amber-700 font-bold">
                        Faltan {formatCurrency(mes.saldoPendienteCuota)} para cubrir el mes
                      </span>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
