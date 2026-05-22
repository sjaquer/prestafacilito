import React, { useState, useEffect } from "react";
import { UserPlus, Search, Phone, Calendar, Loader2, Check, User, AlertCircle } from "lucide-react";
import { Cliente } from "../types";
import { motion, AnimatePresence } from "motion/react";

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
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
        setSuccessMsg("¡Cliente registrado con éxito en la base de datos!");
        setNombre("");
        setTelefono("");
        setObservaciones("");
        // Recargar lista
        fetchClientes();
        
        // Limpiar mensaje de éxito después de un tiempo
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        const data = await res.json();
        setError(data.error || "No se pudo registrar el cliente.");
      }
    } catch (err) {
      setError("Error de comunicación de red al crear el cliente.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrar clientes
  const filteredClientes = clientes.filter(c => 
    c.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.telefono.includes(searchQuery)
  );

  // Limpiar el teléfono formateado eliminando comilla simple si existe
  const displayPhone = (phoneNum: string) => {
    if (!phoneNum) return "Sin teléfono registrado";
    return phoneNum.startsWith("'") ? phoneNum.substring(1) : phoneNum;
  };

  return (
    <div id="clientes-view" className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
      
      {/* Columna Izquierda: Formulario de Registro - Bento Box */}
      <div id="new-client-card" className="bento-card p-6 rounded-3xl h-fit space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
          <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
            <UserPlus size={16} />
          </div>
          <h2 className="font-extrabold text-white text-base tracking-tight">Registrar Cliente</h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Agrega nuevos prospectos o clientes de forma directa y sincronizada con la base de datos de Supabase.
        </p>

        <form onSubmit={handleCreateCliente} className="space-y-4">
          <AnimatePresence>
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                id="form-success-alert" 
                className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs flex items-center gap-2 font-bold"
              >
                <Check size={14} className="text-emerald-400" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                id="form-error-alert" 
                className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs flex items-center gap-2 font-semibold"
              >
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase block pl-1">Nombre Completo *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Juan Pérez Quispe"
              className="w-full glass-input rounded-2xl p-3 text-xs sm:text-sm font-semibold"
              required
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase block pl-1">Número de WhatsApp / Teléfono</label>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="Ej. 51987654321"
              className="w-full glass-input rounded-2xl p-3 text-xs sm:text-sm font-semibold font-mono"
              autoComplete="off"
            />
            <span className="text-[9px] text-slate-500 block pl-1">
              * Escribe el número corrido (Ej: 51987654321). Evita el signo "+" y espacios para que funcione en WhatsApp.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase block pl-1">Dirección / Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Agrega la ocupación, ingresos estimados o notas del cliente..."
              rows={3}
              className="w-full glass-input rounded-2xl p-3 text-xs sm:text-sm font-medium resize-none leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full glow-btn text-white font-bold py-3 rounded-2xl text-xs sm:text-sm transition cursor-pointer flex justify-center items-center gap-2 min-h-[48px]"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Registrando...</span>
              </>
            ) : (
              <span>Registrar Cliente</span>
            )}
          </button>
        </form>
      </div>

      {/* Columna Derecha: Listado de Clientes - Bento Grid */}
      <div id="clients-list-card" className="bento-card p-6 rounded-3xl lg:col-span-2 flex flex-col min-h-[450px]">
        <div id="clients-list-header" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/5">
          <div>
            <h2 className="font-extrabold text-white text-base tracking-tight">Directorio de Clientes</h2>
            <p className="text-[10px] text-indigo-400 font-black mt-1 uppercase tracking-wider">Total Registrados: {clientes.length}</p>
          </div>
          
          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-450 select-none">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Buscar por nombre o celular..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 glass-input rounded-2xl text-xs font-semibold"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <Loader2 className="animate-spin text-indigo-500 mb-3" size={32} />
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Obteniendo directorio...</p>
          </div>
        ) : filteredClientes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16 space-y-2">
            <Search className="text-slate-600" size={40} />
            <p className="text-sm font-extrabold text-slate-350">No se encontraron clientes</p>
            <p className="text-xs text-slate-500 max-w-xs text-center leading-relaxed">
              Prueba modificando el término de búsqueda o añade un nuevo cliente desde el formulario lateral.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[550px] custom-scrollbar">
            {filteredClientes.map(cliente => (
              <div
                key={cliente.id}
                className="p-4 rounded-2xl border border-white/5 bg-slate-950/20 hover:border-indigo-500/30 hover:bg-slate-950/40 transition duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm group"
              >
                <div className="space-y-1.5 flex-1 pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-6.5 h-6.5 bg-slate-900 border border-white/5 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-colors">
                      <User size={13} />
                    </div>
                    <span className="font-extrabold text-white text-sm leading-tight group-hover:text-indigo-300 transition-colors">
                      {cliente.nombre_completo}
                    </span>
                    {cliente.prestamos_activos !== undefined && (
                      cliente.prestamos_activos > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-rose-500/10 border border-rose-500/20 text-rose-400 uppercase tracking-wider animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          Deuda Activa ({cliente.prestamos_activos})
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Sin Deudas
                        </span>
                      )
                    )}
                  </div>
                  {cliente.observaciones && (
                    <p className="text-xs text-slate-400 leading-relaxed pl-8">
                      {cliente.observaciones}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 pt-1.5 text-[10px] pl-8 text-slate-500 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Phone size={13} className="text-slate-600" />
                      <span className="font-mono text-slate-400">{displayPhone(cliente.telefono)}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-600" />
                      <span className="text-slate-400">{cliente.fecha_registro}</span>
                    </span>
                  </div>
                </div>
                
                <div className="bg-slate-950/70 group-hover:bg-slate-950 border border-white/5 p-2 px-3 rounded-xl text-[9px] font-mono text-indigo-400 font-bold text-center select-all shrink-0 w-fit self-start sm:self-center">
                  REF: {cliente.id.substring(0, 8).toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
