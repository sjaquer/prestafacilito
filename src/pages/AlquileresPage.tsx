import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Home, Plus, Wallet } from "lucide-react";
import { Cliente } from "../types";
import { CrearAlquilerForm } from "../components/alquiler/CrearAlquilerForm";
import { RegistrarPagoAlquilerForm } from "../components/alquiler/RegistrarPagoAlquilerForm";
import {
  AlquilerCard,
  AlquilerItemCalculado,
  ESTILO_ALQUILER,
  EstadoAlquiler,
  estadoDeAlquiler,
} from "../components/alquiler/AlquilerCard";
import { Modal } from "../components/ui/Modal";
import { useFeedback } from "../components/ui/Feedback";
import {
  ActionButton,
  Chips,
  EmptyState,
  ErrorState,
  Kpi,
  ListSkeleton,
  PageHeader,
  RefreshButton,
  SearchInput,
  StickyBar,
} from "../components/ui/Page";
import { formatCurrency } from "../lib/formatters";
import { useAccionUrl } from "../hooks/useAccionUrl";

type Filtro = "por_cobrar" | "pagado" | "finalizado" | "todos";

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Lo más urgente primero: atrasados, luego por cobrar (por días que faltan), luego pagados. */
const ORDEN: Record<EstadoAlquiler, number> = { atrasado: 0, parcial: 1, pendiente: 2, pagado: 3, finalizado: 4 };

