import React, { useState, useEffect, useMemo } from "react";
import { DollarSign, CheckCircle, AlertCircle, Upload, ShieldCheck, X, Image as ImageIcon } from "lucide-react";
import { Cliente, Prestamo } from "../../types";
import { ClienteAutocomplete } from "../common/ClienteAutocomplete";
import { subirVoucher } from "../../lib/imageCompression";
import { round2 } from "../../lib/loanLogic";

interface RegistrarPagoFormProps {
  clientes: Cliente[];
  prestamosActivos: Prestamo[];
  selectedPrestamoIdFromParent?: string;
  onPagoRegistrado: () => void;
}

export const RegistrarPagoForm: React.FC<RegistrarPagoFormProps> = ({
  clientes,
  prestamosActivos,
  selectedPrestamoIdFromParent,
  onPagoRegistrado
}) => {
  const [clienteId, setClienteId] = useState("");
  const [prestamoId, setPrestamoId] = useState("");
  const [monto, setMonto] = useState("");
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split("T")[0]);
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [comprobanteFiles, setComprobanteFiles] = useState<File[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const selectedPrestamo = prestamosActivos.find((p) => p.id === prestamoId);

  const desgloseMatematico = useMemo(() => {
    const nMonto = round2(parseFloat(monto) || 0);
    if (nMonto <= 0 || !selectedPrestamo) return null;

    const capitalAntes = round2(selectedPrestamo.monto_capital || 0);
    const tasaFraccion = (selectedPrestamo.tasa_interes_porcentaje || 0) / 100;
    const interesAntes = round2(capitalAntes * tasaFraccion);
    const moraAntes = 0;

    let restante = nMonto;
    const cubiertoMora = round2(Math.min(moraAntes, restante));
    restante = round2(restante - cubiertoMora);

    const cubiertoInteres = round2(Math.min(interesAntes, restante));
    restante = round2(restante - cubiertoInteres);

    const cubiertoCapital = round2(Math.min(capitalAntes, restante));
    restante = round2(restante - cubiertoCapital);

    const excedenteLibre = round2(restante);
    const nuevoCapital = round2(Math.max(0, capitalAntes - cubiertoCapital));

    const cuotaMinima = round2(moraAntes + interesAntes);
    const esIncompleto = nMonto > 0 && nMonto < cuotaMinima - 0.01;
    const moraGeneradaFutura = esIncompleto ? round2(cuotaMinima - nMonto) : 0;

    return {
      nMonto,
      capitalAntes,
      interesAntes,
      cubiertoMora,
      cubiertoInteres,
      cubiertoCapital,
      excedenteLibre,
      nuevoCapital,
      cuotaMinima,
      esIncompleto,
      moraGeneradaFutura,
    };
  }, [monto, selectedPrestamo]);

  // Préstamos filtrados por el cliente seleccionado
  const prestamosDelCliente = prestamosActivos.filter(
    (p) => p.cliente_id === clienteId && p.estado === "activo"
  );

  useEffect(() => {
    if (selectedPrestamoIdFromParent) {
      const p = prestamosActivos.find((item) => item.id === selectedPrestamoIdFromParent);
      if (p) {
        setClienteId(p.cliente_id);
        setPrestamoId(p.id);
      }
    }
  }, [selectedPrestamoIdFromParent, prestamosActivos]);

  useEffect(() => {
    if (clienteId && prestamosDelCliente.length === 1) {
      setPrestamoId(prestamosDelCliente[0].id);
    } else if (!clienteId) {
      setPrestamoId("");
    }
  }, [clienteId]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const newFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf("image") !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          const file = new File([blob], `comprobante_pega_${Date.now()}_${i + 1}.png`, { type: blob.type });
          newFiles.push(file);
        }
      }
    }

    if (newFiles.length > 0) {
      setComprobanteFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const addedFiles = Array.from(e.target.files);
      setComprobanteFiles((prev) => [...prev, ...addedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setComprobanteFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prestamoId) {
      setErrorMsg("Debe seleccionar un préstamo activo");
      return;
    }
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) {
      setErrorMsg("El monto del pago debe ser mayor a 0");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const comprobanteUrls: string[] = [];
      const voucherDriveFileIds: string[] = [];

      if (comprobanteFiles.length > 0) {
        const uploads = await Promise.all(
          comprobanteFiles.map(async (file) => {
            const result = await subirVoucher(file);
            return {
              url: result.url,
              fileId: result.driveFileId
            };
          })
        );

        uploads.forEach((item) => {
          if (item) {
            if (item.url) comprobanteUrls.push(item.url);
            if (item.fileId) voucherDriveFileIds.push(item.fileId);
          }
        });
      }

      const finalUrl = comprobanteUrls.length === 1 
        ? comprobanteUrls[0] 
        : comprobanteUrls.length > 1 
        ? JSON.stringify(comprobanteUrls) 
        : null;

      const finalDriveId = voucherDriveFileIds.length === 1 
        ? voucherDriveFileIds[0] 
        : voucherDriveFileIds.length > 1 
        ? JSON.stringify(voucherDriveFileIds) 
        : null;

      const res = await fetch(`/api/prestamos/${prestamoId}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: montoNum,
          fecha_pago: fechaPago,
          metodo_pago: metodoPago,
          comprobante_url: finalUrl,
          voucher_drive_file_id: finalDriveId
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al registrar el pago");
      }

      setSuccessMsg("¡Pago registrado correctamente!");
      onPagoRegistrado();

      setMonto("");
      setComprobanteFiles([]);
    } catch (err: any) {
      setErrorMsg(err.message || "No se pudo registrar el pago");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      onPaste={handlePaste}
      className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4 tab-focus-none outline-none"
      tabIndex={0}
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Registrar Pago</h2>
            <p className="text-xs text-slate-500">Cobro de cuota o saldo de préstamo</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Cliente / Deudor *
          </label>
          <ClienteAutocomplete
            clientes={clientes}
            selectedClienteId={clienteId}
            onSelectCliente={(cId) => {
              setClienteId(cId);
              setPrestamoId("");
            }}
          />
        </div>

        {clienteId && (
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Préstamo a Cobrar *
            </label>
            <select
              value={prestamoId}
              onChange={(e) => setPrestamoId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">-- Seleccionar Préstamo --</option>
              {prestamosDelCliente.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.tipo_prestamo} (Capital: S/ {p.monto_capital.toFixed(2)}) — Vence Día {p.dia_vencimiento_mes || "?"}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Monto (S/) *
            </label>
            <input
              type="number"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Fecha de Pago *
            </label>
            <input
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Panel de Desglose Matemático del Cobro en Tiempo Real */}
        {desgloseMatematico && (
          <div className="rounded-2xl border border-blue-150 bg-blue-50/50 p-3.5 space-y-2.5 text-xs select-none">
            <div className="flex justify-between items-center border-b border-blue-100 pb-2">
              <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest flex items-center gap-1.5">
                📐 Desglose Matemático del Abono
              </span>
              <span className="font-mono font-black text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-200">
                S/ {desgloseMatematico.nMonto.toFixed(2)}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              {/* Paso 1: Interés del período */}
              <div className="flex justify-between items-center text-blue-800 font-semibold">
                <span>1. Interés del período cubierto:</span>
                <span className="font-mono font-bold">
                  - S/ {desgloseMatematico.cubiertoInteres.toFixed(2)}
                </span>
              </div>

              {/* Paso 2: Amortización directa a Capital */}
              <div className="flex justify-between items-center text-emerald-700 font-bold">
                <span>2. Reducción directa a Capital:</span>
                <span className="font-mono font-black">
                  - S/ {desgloseMatematico.cubiertoCapital.toFixed(2)}
                </span>
              </div>

              {/* Excedente si existe */}
              {desgloseMatematico.excedenteLibre > 0 && (
                <div className="flex justify-between items-center text-blue-900 font-extrabold bg-blue-100/80 p-1.5 rounded-lg">
                  <span>⚠️ Excedente sin deuda pendiente:</span>
                  <span className="font-mono">+ S/ {desgloseMatematico.excedenteLibre.toFixed(2)}</span>
                </div>
              )}

              {/* Mora generada si es incompleto */}
              {desgloseMatematico.esIncompleto && (
                <div className="p-2 bg-rose-100/90 border border-rose-200 rounded-xl text-rose-900 text-[10.5px] font-bold">
                  ⚠️ Pago incompleto: faltan S/ {desgloseMatematico.moraGeneradaFutura.toFixed(2)} de la cuota mínima.
                  Esta diferencia pasará como mora al mes siguiente.
                </div>
              )}
            </div>

            {/* Resultado Final en Capital */}
            <div className="pt-2 border-t border-blue-200/80 flex justify-between items-center font-black text-slate-900 text-xs">
              <span>NUEVO CAPITAL RESTANTE:</span>
              <span className="font-mono text-xs text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-emerald-300">
                S/ {desgloseMatematico.nuevoCapital.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Cuenta / Método de Pago *
          </label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="Efectivo">Efectivo</option>
            <option value="Sebastián — Interbank / Plin">Sebastián — Interbank / Plin</option>
            <option value="Sebastián — BCP / Yape">Sebastián — BCP / Yape</option>
            <option value="Roberto — Interbank / Plin">Roberto — Interbank / Plin</option>
            <option value="Roberto — BCP / Yape">Roberto — BCP / Yape</option>
            <option value="Roberto — BBVA">Roberto — BBVA</option>
            <option value="Transferencia Bancaria">Transferencia Bancaria (Otra)</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        {/* Carga y Pegado de Múltiples Comprobantes */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-700">
              Comprobantes / Vouchers (Opcional - Selecciona o presiona Ctrl+V)
            </label>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              💡 Puedes pegar con Ctrl + V
            </span>
          </div>

          <div className="relative">
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="voucher-input-prestamo"
            />
            <label
              htmlFor="voucher-input-prestamo"
              className="w-full px-3 py-2.5 bg-slate-50/70 border border-dashed border-slate-300 hover:border-blue-400 rounded-xl text-xs text-slate-600 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4 text-slate-400" />
              <span>Subir comprobante(s) o presiona Ctrl + V</span>
            </label>
          </div>

          {/* Lista de archivos agregados */}
          {comprobanteFiles.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {comprobanteFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate font-medium text-slate-800">{file.name}</span>
                    <span className="text-[10px] text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-red-600 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? "Registrando Pago..." : "Confirmar Pago"}
        </button>
      </form>
    </div>
  );
};
