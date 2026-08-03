import React, { useState, useEffect, useCallback } from "react";
import { 
  ArrowLeft, Calendar, DollarSign, Edit3, RefreshCw, CheckCircle2, 
  AlertTriangle, ShieldCheck, Clock, FileText, Upload, Check, AlertCircle 
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { TimelineDetallePrestamo, TimelineMesItem } from "./prestamo/TimelineDetallePrestamo";
import { AjustesPrestamoPanel } from "./prestamo/AjustesPrestamoPanel";
import { subirVoucher } from "../lib/imageCompression";

export const PrestamoDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [prestamo, setPrestamo] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [resumen, setResumen] = useState<any>(null);
  const [timeline, setTimeline] = useState<TimelineMesItem[]>([]);
  const [ajustes, setAjustes] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Formulario Fijo de Registro de Pago (Sección 5.3.3)
  const [montoPago, setMontoPago] = useState("");
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split("T")[0]);
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [isSubmittingPago, setIsSubmittingPago] = useState(false);
  const [pagoErrorMsg, setPagoErrorMsg] = useState("");
  const [pagoSuccessMsg, setPagoSuccessMsg] = useState("");

  // Edición de Préstamo (Sección 5.3.4)
  const [isEditing, setIsEditing] = useState(false);
  const [editFechaVenc, setEditFechaVenc] = useState("");
  const [editTasa, setEditTasa] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Sincronizar Calendario
  const [isSyncingCal, setIsSyncingCal] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  // Lightbox de comprobante
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchDetalle = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/prestamos/${id}`);
      if (!res.ok) {
        throw new Error("No se pudo cargar el detalle del préstamo");
      }

      const data = await res.json();
      setPrestamo(data.prestamo || null);
      setCliente(data.cliente || null);
      setResumen(data.resumen || null);
      setTimeline(data.timeline || []);
      setAjustes(data.ajustes || []);

      if (data.prestamo) {
        setEditFechaVenc(data.prestamo.fecha_vencimiento || "");
        setEditTasa(String(data.prestamo.tasa_interes_porcentaje || 0));
        setEditNotas(data.prestamo.notas || "");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al conectar con el servidor");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetalle();
  }, [fetchDetalle]);

  const handlePagoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const montoNum = parseFloat(montoPago);
    if (!montoNum || montoNum <= 0) {
      setPagoErrorMsg("El monto a abonar debe ser mayor a 0");
      return;
    }

    setIsSubmittingPago(true);
    setPagoErrorMsg("");
    setPagoSuccessMsg("");

    try {
      let comprobanteUrl = "";

      if (comprobanteFile && prestamo) {
        const result = await subirVoucher(comprobanteFile);
        comprobanteUrl = result.url;
      }

      const res = await fetch(`/api/prestamos/${id}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: montoNum,
          fecha_pago: fechaPago,
          metodo_pago: metodoPago,
          comprobante_url: comprobanteUrl || null
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al registrar el pago");
      }

      setPagoSuccessMsg("¡Pago registrado correctamente!");
      setMontoPago("");
      setComprobanteFile(null);
      await fetchDetalle();
    } catch (err: any) {
      setPagoErrorMsg(err.message || "Ocurrió un error al registrar el pago");
    } finally {
      setIsSubmittingPago(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/prestamos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_vencimiento: editFechaVenc || null,
          tasa_interes_porcentaje: parseFloat(editTasa) || 0,
          notas: editNotas
        })
      });

      if (!res.ok) {
        throw new Error("No se pudo actualizar el préstamo");
      }

      setIsEditing(false);
      await fetchDetalle();
    } catch (err: any) {
      alert(err.message || "Error al guardar los cambios");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSyncCalendar = async () => {
    setIsSyncingCal(true);
    setSyncMsg("");
    try {
      const res = await fetch("/api/calendar/sync-month", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncMsg("¡Calendario sincronizado correctamente!");
      } else {
        setSyncMsg("No se pudo sincronizar el calendario.");
      }
    } catch {
      setSyncMsg("Error de conexión al sincronizar calendario.");
    } finally {
      setIsSyncingCal(false);
    }
  };

  if (isLoading) {
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

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Botón Volver y Cabecera Principal (Sección 5.2) */}
      <div className="space-y-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">
                PRÉSTAMO DE {cliente ? cliente.nombre_completo : prestamo.cliente_nombre}
              </h1>
              {cliente?.apodo && (
                <span className="text-sm font-semibold text-slate-500 italic">({cliente.apodo})</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Capital inicial: <span className="font-bold text-slate-800">S/ {prestamo.monto_capital.toFixed(2)}</span> | Tasa: <span className="font-bold text-slate-800">{prestamo.tasa_interes_porcentaje}%/mes</span> | {resumen?.totalCuotas || 1} cuotas
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Emisión: {prestamo.fecha_emision} | Vencimiento: {prestamo.fecha_vencimiento || "Indefinido"}
            </p>
          </div>

          {/* Menú de Acciones de Cabecera (Sección 5.3.4) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
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

      {syncMsg && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-medium">
          {syncMsg}
        </div>
      )}

      {/* Formulario de Edición de Préstamo (Inline) */}
      {isEditing && (
        <form onSubmit={handleSaveEdit} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs">
          <h4 className="font-bold text-slate-800">Editar Datos del Préstamo</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Fecha de Vencimiento</label>
              <input
                type="date"
                value={editFechaVenc}
                onChange={(e) => setEditFechaVenc(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Tasa Interés (%)</label>
              <input
                type="number"
                step="0.1"
                value={editTasa}
                onChange={(e) => setEditTasa(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Notas libres</label>
              <input
                type="text"
                value={editNotas}
                onChange={(e) => setEditNotas(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSavingEdit}
              className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              {isSavingEdit ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      )}

      {/* Banner de Estado "PRÉSTAMO LIQUIDADO" */}
      {isLiquidado && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-2xl flex items-center justify-between text-emerald-900 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <div>
              <h3 className="text-sm font-extrabold">PRÉSTAMO LIQUIDADO ✅</h3>
              <p className="text-xs text-emerald-700">El cliente ha cancelado la totalidad del capital e intereses.</p>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Estado Actual (Sección 5.2) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Capital Restante</span>
          <span className="text-lg font-extrabold text-slate-900">
            S/ {(resumen?.capitalRestante || 0).toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 block">de S/ {prestamo.monto_capital.toFixed(2)}</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Pagado Hasta Hoy</span>
          <span className="text-lg font-extrabold text-emerald-600">
            S/ {(resumen?.totalPagado || 0).toFixed(2)}
          </span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Saldo Pendiente Total</span>
          <span className="text-lg font-extrabold text-red-600">
            S/ {(resumen?.saldoPendiente || 0).toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-400 block">Capital + Intereses</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Estado Actual</span>
          <div>
            {isLiquidado ? (
              <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600">
                <CheckCircle2 className="w-4 h-4" /> LIQUIDADO
              </span>
            ) : resumen?.cuotasVencidas > 0 ? (
              <span className="inline-flex items-center gap-1 text-sm font-bold text-red-600">
                <AlertTriangle className="w-4 h-4" /> EN MORA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-600">
                <Clock className="w-4 h-4" /> ACTIVO
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grid Principal: Formulario Fijo de Registro de Pago + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (40% -> lg:col-span-5): Formulario Fijo de Nuevo Pago (5.3.3) y Ajustes (5.3.6) */}
        <div className="lg:col-span-5 space-y-6">
          {!isLiquidado && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Registrar Nuevo Pago</h3>
                  <p className="text-xs text-slate-500">Sección 5.3.3 — Abono directo a esta cuenta</p>
                </div>
              </div>

              {pagoErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pagoErrorMsg}</span>
                </div>
              )}

              {pagoSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{pagoSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handlePagoSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Monto del Abono (S/) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    placeholder="Ej: 300.00"
                    value={montoPago}
                    onChange={(e) => setMontoPago(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Fecha de Pago
                    </label>
                    <input
                      type="date"
                      value={fechaPago}
                      onChange={(e) => setFechaPago(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Método de Pago
                    </label>
                    <select
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Yape">Yape</option>
                      <option value="Plin">Plin</option>
                      <option value="Transferencia BCP">Transferencia BCP</option>
                      <option value="Transferencia BBVA">Transferencia BBVA</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Comprobante / Voucher (opcional)
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setComprobanteFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingPago}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingPago ? "Guardando Pago..." : "Guardar Pago y Actualizar"}
                </button>
              </form>
            </div>
          )}

          {/* Panel de Ajustes Simplificado (Sección 5.3.6) */}
          <AjustesPrestamoPanel
            prestamoId={prestamo.id}
            ajustes={ajustes}
            totalCuotas={resumen?.totalCuotas || 1}
            onAjusteActualizado={fetchDetalle}
          />
        </div>

        {/* Columna Derecha (60% -> lg:col-span-7): Timeline Cronológico Unificado (Sección 5.3.2) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <TimelineDetallePrestamo
            timeline={timeline}
            onVerVoucher={setLightboxUrl}
          />
        </div>
      </div>

      {/* Lightbox para Comprobante */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={lightboxUrl}
            alt="Comprobante"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

export default PrestamoDetalle;
