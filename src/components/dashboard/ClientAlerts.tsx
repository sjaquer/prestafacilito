import React from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MessageSquare, Bell, AlertTriangle, Clock, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "../../lib/formatters";
import { Cliente } from "../../types";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface ClientAlertsProps {
  activeLoans: any[];
  clientes: Cliente[];
  nowTick: Date;
  compact?: boolean;
}

export const ClientAlerts: React.FC<ClientAlertsProps> = ({
  activeLoans,
  clientes,
  nowTick,
  compact = false,
}) => {
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date(nowTick);
  today.setHours(0, 0, 0, 0);

  const getRemainingDays = (dateValue: string) => {
    if (!dateValue) return 0;
    const dueDate = new Date(`${dateValue}T00:00:00`);
    return Math.ceil((dueDate.getTime() - today.getTime()) / dayMs);
  };

  const getWhatsAppLink = (loan: any, cliente: any) => {
    if (!cliente || !cliente.telefono) return null;
    const phone = cliente.telefono.replace(/[^\d+]/g, "").trim();
    if (!phone) return null;

    const capital = parseFloat(loan.monto_capital) || 0;
    const interest = parseFloat(loan.tasa_interes_porcentaje) || 0;
    const totalExigible = capital * (1 + interest / 100);

    const formattedAmount = formatCurrency(totalExigible);
    const text = `¡Hola, ${loan.cliente_nombre}! Te saludamos de la administración. 🇵🇪 Te recordamos amablemente tu cuota/saldo pendiente de ${formattedAmount} con vencimiento el ${loan.fecha_vencimiento}. Agradecemos tu puntualidad y apoyo. ¡Que tengas un gran día!`;
    
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const getRecordatorioLink = (loan: any, cliente: any) => {
    if (!cliente || !cliente.telefono) return null;
    const phone = cliente.telefono.replace(/\D/g, '').trim();
    if (!phone) return null;

    const NOMBRES_FEMENINOS = new Set([
      'maria','ana','lucia','sofia','elena','carmen','rosa','claudia','andrea','patricia',
      'laura','diana','gloria','monica','sandra','alejandra','valentina','gabriela','lorena',
      'jessica','vanessa','adriana','paola','natalia','carolina','fernanda','daniela','sara',
      'isabel','pilar','julia','alicia','beatriz','cristina','irene','mariana','raquel',
      'silvia','yolanda','angela','consuelo','esperanza','graciela','luz','mercedes','norma',
      'olga','rebeca','susana','veronica','wendy','xiomara','yasmin','zoraida','pamela',
      'karina','brenda','gisela','rocio','miriam','nancy','marisol','milagros','flor',
      'liliana','estela','cecilia','catalina','evelyn','fabiola','helen','iliana'
    ]);
    const primerNombre = loan.cliente_nombre.trim().split(/\s+/)[0].toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tratamiento = NOMBRES_FEMENINOS.has(primerNombre) ? 'SRA.' : 'SR.';

    const capital = parseFloat(loan.monto_capital) || 0;
    const interest = parseFloat(loan.tasa_interes_porcentaje) || 0;
    const totalExigible = capital * (1 + interest / 100);
    const cuota = formatCurrency(totalExigible);
    const fecha = loan.fecha_vencimiento;
    const nombreMayus = loan.cliente_nombre.toUpperCase();

    const mensaje =
      `¡Hola, ${tratamiento} ${nombreMayus}! Te saluda Sebastián.\n` +
      `Te escribo para recordarte amablemente tu cuota pendiente a cancelar:\n\n` +
      `${cuota} con vencimiento el ${fecha} para no generar intereses.\n\n` +
      `Agradezco tu puntualidad y apoyo. ¡Que tengas un gran día!\n` +
      `Cualquier cosa me lo escribe.`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
  };

  // Process loans to get their timer info and categorize them
  const processedLoans = activeLoans.map(loan => {
    const remainingDays = getRemainingDays(loan.fecha_vencimiento);
    const cliente = clientes.find(c => c.id === loan.cliente_id);
    const waLink = getWhatsAppLink(loan, cliente);
    const recLink = getRecordatorioLink(loan, cliente);
    
    return {
      ...loan,
      remainingDays,
      waLink,
      recLink,
      cliente
    };
  });

  // Categorize
  // 1. Vencidos (Personas que no pagaron aún: remainingDays < 0)
  let loansVencidos = processedLoans
    .filter(l => l.remainingDays < 0)
    .sort((a, b) => a.remainingDays - b.remainingDays); // most overdue first

  // 2. Próximos a vencer (Faltan que paguen / por vencer: remainingDays >= 0)
  let loansProximos = processedLoans
    .filter(l => l.remainingDays >= 0)
    .sort((a, b) => a.remainingDays - b.remainingDays); // closest to due first

  const originalVencidosLength = loansVencidos.length;
  const originalProximosLength = loansProximos.length;

  if (compact) {
    loansVencidos = loansVencidos.slice(0, 5);
    loansProximos = loansProximos.slice(0, 5);
  }

  return (
    <div className="space-y-4 font-sans select-none">
      <div>
        <h2 className="text-base sm:text-lg font-black text-white tracking-tight leading-none flex items-center gap-2">
          <span>📊 Radar de Control de Cartera</span>
        </h2>
        <p className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mt-1.5">
          Auditoría en tiempo real de deudores vencidos y próximos vencimientos
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* COLUMNA 1: Personas que no pagaron aún (VENCIDOS) */}
        <Card variant="simple" className={`border-rose-500/10 flex flex-col justify-between ${compact ? 'h-[360px]' : 'h-[450px]'}`}>
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header Column */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertTriangle size={15} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white leading-none">Deudas Expiradas (Mora)</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Personas que no han cancelado</p>
                </div>
              </div>
              <span className="badge bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold font-mono">
                {loansVencidos.length} deudor{loansVencidos.length !== 1 ? "es" : ""}
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-3.5 scrollbar-thin">
              {loansVencidos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500 select-none py-16">
                  <CheckCircle2 size={32} className="text-emerald-500 mb-3" />
                  <p className="text-xs font-bold text-slate-350">¡Ninguna cuota vencida!</p>
                  <p className="text-[10px] text-slate-550 mt-1">Todos los créditos están al día en sus fechas</p>
                </div>
              ) : (
                loansVencidos.map((loan) => {
                  const initials = loan.cliente_nombre.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase();
                  const absOverdue = Math.abs(loan.remainingDays);
                  
                  return (
                    <div key={loan.id} className="flex items-center justify-between p-3.5 bg-rose-550/[0.015] border border-rose-500/10 rounded-2xl gap-3 hover:border-rose-500/20 transition duration-150">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-650 flex items-center justify-center font-black text-xs text-white shadow-md shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-100 text-xs truncate block leading-tight">{loan.cliente_nombre}</span>
                          <span className="text-[10px] text-slate-500 font-semibold block mt-1 flex items-center gap-1.5">
                            <Clock size={10} className="text-rose-500 shrink-0" />
                            <span>Venció: <strong className="text-slate-400 font-mono font-bold">{loan.fecha_vencimiento}</strong></span>
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="badge bg-rose-550/10 border border-rose-500/15 text-rose-400 font-black uppercase text-[8px] tracking-wider">
                            Mora +{absOverdue} d{absOverdue !== 1 ? "s" : ""}
                          </span>
                          <div className="flex items-center gap-1">
                            {loan.recLink && (
                              <a
                                href={loan.recLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/15 text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                                title="Enviar recordatorio de mora"
                              >
                                <Bell size={12} />
                              </a>
                            )}
                            {loan.waLink && (
                              <a
                                href={loan.waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-emerald-600/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/25 transition cursor-pointer"
                                title="Cobrar por WhatsApp"
                              >
                                <MessageSquare size={12} />
                              </a>
                            )}
                            <Link
                              to={`/prestamos/${loan.id}`}
                              className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white transition cursor-pointer"
                            >
                              <ArrowUpRight size={12} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {compact && originalVencidosLength > 5 && (
              <div className="pt-2 border-t border-white/5 text-center mt-2">
                <Link
                  to="/cartera"
                  className="text-[9px] font-black text-rose-400 hover:text-rose-350 uppercase tracking-widest inline-flex items-center gap-1 hover:underline"
                >
                  Ver {originalVencidosLength - 5} deudores más en Cartera →
                </Link>
              </div>
            )}
          </div>
        </Card>

        {/* COLUMNA 2: Faltan por pagar / Próximos a Vencer */}
        <Card variant="simple" className={`border-indigo-500/10 flex flex-col justify-between ${compact ? 'h-[360px]' : 'h-[450px]'}`}>
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header Column */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <CalendarDays size={15} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white leading-none">Próximos Vencimientos</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Cuotas vigentes por vencer</p>
                </div>
              </div>
              <span className="badge bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold font-mono">
                {loansProximos.length} activo{loansProximos.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-3.5 scrollbar-thin">
              {loansProximos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500 select-none py-16">
                  <CalendarDays size={32} className="text-slate-650 mb-3" />
                  <p className="text-xs font-bold text-slate-350">Sin vencimientos futuros</p>
                  <p className="text-[10px] text-slate-550 mt-1">No hay créditos activos pendientes de vencimiento</p>
                </div>
              ) : (
                loansProximos.map((loan) => {
                  const initials = loan.cliente_nombre.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase();
                  const remaining = loan.remainingDays;
                  
                  let timerBadgeColor = "bg-white/5 border-white/8 text-slate-400";
                  if (remaining === 0) {
                    timerBadgeColor = "bg-amber-500/10 border-amber-500/15 text-amber-400 animate-pulse";
                  } else if (remaining <= 3) {
                    timerBadgeColor = "bg-indigo-500/10 border-indigo-500/15 text-indigo-400";
                  } else if (remaining <= 7) {
                    timerBadgeColor = "bg-emerald-500/10 border-emerald-500/15 text-emerald-450";
                  }

                  return (
                    <div key={loan.id} className="flex items-center justify-between p-3.5 bg-white/[0.012] border border-white/[0.04] rounded-2xl gap-3 hover:border-white/[0.08] transition duration-150">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-650 flex items-center justify-center font-black text-xs text-white shadow-md shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-100 text-xs truncate block leading-tight">{loan.cliente_nombre}</span>
                          <span className="text-[10px] text-slate-500 font-semibold block mt-1 flex items-center gap-1.5">
                            <Clock size={10} className="text-indigo-400 shrink-0" />
                            <span>Monto: <strong className="text-slate-350 font-mono font-bold">{formatCurrency(loan.monto_capital)}</strong></span>
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`badge uppercase text-[8px] tracking-wider font-black ${timerBadgeColor}`}>
                            {remaining === 0 ? "Vence hoy" : `En ${remaining} día${remaining !== 1 ? "s" : ""}`}
                          </span>
                          <div className="flex items-center gap-1">
                            {loan.recLink && (
                              <a
                                href={loan.recLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/15 text-indigo-400 hover:bg-indigo-500/20 transition cursor-pointer"
                                title="Enviar recordatorio amistoso"
                              >
                                <Bell size={12} />
                              </a>
                            )}
                            <Link
                              to={`/prestamos/${loan.id}`}
                              className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white transition cursor-pointer"
                            >
                              <ArrowUpRight size={12} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {compact && originalProximosLength > 5 && (
              <div className="pt-2 border-t border-white/5 text-center mt-2">
                <Link
                  to="/cartera"
                  className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest inline-flex items-center gap-1 hover:underline"
                >
                  Ver {originalProximosLength - 5} vencimientos más en Cartera →
                </Link>
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
};
