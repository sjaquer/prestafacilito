import React, { useEffect, useState } from "react";
import { Info, AlertCircle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { round2 } from "../../lib/formatters";
import { usePrestamos } from "../../hooks/usePrestamos";

const DURACIONES_ALQUILER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24];

interface EditarPrestamoModalProps {
  loan: any;
  onClose: () => void;
  onSaved: () => void;
}

/** Duración en meses de un contrato de alquiler a partir de sus fechas (mínimo 1, por defecto 6). */
const duracionAlquiler = (loan: any) => {
  const start = new Date(loan.fecha_emision + "T12:00:00");
  const end = loan.fecha_vencimiento ? new Date(loan.fecha_vencimiento + "T12:00:00") : null;
  if (end && !isNaN(end.getTime()) && !isNaN(start.getTime())) {
    return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
  }
  return 6;
};

export const EditarPrestamoModal: React.FC<EditarPrestamoModalProps> = ({ loan, onClose, onSaved }) => {
  const { updatePrestamo } = usePrestamos();
  const isAlquiler = loan.tipo_prestamo === "Alquiler de Casa";
  const duracionInicial = isAlquiler ? duracionAlquiler(loan) : 6;

  const [fechaEmision, setFechaEmision] = useState<string>(loan.fecha_emision);
  const [fechaVencimiento, setFechaVencimiento] = useState<string>(loan.fecha_vencimiento || "");
  const [montoCapital, setMontoCapital] = useState(String(loan.monto_capital || ""));
  const [tasaInteres, setTasaInteres] = useState(String(loan.tasa_interes_porcentaje || ""));
  const [montoMensual, setMontoMensual] = useState(
    isAlquiler ? String(round2(parseFloat(loan.monto_capital) / duracionInicial)) : ""
  );
  const [duracionMeses, setDuracionMeses] = useState(String(duracionInicial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // En alquileres, el fin de contrato se calcula a partir de inicio + duración
  useEffect(() => {
    if (!isAlquiler || !fechaEmision) return;
    const d = new Date(fechaEmision + "T12:00:00");
    d.setMonth(d.getMonth() + parseInt(duracionMeses || "6"));
    setFechaVencimiento(d.toISOString().split("T")[0]);
  }, [isAlquiler, fechaEmision, duracionMeses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    let finalCapital = parseFloat(montoCapital);
    let finalTasa = parseFloat(tasaInteres);
    if (isAlquiler) {
      finalCapital = parseFloat(montoMensual) * parseInt(duracionMeses);
      finalTasa = 0; // Tasa es 0 para alquileres
    }

    setSaving(true);
    const res = await updatePrestamo(loan.id, {
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento || null,
      monto_capital: finalCapital || undefined,
      tasa_interes_porcentaje: finalTasa,
    });
    setSaving(false);

    if (res.success) {
      onSaved();
    } else {
      setError(res.error || "No se pudo actualizar la información del préstamo.");
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isAlquiler ? `Editar Contrato de Alquiler: ${loan.cliente_nombre}` : `Editar Parámetros: ${loan.cliente_nombre}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 font-sans select-none">
        <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-[10.5px] font-bold text-indigo-700 leading-normal flex items-start gap-2.5">
          <Info size={14} className="shrink-0 mt-0.5 text-indigo-650" />
          <span>
            {isAlquiler
              ? "Editar estos valores recalcula automáticamente la mensualidad y cronograma de cobros para este alquiler. Los cambios se sincronizarán con Google Calendar de inmediato."
              : "Editar estos valores recalcula automáticamente el capital, tasa y cronograma de cobros para este crédito. Los cambios se sincronizarán con Google Calendar de inmediato."}
          </span>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-bold">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isAlquiler ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Monto Mensual (S/.) *"
                type="number"
                step="any"
                required
                value={montoMensual}
                onChange={(e) => setMontoMensual(e.target.value)}
              />
              <div className="flex flex-col gap-1.5 w-full">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block pl-0.5">
                  Duración (Meses) *
                </label>
                <select
                  value={duracionMeses}
                  onChange={(e) => setDuracionMeses(e.target.value)}
                  className="w-full h-11 px-4 glass-input rounded-xl border border-slate-200 outline-none bg-white cursor-pointer text-slate-800 text-xs font-bold"
                >
                  {DURACIONES_ALQUILER.map((m) => (
                    <option key={m} value={m} className="bg-white text-slate-800">
                      {m} {m === 1 ? "Mes" : "Meses"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Fecha de Inicio de Contrato *"
                type="date"
                required
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
              />
              <Input label="Fin del Contrato (Auto)" type="date" required disabled className="opacity-60" value={fechaVencimiento} />
            </div>
          </>
        ) : (
          <>
            <Input
              label="Monto Capital Inicial (S/.)"
              type="number"
              step="0.01"
              required
              value={montoCapital}
              onChange={(e) => setMontoCapital(e.target.value)}
            />
            <Input
              label="Tasa de Interés Mensual (%)"
              type="number"
              step="0.1"
              required
              value={tasaInteres}
              onChange={(e) => setTasaInteres(e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Fecha de Emisión"
                type="date"
                required
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
              />
              <Input
                label="Fecha de Vencimiento Final"
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/80 mt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="h-11 font-bold text-xs">
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving} className="h-11 font-bold text-xs px-5">
            Guardar Parámetros
          </Button>
        </div>
      </form>
    </Modal>
  );
};
