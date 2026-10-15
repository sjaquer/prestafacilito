import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { Archive, ArrowRight, Plus, RefreshCw, Search, Share2, Wallet } from "lucide-react";
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
import { ReporteCobrosModal } from "../components/inicio/ReporteCobrosModal";
import { CuentasDesglose } from "../components/cuentas/CuentasDesglose";
import { ItemCobro, ItemCobroApi, ordenarPorUrgencia, prepararItems } from "../components/inicio/tipos";

type Filtro = GrupoCobro | "todos";

const fechaLarga = () => {
  const s = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const Kpi: React.FC<{ label: string; valor: string; detalle?: string; tono?: string; onClick?: () => void }> = ({
  label,
  valor,
  detalle,
  tono = "text-slate-900",
  onClick,
}) => {
  const contenido = (
    <>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-lg sm:text-xl font-black font-mono leading-tight ${tono}`}>{valor}</p>
      {detalle && <p className="text-[11px] text-slate-500 font-semibold truncate">{detalle}</p>}
    </>
  );
  const cls = "bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:border-slate-300 transition`}>
      {contenido}
    </button>
  ) : (
    <div className={cls}>{contenido}</div>
  );
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
    for (const it of items) {
      c[it.grupo].n++;
      c[it.grupo].monto += it.montoACobrar;
    }
    return c;
  }, [items]);

  // Por defecto se abre el grupo más urgente que tenga algo
  const filtroActivo: Filtro =
    filtro ?? (conteo.atrasado.n ? "atrasado" : conteo.hoy.n ? "hoy" : conteo.manana.n ? "manana" : conteo.semana.n ? "semana" : "todos");

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter((it) => {
      // Los estancados tienen su propia sección; solo aparecen en la lista al buscar
      if (!q) return it.grupo !== "estancado" && (filtroActivo === "todos" || it.grupo === filtroActivo);
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
        <button
          type="button"
          onClick={recargarTodo}
          disabled={loading}
          className="h-10 w-10 shrink-0 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center"
          aria-label="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
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
          detalle={`${conteo.hoy.n} cliente${conteo.hoy.n === 1 ? "" : "s"}`}
          tono={conteo.hoy.n ? "text-amber-600" : "text-slate-900"}
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
          <div className="sticky top-14 sm:top-[6.5rem] lg:top-16 z-20 -mx-4 px-4 py-2 bg-slate-50/95 backdrop-blur space-y-2 sm:mx-0 sm:px-0">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Filtrar cobros">
              {[...GRUPOS_COBRO.map((g) => ({ id: g.id as Filtro, label: g.label, n: conteo[g.id].n })), { id: "todos" as Filtro, label: "Todos", n: items.length - conteo.estancado.n }].map(
                (t) => {
                  const activo = filtroActivo === t.id && !busqueda;
                  const dot = t.id !== "todos" ? ESTILO_GRUPO[t.id as GrupoCobro].dot : "bg-slate-400";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={activo}
                      onClick={() => setFiltro(t.id)}
                      className={`h-9 px-3 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 border transition ${
                        activo ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${dot}`} />
                      {t.label}
                      <span className={activo ? "text-white/70" : "text-slate-400"}>{t.n}</span>
                    </button>
                  );
                }
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar cliente, apodo o inmueble..."
                className="w-full h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {loading && items.length === 0 ? (
            <ul className="space-y-2" aria-busy>
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
              ))}
            </ul>
          ) : visibles.length === 0 ? (
            <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-2xl">
              <p className="text-sm font-bold text-slate-700">{busqueda ? "Sin resultados" : "Nada pendiente aquí"}</p>
              <p className="text-xs text-slate-500 mt-1">
                {busqueda ? "Prueba con otro nombre." : "Revisa otra pestaña o actualiza."}
              </p>
            </div>
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
