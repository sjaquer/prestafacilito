import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Landmark,
  Wallet,
  Calendar,
  Filter,
  ArrowDownLeft,
  User,
  CheckCircle2,
  FileText,
  Search,
  Building2,
  TrendingUp,
  RefreshCw,
  Eye
} from "lucide-react";
import { BANCO_GRUPOS, getBancoForMetodo } from "../../lib/constants";
import { formatCurrency, formatDateShort } from "../../lib/formatters";

interface PagoMovimiento {
  id: string;
  fecha_pago: string;
  monto: number;
  metodo_pago: string;
  cliente_nombre: string;
  cliente_apodo?: string;
  tipo_operacion: "prestamo" | "alquiler";
  detalle: string;
  comprobante_url?: string;
}

type PeriodoFiltro = "hoy" | "semana" | "mes" | "todo";

export const LlegadaDineroCuentas: React.FC = () => {
  const [pagos, setPagos] = useState<PagoMovimiento[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("mes");
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>("todas");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/dashboard/llegada-cuentas");
      if (res.ok) {
        const data = await res.json();
        setPagos(data.allPayments || []);
      }
    } catch (err) {
      console.error("Error al cargar movimientos de cuentas:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrado por Período de Tiempo
  const pagosFiltradosPorTiempo = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    
    // Inicio de semana (lunes)
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return pagos.filter((pago) => {
      const pDate = new Date(`${pago.fecha_pago}T00:00:00`);
      const pDateStr = pago.fecha_pago.split("T")[0];

      if (periodo === "hoy") {
        return pDateStr === todayStr;
      }
      if (periodo === "semana") {
        return pDate >= monday;
      }
      if (periodo === "mes") {
        return pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth;
      }
      return true; // "todo"
    });
  }, [pagos, periodo]);

  // Filtrado por Cuenta Específica y Búsqueda por Cliente
  const pagosFinales = useMemo(() => {
    return pagosFiltradosPorTiempo.filter((pago) => {
      const matchCuenta =
        cuentaSeleccionada === "todas" || pago.metodo_pago === cuentaSeleccionada;
      
      const matchSearch =
        !searchQuery ||
        pago.cliente_nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pago.cliente_apodo && pago.cliente_apodo.toLowerCase().includes(searchQuery.toLowerCase())) ||
        pago.detalle.toLowerCase().includes(searchQuery.toLowerCase());

      return matchCuenta && matchSearch;
    });
  }, [pagosFiltradosPorTiempo, cuentaSeleccionada, searchQuery]);

  // Totales acumulados en el período
  const totalIngresosPeriodo = useMemo(() => {
    return pagosFiltradosPorTiempo.reduce((sum, p) => sum + p.monto, 0);
  }, [pagosFiltradosPorTiempo]);

  // Desglose por Titular
  const resumenTitulares = useMemo(() => {
    let sebastianTotal = 0;
    let sebastianCount = 0;
    let robertoTotal = 0;
    let robertoCount = 0;
    let efectivoTotal = 0;
    let efectivoCount = 0;

    pagosFiltradosPorTiempo.forEach((pago) => {
      const m = pago.metodo_pago.toLowerCase();
      if (m.includes("sebastián") || m.includes("sebastian")) {
        sebastianTotal += pago.monto;
        sebastianCount++;
      } else if (m.includes("roberto")) {
        robertoTotal += pago.monto;
        robertoCount++;
      } else if (m.includes("efectivo")) {
        efectivoTotal += pago.monto;
        efectivoCount++;
      } else {
        // Fallback por defecto si no especifica titular
        robertoTotal += pago.monto;
        robertoCount++;
      }
    });

    return {
      sebastian: { total: sebastianTotal, count: sebastianCount },
      roberto: { total: robertoTotal, count: robertoCount },
      efectivo: { total: efectivoTotal, count: efectivoCount }
    };
  }, [pagosFiltradosPorTiempo]);

  // Desglose por Cuentas Individuales
  const desgloseCuentas = useMemo(() => {
    return BANCO_GRUPOS.map((banco) => {
      const pagosBanco = pagosFiltradosPorTiempo.filter((p) =>
        banco.metodos.includes(p.metodo_pago)
      );
      const total = pagosBanco.reduce((sum, p) => sum + p.monto, 0);
      const pct = totalIngresosPeriodo > 0 ? (total / totalIngresosPeriodo) * 100 : 0;
      const ultimo = pagosBanco[0] ? pagosBanco[0].fecha_pago : null;

      return {
        ...banco,
        total,
        count: pagosBanco.length,
        pct,
        ultimo
      };
    });
  }, [pagosFiltradosPorTiempo, totalIngresosPeriodo]);

  return (
    <div className="space-y-6 select-none">
      {/* Header de Llegada de Dinero */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-md text-white shrink-0">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Llegada de Dinero a Cuentas
              </h2>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Seguimiento de ingresos en tiempo real por cada cuenta y titular
              </p>
            </div>
          </div>

          {/* Filtros de Rango de Tiempo */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/70 self-start md:self-auto">
            {(
              [
                { id: "hoy", label: "Hoy" },
                { id: "semana", label: "Esta Semana" },
                { id: "mes", label: "Este Mes" },
                { id: "todo", label: "Todo" }
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                onClick={() => setPeriodo(item.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer ${
                  periodo === item.id
                    ? "bg-white text-emerald-700 shadow-xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={loadData}
              disabled={isLoading}
              title="Actualizar flujo"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl ml-1 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* 1. Tarjetas de Resumen por Titular (Sebastián vs Roberto vs Efectivo) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card Sebastián */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-200/80 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <User size={13} className="text-emerald-600" /> Cuentas de Sebastián
              </span>
              <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                {resumenTitulares.sebastian.count} abonos
              </span>
            </div>
            <p className="text-2xl font-black text-emerald-950 font-mono">
              {formatCurrency(resumenTitulares.sebastian.total)}
            </p>
            <p className="text-[9.5px] font-bold text-emerald-700/80 mt-1">
              BCP / Yape + Interbank / Plin
            </p>
          </div>

          {/* Card Roberto */}
          <div className="bg-gradient-to-br from-indigo-50 to-sky-50/40 border border-indigo-200/80 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                <User size={13} className="text-indigo-600" /> Cuentas de Roberto
              </span>
              <span className="text-[9px] font-extrabold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                {resumenTitulares.roberto.count} abonos
              </span>
            </div>
            <p className="text-2xl font-black text-indigo-950 font-mono">
              {formatCurrency(resumenTitulares.roberto.total)}
            </p>
            <p className="text-[9.5px] font-bold text-indigo-700/80 mt-1">
              BCP + Interbank + BBVA + Scotiabank
            </p>
          </div>

          {/* Card Efectivo */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200/80 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <Wallet size={13} className="text-amber-600" /> Caja / Efectivo
              </span>
              <span className="text-[9px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                {resumenTitulares.efectivo.count} abonos
              </span>
            </div>
            <p className="text-2xl font-black text-amber-950 font-mono">
              {formatCurrency(resumenTitulares.efectivo.total)}
            </p>
            <p className="text-[9.5px] font-bold text-amber-700/80 mt-1">
              Entregas directas en efectivo
            </p>
          </div>
        </div>

        {/* 2. Selector de Cuentas Individuales (Badges Fijos) */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Building2 size={13} /> Filtrar por Cuenta Específica:
            </span>
            <span className="text-[10px] font-black text-slate-700 font-mono">
              Total Período: {formatCurrency(totalIngresosPeriodo)}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCuentaSeleccionada("todas")}
              className={`px-3 py-1 rounded-xl text-[10.5px] font-extrabold transition-all border cursor-pointer ${
                cuentaSeleccionada === "todas"
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Todas las Cuentas
            </button>

            {desgloseCuentas.map((banco) => {
              const isSelected = cuentaSeleccionada === banco.nombre;
              return (
                <button
                  key={banco.nombre}
                  onClick={() =>
                    setCuentaSeleccionada(isSelected ? "todas" : banco.nombre)
                  }
                  className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? `${banco.colorClass} text-white border-transparent shadow-xs`
                      : `${banco.badgeClass} hover:opacity-90`
                  }`}
                >
                  <span>{banco.nombre}</span>
                  <span className="font-mono text-[9.5px] font-black opacity-90">
                    S/ {banco.total.toFixed(0)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Buscador y Tabla de Registro de Dinero Entrante */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600" />
              Historial de Abonos Recibidos
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Mostrando {pagosFinales.length} movimiento{pagosFinales.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por cliente o detalle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Tabla de Movimientos */}
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400 font-medium">
            Cargando flujo de ingresos a las cuentas...
          </div>
        ) : pagosFinales.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 font-medium">
            No hay registros de llegada de dinero para el filtro seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Monto Recibido</th>
                  <th className="px-4 py-3">Cuenta Destino</th>
                  <th className="px-4 py-3">Detalle</th>
                  <th className="px-4 py-3 text-center">Voucher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {pagosFinales.map((pago) => {
                  const bancoInfo = getBancoForMetodo(pago.metodo_pago);
                  return (
                    <tr
                      key={pago.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-500 font-mono font-bold whitespace-nowrap text-[11px]">
                        {formatDateShort(pago.fecha_pago)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-extrabold text-slate-900 text-xs">
                          {pago.cliente_nombre}
                        </div>
                        {pago.cliente_apodo && (
                          <span className="text-[10px] font-bold text-slate-400 block">
                            "{pago.cliente_apodo}"
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-black text-emerald-700 text-sm whitespace-nowrap">
                        {formatCurrency(pago.monto)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-xl border ${
                            bancoInfo ? bancoInfo.badgeClass : "bg-slate-100 text-slate-800 border-slate-200"
                          }`}
                        >
                          <Landmark size={12} />
                          {pago.metodo_pago}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-[11px] font-medium">
                        <span
                          className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                            pago.tipo_operacion === "prestamo"
                              ? "bg-emerald-500"
                              : "bg-indigo-500"
                          }`}
                        />
                        {pago.detalle}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {pago.comprobante_url ? (
                          <a
                            href={pago.comprobante_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg border border-indigo-200 transition"
                          >
                            <Eye size={11} /> Ver Voucher
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">
                            Sin comprobante
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
