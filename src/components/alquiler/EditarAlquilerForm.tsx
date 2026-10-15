import React, { useState } from "react";
import { ClienteAutocomplete } from "../common/ClienteAutocomplete";
import { useClientes } from "../../hooks/useClientes";
import { useFeedback } from "../ui/Feedback";

interface EditarAlquilerFormProps {
  alquiler: any;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}

const fieldClass =
  "w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10";
const labelClass = "block text-[11px] font-bold text-slate-600 mb-1";

/** Edición completa del contrato de alquiler, incluido finalizar o reactivar. */
export const EditarAlquilerForm: React.FC<EditarAlquilerFormProps> = ({ alquiler, onSaved, onError }) => {
  const { confirm } = useFeedback();
  const { clientes } = useClientes();
  const [clienteId, setClienteId] = useState<string>(alquiler.cliente_id);
  const [descripcion, setDescripcion] = useState(alquiler.descripcion_inmueble || "");
  const [monto, setMonto] = useState(String(alquiler.monto_mensual ?? ""));
  const [fechaInicio, setFechaInicio] = useState<string>(alquiler.fecha_inicio || "");
  const [fechaFin, setFechaFin] = useState<string>(alquiler.fecha_fin || "");
  const [notas, setNotas] = useState(alquiler.notas || "");
  const [saving, setSaving] = useState(false);
  const isFinalizado = alquiler.estado === "finalizado";

  const guardar = async (extra: Record<string, unknown> = {}, mensaje = "Contrato actualizado") => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        descripcion_inmueble: descripcion,
        monto_mensual: parseFloat(monto),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || null,
        notas,
        ...extra,
      };
      if (clienteId !== alquiler.cliente_id) body.cliente_id = clienteId;

      const res = await fetch(`/api/alquileres/${alquiler.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "No se pudo actualizar el contrato");
      }
      onSaved(mensaje);
    } catch (err: any) {
      onError(err.message || "Error al guardar el contrato");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId) return onError("Selecciona un inquilino");
    if (!(parseFloat(monto) > 0)) return onError("La renta mensual debe ser mayor a 0");
    guardar();
  };

  const handleToggleEstado = async () => {
    if (isFinalizado) {
      const ok = await confirm({
        title: "Reactivar contrato",
        message: "El contrato volverá a generar mensualidades. Revisa la fecha de fin si corresponde.",
        confirmLabel: "Reactivar",
      });
      if (ok) guardar({ estado: "activo" }, "Contrato reactivado");
      return;
    }
    const ok = await confirm({
      title: "Finalizar contrato",
      message: `¿Confirmar que el alquiler de "${alquiler.descripcion_inmueble}" terminó? Se fijará la fecha de fin a hoy si no tiene una.`,
      confirmLabel: "Finalizar",
      danger: true,
    });
    if (ok) {
      const hoy = new Date().toISOString().split("T")[0];
      guardar({ estado: "finalizado", fecha_fin: fechaFin || hoy }, "Contrato finalizado");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <ClienteAutocomplete clientes={clientes} selectedClienteId={clienteId} onSelectCliente={setClienteId} label="Inquilino" required />

      <div>
        <label className={labelClass} htmlFor="ea-desc">Inmueble</label>
        <input id="ea-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={fieldClass} placeholder="Dirección o descripción" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass} htmlFor="ea-monto">Renta mensual (S/)</label>
          <input
            id="ea-monto"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className={`${fieldClass} font-mono font-bold`}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="ea-inicio">Inicio (fija el día de cobro)</label>
          <input id="ea-inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={fieldClass} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="ea-fin">Fin (vacío = indefinido)</label>
          <input id="ea-fin" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={fieldClass} />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="ea-notas">Notas</label>
        <textarea id="ea-notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} className={`${fieldClass} h-auto py-2 resize-none`} />
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={handleToggleEstado}
          disabled={saving}
          className={`h-11 px-4 text-xs font-bold rounded-xl transition disabled:opacity-50 ${
            isFinalizado ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700" : "bg-rose-50 hover:bg-rose-100 text-rose-700"
          }`}
        >
          {isFinalizado ? "Reactivar contrato" : "Finalizar contrato"}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition shadow-sm disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
