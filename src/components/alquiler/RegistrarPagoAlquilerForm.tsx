import React, { useState, useEffect } from "react";
import { DollarSign, CheckCircle, AlertCircle, Upload, Home, X, Image as ImageIcon } from "lucide-react";
import { Cliente, Alquiler } from "../../types";
import { ClienteAutocomplete } from "../common/ClienteAutocomplete";

interface RegistrarPagoAlquilerFormProps {
  clientes: Cliente[];
  alquileresActivos: Alquiler[];
  selectedAlquilerIdFromParent?: string;
  onPagoRegistrado: () => void;
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export const RegistrarPagoAlquilerForm: React.FC<RegistrarPagoAlquilerFormProps> = ({
  clientes,
  alquileresActivos,
  selectedAlquilerIdFromParent,
  onPagoRegistrado
}) => {
  const [clienteId, setClienteId] = useState("");
  const [alquilerId, setAlquilerId] = useState("");
  const [periodoMes, setPeriodoMes] = useState<number>(new Date().getMonth() + 1);
  const [periodoAnio, setPeriodoAnio] = useState<number>(new Date().getFullYear());
  const [monto, setMonto] = useState("");
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split("T")[0]);
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [comprobanteFiles, setComprobanteFiles] = useState<File[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const alquileresDelCliente = alquileresActivos.filter(
    (a) => a.cliente_id === clienteId && a.estado === "activo"
  );

  useEffect(() => {
    if (selectedAlquilerIdFromParent) {
      const alq = alquileresActivos.find((item) => item.id === selectedAlquilerIdFromParent);
      if (alq) {
        setClienteId(alq.cliente_id);
        setAlquilerId(alq.id);
        setMonto(String(alq.monto_mensual));
      }
    }
  }, [selectedAlquilerIdFromParent, alquileresActivos]);

  useEffect(() => {
    if (clienteId && alquileresDelCliente.length === 1) {
      setAlquilerId(alquileresDelCliente[0].id);
      setMonto(String(alquileresDelCliente[0].monto_mensual));
    } else if (!clienteId) {
      setAlquilerId("");
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
          const file = new File([blob], `comprobante_alquiler_pega_${Date.now()}_${i + 1}.png`, { type: blob.type });
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
    if (!alquilerId) {
      setErrorMsg("Debe seleccionar un contrato de alquiler activo.");
      return;
    }
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) {
      setErrorMsg("El monto del pago debe ser mayor a 0.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const comprobanteUrls: string[] = [];

      if (comprobanteFiles.length > 0) {
        const uploads = await Promise.all(
          comprobanteFiles.map(async (file) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("cliente_id", clienteId);
            formData.append("alquiler_id", alquilerId);

            const uploadRes = await fetch("/api/upload-voucher", {
              method: "POST",
              body: formData
            });

            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              return uploadData.fileUrl || uploadData.proxyUrl || "";
            }
            return null;
          })
        );

        uploads.forEach((url) => {
          if (url) comprobanteUrls.push(url);
        });
      }

      const finalUrl = comprobanteUrls.length === 1 
        ? comprobanteUrls[0] 
        : comprobanteUrls.length > 1 
        ? JSON.stringify(comprobanteUrls) 
        : null;

      const res = await fetch(`/api/alquileres/${alquilerId}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: montoNum,
          periodo_mes: periodoMes,
          periodo_anio: periodoAnio,
          fecha_pago: fechaPago,
          metodo_pago: metodoPago,
          comprobante_url: finalUrl
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al registrar el pago de alquiler");
      }

      setSuccessMsg("¡Pago de alquiler registrado correctamente!");
      onPagoRegistrado();
      setMonto("");
      setComprobanteFiles([]);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar el pago");
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
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Registrar Pago de Alquiler</h2>
            <p className="text-xs text-slate-500">Cobro de renta por período de alquiler</p>
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
            Inquilino / Cliente *
          </label>
          <ClienteAutocomplete
            clientes={clientes}
            selectedClienteId={clienteId}
            onSelectCliente={(cId) => {
              setClienteId(cId);
              setAlquilerId("");
            }}
          />
        </div>

        {clienteId && (
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Contrato de Alquiler *
            </label>
            <select
              value={alquilerId}
              onChange={(e) => {
                const id = e.target.value;
                setAlquilerId(id);
                const selected = alquileresActivos.find((a) => a.id === id);
                if (selected) setMonto(String(selected.monto_mensual));
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
            >
              <option value="">-- Seleccionar Contrato --</option>
              {alquileresDelCliente.map((a) => (
                <option key={a.id} value={a.id}>
                  🏠 {a.descripcion_inmueble} (S/ {a.monto_mensual.toFixed(2)}/mes)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Período Mes y Año */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Período Mes *
            </label>
            <select
              value={periodoMes}
              onChange={(e) => setPeriodoMes(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
            >
              {MESES.map((m, idx) => (
                <option key={idx} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Período Año *
            </label>
            <input
              type="number"
              value={periodoAnio}
              onChange={(e) => setPeriodoAnio(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Monto Pagado (S/) *
            </label>
            <input
              type="number"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
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
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Cuenta / Método de Pago *
          </label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
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
              Comprobantes de Alquiler (Opcional - Selecciona o presiona Ctrl+V)
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
              id="voucher-input-alquiler"
            />
            <label
              htmlFor="voucher-input-alquiler"
              className="w-full px-3 py-2.5 bg-slate-50/70 border border-dashed border-slate-300 hover:border-emerald-400 rounded-xl text-xs text-slate-600 flex items-center justify-center gap-2 cursor-pointer transition-colors"
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
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? "Registrando Pago..." : "Confirmar Pago de Alquiler"}
        </button>
      </form>
    </div>
  );
};
