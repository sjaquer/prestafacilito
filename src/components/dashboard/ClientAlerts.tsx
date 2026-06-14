import React from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MessageSquare, Bell, AlertTriangle, Clock, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDateWithDay, getNombreUsuario, round2 } from "../../lib/formatters";
import { Cliente } from "../../types";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { motion } from "motion/react";
import { useAuth } from "../../hooks/useAuth";
import { calcularEstadoMora } from "../../lib/moraLogic";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 110,
      damping: 18,
    },
  },
};

interface ClientAlertsProps {
  activeLoans: any[];
  clientes: Cliente[];
  amortizaciones: any[];
  compact?: boolean;
}

export const ClientAlerts: React.FC<ClientAlertsProps> = ({
  activeLoans,
  clientes,
  amortizaciones,
  compact = false,
}) => {
  const { user } = useAuth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getWhatsAppLink = (loan: any, cliente: any, isMora: boolean) => {
    if (!cliente || !cliente.telefono) return null;
    const phone = cliente.telefono.replace(/[^\d+]/g, "").trim();
    if (!phone) return null;

    const isAlquiler = loan.tipo_prestamo === "Alquiler de Casa";
    const amount = isMora ? loan.mora.montoTotalAtrasado : loan.mora.montoCuotaActual;
    const formattedAmount = formatCurrency(amount);
    const fechaFormato = isMora 
      ? `cuotas vencidas (${loan.mora.cuotasAtrasadas} cuota(s) pendiente(s))`
      : `el ${formatDateWithDay(loan.mora.fechaCuotaActual)}`;
    
    const text = isAlquiler
      ? isMora
        ? `¡Hola, ${loan.cliente_nombre}! Te saludamos de la administración. 🇵🇪 Te recordamos amablemente tu mensualidad de alquiler pendiente de ${formattedAmount} (${loan.mora.cuotasAtrasadas} mes(es) vencido(s)). Agradecemos tu pronta regularización. ¡Que tengas un gran día!`
        : `¡Hola, ${loan.cliente_nombre}! Te saludamos de la administración. 🇵🇪 Te recordamos amablemente tu mensualidad de alquiler de ${formattedAmount} con vencimiento ${fechaFormato}. Agradecemos tu puntualidad y apoyo. ¡Que tengas un gran día!`
      : isMora
        ? `¡Hola, ${loan.cliente_nombre}! Te saludamos de la administración. 🇵🇪 Te recordamos amablemente tu cuota/saldo pendiente de ${formattedAmount} (${loan.mora.cuotasAtrasadas} cuota(s) vencida(s)). Agradecemos tu pronta regularización para no seguir generando intereses. ¡Que tengas un gran día!`
        : `¡Hola, ${loan.cliente_nombre}! Te saludamos de la administración. 🇵🇪 Te recordamos amablemente tu cuota pendiente de ${formattedAmount} con vencimiento ${fechaFormato}. Agradecemos tu puntualidad y apoyo. ¡Que tengas un gran día!`;
    
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const getRecordatorioLink = (loan: any, cliente: any, isMora: boolean) => {
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

    const isAlquiler = loan.tipo_prestamo === "Alquiler de Casa";
    const amount = isMora ? loan.mora.montoTotalAtrasado : loan.mora.montoCuotaActual;
    const cuota = formatCurrency(amount);
    const fecha = isMora ? "" : formatDateWithDay(loan.mora.fechaCuotaActual);
    const nombreMayus = loan.cliente_nombre.toUpperCase();
    const remitente = getNombreUsuario(user);

    const mensaje = isAlquiler
      ? isMora
        ? `¡Hola, ${tratamiento} ${nombreMayus}! Te saluda ${remitente}.\n` +
          `Te escribo para recordarte amablemente tu mensualidad de alquiler vencida pendiente de pago:\n\n` +
          `Monto: ${cuota} (${loan.mora.cuotasAtrasadas} mes(es) atrasado(s)).\n\n` +
          `Agradezco tu apoyo en regularizarlo a la brevedad. ¡Que tengas un gran día!\n` +
          `Cualquier cosa me lo escribe.`
        : `¡Hola, ${tratamiento} ${nombreMayus}! Te saluda ${remitente}.\n` +
          `Te escribo para recordarte amablemente tu mensualidad de alquiler pendiente a cancelar:\n\n` +
          `${cuota} con vencimiento el ${fecha}.\n\n` +
          `Agradezco tu puntualidad y apoyo. ¡Que tengas un gran día!\n` +
          `Cualquier cosa me lo escribe.`
      : isMora
        ? `¡Hola, ${tratamiento} ${nombreMayus}! Te saluda ${remitente}.\n` +
          `Te escribo para recordarte amablemente tu cuota vencida pendiente a cancelar:\n\n` +
          `Monto: ${cuota} (${loan.mora.cuotasAtrasadas} cuota(s) sin pagar).\n\n` +
          `Agradezco tu pronta regularización para no seguir generando intereses. ¡Que tengas un gran día!\n` +
          `Cualquier cosa me lo escribe.`
        : `¡Hola, ${tratamiento} ${nombreMayus}! Te saluda ${remitente}.\n` +
          `Te escribo para recordarte amablemente tu cuota pendiente a cancelar:\n\n` +
          `${cuota} con vencimiento el ${fecha} para no generar intereses.\n\n` +
          `Agradezco tu puntualidad y apoyo. ¡Que tengas un gran día!\n` +
          `Cualquier cosa me lo escribe.`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
  };

  // Calcular estado de mora real para cada préstamo
  const estadosMora = activeLoans.map(loan => calcularEstadoMora(loan, amortizaciones, today));

  // Combinar los préstamos con sus datos de mora calculados
  const loansWithMora = activeLoans.map((loan, i) => {
    const mora = estadosMora[i];
    const cliente = clientes.find(c => c.id === loan.cliente_id);
    return {
      ...loan,
      mora,
      cliente,
    };
  });

  // Panel izquierdo: EN MORA MENSUAL (no pagaron la cuota del mes)
  let loansEnMora = loansWithMora
    .filter(l => ["mora_mes", "mora_acumulada"].includes(l.mora.estadoCuotaMes))
    .sort((a, b) => b.mora.cuotasAtrasadas - a.mora.cuotasAtrasadas || b.mora.diasAtraso - a.mora.diasAtraso);

  // Panel derecho: COBROS DEL MES (cuota del mes pendiente pero aún no vencida)
  let loansDelMes = loansWithMora
    .filter(l => l.mora.estadoCuotaMes === "pendiente_mes")
    .sort((a, b) => new Date(a.mora.fechaCuotaActual).getTime() - new Date(b.mora.fechaCuotaActual).getTime());

  const originalVencidosLength = loansEnMora.length;
  const originalProximosLength = loansDelMes.length;

  if (compact) {
    loansEnMora = loansEnMora.slice(0, 5);
    loansDelMes = loansDelMes.slice(0, 5);
  }

  return (
    <div className="dashboard-shell space-y-4 font-sans select-none">
      <div className="dashboard-section-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="badge-warning w-fit">
              <Bell size={10} /> Radar de cartera
            </div>
            <h2 className="mt-2 text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none flex items-center gap-2">
              <span>Control de cartera en tiempo real</span>
            </h2>
          </div>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.18em] max-w-xs text-left sm:text-right">
            Auditoría de deudores vencidos y cobros por realizar
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* COLUMNA 1: Personas que no pagaron aún (SIN PAGAR ESTE MES / EN MORA MENSUAL) */}
        <Card variant="simple" className={`border-rose-200 flex flex-col justify-between ${compact ? 'h-[360px]' : 'h-[550px]'}`}>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <AlertTriangle size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 leading-none">Sin pagar este mes</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">Clientes con cuotas mensuales vencidas sin pagar</p>
                </div>
              </div>
              <span className="badge bg-rose-50 border border-rose-200 text-rose-700 font-bold font-mono">
                {originalVencidosLength} deudor{originalVencidosLength !== 1 ? "es" : ""}
              </span>
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex-1 overflow-y-auto mt-3 pr-1 space-y-3 scrollbar-thin"
            >
              {loansEnMora.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500 select-none py-16 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                  <CheckCircle2 size={32} className="text-rose-500 mb-3" />
                  <p className="text-xs font-bold text-slate-700">¡Ninguna cuota vencida!</p>
                  <p className="text-[10px] text-slate-500 mt-1">Todos los créditos están al día en sus cuotas mensuales</p>
                </div>
              ) : (
                loansEnMora.map((loan) => {
                  const waLink = getWhatsAppLink(loan, loan.cliente, true);
                  const recLink = getRecordatorioLink(loan, loan.cliente, true);

                  return (
                    <motion.div
                      key={loan.id}
                      variants={itemVariants}
                      className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-3xl gap-3 hover:border-slate-250 transition duration-150"
                    >
                      <div className="flex flex-col gap-2 min-w-0 flex-1">
                        <span className="font-black text-slate-800 text-sm leading-tight tracking-tight">{loan.cliente_nombre}</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="badge bg-rose-50 border border-rose-200 text-rose-700 font-black text-[8px] tracking-wide">
                            {loan.tipo_prestamo === "Alquiler de Casa" ? (
                              loan.mora.cuotasAtrasadas > 1 
                                ? `${loan.mora.cuotasAtrasadas} meses sin pagar`
                                : `Renta vencida hace ${loan.mora.diasAtraso} días`
                            ) : (
                              loan.mora.cuotasAtrasadas > 1 
                                ? `${loan.mora.cuotasAtrasadas} cuotas sin pagar`
                                : `Cuota vencida hace ${loan.mora.diasAtraso} días`
                            )}
                          </span>
                          {loan.mora.cuotasAtrasadas > 1 && (
                            <span className="badge bg-purple-50 border border-purple-200 text-purple-700 font-black text-[8px] tracking-wide">
                              Mora acumulada
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-[10px] text-rose-600 font-bold font-mono">
                            Debe: {formatCurrency(loan.mora.montoTotalAtrasado)}
                          </span>
                          <div className="flex items-center gap-1">
                            {recLink && (
                              <a
                                href={recLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition cursor-pointer"
                                title="Enviar recordatorio de mora"
                              >
                                <Bell size={12} />
                              </a>
                            )}
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                                title="Cobrar por WhatsApp"
                              >
                                <MessageSquare size={12} />
                              </a>
                            )}
                            <Link
                              to={`/prestamos/${loan.id}`}
                              className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                            >
                              <ArrowUpRight size={12} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          </div>

          {compact && originalVencidosLength > 5 && (
            <div className="pt-2 border-t border-slate-200 text-center mt-2">
              <Link
                to="/cartera"
                className="text-[9px] font-black text-rose-600 hover:text-rose-700 uppercase tracking-widest inline-flex items-center gap-1 hover:underline"
              >
                Ver {originalVencidosLength - 5} deudores más en Cartera →
              </Link>
            </div>
          )}
        </Card>

        {/* COLUMNA 2: Cobros del mes (VIGENTES POR VENCER) */}
        <Card variant="simple" className={`border-indigo-200 flex flex-col justify-between ${compact ? 'h-[360px]' : 'h-[550px]'}`}>
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header Column */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <CalendarDays size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 leading-none">Cobros del mes</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">Cuotas vigentes del mes por vencer</p>
                </div>
              </div>
              <span className="badge bg-indigo-55/10 border border-indigo-200 text-indigo-700 font-bold font-mono">
                {originalProximosLength} activo{originalProximosLength !== 1 ? "s" : ""}
              </span>
            </div>

            {/* List */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex-1 overflow-y-auto mt-3 pr-1 space-y-3 scrollbar-thin"
            >
              {loansDelMes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500 select-none py-16 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
                  <CalendarDays size={32} className="text-slate-400 mb-3" />
                  <p className="text-xs font-bold text-slate-700">Sin cobros pendientes este mes</p>
                  <p className="text-[10px] text-slate-500 mt-1">No hay mensualidades programadas pendientes de pago para este período</p>
                </div>
              ) : (
                loansDelMes.map((loan) => {
                  const remaining = Math.max(0, Math.ceil((new Date(loan.mora.fechaCuotaActual + "T00:00:00").getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
                  const waLink = getWhatsAppLink(loan, loan.cliente, false);
                  const recLink = getRecordatorioLink(loan, loan.cliente, false);
                  
                  let timerBadgeColor = "bg-slate-100 border-slate-200 text-slate-650";
                  if (remaining === 0) {
                    timerBadgeColor = "bg-amber-50 border-amber-250 text-amber-700 animate-pulse font-extrabold";
                  } else if (remaining <= 3) {
                    timerBadgeColor = "bg-emerald-50 border-emerald-250 text-emerald-700";
                  } else if (remaining <= 7) {
                    timerBadgeColor = "bg-emerald-50/50 border-emerald-200/80 text-emerald-650";
                  }

                  return (
                    <motion.div 
                      key={loan.id} 
                      variants={itemVariants}
                      className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-3xl gap-3 hover:border-slate-350 transition duration-150"
                    >
                      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                        <span className="font-black text-slate-900 text-sm leading-tight tracking-tight">{loan.cliente_nombre}</span>
                        <div className="flex items-center gap-2">
                          <Clock size={10} className="text-indigo-650 shrink-0" />
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {loan.tipo_prestamo === "Alquiler de Casa" ? (
                              <>Alquiler (Día {loan.mora.fechaCuotaActual ? parseInt(loan.mora.fechaCuotaActual.split("-")[2]) : ""}): <strong className="text-slate-700">{formatDateWithDay(loan.mora.fechaCuotaActual)}</strong></>
                            ) : (
                              <>Vence: <strong className="text-slate-700">{formatDateWithDay(loan.mora.fechaCuotaActual)}</strong></>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`badge uppercase text-[8px] tracking-wider font-black font-financial ${timerBadgeColor}`}>
                            {remaining === 0 ? "Vence hoy" : `En ${remaining} día${remaining !== 1 ? "s" : ""}`}
                          </span>
                          <span className="text-[10px] text-indigo-650 font-bold font-mono">
                            Cuota: {formatCurrency(loan.mora.montoCuotaActual)}
                          </span>
                          <div className="flex items-center gap-1">
                            {recLink && (
                              <a
                                href={recLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-emerald-55 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                                title="Enviar recordatorio amistoso"
                              >
                                <Bell size={12} />
                              </a>
                            )}
                            <Link
                              to={`/prestamos/${loan.id}`}
                              className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-655 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                            >
                              <ArrowUpRight size={12} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
            {compact && originalProximosLength > 5 && (
              <div className="pt-2 border-t border-slate-200 text-center mt-2">
                <Link
                  to="/cartera"
                  className="text-[9px] font-black text-indigo-650 hover:text-indigo-750 uppercase tracking-widest inline-flex items-center gap-1 hover:underline"
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
