import React, { useState } from "react";
import { Edit3 } from "lucide-react";

interface EditarPrestamoFormProps {
  prestamo: any;
  onCancel: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}

const fieldClass =
  "w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-emerald-500";

const diaDe = (fecha: string) => (fecha ? parseInt(fecha.split("-")[2], 10) : NaN);

/** Reemplaza el día de una fecha ISO respetando el último día del mes. */
const conDia = (fecha: string, dia: number) => {
  const parts = fecha.split("-");
  if (parts.length !== 3) return fecha;
  const maxDays = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getDate();
  return `${parts[0]}-${parts[1]}-${String(Math.min(dia, maxDays)).padStart(2, "0")}`;
};

/** Formulario inline para editar fechas, día de pago, tasa y notas de un préstamo. */
export const EditarPrestamoForm: React.FC<EditarPrestamoFormProps> = ({ prestamo, onCancel, onSaved, onError }) => {
  const [fechaEmision, setFechaEmision] = useState<string>(prestamo.fecha_emision || "");
  const [fechaVenc, setFechaVenc] = useState<string>(prestamo.fecha_vencimiento || "");
  const [diaPago, setDiaPago] = useState(() => {
    const dia = diaDe(prestamo.fecha_vencimiento || "") || diaDe(prestamo.fecha_emision || "");
    return String(dia || 1);
  });
  const [tasa, setTasa] = useState(String(prestamo.tasa_interes_porcentaje || 0));
  const [notas, setNotas] = useState(prestamo.notas || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleDiaPagoChange = (nuevoDia: number) => {
    setDiaPago(String(nuevoDia));
    if (fechaEmision) setFechaEmision(conDia(fechaEmision, nuevoDia));
    if (fechaVenc) setFechaVenc(conDia(fechaVenc, nuevoDia));
  };

  const handleFechaEmisionChange = (val: string) => {
    setFechaEmision(val);
    const day = diaDe(val);
    if (!isNaN(day)) setDiaPago(String(day));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/prestamos/${prestamo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_emision: fechaEmision || null,
          fecha_vencimiento: fechaVenc || null,
          tasa_interes_porcentaje: parseFloat(tasa) || 0,
          notas,
        }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar el préstamo");
      onSaved();
    } catch (err: any) {
      onError(err.message || "Error al guardar los cambios");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
        <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
          <Edit3 className="w-4 h-4 text-emerald-600" /> Editar Parámetros y Día de Pago del Préstamo
        </h4>
        <span className="text-[11px] text-slate-500">Recalculará el cronograma de cuotas y fechas</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-slate-600 font-medium mb-1">Fecha de Inicio / Emisión</label>
          <input
            type="date"
            value={fechaEmision}
            onChange={(e) => handleFechaEmisionChange(e.target.value)}
            className={`${fieldClass} font-semibold`}
          />
        </div>

        <div>
          <label className="block text-slate-600 font-medium mb-1">Día de Pago Mensual Pactado</label>
          <select
            value={diaPago}
            onChange={(e) => handleDiaPagoChange(parseInt(e.target.value, 10))}
            className={`${fieldClass} font-bold`}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Día {d} de cada mes
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-600 font-medium mb-1">Fecha de Vencimiento</label>
          <input type="date" value={fechaVenc} onChange={(e) => setFechaVenc(e.target.value)} className={fieldClass} />
        </div>

        <div>
          <label className="block text-slate-600 font-medium mb-1">Tasa Interés (%)</label>
          <input
            type="number"
            step="0.1"
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
            className={`${fieldClass} font-semibold`}
          />
        </div>
      </div>

      <div>
        <label className="block text-slate-600 font-medium mb-1">Notas libres</label>
        <input
          type="text"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas o acuerdos con el cliente..."
          className={fieldClass}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1 border-t border-slate-200/60">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium hover:bg-slate-100 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-xs disabled:opacity-50"
        >
          {isSaving ? "Guardando..." : "Guardar Cambios y Recalcular"}
        </button>
      </div>
    </form>
  );
};
