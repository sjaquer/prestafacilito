import React, { useMemo, useState } from "react";
import { DollarSign } from "lucide-react";
import { ImagePasteDropzone } from "../common/ImagePasteDropzone";
import { METODOS_PAGO } from "../../lib/constants";
import { subirVoucher } from "../../lib/imageCompression";
import { round2 } from "../../lib/loanLogic";

interface RegistrarPagoPrestamoFormProps {
  prestamoId: string;
  prestamo: any;
  resumen: any;
  deuda: any;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const inputClass =
  "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all";

/** Vista previa (solo informativa) de cómo se distribuye el abono: mora → interés → capital. */
const useDesglose = (montoPago: string, prestamo: any, resumen: any, deuda: any) =>
  useMemo(() => {
    const nMonto = round2(parseFloat(montoPago) || 0);
    if (nMonto <= 0 || !prestamo) return null;

    const capitalAntes = round2(resumen?.capitalRestante ?? prestamo.monto_capital ?? 0);
    const moraAntes = round2(resumen?.moraAcumulada ?? deuda?.moraAcumulada ?? 0);
    const interesAntes = round2(resumen?.interesPendiente ?? deuda?.interesPendiente ?? 0);

    let restante = nMonto;
    const cubiertoMora = round2(Math.min(moraAntes, restante));
    restante = round2(restante - cubiertoMora);
    const cubiertoInteres = round2(Math.min(interesAntes, restante));
    restante = round2(restante - cubiertoInteres);
    const cubiertoCapital = round2(Math.min(capitalAntes, restante));
    restante = round2(restante - cubiertoCapital);

    const cuotaMinima = round2(moraAntes + interesAntes);
    const esIncompleto = nMonto > 0 && nMonto < cuotaMinima - 0.01;

    return {
      nMonto,
      moraAntes,
      interesAntes,
      cubiertoMora,
      cubiertoInteres,
      cubiertoCapital,
      excedenteLibre: round2(restante),
      nuevoCapital: round2(Math.max(0, capitalAntes - cubiertoCapital)),
      esIncompleto,
      moraGeneradaFutura: esIncompleto ? round2(cuotaMinima - nMonto) : 0,
    };
  }, [montoPago, prestamo, resumen, deuda]);

export const RegistrarPagoPrestamoForm: React.FC<RegistrarPagoPrestamoFormProps> = ({
  prestamoId,
  prestamo,
  resumen,
  deuda,
  onSuccess,
  onError,
}) => {
  const [montoPago, setMontoPago] = useState("");
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split("T")[0]);
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [comprobanteFiles, setComprobanteFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const desglose = useDesglose(montoPago, prestamo, resumen, deuda);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(montoPago);
    if (!montoNum || montoNum <= 0) {
      onError("El monto a abonar debe ser mayor a 0");
      return;
    }

    setIsSubmitting(true);
    try {
      let comprobanteUrl = "";
      let driveFileId = "";

      if (comprobanteFiles.length > 0) {
        const result = await subirVoucher(comprobanteFiles[0]);
        comprobanteUrl = result.url;
        driveFileId = result.driveFileId;
      }

      const res = await fetch(`/api/prestamos/${prestamoId}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: montoNum,
          fecha_pago: fechaPago,
          metodo_pago: metodoPago,
          comprobante_url: comprobanteUrl || null,
          voucher_drive_file_id: driveFileId || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error al registrar el pago");
      }

      setMontoPago("");
      setComprobanteFiles([]);
      onSuccess("¡Pago registrado correctamente!");
    } catch (err: any) {
      onError(err.message || "Ocurrió un error al registrar el pago");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
          <DollarSign className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">Registrar Nuevo Pago</h3>
          <p className="text-xs text-slate-500">Abono directo a esta cuenta</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Monto del Abono (S/) *</label>
          <input
            type="number"
            step="0.01"
            min="0.1"
            placeholder="Ej: 300.00"
            value={montoPago}
            onChange={(e) => setMontoPago(e.target.value)}
            className={`${inputClass} text-sm font-bold`}
            required
          />
        </div>

        {desglose && (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-2.5 text-xs select-none">
            <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
              <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-1.5">
                📐 Desglose del Abono
              </span>
              <span className="font-mono font-black text-indigo-700 bg-white px-2 py-0.5 rounded-lg border border-indigo-200">
                S/ {desglose.nMonto.toFixed(2)}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center text-rose-700 font-semibold">
                <span>1. Mora acumulada cubierta:</span>
                <span className="font-mono font-bold">
                  - S/ {desglose.cubiertoMora.toFixed(2)}
                  {desglose.moraAntes > 0 && (
                    <span className="text-[9.5px] text-slate-500 font-normal ml-1">
                      (queda S/ {(desglose.moraAntes - desglose.cubiertoMora).toFixed(2)})
                    </span>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center text-indigo-700 font-semibold">
                <span>2. Interés del período cubierto:</span>
                <span className="font-mono font-bold">
                  - S/ {desglose.cubiertoInteres.toFixed(2)}
                  {desglose.interesAntes > 0 && (
                    <span className="text-[9.5px] text-slate-500 font-normal ml-1">
                      (queda S/ {(desglose.interesAntes - desglose.cubiertoInteres).toFixed(2)})
                    </span>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center text-emerald-700 font-bold">
                <span>3. Reducción directa a Capital:</span>
                <span className="font-mono font-black">- S/ {desglose.cubiertoCapital.toFixed(2)}</span>
              </div>

              {desglose.excedenteLibre > 0 && (
                <div className="flex justify-between items-center text-indigo-900 font-extrabold bg-indigo-100/80 p-1.5 rounded-lg">
                  <span>⚠️ Excedente sin deuda pendiente:</span>
                  <span className="font-mono">+ S/ {desglose.excedenteLibre.toFixed(2)}</span>
                </div>
              )}

              {desglose.esIncompleto && (
                <div className="p-2 bg-rose-100/90 border border-rose-200 rounded-xl text-rose-900 text-[10.5px] font-bold">
                  ⚠️ Pago incompleto: faltan S/ {desglose.moraGeneradaFutura.toFixed(2)} de la cuota mínima. Esta
                  diferencia pasará como mora al mes siguiente.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-indigo-200/80 flex justify-between items-center font-black text-slate-900 text-xs">
              <span>NUEVO CAPITAL RESTANTE:</span>
              <span className="font-mono text-xs text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-emerald-300">
                S/ {desglose.nuevoCapital.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Fecha de Pago</label>
            <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Método / Banco de Pago *</label>
            <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className={inputClass}>
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ImagePasteDropzone files={comprobanteFiles} onFilesChange={setComprobanteFiles} />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? "Guardando Pago..." : "Guardar Pago y Actualizar"}
        </button>
      </form>
    </div>
  );
};
