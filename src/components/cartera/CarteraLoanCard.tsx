import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Edit3, MessageCircle } from "lucide-react";
import { formatFechaCorta, formatSoles } from "../../lib/formatters";
import { ESTILO_GRUPO } from "../../lib/cobranza";
import { ResumenPrestamo } from "../../lib/resumenPrestamo";

interface CarteraLoanCardProps {
  loan: any;
  resumen: ResumenPrestamo;
  waLink: string | null;
  onEdit: (loan: any) => void;
}

const Celda: React.FC<{ label: string; valor: string; fuerte?: boolean }> = ({ label, valor, fuerte }) => (
  <div className={`rounded-xl px-2.5 py-1.5 ${fuerte ? "bg-white shadow-sm" : "bg-white/60"}`}>
    <p className="text-[9.5px] font-bold text-slate-500 uppercase truncate">{label}</p>
    <p className={`font-mono leading-tight ${fuerte ? "text-[15px] font-black text-slate-900" : "text-[13px] font-bold text-slate-700"}`}>{valor}</p>
  </div>
);

/** Tarjeta de préstamo para el celular: estado por color, cifras clave y acciones directas (sin gestos ocultos). */
export const CarteraLoanCard: React.FC<CarteraLoanCardProps> = ({ loan, resumen: r, waLink, onEdit }) => {
  const liquidado = r.grupo === "liquidado";
  const estilo = liquidado ? null : ESTILO_GRUPO[r.grupo];
  const atraso = r.grupo === "atrasado" || r.grupo === "estancado";

  return (
    <li className={`border rounded-2xl overflow-hidden ${estilo ? estilo.tarjeta : "bg-slate-50 border-slate-200"}`}>
      <Link to={`/prestamos/${loan.id}`} className="block px-3.5 pt-3 pb-2.5 decoration-none">
        <div className="flex items-center justify-between gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${estilo ? estilo.pill : "bg-slate-200 text-slate-600"}`}>
            {estilo ? estilo.etiqueta : "Liquidado"}
          </span>
          {!liquidado && r.fecha && (
            <span className={`text-[11px] font-bold ${atraso ? "text-rose-700" : "text-slate-600"}`}>
              {atraso ? `${r.cuotasAtrasadas} cuota${r.cuotasAtrasadas > 1 ? "s" : ""} · desde ${formatFechaCorta(r.fecha)}` : formatFechaCorta(r.fecha)}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-slate-900 text-[15px] leading-tight truncate">{loan.cliente_nombre}</p>
            <p className="text-[11px] text-slate-600 font-semibold truncate">
              {loan.tipo_prestamo} · {loan.tasa_interes_porcentaje}% · prestó {formatSoles(loan.monto_capital)}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
        {!liquidado && (
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <Celda label="Capital" valor={formatSoles(r.capitalRestante)} />
            <Celda label="Interés/mes" valor={r.congelado ? "Congelado" : formatSoles(r.interesMes)} />
            <Celda label={atraso ? "Atrasado" : "A cobrar"} valor={formatSoles(r.aCobrar)} fuerte />
          </div>
        )}
      </Link>
      <div className="grid grid-cols-2 border-t border-black/5 text-xs font-bold">
        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 inline-flex items-center justify-center gap-1.5 text-emerald-700 hover:bg-white/60 decoration-none border-r border-black/5"
          >
            <MessageCircle className="w-4 h-4" /> Recordar
          </a>
        ) : (
          <span className="h-11 inline-flex items-center justify-center text-slate-400 border-r border-black/5">Sin WhatsApp</span>
        )}
        <button type="button" onClick={() => onEdit(loan)} className="h-11 inline-flex items-center justify-center gap-1.5 text-slate-700 hover:bg-white/60">
          <Edit3 className="w-4 h-4" /> Editar
        </button>
      </div>
    </li>
  );
};
