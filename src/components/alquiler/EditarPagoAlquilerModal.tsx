import React, { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useFeedback } from "../ui/Feedback";
import { METODOS_PAGO } from "../../lib/constants";
import { MESES } from "./alquilerUtils";

interface EditarPagoAlquilerModalProps {
  alquilerId: string;
  pago: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const fieldClass =
  "w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-indigo-500";
const labelClass = "text-[11px] font-bold text-slate-600 block mb-1";

/** Edita monto, fecha, periodo y método de un pago de alquiler. */
export const EditarPagoAlquilerModal: React.FC<EditarPagoAlquilerModalProps> = ({ alquilerId, pago, onClose, onSaved }) => {
  const { notify } = useFeedback();
  const [form, setForm] = useState({ monto: "", fecha_pago: "", periodo_mes: 1, periodo_anio: 2026, metodo_pago: "Efectivo" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pago) return;
    setForm({
      monto: String(pago.monto ?? ""),
      fecha_pago: (pago.fecha_pago || "").split("T")[0],
      periodo_mes: pago.periodo_mes || 1,
      periodo_anio: pago.periodo_anio || new Date().getFullYear(),
      metodo_pago: pago.metodo_pago || "Efectivo",
    });
  }, [pago]);

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const metodos = METODOS_PAGO.includes(form.metodo_pago as any) ? METODOS_PAGO : [form.metodo_pago, ...METODOS_PAGO];

  const handleSave = async () => {
    if (!pago) return;
    if (!(parseFloat(form.monto) > 0) || !form.fecha_pago) {
      notify("Completa monto y fecha correctamente.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/alquileres/${alquilerId}/pagos/${pago.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, monto: parseFloat(form.monto) }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "No se pudo actualizar el pago");
      }
      onSaved();
    } catch (err: any) {
      notify(err.message || "Error al guardar el pago");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={!!pago}
      onClose={onClose}
      title="Editar pago de alquiler"
      size="sm"
      footerActions={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
            Guardar
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="epa-mes">Mes</label>
          <select id="epa-mes" value={form.periodo_mes} onChange={(e) => update({ periodo_mes: parseInt(e.target.value, 10) })} className={fieldClass}>
            {MESES.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="epa-anio">Año</label>
          <input
            id="epa-anio"
            type="number"
            inputMode="numeric"
            value={form.periodo_anio}
            onChange={(e) => update({ periodo_anio: parseInt(e.target.value, 10) || form.periodo_anio })}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="epa-monto">Monto (S/)</label>
          <input
            id="epa-monto"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.monto}
            onChange={(e) => update({ monto: e.target.value })}
            className={`${fieldClass} font-mono font-bold`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="epa-fecha">Fecha</label>
          <input id="epa-fecha" type="date" value={form.fecha_pago} onChange={(e) => update({ fecha_pago: e.target.value })} className={fieldClass} />
        </div>
        <div className="col-span-2">
          <label className={labelClass} htmlFor="epa-metodo">Método / cuenta</label>
          <select id="epa-metodo" value={form.metodo_pago} onChange={(e) => update({ metodo_pago: e.target.value })} className={fieldClass}>
            {metodos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
};
