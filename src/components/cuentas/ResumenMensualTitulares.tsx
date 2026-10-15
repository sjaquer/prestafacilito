import React, { useMemo } from "react";
import { agruparPorTitular } from "../../lib/cuentas";
import { formatCurrency } from "../../lib/formatters";
import { Movimiento } from "../../hooks/useMovimientosCuentas";

const COLUMNAS = ["Sebastián", "Roberto", "Efectivo"] as const;

const nombreMes = (yyyyMm: string) => {
  const [y, m] = yyyyMm.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("es-PE", { month: "short", year: "2-digit" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Cuánto entró a cada titular en los últimos meses: sirve para cuadrar con los estados de cuenta. */
export const ResumenMensualTitulares: React.FC<{ movimientos: Movimiento[]; meses?: number }> = ({ movimientos, meses = 6 }) => {
  const filas = useMemo(() => {
    const hoy = new Date();
    return Array.from({ length: meses }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const delMes = movimientos.filter((m) => String(m.fecha_pago).startsWith(clave));
      return {
        clave,
        porTitular: agruparPorTitular(delMes),
        total: delMes.reduce((s, m) => s + m.monto, 0),
      };
    });
  }, [movimientos, meses]);

  const haySinId = filas.some((f) => f.porTitular["Sin identificar"]);

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            <th className="text-left py-2 px-1">Mes</th>
            {COLUMNAS.map((c) => (
              <th key={c} className="text-right py-2 px-1">
                {c}
              </th>
            ))}
            {haySinId && <th className="text-right py-2 px-1">Sin id.</th>}
            <th className="text-right py-2 px-1">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((f) => (
            <tr key={f.clave}>
              <td className="py-2 px-1 font-bold text-slate-700 whitespace-nowrap">{nombreMes(f.clave)}</td>
              {COLUMNAS.map((c) => (
                <td key={c} className="py-2 px-1 text-right font-mono text-slate-800 whitespace-nowrap">
                  {f.porTitular[c] ? formatCurrency(f.porTitular[c].total) : "—"}
                </td>
              ))}
              {haySinId && (
                <td className="py-2 px-1 text-right font-mono text-amber-700 whitespace-nowrap">
                  {f.porTitular["Sin identificar"] ? formatCurrency(f.porTitular["Sin identificar"].total) : "—"}
                </td>
              )}
              <td className="py-2 px-1 text-right font-mono font-black text-slate-900 whitespace-nowrap">{formatCurrency(f.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
