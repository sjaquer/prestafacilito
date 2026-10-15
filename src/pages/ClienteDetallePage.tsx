import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User, Loader2 } from "lucide-react";
import { usePagos } from "../hooks/usePagos";
import { useClientes } from "../hooks/useClientes";
import { Cliente } from "../types";
import { ClientFinancialSummary } from "../components/cliente/ClientFinancialSummary";
import { ClientNotes } from "../components/cliente/ClientNotes";
import { ClientePerfilHeader, ClienteMoraBanner } from "../components/cliente/ClientePerfilHeader";
import { ClienteScoreCard } from "../components/cliente/ClienteScoreCard";
import { ClienteDocumentos } from "../components/cliente/ClienteDocumentos";
import { ClienteCreditos, ClienteAlquileres, ClienteDistribucionCard } from "../components/cliente/ClienteCreditos";
import { calcularDistribucionFinanciera, resumirMoraCliente } from "../components/cliente/clienteFinanzas";

export const ClienteDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clientes, loading: loadingClientes, updateCliente, refetch: refetchClientes } = useClientes();
  const { fetchAmortizaciones } = usePagos();

  const [clientLoans, setClientLoans] = useState<any[]>([]);
  const [clientAlquileres, setClientAlquileres] = useState<any[]>([]);
  const [amortizaciones, setAmortizaciones] = useState<any[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [loanError, setLoanError] = useState("");

  const cliente = clientes.find((c) => c.id === id);

  const fetchClientLoans = useCallback(async () => {
    if (!id) return;
    setLoadingLoans(true);
    setLoanError("");

    try {
      const [dashRes, amortList, alquileresRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetchAmortizaciones(),
        fetch("/api/alquileres"),
      ]);

      if (dashRes.ok) {
        const data = await dashRes.json();
        setClientLoans((data.prestamos || []).filter((p: any) => p.cliente_id === id));
      } else {
        setLoanError("No se pudieron cargar los préstamos del cliente.");
      }

      if (alquileresRes.ok) {
        const alqData = await alquileresRes.json();
        setClientAlquileres((alqData || []).filter((a: any) => a.cliente_id === id));
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

  const moraResumen = useMemo(() => resumirMoraCliente(clientLoans, amortizaciones), [clientLoans, amortizaciones]);
  const distribucion = useMemo(
    () => calcularDistribucionFinanciera(clientLoans, amortizaciones),
    [clientLoans, amortizaciones]
  );

  const handleUpdateClient = async (clientId: string, data: Partial<Cliente>) => {
    const result = await updateCliente(clientId, data);
    if (result.success) refetchClientes();
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

  if (!cliente || !id) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/clientes")}
          className="text-slate-600 hover:text-slate-900 text-xs font-black inline-flex items-center gap-2 cursor-pointer bg-transparent border-none"
        >
          <ArrowLeft size={14} />
          <span>Volver al directorio</span>
        </button>
      </div>

      <ClientePerfilHeader cliente={cliente} />

      {!loadingLoans && <ClienteMoraBanner resumen={moraResumen} />}

      <ClientFinancialSummary cliente={cliente} />

      <ClienteScoreCard clienteId={id} />

      <ClienteDistribucionCard data={distribucion} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <ClienteCreditos loans={clientLoans} loading={loadingLoans} error={loanError} />
          <ClienteAlquileres alquileres={clientAlquileres} />
        </div>

        <div className="space-y-6">
          <ClientNotes cliente={cliente} onUpdateClient={handleUpdateClient} />
          <ClienteDocumentos clienteId={id} driveFolderId={cliente.drive_folder_id} />
        </div>
      </div>
    </div>
  );
};

export default ClienteDetallePage;
