import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { Archive, ArrowRight, LayoutList, Plus, Share2, Table2, Wallet } from "lucide-react";
import { Cliente, Prestamo } from "../types";
import { formatCurrency, getSaludoPorHora } from "../lib/formatters";
import { GRUPOS_COBRO, GrupoCobro, ESTILO_GRUPO, CUOTAS_ESTANCADO } from "../lib/cobranza";
import { CollapsibleSection } from "../components/ui/CollapsibleSection";
import { agruparPorCuenta } from "../lib/cuentas";
import { filtrarPorPeriodo, useMovimientosCuentas } from "../hooks/useMovimientosCuentas";
import { useClientes } from "../hooks/useClientes";
import { Modal } from "../components/ui/Modal";
import { useFeedback } from "../components/ui/Feedback";
import { CrearPrestamoForm } from "../components/dashboard/CrearPrestamoForm";
import { RegistrarPagoForm } from "../components/dashboard/RegistrarPagoForm";
import { CobroCard } from "../components/inicio/CobroCard";
import { TablaCobros } from "../components/inicio/TablaCobros";
import { ReporteCobrosModal } from "../components/inicio/ReporteCobrosModal";
import { CuentasDesglose } from "../components/cuentas/CuentasDesglose";
import { ItemCobro, ItemCobroApi, ordenarPorUrgencia, prepararItems } from "../components/inicio/tipos";
import { Chips, EmptyState, Kpi, ListSkeleton, RefreshButton, SearchInput, StickyBar } from "../components/ui/Page";
import { useAccionUrl } from "../hooks/useAccionUrl";

type Filtro = GrupoCobro | "todos";

