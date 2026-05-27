import React, { useState, useEffect } from "react";
import { UploadCloud, FileCheck, CheckCircle } from "lucide-react";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { METODOS_PAGO } from "../../lib/constants";
import { formatCurrency, round2 } from "../../lib/formatters";

interface PaymentFormProps {
  expectedAmount: number;
  saldoPendiente: number;
  onSubmit: (data: {
    monto: number;
    metodo_pago: string;
    fecha_pago: string;
    fileName?: string;
    mimeType?: string;
    base64Data?: string;
  }) => Promise<boolean>;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  expectedAmount,
  saldoPendiente,
  onSubmit,
}) => {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("Yape");
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  
  // Voucher upload state
  const [vcrFile, setVcrFile] = useState<File | null>(null);
  const [vcrBase64, setVcrBase64] = useState("");
  
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Pre-rellenar monto con el esperado
  useEffect(() => {
    if (expectedAmount > 0) {
      setMonto(round2(expectedAmount).toString());
    } else {
      setMonto(round2(saldoPendiente).toString());
    }
  }, [expectedAmount, saldoPendiente]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVcrFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setVcrBase64((reader.result as string).split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const nMonto = round2(parseFloat(monto));
    if (!nMonto || nMonto <= 0) {
      setError("El monto de la amortización debe ser mayor a 0");
      return;
    }

    if (nMonto > saldoPendiente + 0.01) {
      setError(`El monto excede el saldo deudor pendiente actual (${formatCurrency(saldoPendiente)})`);
      return;
    }

    setSubmitting(true);
    const successResult = await onSubmit({
      monto: nMonto,
      metodo_pago: metodo,
      fecha_pago: fecha,
      fileName: vcrFile?.name,
      mimeType: vcrFile?.type,
      base64Data: vcrBase64 || undefined,
    });

    setSubmitting(false);
    if (successResult) {
      setSuccess(true);
      setVcrFile(null);
      setVcrBase64("");
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <Card variant="bento" className="select-none font-sans">
      <div className="mb-4">
        <h2 className="text-sm md:text-base font-black text-white tracking-tight leading-none">Registrar Amortización</h2>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
          Registrar abono de cuota o saldo del prestatario
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs font-bold rounded-2xl">
            {error}
          </div>
        )}
        
        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-2xl flex items-center gap-1.5">
            <CheckCircle size={14} className="shrink-0 text-emerald-400" />
            <span>¡Pago registrado y voucher subido de forma exitosa!</span>
          </div>
        )}

        {/* Monto abono */}
        <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
          <button
            type="button"
            onClick={() => setMonto(round2(expectedAmount).toString())}
            className="px-3 py-2 bg-white/5 border border-white/8 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl font-bold transition duration-150 cursor-pointer text-center"
          >
            Cuota: {formatCurrency(expectedAmount)}
          </button>
          
          <button
            type="button"
            onClick={() => setMonto(round2(saldoPendiente).toString())}
            className="px-3 py-2 bg-white/5 border border-white/8 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl font-bold transition duration-150 cursor-pointer text-center"
          >
            Total: {formatCurrency(saldoPendiente)}
          </button>
        </div>

        <Input
          label="Monto Amortizado (S/.)"
          type="number"
          step="0.01"
          required
          value={monto}
          onChange={(e) => {
            setMonto(e.target.value);
            setError("");
          }}
        />

        {/* Método de pago */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-[11px] md:text-[12px] font-black text-slate-400 uppercase tracking-wider block">
            Método de Pago
          </label>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            className="glass-input w-full px-4 rounded-xl border border-white/8 font-medium bg-[#080c18] text-[#f8fafc] cursor-pointer h-12"
          >
            {METODOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Fecha pago */}
        <Input
          label="Fecha de Pago"
          type="date"
          required
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />

        {/* Drag/Drop Voucher Upload */}
        <div className="space-y-1">
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
            Comprobante de Pago (Voucher)
          </label>
          
          <label className="doc-upload-zone flex flex-col items-center justify-center p-5 text-center transition select-none">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {vcrFile ? (
              <div className="text-emerald-400 flex flex-col items-center gap-1.5 text-xs font-bold">
                <FileCheck size={32} />
                <span>{vcrFile.name}</span>
                <span className="text-[9px] uppercase text-slate-500">Haz click para cambiar de archivo</span>
              </div>
            ) : (
              <div className="text-slate-500 flex flex-col items-center gap-1.5 text-xs font-bold">
                <UploadCloud size={32} className="text-slate-600" />
                <span>Subir o arrastrar comprobante</span>
                <span className="text-[9px] uppercase text-slate-600">Soporta imagen o PDF</span>
              </div>
            )}
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          className="w-full mt-4 h-12 font-bold"
        >
          Registrar Cobro
        </Button>
      </form>
    </Card>
  );
};
