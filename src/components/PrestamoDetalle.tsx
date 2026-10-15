import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Wallet,
  ReceiptText,
  ShieldCheck,
  Settings2,
  AlertTriangle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { TimelineDetallePrestamo, TimelineMesItem } from "./prestamo/TimelineDetallePrestamo";
import { AjustesPrestamoPanel } from "./prestamo/AjustesPrestamoPanel";
import { RegistrarPagoPrestamoForm } from "./prestamo/RegistrarPagoPrestamoForm";
import { EditarPrestamoForm } from "./prestamo/EditarPrestamoForm";
import { PagosPrestamoList } from "./prestamo/PagosPrestamoList";
import { LoanHero } from "./prestamo/LoanHero";
import { VoucherLightbox } from "./common/VoucherLightbox";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { formatCurrency } from "../lib/formatters";

type Flash = { type: "success" | "error" | "info"; text: string } | null;

const FLASH_STYLES = {
  success: { box: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: CheckCircle2 },
  error: { box: "bg-red-50 border-red-200 text-red-700", icon: AlertCircle },
  info: { box: "bg-blue-50 border-blue-200 text-blue-800", icon: RefreshCw },
};

export const PrestamoDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [flash, setFlash] = useState<Flash>(null);
  const [isSyncingCal, setIsSyncingCal] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // Cambia tras cada guardado para reiniciar formularios con los datos nuevos
  const [version, setVersion] = useState(0);

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
      setData(await res.json());
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con el servidor");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetalle();
  }, [fetchDetalle]);

  const refrescar = useCallback(
    async (mensaje?: string) => {
      if (mensaje) setFlash({ type: "success", text: mensaje });
      await fetchDetalle();
      setVersion((v) => v + 1);
    },
    [fetchDetalle]
  );

  const handleSyncCalendar = async () => {
    setIsSyncingCal(true);
    setFlash(null);
    try {
      const res = await fetch("/api/calendar/sync-month", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      setFlash(
        res.ok && body.success
          ? { type: "info", text: "¡Calendario sincronizado correctamente!" }
          : { type: "error", text: "No se pudo sincronizar el calendario." }
      );
    } catch {
      setFlash({ type: "error", text: "Error de conexión al sincronizar calendario." });
    } finally {
      setIsSyncingCal(false);
    }
  };

  const prestamo = data?.prestamo;

  if (isLoading && !prestamo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-slate-500">Cargando préstamo...</p>
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
          ← Volver al inicio
        </button>
      </div>
    );
  }

  const { cliente, resumen, deuda, ajustes = [], pagosRealizados = [] } = data;
  const timeline: TimelineMesItem[] = data.timeline || [];
  const isLiquidado = prestamo.estado === "pagado" || prestamo.estado === "liquidado" || (resumen && resumen.saldoPendiente <= 0.01);
  const isEstancado = !isLiquidado && (deuda?.esEstancado || prestamo.estado === "estancado");
  const ajustesActivos = ajustes.filter((a: any) => a.activo).length;
  const mesesConProblema = timeline.filter((m) => ["SinPago", "Vencida", "PagoIncompleto"].includes(m.estado)).length;
  const FlashIcon = flash ? FLASH_STYLES[flash.type].icon : null;
  const clienteNombre = cliente?.nombre_completo || prestamo.cliente_nombre;

  return (
    <div className="space-y-4 pb-12 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 h-10 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors bg-transparent border-none cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        {isLoading && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" aria-label="Actualizando" />}
      </div>

      <LoanHero
        prestamo={prestamo}
        cliente={cliente}
        deuda={deuda}
        cuotaSiguiente={data.cuota_siguiente}
        ajustesActivos={ajustesActivos}
        isLiquidado={isLiquidado}
        isEstancado={isEstancado}
      />

      {isEstancado && (
        <p className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Lleva más de 2 meses consecutivos sin recibir abonos.
        </p>
      )}

      {flash && FlashIcon && (
        <div
          role={flash.type === "error" ? "alert" : "status"}
          className={`p-3 border rounded-xl flex items-center gap-2 text-xs font-medium ${FLASH_STYLES[flash.type].box}`}
        >
          <FlashIcon className="w-4 h-4 shrink-0" />
          <span className="flex-1">{flash.text}</span>
          <button type="button" onClick={() => setFlash(null)} aria-label="Cerrar mensaje" className="p-1 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/*
        En celular: una sola columna en este orden → Registrar pago, Cronograma, Pagos, Ajustes, Editar.
        En escritorio: dos columnas (acciones a la izquierda, historial a la derecha).
      */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start">
        <div className="contents lg:block lg:col-span-5 lg:space-y-4">
          {!isLiquidado && (
            <CollapsibleSection
              className="order-1"
              title="Registrar pago"
              icon={<Wallet className="w-4 h-4" />}
              defaultOpen
            >
              <RegistrarPagoPrestamoForm
                key={`pago-${version}`}
                prestamoId={prestamo.id}
                prestamo={prestamo}
                resumen={resumen}
                deuda={deuda}
                onError={(text) => setFlash({ type: "error", text })}
                onSuccess={(text) => refrescar(text)}
              />
            </CollapsibleSection>
          )}

          <CollapsibleSection
            className="order-4"
            title="Ajustes y facilidades"
            icon={<ShieldCheck className="w-4 h-4" />}
            aside={ajustesActivos > 0 ? `${ajustesActivos} activo${ajustesActivos > 1 ? "s" : ""}` : undefined}
          >
            <AjustesPrestamoPanel
              prestamoId={prestamo.id}
              ajustes={ajustes}
              totalCuotas={resumen?.totalCuotas || 1}
              onAjusteActualizado={fetchDetalle}
            />
          </CollapsibleSection>

          <CollapsibleSection className="order-5" title="Editar préstamo" icon={<Settings2 className="w-4 h-4" />}>
            <EditarPrestamoForm
              key={`edit-${version}`}
              prestamo={prestamo}
              onError={(text) => setFlash({ type: "error", text })}
              onSaved={() => refrescar("Préstamo actualizado y cronograma recalculado")}
              onSyncCalendar={handleSyncCalendar}
              isSyncingCalendar={isSyncingCal}
            />
          </CollapsibleSection>
        </div>

        <div className="contents lg:block lg:col-span-7 lg:space-y-4">
          <CollapsibleSection
            className="order-2"
            title="Cronograma mes a mes"
            icon={<CalendarDays className="w-4 h-4" />}
            aside={
              mesesConProblema > 0 ? (
                <span className="text-rose-600">
                  {mesesConProblema} con atraso
                </span>
              ) : (
                `${timeline.length} mes${timeline.length === 1 ? "" : "es"}`
              )
            }
            defaultOpen
          >
            <TimelineDetallePrestamo
              timeline={timeline}
              onVerVoucher={setLightboxUrl}
              onVoucherAdjuntado={fetchDetalle}
            />
          </CollapsibleSection>

          <CollapsibleSection
            className="order-3"
            title="Pagos registrados"
            icon={<ReceiptText className="w-4 h-4" />}
            aside={`${pagosRealizados.length} · ${formatCurrency(deuda?.totalPagado)}`}
          >
            <PagosPrestamoList
              pagos={pagosRealizados}
              prestamo={prestamo}
              clienteNombre={clienteNombre}
              onVerVoucher={setLightboxUrl}
              onChanged={() => refrescar()}
            />
          </CollapsibleSection>
        </div>
      </div>

      <VoucherLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
};

export default PrestamoDetalle;