const fechaLarga = () => {
  const s = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Pantalla de trabajo diario: qué cobrar hoy, qué está vencido y cuánto entró a cada cuenta. */
export const InicioPage: React.FC = () => {
  const { user } = useOutletContext<{ user: string | null }>() || { user: null };
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const { clientes, refetch: refetchClientes } = useClientes();
  const { movimientos, recargar: recargarMovimientos } = useMovimientosCuentas();

  const [items, setItems] = useState<ItemCobro[]>([]);
  const [resumen, setResumen] = useState({ totalCobradoEsteMes: 0, totalCobradoHoy: 0 });
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const [busqueda, setBusqueda] = useState("");
  // Tarjetas o tabla; se recuerda en este equipo
  const [vista, setVista] = useState<"tarjetas" | "tabla">(() => {
    try {
      return localStorage.getItem("inicio_vista") === "tabla" ? "tabla" : "tarjetas";
    } catch {
      return "tarjetas";
    }
  });
  const cambiarVista = (v: "tarjetas" | "tabla") => {
    setVista(v);
    try {
      localStorage.setItem("inicio_vista", v);
    } catch {
      /* sin almacenamiento: solo dura esta sesión */
    }
  };

  const [prestamos, setPrestamos] = useState<Prestamo[]>([]);
  const [modal, setModal] = useState<null | "prestamo" | "pago" | "reporte">(null);
  const [prestamoParaPago, setPrestamoParaPago] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/home");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(prepararItems((data.items || []) as ItemCobroApi[]).sort(ordenarPorUrgencia));
      if (data.resumen) setResumen(data.resumen);
    } catch {
      notify("No se pudieron cargar los cobros.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cargarPrestamos = useCallback(async () => {
    const res = await fetch("/api/prestamos");
    if (res.ok) setPrestamos(await res.json());
  }, []);

  const recargarTodo = () => {
    cargar();
    recargarMovimientos();
  };

  const conteo = useMemo(() => {
    const c: Record<GrupoCobro, { n: number; monto: number }> = {
      atrasado: { n: 0, monto: 0 },
      hoy: { n: 0, monto: 0 },
      manana: { n: 0, monto: 0 },
      semana: { n: 0, monto: 0 },
      despues: { n: 0, monto: 0 },
      estancado: { n: 0, monto: 0 },
    };
    let hoyExtra = 0;
    for (const it of items) {
      c[it.grupo].n++;
      // Atrasados: solo lo vencido. Si además hoy vence otra cuota, esa parte suma en "Cobrar hoy".
      c[it.grupo].monto += it.venceHoyTambien ? it.atrasado : it.montoACobrar;
      if (it.venceHoyTambien) {
        c.hoy.monto += it.montoACobrar - it.atrasado;
        hoyExtra++;
      }
    }
    return { ...c, hoyExtra };
  }, [items]);

  // Por defecto se abre el grupo más urgente que tenga algo
  const filtroActivo: Filtro =
    filtro ?? (conteo.atrasado.n ? "atrasado" : conteo.hoy.n + conteo.hoyExtra ? "hoy" : conteo.manana.n ? "manana" : conteo.semana.n ? "semana" : "todos");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((it) => {
      // Los estancados tienen su propia sección; solo aparecen en la lista al buscar
      // Lo que vence hoy aparece en "Cobrar hoy" aunque además tenga algo atrasado (sale en ambas pestañas)
      if (!q)
        return (
          it.grupo !== "estancado" &&
          (filtroActivo === "todos" || it.grupo === filtroActivo || (filtroActivo === "hoy" && it.venceHoyTambien))
        );
      return (
        it.cliente_nombre.toLowerCase().includes(q) ||
        (it.cliente_apodo || "").toLowerCase().includes(q) ||
        (it.descripcion_inmueble || "").toLowerCase().includes(q)
      );
    });
  }, [items, filtroActivo, busqueda]);

  const estancados = useMemo(() => items.filter((it) => it.grupo === "estancado"), [items]);

  const movimientosHoy = useMemo(() => filtrarPorPeriodo(movimientos, "hoy"), [movimientos]);
  const gruposHoy = useMemo(() => agruparPorCuenta(movimientosHoy), [movimientosHoy]);

  const abrirPago = async (prestamoId = "") => {
    setPrestamoParaPago(prestamoId);
    setModal("pago");
    if (prestamos.length === 0) await cargarPrestamos();
  };

  const handleCobrar = (item: ItemCobro) => {
    if (item.es_alquiler) navigate(`/alquileres/${item.id}`);
    else abrirPago(item.id);
  };

  // Botón "+" del celular
  useAccionUrl((accion) => {
    if (accion === "pago") abrirPago();
    if (accion === "prestamo") setModal("prestamo");
  });

  const pendientesReporte = items.filter((i) => ["atrasado", "hoy", "manana", "semana"].includes(i.grupo));

  return (
    <div className="space-y-4 pb-12 max-w-6xl mx-auto">
      {/* Saludo */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">{fechaLarga()}</p>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {getSaludoPorHora()}
            {user ? `, ${user}` : ""}
          </h1>
        </div>
        <RefreshButton onClick={recargarTodo} loading={loading} />
      </div>

      {/* Resumen del día */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Kpi
          label="Atrasado"
          valor={formatCurrency(conteo.atrasado.monto)}
          detalle={`${conteo.atrasado.n} cliente${conteo.atrasado.n === 1 ? "" : "s"}`}
          tono={conteo.atrasado.n ? "text-rose-600" : "text-slate-900"}
          onClick={() => setFiltro("atrasado")}
        />
        <Kpi
          label="Cobrar hoy"
          valor={formatCurrency(conteo.hoy.monto)}
          detalle={`${conteo.hoy.n + conteo.hoyExtra} cliente${conteo.hoy.n + conteo.hoyExtra === 1 ? "" : "s"}${conteo.hoyExtra ? ` (${conteo.hoyExtra} también atrasado${conteo.hoyExtra > 1 ? "s" : ""})` : ""}`}
          tono={conteo.hoy.n + conteo.hoyExtra ? "text-amber-600" : "text-slate-900"}
          onClick={() => setFiltro("hoy")}
        />
        <Kpi label="Cobrado hoy" valor={formatCurrency(resumen.totalCobradoHoy)} tono="text-emerald-600" onClick={() => navigate("/cuentas")} />
        <Kpi label="Cobrado este mes" valor={formatCurrency(resumen.totalCobradoEsteMes)} onClick={() => navigate("/cuentas")} />
      </div>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => abrirPago()}
          className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Wallet className="w-4 h-4" /> Registrar pago
        </button>
        <button
          type="button"
          onClick={() => setModal("prestamo")}
          className="h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Préstamo
        </button>
        <button
          type="button"
          onClick={() => setModal("reporte")}
          disabled={pendientesReporte.length === 0}
          className="h-12 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Share2 className="w-4 h-4" /> Reporte
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Lista de cobros */}
        <section className="lg:col-span-8 space-y-3">
          <StickyBar>
            <Chips
              etiqueta="Filtrar cobros"
              valor={busqueda ? null : filtroActivo}
              onChange={(id) => setFiltro(id)}
              opciones={[
                ...GRUPOS_COBRO.map((g) => ({
                  id: g.id as Filtro,
                  label: g.label,
                  n: conteo[g.id].n + (g.id === "hoy" ? conteo.hoyExtra : 0),
                  dot: ESTILO_GRUPO[g.id].dot,
                })),
                { id: "todos" as Filtro, label: "Todos", n: items.length - conteo.estancado.n, dot: "bg-slate-400" },
              ]}
            />
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar cliente, apodo o inmueble..." />
              </div>
              <div className="flex shrink-0 p-1 bg-white border border-slate-200 rounded-xl" role="group" aria-label="Vista">
                {(
                  [
                    ["tarjetas", LayoutList, "Tarjetas"],
                    ["tabla", Table2, "Tabla"],
                  ] as const
                ).map(([v, Icono, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => cambiarVista(v)}
                    aria-pressed={vista === v}
                    aria-label={`Ver como ${label.toLowerCase()}`}
                    title={label}
                    className={`h-10 sm:h-9 w-10 sm:w-auto sm:px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
                      vista === v ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <Icono className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </StickyBar>

          {loading && items.length === 0 ? (
            <ListSkeleton />
          ) : visibles.length === 0 ? (
            <EmptyState
              titulo={busqueda ? "Sin resultados" : "Nada pendiente aquí"}
              detalle={busqueda ? "Prueba con otro nombre." : "Revisa otra pestaña o actualiza."}
            />
          ) : vista === "tabla" ? (
            <TablaCobros items={visibles} />
          ) : (
            <ul className="space-y-2">
              {visibles.map((it) => (
                <CobroCard key={`${it.es_alquiler ? "a" : "p"}-${it.id}`} item={it} onCobrar={handleCobrar} />
              ))}
            </ul>
          )}

          {/* Estancados: aparte y plegados para no estorbar la cobranza diaria */}
          {estancados.length > 0 && !busqueda && (
            <CollapsibleSection
              className="bg-slate-50"
              title={`Estancados (${CUOTAS_ESTANCADO}+ meses sin pagar)`}
              icon={<Archive className="w-4 h-4" />}
              aside={`${estancados.length} · ${formatCurrency(conteo.estancado.monto)}`}
            >
              <p className="text-[11px] text-slate-500 pt-2 pb-3">
                No se incluyen en los totales de atrasados ni en el calendario. Revísalos aparte para negociar o cerrar.
              </p>
              <ul className="space-y-2">
                {estancados.map((it) => (
                  <CobroCard key={`e-${it.es_alquiler ? "a" : "p"}-${it.id}`} item={it} onCobrar={handleCobrar} />
                ))}
              </ul>
            </CollapsibleSection>
          )}
        </section>

        {/* Entradas de hoy por cuenta */}
        <aside className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3 lg:sticky lg:top-20">
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <h2 className="text-sm font-extrabold text-slate-800">Entró hoy por cuenta</h2>
            <Link to="/cuentas" className="text-[11px] font-bold text-indigo-600 inline-flex items-center gap-0.5 decoration-none">
              Ver todo <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <CuentasDesglose
            grupos={gruposHoy}
            total={movimientosHoy.reduce((s, m) => s + m.monto, 0)}
            soloConMovimientos
          />
        </aside>
      </div>

      {/* Modales */}
      <Modal isOpen={modal === "pago"} onClose={() => setModal(null)} title="Registrar pago" size="lg">
        <RegistrarPagoForm
          bare
          clientes={clientes as Cliente[]}
          prestamosActivos={prestamos}
          selectedPrestamoIdFromParent={prestamoParaPago}
          onPagoRegistrado={() => {
            setModal(null);
            notify("Pago registrado", "success");
            recargarTodo();
          }}
        />
      </Modal>

      <Modal isOpen={modal === "prestamo"} onClose={() => setModal(null)} title="Nuevo préstamo" size="lg">
        <CrearPrestamoForm
          bare
          clientes={clientes as Cliente[]}
          onClienteCreado={() => refetchClientes()}
          onPrestamoCreado={(nuevo) => {
            setModal(null);
            notify("Préstamo creado", "success");
            setPrestamos([]);
            cargar();
            if (nuevo?.id) navigate(`/prestamos/${nuevo.id}`);
          }}
        />
      </Modal>

      <ReporteCobrosModal isOpen={modal === "reporte"} onClose={() => setModal(null)} items={pendientesReporte} />
    </div>
  );
};

export default InicioPage;
