import React, { useState } from "react";
import { PlusCircle, CheckCircle, AlertCircle } from "lucide-react";
import { Cliente, Prestamo } from "../../types";
import { ClienteAutocomplete } from "../common/ClienteAutocomplete";
import { GuiaPagos } from "../prestamo/GuiaPagos";
import { hoyISO } from "../../lib/fechas";

interface CrearPrestamoFormProps {
  /** Sin tarjeta ni título (para usar dentro de un modal). */
  bare?: boolean;
  clientes: Cliente[];
  onPrestamoCreado: (nuevoPrestamo: Prestamo) => void;
  onClienteCreado?: (nuevoCliente: Cliente) => void;
  /** Cliente preseleccionado (al crear desde la ficha del cliente). */
  clienteIdInicial?: string;
}

export const CrearPrestamoForm: React.FC<CrearPrestamoFormProps> = ({
  clientes,
  onPrestamoCreado,
  onClienteCreado,
  bare = false,
  clienteIdInicial = "",
}) => {
  const [clienteId, setClienteId] = useState(clienteIdInicial);
  const [montoCapital, setMontoCapital] = useState("");
  const [tasaInteres, setTasaInteres] = useState("10");
  const [fechaEmision, setFechaEmision] = useState(hoyISO());
  const [tipoPrestamo, setTipoPrestamo] = useState("Personal");
  const [notas, setNotas] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const capitalNum = parseFloat(montoCapital) || 0;
  const tasaNum = parseFloat(tasaInteres) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId) {
      setErrorMsg("Debe seleccionar un cliente");
      return;
    }
    if (capitalNum <= 0) {
      setErrorMsg("El monto capital debe ser mayor a 0");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/prestamos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          monto_capital: capitalNum,
          tasa_interes_porcentaje: tasaNum,
          fecha_emision: fechaEmision,
          tipo_prestamo: tipoPrestamo,
          notas
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al registrar el préstamo");
      }

      const nuevoPrestamo: Prestamo = await res.json();
      setSuccessMsg("¡Préstamo registrado exitosamente!");
      onPrestamoCreado(nuevoPrestamo);

      // Limpiar campos
      setMontoCapital("");
      setNotas("");
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error al registrar el préstamo");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={bare ? "space-y-4" : "bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4"}>
      {!bare && (
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Crear Nuevo Préstamo</h2>
            <p className="text-xs text-slate-500">Registra el préstamo y su cronograma</p>
          </div>
        </div>
      </div>
      )}

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
        {/* Buscador de Cliente con creación rápida */}
        <ClienteAutocomplete
          clientes={clientes}
          selectedClienteId={clienteId}
          onSelectCliente={setClienteId}
          onClienteCreado={onClienteCreado}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Capital (S/) *
            </label>
            <input
              type="number"
              step="0.01"
              min="1"
              placeholder="Ej: 1000"
              value={montoCapital}
              onChange={(e) => setMontoCapital(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-50 transition-all"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Tasa Mensual (%) *
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder="Ej: 10"
              value={tasaInteres}
              onChange={(e) => setTasaInteres(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-50 transition-all"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Fecha de Emisión
            </label>
            <input
              type="date"
              value={fechaEmision}
              onChange={(e) => setFechaEmision(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-50 transition-all"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Tipo de Préstamo
            </label>
            <select
              value={tipoPrestamo}
              onChange={(e) => setTipoPrestamo(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-50 transition-all"
            >
              <option value="Personal">Personal</option>
              <option value="Negocio">Negocio</option>
              <option value="Hipotecario">Hipotecario</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Notas libres (opcional)
          </label>
          <textarea
            rows={2}
            placeholder="Observaciones adicionales sobre este préstamo..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-50 transition-all resize-none"
          />
        </div>

        {/* Guía de pagos para el cliente (no se guarda ni limita los pagos) */}
        <GuiaPagos capital={capitalNum} tasa={tasaNum} />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isLoading ? "Registrando Préstamo..." : "Registrar Préstamo"}
        </button>
      </form>
    </div>
  );
};
