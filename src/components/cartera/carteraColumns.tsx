import React from "react";
import { Link } from "react-router-dom";
import { MessageSquare, ArrowUpRight, Edit } from "lucide-react";
import { ColumnDef } from "../ui/DataTable";
import { formatCurrency, formatDate } from "../../lib/formatters";
import { ESTILO_GRUPO } from "../../lib/cobranza";
import { ResumenPrestamo } from "../../lib/resumenPrestamo";

interface ColumnsDeps {
  resumenDe: (loan: any) => ResumenPrestamo;
  getWhatsAppLink: (loan: any) => string | null;
  onEdit: (loan: any) => void;
}

const EstadoPill: React.FC<{ r: ResumenPrestamo }> = ({ r }) =>
  r.grupo === "liquidado" ? (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-600">Liquidado</span>
  ) : (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap ${ESTILO_GRUPO[r.grupo].pill}`}>{ESTILO_GRUPO[r.grupo].etiqueta}</span>
  );

const monto = (v: number) => <span className="font-mono text-xs font-bold text-slate-800">{formatCurrency(v)}</span>;

/** Columnas de la tabla de cartera (escritorio). Mismos datos y colores que las tarjetas del celular. */
export const buildCarteraColumns = ({ resumenDe, getWhatsAppLink, onEdit }: ColumnsDeps): ColumnDef<any>[] => [
  {
    header: "Cliente",
    accessorKey: "cliente_nombre",
    sortable: true,
    cell: (loan) => (
      <Link to={`/clientes/${loan.cliente_id}`} className="font-bold text-slate-900 hover:text-indigo-600 decoration-none">
        {loan.cliente_nombre}
      </Link>
    ),
  },
  { header: "Estado", cell: (loan) => <EstadoPill r={resumenDe(loan)} /> },
  {
    header: "Préstamo",
    accessorKey: "monto_capital",
    sortable: true,
    cell: (loan) => (
      <span className="text-xs text-slate-600 whitespace-nowrap">
        {formatCurrency(loan.monto_capital)} · {loan.tasa_interes_porcentaje}% · {loan.tipo_prestamo}
      </span>
    ),
  },
  { header: "Capital restante", cell: (loan) => monto(resumenDe(loan).capitalRestante) },
  { header: "Interés/mes", cell: (loan) => (resumenDe(loan).grupo === "liquidado" ? "—" : resumenDe(loan).congelado ? "Congelado" : monto(resumenDe(loan).interesMes)) },
  {
    header: "A cobrar",
    cell: (loan) => {
      const r = resumenDe(loan);
      if (r.grupo === "liquidado") return "—";
      const atraso = r.grupo === "atrasado" || r.grupo === "estancado";
      return (
        <div className="leading-tight">
          <span className="font-mono text-sm font-black text-slate-900">{formatCurrency(r.aCobrar)}</span>
          <span className={`block text-[10px] font-bold ${atraso ? "text-rose-600" : "text-slate-500"}`}>
            {r.fecha ? (atraso ? `desde ${formatDate(r.fecha)}` : formatDate(r.fecha)) : ""}
          </span>
        </div>
      );
    },
  },
  {
    header: "",
    cell: (loan) => {
      const waLink = getWhatsAppLink(loan);
      return (
        <div className="flex items-center justify-end gap-1">
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50"
              title="Recordar por WhatsApp"
              aria-label="Recordar por WhatsApp"
            >
              <MessageSquare size={15} />
            </a>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(loan);
            }}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
            title="Editar"
            aria-label="Editar préstamo"
          >
            <Edit size={15} />
          </button>
          <Link
            to={`/prestamos/${loan.id}`}
            className="h-8 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center gap-1 decoration-none"
          >
            Ver <ArrowUpRight size={11} />
          </Link>
        </div>
      );
    },
  },
];
