import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, Filter, Calendar, FileText, Image as ImageIcon, Eye, Loader2, Download, AlertCircle, RefreshCw
} from "lucide-react";
import { usePagos } from "../hooks/usePagos";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { formatCurrency, formatDateShort } from "../lib/formatters";
import { VoucherGenerator } from "../components/prestamo/VoucherGenerator";
import { METODOS_PAGO } from "../lib/constants";

export const VouchersPage: React.FC = () => {
  const { fetchAmortizaciones, loading } = usePagos();
  const [pagos, setPagos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("Todos");
  const [voucherFilter, setVoucherFilter] = useState("Todos"); // Todos, Con Voucher, Sin Voucher
  const [selectedVoucherPago, setSelectedVoucherPago] = useState<any | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const loadVouchers = async () => {
    const list = await fetchAmortizaciones();
    setPagos(list || []);
  };

  useEffect(() => {
    loadVouchers();
  }, []);

  const resolveVoucherUrl = (url: string | null | undefined) => {
    if (!url) return "";
    if (url.startsWith("/api/vouchers/proxy/")) return url;
    const match = url.match(/(?:\/file\/d\/|\?id=)([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `/api/vouchers/proxy/${match[1]}`;
    }
    return url;
  };

  const parseVoucherUrls = (urlField: string | null | undefined): string[] => {
    if (!urlField) return [];
    try {
      if (urlField.startsWith("[")) {
        return JSON.parse(urlField);
      }
    } catch (e) {
      console.error("Failed to parse voucher URLs json:", e);
    }
    return [urlField];
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
          <AlertCircle className="mx-auto text-slate-350 mb-3" size={36} />
          <p className="text-sm font-bold">No se encontraron pagos coincidentes</p>
          <p className="text-xs text-slate-500 mt-1">Prueba reajustando los filtros o el buscador</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredPagos.map((pago) => {
            const voucherUrls = parseVoucherUrls(pago.comprobante_url);
            const hasVoucher = voucherUrls.length > 0;
            const initials = pago.cliente_nombre?.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase() || "CL";

            return (
              <div 
                key={pago.id}
                className="bg-white border border-slate-200 rounded-3xl p-4.5 space-y-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                {/* Cabecera del item */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-black text-sm text-indigo-700 select-none">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-slate-850 text-xs truncate leading-snug">
                        {pago.cliente_nombre}
                      </h4>
                      <span className="text-[9px] text-slate-450 font-bold block">
                        {formatDateShort(pago.fecha_pago)} · {pago.metodo_pago}
                      </span>
                    </div>
                  </div>

                  {/* Vista previa del Voucher */}
                  <div className="relative rounded-2xl border border-slate-100 overflow-hidden bg-slate-50 h-40 flex items-center justify-center">
                    {hasVoucher ? (
                      <div className="w-full h-full relative group">
                        <img 
                          src={resolveVoucherUrl(voucherUrls[0])} 
                          alt="Voucher" 
                          className="w-full h-full object-cover animate-fadeIn"
                          onError={(e) => {
                            // En caso de que sea un PDF o falle la carga, mostrar placeholder
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.parentElement?.querySelector('.fallback-preview');
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                        <div className="fallback-preview hidden w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 p-3">
                          <FileText size={28} className="text-indigo-400" />
                          <span className="text-[10px] font-bold text-center">Documento Adjunto (Ver PDF)</span>
                        </div>
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setLightboxUrl(resolveVoucherUrl(voucherUrls[0]))}
                            className="p-2 bg-white text-slate-800 rounded-xl hover:bg-slate-100 transition shadow cursor-pointer border-none"
                            title="Ver a pantalla completa"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
                        <ImageIcon size={28} className="opacity-40" />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-450">Sin Archivo</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pie y acciones */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-400 font-bold uppercase">Monto</span>
                    <span className="text-emerald-700 font-mono font-black text-sm">
                      {formatCurrency(pago.monto)}
                    </span>
                  </div>
                  
                  <div className="flex gap-1.5">
                    {hasVoucher && (
                      <button
                        type="button"
                        onClick={() => window.open(resolveVoucherUrl(voucherUrls[0]), "_blank")}
                        className="p-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer flex items-center justify-center"
                        title="Ver comprobante original"
                      >
                        <Eye size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedVoucherPago(pago)}
                      className="px-2.5 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-[10px] font-black transition flex items-center gap-1 border-none cursor-pointer"
                    >
                      <FileText size={11} />
                      <span>Recibo</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox para pantalla completa */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-xl max-h-[85vh] overflow-hidden rounded-3xl bg-white border border-white/10 p-2 shadow-2xl">
            <img 
              src={lightboxUrl} 
              alt="Voucher Pantalla Completa" 
              className="max-w-full max-h-[80vh] object-contain rounded-2xl" 
            />
          </div>
        </div>
      )}

      {/* Modal Voucher Generator */}
      {selectedVoucherPago && (
        <VoucherGenerator
          isOpen={!!selectedVoucherPago}
          onClose={() => setSelectedVoucherPago(null)}
          pago={selectedVoucherPago}
          prestamo={{
            tipo_prestamo: selectedVoucherPago.tipo_prestamo,
            cliente_nombre: selectedVoucherPago.cliente_nombre,
            cliente_telefono: selectedVoucherPago.cliente_telefono || "",
            monto_capital: selectedVoucherPago.monto_capital || 0
          }}
        />
      )}
    </div>
  );
};
