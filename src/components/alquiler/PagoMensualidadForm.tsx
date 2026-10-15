import React, { useState } from "react";
import { ImagePasteDropzone } from "../common/ImagePasteDropzone";
import { METODOS_PAGO } from "../../lib/constants";
import { subirVoucher } from "../../lib/imageCompression";
import { MESES } from "./alquilerUtils";

interface PagoMensualidadFormProps {
  alquilerId: string;
  /** Mes sugerido (el siguiente pendiente) y su saldo. */
  sugerencia: { mes: number; anio: number; monto: number };
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const fieldClass =
  "w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all";
const labelClass = "text-[11px] font-bold text-slate-600 block mb-1";

/** Registra el pago de una mensualidad de alquiler, con comprobante opcional. */
export const PagoMensualidadForm: React.FC<PagoMensualidadFormProps> = ({ alquilerId, sugerencia, onSuccess, onError }) => {
  const [monto, setMonto] = useState(sugerencia.monto > 0 ? String(sugerencia.monto) : "");
  const [mes, setMes] = useState(sugerencia.mes);
  const [anio, setAnio] = useState(sugerencia.anio);
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split("T")[0]);
  const [metodo, setMetodo] = useState("Efectivo");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNum = parseFloat(monto);
    if (!(montoNum > 0)) {
      onError("El monto debe ser mayor a 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      let comprobante_url: string | null = null;
      let voucher_drive_file_id: string | null = null;
      if (files.length > 0) {
        const up = await subirVoucher(files[0]);
        comprobante_url = up.url || null;
        voucher_drive_file_id = up.driveFileId || null;
      }

      const res = await fetch(`/api/alquileres/${alquilerId}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: montoNum,
          periodo_mes: mes,
          periodo_anio: anio,
          fecha_pago: fechaPago,
          metodo_pago: metodo,
          comprobante_url,
          voucher_drive_file_id,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "No se pudo registrar el pago de alquiler");
      }
      setFiles([]);
      onSuccess(`Pago de ${MESES[mes - 1]} ${anio} registrado`);
    } catch (err: any) {
      onError(err.message || "Error al procesar el pago");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="alq-mes">Mes que paga</label>
          <select id="alq-mes" value={mes} onChange={(e) => setMes(parseInt(e.target.value, 10))} className={fieldClass}>
            {MESES.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="alq-anio">Año</label>
          <input
            id="alq-anio"
            type="number"
            inputMode="numeric"
            value={anio}
            onChange={(e) => setAnio(parseInt(e.target.value, 10) || anio)}
            className={`${fieldClass} font-bold`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="alq-monto">Monto (S/)</label>
          <input
            id="alq-monto"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className={`${fieldClass} font-bold font-mono`}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="alq-fecha">Fecha de pago</label>
          <input id="alq-fecha" type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={fieldClass} required />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="alq-metodo">Método / cuenta</label>
        <select id="alq-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value)} className={fieldClass}>
          {METODOS_PAGO.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <ImagePasteDropzone files={files} onFilesChange={setFiles} />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
      >
        {isSubmitting ? "Registrando..." : "Guardar pago de mensualidad"}
      </button>
    </form>
  );
};
