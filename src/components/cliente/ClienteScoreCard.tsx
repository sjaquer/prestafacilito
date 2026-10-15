import React, { useCallback, useEffect, useState } from "react";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";
import { ScoreBadge } from "../ui/ScoreBadge";
import { useFeedback } from "../ui/Feedback";

type OverrideScore = "A" | "B" | "C" | "restablecer";

const SCORE_OPTIONS: { value: OverrideScore; label: string; active: string; idle: string }[] = [
  { value: "A", label: "A", active: "bg-emerald-600 text-white border-emerald-600", idle: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "B", label: "B", active: "bg-amber-500 text-white border-amber-500", idle: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "C", label: "C", active: "bg-red-600 text-white border-red-600", idle: "bg-red-50 text-red-700 border-red-200" },
  { value: "restablecer", label: "Auto", active: "bg-slate-800 text-white border-slate-800", idle: "bg-slate-100 text-slate-700 border-slate-200" },
];

const Stat: React.FC<{ label: string; value: React.ReactNode; valueClass: string }> = ({ label, value, valueClass }) => (
  <div className="p-2.5 bg-white border border-slate-200 rounded-xl">
    <span className="text-[10px] text-slate-400 font-bold block">{label}</span>
    <span className={`font-bold ${valueClass}`}>{value}</span>
  </div>
);

/** Tarjeta con el score de comportamiento de pago del cliente y su sobreescritura manual. */
export const ClienteScoreCard: React.FC<{ clienteId: string }> = ({ clienteId }) => {
  const { notify } = useFeedback();
  const [scoreData, setScoreData] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [overrideScore, setOverrideScore] = useState<OverrideScore>("A");
  const [motivo, setMotivo] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchScore = useCallback(async () => {
    try {
      const res = await fetch(`/api/clientes/${clienteId}/score`);
      if (res.ok) setScoreData(await res.json());
    } catch (err) {
      console.error("Error al cargar score del cliente:", err);
    }
  }, [clienteId]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/score/override`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score_manual: overrideScore === "restablecer" ? null : overrideScore, motivo }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "No se pudo guardar el score.");
      }
      setShowModal(false);
      setMotivo("");
      notify("Score actualizado", "success");
      await fetchScore();
    } catch (err: any) {
      notify(err.message || "Error al guardar el score.");
    } finally {
      setIsSaving(false);
    }
  };

  const detalle = scoreData?.detalle;

  return (
    <>
      <Card variant="simple" className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-slate-800 text-sm">Score de Comportamiento de Pago</h3>
            <ScoreBadge score={scoreData?.scoreEfectivo} sobreescrito={scoreData?.sobreescrito} size="md" />
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all self-start sm:self-auto"
          >
            ⚙️ Sobreescribir Score Manualmente
          </button>
        </div>

        {scoreData && detalle ? (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="font-semibold text-slate-600">Puntuación Numérica Calculada:</span>
              <span className="font-extrabold text-slate-900 text-sm">{scoreData.scoreNumerico} / 100</span>
            </div>

            {scoreData.sobreescrito && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 font-medium">
                <strong>Score Manual Activo ({scoreData.scoreManual}):</strong>{" "}
                {scoreData.motivoOverride || "Sin motivo especificado"}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
              <Stat label="Cuotas a Tiempo" value={`${detalle.cuotasPagadasATiempo} / ${detalle.cuotasTotales}`} valueClass="text-emerald-600" />
              <Stat label="Cuotas Completas" value={`${detalle.cuotasPagadasCompletas} / ${detalle.cuotasTotales}`} valueClass="text-slate-800" />
              <Stat label="Préstamos Liquidados" value={`${detalle.prestamosLiquidados} / ${detalle.prestamosTotales}`} valueClass="text-blue-600" />
              <Stat label="Atraso Promedio" value={`${detalle.diasAtrasoPromedio} días`} valueClass="text-red-600" />
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Cargando score del cliente...</p>
        )}
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Cambiar Score Manualmente" size="sm">
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Score calculado automáticamente: <strong>{scoreData?.scoreLetra || "Sin datos"}</strong>
          </p>

          <div>
            <label className="font-bold text-slate-700 block mb-1.5">Nuevo Score Manual:</label>
            <div className="grid grid-cols-4 gap-2">
              {SCORE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setOverrideScore(opt.value)}
                  aria-pressed={overrideScore === opt.value}
                  className={`py-2 rounded-xl border transition-all ${
                    opt.value === "restablecer" ? "font-bold text-[10px]" : "font-extrabold"
                  } ${overrideScore === opt.value ? opt.active : opt.idle}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Motivo u Observación:</label>
            <textarea
              rows={2}
              placeholder="Explique el motivo de la sobreescritura manual..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-indigo-500 transition-all resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Guardando..." : "Guardar Score"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
