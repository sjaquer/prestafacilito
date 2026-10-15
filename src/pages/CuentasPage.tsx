import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileText, Home as HomeIcon, Landmark, RefreshCw, Search } from "lucide-react";
import { hoyISO } from "../lib/fechas";
import { ResumenMensualTitulares } from "../components/cuentas/ResumenMensualTitulares";
import { formatCurrency, formatDate, parseVoucherUrls, resolveVoucherUrl } from "../lib/formatters";
import { agruparPorCuenta, agruparPorTitular, esMetodoAntiguo, resolverCuenta, SIN_IDENTIFICAR_ID } from "../lib/cuentas";
import { filtrarPorPeriodo, Periodo, PERIODOS, useMovimientosCuentas } from "../hooks/useMovimientosCuentas";
import { CuentasDesglose } from "../components/cuentas/CuentasDesglose";
import { VoucherLightbox } from "../components/common/VoucherLightbox";

const TITULARES = ["Sebastián", "Roberto", "Efectivo", "Sin identificar"] as const;

/** Dinero recibido por cuenta y titular, con el detalle de cada movimiento. */
export const CuentasPage: React.FC = () => {
  const { movimientos, loading, recargar } = useMovimientosCuentas();
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [cuenta, setCuenta] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const delPeriodo = useMemo(() => filtrarPorPeriodo(movimientos, periodo), [movimientos, periodo]);
  const total = useMemo(() => delPeriodo.reduce((s, m) => s + m.monto, 0), [delPeriodo]);
  const grupos = useMemo(() => agruparPorCuenta(delPeriodo), [delPeriodo]);
  const porTitular = useMemo(() => agruparPorTitular(delPeriodo), [delPeriodo]);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return delPeriodo.filter((m) => {
      if (cuenta !== "todas") {
        const id = resolverCuenta(m.metodo_pago)?.id ?? SIN_IDENTIFICAR_ID;
        if (id !== cuenta) return false;
      }
      if (!q) return true;
      return (
        m.cliente_nombre.toLowerCase().includes(q) ||
        (m.cliente_apodo || "").toLowerCase().includes(q) ||
        m.detalle.toLowerCase().includes(q)
      );
    });
  }, [delPeriodo, cuenta, busqueda]);

  const totalLista = lista.reduce((s, m) => s + m.monto, 0);

  /** CSV de los movimientos visibles, para cuadrar con el estado de cuenta del banco. */
  const exportarCsv = () => {
    const celda = (v: unknown) => {
      const t = String(v ?? "");
      return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const filas = [
      ["Fecha", "Cliente", "Detalle", "Cuenta", "Titular", "Monto", "Método registrado"],
      ...lista.map((m) => {
        const c = resolverCuenta(m.metodo_pago);
        return [String(m.fecha_pago).slice(0, 10), m.cliente_nombre, m.detalle, c?.nombre || "Sin identificar", c?.titular || "", m.monto.toFixed(2), m.metodo_pago];
      }),
    ];
    const blob = new Blob(["\uFEFF" + filas.map((f) => f.map(celda).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos_${periodo}_${cuenta}_${hoyISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-12 max-w-5xl mx-auto">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Landmark className="w-6 h-6 text-indigo-600" /> Cuentas
          </h1>
          <p className="text-xs text-slate-500 font-semibold">Dinero recibido por cuenta y titular</p>
        </div>
        <button
          type="button"
          onClick={recargar}
          disabled={loading}
          className="h-10 w-10 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center"
          aria-label="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Período */}
      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 sm:mx-0 sm:px-0">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            className={`h-9 px-3.5 rounded-full text-xs font-bold whitespace-nowrap transition border ${
              periodo === p.id ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Total y titulares */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm p-5 space-y-4">
        <div>
          <p className="text-[11px] font-bold text-slate-500">Recibido en el período</p>
          <p className="text-3xl font-black font-mono text-slate-900">{formatCurrency(total)}</p>
          <p className="text-[11px] text-slate-500 font-semibold">{delPeriodo.length} pagos</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TITULARES.filter((t) => t !== "Sin identificar" || porTitular[t]).map((t) => (
            <div key={t} className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t}</p>
              <p className="text-base font-black font-mono text-slate-900">{formatCurrency(porTitular[t]?.total || 0)}</p>
              <p className="text-[10px] text-slate-500 font-semibold">{porTitular[t]?.cantidad || 0} pagos</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* Desglose por cuenta (toca una para filtrar) */}
        <section className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3">
          <h2 className="px-2 pt-1 pb-2 text-sm font-extrabold text-slate-800">Por cuenta</h2>
          <CuentasDesglose grupos={grupos} total={total} seleccionada={cuenta} onSeleccionar={setCuenta} />
        </section>

        {/* Movimientos */}
        <section className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-slate-800">
              Movimientos{" "}
              {cuenta !== "todas" && (
                <button type="button" onClick={() => setCuenta("todas")} className="ml-1 text-[11px] font-bold text-indigo-600">
                  (quitar filtro)
                </button>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black font-mono text-slate-700">{formatCurrency(totalLista)}</span>
              <button
                type="button"
                onClick={exportarCsv}
                disabled={lista.length === 0}
                className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold inline-flex items-center gap-1 disabled:opacity-50"
                aria-label="Exportar movimientos a CSV"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente o detalle..."
              className="w-full h-11 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {loading && movimientos.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Cargando movimientos...</p>
          ) : lista.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No hay movimientos con estos filtros.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lista.map((m) => {
                const c = resolverCuenta(m.metodo_pago);
                const voucher = parseVoucherUrls(m.comprobante_url)[0];
                const destino = m.ref_id ? (m.tipo_operacion === "alquiler" ? `/alquileres/${m.ref_id}` : `/prestamos/${m.ref_id}`) : null;
                return (
                  <li key={`${m.tipo_operacion}-${m.id}`} className="py-2.5 flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${c ? c.color.dot : "bg-slate-400"}`} />
                    <div className="flex-1 min-w-0">
                      {destino ? (
                        <Link to={destino} className="block text-sm font-bold text-slate-900 truncate hover:text-indigo-600 decoration-none">
                          {m.cliente_nombre}
                        </Link>
                      ) : (
                        <p className="text-sm font-bold text-slate-900 truncate">{m.cliente_nombre}</p>
                      )}
                      <p className="text-[11px] text-slate-500 font-semibold truncate flex items-center gap-1">
                        {m.tipo_operacion === "alquiler" && <HomeIcon className="w-3 h-3 shrink-0" />}
                        {formatDate(m.fecha_pago)} · {c ? c.nombre : m.metodo_pago || "Sin método"}
                        {c && esMetodoAntiguo(m.metodo_pago) && <span className="text-slate-400"> (antes: {m.metodo_pago})</span>}
                      </p>
                    </div>
                    {voucher && (
                      <button
                        type="button"
                        onClick={() => setLightbox(resolveVoucherUrl(voucher))}
                        className="p-2 rounded-xl text-indigo-600 hover:bg-indigo-50"
                        aria-label="Ver comprobante"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                    <span className="text-sm font-black font-mono text-emerald-700 shrink-0">{formatCurrency(m.monto)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
        <h2 className="text-sm font-extrabold text-slate-800">Resumen mensual por titular</h2>
        <p className="text-[11px] text-slate-500 mb-2">Para cuadrar con los estados de cuenta de cada banco</p>
        <ResumenMensualTitulares movimientos={movimientos} />
      </section>

      <VoucherLightbox url={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
};

export default CuentasPage;
