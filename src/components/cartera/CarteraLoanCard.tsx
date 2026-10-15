import React from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Edit } from "lucide-react";
import { motion } from "motion/react";
import { Badge } from "../ui/Badge";
import { formatCurrency, formatDateShort } from "../../lib/formatters";
import { EstadoMoraCliente } from "../../lib/moraLogic";
import {
  ESTADO_CUOTA_BADGE,
  daysUntil,
  getEstadoCuotaLabel,
  getIndicatorColor,
  isEnMora,
} from "./carteraUtils";

interface CarteraLoanCardProps {
  loan: any;
  mora?: EstadoMoraCliente;
  today: Date;
  waLink: string | null;
  onEdit: (loan: any) => void;
}

const badgeBase = "text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5";

const PlazoBadge: React.FC<{ loan: any; mora?: EstadoMoraCliente; today: Date }> = ({ loan, mora, today }) => {
  if (loan.estado === "pagado") {
    return <Badge variant="neutral" className={`${badgeBase} bg-slate-100 text-slate-500`}>Liquidado</Badge>;
  }
  if (!mora || !mora.fechaCuotaActual) return null;
  if (isEnMora(mora)) {
    return <Badge variant="danger" className={badgeBase}>Mora -{Math.abs(mora.diasAtraso)}d</Badge>;
  }
  const days = Math.max(0, daysUntil(mora.fechaCuotaActual, today));
  if (days === 0) return <Badge variant="warning" className={`${badgeBase} animate-pulse`}>Vence hoy</Badge>;
  if (days <= 5) return <Badge variant="info" className={badgeBase}>En {days}d</Badge>;
  return <Badge variant="neutral" className={`${badgeBase} text-slate-550`}>{days}d</Badge>;
};

/** Tarjeta deslizable de un préstamo para la vista móvil de la cartera. */
export const CarteraLoanCard: React.FC<CarteraLoanCardProps> = ({ loan, mora, today, waLink, onEdit }) => {
  const navigate = useNavigate();
  const isPagado = loan.estado === "pagado";
  const canCobrar = loan.estado === "activo" && !!waLink;

  const indicatorColor = isPagado ? "bg-slate-300" : getIndicatorColor(mora, today);
  const statusBadgeColor = isPagado
    ? "bg-slate-100 text-slate-600 border-slate-250"
    : mora
    ? ESTADO_CUOTA_BADGE[mora.estadoCuotaMes]
    : ESTADO_CUOTA_BADGE.sin_cuotas;
  const statusLabel = isPagado ? "Pagado" : mora ? getEstadoCuotaLabel(mora, true) : "Sin cuotas";

  let dueDateStr = "No est.";
  if (loan.tipo_prestamo === "Alquiler de Casa") {
    const day = loan.fecha_emision ? parseInt(loan.fecha_emision.split("-")[2]) : "";
    dueDateStr = `Día ${day} de c/mes`;
  } else if (loan.fecha_vencimiento) {
    dueDateStr = formatDateShort(loan.fecha_vencimiento);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 select-none min-h-[125px]">
      {/* ACCIONES DETRÁS (SWIPE REVEAL) */}
      <div className="absolute inset-0 flex items-center justify-end px-4 gap-2 bg-slate-100/80 z-0">
        {canCobrar && (
          <a
            href={waLink!}
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 transition"
            title="Cobrar vía WhatsApp"
          >
            <MessageSquare size={16} />
          </a>
        )}
        <button
          type="button"
          onClick={() => onEdit(loan)}
          className="w-10 h-10 bg-indigo-650 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition border-none cursor-pointer"
          title="Editar Parámetros"
        >
          <Edit size={16} />
        </button>
      </div>

      {/* TARJETA DELANTERA DESLIZABLE */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -150, right: 0 }}
        dragElastic={0.05}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 25 }}
        onTap={() => navigate(`/prestamos/${loan.id}`)}
        className="relative bg-white p-3.5 z-10 flex flex-col gap-2.5 border-b border-slate-200 cursor-pointer hover:bg-slate-50/50 touch-pan-y"
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${indicatorColor}`} />
            <h4 className="font-extrabold text-slate-900 text-[13px] tracking-tight truncate max-w-[150px] leading-tight">
              {loan.cliente_nombre}
            </h4>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`badge text-[8px] font-black border ${statusBadgeColor}`}>{statusLabel}</span>
            <PlazoBadge loan={loan} mora={mora} today={today} />
          </div>
        </div>

        {/* Fila 1: Resumen de saldos */}
        <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex flex-col">
            <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider">Capital Inic.</span>
            <span className="font-financial text-slate-700 text-[11px] font-bold mt-0.5 leading-none">
              {formatCurrency(loan.monto_capital)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7.5px] text-rose-500 font-black uppercase tracking-wider">Falta Cobrar</span>
            <span className="font-financial text-rose-600 text-[11px] font-extrabold mt-0.5 leading-none">
              {formatCurrency(mora ? mora.saldoPendiente : 0)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[7.5px] text-indigo-500 font-black uppercase tracking-wider">Cuota Mín.</span>
            <span className="font-financial text-indigo-650 text-[11px] font-extrabold mt-0.5 leading-none">
              {formatCurrency(mora ? (isEnMora(mora) ? mora.montoTotalAtrasado : mora.montoCuotaActual) : 0)}
            </span>
          </div>
        </div>

        {/* Fila 2: Detalles de pago y fechas */}
        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-550 pt-0.5">
          <div>
            <span className="text-[7.5px] text-slate-400 font-bold uppercase block tracking-wider">Último Abono</span>
            <span className="font-medium text-slate-700 block leading-tight mt-0.5">
              {mora && mora.ultimoPagoMonto
                ? `${formatCurrency(mora.ultimoPagoMonto)} (${formatDateShort(mora.ultimoPagoFecha!)})`
                : "Ninguno"}
            </span>
          </div>
          <div>
            <span className="text-[7.5px] text-slate-400 font-bold uppercase block tracking-wider">Próx. Vencimiento</span>
            <span className="font-mono text-slate-700 font-bold block leading-tight mt-0.5 truncate">{dueDateStr}</span>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[8.5px]">
          <span className="text-slate-450 font-bold uppercase">{loan.tipo_prestamo}</span>
          <div className="flex items-center gap-2">
            {canCobrar && (
              <a
                href={waLink!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition flex items-center justify-center decoration-none"
                title="Cobrar vía WhatsApp"
              >
                <MessageSquare size={12} />
              </a>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(loan);
              }}
              className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition flex items-center justify-center border-none cursor-pointer"
              title="Editar Parámetros"
            >
              <Edit size={12} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
