import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, Filter, Calendar, FileText, Image as ImageIcon, Eye, Loader2, Download, AlertCircle, RefreshCw, Edit2, Trash2, Info, ArrowRight
} from "lucide-react";
import { usePagos } from "../hooks/usePagos";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { formatCurrency, formatDateShort } from "../lib/formatters";
import { VoucherGenerator } from "../components/prestamo/VoucherGenerator";
import { METODOS_PAGO } from "../lib/constants";

export const VouchersPage: React.FC = () => {
  const { fetchAmortizaciones, updatePago, deletePago, loading } = usePagos();
  const [pagos, setPagos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("Todos");
  const [voucherFilter, setVoucherFilter] = useState("Todos"); // Todos, Con Voucher, Sin Voucher
  const [selectedVoucherPago, setSelectedVoucherPago] = useState<any | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Estados para ver distribución de préstamo
  const [selectedLoanPago, setSelectedLoanPago] = useState<any | null>(null);
  const [selectedLoanDetails, setSelectedLoanDetails] = useState<any | null>(null);
  const [loadingLoanDetails, setLoadingLoanDetails] = useState<boolean>(false);

  // Estados para edición del pago / reasignación de préstamo
  const [selectedEditPago, setSelectedEditPago] = useState<any | null>(null);
  const [clientLoans, setClientLoans] = useState<any[]>([]);
  const [loadingClientLoans, setLoadingClientLoans] = useState<boolean>(false);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [editPagoForm, setEditPagoForm] = useState({
    prestamo_id: "",
    fecha_pago: "",
    monto: 0,
    metodo_pago: ""
  });

  // Estado para eliminación de pago
  const [deletingPagoId, setDeletingPagoId] = useState<string | null>(null);

  const loadVouchers = async () => {
    const list = await fetchAmortizaciones();
    setPagos(list || []);
  };

  useEffect(() => {
    loadVouchers();
  }, []);

  const handleViewLoanSchedule = async (pago: any) => {
    setSelectedLoanPago(pago);
    setSelectedLoanDetails(null);
    setLoadingLoanDetails(true);
    try {
      const res = await fetch(`/api/prestamos/${pago.prestamo_id}`);
      if (res.ok) {
        const details = await res.json();
        setSelectedLoanDetails(details);
      } else {
        alert("No se pudo obtener el detalle del préstamo.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al conectar con el servidor.");
    } finally {
      setLoadingLoanDetails(false);
    }
  };

  const handleStartEdit = async (pago: any) => {
    setSelectedEditPago(pago);
    setEditPagoForm({
      prestamo_id: pago.prestamo_id,
      fecha_pago: pago.fecha_pago ? pago.fecha_pago.split("T")[0] : "",
      monto: pago.monto,
      metodo_pago: pago.metodo_pago
    });
    setLoadingClientLoans(true);
    try {
      const res = await fetch("/api/prestamos");
      if (res.ok) {
        const allLoans = await res.json();
        const filtered = allLoans.filter((l: any) => l.cliente_id === pago.cliente_id);
        setClientLoans(filtered);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingClientLoans(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedEditPago) return;
    if (!editPagoForm.prestamo_id || !editPagoForm.fecha_pago || editPagoForm.monto <= 0 || !editPagoForm.metodo_pago) {
      alert("Por favor completa todos los campos correctamente.");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await updatePago(selectedEditPago.id, {
        prestamo_id: editPagoForm.prestamo_id,
        fecha_pago: editPagoForm.fecha_pago,
        monto: editPagoForm.monto,
        metodo_pago: editPagoForm.metodo_pago
      });
      if (res.success) {
        setSelectedEditPago(null);
        await loadVouchers();
      } else {
        alert(res.error || "No se pudo actualizar el pago.");
      }
    } catch (e: any) {
      alert(e.message || "Error al conectar con el servidor.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (pagoId: string) => {
    const confirm = window.confirm(
      "⚠️ ¿Estás seguro de que deseas eliminar este pago de forma permanente? Esto anulará el abono y recalculará la deuda del préstamo correspondiente."
    );
    if (!confirm) return;

    setDeletingPagoId(pagoId);
    try {
      const res = await deletePago(pagoId);
      if (res.success) {
        await loadVouchers();
      } else {
        alert(res.error || "No se pudo eliminar el pago.");
      }
    } catch (e: any) {
      alert(e.message || "Error al conectar con el servidor.");
    } finally {
      setDeletingPagoId(null);
    }
  };

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
                      <h4 className="font-extrabold text-slate-855 text-xs truncate leading-snug">
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
                      <div className="w-full h-full relative group p-1.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(voucherUrls.length, 3)}, 1fr)` }}>
                        {voucherUrls.slice(0, 3).map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setLightboxUrl(resolveVoucherUrl(url))}
                            className="relative rounded-xl overflow-hidden border border-slate-200 group/img cursor-pointer focus:outline-none"
                            title="Ver voucher"
                          >
                            <img
                              src={resolveVoucherUrl(url)}
                              alt={`Voucher ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.nextElementSibling?.classList.remove("hidden");
                              }}
                            />
                            <div className="hidden w-full h-full flex-col items-center justify-center text-slate-400 gap-1 p-2 bg-white">
                              <FileText size={16} className="text-indigo-400" />
                              <span className="text-[9px] font-bold text-center">Ver PDF</span>
                            </div>
                            {idx === 2 && voucherUrls.length > 3 && (
                              <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center text-white font-black text-sm">
                                +{voucherUrls.length - 3}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
                        <ImageIcon size={28} className="opacity-40" />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-450">Sin Archivo</span>
                      </div>
                    )}
                  </div>

                  {/* Información del Préstamo Asociado */}
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-2.5 space-y-1.5 mt-1 text-[11px] select-none">
                    <div className="flex justify-between items-center text-[9px] text-slate-400 font-black uppercase tracking-wider">
                      <span>Préstamo</span>
                      <span className="text-indigo-700 font-extrabold">{pago.tipo_prestamo}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Capital:</span>
                      <span className="text-slate-800 font-mono font-black">{formatCurrency(pago.monto_capital)}</span>
                    </div>
                  </div>
                </div>

                {/* Pie y acciones */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-auto">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Monto Pago</span>
                    <span className="text-emerald-700 font-mono font-black text-sm">
                      {formatCurrency(pago.monto)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {/* Ver Préstamo */}
                    <button
                      type="button"
                      onClick={() => handleViewLoanSchedule(pago)}
                      className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-100 transition cursor-pointer flex items-center justify-center"
                      title="Ver préstamo y cronograma de pagos"
                    >
                      <Info size={12} />
                    </button>

                    {/* Editar Pago */}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(pago)}
                      className="p-2 bg-amber-50 border border-amber-250 text-amber-700 hover:bg-amber-100 transition cursor-pointer flex items-center justify-center"
                      title="Editar pago / reasignar préstamo"
                    >
                      <Edit2 size={12} />
                    </button>

                    {/* Eliminar Pago */}
                    <button
                      type="button"
                      onClick={() => handleDelete(pago.id)}
                      disabled={deletingPagoId === pago.id}
                      className="p-2 bg-rose-50 border border-rose-250 text-rose-700 hover:bg-rose-100 transition cursor-pointer flex items-center justify-center disabled:opacity-50"
                      title="Eliminar abono"
                    >
                      {deletingPagoId === pago.id ? (
                        <Loader2 size={12} className="animate-spin text-rose-750" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                    </button>

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

      {/* Modal: Ver Préstamo y Amortización */}
      <Modal
        isOpen={!!selectedLoanPago}
        onClose={() => {
          setSelectedLoanPago(null);
          setSelectedLoanDetails(null);
        }}
        title={`Detalle de Préstamo - ${selectedLoanPago?.cliente_nombre}`}
        size="lg"
      >
        {loadingLoanDetails ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="animate-spin text-indigo-500 mb-3" size={28} />
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cargando cronograma...</p>
          </div>
        ) : selectedLoanDetails ? (
          <div className="space-y-6">
            {/* Resumen del Préstamo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 rounded-3xl p-5 border border-slate-100">
              <div className="space-y-0.5">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Tipo</span>
                <span className="text-slate-800 font-extrabold text-xs">{selectedLoanDetails.prestamo.tipo_prestamo}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Capital</span>
                <span className="text-slate-800 font-mono font-black text-xs">{formatCurrency(selectedLoanDetails.prestamo.monto_capital)}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Total Pagado</span>
                <span className="text-emerald-700 font-mono font-black text-xs">{formatCurrency(selectedLoanDetails.prestamo.total_pagado)}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Saldo Pendiente</span>
                <span className="text-rose-700 font-mono font-black text-xs">{formatCurrency(selectedLoanDetails.prestamo.saldo_pendiente)}</span>
              </div>
            </div>

            {/* Cronograma de Cuotas */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-805 uppercase tracking-widest pl-1">Cronograma de Pagos</h4>
              <div className="border border-slate-150 rounded-3xl overflow-hidden bg-white max-h-[300px] overflow-y-auto">
                <table className="w-full border-collapse text-left text-xs font-semibold">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-150 select-none">
                      <th className="px-4 py-3 text-center">Nº</th>
                      <th className="px-4 py-3">Vencimiento</th>
                      <th className="px-4 py-3 text-right">Cuota Base</th>
                      <th className="px-4 py-3 text-right">Mora</th>
                      <th className="px-4 py-3 text-right">Pagado</th>
                      <th className="px-4 py-3 text-right">Saldo</th>
                      <th className="px-4 py-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {selectedLoanDetails.cuotas.map((cuota: any) => {
                      const isSaldada = cuota.estado === "Saldada";
                      const isVencida = cuota.estado === "Vencida";
                      const isParcial = cuota.estado === "Parcial";
                      
                      let badgeCls = "bg-slate-100 border-slate-200 text-slate-600";
                      if (isSaldada) badgeCls = "bg-emerald-50 border-emerald-200 text-emerald-700";
                      if (isVencida) badgeCls = "bg-rose-50 border-rose-250 text-rose-700";
                      if (isParcial) badgeCls = "bg-amber-50 border-amber-250 text-amber-700";

                      return (
                        <tr 
                          key={cuota.numero} 
                          className={`hover:bg-slate-50/50 transition ${
                            cuota.saldoPendiente === 0 ? "bg-emerald-50/5" : ""
                          }`}
                        >
                          <td className="px-4 py-2.5 text-center font-bold text-slate-400">{cuota.numero}</td>
                          <td className="px-4 py-2.5 font-bold font-mono text-slate-800">{formatDateShort(cuota.fechaVencimiento)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">{formatCurrency(cuota.montoCuotaBase)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-600">{formatCurrency(cuota.moraPendiente)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-black text-emerald-700">{formatCurrency(cuota.pagado)}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-black text-slate-900">{formatCurrency(cuota.saldoPendiente)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border font-black text-[9px] uppercase tracking-wider ${badgeCls}`}>
                              {cuota.estado}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Listado de Pagos y Resaltado del Pago Actual */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-805 uppercase tracking-widest pl-1">Pagos Registrados</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto">
                {selectedLoanDetails.pagosRealizados.map((p: any) => {
                  const isCurrentPago = p.id === selectedLoanPago.id;
                  return (
                    <div 
                      key={p.id}
                      className={`border rounded-2xl p-3 flex justify-between items-center transition ${
                        isCurrentPago 
                          ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/10 shadow-sm" 
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-805">{formatDateShort(p.fecha_pago)}</span>
                          {isCurrentPago && (
                            <span className="bg-indigo-650 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                              Este Pago
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">{p.metodo_pago}</span>
                      </div>
                      <span className={`font-mono font-black text-xs ${isCurrentPago ? "text-indigo-700" : "text-slate-800"}`}>
                        {formatCurrency(p.monto)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-slate-400">
            <p className="text-xs">No se pudieron cargar los datos del préstamo.</p>
          </div>
        )}
      </Modal>

      {/* Modal: Editar Pago / Reasignar Préstamo */}
      <Modal
        isOpen={!!selectedEditPago}
        onClose={() => {
          setSelectedEditPago(null);
          setClientLoans([]);
        }}
        title={`Editar Pago - ${selectedEditPago?.cliente_nombre}`}
        footerActions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedEditPago(null);
                setClientLoans([]);
              }}
              disabled={savingEdit}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveEdit}
              loading={savingEdit}
              disabled={loadingClientLoans}
            >
              Guardar Cambios
            </Button>
          </div>
        }
      >
        {loadingClientLoans ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="animate-spin text-indigo-500 mb-3" size={28} />
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cargando préstamos del cliente...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Préstamo Asociado */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-wider pl-0.5">
                Préstamo Destino
              </label>
              <select
                value={editPagoForm.prestamo_id}
                onChange={(e) => setEditPagoForm(prev => ({ ...prev, prestamo_id: e.target.value }))}
                className="glass-input w-full px-4 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 cursor-pointer h-12 text-xs"
              >
                {clientLoans.length === 0 ? (
                  <option value="">No hay otros préstamos activos</option>
                ) : (
                  clientLoans.map((l) => (
                    <option key={l.id} value={l.id}>
                      S/ {l.monto_capital.toLocaleString("es-PE", { minimumFractionDigits: 2 })} - {l.tipo_prestamo} ({l.estado.toUpperCase()})
                    </option>
                  ))
                )}
              </select>
              <p className="text-[9px] text-slate-450 font-bold mt-1 pl-0.5 uppercase tracking-wide">
                * Muestra solo préstamos del cliente {selectedEditPago?.cliente_nombre}
              </p>
            </div>

            {/* Monto */}
            <Input
              label="Monto del Pago (S/.)"
              type="number"
              step="0.01"
              value={editPagoForm.monto || ""}
              onChange={(e) => setEditPagoForm(prev => ({ ...prev, monto: parseFloat(e.target.value) || 0 }))}
              placeholder="0.00"
              required
            />

            {/* Fecha */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-wider pl-0.5">
                Fecha del Pago
              </label>
              <input
                type="date"
                value={editPagoForm.fecha_pago}
                onChange={(e) => setEditPagoForm(prev => ({ ...prev, fecha_pago: e.target.value }))}
                className="glass-input w-full px-4 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 h-12 text-xs"
                required
              />
            </div>

            {/* Método de Pago */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-wider pl-0.5">
                Método de Pago
              </label>
              <select
                value={editPagoForm.metodo_pago}
                onChange={(e) => setEditPagoForm(prev => ({ ...prev, metodo_pago: e.target.value }))}
                className="glass-input w-full px-4 rounded-xl border border-slate-200 font-bold bg-white text-slate-800 cursor-pointer h-12 text-xs"
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
