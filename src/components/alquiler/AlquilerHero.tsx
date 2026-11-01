import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, Home } from "lucide-react";
import { formatDate, formatFechaCorta, formatSoles } from "../../lib/formatters";

interface AlquilerHeroProps {
  alquiler: any;
  cliente: any;
  estado: any;
  ultimoPago?: { monto: number; fecha_pago: string } | null;
}

const diasHasta = (fecha: string) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${fecha.slice(0, 10)}T00:00:00`).getTime() - hoy.getTime()) / 86400000);
};

const Dato: React.FC<{ label: string; valor: React.ReactNode; detalle?: React.ReactNode; tono?: string }> = ({ label, valor, detalle, tono = "text-slate-900" }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className={`text-[15px] font-black font-mono leading-tight truncate ${tono}`}>{valor}</p>
    {detalle && <p className="text-[10px] text-slate-500 font-semibold truncate">{detalle}</p>}
  </div>
);

/**
 * Encabezado del alquiler, en orden de importancia:
 *   1. Cuánto debe a la fecha y la renta mensual (grande).
 *   2. Próximo cobro y último pago (mediano).
 *   3. Vigencia y total cobrado (chico).
 */
export const AlquilerHero: React.FC<AlquilerHeroProps> = ({ alquiler, cliente, estado, ultimoPago }) => {
  const isFinalizado = alquiler.estado === "finalizado";
  const pendiente = Number(estado?.totalPendiente) || 0;
  const atrasados = Number(estado?.mesesAtrasados) || 0;
  const prox = estado?.mesSiguiente;
  // Días desde la fecha real de vencimiento (negativo = vencido). `diasRestantes` del cálculo nunca baja de 0.
  const dias = prox?.fechaVencimiento ? diasHasta(prox.fechaVencimiento) : null;
  const debe = pendiente > 0.009;

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
      {/* Qué inmueble y quién (chico) */}
      <div className="px-4 sm:px-5 pt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight truncate flex items-center gap-1.5">
            <Home className="w-4 h-4 text-teal-600 shrink-0" />
            {alquiler.descripcion_inmueble || "Inmueble sin descripción"}
          </h1>
          {cliente && (
            <Link to={`/clientes/${alquiler.cliente_id}`} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 decoration-none truncate block">
              {cliente.nombre_completo}
              {cliente.apodo && <span className="text-slate-400 font-semibold"> · {cliente.apodo}</span>}
            </Link>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-black shrink-0 ${isFinalizado ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-800"}`}>
          {isFinalizado ? "Finalizado" : "Activo"}
        </span>
      </div>

      {/* 1. Lo importante (grande) */}
      <div className="px-4 sm:px-5 pt-3 grid grid-cols-2 gap-2.5">
        <div className={`rounded-2xl p-3.5 border ${!debe ? "bg-emerald-50 border-emerald-200" : atrasados > 0 ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"}`}>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-600">{debe ? "Debe a la fecha" : "Al día"}</p>
          <p className={`text-[clamp(1.2rem,6vw,1.65rem)] sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap leading-tight ${debe ? "text-slate-900" : "text-emerald-700"}`}>
            {formatSoles(pendiente)}
          </p>
          {atrasados > 0 ? (
            <p className="text-[11px] font-bold text-rose-700 flex items-center gap-1 mt-0.5">
              <AlertTriangle className="w-3 h-3 shrink-0" /> {atrasados} mes{atrasados > 1 ? "es" : ""} atrasado{atrasados > 1 ? "s" : ""}
            </p>
          ) : !debe ? (
            <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3" /> Sin deuda
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl p-3.5 bg-slate-900 text-white">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-300">Renta mensual</p>
          <p className="text-[clamp(1.2rem,6vw,1.65rem)] sm:text-3xl font-black font-mono tracking-tight whitespace-nowrap leading-tight">{formatSoles(alquiler.monto_mensual)}</p>
          {estado?.diaCobroFijo ? <p className="text-[11px] text-slate-300 font-semibold mt-0.5">el día {estado.diaCobroFijo} de cada mes</p> : null}
        </div>
      </div>

      {/* 2. Próximo cobro y último pago (mediano) */}
      <div className="mx-4 sm:mx-5 mt-3 grid grid-cols-2 gap-3 py-3 border-y border-slate-100">
        <Dato
          label={dias !== null && dias < 0 ? "Debe desde" : "Próximo cobro"}
          valor={prox && !isFinalizado ? formatFechaCorta(prox.fechaVencimiento) : "—"}
          detalle={
            prox && !isFinalizado && dias !== null ? (
              <span className={dias < 0 ? "text-rose-600" : ""}>
                {dias < 0 ? `Vencido hace ${Math.abs(dias)} d` : dias === 0 ? "Vence hoy" : `En ${dias} día${dias === 1 ? "" : "s"}`}
              </span>
            ) : undefined
          }
        />
        <Dato
          label="Último pago"
          valor={ultimoPago ? formatSoles(ultimoPago.monto) : "—"}
          detalle={ultimoPago ? formatFechaCorta(ultimoPago.fecha_pago) : "sin pagos"}
        />
      </div>

      {/* 3. Lo demás (chico) */}
      <p className="px-4 sm:px-5 py-3 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500 font-semibold">
        <span className="flex items-center gap-1">
          <CalendarClock className="w-3 h-3" /> Desde {formatDate(alquiler.fecha_inicio)}
        </span>
        <span>Hasta {alquiler.fecha_fin ? formatDate(alquiler.fecha_fin) : "indefinido"}</span>
        <span>Cobrado en total {formatSoles(estado?.totalPagado)}</span>
      </p>
    </div>
  );
};
