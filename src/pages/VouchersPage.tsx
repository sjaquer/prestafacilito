import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw, Upload } from "lucide-react";
import { usePagos } from "../hooks/usePagos";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { parseVoucherUrls } from "../lib/formatters";
import { UploadVoucherModal } from "../components/prestamo/UploadVoucherModal";
import { METODOS_PAGO } from "../lib/constants";
import { VoucherLightbox } from "../components/common/VoucherLightbox";
import { VoucherCard } from "../components/vouchers/VoucherCard";
import { PrestamoCronogramaModal } from "../components/vouchers/PrestamoCronogramaModal";
import { EditarPagoModal } from "../components/vouchers/EditarPagoModal";
import { useFeedback } from "../components/ui/Feedback";

export const VouchersPage: React.FC = () => {
  const { notify, confirm } = useFeedback();
  const { fetchAmortizaciones, deletePago, loading } = usePagos();
  const [pagos, setPagos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("Todos");
  const [voucherFilter, setVoucherFilter] = useState("Todos"); // Todos, con, sin
  const [uploadVoucherPagoId, setUploadVoucherPagoId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [cronogramaPago, setCronogramaPago] = useState<any | null>(null);
  const [editPago, setEditPago] = useState<any | null>(null);
  const [deletingPagoId, setDeletingPagoId] = useState<string | null>(null);

  const loadVouchers = useCallback(async () => {
    const list = await fetchAmortizaciones();
    setPagos(list || []);
  }, [fetchAmortizaciones]);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  const handleDelete = async (pagoId: string) => {
    const ok = await confirm({
      title: "Eliminar pago",
      message:
        "¿Estás seguro de que deseas eliminar este pago de forma permanente? Esto anulará el abono y recalculará la deuda del préstamo correspondiente.",
      confirmLabel: "Eliminar",
      danger: true,
    });
    if (!ok) return;

    setDeletingPagoId(pagoId);
    try {
      const res = await deletePago(pagoId);
      if (res.success) {
        await loadVouchers();
      } else {
        notify(res.error || "No se pudo eliminar el pago.");
      }
    } catch (e: any) {
      notify(e.message || "Error al conectar con el servidor.");
    } finally {
      setDeletingPagoId(null);
    }
  };

  const filteredPagos = useMemo(() => {
    return pagos.filter((pago) => {
      const matchesSearch = pago.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            pago.monto?.toString().includes(searchTerm);
      
      const matchesMethod = methodFilter === "Todos" || pago.metodo_pago === methodFilter;
      
      const urls = parseVoucherUrls(pago.comprobante_url);
      const hasVoucher = urls.length > 0;
      const matchesVoucher = voucherFilter === "Todos" ||
                             (voucherFilter === "con" && hasVoucher) ||
                             (voucherFilter === "sin" && !hasVoucher);

      return matchesSearch && matchesMethod && matchesVoucher;
    });
  }, [pagos, searchTerm, methodFilter, voucherFilter]);

  return (
    <div className="space-y-6 select-none font-sans pb-12">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
            Galería de Vouchers y Comprobantes
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
            Consulta, verifica y descarga los comprobantes de pago subidos por los operadores
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            onClick={() => setIsUploadModalOpen(true)}
            variant="primary"
            size="sm"
            icon={<Upload size={14} />}
          >
            + Subir Voucher
          </Button>
          <Button 
            onClick={loadVouchers} 
            variant="secondary" 
            size="sm"
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
            disabled={loading}
          >
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card variant="simple" className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Buscador de pagos"
            placeholder="Buscar por cliente o monto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-0.5">
              Método de Pago
            </label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="glass-input w-full px-4 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 cursor-pointer h-12 text-xs"
            >
              <option value="Todos">Todos los métodos</option>
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-0.5">
              Estado de Archivo
            </label>
            <select
              value={voucherFilter}
              onChange={(e) => setVoucherFilter(e.target.value)}
              className="glass-input w-full px-4 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 cursor-pointer h-12 text-xs"
            >
              <option value="Todos">Todos</option>
              <option value="con">Con Voucher Adjunto</option>
              <option value="sin">Sin Voucher Adjunto</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Grid de Contenido */}
      {loading && pagos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="animate-spin text-indigo-500 mb-3" size={32} />
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cargando comprobantes...</p>
        </div>
      ) : filteredPagos.length === 0 ? (
        <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl p-8 bg-white/40">
          <AlertCircle className="mx-auto text-slate-300 mb-3" size={36} />
          <p className="text-sm font-bold">No se encontraron pagos coincidentes</p>
          <p className="text-xs text-slate-500 mt-1">Prueba reajustando los filtros o el buscador</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredPagos.map((pago) => (
            <VoucherCard
              key={pago.id}
              pago={pago}
              deleting={deletingPagoId === pago.id}
              onPreview={setLightboxUrl}
              onViewLoan={setCronogramaPago}
              onEdit={setEditPago}
              onDelete={handleDelete}
              onAttach={setUploadVoucherPagoId}
            />
          ))}
        </div>
      )}

      <VoucherLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

      {/* Modal Upload Voucher (botón superior) */}
      <UploadVoucherModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        pagos={pagos}
        initialPago={null}
        onUploaded={loadVouchers}
      />

      {/* Modal Upload Voucher (por fila) */}
      <UploadVoucherModal
        isOpen={!!uploadVoucherPagoId}
        onClose={() => setUploadVoucherPagoId(null)}
        pagos={pagos}
        initialPago={pagos.find((p) => p.id === uploadVoucherPagoId) || null}
        onUploaded={loadVouchers}
      />

      <PrestamoCronogramaModal pago={cronogramaPago} onClose={() => setCronogramaPago(null)} />

      <EditarPagoModal
        pago={editPago}
        onClose={() => setEditPago(null)}
        onSaved={() => {
          setEditPago(null);
          loadVouchers();
        }}
      />
    </div>
  );
};
