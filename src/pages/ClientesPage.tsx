import React, { useState } from "react";
import { UserPlus, Users, RefreshCw } from "lucide-react";
import { useClientes } from "../hooks/useClientes";
import { Cliente } from "../types";
import { ClientList } from "../components/cliente/ClientList";
import { ClientSlideOverForm } from "../components/cliente/ClientSlideOverForm";

export const ClientesPage: React.FC = () => {
  const { clientes, loading, createCliente, updateCliente, refetch } = useClientes();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState<Cliente | null>(null);

  const handleOpenCreateForm = () => {
    setClienteToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (cliente: Cliente) => {
    setClienteToEdit(cliente);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (clientData: Partial<Cliente>) => {
    if (clienteToEdit) {
      const res = await updateCliente(clienteToEdit.id, clientData);
      if (res.success) {
        refetch();
        return true;
      } else {
        alert(res.error || "No se pudo actualizar el cliente.");
        return false;
      }
    } else {
      const res = await createCliente(clientData as any);
      if (res.success) {
        refetch();
        return true;
      } else {
        alert(res.error || "No se pudo crear el cliente.");
        return false;
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Principal de la Página de Clientes (Sección 7.2) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-semibold">
              Fase 7 — Directorio
            </span>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Total: {clientes.length} prestatarios
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Directorio de Clientes</h1>
          <p className="text-xs text-slate-300">
            Lista completa con apodos, evaluación de score A/B/C e historial acumulado.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={refetch}
            disabled={loading}
            className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white rounded-xl transition-all"
            title="Actualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleOpenCreateForm}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> [+ Nuevo Cliente]
          </button>
        </div>
      </div>

      {/* Lista Protagonista de Clientes (Tarea 7.1, 7.3.3) */}
      <ClientList
        clientes={clientes}
        isLoading={loading}
        onEditClient={handleOpenEditForm}
        onOpenNewClientForm={handleOpenCreateForm}
      />

      {/* Panel / Formulario Deslizable (Slide-over) (Tarea 7.3.2) */}
      <ClientSlideOverForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        clienteToEdit={clienteToEdit}
      />
    </div>
  );
};

export default ClientesPage;
