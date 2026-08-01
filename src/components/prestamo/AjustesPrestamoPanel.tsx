import React, { useState } from "react";
import { ShieldCheck, Plus, CheckCircle, AlertCircle, Trash2, FileText } from "lucide-react";
import { AjustePrestamo } from "../../types";

interface AjustesPrestamoPanelProps {
  prestamoId: string;
  ajustes: AjustePrestamo[];
  totalCuotas: number;
  onAjusteActualizado: () => void;
}

export const AjustesPrestamoPanel: React.FC<AjustesPrestamoPanelProps> = ({
  prestamoId,
  ajustes,
  totalCuotas,
  onAjusteActualizado
}) => {
  const [tipoAjuste, setTipoAjuste] = useState<"congelar_interes_temporal" | "acuerdo_especial">("congelar_interes_temporal");
  const [cuotaNumero, setCuotaNumero] = useState<number>(1);
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split("T")[0]);
  const [fechaFin, setFechaFin] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [motivo, setMotivo] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/prestamos/ajustes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prestamo_id: prestamoId,
          tipo: tipoAjuste,
          cuota_numero: tipoAjuste === "congelar_interes_temporal" ? cuotaNumero : null,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin || null,
          descripcion,
          motivo
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "No se pudo registrar el ajuste");
      }

      setSuccessMsg("¡Ajuste registrado correctamente!");
      onAjusteActualizado();
      setDescripcion("");
      setMotivo("");
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar el ajuste");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDesactivarAjuste = async (ajusteId: string) => {
    if (!window.confirm("¿Seguro que deseas desactivar este ajuste?")) return;

    try {
      const res = await fetch(`/api/prestamos/ajustes/${ajusteId}/desactivar`, {
        method: "PUT"
      });

      if (res.ok) {
        onAjusteActualizado();
      }
    } catch (err) {
      console.error("Error al desactivar ajuste:", err);
    }
  };

  const activos = ajustes.filter((a) => a.activo);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Ajustes y Facilidades de Pago</h3>
            <p className="text-xs text-slate-500">Modelos simplificados de la Fase 5</p>
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

      {/* Toggle tipo de ajuste */}
      <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setTipoAjuste("congelar_interes_temporal")}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            tipoAjuste === "congelar_interes_temporal"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          ❄️ Congelar Interés de Cuota
        </button>
        <button
          type="button"
          onClick={() => setTipoAjuste("acuerdo_especial")}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            tipoAjuste === "acuerdo_especial"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          📝 Acuerdo Especial
        </button>
      </div>

      {/* Formulario de Registro */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {tipoAjuste === "congelar_interes_temporal" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Cuota a Congelar
              </label>
              <select
                value={cuotaNumero}
                onChange={(e) => setCuotaNumero(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
              >
                {Array.from({ length: totalCuotas }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Cuota {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Fecha Inicio
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
        ) : (
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Descripción del Acuerdo Especial
            </label>
            <textarea
              rows={2}
              placeholder="Detalle los términos del acuerdo especial acordado con el cliente..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
              required
            />
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Motivo o Justificación
          </label>
          <input
            type="text"
            placeholder="Ej: Viaje del cliente, caso fortuito, etc."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>{isLoading ? "Registrando..." : "Registrar Ajuste"}</span>
        </button>
      </form>

      {/* Lista de Ajustes Activos */}
      {activos.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <span className="text-xs font-bold text-slate-700 block">Ajustes Activos:</span>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {activos.map((a) => (
              <div
                key={a.id}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-slate-800 block">
                    {a.tipo === "congelar_interes_temporal"
                      ? `Congelar Interés (Cuota ${a.cuota_numero || "Varias"})`
                      : "Acuerdo Especial"}
                  </span>
                  {a.descripcion && (
                    <span className="text-[11px] text-slate-500 block">{a.descripcion}</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDesactivarAjuste(a.id)}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title="Desactivar ajuste"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
