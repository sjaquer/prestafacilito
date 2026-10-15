import React, { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { ClienteAutocomplete } from "../common/ClienteAutocomplete";
import { useClientes } from "../../hooks/useClientes";

interface EditarPrestamoFormProps {
  prestamo: any;
  onSaved: () => void;
  onError: (msg: string) => void;
  onSyncCalendar: () => void;
  isSyncingCalendar: boolean;
}

const TIPOS_PRESTAMO = ["Personal", "Negocio", "Hipotecario"];

const labelClass = "block text-[11px] font-bold text-slate-600 mb-1";
const fieldClass =
  "w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10";

const diaDe = (fecha: string) => (fecha ? parseInt(fecha.split("-")[2], 10) : NaN);

/** Reemplaza el día de una fecha ISO respetando el último día del mes. */
const conDia = (fecha: string, dia: number) => {
  const parts = fecha.split("-");
  if (parts.length !== 3) return fecha;
  const maxDays = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getDate();
  return `${parts[0]}-${parts[1]}-${String(Math.min(dia, maxDays)).padStart(2, "0")}`;
};

/** Edición de todos los datos de un préstamo. El cálculo del cronograma lo rehace el servidor. */
export const EditarPrestamoForm: React.FC<EditarPrestamoFormProps> = ({
  prestamo,
  onSaved,
  onError,
  onSyncCalendar,
  isSyncingCalendar,
}) => {
  const { clientes } = useClientes();
  const [clienteId, setClienteId] = useState<string>(prestamo.cliente_id);
  const [tipo, setTipo] = useState<string>(prestamo.tipo_prestamo || "Personal");
  const [capital, setCapital] = useState(String(prestamo.monto_capital ?? ""));
  const [tasa, setTasa] = useState(String(prestamo.tasa_interes_porcentaje ?? 0));
  const [fechaEmision, setFechaEmision] = useState<string>(prestamo.fecha_emision || "");
  const [fechaVenc, setFechaVenc] = useState<string>(prestamo.fecha_vencimiento || "");
  const [diaPago, setDiaPago] = useState(() => {
    const dia = diaDe(prestamo.fecha_vencimiento || "") || diaDe(prestamo.fecha_emision || "");
    return String(dia || 1);
  });
  const [notas, setNotas] = useState(prestamo.notas || "");
  const [isSaving, setIsSaving] = useState(false);

  const tipos = TIPOS_PRESTAMO.includes(tipo) ? TIPOS_PRESTAMO : [...TIPOS_PRESTAMO, tipo];
  const cambiaCalculo =
    Number(capital) !== Number(prestamo.monto_capital) ||
    Number(tasa) !== Number(prestamo.tasa_interes_porcentaje) ||
    fechaEmision !== (prestamo.fecha_emision || "") ||
    fechaVenc !== (prestamo.fecha_vencimiento || "");

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
    if (!clienteId) {
      onError("Selecciona un cliente");
      return;
    }
    if (!(parseFloat(capital) > 0)) {
      onError("El capital debe ser mayor a 0");
      return;
    }

    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        tipo_prestamo: tipo,
        monto_capital: parseFloat(capital),
        tasa_interes_porcentaje: parseFloat(tasa) || 0,
        fecha_emision: fechaEmision || null,
        fecha_vencimiento: fechaVenc || null,
        notas,
      };
      if (clienteId !== prestamo.cliente_id) body.cliente_id = clienteId;

      const res = await fetch(`/api/prestamos/${prestamo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "No se pudo actualizar el préstamo");
      }
      onSaved();
    } catch (err: any) {
      onError(err.message || "Error al guardar los cambios");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <ClienteAutocomplete
        clientes={clientes}
        selectedClienteId={clienteId}
        onSelectCliente={setClienteId}
        label="Cliente"
        required
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="edit-tipo">Tipo de préstamo</label>
          <select id="edit-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${fieldClass} font-semibold`}>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-capital">Capital prestado (S/)</label>
          <input
            id="edit-capital"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            className={`${fieldClass} font-mono font-bold`}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-tasa">Tasa de interés mensual (%)</label>
          <input
            id="edit-tasa"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={tasa}
            onChange={(e) => setTasa(e.target.value)}
            className={`${fieldClass} font-mono font-bold`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-dia">Día de pago mensual</label>
          <select
            id="edit-dia"
            value={diaPago}
            onChange={(e) => handleDiaPagoChange(parseInt(e.target.value, 10))}
            className={`${fieldClass} font-semibold`}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Día {d} de cada mes
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-emision">Fecha de inicio</label>
          <input
            id="edit-emision"
            type="date"
            value={fechaEmision}
            onChange={(e) => handleFechaEmisionChange(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-venc">Fecha de vencimiento</label>
          <input id="edit-venc" type="date" value={fechaVenc} onChange={(e) => setFechaVenc(e.target.value)} className={fieldClass} />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="edit-notas">Notas</label>
        <textarea
          id="edit-notas"
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas o acuerdos con el cliente..."
          className={`${fieldClass} h-auto py-2 resize-none`}
        />
      </div>

      {cambiaCalculo && (
        <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Cambiar capital, tasa o fechas recalcula el cronograma, la mora y el saldo con los pagos ya registrados.
        </p>
      )}

      <p className="text-[11px] text-slate-500">
        El estado (activo, estancado o liquidado) se actualiza solo según los pagos.
      </p>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onSyncCalendar}
          disabled={isSyncingCalendar}
          className="h-11 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCalendar ? "animate-spin" : ""}`} /> Sincronizar Google Calendar
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition shadow-sm disabled:opacity-50"
        >
          {isSaving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
};
