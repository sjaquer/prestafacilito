import React, { useState } from "react";
import { ChevronDown, Edit2, FileText, Loader2, Trash2 } from "lucide-react";
import { formatCurrency, formatDate, parseVoucherUrls, resolveVoucherUrl } from "../../lib/formatters";
import { useFeedback } from "../ui/Feedback";
import { EditarPagoAlquilerModal } from "./EditarPagoAlquilerModal";
import { nombreMes } from "./alquilerUtils";

interface MesesAlquilerListProps {
  alquilerId: string;
  meses: any[];
  /** Pagos que no quedaron asignados a ningún mes generado (por ejemplo, de un periodo fuera del contrato). */
  pagosSueltos: any[];
  onVerVoucher: (url: string) => void;
  onChanged: (msg?: string) => void;
}

const ESTADO_UI: Record<string, { label: string; dot: string; pill: string }> = {
  Saldada: { label: "Pagado", dot: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-800" },
  Parcial: { label: "Parcial", dot: "bg-amber-500", pill: "bg-amber-100 text-amber-800" },
  Vencida: { label: "Vencido", dot: "bg-rose-500", pill: "bg-rose-100 text-rose-800" },
  Pendiente: { label: "Por vencer", dot: "bg-slate-300", pill: "bg-slate-100 text-slate-700" },
};

interface PagoRowProps {
  pago: any;
  deleting: boolean;
  onVerVoucher: (url: string) => void;
  onEdit: (pago: any) => void;
  onDelete: (pago: any) => void;
}

const PagoRow: React.FC<PagoRowProps> = ({ pago, deleting, onVerVoucher, onEdit, onDelete }) => {
  const voucher = parseVoucherUrls(pago.comprobante_url)[0];
  return (
    <li className="py-2 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black font-mono text-slate-900">{formatCurrency(pago.monto)}</p>
        <p className="text-[11px] text-slate-500 font-semibold truncate">
          {formatDate(pago.fecha_pago)} · {pago.metodo_pago || "—"}
        </p>
      </div>
      {voucher && (
        <button
          type="button"
          onClick={() => onVerVoucher(resolveVoucherUrl(voucher))}
          className="p-2.5 rounded-xl text-indigo-600 hover:bg-indigo-50"
          aria-label="Ver comprobante"
        >
          <FileText className="w-4 h-4" />
        </button>
      )}
      <button type="button" onClick={() => onEdit(pago)} className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100" aria-label="Editar pago">
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(pago)}
        disabled={deleting}
        className="p-2.5 rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        aria-label="Eliminar pago"
      >
        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>
    </li>
  );
};

/** Meses del contrato (más reciente primero) con sus pagos, editables y eliminables. */
export const MesesAlquilerList: React.FC<MesesAlquilerListProps> = ({
  alquilerId,
  meses,
  pagosSueltos,
  onVerVoucher,
  onChanged,
}) => {
  const { notify, confirm } = useFeedback();
  const [editing, setEditing] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const ordenados = [...meses].reverse();
  const [abiertos, setAbiertos] = useState<Set<string>>(
    () => new Set(ordenados.filter((m) => m.estado !== "Saldada").map((m) => `${m.anio}-${m.mes}`))
  );

  const toggle = (key: string) =>
    setAbiertos((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleDelete = async (pago: any) => {
    const ok = await confirm({
      title: "Eliminar pago",
      message: `¿Eliminar el pago de ${formatCurrency(pago.monto)} de ${nombreMes(pago.periodo_mes)} ${pago.periodo_anio}?`,
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(pago.id);
    try {
      const res = await fetch(`/api/alquileres/${alquilerId}/pagos/${pago.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar el pago");
      onChanged("Pago eliminado");
    } catch (err: any) {
      notify(err.message || "Error al eliminar el pago");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {ordenados.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">Aún no hay meses generados para este contrato.</p>
      ) : (
        <ol className="space-y-2 pt-2">
          {ordenados.map((m) => {
            const key = `${m.anio}-${m.mes}`;
            const ui = ESTADO_UI[m.estado] || ESTADO_UI.Pendiente;
            const abierto = abiertos.has(key);
            return (
              <li key={key} className="rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={abierto}
                  className="w-full flex items-center gap-3 px-3.5 py-3 text-left bg-transparent border-none cursor-pointer hover:bg-slate-50"
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ui.dot}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-extrabold text-slate-900">
                      {nombreMes(m.mes)} {m.anio}
                    </span>
                    <span className="block text-[11px] text-slate-500 font-semibold">Vence {formatDate(m.fechaVencimiento)}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-xs font-black font-mono text-slate-800">
                      {formatCurrency(m.montoPagado)}
                      <span className="text-slate-400 font-bold"> / {formatCurrency(m.montoEsperado)}</span>
                    </span>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${ui.pill}`}>
                      {m.estado === "Vencida" && m.diasVencidos > 0 ? `Vencido ${m.diasVencidos}d` : ui.label}
                    </span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} />
                </button>
                {abierto && (
                  <div className="px-3.5 pb-2 border-t border-slate-100">
                    {m.pagos?.length > 0 ? (
                      <ul className="divide-y divide-slate-100">
                        {m.pagos.map((p: any) => (
                          <PagoRow
                            key={p.id}
                            pago={p}
                            deleting={deletingId === p.id}
                            onVerVoucher={onVerVoucher}
                            onEdit={setEditing}
                            onDelete={handleDelete}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="py-3 text-xs text-slate-500">Sin pagos para este mes.</p>
                    )}
                    {m.saldoPendiente > 0.009 && (
                      <p className="pb-2 text-[11px] font-bold text-amber-700">Falta {formatCurrency(m.saldoPendiente)}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {pagosSueltos.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 px-3.5 py-2">
          <p className="text-[11px] font-bold text-amber-800 pt-1">Pagos fuera del periodo del contrato</p>
          <ul className="divide-y divide-amber-100">
            {pagosSueltos.map((p) => (
              <PagoRow
                key={p.id}
                pago={p}
                deleting={deletingId === p.id}
                onVerVoucher={onVerVoucher}
                onEdit={setEditing}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        </div>
      )}

      <EditarPagoAlquilerModal
        alquilerId={alquilerId}
        pago={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onChanged("Pago actualizado");
        }}
      />
    </>
  );
};
