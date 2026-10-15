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

const ScoreDot: React.FC<{ score?: "A" | "B" | "C" | null }> = ({ score }) => {
  if (!score) return null;
  const color = { A: "bg-emerald-100 text-emerald-800", B: "bg-amber-100 text-amber-800", C: "bg-rose-100 text-rose-800" }[score];
  return <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${color}`} title="Score del cliente">{score}</span>;
};

/** Tarjeta de un cobro pendiente: quién, cuánto, cuándo y acciones rápidas. */
export const CobroCard: React.FC<CobroCardProps> = ({ item, onCobrar }) => {
  const estilo = ESTILO_GRUPO[item.grupo];
  const detalle = item.es_alquiler ? `/alquileres/${item.prestamo_id}` : `/prestamos/${item.prestamo_id}`;
  const atrasadas = item.cuotas_debiendo || 0;
  const wa = item.grupo !== "al_dia"
    ? linkCobroWhatsApp(item.cliente_telefono, {
        esAlquiler: item.es_alquiler,
        fechaVencimiento: item.dia_vencimiento_mes,
        diasAtraso: item.dias !== null && item.dias < 0 ? Math.abs(item.dias) : item.dias_atraso,
        atrasado: item.grupo === "vencido",
        monto: item.montoACobrar,
      })
    : null;

  let cuando = textoRelativo(item.dias);
  if (item.grupo === "vencido" && atrasadas > 1) cuando = `${atrasadas} ${item.es_alquiler ? "meses" : "cuotas"} atrasadas`;
  if (item.grupo === "al_dia") cuando = item.estado_pago_mes === "pagado" ? "Al día" : `Próximo: ${formatDate(item.dia_vencimiento_mes)}`;

  return (
    <li className={`bg-white border border-slate-200/80 border-l-4 ${estilo.borde} rounded-2xl shadow-sm overflow-hidden`}>
      <Link to={detalle} className="flex items-start gap-3 px-4 pt-3.5 pb-2 decoration-none hover:bg-slate-50/60">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-extrabold text-slate-900 text-sm truncate">{item.cliente_nombre}</p>
            <ScoreDot score={item.score} />
          </div>
          <p className="text-[11px] text-slate-500 font-semibold truncate flex items-center gap-1">
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
          <p className={`text-base font-black font-mono ${item.grupo === "al_dia" ? "text-slate-400" : "text-slate-900"}`}>
            {item.grupo === "al_dia" ? "—" : formatCurrency(item.montoACobrar)}
          </p>
          <p className={`text-[11px] font-bold ${estilo.texto}`}>{cuando}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
      </Link>

      {item.grupo !== "al_dia" && (
        <div className="flex items-center gap-2 px-4 pb-3 pt-1">
          <span className="flex-1 text-[10px] text-slate-400 font-semibold truncate">
            {item.dia_vencimiento_mes ? `Vence ${formatDate(item.dia_vencimiento_mes)}` : ""}
            {item.ultimo_pago_fecha ? ` · Último pago ${formatDate(item.ultimo_pago_fecha)}` : " · Sin pagos aún"}
          </span>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold inline-flex items-center gap-1.5 decoration-none"
              aria-label={`Enviar recordatorio por WhatsApp a ${item.cliente_nombre}`}
            >
              <MessageCircle className="w-4 h-4" /> <span className="hidden min-[380px]:inline">Recordar</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => onCobrar(item)}
            className="h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Wallet className="w-4 h-4" /> Cobrar
          </button>
        </div>
      )}
    </li>
  );
};
