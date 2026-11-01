import React, { useMemo, useState } from "react";
import { Calculator, Info } from "lucide-react";
import { planCuotaFija, planPagoFijo } from "../../lib/planPagos";
import { formatSoles } from "../../lib/formatters";

type Modo = "cuotas" | "monto";

/**
 * Guía para explicarle al cliente cómo podría pagar. No se guarda ni limita nada: el préstamo sigue siendo
 * libre (el mínimo de cada mes es el interés y lo que pague de más baja el capital).
 */
export const GuiaPagos: React.FC<{ capital: number; tasa: number }> = ({ capital, tasa }) => {
  const [modo, setModo] = useState<Modo>("cuotas");
  const [cuotas, setCuotas] = useState("3");
  const [monto, setMonto] = useState("");

  const interesMes = Math.round(capital * tasa) / 100;
  const plan = useMemo(
    () => (modo === "cuotas" ? planCuotaFija(capital, tasa, parseInt(cuotas, 10) || 0) : planPagoFijo(capital, tasa, parseFloat(monto) || 0)),
    [modo, capital, tasa, cuotas, monto]
  );

  if (!(capital > 0)) return null;

  const campo = "w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500";

  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="font-black text-slate-800 flex items-center gap-1.5">
          <Calculator className="w-4 h-4 text-emerald-600" /> Guía de pagos
        </p>
        <span className="text-[11px] text-slate-500 font-semibold">
          Mínimo: interés {formatSoles(interesMes)}/mes
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 bg-white rounded-xl border border-slate-200 font-bold">
        {(
          [
            ["cuotas", "En N cuotas"],
            ["monto", "Pagando S/ X al mes"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setModo(id)}
            aria-pressed={modo === id}
            className={`h-9 rounded-lg ${modo === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {modo === "cuotas" ? (
        <label className="block font-semibold text-slate-600">
          ¿En cuántos meses quiere terminar?
          <input type="number" min={1} max={120} inputMode="numeric" value={cuotas} onChange={(e) => setCuotas(e.target.value)} className={`${campo} mt-1`} />
        </label>
      ) : (
        <label className="block font-semibold text-slate-600">
          ¿Cuánto puede pagar cada mes?
          <input type="number" min={0} step="0.01" inputMode="decimal" placeholder="Ej: 300" value={monto} onChange={(e) => setMonto(e.target.value)} className={`${campo} mt-1`} />
        </label>
      )}

      {plan && plan.meses.length > 0 && (
        <>
          {plan.noTermina ? (
            <p className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
              Con ese monto solo cubre el interés ({formatSoles(interesMes)}): el capital no baja y el préstamo no termina.
            </p>
          ) : (
            <p className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold">
              {modo === "cuotas" ? (
                <>
                  Pagando <b className="font-mono">{formatSoles(plan.meses[0].pago)}</b> al mes, termina en {plan.meses.length} mes
                  {plan.meses.length === 1 ? "" : "es"}.
                </>
              ) : (
                <>
                  Termina en <b>{plan.meses.length} mes{plan.meses.length === 1 ? "" : "es"}</b>.
                </>
              )}{" "}
              Interés total <b className="font-mono">{formatSoles(plan.totalInteres)}</b> · paga en total{" "}
              <b className="font-mono">{formatSoles(plan.totalPagado)}</b>.
            </p>
          )}

          <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-50 text-slate-400 uppercase text-[9.5px] tracking-wide">
                <tr>
                  <th className="text-left font-bold px-2.5 py-1.5">Mes</th>
                  <th className="text-right font-bold px-2.5 py-1.5">Paga</th>
                  <th className="text-right font-bold px-2.5 py-1.5">Interés</th>
                  <th className="text-right font-bold px-2.5 py-1.5">A capital</th>
                  <th className="text-right font-bold px-2.5 py-1.5">Queda</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {plan.meses.map((m) => (
                  <tr key={m.numero} className="border-t border-slate-100">
                    <td className="px-2.5 py-1 font-sans font-bold text-slate-600">{m.numero}</td>
                    <td className="px-2.5 py-1 text-right font-bold text-slate-900">{formatSoles(m.pago)}</td>
                    <td className="px-2.5 py-1 text-right text-amber-700">{formatSoles(m.interes)}</td>
                    <td className="px-2.5 py-1 text-right text-emerald-700">{formatSoles(m.aCapital)}</td>
                    <td className="px-2.5 py-1 text-right text-slate-500">{formatSoles(m.capitalRestante)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-[10px] text-slate-400 flex gap-1 leading-snug">
        <Info className="w-3 h-3 shrink-0 mt-px" />
        Solo es una guía para el cliente: no se guarda ni limita los pagos. Puede pagar más o menos cada mes.
      </p>
    </div>
  );
};
