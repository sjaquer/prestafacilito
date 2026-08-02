import React, { useState, useEffect } from "react";
import { DollarSign, CheckCircle, AlertCircle, Upload, Home } from "lucide-react";
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
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);

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

  const alquilerSeleccionado = alquileresActivos.find((a) => a.id === alquilerId) || null;

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
      let comprobanteUrl = "";

      if (comprobanteFile) {
        const formData = new FormData();
        formData.append("file", comprobanteFile);
        formData.append("cliente_id", clienteId);
        formData.append("alquiler_id", alquilerId);

        const uploadRes = await fetch("/api/upload-voucher", {
          method: "POST",
          body: formData
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          comprobanteUrl = uploadData.fileUrl || uploadData.proxyUrl || "";
        }
      }

      const res = await fetch(`/api/alquileres/${alquilerId}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: montoNum,
          periodo_mes: periodoMes,
          periodo_anio: periodoAnio,
          fecha_pago: fechaPago,
          metodo_pago: metodoPago,
          comprobante_url: comprobanteUrl || null
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al registrar el pago de alquiler");
      }

      setSuccessMsg("¡Pago de alquiler registrado correctamente!");
      onPagoRegistrado();
      setMonto("");
      setComprobanteFile(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar el pago");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Registrar Pago de Alquiler</h2>
            <p className="text-xs text-slate-500">Sección 8.3.3 — Cobro de renta por período</p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 font-medium">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Selector de Inquilino */}
        <ClienteAutocomplete
          clientes={clientes}
          selectedClienteId={clienteId}
          onSelectCliente={setClienteId}
          placeholder="Buscar inquilino..."
          required
        />

        {/* Selector de Contrato Activo */}
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
            disabled={!clienteId || alquileresDelCliente.length === 0}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all disabled:opacity-50"
            required
          >
            <option value="">
              {!clienteId
                ? "-- Primero seleccione un inquilino --"
                : alquileresDelCliente.length === 0
                ? "-- Sin contratos activos --"
                : "-- Seleccione contrato --"}
            </option>
            {alquileresDelCliente.map((a) => (
              <option key={a.id} value={a.id}>
                {a.descripcion_inmueble} (S/ {a.monto_mensual}/mes)
              </option>
            ))}
          </select>
        </div>

        {/* Período Mes/Año */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Mes a Cobrar *
            </label>
            <select
              value={periodoMes}
              onChange={(e) => setPeriodoMes(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
            >
              {MESES.map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Año *
            </label>
            <input
              type="number"
              value={periodoAnio}
              onChange={(e) => setPeriodoAnio(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Monto Recibido (S/) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.1"
              placeholder="Ej: 800.00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Fecha de Pago
            </label>
            <input
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Método de Pago
          </label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
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

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Comprobante / Voucher (opcional)
          </label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setComprobanteFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
          />
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
