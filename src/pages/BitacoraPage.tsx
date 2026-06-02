import React, { useState, useEffect } from "react";
import { 
  Terminal, Search, Download, RefreshCw, User, Filter, 
  ShieldAlert, Clock, ChevronDown, FileDown, Calendar
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { formatRelativeDate, formatDateShort } from "../lib/formatters";
import { useAuth } from "../hooks/useAuth";

interface LogEntry {
  id: string;
  fecha_hora: string;
  usuario: string;
  accion: string;
  detalles: string;
}

export const BitacoraPage: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Filtros
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [searchText, setSearchText] = useState("");
  const [limit, setLimit] = useState(100);

  const fetchLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const queryParams = new URLSearchParams();
      if (filterUser) queryParams.append("usuario", filterUser);
      if (filterAction) queryParams.append("accion", filterAction);
      if (searchText) queryParams.append("search", searchText);
      queryParams.append("limit", limit.toString());

      const res = await fetch(`/api/logs?${queryParams.toString()}`);
      if (!res.ok) throw new Error("No se pudo obtener la bitácora de auditoría.");
      const data = await res.json();
      setLogs(data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al conectar con la bitácora.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterUser, filterAction, limit]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case "INICIAR_SESION":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "CERRAR_SESION":
        return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
      case "CREAR_CLIENTE":
      case "REGISTRAR_PRESTAMO":
        return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      case "EDITAR_CLIENTE":
      case "EDITAR_PRESTAMO":
      case "ACTUALIZAR_VOUCHER":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "REGISTRAR_PAGO":
        return "bg-emerald-450/10 text-emerald-450 border border-emerald-450/20";
      case "CREAR_AJUSTE_PRESTAMO":
      case "ACTIVAR_AJUSTE_PRESTAMO":
      case "DESACTIVAR_AJUSTE_PRESTAMO":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      default:
        return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 select-none">
            <div className="w-1.5 h-5 bg-emerald-500 rounded-full" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Seguridad</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none">
            Bitácora de Auditoría
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Registro detallado de acciones, auditorías y accesos al sistema cerrado.
          </p>
        </div>

        {/* Descargas */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/api/logs/download"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.1] text-xs font-bold text-slate-300 transition-all select-none cursor-pointer decoration-none"
            title="Descargar toda la bitácora en formato CSV para Excel"
          >
            <FileDown size={14} className="text-emerald-400" />
            <span>Descargar CSV</span>
          </a>
          <a
            href="/api/logs/local"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.1] text-xs font-bold text-slate-300 transition-all select-none cursor-pointer decoration-none"
            title="Descargar logs locales persistidos del servidor (.jsonl)"
          >
            <Download size={14} className="text-indigo-400" />
            <span>Descargar JSONL</span>
          </a>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-350 rounded-2xl text-xs font-bold leading-normal">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Contenedor de Filtros */}
      <Card variant="simple" className="p-4 bg-[#0a0d17]/80 backdrop-blur-md">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
          {/* Buscar por texto */}
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Detalle o Descripción
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Ej: Sebastián, DNI, S/. 550, rep..."
                className="glass-input w-full pl-9 pr-4 py-2 text-xs text-[#f8fafc]"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
            </div>
          </div>

          {/* Filtrar por usuario */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Usuario Operador
            </label>
            <div className="relative">
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="glass-input w-full py-2 pl-3 pr-8 text-xs text-[#f8fafc] cursor-pointer appearance-none bg-[#0c101d] border-white/5"
              >
                <option value="">Todos los usuarios</option>
                <option value="sjaquer">Sebastián (sjaquer)</option>
                <option value="rjaque">Roberto (rjaque)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={12} />
            </div>
          </div>

          {/* Filtrar por acción */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Acción
            </label>
            <div className="relative">
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="glass-input w-full py-2 pl-3 pr-8 text-xs text-[#f8fafc] cursor-pointer appearance-none bg-[#0c101d] border-white/5"
              >
                <option value="">Todas las acciones</option>
                <option value="INICIAR_SESION">Iniciar Sesión</option>
                <option value="CERRAR_SESION">Cerrar Sesión</option>
                <option value="CREAR_CLIENTE">Crear Cliente</option>
                <option value="EDITAR_CLIENTE">Editar Cliente</option>
                <option value="REGISTRAR_PRESTAMO">Otorgar Crédito</option>
                <option value="EDITAR_PRESTAMO">Editar Crédito/Alquiler</option>
                <option value="REGISTRAR_PAGO">Registrar Pago</option>
                <option value="CREAR_AJUSTE_PRESTAMO">Crear Ajuste</option>
                <option value="SUBIR_DOCUMENTO_CLIENTE">Subir Documento</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={12} />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="flex-1 font-bold h-9 flex items-center justify-center gap-1.5"
              disabled={loading}
            >
              {loading ? <RefreshCw className="animate-spin" size={12} /> : <Search size={12} />}
              <span>Filtrar</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="p-2 border border-white/[0.04] bg-white/[0.01]"
              onClick={() => {
                setFilterUser("");
                setFilterAction("");
                setSearchText("");
                setLimit(100);
                setTimeout(() => fetchLogs(), 50);
              }}
              title="Limpiar filtros"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </form>
      </Card>

      {/* Consola de Bitácora Estilo Terminal */}
      <Card variant="simple" className="overflow-hidden border border-white/[0.05] p-0 bg-[#060913]/90">
        <div className="bg-slate-950/80 px-4 py-3 border-b border-white/[0.04] flex justify-between items-center select-none">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-emerald-450" />
            <span className="font-mono text-xs font-bold text-slate-400 tracking-wide">
              audit_console_system:~/logs$ cat current.log
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-black text-slate-500">
              MOSTRANDO: {logs.length} FILAS
            </span>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="bg-transparent border-none text-[10px] font-mono font-bold text-slate-400 cursor-pointer outline-none"
            >
              <option value="50" className="bg-[#0c0f1d] text-slate-300">Límite 50</option>
              <option value="100" className="bg-[#0c0f1d] text-slate-300">Límite 100</option>
              <option value="200" className="bg-[#0c0f1d] text-slate-300">Límite 200</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 select-none">
              <RefreshCw className="animate-spin text-emerald-450 mb-3" size={28} />
              <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">
                Consultando registros de auditoría...
              </span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-20 font-mono text-xs text-slate-600">
              No se encontraron coincidencias en la bitácora con los filtros aplicados.
            </div>
          ) : (
            <table className="w-full border-collapse text-left font-sans">
              <thead>
                <tr className="bg-white/[0.015] border-b border-white/[0.04]">
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider w-36">
                    Fecha y Hora
                  </th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider w-24">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider w-48">
                    Acción
                  </th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Detalles Operacionales
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {logs.map((log) => (
                  <tr 
                    key={log.id} 
                    className="hover:bg-white/[0.01] transition-colors border-white/[0.02]"
                  >
                    {/* Fecha */}
                    <td className="px-4 py-2.5 whitespace-nowrap text-[11px] font-mono text-slate-450">
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} className="text-slate-600 shrink-0" />
                        <span title={new Date(log.fecha_hora).toLocaleString("es-PE")}>
                          {formatDateShort(log.fecha_hora)} {new Date(log.fecha_hora).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </td>

                    {/* Usuario */}
                    <td className="px-4 py-2.5 whitespace-nowrap text-[11px] font-bold text-slate-300">
                      <div className="flex items-center gap-1">
                        <User size={11} className="text-slate-500 shrink-0" />
                        <span className="capitalize">{log.usuario}</span>
                      </div>
                    </td>

                    {/* Acción */}
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`text-[8.5px] font-extrabold px-2 py-0.5 rounded-full select-none ${getActionBadgeClass(log.accion)}`}>
                        {log.accion.replace(/_/g, " ")}
                      </span>
                    </td>

                    {/* Detalles */}
                    <td className="px-4 py-2.5 text-xs text-slate-300 font-medium leading-relaxed max-w-lg break-words">
                      {log.detalles}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};
