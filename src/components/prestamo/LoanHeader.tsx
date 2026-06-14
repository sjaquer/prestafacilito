import React, { useMemo } from "react";
import { ArrowLeft, Landmark, Calendar, MessageSquare, HeartHandshake, ShieldAlert, Pencil, Percent } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ProgressBar } from "../ui/ProgressBar";
import { formatCurrency, formatDate } from "../../lib/formatters";

interface LoanHeaderProps {
  prestamo: any;
  deuda: any;
  planAyuda: any;
  onBack: () => void;
  onEdit?: () => void;
}

export const LoanHeader: React.FC<LoanHeaderProps> = ({
  prestamo,
  deuda,
  planAyuda,
  onBack,
  onEdit,
}) => {
  const isAlquiler = prestamo.tipo_prestamo === "Alquiler de Casa";
  const recoveryRate = useMemo(() => {
    const total = deuda.totalExigible || 0;
    const paid = deuda.totalPagado || 0;
    if (total <= 0) return 0;
    return Math.min(100, (paid / total) * 100);
  }, [deuda]);

  const initials = prestamo.cliente_nombre?.split(" ").map((n: string) => n[0]).join("").slice(0, 2) || "CL";

  // WA Link
  const phone = prestamo.cliente_telefono?.replace(/[^\d+]/g, "").trim();
  const waLink = phone ? `https://wa.me/${phone}` : null;

  return (
    <div className="space-y-6 select-none font-sans">
      
      {/* Botón Volver y Cabecera */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Button 
          onClick={onBack} 
          variant="secondary" 
          size="sm"
          icon={<ArrowLeft size={14} />}
        >
          Volver a Cartera
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {onEdit && (
            <Button
              onClick={onEdit}
              variant="secondary"
              size="sm"
              icon={<Pencil size={13} />}
            >
              Editar Parámetros
            </Button>
          )}
          <Badge variant={prestamo.estado === "activo" ? "success" : "neutral"}>
            {isAlquiler ? "Alquiler" : "Crédito"} {prestamo.estado === "activo" ? "Activo" : "Pagado"}
          </Badge>
          {planAyuda?.tieneAjustesActivos && (
            <Badge variant="primary" icon={<HeartHandshake size={11} />}>
              Plan de Ayuda Activo
            </Badge>
          )}
        </div>
      </div>

      {/* Bento Grid Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Info Cliente */}
        <Card variant="bento" className="lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-extrabold text-lg text-indigo-700 select-none shrink-0">
              {initials}
            </div>
            
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-snug truncate">
                {prestamo.cliente_nombre}
              </h1>
              <p className="text-[11px] text-slate-500 mt-1 font-bold">
                Categoría: <span className="text-slate-800 font-extrabold">{prestamo.tipo_prestamo}</span>
              </p>
              
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs font-semibold text-slate-500">
                {prestamo.cliente_telefono && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-bold">Teléfono:</span>
                    {waLink ? (
                      <a 
                        href={waLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-emerald-650 hover:text-emerald-700 font-extrabold flex items-center gap-1 decoration-none"
                      >
                        <MessageSquare size={12} />
                        {prestamo.cliente_telefono}
                      </a>
                    ) : (
                      <span className="text-slate-700">{prestamo.cliente_telefono}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Bento Row of key credit parameters */}
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-[11px] md:text-xs font-bold text-slate-550 bg-slate-50 border border-slate-200 p-3 rounded-2xl w-fit select-none">
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-indigo-600 shrink-0" />
                  <span className="text-slate-500">Emisión:</span>
                  <span className="text-slate-800 font-mono font-extrabold">{formatDate(prestamo.fecha_emision)}</span>
                </div>
                {!isAlquiler && (
                  <div className="flex items-center gap-1.5">
                    <Percent size={13} className="text-indigo-600 shrink-0" />
                    <span className="text-slate-500">Interés:</span>
                    <span className="text-slate-800 font-extrabold font-mono">{prestamo.tasa_interes_porcentaje}%</span>
                  </div>
                )}
                {prestamo.fecha_vencimiento && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-indigo-600 shrink-0" />
                    <span className="text-slate-500">Vencimiento:</span>
                    <span className="text-slate-800 font-mono font-extrabold">{formatDate(prestamo.fecha_vencimiento)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-200/60 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-bold uppercase tracking-wider">Progreso de Amortización</span>
              <span className="text-emerald-700 font-black font-mono">{recoveryRate.toFixed(1)}% pagado</span>
            </div>
            <ProgressBar value={recoveryRate} color="emerald" height="md" />
          </div>
        </Card>

        {/* Resumen Financiero */}
        <Card variant="bento" className="relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl" />
          
          <div>
            <span className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest block">
              Resumen de Deuda
            </span>
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between items-center text-xs md:text-sm font-semibold">
                <span className="text-slate-500">{isAlquiler ? "Total Alquiler:" : "Capital Prestado:"}</span>
                <span className="text-slate-800 font-mono font-extrabold">{formatCurrency(prestamo.monto_capital)}</span>
              </div>
              <div className="flex justify-between items-center text-xs md:text-sm font-semibold">
                <span className="text-slate-500">{isAlquiler ? "Alquiler Pendiente:" : "Intereses Pendientes:"}</span>
                <span className="text-indigo-700 font-mono font-extrabold">{formatCurrency(deuda.interesPendiente)}</span>
              </div>
              {deuda.moraAcumulada > 0 && (
                <div className="flex justify-between items-center text-xs md:text-sm font-semibold text-rose-700">
                  <span className="flex items-center gap-1">
                    <ShieldAlert size={12} />
                    Mora Acumulada:
                  </span>
                  <span className="font-mono font-extrabold">{formatCurrency(deuda.moraAcumulada)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200/60">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
              Total Pendiente Exigible
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight block mt-1">
              {formatCurrency(deuda.saldoPendiente)}
            </span>
          </div>
        </Card>

      </div>

    </div>
  );
};
