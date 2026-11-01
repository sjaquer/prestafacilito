import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { usePagos } from "../hooks/usePagos";
import { formatSoles, parseVoucherUrls } from "../lib/formatters";
import { METODOS_PAGO } from "../lib/constants";
import { UploadVoucherModal } from "../components/prestamo/UploadVoucherModal";
import { VoucherLightbox } from "../components/common/VoucherLightbox";
import { VoucherCard } from "../components/vouchers/VoucherCard";
import { PrestamoCronogramaModal } from "../components/vouchers/PrestamoCronogramaModal";
import { EditarPagoModal } from "../components/vouchers/EditarPagoModal";
import { useFeedback } from "../components/ui/Feedback";
import { ActionButton, Chips, EmptyState, ListSkeleton, PageHeader, RefreshButton, SearchInput, StickyBar } from "../components/ui/Page";
import { useAccionUrl } from "../hooks/useAccionUrl";

type FiltroVoucher = "sin" | "con" | "todos";

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const nombreMes = (fecha: string) => {
  const [a, m] = String(fecha || "").slice(0, 7).split("-").map(Number);
  if (!a || !m) return "Sin fecha";
  const s = new Date(a, m - 1, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Pagos de préstamos con sus comprobantes: encontrar los que faltan adjuntar y revisar cada voucher. */
export const VouchersPage: React.FC = () => {
  const { notify, confirm } = useFeedback();
  const { fetchAmortizaciones, deletePago, loading } = usePagos();
  const [pagos, setPagos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [metodo, setMetodo] = useState("Todos");
  const [filtro, setFiltro] = useState<FiltroVoucher>("todos");
  const [subirAbierto, setSubirAbierto] = useState(false);
  const [pagoParaAdjuntar, setPagoParaAdjuntar] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [cronogramaPago, setCronogramaPago] = useState<any | null>(null);
  const [editPago, setEditPago] = useState<any | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setPagos((await fetchAmortizaciones()) || []);
  }, [fetchAmortizaciones]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Botón "+" del celular
  useAccionUrl((accion) => accion === "subir" && setSubirAbierto(true));

  const handleDelete = async (pagoId: string) => {
    const ok = await confirm({
      title: "Eliminar pago",
      message: "Se borrará el pago de forma permanente y se recalculará la deuda del préstamo.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;

    setEliminandoId(pagoId);
    try {
      const res = await deletePago(pagoId);
      if (!res.success) throw new Error(res.error || "No se pudo eliminar el pago.");
      notify("Pago eliminado", "success");
      await cargar();
    } catch (e: any) {
      notify(e.message || "Error al conectar con el servidor.");
    } finally {
      setEliminandoId(null);
    }
  };

  const sinVoucher = useMemo(() => pagos.filter((p) => parseVoucherUrls(p.comprobante_url).length === 0).length, [pagos]);

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return pagos.filter((p) => {
      const tiene = parseVoucherUrls(p.comprobante_url).length > 0;
      if (filtro === "con" && !tiene) return false;
      if (filtro === "sin" && tiene) return false;
      if (metodo !== "Todos" && p.metodo_pago !== metodo) return false;
      return !q || normalizar(p.cliente_nombre || "").includes(q) || String(p.monto ?? "").includes(q);
    });
  }, [pagos, busqueda, filtro, metodo]);

  // Agrupados por mes (la API ya los trae del más reciente al más antiguo)
  const porMes = useMemo(() => {
    const grupos: { mes: string; pagos: any[]; total: number }[] = [];
    for (const p of visibles) {
      const mes = nombreMes(p.fecha_pago);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo?.mes === mes) {
        ultimo.pagos.push(p);
        ultimo.total += Number(p.monto) || 0;
      } else {
        grupos.push({ mes, pagos: [p], total: Number(p.monto) || 0 });
      }
    }
    return grupos;
  }, [visibles]);

  return (
    <div className="space-y-4 pb-12 max-w-5xl mx-auto">
      <PageHeader
        title="Vouchers"
        icon={<FileText className="w-6 h-6" />}
        subtitle={`${pagos.length} pagos · ${sinVoucher} sin comprobante`}
        actions={
          <>
            <RefreshButton onClick={cargar} loading={loading} />
            <ActionButton compactoEnMovil icon={<Upload className="w-4 h-4" />} onClick={() => setSubirAbierto(true)}>
              Subir voucher
            </ActionButton>
          </>
        }
      />

      <StickyBar>
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar cliente o monto..." />
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <Chips<FiltroVoucher>
              etiqueta="Filtrar por comprobante"
              valor={filtro}
              onChange={setFiltro}
              opciones={[
                { id: "todos", label: "Todos", n: pagos.length },
                { id: "sin", label: "Sin voucher", n: sinVoucher, dot: "bg-amber-500" },
                { id: "con", label: "Con voucher", n: pagos.length - sinVoucher, dot: "bg-emerald-500" },
              ]}
            />
          </div>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            aria-label="Filtrar por cuenta"
            className={`h-10 sm:h-9 max-w-[7.5rem] sm:max-w-[11rem] shrink-0 pl-3 pr-7 rounded-full border text-xs font-bold outline-none cursor-pointer ${
              metodo === "Todos" ? "bg-white border-slate-200 text-slate-600" : "bg-slate-900 border-slate-900 text-white"
            }`}
          >
            <option value="Todos">Cuentas</option>
            {METODOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </StickyBar>

      {loading && pagos.length === 0 ? (
        <ListSkeleton filas={5} alto="h-[5.5rem]" />
      ) : porMes.length === 0 ? (
        <EmptyState titulo="No hay pagos con estos filtros" detalle="Cambia el filtro o busca otro nombre." />
      ) : (
        porMes.map((g) => (
          <section key={g.mes} className="space-y-2">
            <h2 className="flex items-baseline justify-between px-1 pt-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">{g.mes}</span>
              <span className="text-xs font-bold text-slate-500">
                {g.pagos.length} · <span className="font-mono text-slate-700">{formatSoles(g.total)}</span>
              </span>
            </h2>
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {g.pagos.map((pago) => (
                <VoucherCard
                  key={pago.id}
                  pago={pago}
                  deleting={eliminandoId === pago.id}
                  onPreview={setLightboxUrl}
                  onViewLoan={setCronogramaPago}
                  onEdit={setEditPago}
                  onDelete={handleDelete}
                  onAttach={setPagoParaAdjuntar}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <VoucherLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

      <UploadVoucherModal
        isOpen={subirAbierto || !!pagoParaAdjuntar}
        onClose={() => {
          setSubirAbierto(false);
          setPagoParaAdjuntar(null);
        }}
        pagos={pagos}
        initialPago={pagos.find((p) => p.id === pagoParaAdjuntar) || null}
        onUploaded={cargar}
      />

      <PrestamoCronogramaModal pago={cronogramaPago} onClose={() => setCronogramaPago(null)} />

      <EditarPagoModal
        pago={editPago}
        onClose={() => setEditPago(null)}
        onSaved={() => {
          setEditPago(null);
          cargar();
        }}
      />
    </div>
  );
};
