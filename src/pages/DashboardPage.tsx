import React, { useState, useEffect, useRef } from "react";
import { Loader2, CalendarDays, UploadCloud, X, CheckCircle, ShieldAlert, TrendingUp, BarChart3 } from "lucide-react";
import { KPICards } from "../components/dashboard/KPICards";
import { QuickActions } from "../components/dashboard/QuickActions";
import { ClientAlerts } from "../components/dashboard/ClientAlerts";
import { DashboardCharts } from "../components/dashboard/DashboardCharts";
import { RecentActivity } from "../components/dashboard/RecentActivity";
import { NewLoanModal } from "../components/dashboard/NewLoanModal";
import { MonthlyTrendChart } from "../components/dashboard/MonthlyTrendChart";
import { LoanDistributionChart } from "../components/dashboard/LoanDistributionChart";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

import { useClientes } from "../hooks/useClientes";
import { usePrestamos } from "../hooks/usePrestamos";
import { usePagos } from "../hooks/usePagos";
import { useAuth } from "../hooks/useAuth";
import { formatCurrency, round2, getNombreUsuario } from "../lib/formatters";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { clientes, loading: loadingClientes } = useClientes();
  const { createPrestamo, loading: loadingLoans } = usePrestamos();
  const { registerPago, fetchAmortizaciones, loading: loadingPayments } = usePagos();

  const [metrics, setMetrics] = useState<any>(null);
  const [ultimosPrestamos, setUltimosPrestamos] = useState<any[]>([]);
  const [amortizaciones, setAmortizaciones] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [driveStatus, setDriveStatus] = useState<any>(null);

  // Modales
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);

  // Voucher Quick Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedVcrFile, setSelectedVcrFile] = useState<File | null>(null);
  const [selectedVcrBase64, setSelectedVcrBase64] = useState("");
  const [showVcrModal, setShowVcrModal] = useState(false);
  
  const [vcrClienteId, setVcrClienteId] = useState("");
  const [vcrLoanId, setVcrLoanId] = useState("");
  const [vcrMonto, setVcrMonto] = useState("");
  const [vcrMetodo, setVcrMetodo] = useState("Yape");
  const [vcrFecha, setVcrFecha] = useState(() => new Date().toISOString().split("T")[0]);
  
  const [vcrSearchText, setVcrSearchText] = useState("");
  const [vcrShowDropdown, setVcrShowDropdown] = useState(false);
  
  const [vcrMatchingLoans, setVcrMatchingLoans] = useState<any[]>([]);
  const [vcrAutoMatching, setVcrAutoMatching] = useState(false);
  const [vcrRegistering, setVcrRegistering] = useState(false);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const handleClipboardImage = (items: DataTransferItemList | null) => {
    if (!items) return false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setSelectedVcrFile(file);
          const reader = new FileReader();
          reader.onloadend = () => {
            setSelectedVcrBase64((reader.result as string).split(",")[1]);
            setShowVcrModal(true);
          };
          reader.readAsDataURL(file);

          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          return true;
        }
      }
    }

    return false;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashRes, amortList, logsRes, driveRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetchAmortizaciones(),
        fetch("/api/logs"),
        fetch("/api/drive/status")
      ]);

      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setMetrics(dashData.metrics);
        setUltimosPrestamos(dashData.ultimosPrestamos || []);
      }

      setAmortizaciones(amortList);

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData || []);
      }

      if (driveRes.ok) {
        const driveData = await driveRes.json();
        setDriveStatus(driveData);
      }
    } catch (err) {
      console.error("Error al cargar dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Global paste handler to paste images directly (e.g. transfer screenshots)
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (handleClipboardImage(e.clipboardData?.items || null)) {
        e.preventDefault();
      }
    };

    window.addEventListener("paste", handleGlobalPaste);

    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
    };
  }, []);

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/calendar/sync-month", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncResult({ success: true, message: data.message });
      } else {
        setSyncResult({ success: false, message: data.error || "Ocurrió un error al sincronizar con Google Calendar." });
      }
    } catch {
      setSyncResult({ success: false, message: "Error de conexión al sincronizar calendario." });
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleNewLoanSubmit = async (loanData: any) => {
    const res = await createPrestamo(loanData);
    if (res.success) {
      await fetchDashboardData();
      return true;
    } else {
      alert(res.error || "No se pudo otorgar el préstamo");
      return false;
    }
  };

  // Auto-seleccionar deuda al elegir cliente
  useEffect(() => {
    const fetchMatchingLoans = async () => {
      if (!vcrClienteId || !vcrMonto) {
        setVcrMatchingLoans([]);
        setVcrLoanId("");
        return;
      }

      setVcrAutoMatching(true);
      try {
        const res = await fetch("/api/prestamos/autoseleccionar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cliente_id: vcrClienteId,
            monto: round2(parseFloat(vcrMonto)),
            fecha_pago: vcrFecha
          })
        });
        if (res.ok) {
          const data = await res.json();
          const suggestions = data?.sugerencias || [];
          const bestMatch = data?.mejorCoincidencia || null;
          const merged = bestMatch ? [bestMatch, ...suggestions.filter((s: any) => s.prestamo_id !== bestMatch.prestamo_id)] : suggestions;
          setVcrMatchingLoans(merged);

          // Auto-vincular mejor coincidencia
          if (bestMatch?.prestamo_id) {
            setVcrLoanId(bestMatch.prestamo_id);
          }
        }
      } catch (err) {
        console.error("Error al auto-seleccionar préstamo:", err);
      } finally {
        setVcrAutoMatching(false);
      }
    };

    fetchMatchingLoans();
  }, [vcrClienteId, vcrMonto]);

  const handleVoucherFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedVcrFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedVcrBase64((reader.result as string).split(",")[1]);
      setShowVcrModal(true);
    };
    reader.readAsDataURL(file);
  };

  const handleVcrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vcrClienteId || !vcrLoanId || !vcrMonto) {
      alert("Por favor rellene todos los campos requeridos");
      return;
    }

    setVcrRegistering(true);
    try {
      const payload = {
        monto: round2(parseFloat(vcrMonto)),
        metodo_pago: vcrMetodo,
        fecha_pago: vcrFecha,
        fileName: selectedVcrFile?.name,
        mimeType: selectedVcrFile?.type,
        base64Data: selectedVcrBase64 || undefined
      };

      const res = await fetch(`/api/prestamos/${vcrLoanId}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowVcrModal(false);
        setSelectedVcrFile(null);
        setSelectedVcrBase64("");
        setVcrClienteId("");
        setVcrLoanId("");
        setVcrMonto("");
        setVcrSearchText("");
        await fetchDashboardData();
      } else {
        const errData = await res.json();
        alert(errData.error || "Ocurrió un error al subir voucher.");
      }
    } catch (err: any) {
      alert(err.message || "Error al conectar con el servidor.");
    } finally {
      setVcrRegistering(false);
    }
  };

  const resolveVoucherUrl = (url: string | null | undefined) => {
    if (!url) return "";
    if (url.startsWith("data:")) return url;
    if (url.startsWith("/api/vouchers/proxy/")) return url;
    const match = url.match(/(?:\/file\/d\/|\?id=)([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `/api/vouchers/proxy/${match[1]}`;
    }
    return url;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const nombre = getNombreUsuario(user);
    if (hour < 12) return `Buenos días, ${nombre}`;
    if (hour < 18) return `Buenas tardes, ${nombre}`;
    return `Buenas noches, ${nombre}`;
  };

  const todayFormatted = new Date().toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const activeLoans = ultimosPrestamos.filter((p) => p.estado === "activo");
  const overdueLoans = activeLoans.filter((p) => {
    const todayStr = new Date().toISOString().split("T")[0];
    return p.fecha_vencimiento && p.fecha_vencimiento < todayStr;
  });
  const paidCount = ultimosPrestamos.filter((p) => p.estado === "pagado").length;

  const estimatedExigible = round2(
    ultimosPrestamos.reduce(
      (sum, loan) => sum + (Number(loan.monto_capital) || 0) * (1 + (Number(loan.tasa_interes_porcentaje) || 0) / 100),
      0
    )
  );

  if (loading && !metrics) {
    return (
      <div id="dashboard-loader" className="flex flex-col items-center justify-center p-12 min-h-[500px] select-none">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={36} />
        <p className="text-slate-400 font-bold text-sm tracking-wide">Actualizando base de datos...</p>
      </div>
    );
  }

  return (
    <div id="dashboard-view" className="space-y-8 max-w-7xl mx-auto pb-12 select-none">
      
      {/* 1. SECCIÓN DE OPERACIONES RÁPIDAS Y BIENVENIDA */}
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl shadow-black/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]"></span>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
              {todayFormatted}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1.5 tracking-tight leading-none">
            {getGreeting()} 🇵🇪
          </h1>
          <p className="text-[10px] sm:text-xs text-slate-550 font-bold uppercase tracking-wider mt-1.5">
            PrestaFacilito Business Intelligence · Panel Ejecutivo
          </p>
        </div>

        <QuickActions
          onNewLoanClick={() => setShowNewLoanModal(true)}
          onRegisterPagoClick={() => fileInputRef.current?.click()}
          onSyncCalendarClick={handleSyncCalendar}
          syncingCalendar={syncingCalendar}
        />
        
        {/* Input Oculto para Cargar Archivo de Voucher */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleVoucherFileChange}
          accept="image/*,application/pdf"
          className="hidden"
        />
      </div>

      {syncResult && (
        <div className={`p-4 border rounded-2xl text-xs flex items-start gap-2.5 relative animate-fadeIn ${
          syncResult.success 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
            : "bg-rose-500/10 border-rose-500/20 text-rose-300"
        }`}>
          {syncResult.success ? (
            <CheckCircle className="shrink-0 text-emerald-400 mt-0.5" size={16} />
          ) : (
            <ShieldAlert className="shrink-0 text-rose-400 mt-0.5" size={16} />
          )}
          <div className="flex-1">
            <span className="font-bold block text-sm">
              {syncResult.success ? "Sincronización Completada" : "Error de Sincronización"}
            </span>
            <span className="opacity-90 leading-normal mt-0.5 block">{syncResult.message}</span>
          </div>
          <button 
            onClick={() => setSyncResult(null)}
            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer border-none bg-transparent"
          >
            ✕
          </button>
        </div>
      )}

      {driveStatus && !driveStatus.configured && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-4 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="shrink-0 text-amber-400 mt-0.5" size={18} />
            <div>
              <span className="font-bold block text-sm">Google Drive Desconectado / Error de Token</span>
              <span className="opacity-90 leading-normal mt-0.5 block">
                {driveStatus.message || "El token de acceso ha expirado o no está configurado. La subida de comprobantes y la sincronización con Google Calendar/Drive fallará."}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              if (window.confirm("¿Deseas iniciar sesión con Google para conectar Drive?")) {
                window.location.href = "/api/auth/google/login";
              }
            }}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-[#0c1020] font-black rounded-xl transition duration-150 text-xs shrink-0 select-none cursor-pointer border-none"
          >
            Conectar Google Drive
          </button>
        </div>
      )}

      {/* 2. KPIs FINANCIEROS */}
      <KPICards
        totalCapitalPrestado={metrics?.totalCapitalPrestado || 0}
        totalRecuperado={metrics?.totalRecuperado || 0}
        activeLoansCount={activeLoans.length}
        overdueLoansCount={overdueLoans.length}
        totalExigible={estimatedExigible}
      />

      {/* 3. GRÁFICOS EJECUTIVOS (TENDENCIA Y DISTRIBUCIÓN) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MonthlyTrendChart amortizaciones={amortizaciones} />
        </div>
        <div>
          <LoanDistributionChart
            activeCount={activeLoans.length - overdueLoans.length}
            paidCount={paidCount}
            overdueCount={overdueLoans.length}
          />
        </div>
      </div>

      {/* 4. RADAR DE VENCIMIENTOS COMPACTO */}
      <ClientAlerts
        activeLoans={activeLoans}
        clientes={clientes}
        compact={true}
      />

      {/* 5. DISTRIBUCIÓN BANCARIA */}
      <DashboardCharts
        amortizaciones={amortizaciones}
        totalExigible={estimatedExigible}
      />

      {/* 6. ACTIVIDAD RECIENTE Y AUDITORÍA COMPACTA */}
      <RecentActivity
        amortizaciones={amortizaciones}
        logs={logs}
        onVoucherClick={setLightboxImage}
        resolveVoucherUrl={resolveVoucherUrl}
        compact={true}
      />

      {/* MODAL: REGISTRAR PAGO RÁPIDO DESDE ARCHIVO DE VOUCHER */}
      <Modal
        isOpen={showVcrModal}
        onClose={() => {
          setShowVcrModal(false);
          setSelectedVcrFile(null);
          setSelectedVcrBase64("");
          setVcrClienteId("");
          setVcrLoanId("");
          setVcrMonto("");
          setVcrSearchText("");
        }}
        title="Registrar Cobro Rápido"
        size="lg"
      >
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          onPaste={(e) => {
            if (handleClipboardImage(e.clipboardData?.items || null)) {
              e.preventDefault();
            }
          }}
        >
          {/* Vista previa del voucher */}
          <div
            className="flex flex-col items-center justify-center bg-black/30 border border-white/5 rounded-3xl p-4 min-h-[300px] cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedVcrFile && selectedVcrFile.type.startsWith("image/") ? (
              <div className="flex flex-col items-center gap-2 w-full">
                <img
                  src={`data:${selectedVcrFile.type};base64,${selectedVcrBase64}`}
                  alt="Comprobante cargado"
                  className="max-w-full max-h-[290px] object-contain rounded-2xl shadow-lg cursor-pointer hover:opacity-90 transition"
                  onClick={() => setLightboxImage(`data:${selectedVcrFile.type};base64,${selectedVcrBase64}`)}
                />
                <span className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider text-center block mt-1">
                  💡 Haz clic para ampliar · Presiona Ctrl+V para cambiar imagen
                </span>
              </div>
            ) : (
              <div className="text-center text-slate-550 flex flex-col items-center gap-2">
                <UploadCloud size={48} className="text-slate-655" />
                <span className="font-bold">Comprobante no visualizable</span>
                <span className="text-[10px] uppercase font-bold tracking-wider">{selectedVcrFile?.name}</span>
                <span className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block mt-1">
                  📋 Presiona Ctrl+V para pegar comprobante
                </span>
              </div>
            )}
          </div>

          {/* Formulario de registro */}
          <form onSubmit={handleVcrSubmit} className="space-y-4">
            
            {/* Buscador de Cliente */}
            <div className="relative space-y-1">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                Cliente que Pagó <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={vcrSearchText}
                onChange={(e) => {
                  setVcrSearchText(e.target.value);
                  setVcrClienteId("");
                  setVcrShowDropdown(true);
                }}
                onFocus={() => setVcrShowDropdown(true)}
                className="glass-input w-full px-4 rounded-xl border border-white/8 font-medium"
              />
              {vcrShowDropdown && vcrSearchText && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-[#0d1020] border border-white/10 rounded-xl shadow-2xl max-h-40 overflow-y-auto">
                  {clientes
                    .filter(c => c.nombre_completo.toLowerCase().includes(vcrSearchText.toLowerCase()))
                    .map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setVcrClienteId(c.id);
                          setVcrSearchText(c.nombre_completo);
                          setVcrShowDropdown(false);
                        }}
                        className="px-4 py-2.5 hover:bg-indigo-650 hover:text-white text-xs text-slate-350 cursor-pointer transition font-semibold"
                      >
                        {c.nombre_completo}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            {/* Monto cobrado */}
            <Input
              label="Monto Recibido (S/.)"
              placeholder="Ej: 500.00"
              type="number"
              required
              value={vcrMonto}
              onChange={(e) => setVcrMonto(e.target.value)}
            />

            {/* Préstamo candidato */}
            {vcrClienteId && (
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                  Vincular al Crédito <span className="text-rose-500 font-bold">*</span>
                </label>
                {vcrAutoMatching ? (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 p-3 bg-white/[0.02] border border-white/5 rounded-xl font-bold">
                    <Loader2 size={13} className="animate-spin text-indigo-400" />
                    <span>Buscando coincidencias de saldo...</span>
                  </div>
                ) : vcrMatchingLoans.length === 0 ? (
                  <div className="text-xs text-rose-400 p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl font-bold">
                    Este cliente no posee préstamos activos a vincular.
                  </div>
                ) : (
                  <select
                    value={vcrLoanId}
                    onChange={(e) => setVcrLoanId(e.target.value)}
                    className="glass-input w-full px-4 rounded-xl border border-white/8 font-medium bg-[#080c18] text-[#f8fafc] cursor-pointer h-12"
                  >
                    <option value="">Seleccione el préstamo...</option>
                    {vcrMatchingLoans.map(cand => (
                      <option key={cand.prestamo_id} value={cand.prestamo_id}>
                        {cand.tipo_prestamo} · Cap: {formatCurrency(cand.monto_capital)} (Sug: {cand.clasificacion_sugerida})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Método de pago */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                Método de Cobro
              </label>
              <select
                value={vcrMetodo}
                onChange={(e) => setVcrMetodo(e.target.value)}
                className="glass-input w-full px-4 rounded-xl border border-white/8 font-medium bg-[#080c18] text-[#f8fafc] cursor-pointer h-12"
              >
                <option value="Yape">Yape</option>
                <option value="Plin">Plin</option>
                <option value="Transferencia BCP">Transferencia BCP</option>
                <option value="Transferencia Interbank">Transferencia Interbank</option>
                <option value="Transferencia BBVA">Transferencia BBVA</option>
                <option value="Transferencia Scotiabank">Transferencia Scotiabank</option>
                <option value="Efectivo">Efectivo</option>
              </select>
            </div>

            {/* Fecha de pago */}
            <Input
              label="Fecha del Pago"
              type="date"
              required
              value={vcrFecha}
              onChange={(e) => setVcrFecha(e.target.value)}
            />

            <Button
              type="submit"
              variant="primary"
              loading={vcrRegistering}
              disabled={!vcrLoanId}
              className="w-full mt-4 h-12 font-bold"
            >
              Registrar Abono y Voucher
            </Button>
          </form>
        </div>
      </Modal>

      {/* MODAL: OTORGAR NUEVO PRÉSTAMO */}
      <NewLoanModal
        isOpen={showNewLoanModal}
        onClose={() => setShowNewLoanModal(false)}
        clientes={clientes}
        onSubmit={handleNewLoanSubmit}
      />

      {/* LIGHTBOX DE IMAGEN DE COMPROBANTE */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={lightboxImage}
            alt="Voucher ampliado"
            className="max-w-full max-h-[92vh] object-contain rounded-2xl shadow-2xl transition-all duration-300"
          />
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-rose-500/20 text-white rounded-xl transition border-none cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

    </div>
  );
};
export default DashboardPage;
