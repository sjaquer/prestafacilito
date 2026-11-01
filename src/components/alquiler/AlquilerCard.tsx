import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, MessageCircle, Wallet } from "lucide-react";
import { Alquiler } from "../../types";
import { formatSoles } from "../../lib/formatters";
import { linkCobroWhatsApp } from "../../lib/cobranza";

export interface AlquilerItemCalculado extends Alquiler {
  cliente_nombre?: string;
  cliente_apodo?: string;
  cliente_telefono?: string;
  dia_cobro?: number;
  dias_restantes?: number;
  mes_actual_estado?: "pagado" | "parcial" | "pendiente";
  mes_actual_pendiente?: number;
  meses_atrasados?: number;
  total_pendiente?: number;
  /** Solo lo ya vencido. */
  total_vencido?: number;
}

export type EstadoAlquiler = "atrasado" | "pendiente" | "parcial" | "pagado" | "finalizado";

export function estadoDeAlquiler(a: AlquilerItemCalculado): EstadoAlquiler {
  if (a.estado !== "activo") return "finalizado";
  if ((a.meses_atrasados || 0) > 0) return "atrasado";
  if (a.mes_actual_estado === "pagado") return "pagado";
  return a.mes_actual_estado === "parcial" ? "parcial" : "pendiente";
}

export const ESTILO_ALQUILER: Record<EstadoAlquiler, { etiqueta: string; pill: string; tarjeta: string; dot: string }> = {
  atrasado: { etiqueta: "Atrasado", pill: "bg-rose-600 text-white", tarjeta: "bg-rose-50 border-rose-200", dot: "bg-rose-500" },
  pendiente: { etiqueta: "Por cobrar", pill: "bg-amber-500 text-white", tarjeta: "bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  parcial: { etiqueta: "Pago parcial", pill: "bg-amber-500 text-white", tarjeta: "bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  pagado: { etiqueta: "Mes pagado", pill: "bg-emerald-600 text-white", tarjeta: "bg-white border-slate-200", dot: "bg-emerald-500" },
  finalizado: { etiqueta: "Finalizado", pill: "bg-slate-200 text-slate-700", tarjeta: "bg-slate-50 border-slate-200", dot: "bg-slate-400" },
};

function textoCobro(a: AlquilerItemCalculado, estado: EstadoAlquiler) {
  if (estado === "finalizado") return "Contrato cerrado";
  if (estado === "atrasado") {
    const n = a.meses_atrasados || 1;
    return `${n} mes${n > 1 ? "es" : ""} sin pagar`;
  }
  const d = a.dias_restantes ?? 0;
  const dia = a.dia_cobro ? `día ${a.dia_cobro}` : "";
  if (estado === "pagado") return `Próximo cobro ${dia}`.trim();
  return d <= 0 ? `Vence hoy · ${dia}` : `En ${d} día${d === 1 ? "" : "s"} · ${dia}`;
}

const Celda: React.FC<{ label: string; valor: string; destacado?: boolean }> = ({ label, valor, destacado }) => (
  <div className={`rounded-xl px-2.5 py-1.5 ${destacado ? "bg-white shadow-sm" : "bg-white/60"}`}>
    <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
    <p className={`font-mono leading-tight ${destacado ? "text-[15px] font-black text-slate-900" : "text-[13px] font-bold text-slate-700"}`}>{valor}</p>
  </div>
);

interface AlquilerCardProps {
  alquiler: AlquilerItemCalculado;
  onCobrar: (alquilerId: string) => void;
}

/** Contrato de alquiler en la lista: color según el estado del mes, cifras clave y acciones de cobro. */
export const AlquilerCard: React.FC<AlquilerCardProps> = ({ alquiler: a, onCobrar }) => {
  const estado = estadoDeAlquiler(a);
  const estilo = ESTILO_ALQUILER[estado];
  const debe = Number(a.total_vencido ?? a.total_pendiente) || 0;
  const aCobrar = estado === "atrasado" ? debe : Number(a.mes_actual_pendiente) || 0;
  const activo = estado !== "finalizado";
  const wa =
    activo && estado !== "pagado"
      ? linkCobroWhatsApp(a.cliente_telefono, { esAlquiler: true, atrasado: estado === "atrasado", monto: aCobrar })
      : null;

  return (
    <li className={`border rounded-2xl overflow-hidden ${estilo.tarjeta}`}>
      <Link to={`/alquileres/${a.id}`} className="block px-3.5 pt-3 pb-2.5 decoration-none">
        <div className="flex items-center justify-between gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${estilo.pill}`}>{estilo.etiqueta}</span>
          <span className="text-[11px] font-bold text-slate-600 truncate">{textoCobro(a, estado)}</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-slate-900 text-[15px] leading-tight truncate">
              {a.descripcion_inmueble || "Inmueble sin descripción"}
            </p>
            <p className="text-[11px] text-slate-600 font-semibold truncate">
              {a.cliente_nombre}
              {a.cliente_apodo && <span className="text-slate-400"> · {a.cliente_apodo}</span>}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <Celda label="Renta" valor={formatSoles(a.monto_mensual)} />
          <Celda label="Día de cobro" valor={a.dia_cobro ? `Día ${a.dia_cobro}` : "—"} />
          <Celda label={estado === "atrasado" ? "Debe" : "A cobrar"} valor={formatSoles(aCobrar)} destacado />
        </div>
      </Link>

      {activo && estado !== "pagado" && (
        <div className="flex items-center justify-end gap-2 px-3.5 pb-3">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 px-3 rounded-xl bg-white/80 hover:bg-white border border-black/5 text-emerald-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 decoration-none"
              aria-label={`Enviar recordatorio por WhatsApp a ${a.cliente_nombre}`}
            >
              <MessageCircle className="w-4 h-4" /> Recordar
            </a>
          )}
          <button
            type="button"
            onClick={() => onCobrar(a.id)}
            className="h-10 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Wallet className="w-4 h-4" /> Cobrar
          </button>
        </div>
      )}
    </li>
  );
};
