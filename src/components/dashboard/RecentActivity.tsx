import React from "react";
import { Terminal, Shield, Eye, FileImage, User } from "lucide-react";
import { Card } from "../ui/Card";
import { formatCurrency } from "../../lib/formatters";
import { Amortizacion } from "../../types";
import { getBancoForMetodo } from "../../lib/constants";

interface LogEntry {
  id: string;
  fecha_hora: string;
  usuario: string;
  accion: string;
  detalles: string;
}

interface RecentActivityProps {
  amortizaciones: Amortizacion[];
  logs: LogEntry[];
  onVoucherClick: (url: string) => void;
  resolveVoucherUrl: (url: string | null | undefined) => string;
  compact?: boolean;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  amortizaciones,
  logs,
  onVoucherClick,
  resolveVoucherUrl,
  compact = false,
}) => {
  const registeredVouchers = amortizaciones.filter(a => a.comprobante_url);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 select-none">
      {/* VOUCHERS GALLERY */}
      <Card variant="bento" className="flex flex-col h-full">
        <div className="mb-4">
          <h2 className="text-sm md:text-base font-black text-slate-800 tracking-tight leading-none">Comprobantes Recientes</h2>
          <p className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mt-1.5">Galería de recibos adjuntos en cobros</p>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          {registeredVouchers.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FileImage size={22} className="text-slate-600" />
              </div>
              <p className="text-xs font-bold text-slate-500 mb-1">Sin comprobantes</p>
              <p className="text-[11px] text-slate-500">Los vouchers registrados aparecerán aquí.</p>
            </div>
          ) : (
            <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} gap-3`}>
              {registeredVouchers.slice(0, compact ? 4 : 6).map((voucher) => (
                <div 
                  key={voucher.id}
                  onClick={() => onVoucherClick(resolveVoucherUrl(voucher.comprobante_url))}
                  className="bg-slate-50/50 border border-slate-200 p-2 rounded-2xl shadow-sm hover:border-emerald-500/30 transition-all duration-300 cursor-pointer flex flex-col justify-between group overflow-hidden"
                >
                  <div className="w-full h-24 bg-slate-150 rounded-xl overflow-hidden border border-slate-200 relative flex items-center justify-center">
                    <img 
                      src={resolveVoucherUrl(voucher.comprobante_url)} 
                      alt="Voucher" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 text-[11px] font-bold">
                      <Eye size={12} />
                      <span>Ver</span>
                    </div>
                  </div>
                  
                  <div className="mt-2 min-w-0">
                    <span className="text-[10px] font-black text-slate-800 block truncate leading-tight">
                      {(voucher as any).cliente_nombre || "Cliente"}
                    </span>
                    <div className="flex items-center justify-between gap-1 mt-1">
                      <span className="text-[10px] font-bold text-emerald-700 font-mono">
                        {formatCurrency(parseFloat(String(voucher.monto)))}
                      </span>
                      {(() => {
                        const banco = getBancoForMetodo(voucher.metodo_pago);
                        return (
                          <span className={`text-[7.5px] font-extrabold px-1 py-0.2 rounded uppercase ${banco ? banco.badgeClass : "bg-slate-100 text-slate-700 border border-slate-200"}`}>
                            {voucher.metodo_pago.split(" ")[0]}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* AUDIT LOG CONSOLE */}
      <Card variant="bento" className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm md:text-base font-black text-slate-800 tracking-tight leading-none">Consola de Auditoría</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">Monitoreo interno de operaciones en vivo</p>
          </div>
          <Terminal className="text-slate-500 shrink-0" size={16} />
        </div>

        <div className="flex-1 overflow-y-auto max-h-[300px] pr-1.5 space-y-2.5 scrollbar-thin">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-semibold">
              No hay registros de auditoría aún.
            </div>
          ) : (
            logs.slice(0, compact ? 5 : undefined).map((log) => (
              <div 
                key={log.id} 
                className="bg-slate-50/50 border border-slate-100 rounded-xl p-3 flex items-start gap-2.5 transition duration-150 hover:bg-slate-50"
              >
                <div className="p-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg shrink-0 mt-0.5">
                  <Shield size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black text-indigo-755 flex items-center gap-1">
                      <User size={10} />
                      {log.usuario}
                    </span>
                    <span className="text-[8.5px] text-slate-500 font-mono font-bold">
                      {new Date(log.fecha_hora).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <span className="text-[10.5px] font-bold text-slate-800 block mt-1 uppercase tracking-wide">
                    {log.accion.replace(/_/g, " ")}
                  </span>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed font-medium break-words">
                    {log.detalles}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
