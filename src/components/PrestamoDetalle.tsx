import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Edit3, RefreshCw, CheckCircle2, AlertTriangle, Clock, AlertCircle, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { TimelineDetallePrestamo, TimelineMesItem } from "./prestamo/TimelineDetallePrestamo";
import { AjustesPrestamoPanel } from "./prestamo/AjustesPrestamoPanel";
import { RegistrarPagoPrestamoForm } from "./prestamo/RegistrarPagoPrestamoForm";
import { EditarPrestamoForm } from "./prestamo/EditarPrestamoForm";
import { VoucherLightbox } from "./common/VoucherLightbox";
import { resolveVoucherUrl } from "../lib/formatters";

type Flash = { type: "success" | "error" | "info"; text: string } | null;

const FLASH_STYLES = {
  success: { box: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: CheckCircle2 },
  error: { box: "bg-red-50 border-red-200 text-red-700", icon: AlertCircle },
  info: { box: "bg-blue-50 border-blue-200 text-blue-800", icon: RefreshCw },
};

const money = (value: unknown) => `S/ ${(Number(value) || 0).toFixed(2)}`;

const StatCard: React.FC<{ label: string; value: string; valueClass: string; hint?: string }> = ({
  label,
  value,
  valueClass,
  hint,
}) => (
  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
    <span className="text-[10px] text-slate-400 uppercase font-bold block">{label}</span>
    <span className={`text-lg font-extrabold ${valueClass}`}>{value}</span>
    {hint && <span className="text-[11px] text-slate-500 block">{hint}</span>}
  </div>
);

