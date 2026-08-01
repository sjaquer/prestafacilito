import React, { useState } from "react";
import { Home, Plus, CheckCircle, AlertCircle } from "lucide-react";
import { Cliente, Alquiler } from "../../types";
import { ClienteAutocomplete } from "../common/ClienteAutocomplete";

interface CrearAlquilerFormProps {
  clientes: Cliente[];
  onAlquilerCreado: (nuevoAlquiler: Alquiler) => void;
  onClienteCreado?: (nuevoCliente: Cliente) => void;
}

export const CrearAlquilerForm: React.FC<CrearAlquilerFormProps> = ({
  clientes,
  onAlquilerCreado,
  onClienteCreado
}) => {
  const [clienteId, setClienteId] = useState("");
  const [descripcionInmueble, setDescripcionInmueble] = useState("");
  const [montoMensual, setMontoMensual] = useState("");
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1° del mes actual
    return d.toISOString().split("T")[0];
  });
  const [fechaFin, setFechaFin] = useState("");
  const [notas, setNotas] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clienteId) {
      setErrorMsg("Debe seleccionar un inquilino/cliente.");
      return;
    }
    if (!descripcionInmueble.trim()) {
      setErrorMsg("Debe ingresar la descripción o dirección del inmueble.");
      return;
    }
    const monto = parseFloat(montoMensual);
    if (!monto || monto <= 0) {
      setErrorMsg("El monto mensual debe ser mayor a 0.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/alquileres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          descripcion_inmueble: descripcionInmueble.trim(),
          monto_mensual: monto,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin || null,
          notas: notas.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al aperturar el contrato de alquiler");
      }

      const nuevoAlquiler = await res.json();
      setSuccessMsg("¡Contrato de alquiler aperturado correctamente!");
      onAlquilerCreado(nuevoAlquiler);

      // Limpiar campos
      setClienteId("");
      setDescripcionInmueble("");
      setMontoMensual("");
      setNotas("");
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar la solicitud");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Nuevo Contrato de Alquiler</h2>
            <p className="text-xs text-slate-500">Sección 8.3.2 — Renta mensual fija</p>
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
        {/* Selector Autocomplete de Inquilino */}
        <ClienteAutocomplete
          clientes={clientes}
          selectedClienteId={clienteId}
          onSelectCliente={setClienteId}
          onClienteCreado={onClienteCreado}
          placeholder="Buscar inquilino..."
          required
        />

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Descripción / Dirección del Inmueble *
          </label>
          <input
            type="text"
            placeholder="Ej: Casa Calle Lima 123 - Dpto 201"
            value={descripcionInmueble}
            onChange={(e) => setDescripcionInmueble(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Renta Mensual (S/) *
            </label>
            <input
              type="number"
              step="0.01"
              min="1"
              placeholder="Ej: 800.00"
              value={montoMensual}
              onChange={(e) => setMontoMensual(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Fecha de Inicio *
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Fecha de Fin (opcional — vacío para indefinido)
          </label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Notas u Observaciones
          </label>
          <textarea
            rows={2}
            placeholder="Cláusulas especiales, estado del inmueble, etc."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>{isLoading ? "Creando Contrato..." : "Aperturar Contrato de Alquiler"}</span>
        </button>
      </form>
    </div>
  );
};
