import React, { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, FileText, Loader2, RotateCcw, Snowflake, Trash2 } from "lucide-react";
import { AjustePrestamo } from "../../types";
import { addMonthsClamped, formatIsoDate } from "../../lib/loanLogic";
import { formatCurrency, formatDate } from "../../lib/formatters";
import { useFeedback } from "../ui/Feedback";
import { TimelineMesItem } from "./TimelineDetallePrestamo";

interface AjustesPrestamoPanelProps {
  prestamoId: string;
  fechaEmision: string;
  ajustes: AjustePrestamo[];
  timeline: TimelineMesItem[];
  onAjusteActualizado: () => void;
}

interface CuotaOpcion {
  numero: number;
  fecha: string;
  estado: string;
  interes?: number;
}

const ESTADO_TEXTO: Record<string, string> = {
  Saldada: "pagada",
  Pendiente: "por vencer",
  SinPago: "sin pago",
  PagoIncompleto: "incompleta",
  Vencida: "vencida",
  Parcial: "parcial",
  Futura: "futura",
};

/**
 * Cuotas que cubre un congelamiento según la misma regla del cálculo de préstamos:
 * se congela la cuota cuyo vencimiento cae entre fecha_inicio y fecha_fin (sin fin = todas las siguientes).
 */
const cuotasCubiertas = (aj: AjustePrestamo, cuotas: CuotaOpcion[]) =>
  cuotas.filter((c) => aj.fecha_inicio <= c.fecha && (!aj.fecha_fin || aj.fecha_fin >= c.fecha));

const rangoTexto = (nums: number[]) => {
  if (nums.length === 0) return "ninguna cuota";
  if (nums.length === 1) return `cuota ${nums[0]}`;
  return `cuotas ${nums[0]} a ${nums[nums.length - 1]}`;
};

const fieldClass =
  "w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:border-indigo-500";

