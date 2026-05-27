import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, User, Phone, MapPin, Calendar, CreditCard,
  Info, Loader2, ArrowUpRight, CheckCircle2, TrendingUp, Sparkles
} from "lucide-react";
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
  
  const [clientLoans, setClientLoans] = useState<any[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [loanError, setLoanError] = useState("");

  const cliente = clientes.find(c => c.id === id);

  // Fetch loans for this client from dashboard API
  const fetchClientLoans = useCallback(async () => {
    if (!id) return;
    setLoadingLoans(true);
    setLoanError("");
    
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const data = await res.json();
        const allLoans = data.prestamos || [];
        const filtered = allLoans.filter((p: any) => p.cliente_id === id);
        setClientLoans(filtered);
      } else {
        setLoanError("No se pudieron cargar los préstamos del cliente.");
      }
    } catch (err: any) {
      setLoanError(err.message || "Error de red al buscar préstamos.");
    } finally {
      setLoadingLoans(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClientLoans();
  }, [fetchClientLoans]);

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
        <div className="w-16 h-16 bg-white/[0.02] border border-white/[0.05] rounded-3xl flex items-center justify-center mx-auto text-slate-600">
          <User size={32} />
        </div>
        <h2 className="text-lg font-black text-white">Cliente no encontrado</h2>
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
          className="text-slate-400 hover:text-white text-xs font-black inline-flex items-center gap-2 cursor-pointer bg-none border-none"
        >
          <ArrowLeft size={14} />
          <span>Volver al directorio</span>
        </button>
      </div>

      {/* Client Header Card */}
      <Card variant="simple" className="relative overflow-hidden p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative">
          {/* Large initials avatar */}
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white font-black text-2xl shadow-xl shrink-0 select-none`}>
            {initials}
          </div>

          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <div className="flex flex-col md:flex-row md:items-center gap-2 flex-wrap justify-center md:justify-start">
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-400 pt-2 border-t border-white/[0.04] text-left">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-550 font-black uppercase tracking-wider block">Canal Telefónico</span>
                <span className="text-white font-mono">{cliente.telefono || "Sin teléfono registrado"}</span>
              </div>
              
              {cliente.direccion && (
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-550 font-black uppercase tracking-wider block">Domicilio</span>
                  <span className="text-white flex items-center gap-1">
                    <MapPin size={11} className="text-indigo-400 shrink-0" /> {cliente.direccion}
                  </span>
                </div>
              )}

              {cliente.numero_cuenta && (
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-550 font-black uppercase tracking-wider block">Datos de Abono</span>
                  <span className="text-white flex items-center gap-1 font-mono">
                    <CreditCard size={11} className="text-indigo-400 shrink-0" /> {cliente.numero_cuenta}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Financial Summary KPIs */}
      <ClientFinancialSummary cliente={cliente} />

      {/* Details Grid (Loans & Interaction timeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left/Middle Columns: Client Loans */}
        <div className="lg:col-span-2 space-y-6">
          <Card variant="simple" className="space-y-4">
            <div>
              <h3 className="font-black text-white text-base tracking-tight leading-none">Cartera de Créditos</h3>
              <p className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mt-1.5">
                Historial de financiamientos y saldos exigibles
              </p>
            </div>

            <div className="border-t border-white/[0.04]" />

            {loadingLoans ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="animate-spin text-indigo-400 mb-3" size={24} />
                <p className="text-xs text-slate-550 font-semibold uppercase tracking-wider">Cargando deudas del prestatario...</p>
              </div>
            ) : loanError ? (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-350 rounded-2xl text-xs font-bold leading-normal">
                {loanError}
              </div>
            ) : clientLoans.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs md:text-sm font-semibold bg-white/[0.01] border border-dashed border-white/[0.05] rounded-3xl p-6 select-none">
                El cliente no cuenta con deudas u operaciones en el sistema.
              </div>
            ) : (
              <div className="w-full overflow-hidden border border-white/[0.04] bg-[#0c1020]/25 rounded-2xl">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-white/[0.015] border-b border-white/[0.04]">
                      <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                      <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto</th>
                      <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Frecuencia / Tasa</th>
                      <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                      <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {clientLoans.map((loan) => {
                      const isActivo = loan.estado === "activo";
                      
                      return (
                        <tr key={loan.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="p-3 text-xs font-mono font-bold text-indigo-400">
                            {loan.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="p-3 text-xs font-mono font-extrabold text-white">
                            {formatCurrency(loan.monto_capital)}
                          </td>
                          <td className="p-3 text-xs font-semibold text-slate-350">
                            {loan.tipo_prestamo} ({loan.tasa_interes_porcentaje}%)
                          </td>
                          <td className="p-3 text-xs">
                            <Badge variant={isActivo ? "success" : "neutral"}>
                              {isActivo ? "Activo" : "Pagado"}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              to={`/prestamos/${loan.id}`}
                              className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white transition inline-flex items-center justify-center shrink-0 border border-white/[0.05] decoration-none cursor-pointer"
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
