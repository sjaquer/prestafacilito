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

/** Texto corto de "cuándo": en días para lo próximo, en cuotas para lo atrasado. */
function textoCuando(item: ItemCobro) {
  const atrasadas = item.cuotas_debiendo || 0;
  const unidad = item.es_alquiler ? "mes" : "cuota";
  if ((item.grupo === "vencido" || item.grupo === "estancado") && atrasadas > 0) {
    return `${atrasadas} ${unidad}${atrasadas > 1 ? "s" : ""} atrasada${atrasadas > 1 ? "s" : ""}`;
  }
  if (item.grupo === "al_dia") return item.estado_pago_mes === "pagado" ? "Sin deuda" : `Próximo ${formatDate(item.dia_vencimiento_mes)}`;
  return textoRelativo(item.dias);
}

/**
 * Tarjeta de un cobro. Toda la tarjeta toma el color de su estado (vencido, hoy, semana…)
 * para leer la lista de un vistazo, sin tener que fijarse en detalles.
 */
export const CobroCard: React.FC<CobroCardProps> = ({ item, onCobrar }) => {
  const estilo = ESTILO_GRUPO[item.grupo];
  const detalle = item.es_alquiler ? `/alquileres/${item.prestamo_id}` : `/prestamos/${item.prestamo_id}`;
  const pendiente = item.grupo !== "al_dia";
  const atrasado = item.grupo === "vencido" || item.grupo === "estancado";
  const wa = pendiente
    ? linkCobroWhatsApp(item.cliente_telefono, {
        esAlquiler: item.es_alquiler,
        fechaVencimiento: item.dia_vencimiento_mes,
        diasAtraso: item.dias !== null && item.dias < 0 ? Math.abs(item.dias) : item.dias_atraso,
        atrasado,
        monto: item.montoACobrar,
      })
    : null;

  return (
    <li className={`border rounded-2xl overflow-hidden ${estilo.tarjeta}`}>
      <Link to={detalle} className="block px-4 pt-3 pb-2.5 decoration-none">
        <div className="flex items-center justify-between gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${estilo.pill}`}>{estilo.etiqueta}</span>
          <span className={`text-[11px] font-bold ${estilo.texto}`}>{textoCuando(item)}</span>
        </div>

        <div className="mt-2 flex items-end gap-3">
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5 font-extrabold text-slate-900 text-[15px] leading-tight">
              <span className="truncate">{item.cliente_nombre}</span>
              {item.score && <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${SCORE_COLOR[item.score]}`}>{item.score}</span>}
            </p>
            <p className="text-[11px] text-slate-600 font-semibold truncate flex items-center gap-1 mt-0.5">
              {item.es_alquiler ? (
                <>
                  <HomeIcon className="w-3 h-3 shrink-0" /> {item.descripcion_inmueble || "Alquiler"}
                </>
              ) : (
                <>
                  {item.tipo_prestamo} · {formatCurrency(item.monto_capital)} al {item.tasa_interes_porcentaje}%
                </>
              )}
            </p>
          </div>
          <div className="text-right shrink-0">
            {pendiente && <p className="text-[10px] font-bold text-slate-500">{atrasado ? "Atrasado" : "A cobrar"}</p>}
            <p className="text-lg font-black font-mono text-slate-900 leading-tight">{pendiente ? formatCurrency(item.montoACobrar) : "—"}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mb-1" />
        </div>
      </Link>

      {pendiente && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <span className="flex-1 text-[10px] text-slate-500 font-semibold truncate">
            {atrasado && item.dia_vencimiento_mes ? `Debe desde ${formatDate(item.dia_vencimiento_mes)}` : item.dia_vencimiento_mes ? `Vence ${formatDate(item.dia_vencimiento_mes)}` : ""}
            {item.ultimo_pago_fecha ? ` · último pago ${formatDate(item.ultimo_pago_fecha)}` : " · sin pagos"}
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
      )}
    </li>
  );
};