/** Contratos de alquiler: qué inmuebles deben este mes y cobrar en un toque. */
export const AlquileresPage: React.FC = () => {
  const { notify } = useFeedback();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [alquileres, setAlquileres] = useState<AlquilerItemCalculado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("por_cobrar");
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<null | "nuevo" | "pago">(null);
  const [alquilerParaPago, setAlquilerParaPago] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cRes, aRes] = await Promise.all([fetch("/api/clientes"), fetch("/api/alquileres")]);
      if (!aRes.ok) throw new Error("No se pudieron cargar los alquileres.");
      setAlquileres((await aRes.json()) || []);
      if (cRes.ok) setClientes((await cRes.json()) || []);
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirPago = (alquilerId = "") => {
    setAlquilerParaPago(alquilerId);
    setModal("pago");
  };

  // Botón "+" del celular
  useAccionUrl((accion) => {
    if (accion === "nuevo") setModal("nuevo");
    if (accion === "pago") abrirPago();
  });

  const conEstado = useMemo(
    () =>
      alquileres
        .map((a) => ({ a, estado: estadoDeAlquiler(a) }))
        .sort((x, y) => ORDEN[x.estado] - ORDEN[y.estado] || (x.a.dias_restantes ?? 99) - (y.a.dias_restantes ?? 99)),
    [alquileres]
  );

  const activos = conEstado.filter((x) => x.estado !== "finalizado");
  const porCobrar = activos.filter((x) => x.estado !== "pagado");
  const atrasados = activos.filter((x) => x.estado === "atrasado");

  const resumen = useMemo(
    () => ({
      rentaMensual: activos.reduce((s, x) => s + (Number(x.a.monto_mensual) || 0), 0),
      porCobrar: porCobrar.reduce(
        (s, x) => s + (x.estado === "atrasado" ? Number(x.a.total_pendiente) || 0 : Number(x.a.mes_actual_pendiente) || 0),
        0
      ),
      atrasado: atrasados.reduce((s, x) => s + (Number(x.a.total_pendiente) || 0), 0),
    }),
    [activos, porCobrar, atrasados]
  );

  const conteo: Record<Filtro, number> = {
    por_cobrar: porCobrar.length,
    pagado: activos.length - porCobrar.length,
    finalizado: conEstado.length - activos.length,
    todos: conEstado.length,
  };

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return conEstado
      .filter(({ a, estado }) => {
        if (q) return [a.descripcion_inmueble || "", a.cliente_nombre || "", a.cliente_apodo || ""].some((v) => normalizar(v).includes(q));
        if (filtro === "por_cobrar") return estado !== "pagado" && estado !== "finalizado";
        if (filtro === "pagado") return estado === "pagado";
        if (filtro === "finalizado") return estado === "finalizado";
        return true;
      })
      .map((x) => x.a);
  }, [conEstado, filtro, busqueda]);

  return (
    <div className="space-y-4 pb-12 max-w-4xl mx-auto">
      <PageHeader
        title="Alquileres"
        icon={<Home className="w-6 h-6" />}
        subtitle={`${activos.length} contrato${activos.length === 1 ? "" : "s"} activo${activos.length === 1 ? "" : "s"} · ${porCobrar.length} por cobrar`}
        actions={
          <>
            <RefreshButton onClick={cargar} loading={loading} />
            <ActionButton tono="claro" compactoEnMovil icon={<Plus className="w-4 h-4" />} onClick={() => setModal("nuevo")}>
              Nuevo contrato
            </ActionButton>
            <span className="hidden sm:flex">
              <ActionButton icon={<Wallet className="w-4 h-4" />} onClick={() => abrirPago()}>
                Registrar pago
              </ActionButton>
            </span>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        <Kpi
          label="Por cobrar"
          valor={formatCurrency(resumen.porCobrar)}
          detalle={`${porCobrar.length} inmueble${porCobrar.length === 1 ? "" : "s"}`}
          tono={porCobrar.length ? "text-amber-600" : "text-slate-900"}
          onClick={() => setFiltro("por_cobrar")}
        />
        <Kpi
          label="Atrasado"
          valor={formatCurrency(resumen.atrasado)}
          detalle={`${atrasados.length} con meses sin pagar`}
          tono={atrasados.length ? "text-rose-600" : "text-slate-900"}
          onClick={() => setFiltro("por_cobrar")}
        />
        <div className="col-span-2 lg:col-span-1">
          <Kpi label="Renta mensual total" valor={formatCurrency(resumen.rentaMensual)} detalle="Suma de contratos activos" tono="text-emerald-700" />
        </div>
      </div>

      {/* En el celular, el cobro va como botón grande (en escritorio está en la cabecera) */}
      <button
        type="button"
        onClick={() => abrirPago()}
        className="sm:hidden w-full h-12 rounded-2xl bg-emerald-600 active:bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm"
      >
        <Wallet className="w-4 h-4" /> Registrar pago de alquiler
      </button>

      <StickyBar>
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar inmueble o inquilino..." />
        {!busqueda && (
          <Chips<Filtro>
            etiqueta="Filtrar alquileres"
            valor={filtro}
            onChange={setFiltro}
            opciones={[
              { id: "por_cobrar", label: "Por cobrar", n: conteo.por_cobrar, dot: ESTILO_ALQUILER.pendiente.dot },
              { id: "pagado", label: "Mes pagado", n: conteo.pagado, dot: ESTILO_ALQUILER.pagado.dot },
              { id: "finalizado", label: "Finalizados", n: conteo.finalizado, dot: ESTILO_ALQUILER.finalizado.dot },
              { id: "todos", label: "Todos", n: conteo.todos },
            ]}
          />
        )}
      </StickyBar>

      {error ? (
        <ErrorState mensaje={error} onReintentar={cargar} />
      ) : loading && alquileres.length === 0 ? (
        <ListSkeleton />
      ) : visibles.length === 0 ? (
        <EmptyState
          titulo={busqueda ? `Nada coincide con "${busqueda}"` : filtro === "por_cobrar" ? "Todos los alquileres están al día" : "No hay contratos aquí"}
          detalle={busqueda ? "Prueba con otro nombre." : undefined}
          accion={
            conEstado.length === 0 ? (
              <ActionButton icon={<Plus className="w-4 h-4" />} onClick={() => setModal("nuevo")}>
                Nuevo contrato
              </ActionButton>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {visibles.map((a) => (
            <AlquilerCard key={a.id} alquiler={a} onCobrar={abrirPago} />
          ))}
        </ul>
      )}

      <Modal isOpen={modal === "pago"} onClose={() => setModal(null)} title="Registrar pago de alquiler" size="lg">
        <RegistrarPagoAlquilerForm
          bare
          clientes={clientes}
          alquileresActivos={activos.map((x) => x.a)}
          selectedAlquilerIdFromParent={alquilerParaPago}
          onPagoRegistrado={() => {
            setModal(null);
            notify("Pago de alquiler registrado", "success");
            cargar();
          }}
        />
      </Modal>

      <Modal isOpen={modal === "nuevo"} onClose={() => setModal(null)} title="Nuevo contrato de alquiler" size="lg">
        <CrearAlquilerForm
          bare
          clientes={clientes}
          onClienteCreado={() => cargar()}
          onAlquilerCreado={() => {
            setModal(null);
            notify("Contrato creado", "success");
            cargar();
          }}
        />
      </Modal>
    </div>
  );
};

export default AlquileresPage;
