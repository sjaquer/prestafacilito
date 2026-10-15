import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useFeedback } from "../ui/Feedback";
import { usePagos } from "../../hooks/usePagos";
import { METODOS_PAGO } from "../../lib/constants";
import { formatCurrency } from "../../lib/formatters";

interface EditarPagoModalProps {
  pago: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const labelClass = "text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-wider pl-0.5";
const fieldClass = "glass-input w-full px-4 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 h-12 text-xs";

/** Edita monto, fecha y método de un pago, o lo reasigna a otro préstamo del mismo cliente. */
export const EditarPagoModal: React.FC<EditarPagoModalProps> = ({ pago, onClose, onSaved }) => {
  const { notify } = useFeedback();
  const { updatePago } = usePagos();
  const [form, setForm] = useState({ prestamo_id: "", fecha_pago: "", monto: 0, metodo_pago: "" });
  const [clientLoans, setClientLoans] = useState<any[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!pago) return;
    setForm({
      prestamo_id: pago.prestamo_id,
      fecha_pago: pago.fecha_pago ? pago.fecha_pago.split("T")[0] : "",
      monto: pago.monto,
      metodo_pago: pago.metodo_pago,
    });
    setClientLoans([]);
    setLoadingLoans(true);
    fetch("/api/prestamos")
      .then((res) => (res.ok ? res.json() : []))
      .then((all: any[]) => setClientLoans(all.filter((l) => l.cliente_id === pago.cliente_id)))
      .catch((e) => console.error(e))
      .finally(() => setLoadingLoans(false));
  }, [pago]);

  const update = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (!pago) return;
    if (!form.prestamo_id || !form.fecha_pago || form.monto <= 0 || !form.metodo_pago) {
      notify("Por favor completa todos los campos correctamente.");
      return;
    }
    setSaving(true);
    try {
      const res = await updatePago(pago.id, form);
      if (res.success) {
        onSaved();
      } else {
        notify(res.error || "No se pudo actualizar el pago.");
      }
    } catch (e: any) {
      notify(e.message || "Error al conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={!!pago}
      onClose={onClose}
      title={`Editar Pago - ${pago?.cliente_nombre ?? ""}`}
      footerActions={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={saving} disabled={loadingLoans}>
            Guardar Cambios
          </Button>
        </div>
      }
    >
      {loadingLoans ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="animate-spin text-indigo-500 mb-3" size={28} />
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cargando préstamos del cliente...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Préstamo Destino</label>
            <select
              value={form.prestamo_id}
              onChange={(e) => update({ prestamo_id: e.target.value })}
              className={`${fieldClass} cursor-pointer`}
            >
              {clientLoans.length === 0 ? (
                <option value="">No se encontraron préstamos del cliente</option>
              ) : (
                clientLoans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {formatCurrency(l.monto_capital)} - {l.tipo_prestamo} ({String(l.estado).toUpperCase()})
                  </option>
                ))
              )}
            </select>
            <p className="text-[9px] text-slate-450 font-bold mt-1 pl-0.5 uppercase tracking-wide">
              * Muestra solo préstamos del cliente {pago?.cliente_nombre}
            </p>
          </div>

          <Input
            label="Monto del Pago (S/.)"
            type="number"
            step="0.01"
            value={form.monto || ""}
            onChange={(e) => update({ monto: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Fecha del Pago</label>
            <input
              type="date"
              value={form.fecha_pago}
              onChange={(e) => update({ fecha_pago: e.target.value })}
              className={fieldClass}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Método de Pago</label>
            <select
              value={form.metodo_pago}
              onChange={(e) => update({ metodo_pago: e.target.value })}
              className={`${fieldClass} cursor-pointer`}
            >
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </Modal>
  );
};
