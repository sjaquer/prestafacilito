import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, Home } from "lucide-react";
import { formatCurrency, formatDate } from "../../lib/formatters";

interface AlquilerHeroProps {
  alquiler: any;
  cliente: any;
  estado: any;
}

/** Resumen del contrato de alquiler: cuánto debe, meses atrasados y próximo cobro. */
export const AlquilerHero: React.FC<AlquilerHeroProps> = ({ alquiler, cliente, estado }) => {
  const isFinalizado = alquiler.estado === "finalizado";
  const pendiente = Number(estado?.totalPendiente) || 0;
  const atrasados = Number(estado?.mesesAtrasados) || 0;
  const prox = estado?.mesSiguiente;
  const dias = prox ? Number(prox.diasRestantes) : null;

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <Home className="w-3 h-3" /> Alquiler
          </p>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
            {alquiler.descripcion_inmueble || "Inmueble sin descripción"}
          </h1>
          {cliente && (
            <Link
              to={`/clientes/${alquiler.cliente_id}`}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 decoration-none"
            >
              {cliente.nombre_completo}
              {cliente.apodo && <span className="italic text-slate-500 font-semibold"> ({cliente.apodo})</span>}
            </Link>
          )}
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 ${
            isFinalizado ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {isFinalizado ? "Finalizado" : "Activo"}
        </span>
      </div>

      <div className="px-5 pb-4">
        <p className="text-[11px] font-bold text-slate-500">{pendiente > 0.009 ? "Debe a la fecha" : "Al día"}</p>
        <p className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${pendiente > 0.009 ? "text-slate-900" : "text-emerald-600"}`}>
          {formatCurrency(pendiente)}
        </p>
        {atrasados > 0 && (
          <p className="mt-1 text-xs font-bold text-rose-600 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> {atrasados} mes{atrasados > 1 ? "es" : ""} atrasado{atrasados > 1 ? "s" : ""}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 border-t border-slate-100 divide-x divide-slate-100">
        <div className="px-5 py-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Renta mensual</p>
          <p className="text-lg font-black font-mono text-indigo-700">{formatCurrency(alquiler.monto_mensual)}</p>
          {estado?.diaCobroFijo ? <p className="text-[10px] text-slate-500 font-semibold">Día {estado.diaCobroFijo} de cada mes</p> : null}
        </div>
        <div className="px-5 py-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <CalendarClock className="w-3 h-3" /> Próximo cobro
          </p>
          {prox && !isFinalizado ? (
            <>
              <p className="text-sm font-black text-slate-900">{formatDate(prox.fechaVencimiento)}</p>
              <p className={`text-[11px] font-bold ${dias !== null && dias < 0 ? "text-rose-600" : "text-slate-500"}`}>
                {dias === null ? "" : dias < 0 ? `Vencido hace ${Math.abs(dias)} d` : dias === 0 ? "Vence hoy" : `En ${dias} día${dias === 1 ? "" : "s"}`}
              </p>
            </>
          ) : (
            <p className="text-sm font-bold text-slate-400">—</p>
          )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-semibold">
        <span>
          Desde <b className="text-slate-800">{formatDate(alquiler.fecha_inicio)}</b>
        </span>
        <span>
          Hasta <b className="text-slate-800">{alquiler.fecha_fin ? formatDate(alquiler.fecha_fin) : "indefinido"}</b>
        </span>
        <span>
          Cobrado <b className="text-emerald-700">{formatCurrency(estado?.totalPagado)}</b>
        </span>
      </div>
    </div>
  );
};
