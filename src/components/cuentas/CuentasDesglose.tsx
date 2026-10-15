import React from "react";
import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import { ResumenCuenta, SIN_IDENTIFICAR_ID } from "../../lib/cuentas";

interface CuentasDesgloseProps {
  grupos: ResumenCuenta[];
  total: number;
  seleccionada?: string;
  onSeleccionar?: (id: string) => void;
  /** Oculta las cuentas sin movimientos en el período. */
  soloConMovimientos?: boolean;
}

/** Lista de cuentas con su total, cantidad de pagos y proporción del período. */
export const CuentasDesglose: React.FC<CuentasDesgloseProps> = ({
  grupos,
  total,
  seleccionada,
  onSeleccionar,
  soloConMovimientos = false,
}) => {
  const visibles = soloConMovimientos ? grupos.filter((g) => g.cantidad > 0) : grupos;
  if (visibles.length === 0) {
    return <p className="text-xs text-slate-500 py-3 text-center">Sin pagos en este período.</p>;
  }

  return (
    <ul className="space-y-1">
      {visibles.map((g) => {
        const pct = total > 0 ? (g.total / total) * 100 : 0;
        const activa = seleccionada === g.id;
        const sinId = g.id === SIN_IDENTIFICAR_ID;
        const contenido = (
          <>
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${sinId ? "bg-slate-400" : g.cuenta!.color.dot}`} />
              <span className="flex-1 min-w-0 text-left">
                <span className="block text-xs font-bold text-slate-800 truncate">{g.nombre}</span>
                <span className="block text-[10px] text-slate-500 font-semibold">
                  {g.cantidad} pago{g.cantidad === 1 ? "" : "s"}
                  {sinId && " · método no reconocido"}
                </span>
              </span>
              <span className="text-sm font-black font-mono text-slate-900">{formatCurrency(g.total)}</span>
            </div>
            <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${sinId ? "bg-slate-400" : g.cuenta!.color.bar}`} style={{ width: `${pct}%` }} />
            </div>
          </>
        );
        return (
          <li key={g.id}>
            {onSeleccionar ? (
              <button
                type="button"
                onClick={() => onSeleccionar(activa ? "todas" : g.id)}
                aria-pressed={activa}
                className={`w-full p-2.5 rounded-xl border transition text-left ${
                  activa ? "border-indigo-300 bg-indigo-50/60" : "border-transparent hover:bg-slate-50"
                }`}
              >
                {contenido}
              </button>
            ) : (
              <div className="p-2.5">{contenido}</div>
            )}
          </li>
        );
      })}
      {visibles.some((g) => g.id === SIN_IDENTIFICAR_ID) && (
        <li className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Hay pagos con un método que no corresponde a ninguna cuenta. Edítalos en Vouchers para asignarles la cuenta correcta.
        </li>
      )}
    </ul>
  );
};
