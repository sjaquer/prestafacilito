import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, Snowflake } from "lucide-react";
import { formatCurrency, formatDate, formatFechaCorta, formatSoles } from "../../lib/formatters";
import { round2 } from "../../lib/loanLogic";
import type { MontosDePago } from "../../lib/proximoCobro";

interface LoanHeroProps {
  prestamo: any;
  cliente: any;
  /** Resumen del cálculo (capitalPendiente, interesAtrasado, totalPagado...). */
  deuda: any;
  /** Cuotas del cronograma calculado (para el interés del mes que corresponde). */
  cuotas?: any[];
  montos: MontosDePago;
  ultimoPago?: { monto: number; fecha_pago: string } | null;
  ajustesActivos: number;
  isLiquidado: boolean;
  isEstancado: boolean;
}

const diasHasta = (fecha?: string | null) => {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${fecha.split("T")[0]}T00:00:00`).getTime() - hoy.getTime()) / 86400000);
};

const textoDias = (d: number | null) => (d === null ? "" : d < 0 ? `venció hace ${-d} d` : d === 0 ? "vence hoy" : d === 1 ? "vence mañana" : `en ${d} días`);

const diaDePago = (prestamo: any) => {
  const ref = prestamo.fecha_vencimiento || prestamo.fecha_emision;
  return ref ? parseInt(ref.split("-")[2], 10) : null;
};

const EstadoChip: React.FC<{ isLiquidado: boolean; isEstancado: boolean }> = ({ isLiquidado, isEstancado }) => {
  if (isLiquidado)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
        <CheckCircle2 className="w-3.5 h-3.5" /> Liquidado
      </span>
    );
  if (isEstancado)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black">
        <AlertTriangle className="w-3.5 h-3.5" /> Estancado
      </span>
    );
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-black">Activo</span>;
};

/** Dato secundario: etiqueta chica arriba, valor mediano abajo. */
const Dato: React.FC<{ label: string; valor: React.ReactNode; detalle?: React.ReactNode }> = ({ label, valor, detalle }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="text-[15px] font-black font-mono text-slate-900 leading-tight truncate">{valor}</p>
    {detalle && <p className="text-[10px] text-slate-500 font-semibold truncate">{detalle}</p>}
  </div>
);

/**
 * Encabezado del préstamo, en orden de importancia:
 *   1. Lo que hay que cobrar: el mínimo (interés) y el total para liquidar en esta cuota.
 *   2. Tasa, capital restante y último pago.
 *   3. Lo demás (avance, día de pago, desde cuándo) en letra chica.
 * Todos los montos vienen del cálculo de préstamos; aquí solo se muestran.
 */
export const LoanHero: React.FC<LoanHeroProps> = ({
  prestamo,
  cliente,
  deuda,
  cuotas = [],
  montos,
  ultimoPago,
  ajustesActivos,
  isLiquidado,
  isEstancado,
}) => {
  const capital = Number(prestamo.monto_capital) || 0;
  const tasa = Number(prestamo.tasa_interes_porcentaje) || 0;
  const capitalPendiente = Number(deuda?.capitalPendiente ?? capital) || 0;
  const devueltoPct = capital > 0 ? Math.min(100, Math.max(0, ((capital - capitalPendiente) / capital) * 100)) : 0;
  const dias = diasHasta(montos.fechaCuota);
  const dia = diaDePago(prestamo);

  // Interés del mes de esta cuota, tal como lo calculó el motor (0 si está congelado).
  // Si la cuota aún no está en el cronograma, es el mismo cálculo: capital restante × tasa.
  const cuotaActual = cuotas.find((c) => c.fechaVencimiento === montos.fechaCuota);
  const congelado = !!cuotaActual?.congelada;
  const interesMes = congelado ? 0 : cuotaActual ? Number(cuotaActual.interesOriginal) || 0 : round2((capitalPendiente * tasa) / 100);

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
      {/* Quién y qué (chico) */}
      <div className="px-4 sm:px-5 pt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/clientes/${prestamo.cliente_id}`}
            className="block text-lg sm:text-xl font-black text-slate-900 leading-tight truncate hover:text-indigo-600 decoration-none"
          >
            {cliente?.nombre_completo || prestamo.cliente_nombre}
          </Link>
          <p className="text-[11px] text-slate-500 font-semibold truncate">
            {prestamo.tipo_prestamo || "Préstamo"}
            {cliente?.apodo ? ` · ${cliente.apodo}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <EstadoChip isLiquidado={isLiquidado} isEstancado={isEstancado} />
          {ajustesActivos > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black">
              <Snowflake className="w-3 h-3" /> {ajustesActivos} ajuste{ajustesActivos > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {isLiquidado ? (
        <div className="mx-4 sm:mx-5 my-3 rounded-2xl p-4 bg-emerald-50 border border-emerald-200">
          <p className="text-xs font-bold text-emerald-800">Préstamo pagado por completo</p>
          <p className="text-3xl font-black font-mono text-emerald-700">{formatCurrency(0)}</p>
        </div>
      ) : (
        /* 1. Lo que hay que cobrar (grande) */
        <div className="px-4 sm:px-5 pt-3 grid grid-cols-2 gap-2.5">
          <div className={`rounded-2xl p-3.5 ${montos.atrasado ? "bg-rose-50 border border-rose-200" : "bg-amber-50 border border-amber-200"}`}>
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-600">Mínimo (interés)</p>
            <p className="text-[clamp(1.2rem,6vw,1.65rem)] sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap text-slate-900 leading-tight">{formatSoles(montos.cuota)}</p>
            <p className="text-[11px] text-slate-600 font-semibold leading-snug mt-0.5">
              {congelado ? (
                <>Interés del mes congelado</>
              ) : (
                <>
                  {tasa}% de {formatSoles(capitalPendiente)} = <b className="font-mono">{formatSoles(interesMes)}</b>
                </>
              )}
            </p>
            {montos.atrasado && (
              <p className="text-[11px] font-bold text-rose-700 flex items-center gap-1 mt-0.5">
                <AlertTriangle className="w-3 h-3 shrink-0" /> incluye {formatSoles(montos.interesVencido)} atrasado
              </p>
            )}
          </div>
          <div className="rounded-2xl p-3.5 bg-slate-900 text-white">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-300">Para liquidar</p>
            <p className="text-[clamp(1.2rem,6vw,1.65rem)] sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap leading-tight">{formatSoles(montos.liquidar)}</p>
            <p className="text-[11px] text-slate-300 font-semibold leading-snug mt-0.5">
              capital {formatSoles(capitalPendiente)} + interés {formatSoles(round2(montos.liquidar - capitalPendiente))}
            </p>
          </div>
          {montos.fechaCuota && (
            <p className="col-span-2 text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5 shrink-0" />
              Cuota del {formatDate(montos.fechaCuota)}
              <span className={dias !== null && dias <= 0 ? "text-amber-700 font-bold" : ""}> · {textoDias(dias)}</span>
              <span className="hidden sm:inline"> · lo que pague sobre el mínimo baja el capital</span>
            </p>
          )}
        </div>
      )}

      {/* 2. Datos del préstamo (mediano) */}
      <div className="mx-4 sm:mx-5 mt-3 grid grid-cols-3 gap-3 py-3 border-y border-slate-100">
        <Dato label="Tasa" valor={`${tasa}%`} detalle="mensual" />
        <Dato label="Capital restante" valor={formatSoles(capitalPendiente)} detalle={`de ${formatSoles(capital)}`} />
        <Dato
          label="Último pago"
          valor={ultimoPago ? formatSoles(ultimoPago.monto) : "—"}
          detalle={ultimoPago ? formatFechaCorta(ultimoPago.fecha_pago) : "sin pagos"}
        />
      </div>

      {/* 3. Lo demás (chico) */}
      <div className="px-4 sm:px-5 py-3 space-y-1.5">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(devueltoPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Capital devuelto">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${devueltoPct}%` }} />
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500 font-semibold">
          <span>Devuelto {Math.round(devueltoPct)}% del capital</span>
          {dia && <span>Paga el día {dia}</span>}
          <span>Desde {formatFechaCorta(prestamo.fecha_emision)}</span>
          <span>Total pagado {formatSoles(deuda?.totalPagado)}</span>
        </p>
      </div>
    </div>
  );
};
