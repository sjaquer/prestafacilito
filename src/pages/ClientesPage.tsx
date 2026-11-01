import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Search, UserPlus, Users } from "lucide-react";
import { useClientes } from "../hooks/useClientes";
import { Cliente, TipoDocumento } from "../types";
import { ClientSlideOverForm } from "../components/cliente/ClientSlideOverForm";
import { ClienteFila } from "../components/cliente/ClienteFila";
import { useFeedback } from "../components/ui/Feedback";
import { subirDocumentosCliente } from "../components/cliente/documentos";

type Filtro = "con_deuda" | "sin_deuda" | "todos";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "con_deuda", label: "Con deuda vigente" },
  { id: "sin_deuda", label: "Sin deuda" },
  { id: "todos", label: "Todos" },
];

const tieneDeuda = (c: Cliente) => (c.prestamos_activos || 0) + (c.alquileres_activos || 0) > 0;

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Directorio de clientes: buscar rápido, ver qué tiene cada uno y contactarlo. */
export const ClientesPage: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const { clientes, loading, createCliente, uploadClienteDocument, refetch } = useClientes();
  const [formAbierto, setFormAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("con_deuda");

  const conteo = useMemo(
    () => ({ con_deuda: clientes.filter(tieneDeuda).length, sin_deuda: clientes.filter((c) => !tieneDeuda(c)).length, todos: clientes.length }),
    [clientes]
  );

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return clientes
      .filter((c) => {
        // Al buscar se busca en todos, sin importar el filtro
        if (q) {
          return [c.nombre_completo, c.apodo || "", c.telefono || ""].some((v) => normalizar(v).includes(q));
        }
        if (filtro === "con_deuda") return tieneDeuda(c);
        if (filtro === "sin_deuda") return !tieneDeuda(c);
        return true;
      })
      .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, "es"));
  }, [clientes, busqueda, filtro]);

  const handleCrear = async (data: Partial<Cliente>, files: { tipo: TipoDocumento; file: File }[] = []) => {
    const res = await createCliente(data as any);
    if (!res.success) {
      notify(res.error || "No se pudo crear el cliente.");
      return false;
    }
    await subirDocumentosCliente(res.cliente?.id, files, uploadClienteDocument);
    notify("Cliente registrado", "success");
    refetch();
    if (res.cliente?.id) navigate(`/clientes/${res.cliente.id}`);
    return true;
  };

  return (
    <div className="space-y-4 pb-12 max-w-3xl mx-auto">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" /> Clientes
          </h1>
          <p className="text-xs text-slate-500 font-semibold">
            {conteo.todos} registrados · {conteo.con_deuda} con deuda vigente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refetch}
            disabled={loading}
            className="h-11 w-11 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center"
            aria-label="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setFormAbierto(true)}
            className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm"
          >
            <UserPlus className="w-4 h-4" /> Nuevo
          </button>
        </div>
      </div>

      <div className="sticky top-14 sm:top-[6.5rem] lg:top-16 z-20 -mx-4 px-4 py-2 bg-slate-50/95 backdrop-blur space-y-2 sm:mx-0 sm:px-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, apodo o teléfono..."
            className="w-full h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
          />
        </div>
        {!busqueda && (
          <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Filtrar clientes">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={`h-9 px-3 rounded-full text-xs font-bold whitespace-nowrap border transition ${
                  filtro === f.id ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {f.label} <span className={filtro === f.id ? "text-white/70" : "text-slate-400"}>{conteo[f.id]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && clientes.length === 0 ? (
        <ul className="space-y-2" aria-busy>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </ul>
      ) : visibles.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-2xl space-y-3">
          <p className="text-sm font-bold text-slate-700">{busqueda ? `Nadie coincide con "${busqueda}"` : "No hay clientes en este filtro"}</p>
          <button
            type="button"
            onClick={() => setFormAbierto(true)}
            className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" /> Registrar cliente
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {visibles.map((c) => (
            <ClienteFila key={c.id} cliente={c} />
          ))}
        </ul>
      )}

      <ClientSlideOverForm isOpen={formAbierto} onClose={() => setFormAbierto(false)} onSubmit={handleCrear} clienteToEdit={null} />
    </div>
  );
};

export default ClientesPage;
