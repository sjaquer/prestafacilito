import React, { useState } from "react";
import { PlusCircle, Calculator, CheckCircle, AlertCircle } from "lucide-react";
import { Cliente, Prestamo } from "../../types";
import { ClienteAutocomplete } from "../common/ClienteAutocomplete";
import { usePreviewCuotas } from "../../hooks/usePreviewCuotas";

interface CrearPrestamoFormProps {
  clientes: Cliente[];
  onPrestamoCreado: (nuevoPrestamo: Prestamo) => void;
  onClienteCreado?: (nuevoCliente: Cliente) => void;
}

export const CrearPrestamoForm: React.FC<CrearPrestamoFormProps> = ({
  clientes,
  onPrestamoCreado,
  onClienteCreado
}) => {
  const [clienteId, setClienteId] = useState("");
  const [montoCapital, setMontoCapital] = useState("");
  const [tasaInteres, setTasaInteres] = useState("10");
  const [numeroCuotas, setNumeroCuotas] = useState("3");
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split("T")[0]);
  const [tipoPrestamo, setTipoPrestamo] = useState("Personal");
  const [notas, setNotas] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const capitalNum = parseFloat(montoCapital) || 0;
  const tasaNum = parseFloat(tasaInteres) || 0;
  const cuotasNum = parseInt(numeroCuotas, 10) || 0;

  const preview = usePreviewCuotas(capitalNum, tasaNum, cuotasNum);

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
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Crear Nuevo Préstamo</h2>
            <p className="text-xs text-slate-500">Sección A — Registro directo y reactivo</p>
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
              Cuotas Mensuales *
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={numeroCuotas}
              onChange={(e) => setNumeroCuotas(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-50 transition-all"
              required
            />
          </div>

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

        {/* Previsualización Reactiva de Cuotas (TAREA 4.3.1.A) */}
        {preview && (
          <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-700 border-b border-slate-200/60 pb-1.5">
              <span className="flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                Previsualización de Cuotas
              </span>
              <span className="text-[11px] font-normal text-slate-500">Modelo Francés</span>
            </div>

            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {preview.cuotas.map((c) => (
                <div key={c.numero} className="flex justify-between items-center py-1 px-2 bg-white rounded border border-slate-150 text-[11px]">
                  <span className="font-semibold text-slate-700">Cuota {c.numero}</span>
                  <span className="text-slate-500">Amort. S/{c.amortizacion.toFixed(2)} + Int. S/{c.interes.toFixed(2)}</span>
                  <span className="font-bold text-emerald-700">S/ {c.cuotaTotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="pt-1 border-t border-slate-200/60 flex justify-between font-bold text-slate-800 text-[11px]">
              <span>Total Intereses: <span className="text-amber-600">S/ {preview.totalIntereses.toFixed(2)}</span></span>
              <span>Total a Pagar: <span className="text-emerald-700">S/ {preview.totalAPagar.toFixed(2)}</span></span>
            </div>
          </div>
        )}

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
