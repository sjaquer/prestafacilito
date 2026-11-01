import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, User, Loader2 } from "lucide-react";
import { Modal } from "../components/ui/Modal";
import { useFeedback } from "../components/ui/Feedback";
import { CollapsibleSection } from "../components/ui/CollapsibleSection";
import { CrearPrestamoForm } from "../components/dashboard/CrearPrestamoForm";
import { ClientSlideOverForm } from "../components/cliente/ClientSlideOverForm";
import { subirDocumentosCliente } from "../components/cliente/documentos";
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
  const { clientes, loading: loadingClientes, updateCliente, uploadClienteDocument, refetch: refetchClientes } = useClientes();
  const { notify } = useFeedback();
  const [modal, setModal] = useState<null | "prestamo" | "editar">(null);
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
    <div className="space-y-4 pb-12 max-w-5xl mx-auto">
      <button
        onClick={() => navigate("/clientes")}
        className="h-10 text-slate-600 hover:text-slate-900 text-xs font-bold inline-flex items-center gap-2 bg-transparent border-none"
      >
        <ArrowLeft size={14} /> Clientes
      </button>

      <ClientePerfilHeader cliente={cliente} onNuevoPrestamo={() => setModal("prestamo")} onEditar={() => setModal("editar")} />

      {!loadingLoans && <ClienteMoraBanner resumen={moraResumen} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <ClienteCreditos loans={clientLoans} amortizaciones={amortizaciones} loading={loadingLoans} error={loanError} />
          <ClienteAlquileres alquileres={clientAlquileres} />
        </div>
        <div className="space-y-4">
          <ClientNotes cliente={cliente} onUpdateClient={handleUpdateClient} />
          <ClienteDocumentos clienteId={id} driveFolderId={cliente.drive_folder_id} />
        </div>
      </div>

      {/* Información de consulta ocasional: plegada para no estorbar */}
      <CollapsibleSection title="Historial y score del cliente" icon={<BarChart3 className="w-4 h-4" />}>
        <div className="space-y-4 pt-2">
          <ClientFinancialSummary cliente={cliente} />
          <ClienteDistribucionCard data={distribucion} />
          <ClienteScoreCard clienteId={id} />
        </div>
      </CollapsibleSection>

      <Modal isOpen={modal === "prestamo"} onClose={() => setModal(null)} title={`Nuevo préstamo · ${cliente.nombre_completo}`} size="lg">
        <CrearPrestamoForm
          bare
          clientes={clientes}
          clienteIdInicial={cliente.id}
          onPrestamoCreado={(nuevo) => {
            setModal(null);
            notify("Préstamo creado", "success");
            if (nuevo?.id) navigate(`/prestamos/${nuevo.id}`);
            else fetchClientLoans();
          }}
        />
      </Modal>

      <ClientSlideOverForm
        isOpen={modal === "editar"}
        onClose={() => setModal(null)}
        clienteToEdit={cliente}
        onSubmit={async (data, files = []) => {
          const res = await updateCliente(cliente.id, data);
          if (!res.success) {
            notify(res.error || "No se pudo actualizar el cliente.");
            return false;
          }
          await subirDocumentosCliente(cliente.id, files, uploadClienteDocument);
          notify("Datos actualizados", "success");
          refetchClientes();
          return true;
        }}
      />
    </div>
  );
};

export default ClienteDetallePage;
