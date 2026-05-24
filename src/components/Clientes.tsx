import React, { useState, useEffect } from "react";
import { UserPlus, Search, Phone, Calendar, Loader2, Check, User, AlertCircle, Filter } from "lucide-react";
import { Cliente } from "../types";
import { motion, AnimatePresence } from "motion/react";

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"todos" | "con_deuda" | "sin_deuda">("todos");
  const [error, setError] = useState<string | null>(null);

  // Formulario de nuevo cliente
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchClientes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/clientes");
      const data = await res.json();
      if (res.ok) {
        setClientes(data);
      } else {
        setError(data.error || "Ocurrió un error al obtener la lista de clientes.");
      }
    } catch (err) {
      setError("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const handleCreateCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre) return;

    setSubmitting(true);
    setSuccessMsg("");
    setError(null);

    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_completo: nombre,
          telefono,
          observaciones
        })
      });

      if (res.ok) {
        setSuccessMsg("Cliente registrado correctamente");
        setNombre("");
        setTelefono("");
        setObservaciones("");
        fetchClientes();
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        const data = await res.json();
        setError(data.error || "No se pudo registrar el cliente.");
      }
    } catch (err) {
      setError("Error de red al crear el cliente.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrar clientes
  const filteredClientes = clientes.filter(c => {
    const matchesSearch = c.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) || c.telefono.includes(searchQuery);
    if (!matchesSearch) return false;
    
    if (filterType === "con_deuda") {
      return c.prestamos_activos && c.prestamos_activos > 0;
    } else if (filterType === "sin_deuda") {
      return !c.prestamos_activos || c.prestamos_activos === 0;
    }
    return true;
  });

  const displayPhone = (phoneNum: string) => {
    if (!phoneNum) return "Sin teléfono";
    return phoneNum.startsWith("'") ? phoneNum.substring(1) : phoneNum;
  };

  return (
    <div id="clientes-view" className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
      
      {/* Columna Izquierda: Formulario de Registro - Bento Box */}
      <div id="new-client-card" className="bento-card p-6 rounded-3xl h-fit space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-slate-300">
            <UserPlus size={18} />
          </div>
          <h2 className="font-semibold text-white text-base tracking-tight">Nuevo Cliente</h2>
        </div>
        
        <form onSubmit={handleCreateCliente} className="space-y-4">
          <AnimatePresence>
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="p-3 bg-white/5 border border-white/10 text-slate-200 rounded-2xl text-xs flex items-center gap-2"
              >
                <Check size={14} className="text-white" />
                <span>{successMsg}</span>
              </motion.div>
            )}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs flex items-center gap-2"
              >
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400 block pl-1">Nombre Completo *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Juan Pérez"
              className="w-full glass-input rounded-2xl p-3.5 text-sm"
              required
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400 block pl-1">WhatsApp (Corrido)</label>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Ej. 51987654321"
              className="w-full glass-input rounded-2xl p-3.5 text-sm font-mono"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400 block pl-1">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalles del cliente..."
              rows={3}
              className="w-full glass-input rounded-2xl p-3.5 text-sm resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full glow-btn font-medium py-3.5 rounded-2xl text-sm transition cursor-pointer flex justify-center items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Guardando...</span>
              </>
            ) : (
              <span>Registrar Cliente</span>
            )}
          </button>
        </form>
      </div>

      {/* Columna Derecha: Listado de Clientes - Bento Grid */}
      <div id="clients-list-card" className="bento-card p-6 rounded-3xl lg:col-span-2 flex flex-col min-h-[500px]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/5">
          <div>
            <h2 className="font-semibold text-white text-base tracking-tight">Directorio</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{clientes.length} registrados</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Filtros */}
            <div className="flex bg-white/5 rounded-2xl p-1 w-full sm:w-auto">
              <button 
                onClick={() => setFilterType("todos")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-[11px] font-medium transition ${filterType === 'todos' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setFilterType("con_deuda")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-[11px] font-medium transition ${filterType === 'con_deuda' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Con Deuda
              </button>
              <button 
                onClick={() => setFilterType("sin_deuda")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-[11px] font-medium transition ${filterType === 'sin_deuda' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Sin Deuda
              </button>
            </div>
            
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 glass-input rounded-2xl text-sm"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <Loader2 className="animate-spin text-slate-400 mb-3" size={32} />
            <p className="text-[11px] text-slate-500">Cargando...</p>
          </div>
        ) : filteredClientes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16 space-y-2">
            <User className="text-slate-600 mb-2" size={32} />
            <p className="text-sm font-medium text-slate-300">No hay resultados</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[600px] custom-scrollbar">
            {filteredClientes.map(cliente => (
              <div
                key={cliente.id}
                className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 pr-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-slate-300">
                      <User size={14} />
                    </div>
                    <span className="font-medium text-white text-sm">
                      {cliente.nombre_completo}
                    </span>
                    {cliente.prestamos_activos !== undefined && (
                      cliente.prestamos_activos > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-white/10 text-slate-200">
                          Activo ({cliente.prestamos_activos})
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-transparent border border-white/10 text-slate-400">
                          Sin Deuda
                        </span>
                      )
                    )}
                  </div>
                  {cliente.observaciones && (
                    <p className="text-[11px] text-slate-400 pl-10">
                      {cliente.observaciones}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] pl-10 text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-500" />
                      <span>{cliente.fecha_registro}</span>
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {cliente.telefono && (
                    <a
                      href={`https://wa.me/${cliente.telefono.replace(/[^\d]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 px-3 py-2 rounded-xl text-slate-300 text-[11px] transition"
                    >
                      <Phone size={13} />
                      <span className="font-mono">{displayPhone(cliente.telefono)}</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
