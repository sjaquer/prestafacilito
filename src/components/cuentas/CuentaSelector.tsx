import React from "react";
import { CUENTAS, Titular } from "../../lib/cuentas";

interface CuentaSelectorProps {
  value: string;
  onChange: (nombreCuenta: string) => void;
  /** Muestra el aviso de campo obligatorio (tras intentar guardar sin elegir). */
  error?: boolean;
  label?: string;
}

const ORDEN: Titular[] = ["Sebastián", "Roberto", "Efectivo"];

/**
 * Selección de la cuenta donde entró el dinero. Sin valor por defecto a propósito:
 * obliga a elegir, para que cada abono quede en la cuenta correcta.
 */
export const CuentaSelector: React.FC<CuentaSelectorProps> = ({ value, onChange, error, label = "¿A qué cuenta llegó?" }) => (
  <fieldset>
    <legend className={`text-[11px] font-bold mb-1.5 ${error ? "text-rose-600" : "text-slate-600"}`}>
      {label} {error && "— elige una"}
    </legend>
    <div className="space-y-2">
      {ORDEN.map((titular) => {
        const cuentas = CUENTAS.filter((c) => c.titular === titular);
        return (
          <div key={titular} className="flex items-center gap-2">
            {titular !== "Efectivo" && <span className="w-16 shrink-0 text-[10px] font-black uppercase tracking-wider text-slate-400">{titular}</span>}
            <div className={`grid gap-1.5 flex-1 ${cuentas.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {cuentas.map((c) => {
                const activa = value === c.nombre;
                const corto = c.nombre.replace(/\s*\((Sebastián|Roberto)\)/, "");
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChange(c.nombre)}
                    aria-pressed={activa}
                    className={`h-11 px-2 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition ${
                      activa ? "bg-slate-900 border-slate-900 text-white" : `bg-white text-slate-700 hover:bg-slate-50 ${error ? "border-rose-300" : "border-slate-200"}`
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${c.color.dot}`} />
                    <span className="truncate">{corto}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  </fieldset>
);
