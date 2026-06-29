import React, { useState, useEffect, useMemo } from "react";
import { UploadCloud, FileCheck, CheckCircle, Zap } from "lucide-react";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { METODOS_PAGO } from "../../lib/constants";
import { formatCurrency, round2 } from "../../lib/formatters";
import { classifyPayment } from "../../lib/loanLogic";

interface PaymentFormProps {
  expectedAmount: number;
  saldoPendiente: number;
  onSubmit: (data: {
    monto: number;
    metodo_pago: string;
    fecha_pago: string;
    tipo_movimiento: string;
    vouchers?: Array<{ fileName: string; mimeType: string; base64Data: string }>;
  }) => Promise<boolean>;
  loanType?: string;
  debtState?: any;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  expectedAmount,
  saldoPendiente,
  onSubmit,
  loanType,
  debtState,
}) => {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("Yape");
  const [fecha, setFecha] = useState(() => new Date().toISOString().split("T")[0]);
  const [tipoMovimientoSelected, setTipoMovimientoSelected] = useState("Auto");
  const [tipoMovimientoAuto, setTipoMovimientoAuto] = useState("");
  
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

  // Calcular la clasificación automática
  useEffect(() => {
    if (!debtState) return;
    const nMonto = parseFloat(monto) || 0;
    if (nMonto <= 0) {
      setTipoMovimientoAuto("");
      return;
    }
    const autoClass = classifyPayment(nMonto, debtState, fecha);
    setTipoMovimientoAuto(autoClass);
  }, [monto, fecha, debtState]);

  const resolvedTipoMovimiento = tipoMovimientoSelected === "Auto" ? tipoMovimientoAuto : tipoMovimientoSelected;

  // Calcular el desglose del cobro en tiempo real
  const desgloseConDistribucion = useMemo(() => {
    if (!debtState) return null;
    const nMonto = round2(parseFloat(monto) || 0);
    if (nMonto <= 0) return null;

    const cuotaSiguiente = debtState.cuotaSiguiente;
    const moraPendiente = debtState.cuotas?.reduce((s: number, c: any) => s + (c.moraPendiente || 0), 0) || 0;
    const interesPendiente = debtState.resumen?.interesPendiente || 0;
    const capitalPendiente = debtState.resumen?.capitalPendiente || 0;

    let restante = nMonto;
    const pagoMora = round2(Math.min(moraPendiente, restante));
    restante = round2(restante - pagoMora);

    const pagoInteres = round2(Math.min(interesPendiente, restante));
    restante = round2(restante - pagoInteres);

    const pagoCapital = round2(Math.min(capitalPendiente, restante));
    const nuevoCapital = round2(Math.max(0, capitalPendiente - pagoCapital));

    return { pagoMora, pagoInteres, pagoCapital, nuevoCapital, moraPendiente, cuotaSiguiente };
  }, [monto, debtState]);

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
      tipo_movimiento: resolvedTipoMovimiento || "Pago Ordinario",
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

        {debtState?.resumen?.esElegibleLiquidacionExpress && (
          <button
            type="button"
            onClick={() => {
              setMonto(round2(debtState.resumen.montoLiquidacionExpress).toString());
              setTipoMovimientoSelected("Liquidación Express");
            }}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 transition duration-150 cursor-pointer text-center rounded-xl font-black text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5"
          >
            ⚡ Liquidación Express: {formatCurrency(debtState.resumen.montoLiquidacionExpress)}
          </button>
        )}

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

        {/* Panel de desglose en tiempo real */}
        {desgloseConDistribucion && !isAlquiler && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
              Distribución del Cobro
            </span>
            {desgloseConDistribucion.pagoMora > 0 && (
              <div className="flex justify-between items-center font-bold text-rose-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                  Mora a cubrir:
                </span>
                <span className="font-mono font-black">{formatCurrency(desgloseConDistribucion.pagoMora)}</span>
              </div>
            )}
            {desgloseConDistribucion.pagoInteres > 0 && (
              <div className="flex justify-between items-center font-bold text-indigo-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
                  Interés del período:
                </span>
                <span className="font-mono font-black">{formatCurrency(desgloseConDistribucion.pagoInteres)}</span>
              </div>
            )}
            {desgloseConDistribucion.pagoCapital > 0 && (
              <div className="flex justify-between items-center font-bold text-emerald-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Amortización capital:
                </span>
                <span className="font-mono font-black">{formatCurrency(desgloseConDistribucion.pagoCapital)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-black text-slate-700">
              <span>Nuevo saldo capital:</span>
              <span className="font-mono text-sm">{formatCurrency(desgloseConDistribucion.nuevoCapital)}</span>
            </div>
          </div>
        )}

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

        {/* Clasificación de Pago */}
        {debtState && (
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] md:text-[12px] font-black text-slate-500 uppercase tracking-wider block">
              Clasificación del Pago
            </label>
            <select
              value={tipoMovimientoSelected}
              onChange={(e) => setTipoMovimientoSelected(e.target.value)}
              className="glass-input w-full px-4 rounded-xl border border-slate-200 font-medium bg-white text-slate-800 cursor-pointer h-12 text-xs md:text-sm"
            >
              <option value="Auto">
                ✨ Auto-detectar ({tipoMovimientoAuto || "Pago Ordinario"})
              </option>
              <option value="Amortización parcial">Amortización parcial (Abono a deuda exigible)</option>
              <option value="Pago adelantado / múltiple">Pago adelantado / múltiple (Abono a cuota futura)</option>
              <option value="Pago exacto de cuota">Pago exacto de cuota</option>
              <option value="Liquidación total">Liquidación total (Saldar préstamo)</option>
              <option value="Liquidación Express">⚡ Liquidación Express (Primeros 7 días del mes)</option>
            </select>
            <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-wide">
              Se registrará como: <span className="underline">{resolvedTipoMovimiento || "Pago Ordinario"}</span>
            </p>
          </div>
        )}

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
