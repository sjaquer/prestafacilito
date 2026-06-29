import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, User, Phone, MapPin, Calendar, CreditCard,
  Info, Loader2, ArrowUpRight, CheckCircle2, TrendingUp, Sparkles, AlertTriangle
} from "lucide-react";
import { usePagos } from "../hooks/usePagos";
import { calcularEstadoMora } from "../lib/moraLogic";
import { buildPaymentSchedule } from "../lib/loanLogic";
import { useClientes } from "../hooks/useClientes";
import { Cliente } from "../types";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { ClientFinancialSummary } from "../components/cliente/ClientFinancialSummary";
import { ClientNotes } from "../components/cliente/ClientNotes";
import { formatCurrency, formatDate } from "../lib/formatters";

export const ClienteDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clientes, loading: loadingClientes, updateCliente, refetch: refetchClientes } = useClientes();
  const { fetchAmortizaciones } = usePagos();
  
  const [clientLoans, setClientLoans] = useState<any[]>([]);
  const [amortizaciones, setAmortizaciones] = useState<any[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [loanError, setLoanError] = useState("");

  const cliente = clientes.find(c => c.id === id);

  // Fetch loans for this client from dashboard API
  const fetchClientLoans = useCallback(async () => {
    if (!id) return;
    setLoadingLoans(true);
    setLoanError("");
    
    try {
      const [dashRes, amortList] = await Promise.all([
        fetch("/api/dashboard"),
        fetchAmortizaciones()
      ]);
      if (dashRes.ok) {
        const data = await dashRes.json();
        const allLoans = data.prestamos || [];
        const filtered = allLoans.filter((p: any) => p.cliente_id === id);
        setClientLoans(filtered);
      } else {
        setLoanError("No se pudieron cargar los préstamos del cliente.");
      }
      setAmortizaciones(amortList || []);
    } catch (err: any) {
      setLoanError(err.message || "Error de red al buscar préstamos.");
    } finally {
      setLoadingLoans(false);
    }
  }, [id, fetchAmortizaciones]);

  useEffect(() => {
    fetchClientLoans();
  }, [fetchClientLoans]);

  const clientMoraDetails = useMemo(() => {
    const activeClientLoans = clientLoans.filter(l => l.estado === "activo");
    const estados = activeClientLoans.map(l => {
      const computed = calcularEstadoMora(l, amortizaciones, new Date());
      return { ...computed, tipo_prestamo: l.tipo_prestamo };
    });
    
    const cuotasEnMora = estados.filter(e => ["mora_mes", "mora_acumulada"].includes(e.estadoCuotaMes));
    const totalCuotasAtrasadas = cuotasEnMora.reduce((sum, e) => sum + e.cuotasAtrasadas, 0);
    const totalMontoAtrasado = cuotasEnMora.reduce((sum, e) => sum + e.montoTotalAtrasado, 0);
    
    const tieneMora = cuotasEnMora.length > 0;
    
    let proximaCuotaFecha = "";
    let proximaCuotaMonto = 0;
    let proximaCuotaTipo = "";
    
    if (!tieneMora) {
      const cuotasPendientes = estados
        .filter(e => e.estadoCuotaMes === "pendiente_mes")
        .sort((a, b) => new Date(a.fechaCuotaActual).getTime() - new Date(b.fechaCuotaActual).getTime());
      
      if (cuotasPendientes.length > 0) {
        proximaCuotaFecha = cuotasPendientes[0].fechaCuotaActual;
        proximaCuotaMonto = cuotasPendientes[0].montoCuotaActual;
        proximaCuotaTipo = cuotasPendientes[0].tipo_prestamo;
      }
    }
    
    return {
      tieneMora,
      totalCuotasAtrasadas,
      totalMontoAtrasado,
      proximaCuotaFecha,
      proximaCuotaMonto,
      proximaCuotaTipo
    };
  }, [clientLoans, amortizaciones]);

  // Calcular distribución financiera agregada del cliente para las barras de progreso lineales de alta definición
  const clientFinancialDistribution = useMemo(() => {
    if (clientLoans.length === 0) return null;

    let capitalTotal = 0;
    let capitalAmortizado = 0;
    let interesTotal = 0;
    let interesPagado = 0;
    let moraTotal = 0;
    let moraPagado = 0;

    clientLoans.forEach(loan => {
      if (loan.tipo_prestamo === "Alquiler de Casa") return; // Alquileres no entran en desglose de interés/mora tradicional
      
      const pagosDelPrestamo = amortizaciones.filter(a => a.prestamo_id === loan.id);
      const computed = buildPaymentSchedule(loan, pagosDelPrestamo, [], new Date());
      
      const capTotal = Number(loan.monto_capital) || 0;
      const capPendiente = Number(computed.resumen?.capitalPendiente) || 0;
      const capAmortizado = Math.max(0, capTotal - capPendiente);

      const intPagado = computed.cuotas?.reduce((sum: number, c: any) => sum + (c.interesPagado || 0), 0) || 0;
      const intPendiente = Number(computed.resumen?.interesPendiente) || 0;
      const intTotal = intPagado + intPendiente;

      const morPagado = computed.cuotas?.reduce((sum: number, c: any) => sum + (c.moraPagado || 0), 0) || 0;
      const morPendiente = Number(computed.resumen?.moraAcumulada) || 0;
      const morTotal = morPagado + morPendiente;

      capitalTotal += capTotal;
      capitalAmortizado += capAmortizado;
      interesTotal += intTotal;
      interesPagado += intPagado;
      moraTotal += morTotal;
      moraPagado += morPagado;
    });

    const capitalPct = capitalTotal > 0 ? (capitalAmortizado / capitalTotal) * 100 : 0;
    const interesPct = interesTotal > 0 ? (interesPagado / interesTotal) * 100 : 0;
    const moraPct = moraTotal > 0 ? (moraPagado / moraTotal) * 100 : 0;

    return {
      capitalTotal,
      capitalAmortizado,
      capitalPct: Math.min(100, capitalPct),
      interesTotal,
      interesPagado,
      interesPct: Math.min(100, interesPct),
      moraTotal,
      moraPagado,
      moraPct: Math.min(100, moraPct)
    };
  }, [clientLoans, amortizaciones]);

  // Wrapper update client callback for child components
  const handleUpdateClient = async (clientId: string, data: Partial<Cliente>) => {
    const result = await updateCliente(clientId, data);
    if (result.success) {
      refetchClientes();
    }
    return result;
  };

  if (loadingClientes) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="animate-spin text-indigo-400 mb-3" size={32} />
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cargando perfil del cliente...</p>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="space-y-4 max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-3xl flex items-center justify-center mx-auto text-slate-500">
          <User size={32} />
        </div>
        <h2 className="text-lg font-black text-slate-800">Cliente no encontrado</h2>
        <p className="text-xs text-slate-500 font-semibold leading-relaxed">
          El cliente que intentas visualizar no existe o fue removido.
        </p>
        <button
          onClick={() => navigate("/clientes")}
          className="btn-primary py-2 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border-none"
        >
          <ArrowLeft size={13} />
          <span>Volver al directorio</span>
        </button>
      </div>
    );
  }

  const initials = cliente.nombre_completo.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
  const avatarGradient = "from-indigo-500 to-violet-600";

  return (
    <div className="space-y-6">
      {/* Back link & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/clientes")}
          className="text-slate-600 hover:text-slate-900 text-xs font-black inline-flex items-center gap-2 cursor-pointer bg-none border-none"
        >
          <ArrowLeft size={14} />
          <span>Volver al directorio</span>
        </button>
      </div>

      {/* Client Header Card */}
      <Card variant="simple" className="relative overflow-hidden p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative">
          {/* Large initials avatar */}
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-black text-2xl shadow-xl shrink-0 select-none`}>
            {initials}
          </div>

          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <div className="flex flex-col md:flex-row md:items-center gap-2 flex-wrap justify-center md:justify-start">
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">
                  {cliente.nombre_completo}
                </h1>
                {cliente.prestamos_activos && cliente.prestamos_activos > 0 ? (
                  <Badge variant="success" className="w-fit mx-auto md:mx-0">
                    Deudor Activo
                  </Badge>
                ) : (
                  <Badge variant="neutral" className="w-fit mx-auto md:mx-0">
                    Historial Limpio
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 flex items-center justify-center md:justify-start gap-1">
                <Calendar size={12} /> Cliente desde: {formatDate(cliente.fecha_registro || "")}
              </p>
            </div>

            {/* Quick Contact & Bank Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-500 pt-2 border-t border-slate-200/80 text-left">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Canal Telefónico</span>
                <span className="text-slate-800 font-mono">{cliente.telefono || "Sin teléfono registrado"}</span>
              </div>
              
              {cliente.direccion && (
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Domicilio</span>
                  <span className="text-slate-800 flex items-center gap-1">
                    <MapPin size={11} className="text-indigo-650 shrink-0" /> {cliente.direccion}
                  </span>
                </div>
              )}

              {cliente.numero_cuenta && (
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Datos de Abono</span>
                  <span className="text-slate-800 flex items-center gap-1 font-mono">
                    <CreditCard size={11} className="text-indigo-650 shrink-0" /> {cliente.numero_cuenta}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Banner de Estado de Mora / Cobros */}
      {!loadingLoans && (clientMoraDetails.tieneMora ? (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm animate-fadeIn">
          <div className="w-10 h-10 rounded-2xl bg-rose-100/80 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-sm font-black text-rose-900 leading-none">Este cliente tiene mensualidades o cuotas pendientes vencidas</p>
            <p className="text-xs text-rose-700 mt-2 font-medium">
              Tiene <strong className="font-extrabold">{clientMoraDetails.totalCuotasAtrasadas} mensualidad(es) o cuota(s) vencida(s)</strong> sin pagar.
              Total atrasado: <strong className="font-mono font-extrabold">{formatCurrency(clientMoraDetails.totalMontoAtrasado)}</strong>.
            </p>
          </div>
        </div>
      ) : clientMoraDetails.proximaCuotaFecha ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm animate-fadeIn">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            {clientMoraDetails.proximaCuotaTipo === "Alquiler de Casa" ? (
              <>
                <p className="text-sm font-black text-emerald-900 leading-none">Alquiler al día</p>
                <p className="text-xs text-emerald-700 mt-2 font-medium">
                  Próxima mensualidad de alquiler programada para el <strong className="font-extrabold">{formatDate(clientMoraDetails.proximaCuotaFecha)}</strong> (Día {parseInt(clientMoraDetails.proximaCuotaFecha.split("-")[2])} de cada mes) por un monto de <strong className="font-mono font-extrabold">{formatCurrency(clientMoraDetails.proximaCuotaMonto)}</strong>.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-black text-emerald-900 leading-none">Cliente al día en sus cuotas</p>
                <p className="text-xs text-emerald-700 mt-2 font-medium">
                  Próximo vencimiento programado para el <strong className="font-extrabold">{formatDate(clientMoraDetails.proximaCuotaFecha)}</strong> por un monto de <strong className="font-mono font-extrabold">{formatCurrency(clientMoraDetails.proximaCuotaMonto)}</strong>.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null)}

      {/* Financial Summary KPIs */}
      <ClientFinancialSummary cliente={cliente} />

      {/* 📊 Desglose de Retorno y Amortización Agregado del Cliente */}
      {clientFinancialDistribution && clientFinancialDistribution.capitalTotal > 0 && (
        <Card variant="simple" className="p-5 space-y-4">
          <div>
            <h3 className="font-black text-slate-800 text-sm tracking-tight leading-none">
              📊 Distribución de Amortización Acumulada
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
              Estado total de recuperación de capital, intereses y mora del cliente (excluye Alquileres)
            </p>
          </div>
          
          <div className="border-t border-slate-200/60 pt-3 grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Capital */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase">Capital Recuperado</span>
                <span className="text-emerald-700 font-black font-mono">
                  {formatCurrency(clientFinancialDistribution.capitalAmortizado)} / {formatCurrency(clientFinancialDistribution.capitalTotal)} ({clientFinancialDistribution.capitalPct.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className="h-full rounded-full bg-emerald-500 transition-all duration-505" 
                  style={{ width: `${clientFinancialDistribution.capitalPct}%` }}
                />
              </div>
            </div>

            {/* Interés */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase">Interés Cobrado</span>
                <span className="text-indigo-700 font-black font-mono">
                  {formatCurrency(clientFinancialDistribution.interesPagado)} / {formatCurrency(clientFinancialDistribution.interesTotal)} ({clientFinancialDistribution.interesPct.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className="h-full rounded-full bg-indigo-500 transition-all duration-505" 
                  style={{ width: `${clientFinancialDistribution.interesPct}%` }}
                />
              </div>
            </div>

            {/* Mora */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold uppercase">Mora Cobrada</span>
                <span className="text-amber-700 font-black font-mono">
                  {formatCurrency(clientFinancialDistribution.moraPagado)} / {formatCurrency(clientFinancialDistribution.moraTotal)} ({clientFinancialDistribution.moraPct.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className="h-full rounded-full bg-amber-500 transition-all duration-505" 
                  style={{ width: `${clientFinancialDistribution.moraPct}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Details Grid (Loans & Interaction timeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left/Middle Columns: Client Loans */}
        <div className="lg:col-span-2 space-y-6">
          <Card variant="simple" className="space-y-4">
            <div>
              <h3 className="font-black text-slate-900 text-base tracking-tight leading-none">Cartera de Créditos</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
                Historial de financiamientos y saldos exigibles
              </p>
            </div>

            <div className="border-t border-slate-200/80" />

            {loadingLoans ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="animate-spin text-indigo-650 mb-3" size={24} />
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Cargando deudas del prestatario...</p>
              </div>
            ) : loanError ? (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs font-bold leading-normal">
                {loanError}
              </div>
            ) : clientLoans.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs md:text-sm font-semibold bg-slate-50/40 border border-dashed border-slate-200 rounded-3xl p-6 select-none">
                El cliente no cuenta con deudas u operaciones en el sistema.
              </div>
            ) : (
              <div className="w-full overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Código</th>
                      <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Monto</th>
                      <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Frecuencia / Tasa</th>
                      <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                      <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Ver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {clientLoans.map((loan) => {
                      const isActivo = loan.estado === "activo";
                      
                      return (
                        <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 text-xs font-mono font-bold text-indigo-650">
                            {loan.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="p-3 text-xs font-mono font-extrabold text-slate-800">
                            {formatCurrency(loan.monto_capital)}
                          </td>
                          <td className="p-3 text-xs font-semibold text-slate-600">
                            {loan.tipo_prestamo === "Alquiler de Casa" ? (
                              <span>Alquiler (Día {parseInt(loan.fecha_emision.split("-")[2])} c/mes)</span>
                            ) : (
                              <span>{loan.tipo_prestamo} ({loan.tasa_interes_porcentaje}%)</span>
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            <Badge variant={isActivo ? "success" : "neutral"}>
                              {isActivo ? "Activo" : "Pagado"}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              to={`/prestamos/${loan.id}`}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition inline-flex items-center justify-center shrink-0 border border-slate-200 decoration-none cursor-pointer"
                            >
                              <ArrowUpRight size={13} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Interaction timeline Notes */}
        <div>
          <ClientNotes
            cliente={cliente}
            onUpdateClient={handleUpdateClient}
          />
        </div>
      </div>
    </div>
  );
};