export const PrestamoDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [prestamo, setPrestamo] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [resumen, setResumen] = useState<any>(null);
  const [deuda, setDeuda] = useState<any>(null);
  const [timeline, setTimeline] = useState<TimelineMesItem[]>([]);
  const [ajustes, setAjustes] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [flash, setFlash] = useState<Flash>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSyncingCal, setIsSyncingCal] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Los mensajes de éxito se ocultan solos; los errores quedan hasta cerrarlos o una nueva acción
  useEffect(() => {
    if (flash?.type !== "success") return;
    const t = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(t);
  }, [flash]);

  const fetchDetalle = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/prestamos/${id}`);
      if (!res.ok) throw new Error("No se pudo cargar el detalle del préstamo");

      const data = await res.json();
      setPrestamo(data.prestamo || null);
      setCliente(data.cliente || null);
      setResumen(data.resumen || null);
      setDeuda(data.deuda || null);
      setTimeline(data.timeline || []);
      setAjustes(data.ajustes || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con el servidor");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetalle();
  }, [fetchDetalle]);

  const handleEditarFechaPago = async (pagoId: string, nuevaFecha: string) => {
    try {
      const res = await fetch(`/api/amortizaciones/${pagoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha_pago: nuevaFecha }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "No se pudo actualizar la fecha del pago");
      }

      setFlash({ type: "success", text: "¡Fecha del pago actualizada y cronograma recalculado con éxito!" });
      await fetchDetalle();
    } catch (err: any) {
      setFlash({ type: "error", text: err.message || "Error al actualizar la fecha del pago" });
      throw err;
    }
  };

  const handleSyncCalendar = async () => {
    setIsSyncingCal(true);
    setFlash(null);
    try {
      const res = await fetch("/api/calendar/sync-month", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setFlash(
        res.ok && data.success
          ? { type: "info", text: "¡Calendario sincronizado correctamente!" }
          : { type: "error", text: "No se pudo sincronizar el calendario." }
      );
    } catch {
      setFlash({ type: "error", text: "Error de conexión al sincronizar calendario." });
    } finally {
      setIsSyncingCal(false);
    }
  };

  if (isLoading && !prestamo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-slate-500">Cargando detalle del préstamo y timeline...</p>
      </div>
    );
  }

  if (errorMsg || !prestamo) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl space-y-3">
        <p className="text-sm font-bold text-red-800">{errorMsg || "Préstamo no encontrado"}</p>
        <button
          onClick={() => navigate("/")}
          className="px-3 py-1.5 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl"
        >
          ← Volver al Centro de Control
        </button>
      </div>
    );
  }

  const isLiquidado = prestamo.estado === "pagado" || (resumen && resumen.saldoPendiente <= 0.01);
  const isEstancado = !isLiquidado && (resumen?.esEstancado || prestamo.estado === "estancado");
  const diaPago = prestamo.fecha_vencimiento
    ? parseInt(prestamo.fecha_vencimiento.split("-")[2])
    : prestamo.fecha_emision
    ? parseInt(prestamo.fecha_emision.split("-")[2])
    : "";
  const FlashIcon = flash ? FLASH_STYLES[flash.type].icon : null;

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Cabecera */}
      <div className="space-y-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold text-slate-900">
                PRÉSTAMO DE {cliente ? cliente.nombre_completo : prestamo.cliente_nombre}
              </h1>
              {cliente?.apodo && <span className="text-sm font-semibold text-slate-500 italic">({cliente.apodo})</span>}
              {isLoading && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" aria-label="Actualizando" />}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Capital inicial: <span className="font-bold text-slate-800">{money(prestamo.monto_capital)}</span> | Tasa:{" "}
              <span className="font-bold text-slate-800">{prestamo.tasa_interes_porcentaje}%/mes</span> |{" "}
              {resumen?.mesesTranscurridos || 1} períodos
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Emisión: {prestamo.fecha_emision} | Día de pago: día {diaPago} de cada mes
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing((v) => !v)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" /> Editar Préstamo
            </button>
            <button
              onClick={handleSyncCalendar}
              disabled={isSyncingCal}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCal ? "animate-spin" : ""}`} /> Sincronizar Calendario
            </button>
          </div>
        </div>
      </div>

      {flash && FlashIcon && (
        <div
          role={flash.type === "error" ? "alert" : "status"}
          className={`p-3 border rounded-xl flex items-center gap-2 text-xs font-medium ${FLASH_STYLES[flash.type].box}`}
        >
          <FlashIcon className="w-4 h-4 shrink-0" />
          <span className="flex-1">{flash.text}</span>
          <button type="button" onClick={() => setFlash(null)} aria-label="Cerrar mensaje" className="p-0.5 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isEditing && (
        <EditarPrestamoForm
          prestamo={prestamo}
          onCancel={() => setIsEditing(false)}
          onError={(text) => setFlash({ type: "error", text })}
          onSaved={() => {
            setIsEditing(false);
            setFlash({ type: "success", text: "¡Préstamo y cronograma actualizados correctamente!" });
            fetchDetalle();
          }}
        />
      )}

      {isLiquidado && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-2xl flex items-center gap-2 text-emerald-900 shadow-sm">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          <div>
            <h3 className="text-sm font-extrabold">PRÉSTAMO LIQUIDADO ✅</h3>
            <p className="text-xs text-emerald-700">El cliente ha cancelado la totalidad del capital e intereses.</p>
          </div>
        </div>
      )}

      {isEstancado && (
        <div className="p-4 bg-rose-100 border border-rose-300 rounded-2xl flex items-center gap-2 text-rose-900 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-rose-600" />
          <div>
            <h3 className="text-sm font-extrabold">PRÉSTAMO ESTANCADO 🔴</h3>
            <p className="text-xs text-rose-700">El préstamo registra más de 2 meses consecutivos sin recibir abonos.</p>
          </div>
        </div>
      )}

      {/* Barra de estado actual */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard
          label="Capital Restante"
          value={money(resumen?.capitalRestante)}
          valueClass="text-slate-900"
          hint={`de ${money(prestamo.monto_capital)}`}
        />
        <StatCard label="Total Pagado Hasta Hoy" value={money(resumen?.totalPagado)} valueClass="text-emerald-600" />
        <StatCard
          label="Saldo Pendiente Total"
          value={money(resumen?.saldoPendiente)}
          valueClass="text-red-600"
          hint="Capital + Intereses"
        />
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Estado Actual</span>
          {isLiquidado ? (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600">
              <CheckCircle2 className="w-4 h-4" /> LIQUIDADO
            </span>
          ) : isEstancado ? (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-red-600">
              <AlertTriangle className="w-4 h-4" /> ESTANCADO
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-600">
              <Clock className="w-4 h-4" /> ACTIVO
            </span>
          )}
        </div>
      </div>

      {/* Formulario de pago + ajustes | Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-6">
          {!isLiquidado && (
            <RegistrarPagoPrestamoForm
              prestamoId={prestamo.id}
              prestamo={prestamo}
              resumen={resumen}
              deuda={deuda}
              onError={(text) => setFlash({ type: "error", text })}
              onSuccess={(text) => {
                setFlash({ type: "success", text });
                fetchDetalle();
              }}
            />
          )}

          <AjustesPrestamoPanel
            prestamoId={prestamo.id}
            ajustes={ajustes}
            totalCuotas={resumen?.totalCuotas || 1}
            onAjusteActualizado={fetchDetalle}
          />
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <TimelineDetallePrestamo
            timeline={timeline}
            onVerVoucher={(url) => setLightboxUrl(resolveVoucherUrl(url))}
            onVoucherAdjuntado={fetchDetalle}
            onEditarFechaPago={handleEditarFechaPago}
          />
        </div>
      </div>

      <VoucherLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
};

export default PrestamoDetalle;
