import React from "react";
import { Link } from "react-router-dom";
import { MessageSquare, ArrowUpRight, Edit, Info, Calendar } from "lucide-react";
import { Badge } from "../ui/Badge";
import { ColumnDef } from "../ui/DataTable";
import { formatCurrency, formatDateWithDay, round2 } from "../../lib/formatters";
import { EstadoMoraCliente } from "../../lib/moraLogic";
import { ESTADO_CUOTA_BADGE, daysUntil, getEstadoCuotaLabel, getIndicatorColor, isEnMora, esLiquidado } from "./carteraUtils";

interface ColumnsDeps {
  moraById: Map<string, EstadoMoraCliente>;
  today: Date;
  getWhatsAppLink: (loan: any) => string | null;
  onEdit: (loan: any) => void;
}

const plazoBadge = "text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5";

export const buildCarteraColumns = ({ moraById, today, getWhatsAppLink, onEdit }: ColumnsDeps): ColumnDef<any>[] => [
  {
    header: "Prestatario",
    accessorKey: "cliente_nombre",
    sortable: true,
    cell: (loan) => (
      <Link
        to={`/clientes/${loan.cliente_id}`}
        className="flex items-center gap-2 hover:opacity-90 select-none cursor-pointer group decoration-none"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${getIndicatorColor(moraById.get(loan.id), today)}`} />
        <span className="font-bold text-slate-900 block group-hover:text-indigo-600 transition leading-tight">
          {loan.cliente_nombre}
        </span>
      </Link>
    ),
  },
  {
    header: "Capital",
    accessorKey: "monto_capital",
    sortable: true,
    cell: (loan) => (
      <span className="font-extrabold text-slate-800 font-mono text-xs sm:text-sm">{formatCurrency(loan.monto_capital)}</span>
    ),
  },
  {
    header: "Tasa (%)",
    accessorKey: "tasa_interes_porcentaje",
    sortable: true,
    cell: (loan) => <span className="font-bold text-indigo-600 font-mono text-xs">{loan.tasa_interes_porcentaje}%</span>,
  },
  {
    header: "F. Emisión",
    accessorKey: "fecha_emision",
    sortable: true,
    cell: (loan) => <span className="text-slate-600 font-mono text-[11px]">{loan.fecha_emision}</span>,
  },
  {
    header: "F. Vencimiento",
    accessorKey: "fecha_vencimiento",
    sortable: true,
    cell: (loan) => {
      if (loan.tipo_prestamo === "Alquiler de Casa") {
        const day = loan.fecha_emision ? parseInt(loan.fecha_emision.split("-")[2]) : "";
        return (
          <div className="flex flex-col gap-0.5 select-none">
            <span className="text-indigo-650 font-black text-xs leading-none">Día {day} de cada mes</span>
            <span className="text-slate-400 text-[9px] font-bold">
              Fin: {loan.fecha_vencimiento ? formatDateWithDay(loan.fecha_vencimiento) : "Indef."}
            </span>
          </div>
        );
      }
      return (
        <span className="text-slate-600 text-[11px] whitespace-normal">
          {loan.fecha_vencimiento ? formatDateWithDay(loan.fecha_vencimiento) : "No est."}
        </span>
      );
    },
  },
  {
    header: "Plazo Restante",
    cell: (loan) => {
      if (esLiquidado(loan)) {
        return <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Liquidado</span>;
      }
      const mora = moraById.get(loan.id);
      if (!mora || !mora.fechaCuotaActual) {
        return <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">No est.</span>;
      }
      if (isEnMora(mora)) {
        return <Badge variant="warning" className={plazoBadge}>Por cobrar</Badge>;
      }
      const days = Math.max(0, daysUntil(mora.fechaCuotaActual, today));
      if (days === 0) return <Badge variant="warning" className={`${plazoBadge} animate-pulse`}>Vence hoy</Badge>;
      if (days <= 5) return <Badge variant="info" className={plazoBadge}>En {days} días</Badge>;
      return <Badge variant="neutral" className={`${plazoBadge} text-slate-600`}>{days} días</Badge>;
    },
  },
  {
    header: "Categoría",
    accessorKey: "tipo_prestamo",
    sortable: true,
    cell: (loan) => (
      <Badge variant="neutral" className="text-[9px] font-bold py-0.5">
        {loan.tipo_prestamo}
      </Badge>
    ),
  },
  {
    header: "Estado cuota",
    cell: (loan) => {
      if (esLiquidado(loan)) {
        return <span className="badge text-[8px] font-black border bg-slate-100 text-slate-700 border-slate-200">Pagado</span>;
      }
      const mora = moraById.get(loan.id);
      if (!mora) return null;
      return (
        <span className={`badge text-[8px] font-black border ${ESTADO_CUOTA_BADGE[mora.estadoCuotaMes]}`}>
          {getEstadoCuotaLabel(mora)}
        </span>
      );
    },
  },
  {
    header: "Acciones",
    cell: (loan) => {
      const waLink = getWhatsAppLink(loan);
      return (
        <div className="flex items-center justify-end gap-2 shrink-0">
          {!esLiquidado(loan) && waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
              title="Cobrar vía WhatsApp"
            >
              <MessageSquare size={14} />
            </a>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(loan);
            }}
            className="text-slate-500 hover:text-indigo-650 p-1.5 hover:bg-slate-100 rounded-xl transition cursor-pointer border-none bg-transparent"
            title="Editar Parámetros"
          >
            <Edit size={14} />
          </button>
          <Link
            to={`/prestamos/${loan.id}`}
            className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-800 py-1 px-2.5 rounded-lg font-bold transition cursor-pointer inline-flex items-center gap-1 decoration-none"
          >
            <span>Ver</span>
            <ArrowUpRight size={10} />
          </Link>
        </div>
      );
    },
  },
];

/** Fila expandida de la tabla de escritorio con datos de flujo y vencimiento. */
export const CarteraExpandedRow: React.FC<{ loan: any; today: Date }> = ({ loan, today }) => {
  const days = daysUntil(loan.fecha_vencimiento, today);
  const interest = parseFloat(loan.tasa_interes_porcentaje) || 0;
  const capital = parseFloat(loan.monto_capital) || 0;
  const totalAmortizable = round2(capital * (1 + interest / 100));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs select-none p-2 bg-slate-50 border border-slate-200 rounded-2xl">
      <div className="flex items-center gap-2">
        <Info size={14} className="text-indigo-650 shrink-0" />
        <div>
          <span className="text-slate-500 font-bold block uppercase text-[9px] tracking-wider">Flujo Total Estimado:</span>
          <span className="font-extrabold text-slate-800 text-xs">{formatCurrency(totalAmortizable)} (con intereses)</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Calendar size={14} className="text-indigo-650 shrink-0" />
        <div>
          <span className="text-slate-500 font-bold block uppercase text-[9px] tracking-wider">Vencimiento Final:</span>
          <span className="font-extrabold text-slate-800 text-xs">
            {loan.fecha_vencimiento ? formatDateWithDay(loan.fecha_vencimiento) : "No configurado"}
          </span>
        </div>
      </div>

      {!esLiquidado(loan) && (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 animate-ping" />
          <div>
            <span className="text-slate-500 font-bold block uppercase text-[9px] tracking-wider">Cronograma:</span>
            <span
              className={`inline-flex items-center gap-1.5 font-black uppercase tracking-wider text-[9px] ${
                days < 0 ? "text-rose-600" : days === 0 ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              {days < 0 ? `Expirado hace ${Math.abs(days)} días` : days === 0 ? "Vence hoy" : `Queda un plazo de ${days} días`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
