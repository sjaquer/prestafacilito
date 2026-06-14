import React, { useState, useMemo } from "react";
import { CalendarDays, HelpCircle, HeartHandshake, ShieldCheck, AlertCircle } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Tooltip } from "../ui/Tooltip";
import { Badge } from "../ui/Badge";
import { formatDateShort } from "../../lib/formatters";

interface ProrrogaSectionProps {
  prestamo: any;
  cuotas: any[];
  ajustes: any[];
  onApplyProrroga: (data: { motivo: string; dias: number }) => Promise<boolean>;
}

export const ProrrogaSection: React.FC<ProrrogaSectionProps> = ({
  prestamo,
  cuotas,
  ajustes,
  onApplyProrroga,
}) => {
  const isAlquiler = prestamo?.tipo_prestamo === "Alquiler de Casa";
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Filtrar prórrogas previas (ajustes de gracia)
  const prorrogasPrevias = useMemo(() => {
    return ajustes.filter(a => a.tipo === "periodo_gracia" && a.activo);
  }, [ajustes]);

  // Encontrar la próxima cuota a pagar para saber la fecha original
  const proximaCuota = useMemo(() => {
    return cuotas.find(c => c.estado !== "Saldada") || null;
  }, [cuotas]);

  // Si tiene prórrogas anteriores activas
  const totalProrrogasCount = prorrogasPrevias.length;
  const maxProrrogasPermitidas = 3;
  const isElegible = totalProrrogasCount < maxProrrogasPermitidas && !!proximaCuota && prestamo.estado === "activo";

  const handleApply = async () => {
    setError("");
    setSuccess(false);

    if (!motivo.trim()) {
      setError("Debe proporcionar un motivo válido para la prórroga.");
      return;
    }

    setSubmitting(true);
    const successResult = await onApplyProrroga({
      motivo: motivo.trim(),
      dias: 7, // 7 días estándar de prorroga
    });

    setSubmitting(false);
    if (successResult) {
      setSuccess(true);
      setMotivo("");
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const nuevaFechaEstimada = useMemo(() => {
    if (!proximaCuota) return "";
    const originalDate = new Date(`${proximaCuota.fechaVencimiento}T00:00:00`);
    originalDate.setDate(originalDate.getDate() + 7);
    return originalDate.toISOString().split("T")[0];
  }, [proximaCuota]);

  return (
    <Card variant="bento" className="select-none font-sans flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm md:text-base font-black text-slate-900 tracking-tight leading-none">Solicitar Prórroga de Plazo</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
              Extender el vencimiento de la {isAlquiler ? "mensualidad" : "cuota"} por 7 días
            </p>
          </div>
          <HeartHandshake className="text-indigo-650 shrink-0" size={16} />
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold rounded-2xl mb-3">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-250/70 text-emerald-700 text-xs font-bold rounded-2xl mb-3 flex items-center gap-1">
            <ShieldCheck size={14} className="shrink-0 text-emerald-600" />
            <span>¡Prórroga de plazo concedida y {isAlquiler ? "mensualidades" : "cuotas"} recalculadas de forma correcta!</span>
          </div>
        )}

        {/* Resumen Prórrogas */}
        <div className="grid grid-cols-2 gap-3 text-xs font-semibold mb-4 bg-slate-50 border border-slate-200 p-3 rounded-2xl">
          <div className="flex flex-col">
            <span className="text-slate-500 text-[10px] uppercase">Prórrogas Concedidas</span>
            <span className="text-slate-800 mt-0.5 font-bold">
              {totalProrrogasCount} de {maxProrrogasPermitidas}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-slate-500 text-[10px] uppercase">Elegibilidad</span>
            <span className={`mt-0.5 font-black ${isElegible ? "text-emerald-600" : "text-rose-600"}`}>
              {isElegible ? "ELEGIBLE" : "NO APTO"}
            </span>
          </div>
        </div>

        {isElegible && proximaCuota ? (
          <div className="space-y-4">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-[11px] md:text-xs font-medium text-slate-700 leading-relaxed">
              <strong>Nota de Accesibilidad:</strong> Al otorgar esta prórroga, la fecha de vencimiento de la {isAlquiler ? "mensualidad" : "cuota"} actual ({formatDateShort(proximaCuota.fechaVencimiento)}) se desplazará **7 días adicionales** ({formatDateShort(nuevaFechaEstimada)}), y todas las {isAlquiler ? "mensualidades" : "cuotas"} futuras también se recalcularán automáticamente para no acortar sus ventanas de pago.
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-slate-550 uppercase tracking-wider block">
                Motivo de la Prórroga <span className="text-rose-650 font-bold">*</span>
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Retraso de mercadería de calzado..."
                className="glass-input w-full p-4 rounded-xl border border-slate-200 font-medium bg-white text-slate-800 focus:border-indigo-550 focus:ring-2 focus:ring-indigo-500/10 min-h-[70px] outline-none text-xs"
              />
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-center select-none py-8">
            <AlertCircle size={24} className="text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">
              {!proximaCuota 
                ? (isAlquiler ? "Contrato totalmente saldado" : "Crédito totalmente saldado")
                : totalProrrogasCount >= maxProrrogasPermitidas 
                  ? "Límite máximo de prórrogas alcanzado (3)" 
                  : (isAlquiler ? "El contrato no está activo a operar" : "El préstamo no está activo a operar")
              }
            </p>
          </div>
        )}
      </div>

      {isElegible && (
        <div className="mt-4 pt-4 border-t border-slate-200/80">
          <Button
            onClick={handleApply}
            variant="warning"
            loading={submitting}
            className="w-full h-11 font-bold"
          >
            Conceder Prórroga (Aa+)
          </Button>
        </div>
      )}
    </Card>
  );
};
export default ProrrogaSection;
