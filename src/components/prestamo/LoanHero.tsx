import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, Snowflake } from "lucide-react";
import { formatCurrency, formatDate } from "../../lib/formatters";

interface LoanHeroProps {
  prestamo: any;
  cliente: any;
  deuda: any;
  cuotaSiguiente: any;
  ajustesActivos: number;
  isLiquidado: boolean;
  isEstancado: boolean;
}

const diasHasta = (fecha?: string) => {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${fecha.split("T")[0]}T00:00:00`).getTime() - hoy.getTime()) / 86400000);
};

const diaDePago = (prestamo: any) => {
  const ref = prestamo.fecha_vencimiento || prestamo.fecha_emision;
  return ref ? parseInt(ref.split("-")[2], 10) : null;
};

const EstadoChip: React.FC<{ isLiquidado: boolean; isEstancado: boolean }> = ({ isLiquidado, isEstancado }) => {
  if (isLiquidado)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
        <CheckCircle2 className="w-3.5 h-3.5" /> Liquidado
      </span>
    );
  if (isEstancado)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black">
        <AlertTriangle className="w-3.5 h-3.5" /> Estancado
      </span>
    );
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-black">Activo</span>;
};

/**
 * Resumen principal del préstamo pensado para leerse de un vistazo en el celular:
 * cuánto falta para liquidar, cuánto es el pago mínimo y cuándo vence.
 */
export const LoanHero: React.FC<LoanHeroProps> = ({
  prestamo,
  cliente,
  deuda,
  cuotaSiguiente,
  ajustesActivos,
  isLiquidado,
  isEstancado,
}) => {
  const capital = Number(prestamo.monto_capital) || 0;
  const capitalPendiente = Number(deuda?.capitalPendiente ?? capital) || 0;
  const capitalPagadoPct = capital > 0 ? Math.min(100, Math.max(0, ((capital - capitalPendiente) / capital) * 100)) : 0;
  const mora = Number(deuda?.moraAcumulada) || 0;
  const pagoMinimo = mora + (Number(deuda?.interesPendiente) || 0);
  const saldo = Number(deuda?.saldoPendiente) || 0;

  const fechaProx = cuotaSiguiente?.fechaVencimiento as string | undefined;
  const dias = diasHasta(fechaProx);
  const vencido = dias !== null && dias < 0;
  const dia = diaDePago(prestamo);

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
      {/* Cliente y estado */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {prestamo.tipo_prestamo || "Préstamo"}
          </p>
          <Link
            to={`/clientes/${prestamo.cliente_id}`}
            className="block text-lg sm:text-xl font-black text-slate-900 leading-tight truncate hover:text-indigo-600 decoration-none"
          >
            {cliente?.nombre_completo || prestamo.cliente_nombre}
          </Link>
          {cliente?.apodo && <p className="text-xs text-slate-500 font-semibold italic truncate">({cliente.apodo})</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <EstadoChip isLiquidado={isLiquidado} isEstancado={isEstancado} />
          {ajustesActivos > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black">
              <Snowflake className="w-3 h-3" /> {ajustesActivos} ajuste{ajustesActivos > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Cifra principal */}
      <div className="px-5 pb-4">
        <p className="text-[11px] font-bold text-slate-500">
          {isLiquidado ? "Préstamo pagado por completo" : "Saldo pendiente (capital + mora)"}
        </p>
        <p className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${isLiquidado ? "text-emerald-600" : "text-slate-900"}`}>
          {formatCurrency(saldo)}
        </p>
        {mora > 0.009 && !isLiquidado && (
          <p className="mt-1 text-xs font-bold text-rose-600 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Incluye {formatCurrency(mora)} de mora acumulada
          </p>
        )}
      </div>

      {/* Pago mínimo y próximo vencimiento */}
      {!isLiquidado && (
        <div className="grid grid-cols-2 border-y border-slate-100 divide-x divide-slate-100">
          <div className="px-5 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pago mínimo</p>
            <p className="text-lg font-black font-mono text-indigo-700">{formatCurrency(pagoMinimo)}</p>
            <p className="text-[10px] text-slate-500 font-semibold">Interés{mora > 0.009 ? " + mora" : ""} pendiente</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <CalendarClock className="w-3 h-3" /> Próximo vencimiento
            </p>
            {fechaProx ? (
              <>
                <p className="text-sm font-black text-slate-900">{formatDate(fechaProx)}</p>
                <p className={`text-[11px] font-bold ${vencido ? "text-rose-600" : dias === 0 ? "text-amber-600" : "text-slate-500"}`}>
                  {vencido ? `Vencido hace ${Math.abs(dias!)} d` : dias === 0 ? "Vence hoy" : `En ${dias} día${dias === 1 ? "" : "s"}`}
                </p>
              </>
            ) : (
              <p className="text-sm font-bold text-slate-400">—</p>
            )}
          </div>
        </div>
      )}

      {/* Explicación en palabras simples */}
      {!isLiquidado && (
        <p className="mx-5 mt-4 p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 leading-relaxed">
          {pagoMinimo > 0.009 ? (
            <>
              Para quedar al día paga <b className="font-mono">{formatCurrency(pagoMinimo)}</b>. Lo que pague por encima baja el
              capital de <b className="font-mono">{formatCurrency(capitalPendiente)}</b>.
            </>
          ) : (
            <>
              Está al día. Cualquier pago ahora baja directo el capital de{" "}
              <b className="font-mono">{formatCurrency(capitalPendiente)}</b>.
            </>
          )}{" "}
          Con <b className="font-mono">{formatCurrency(pagoMinimo + capitalPendiente)}</b> liquida el préstamo.
        </p>
      )}

      {/* Avance del capital */}
      <div className="px-5 py-4 space-y-2">
        <div className="flex justify-between text-[11px] font-bold">
          <span className="text-slate-500">Capital devuelto</span>
          <span className="text-slate-700 font-mono">
            {formatCurrency(capital - capitalPendiente)} / {formatCurrency(capital)}
          </span>
        </div>
        <div
          className="h-2.5 bg-slate-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(capitalPagadoPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Capital devuelto"
        >
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${capitalPagadoPct}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-500 font-semibold">
          <span>
            Tasa <b className="text-slate-800">{prestamo.tasa_interes_porcentaje}%</b>/mes
          </span>
          {dia && (
            <span>
              Paga el día <b className="text-slate-800">{dia}</b>
            </span>
          )}
          <span>
            Desde <b className="text-slate-800">{formatDate(prestamo.fecha_emision)}</b>
          </span>
          <span>
            Pagado <b className="text-emerald-700">{formatCurrency(deuda?.totalPagado)}</b>
          </span>
        </div>
      </div>
    </div>
  );
};
