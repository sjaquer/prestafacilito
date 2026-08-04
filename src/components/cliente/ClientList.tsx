import React, { useState, useMemo } from "react";
import { Search, UserPlus, Users } from "lucide-react";
import { Cliente } from "../../types";
import { ClientCard } from "./ClientCard";

interface ClientListProps {
  clientes: Cliente[];
  isLoading?: boolean;
  onEditClient?: (cliente: Cliente) => void;
  onOpenNewClientForm?: () => void;
  onUploadDocumento?: (cliente: Cliente) => void;
}

export const ClientList: React.FC<ClientListProps> = ({
  clientes,
  isLoading = false,
  onEditClient,
  onOpenNewClientForm,
  onUploadDocumento
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const clientesFiltrados = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return clientes;

    return clientes.filter(
      (c) =>
        (c.nombre_completo || "").toLowerCase().includes(query) ||
        (c.apodo || "").toLowerCase().includes(query) ||
        (c.telefono || "").includes(query)
    );
  }, [clientes, searchTerm]);

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[350px] space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-slate-500">Cargando directorio de clientes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Buscador de Clientes */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, apodo o teléfono..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-50 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 self-end sm:self-auto">
          <span>Mostrando {clientesFiltrados.length} de {clientes.length} clientes</span>
        </div>
      </div>

      {/* Grid de Tarjetas de Cliente */}
      {clientesFiltrados.length === 0 ? (
        <div className="p-12 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-3">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">
            {searchTerm
              ? `No se encontraron clientes que coincidan con "${searchTerm}".`
              : "No hay clientes registrados en el sistema."}
          </p>
          {onOpenNewClientForm && (
            <button
              onClick={onOpenNewClientForm}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-emerald-700 transition-all inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" /> Registrar Primer Cliente
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientesFiltrados.map((cliente) => (
            <ClientCard
              key={cliente.id}
              cliente={cliente}
              onEditClient={onEditClient}
              onUploadDocumento={onUploadDocumento}
            />
          ))}
        </div>
      )}
    </div>
  );
};
