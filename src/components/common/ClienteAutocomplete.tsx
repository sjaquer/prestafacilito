import React, { useState, useMemo, useRef, useEffect } from "react";
import { UserPlus, Check, Search, X } from "lucide-react";
import { Cliente } from "../../types";

interface ClienteAutocompleteProps {
  clientes: Cliente[];
  selectedClienteId: string;
  onSelectCliente: (clienteId: string) => void;
  onClienteCreado?: (nuevoCliente: Cliente) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

export const ClienteAutocomplete: React.FC<ClienteAutocompleteProps> = ({
  clientes,
  selectedClienteId,
  onSelectCliente,
  onClienteCreado,
  label = "Cliente",
  placeholder = "Buscar por nombre o apodo...",
  required = false
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatingInline, setIsCreatingInline] = useState(false);

  // Formulario rápido inline
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoApodo, setNuevoApodo] = useState("");
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [inlineError, setInlineError] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCliente = useMemo(() => {
    return clientes.find((c) => c.id === selectedClienteId) || null;
  }, [clientes, selectedClienteId]);

  useEffect(() => {
    if (selectedCliente) {
      setSearchTerm(selectedCliente.nombre_completo + (selectedCliente.apodo ? ` (${selectedCliente.apodo})` : ""));
    } else {
      setSearchTerm("");
    }
  }, [selectedCliente]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredClientes = useMemo(() => {
    if (!searchTerm.trim() || selectedCliente) return [];
    const term = searchTerm.toLowerCase().trim();
    return clientes
      .filter((c) => {
        const nombre = c.nombre_completo.toLowerCase();
        const apodo = (c.apodo || "").toLowerCase();
        return nombre.includes(term) || apodo.includes(term);
      })
      .slice(0, 8);
  }, [clientes, searchTerm, selectedCliente]);

  const handleSelect = (cliente: Cliente) => {
    onSelectCliente(cliente.id);
    setSearchTerm(cliente.nombre_completo + (cliente.apodo ? ` (${cliente.apodo})` : ""));
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelectCliente("");
    setSearchTerm("");
    setIsOpen(false);
  };

  const handleCreateInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) {
      setInlineError("El nombre completo es requerido");
      return;
    }

    setIsSavingInline(true);
    setInlineError("");

    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_completo: nuevoNombre.trim(),
          apodo: nuevoApodo.trim(),
          telefono: nuevoTelefono.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al crear cliente");
      }

      const clienteCreado: Cliente = await res.json();
      if (onClienteCreado) onClienteCreado(clienteCreado);
      onSelectCliente(clienteCreado.id);

      // Resetear sub-formulario
      setNuevoNombre("");
      setNuevoApodo("");
      setNuevoTelefono("");
      setIsCreatingInline(false);
    } catch (err: any) {
      setInlineError(err.message || "No se pudo crear el cliente");
    } finally {
      setIsSavingInline(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {!isCreatingInline && (
          <button
            type="button"
            onClick={() => {
              setIsCreatingInline(true);
              setIsOpen(false);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            + Nuevo cliente
          </button>
        )}
      </div>

      {isCreatingInline ? (
        <form onSubmit={handleCreateInlineSubmit} className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold text-emerald-800">
            <span>Creación rápida de cliente</span>
            <button
              type="button"
              onClick={() => setIsCreatingInline(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {inlineError && <p className="text-red-600 font-medium">{inlineError}</p>}

          <input
            type="text"
            placeholder="Nombre Completo *"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 outline-none"
            required
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Apodo (opcional)"
              value={nuevoApodo}
              onChange={(e) => setNuevoApodo(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
            <input
              type="tel"
              placeholder="Teléfono"
              value={nuevoTelefono}
              onChange={(e) => setNuevoTelefono(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsCreatingInline(false)}
              className="px-2.5 py-1 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSavingInline}
              className="px-3 py-1 font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {isSavingInline ? "Guardando..." : "Guardar y Seleccionar"}
            </button>
          </div>
        </form>
      ) : (
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (selectedCliente) onSelectCliente("");
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              className={`w-full pl-9 pr-8 py-2 bg-white border rounded-xl text-sm text-slate-800 placeholder-slate-400 transition-all outline-none ${
                selectedCliente
                  ? "border-emerald-300 ring-2 ring-emerald-50 bg-emerald-50/20 font-medium"
                  : "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-50"
              }`}
            />
            {selectedCliente && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isOpen && filteredClientes.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto py-1 text-xs divide-y divide-slate-100">
              {filteredClientes.map((cliente) => (
                <li
                  key={cliente.id}
                  onClick={() => handleSelect(cliente)}
                  className="px-3 py-2 hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{cliente.nombre_completo}</p>
                    {cliente.apodo && (
                      <p className="text-[11px] text-slate-500 italic">Apodo: {cliente.apodo}</p>
                    )}
                  </div>
                  {cliente.id === selectedClienteId && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
