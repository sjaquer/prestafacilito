import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, FileDown, Briefcase } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { DataTable } from "../components/ui/DataTable";
import { generarMensajeCobroPredeterminado } from "../lib/formatters";
import { useClientes } from "../hooks/useClientes";
import { usePagos } from "../hooks/usePagos";
import { calcularEstadoMora, EstadoMoraCliente } from "../lib/moraLogic";
import { CarteraKPIs } from "../components/cartera/CarteraKPIs";
import { CarteraFiltros } from "../components/cartera/CarteraFiltros";
import { CarteraLoanCard } from "../components/cartera/CarteraLoanCard";
import { EditarPrestamoModal } from "../components/cartera/EditarPrestamoModal";
import { buildCarteraColumns, CarteraExpandedRow } from "../components/cartera/carteraColumns";
import {
  CarteraFilters,
  EMPTY_FILTERS,
  daysUntil,
  exportCarteraCsv,
  filterLoans,
} from "../components/cartera/carteraUtils";

export const CarteraPage: React.FC = () => {
  const { clientes } = useClientes();
  const { fetchAmortizaciones } = usePagos();

  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [amortizaciones, setAmortizaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLoan, setEditingLoan] = useState<any>(null);
  const [filters, setFilters] = useState<CarteraFilters>(EMPTY_FILTERS);

  const [today] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const fetchLoans = useCallback(async () => {
    try {
      setLoading(true);
      const [res, amortList] = await Promise.all([fetch("/api/prestamos"), fetchAmortizaciones()]);
      if (res.ok) {
        const data = await res.json();
        setPrestamos(data || []);
      }
      setAmortizaciones(amortList || []);
    } catch (err) {
      console.error("Error al cargar préstamos para la cartera:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchAmortizaciones]);

  useEffect(() => {
    fetchLoans();
  }, []);

  const moraById = useMemo(() => {
    const map = new Map<string, EstadoMoraCliente>();
    for (const p of prestamos) map.set(p.id, calcularEstadoMora(p, amortizaciones, today));
    return map;
  }, [prestamos, amortizaciones, today]);

  const clientesById = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  const getWhatsAppLink = useCallback(
    (loan: any) => {
      const phone = clientesById.get(loan.cliente_id)?.telefono?.replace(/\D/g, "").trim();
      const mora = moraById.get(loan.id);
      if (!phone || !mora) return null;

      const text = generarMensajeCobroPredeterminado({
        tipoPrestamo: loan.tipo_prestamo,
        fechaVencimiento: mora.fechaCuotaActual,
        diasAtraso: mora.diasAtraso,
        estadoCuotaMes: mora.estadoCuotaMes,
        cuotasAtrasadas: mora.cuotasAtrasadas,
      });
      return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    },
    [clientesById, moraById]
  );

  const loanTypes = useMemo(
    () => Array.from(new Set(prestamos.map((p) => p.tipo_prestamo).filter(Boolean))) as string[],
    [prestamos]
  );

  const portfolioKPIs = useMemo(() => {
    const totalColocado = prestamos.reduce((sum, p) => sum + (parseFloat(p.monto_capital) || 0), 0);
    const activasCount = prestamos.filter((p) => p.estado === "activo").length;
    const enMoraCount = prestamos.filter((p) => p.estado === "activo" && daysUntil(p.fecha_vencimiento, today) < 0).length;
    const totalExigible = prestamos.reduce((sum, p) => {
      const cap = parseFloat(p.monto_capital) || 0;
      const rate = parseFloat(p.tasa_interes_porcentaje) || 0;
      return sum + cap * (1 + rate / 100);
    }, 0);
    return { totalColocado, activasCount, enMoraCount, totalExigible };
  }, [prestamos, today]);

  const filteredLoans = useMemo(() => filterLoans(prestamos, moraById, filters), [prestamos, moraById, filters]);

  const columns = useMemo(
    () => buildCarteraColumns({ moraById, today, getWhatsAppLink, onEdit: setEditingLoan }),
    [moraById, today, getWhatsAppLink]
  );

  const emptyMessage = loading ? "Cargando base de datos..." : "No se encontraron préstamos que coincidan con la búsqueda.";

  return (
    <div className="space-y-6 font-sans">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <Briefcase className="text-indigo-650 shrink-0" size={24} />
            <span>Cartera de Deudas</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mt-1.5">
            Gestión ejecutiva, búsqueda multinivel, filtros avanzados y auditoría de créditos
          </p>
        </div>

        <div className="flex items-center gap-2 select-none">
          <Button
            variant="secondary"
            onClick={() => exportCarteraCsv(filteredLoans, today)}
            disabled={filteredLoans.length === 0}
            className="flex items-center gap-1.5 text-xs font-bold py-2.5 px-4 h-11"
          >
            <FileDown size={14} />
            <span>Exportar CSV</span>
          </Button>

          <Link
            to="/clientes"
            className="btn-primary inline-flex items-center gap-1.5 text-xs font-bold py-2.5 px-4 h-11 rounded-xl border border-emerald-600/20 text-white shadow-lg shadow-emerald-600/10 transition decoration-none"
          >
            <span>Ver Clientes</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      <CarteraKPIs {...portfolioKPIs} />

      {/* TABLA PRINCIPAL Y FILTROS */}
      <Card variant="simple" className="flex flex-col">
        <CarteraFiltros
          filters={filters}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          onClear={() => setFilters(EMPTY_FILTERS)}
          loanTypes={loanTypes}
        />

        {/* TABLA - ESCRITORIO */}
        <div className="hidden md:block mt-5">
          <DataTable
            data={filteredLoans}
            columns={columns}
            pageSize={15}
            renderExpandedRow={(loan) => <CarteraExpandedRow loan={loan} today={today} />}
            emptyMessage={emptyMessage}
            showSearch={false}
          />
        </div>

        {/* LISTADO DE TARJETAS SWIPEABLES - MÓVIL */}
        <div className="md:hidden space-y-3 mt-4">
          {filteredLoans.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-bold bg-white border border-slate-200 rounded-3xl">
              {loading ? "Cargando base de datos..." : "No se encontraron préstamos."}
            </div>
          ) : (
            filteredLoans.map((loan) => (
              <CarteraLoanCard
                key={loan.id}
                loan={loan}
                mora={moraById.get(loan.id)}
                today={today}
                waLink={getWhatsAppLink(loan)}
                onEdit={setEditingLoan}
              />
            ))
          )}
        </div>
      </Card>

      {editingLoan && (
        <EditarPrestamoModal
          loan={editingLoan}
          onClose={() => setEditingLoan(null)}
          onSaved={() => {
            setEditingLoan(null);
            fetchLoans();
          }}
        />
      )}
    </div>
  );
};

export default CarteraPage;
