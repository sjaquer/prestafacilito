import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { formatCurrency, formatDateShort } from "../../lib/formatters";

const ESTADO_CUOTA_BADGE: Record<string, string> = {
  Saldada: "bg-emerald-50 border-emerald-200 text-emerald-700",
  Vencida: "bg-rose-50 border-rose-200 text-rose-700",
  SinPago: "bg-rose-50 border-rose-200 text-rose-700",
  Parcial: "bg-amber-50 border-amber-200 text-amber-700",
  PagoIncompleto: "bg-amber-50 border-amber-200 text-amber-700",
};

const Resumen: React.FC<{ label: string; value: string; valueClass: string }> = ({ label, value, valueClass }) => (
  <div className="space-y-0.5">
    <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">{label}</span>
    <span className={`font-black text-xs ${valueClass}`}>{value}</span>
  </div>
);

interface PrestamoCronogramaModalProps {
  pago: any | null;
  onClose: () => void;
}

/** Modal con el cronograma del préstamo al que pertenece un pago, resaltando dicho pago. */
export const PrestamoCronogramaModal: React.FC<PrestamoCronogramaModalProps> = ({ pago, onClose }) => {
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!pago) return;
    let cancelled = false;
    setDetails(null);
    setError(false);
    setLoading(true);
    fetch(`/api/prestamos/${pago.prestamo_id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => !cancelled && setDetails(data))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [pago]);

  return (
    <Modal isOpen={!!pago} onClose={onClose} title={`Detalle de Préstamo - ${pago?.cliente_nombre ?? ""}`} size="lg">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="animate-spin text-indigo-500 mb-3" size={28} />
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cargando cronograma...</p>
        </div>
      ) : details && !error ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 rounded-3xl p-5 border border-slate-100">
            <Resumen label="Tipo" value={details.prestamo.tipo_prestamo} valueClass="text-slate-800 font-extrabold" />
            <Resumen label="Capital" value={formatCurrency(details.prestamo.monto_capital)} valueClass="text-slate-800 font-mono" />
            <Resumen label="Total Pagado" value={formatCurrency(details.prestamo.total_pagado)} valueClass="text-emerald-700 font-mono" />
            <Resumen label="Saldo Pendiente" value={formatCurrency(details.prestamo.saldo_pendiente)} valueClass="text-rose-700 font-mono" />
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest pl-1">Cronograma de Pagos</h4>
            <div className="border border-slate-100 rounded-3xl overflow-auto bg-white max-h-[300px]">
              <table className="w-full border-collapse text-left text-xs font-semibold">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 select-none">
                    <th className="px-4 py-3 text-center">Nº</th>
                    <th className="px-4 py-3">Vencimiento</th>
                    <th className="px-4 py-3 text-right">Cuota Base</th>
                    <th className="px-4 py-3 text-right">Mora</th>
                    <th className="px-4 py-3 text-right">Pagado</th>
                    <th className="px-4 py-3 text-right">Saldo</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(details.cuotas || []).map((cuota: any) => (
                    <tr key={cuota.numero} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-2.5 text-center font-bold text-slate-400">{cuota.numero}</td>
                      <td className="px-4 py-2.5 font-bold font-mono text-slate-800">{formatDateShort(cuota.fechaVencimiento)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">{formatCurrency(cuota.montoCuotaBase)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-600">{formatCurrency(cuota.moraPendiente)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-black text-emerald-700">{formatCurrency(cuota.pagado)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-black text-slate-900">{formatCurrency(cuota.saldoPendiente)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full border font-black text-[9px] uppercase tracking-wider ${
                            ESTADO_CUOTA_BADGE[cuota.estado] || "bg-slate-100 border-slate-200 text-slate-600"
                          }`}
                        >
                          {cuota.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest pl-1">Pagos Registrados</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto">
              {(details.pagosRealizados || []).map((p: any) => {
                const isCurrent = p.id === pago?.id;
                return (
                  <div
                    key={p.id}
                    className={`border rounded-2xl p-3 flex justify-between items-center transition ${
                      isCurrent ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/10 shadow-sm" : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-800">{formatDateShort(p.fecha_pago)}</span>
                        {isCurrent && (
                          <span className="bg-indigo-650 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                            Este Pago
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold block uppercase">{p.metodo_pago}</span>
                    </div>
                    <span className={`font-mono font-black text-xs ${isCurrent ? "text-indigo-700" : "text-slate-800"}`}>
                      {formatCurrency(p.monto)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-slate-400">
          <p className="text-xs">No se pudieron cargar los datos del préstamo.</p>
        </div>
      )}
    </Modal>
  );
};
