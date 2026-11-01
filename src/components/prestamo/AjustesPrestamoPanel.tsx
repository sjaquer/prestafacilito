import React, { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, RotateCcw, Snowflake, Trash2 } from "lucide-react";
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

/**
 * Ayuda al cliente: congelar (perdonar) el interés de un rango de cuotas, siempre de la cuota X a la Y.
 * Nunca queda nada congelado sin fin. Muestra cuánto interés se perdona.
 */
export const AjustesPrestamoPanel: React.FC<AjustesPrestamoPanelProps> = ({
  prestamoId,
  fechaEmision,
  ajustes,
  timeline,
  onAjusteActualizado,
}) => {
  const { notify, confirm } = useFeedback();
  const [desde, setDesde] = useState<number>(0);
  const [hasta, setHasta] = useState<number>(0);
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

  // Solo congelamientos (los "acuerdos" se quitaron)
  const congelamientos = ajustes.filter((a) => a.tipo === "congelar_interes_temporal");
  const activos = congelamientos.filter((a) => a.activo);
  const inactivos = congelamientos.filter((a) => !a.activo);

  /** Interés que se deja de cobrar en esas cuotas (las futuras aún sin calcular no suman). */
  const interesDe = (nums: number[]) => nums.reduce((s, n) => s + (cuotas.find((c) => c.numero === n)?.interes || 0), 0);
  const rangoSel = cuotas.filter((c) => c.numero >= desdeSel && c.numero <= hastaSel).map((c) => c.numero);
  const perdonaSel = interesDe(rangoSel);
  const hayFuturasSel = cuotas.some((c) => c.numero >= desdeSel && c.numero <= hastaSel && c.estado === "Futura");

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
    setGuardando(true);
    try {
      const body = {
        tipo: "congelar_interes_temporal",
        cuota_numero: desdeSel,
        fecha_inicio: fechaDe(desdeSel),
        fecha_fin: fechaDe(hastaSel),
        descripcion: `Interés congelado: ${rangoTexto(rangoSel)}`,
        motivo,
      };
      const res = await fetch(`/api/prestamos/${prestamoId}/ajustes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "No se pudo registrar el ajuste");
      }
      notify(`Interés congelado: ${rangoTexto(rangoSel)}`, "success");
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
      message: `Se volverá a cobrar el interés de la ${rangoTexto(cubiertas)}. El saldo y el interés atrasado se recalculan.`,
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
    const cubiertas = cuotasCubiertas(aj, cuotas).map((c) => c.numero);
    const abierto = !aj.fecha_fin;
    const perdonado = interesDe(cubiertas);
    const ocupado = ocupadoId === aj.id;
    return (
      <li className={`p-3 rounded-xl border text-xs space-y-2 ${activo ? (abierto ? "bg-amber-50 border-amber-200" : "bg-sky-50 border-sky-200") : "bg-slate-50 border-slate-200 opacity-80"}`}>
        <div className="flex items-start gap-2">
          <Snowflake className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800">
              Interés congelado: {abierto ? `desde ${formatDate(aj.fecha_inicio)} sin fin` : rangoTexto(cubiertas)}
            </p>
            {perdonado > 0 && (
              <p className="text-sky-800 font-semibold">
                Se perdonan <b className="font-mono">{formatCurrency(perdonado)}</b> de interés
              </p>
            )}
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
          ) : abierto ? (
            <span className="text-[10px] text-slate-500 font-semibold shrink-0 max-w-[8rem] text-right">
              Sin cuota final: crea uno nuevo con rango
            </span>
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
        <p className="text-sm font-black text-slate-800 flex items-center gap-1.5">
          <Snowflake className="w-4 h-4 text-sky-600" /> Congelar interés
        </p>
        <p className="text-[11px] text-slate-500">
          No se cobra el interés de las cuotas elegidas; el capital no cambia. Siempre de una cuota a otra, y se puede quitar cuando quieras.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-[11px] font-bold text-slate-600">
            Desde la cuota
            <select value={desdeSel} onChange={(e) => setDesde(parseInt(e.target.value, 10))} className={`${fieldClass} mt-1 text-xs`}>
              {cuotas.map(opcionCuota)}
            </select>
          </label>
          <label className="text-[11px] font-bold text-slate-600">
            Hasta la cuota
            <select value={hastaSel} onChange={(e) => setHasta(parseInt(e.target.value, 10))} className={`${fieldClass} mt-1 text-xs`}>
              {cuotas.filter((c) => c.numero >= desdeSel).map(opcionCuota)}
            </select>
          </label>
        </div>
        <p className="text-xs font-semibold text-sky-900 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
          Se congela la {rangoTexto(rangoSel)}: se perdonan <b className="font-mono">{formatCurrency(perdonaSel)}</b> de interés
          {hayFuturasSel ? " (más el de las cuotas futuras, que aún no se calcula)" : ""}.
        </p>

        <input type="text" placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={fieldClass} />

        <button
          type="submit"
          disabled={guardando}
          className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
        >
          {guardando ? "Guardando..." : `Congelar ${rangoTexto(rangoSel)}`}
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
