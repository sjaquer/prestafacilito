import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FileDown, Briefcase } from "lucide-react";
import { ActionButton, PageHeader, RefreshButton } from "../components/ui/Page";
import { DataTable } from "../components/ui/DataTable";
import { linkCobroWhatsApp } from "../lib/cobranza";
import { useClientes } from "../hooks/useClientes";
import { usePagos } from "../hooks/usePagos";
import { hoyISO } from "../lib/fechas";
import { resumirPrestamo, ResumenPrestamo, GrupoPrestamo } from "../lib/resumenPrestamo";
import { CarteraKPIs } from "../components/cartera/CarteraKPIs";
import { CarteraFiltros } from "../components/cartera/CarteraFiltros";
import { CarteraLoanCard } from "../components/cartera/CarteraLoanCard";
import { buildCarteraColumns } from "../components/cartera/carteraColumns";
import { CarteraFilters, EMPTY_FILTERS, exportCarteraCsv, filterLoans } from "../components/cartera/carteraUtils";

const PRIORIDAD: Record<GrupoPrestamo, number> = { atrasado: 0, hoy: 1, manana: 2, semana: 3, despues: 4, estancado: 5, liquidado: 6 };

/** Todos los préstamos, ordenados por urgencia de cobro, con filtros y acceso a editar. */
export const CarteraPage: React.FC = () => {
  const navigate = useNavigate();
  const { clientes } = useClientes();
  const { fetchAmortizaciones } = usePagos();

  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [amortizaciones, setAmortizaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CarteraFilters>(EMPTY_FILTERS);

  const fetchLoans = useCallback(async () => {
    try {
      setLoading(true);
      const [res, amortList] = await Promise.all([fetch("/api/prestamos"), fetchAmortizaciones()]);
      if (res.ok) setPrestamos((await res.json()) || []);
      setAmortizaciones(amortList || []);
    } catch (err) {
      console.error("Error al cargar préstamos para la cartera:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchAmortizaciones]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // Misma regla que Inicio, la ficha del cliente y el calendario
  const resumenById = useMemo(() => {
    const hoy = hoyISO();
    const pagosPorPrestamo = new Map<string, any[]>();
    for (const a of amortizaciones) pagosPorPrestamo.set(a.prestamo_id, [...(pagosPorPrestamo.get(a.prestamo_id) || []), a]);
    return new Map<string, ResumenPrestamo>(prestamos.map((p) => [p.id, resumirPrestamo(p, pagosPorPrestamo.get(p.id) || [], hoy)]));
  }, [prestamos, amortizaciones]);

  const resumenDe = useCallback((p: any) => resumenById.get(p.id)!, [resumenById]);
  const grupoDe = useCallback((p: any): GrupoPrestamo => resumenById.get(p.id)?.grupo || "despues", [resumenById]);

  const clientesById = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  const getWhatsAppLink = useCallback(
    (loan: any) => {
      const r = resumenById.get(loan.id);
      if (!r || r.grupo === "liquidado") return null;
      const atrasado = r.grupo === "atrasado" || r.grupo === "estancado";
      return linkCobroWhatsApp(clientesById.get(loan.cliente_id)?.telefono, {
        fechaVencimiento: r.fecha || undefined,
        atrasado,
        monto: r.aCobrar,
      });
    },
    [clientesById, resumenById]
  );

  // Editar = abrir el detalle con el formulario completo desplegado (una sola forma de editar)
  const editar = useCallback((loan: any) => navigate(`/prestamos/${loan.id}?seccion=editar`), [navigate]);

  const loanTypes = useMemo(
    () => Array.from(new Set(prestamos.map((p) => p.tipo_prestamo).filter(Boolean))) as string[],
    [prestamos]
  );

  const kpis = useMemo(() => {
    let capitalPendiente = 0;
    let vencidosCount = 0;
    let montoVencido = 0;
    let hoyCount = 0;
    let activasCount = 0;
    for (const r of resumenById.values()) {
      if (r.grupo === "liquidado") continue;
      activasCount++;
      capitalPendiente += r.capitalRestante;
      if (r.grupo === "atrasado") {
        vencidosCount++;
        montoVencido += r.aCobrar;
      } else if (r.grupo === "hoy") hoyCount++;
    }
    return { capitalPendiente, activasCount, vencidosCount, montoVencido, hoyCount };
  }, [resumenById]);

  const filteredLoans = useMemo(
    () =>
      filterLoans(prestamos, grupoDe, filters).sort(
        (a, b) =>
          PRIORIDAD[grupoDe(a)] - PRIORIDAD[grupoDe(b)] || String(resumenDe(a)?.fecha || "9999").localeCompare(String(resumenDe(b)?.fecha || "9999"))
      ),
    [prestamos, grupoDe, resumenDe, filters]
  );

  const columns = useMemo(() => buildCarteraColumns({ resumenDe, getWhatsAppLink, onEdit: editar }), [resumenDe, getWhatsAppLink, editar]);

  return (
    <div className="space-y-4 pb-12 max-w-6xl mx-auto">
      <PageHeader
        title="Cartera"
        icon={<Briefcase className="w-6 h-6" />}
        subtitle="Todos los préstamos, lo más urgente primero"
        actions={
          <>
            <RefreshButton onClick={fetchLoans} loading={loading} />
            <ActionButton
              tono="claro"
              compactoEnMovil
              icon={<FileDown className="w-4 h-4" />}
              onClick={() => exportCarteraCsv(filteredLoans, resumenDe)}
              disabled={filteredLoans.length === 0}
            >
              Exportar CSV
            </ActionButton>
          </>
        }
      />

      <CarteraKPIs {...kpis} onFiltrar={(estado) => setFilters((f) => ({ ...f, estado }))} />

      <CarteraFiltros
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onClear={() => setFilters(EMPTY_FILTERS)}
        loanTypes={loanTypes}
      />

      {/* Escritorio: tabla */}
      <div className="hidden md:block bg-white border border-slate-200/80 rounded-2xl p-3 shadow-sm">
        <DataTable
          data={filteredLoans}
          columns={columns}
          pageSize={20}
          emptyMessage={loading ? "Cargando..." : "No hay préstamos con estos filtros."}
          showSearch={false}
        />
      </div>

      {/* Celular: tarjetas */}
      <div className="md:hidden">
        {loading && prestamos.length === 0 ? (
          <ul className="space-y-2" aria-busy>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-36 bg-white border border-slate-200 rounded-2xl animate-pulse" />
            ))}
          </ul>
        ) : filteredLoans.length === 0 ? (
          <p className="text-center py-12 text-slate-500 text-sm font-bold bg-white border border-dashed border-slate-200 rounded-2xl">
            No hay préstamos con estos filtros.
          </p>
        ) : (
          <ul className="space-y-2">
            {filteredLoans.map((loan) => (
              <CarteraLoanCard key={loan.id} loan={loan} resumen={resumenDe(loan)} waLink={getWhatsAppLink(loan)} onEdit={editar} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CarteraPage;
