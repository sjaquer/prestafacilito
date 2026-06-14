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
    vouchers?: Array<{ fileName: string; mimeType: string; base64Data: string }>;
  }) => Promise<boolean>;
  loanType?: string;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  expectedAmount,
  saldoPendiente,
  onSubmit,
  loanType,
}) => {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("Yape");
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  
  const isAlquiler = loanType === "Alquiler de Casa";
  
  // Voucher upload state (multiple)
  const [vcrFiles, setVcrFiles] = useState<Array<{ file: File; base64: string }>>([]);
  
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

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newVouchers: Array<{ file: File; base64: string }> = [];
    let processed = 0;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        newVouchers.push({ file, base64 });
        processed++;
        if (processed === files.length) {
          setVcrFiles((prev) => [...prev, ...newVouchers]);
          e.target.value = ""; // Reset file input
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeVcrFile = (index: number) => {
    setVcrFiles((prev) => prev.filter((_, i) => i !== index));
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
      vouchers: vcrFiles.map(v => ({
        fileName: v.file.name,
        mimeType: v.file.type,
        base64Data: v.base64
      }))
    });

    setSubmitting(false);
    if (successResult) {
      setSuccess(true);
      setVcrFiles([]);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <Card variant="bento" className="select-none font-sans">
      <div className="mb-4">
        <h2 className="text-sm md:text-base font-black text-slate-900 tracking-tight leading-none">
          {isAlquiler ? "Registrar Mensualidad" : "Registrar Amortización"}
        </h2>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
          {isAlquiler ? "Registrar abono mensual o saldo del contrato de alquiler" : "Registrar abono de cuota o saldo del prestatario"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded-2xl">
            {error}
          </div>
        )}
        
        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-250/70 text-emerald-700 text-xs font-bold rounded-2xl flex items-center gap-1.5">
            <CheckCircle size={14} className="shrink-0 text-emerald-600" />
            <span>¡Pago registrado y comprobante cargado con éxito!</span>
          </div>
        )}

        {/* Monto abono */}
        <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
          <button
            type="button"
            onClick={() => setMonto(round2(expectedAmount).toString())}
            className="px-3 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl font-bold transition duration-150 cursor-pointer text-center"
          >
            {isAlquiler ? "Mensualidad" : "Cuota"}: {formatCurrency(expectedAmount)}
          </button>
          
          <button
            type="button"
            onClick={() => setMonto(round2(saldoPendiente).toString())}
            className="px-3 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-xl font-bold transition duration-150 cursor-pointer text-center"
          >
            {isAlquiler ? "Total Contrato" : "Total"}: {formatCurrency(saldoPendiente)}
          </button>
        </div>

        <Input
          label={isAlquiler ? "Monto a Cancelar (S/.)" : "Monto Amortizado (S/.)"}
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
          <label className="text-[11px] md:text-[12px] font-black text-slate-500 uppercase tracking-wider block">
            Método de Pago
          </label>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            className="glass-input w-full px-4 rounded-xl border border-slate-200 font-medium bg-white text-slate-800 cursor-pointer h-12"
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
        <div className="space-y-2">
          <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
            Comprobantes de Pago (Vouchers)
          </label>
          
          <label className="doc-upload-zone flex flex-col items-center justify-center p-5 text-center transition select-none border border-dashed border-slate-250 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100">
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFilesChange}
              className="hidden"
            />
            <div className="text-slate-500 flex flex-col items-center gap-1.5 text-xs font-bold">
              <UploadCloud size={32} className="text-slate-400" />
              <span>Adjuntar o arrastrar comprobantes</span>
              <span className="text-[9px] uppercase text-slate-450">Soporta múltiples imágenes o PDF</span>
            </div>
          </label>

          {/* List of uploaded files */}
          {vcrFiles.length > 0 && (
            <div className="space-y-1.5 mt-2 max-h-[150px] overflow-y-auto scrollbar-thin">
              {vcrFiles.map((vcr, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCheck size={14} className="text-emerald-600 shrink-0" />
                    <span className="truncate pr-2">{vcr.file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVcrFile(idx)}
                    className="text-rose-500 hover:text-rose-700 font-black cursor-pointer bg-transparent border-none px-1"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          className="w-full mt-4 h-12 font-bold"
        >
          {isAlquiler ? "Registrar Pago de Alquiler" : "Registrar Cobro"}
        </Button>
      </form>
    </Card>
  );
};
