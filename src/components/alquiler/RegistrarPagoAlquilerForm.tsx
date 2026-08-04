import React, { useState, useEffect, useMemo } from "react";
import { DollarSign, CheckCircle, AlertCircle, Upload, Home, X, Image as ImageIcon } from "lucide-react";
import { Cliente, Alquiler } from "../../types";
import { ClienteAutocomplete } from "../common/ClienteAutocomplete";
import { ImagePasteDropzone } from "../common/ImagePasteDropzone";
import { METODOS_PAGO_OPCIONES } from "../../constants/bancos";
import { subirVoucher } from "../../lib/imageCompression";
import { round2 } from "../../lib/loanLogic";

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

  const selectedAlquiler = alquileresActivos.find((a) => a.id === alquilerId);

  const desgloseAlquiler = useMemo(() => {
    const nMonto = round2(parseFloat(monto) || 0);
    if (nMonto <= 0 || !selectedAlquiler) return null;

    const rentaMensual = round2(selectedAlquiler.monto_mensual || 0);
    const cubiertoRenta = round2(Math.min(rentaMensual, nMonto));
    const excedente = round2(Math.max(0, nMonto - rentaMensual));
    const incompleto = nMonto < rentaMensual - 0.01;
    const faltante = incompleto ? round2(rentaMensual - nMonto) : 0;

    return {
      nMonto,
      rentaMensual,
      cubiertoRenta,
      excedente,
      incompleto,
      faltante,
      mesNombre: MESES[periodoMes - 1] || "Mes actual"
    };
  }, [monto, selectedAlquiler, periodoMes]);

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
            const result = await subirVoucher(file);
            return result.url;
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

        {/* Panel de Desglose Matemático de Alquiler en Tiempo Real */}
        {desgloseAlquiler && (
          <div className="rounded-2xl border border-emerald-150 bg-emerald-50/50 p-3.5 space-y-2 text-xs select-none">
            <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
              <span className="text-[10px] font-black text-emerald-900 uppercase tracking-widest flex items-center gap-1.5">
                🏠 Cobro de Alquiler — {desgloseAlquiler.mesNombre} {periodoAnio}
              </span>
              <span className="font-mono font-black text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-emerald-200">
                S/ {desgloseAlquiler.nMonto.toFixed(2)}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center text-slate-700 font-medium">
                <span>Renta Pactada Mensual:</span>
                <span className="font-mono font-bold">S/ {desgloseAlquiler.rentaMensual.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-emerald-800 font-bold">
                <span>Monto Cubierto del Mes:</span>
                <span className="font-mono font-black">- S/ {desgloseAlquiler.cubiertoRenta.toFixed(2)}</span>
              </div>

              {desgloseAlquiler.incompleto && (
                <div className="p-2 bg-rose-100/90 border border-rose-200 rounded-xl text-rose-900 text-[10.5px] font-bold">
                  ⚠️ Pago parcial: faltan S/ {desgloseAlquiler.faltante.toFixed(2)} para completar la renta del mes.
                </div>
              )}

              {desgloseAlquiler.excedente > 0 && (
                <div className="flex justify-between items-center text-emerald-900 font-extrabold bg-emerald-100/80 p-1.5 rounded-lg">
                  <span>✨ Excedente a cuenta futura:</span>
                  <span className="font-mono">+ S/ {desgloseAlquiler.excedente.toFixed(2)}</span>
                </div>
              )}
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
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white"
          >
            {METODOS_PAGO_OPCIONES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Zona Interactiva para Pegar/Arrastrar Vouchers */}
        <ImagePasteDropzone
          files={comprobanteFiles}
          onFilesChange={setComprobanteFiles}
          label="Comprobantes / Vouchers de Alquiler (Opcional)"
        />

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
