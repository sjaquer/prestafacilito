import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Users } from "lucide-react";
import { useClientes } from "../hooks/useClientes";
import { Cliente, TipoDocumento } from "../types";
import { ClientSlideOverForm } from "../components/cliente/ClientSlideOverForm";
import { ClienteFila } from "../components/cliente/ClienteFila";
import { useFeedback } from "../components/ui/Feedback";
import { subirDocumentosCliente } from "../components/cliente/documentos";
import { ActionButton, Chips, EmptyState, ListSkeleton, PageHeader, RefreshButton, SearchInput, StickyBar } from "../components/ui/Page";
import { useAccionUrl } from "../hooks/useAccionUrl";

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

  // Botón "+" del celular
  useAccionUrl((accion) => accion === "nuevo" && setFormAbierto(true));

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
      <PageHeader
        title="Clientes"
        icon={<Users className="w-6 h-6" />}
        subtitle={`${conteo.todos} registrados · ${conteo.con_deuda} con deuda vigente`}
        actions={
          <>
            <RefreshButton onClick={refetch} loading={loading} />
            <ActionButton icon={<UserPlus className="w-4 h-4" />} onClick={() => setFormAbierto(true)}>
              Nuevo
            </ActionButton>
          </>
        }
      />

      <StickyBar>
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar por nombre, apodo o teléfono..." />
        {!busqueda && (
          <Chips<Filtro>
            etiqueta="Filtrar clientes"
            valor={filtro}
            onChange={setFiltro}
            opciones={FILTROS.map((f) => ({ ...f, n: conteo[f.id] }))}
          />
        )}
      </StickyBar>

      {loading && clientes.length === 0 ? (
        <ListSkeleton filas={4} />
      ) : visibles.length === 0 ? (
        <EmptyState
          titulo={busqueda ? `Nadie coincide con "${busqueda}"` : "No hay clientes en este filtro"}
          accion={
            <ActionButton icon={<UserPlus className="w-4 h-4" />} onClick={() => setFormAbierto(true)}>
              Registrar cliente
            </ActionButton>
          }
        />
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