/** Ajustes de ayuda al cliente: congelar el interés de cuotas concretas o anotar acuerdos especiales. */
export const AjustesPrestamoPanel: React.FC<AjustesPrestamoPanelProps> = ({
  prestamoId,
  fechaEmision,
  ajustes,
  timeline,
  onAjusteActualizado,
}) => {
  const { notify, confirm } = useFeedback();
  const [tipo, setTipo] = useState<"congelar_interes_temporal" | "acuerdo_especial">("congelar_interes_temporal");
  const [desde, setDesde] = useState<number>(0);
  const [hasta, setHasta] = useState<number>(0);
  const [descripcion, setDescripcion] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);

  // Cuotas del cronograma + las 3 siguientes (para poder congelar por adelantado)
  const cuotas: CuotaOpcion[] = useMemo(() => {
    const lista: CuotaOpcion[] = timeline.map((m) => ({ numero: m.numero, fecha: m.fechaVencimiento, estado: m.estado, interes: m.interesMes }));
    const ultima = lista.length;
    for (let n = ultima + 1; n <= ultima + 3; n++) {
      lista.push({ numero: n, fecha: formatIsoDate(addMonthsClamped(fechaEmision, n)), estado: "Futura" });
    }
    return lista;
  }, [timeline, fechaEmision]);

  const primeraPendiente = cuotas.find((c) => c.estado !== "Saldada")?.numero || cuotas[0]?.numero || 1;
  const desdeSel = desde || primeraPendiente;
  const hastaSel = Math.max(hasta || desdeSel, desdeSel);
  const fechaDe = (n: number) => cuotas.find((c) => c.numero === n)?.fecha || "";

  const activos = ajustes.filter((a) => a.activo);
  const inactivos = ajustes.filter((a) => !a.activo);

  const patch = async (ajuste: AjustePrestamo, cambios: Record<string, unknown>, mensaje: string) => {
    setOcupadoId(ajuste.id);
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}/ajustes/${ajuste.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "No se pudo actualizar el ajuste");
      }
      notify(mensaje, "success");
      onAjusteActualizado();
    } catch (err: any) {
      notify(err.message || "Error al actualizar el ajuste");
    } finally {
      setOcupadoId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tipo === "acuerdo_especial" && !descripcion.trim()) {
      notify("Describe el acuerdo antes de guardarlo");
      return;
    }
    setGuardando(true);
    try {
      const body =
        tipo === "congelar_interes_temporal"
          ? { tipo, cuota_numero: desdeSel, fecha_inicio: fechaDe(desdeSel), fecha_fin: fechaDe(hastaSel), motivo }
          : { tipo, descripcion, motivo };
      const res = await fetch(`/api/prestamos/${prestamoId}/ajustes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "No se pudo registrar el ajuste");
      }
      notify(tipo === "congelar_interes_temporal" ? `Interés congelado: ${rangoTexto(desdeSel === hastaSel ? [desdeSel] : [desdeSel, hastaSel])}` : "Acuerdo registrado", "success");
      setDescripcion("");
      setMotivo("");
      setDesde(0);
      setHasta(0);
      onAjusteActualizado();
    } catch (err: any) {
      notify(err.message || "Error al registrar el ajuste");
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async (aj: AjustePrestamo, cubiertas: number[]) => {
    const ok = await confirm({
      title: "Quitar ajuste",
      message:
        aj.tipo === "congelar_interes_temporal"
          ? `Se volverá a cobrar el interés de la ${rangoTexto(cubiertas)}. El saldo y el interés atrasado se recalculan.`
          : "El acuerdo quedará en el historial como inactivo.",
      confirmLabel: "Quitar",
      danger: true,
    });
    if (ok) patch(aj, { activo: false }, "Ajuste quitado");
  };

  const opcionCuota = (c: CuotaOpcion) => (
    <option key={c.numero} value={c.numero}>
      Cuota {c.numero} · {formatDate(c.fecha)} · {ESTADO_TEXTO[c.estado] || c.estado}
      {c.interes ? ` · int. ${formatCurrency(c.interes)}` : ""}
    </option>
  );

  const ItemAjuste: React.FC<{ aj: AjustePrestamo; activo: boolean }> = ({ aj, activo }) => {
    const esCongelar = aj.tipo === "congelar_interes_temporal";
    const cubiertas = esCongelar ? cuotasCubiertas(aj, cuotas).map((c) => c.numero) : [];
    const abierto = esCongelar && !aj.fecha_fin;
    const ocupado = ocupadoId === aj.id;
    return (
      <li className={`p-3 rounded-xl border text-xs space-y-2 ${activo ? (abierto ? "bg-amber-50 border-amber-200" : "bg-sky-50 border-sky-200") : "bg-slate-50 border-slate-200 opacity-80"}`}>
        <div className="flex items-start gap-2">
          {esCongelar ? <Snowflake className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" /> : <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800">
              {esCongelar ? `Interés congelado: ${abierto ? `desde ${formatDate(aj.fecha_inicio)} sin fin` : rangoTexto(cubiertas)}` : "Acuerdo especial"}
            </p>
            {aj.descripcion && <p className="text-slate-600">{aj.descripcion}</p>}
            {aj.motivo && <p className="text-slate-500">Motivo: {aj.motivo}</p>}
            <p className="text-[10px] text-slate-400">
              Registrado {aj.fecha_registro ? formatDate(aj.fecha_registro) : ""} {aj.usuario ? `por ${aj.usuario}` : ""}
            </p>
          </div>
          {activo ? (
            <button
              type="button"
              onClick={() => quitar(aj, cubiertas)}
              disabled={ocupado}
              className="h-9 px-2.5 rounded-lg text-rose-600 hover:bg-rose-100 font-bold inline-flex items-center gap-1 shrink-0"
            >
              {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Quitar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => patch(aj, { activo: true }, "Ajuste reactivado")}
              disabled={ocupado}
              className="h-9 px-2.5 rounded-lg text-indigo-600 hover:bg-indigo-100 font-bold inline-flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reactivar
            </button>
          )}
        </div>
        {activo && abierto && (
          <div className="flex items-start gap-2 text-amber-900 bg-white/70 rounded-lg p-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <p>
                Este ajuste no tiene fin: congela el interés de <b>todas</b> las cuotas desde {formatDate(aj.fecha_inicio)}
                {cubiertas.length ? ` (hoy: ${rangoTexto(cubiertas)})` : ""}. Elige hasta qué cuota debe aplicar:
              </p>
              <select
                className={`${fieldClass} h-10 text-xs`}
                defaultValue=""
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (n) patch(aj, { fecha_fin: fechaDe(n) }, `Ajuste limitado hasta la cuota ${n}`);
                }}
              >
                <option value="" disabled>
                  Limitar hasta la cuota…
                </option>
                {cuotas.filter((c) => c.fecha >= aj.fecha_inicio).map(opcionCuota)}
              </select>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4 pt-2">
      {activos.length > 0 && (
        <ul className="space-y-2">
          {activos.map((aj) => (
            <ItemAjuste key={aj.id} aj={aj} activo />
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
        <div className="grid grid-cols-2 gap-1 p-1 bg-white rounded-xl border border-slate-200 text-xs font-bold">
          {(
            [
              ["congelar_interes_temporal", "❄️ Congelar interés"],
              ["acuerdo_especial", "📝 Acuerdo / nota"],
            ] as const
          ).map(([valor, label]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setTipo(valor)}
              aria-pressed={tipo === valor}
              className={`h-10 rounded-lg transition ${tipo === valor ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tipo === "congelar_interes_temporal" ? (
          <>
            <p className="text-[11px] text-slate-500">
              No se cobra el interés de las cuotas elegidas. El capital no cambia. Puedes quitarlo cuando quieras.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-[11px] font-bold text-slate-600">
                Desde
                <select value={desdeSel} onChange={(e) => setDesde(parseInt(e.target.value, 10))} className={`${fieldClass} mt-1 text-xs`}>
                  {cuotas.map(opcionCuota)}
                </select>
              </label>
              <label className="text-[11px] font-bold text-slate-600">
                Hasta
                <select value={hastaSel} onChange={(e) => setHasta(parseInt(e.target.value, 10))} className={`${fieldClass} mt-1 text-xs`}>
                  {cuotas.filter((c) => c.numero >= desdeSel).map(opcionCuota)}
                </select>
              </label>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] text-slate-500">Solo es una nota del acuerdo con el cliente; no cambia montos.</p>
            <textarea
              rows={2}
              placeholder="Ej: pagará la mitad el 15 y la otra mitad el 30"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className={`${fieldClass} h-auto py-2 resize-none`}
            />
          </>
        )}

        <input type="text" placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={fieldClass} />

        <button
          type="submit"
          disabled={guardando}
          className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
        >
          {guardando ? "Guardando..." : tipo === "congelar_interes_temporal" ? `Congelar ${rangoTexto(desdeSel === hastaSel ? [desdeSel] : [desdeSel, hastaSel])}` : "Guardar acuerdo"}
        </button>
      </form>

      {inactivos.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setVerHistorial((v) => !v)}
            className="text-[11px] font-bold text-slate-500 inline-flex items-center gap-1"
            aria-expanded={verHistorial}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition ${verHistorial ? "rotate-180" : ""}`} /> Historial ({inactivos.length})
          </button>
          {verHistorial && (
            <ul className="space-y-2 mt-2">
              {inactivos.map((aj) => (
                <ItemAjuste key={aj.id} aj={aj} activo={false} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
