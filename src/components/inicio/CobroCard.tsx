import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home as HomeIcon, MessageCircle, Wallet } from "lucide-react";
import { formatCurrency, formatDate } from "../../lib/formatters";
import { ESTILO_GRUPO, linkCobroWhatsApp } from "../../lib/cobranza";
import { textoRelativo } from "../../lib/fechas";
import { ItemCobro } from "./tipos";

interface CobroCardProps {
  item: ItemCobro;
  onCobrar: (item: ItemCobro) => void;
}

const SCORE_COLOR = { A: "bg-emerald-100 text-emerald-800", B: "bg-amber-100 text-amber-800", C: "bg-rose-100 text-rose-800" };

/** Texto corto de "cuándo": cuotas atrasadas o días a la próxima fecha. */
function textoCuando(item: ItemCobro) {
  if (item.grupo === "atrasado" || item.grupo === "estancado") {
    const n = item.cuotas_atrasadas || 1;
    const unidad = item.es_alquiler ? "mes" : "cuota";
    return `${n} ${unidad}${n > 1 ? "s" : ""} sin pagar`;
  }
  return item.proximo_cobro ? `${textoRelativo(item.dias)} · ${formatDate(item.proximo_cobro)}` : "Sin fecha";
}

const Celda: React.FC<{ label: string; valor: string; destacado?: boolean }> = ({ label, valor, destacado }) => (
  <div className={`rounded-xl px-2.5 py-1.5 ${destacado ? "bg-white shadow-sm" : "bg-white/60"}`}>
    <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
    <p className={`font-mono leading-tight ${destacado ? "text-[15px] font-black text-slate-900" : "text-[13px] font-bold text-slate-700"}`}>{valor}</p>
  </div>
);

/**
 * Tarjeta de un cobro. Toda la tarjeta toma el color de su estado (atrasado, hoy, mañana…)
 * y muestra en casillas lo esencial del préstamo para decidir sin abrirlo.
 */
export const CobroCard: React.FC<CobroCardProps> = ({ item, onCobrar }) => {
  const estilo = ESTILO_GRUPO[item.grupo];
  const detalle = item.es_alquiler ? `/alquileres/${item.id}` : `/prestamos/${item.id}`;
  const esAtraso = item.grupo === "atrasado" || item.grupo === "estancado";
  const wa = linkCobroWhatsApp(item.cliente_telefono, {
    esAlquiler: item.es_alquiler,
    fechaVencimiento: esAtraso ? item.debe_desde || undefined : item.proximo_cobro || undefined,
    atrasado: esAtraso,
    monto: item.montoACobrar,
  });

  return (
    <li className={`border rounded-2xl overflow-hidden ${estilo.tarjeta}`}>
      <Link to={detalle} className="block px-3.5 pt-3 pb-2.5 decoration-none">
        <div className="flex items-center justify-between gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${estilo.pill}`}>{estilo.etiqueta}</span>
          <span className={`text-[11px] font-bold ${estilo.texto} truncate`}>{textoCuando(item)}</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5 font-extrabold text-slate-900 text-[15px] leading-tight">
              <span className="truncate">{item.cliente_nombre}</span>
              {item.score && <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${SCORE_COLOR[item.score]}`}>{item.score}</span>}
            </p>
            <p className="text-[11px] text-slate-600 font-semibold truncate flex items-center gap-1">
              {item.es_alquiler ? (
                <>
                  <HomeIcon className="w-3 h-3 shrink-0" /> {item.descripcion_inmueble}
                </>
              ) : (
                <>
                  {item.tipo} · {item.tasa}% mensual · prestó {formatCurrency(item.monto_original)}
                </>
              )}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {item.es_alquiler ? (
            <>
              <Celda label="Renta" valor={formatCurrency(item.renta_mensual)} />
              <Celda label="Atrasado" valor={formatCurrency(item.atrasado)} />
            </>
          ) : (
            <>
              <Celda label="Capital" valor={formatCurrency(item.capital_restante)} />
              <Celda label="Interés/mes" valor={formatCurrency(item.interes_mes)} />
            </>
          )}
          <Celda label={esAtraso ? "Atrasado" : "A cobrar"} valor={formatCurrency(item.montoACobrar)} destacado />
        </div>
      </Link>

      <div className="flex items-center gap-2 px-3.5 pb-3">
        <span className="flex-1 text-[10px] text-slate-500 font-semibold truncate">
          {esAtraso && item.debe_desde ? `Debe desde ${formatDate(item.debe_desde)}` : ""}
          {esAtraso && item.debe_desde ? " · " : ""}
          {item.ultimo_pago_fecha ? `Último pago ${formatDate(item.ultimo_pago_fecha)}` : "Sin pagos"}
        </span>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 w-10 min-[400px]:w-auto min-[400px]:px-3 rounded-xl bg-white/80 hover:bg-white border border-black/5 text-emerald-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 decoration-none"
            aria-label={`Enviar recordatorio por WhatsApp a ${item.cliente_nombre}`}
          >
            <MessageCircle className="w-4 h-4" /> <span className="hidden min-[400px]:inline">Recordar</span>
          </a>
        )}
        <button
          type="button"
          onClick={() => onCobrar(item)}
          className="h-10 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
        >
          <Wallet className="w-4 h-4" /> Cobrar
        </button>
      </div>
    </li>
  );
};
