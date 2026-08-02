import React, { useState, useEffect } from "react";
import { DollarSign, CheckCircle, AlertCircle, Upload, ShieldCheck } from "lucide-react";
import { Cliente, Prestamo } from "../../types";
import { ClienteAutocomplete } from "../common/ClienteAutocomplete";

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
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Préstamos filtrados por el cliente seleccionado
  const prestamosDelCliente = prestamosActivos.filter(
    (p) => p.cliente_id === clienteId && p.estado === "activo"
  );

  // Si viene un prestamoId desde el padre (ej. al presionar "Registrar Pago" en una tarjeta)
  useEffect(() => {
    if (selectedPrestamoIdFromParent) {
      const p = prestamosActivos.find((item) => item.id === selectedPrestamoIdFromParent);
      if (p) {
        setClienteId(p.cliente_id);
        setPrestamoId(p.id);
      }
    }
  }, [selectedPrestamoIdFromParent, prestamosActivos]);

  // Al seleccionar cliente, si solo tiene 1 préstamo activo, autoseleccionarlo
  useEffect(() => {
    if (clienteId && prestamosDelCliente.length === 1) {
      setPrestamoId(prestamosDelCliente[0].id);
    } else if (!clienteId) {
      setPrestamoId("");
    }
  }, [clienteId]);

  const prestamoSeleccionado = prestamosActivos.find((p) => p.id === prestamoId) || null;

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
      let comprobanteUrl = "";
      let voucherDriveFileId = "";

      // Subir archivo de comprobante si fue adjuntado
      if (comprobanteFile) {
        const formData = new FormData();
        formData.append("file", comprobanteFile);
        formData.append("cliente_id", clienteId);
        formData.append("prestamo_id", prestamoId);

        const uploadRes = await fetch("/api/upload-voucher", {
          method: "POST",
          body: formData
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          comprobanteUrl = uploadData.fileUrl || uploadData.proxyUrl || "";
          voucherDriveFileId = uploadData.driveFileId || "";
        }
      }

      const res = await fetch("/api/amortizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prestamo_id: prestamoId,
          monto: montoNum,
          fecha_pago: fechaPago,
          metodo_pago: metodoPago,
          comprobante_url: comprobanteUrl || null,
          voucher_drive_file_id: voucherDriveFileId || null
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al registrar el pago");
      }

      setSuccessMsg("¡Pago registrado correctamente!");
      onPagoRegistrado();

      // Limpiar campos
      setMonto("");
      setComprobanteFile(null);
    } catch (err: any) {
      setErrorMsg(err.message || "No se pudo registrar el pago");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Registrar Pago</h2>
            <p className="text-xs text-slate-500">Sección B — Abonos y amortizaciones de deudas</p>
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
        {/* Selector de Cliente */}
        <ClienteAutocomplete
          clientes={clientes}
          selectedClienteId={clienteId}
          onSelectCliente={setClienteId}
          placeholder="Buscar cliente para abonar..."
          required
        />

        {/* Selector Dinámico de Préstamo Activo */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Préstamo Activo *
          </label>
          <select
            value={prestamoId}
            onChange={(e) => setPrestamoId(e.target.value)}
            disabled={!clienteId || prestamosDelCliente.length === 0}
            className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all disabled:opacity-50"
            required
          >
            <option value="">
              {!clienteId
                ? "-- Primero seleccione un cliente --"
                : prestamosDelCliente.length === 0
                ? "-- Sin préstamos activos --"
                : "-- Seleccione un préstamo --"}
            </option>
            {prestamosDelCliente.map((p) => (
              <option key={p.id} value={p.id}>
                {p.tipo_prestamo} (Capital S/ {p.monto_capital}) - Emisión: {p.fecha_emision}
              </option>
            ))}
          </select>
        </div>

        {prestamoSeleccionado && (
          <div className="p-2.5 bg-blue-50/60 border border-blue-150 rounded-xl text-xs flex items-center justify-between text-blue-900 font-medium">
            <span>Capital Original: S/ {prestamoSeleccionado.monto_capital}</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> Tasa {prestamoSeleccionado.tasa_interes_porcentaje}%
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Monto del Abono (S/) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.1"
              placeholder="Ej: 300"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Fecha del Pago
            </label>
            <input
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all"
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
            className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all"
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
          <div className="relative">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setComprobanteFile(e.target.files?.[0] || null)}
              className="hidden"
              id="voucher-input"
            />
            <label
              htmlFor="voucher-input"
              className="w-full px-3 py-2 bg-slate-50/50 border border-dashed border-slate-300 hover:border-blue-400 rounded-xl text-xs text-slate-600 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4 text-slate-400" />
              <span>
                {comprobanteFile ? comprobanteFile.name : "Subir comprobante o captura"}
              </span>
            </label>
          </div>
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
