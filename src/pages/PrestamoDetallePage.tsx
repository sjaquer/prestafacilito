import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle, MessageSquare, Send, HeartHandshake, Sparkles } from "lucide-react";
import { usePrestamos } from "../hooks/usePrestamos";
import { usePagos } from "../hooks/usePagos";
import { buildPaymentSchedule } from "../lib/loanLogic";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { LoanHeader } from "../components/prestamo/LoanHeader";
import { PaymentScheduleTable } from "../components/prestamo/PaymentScheduleTable";
import { PaymentForm } from "../components/prestamo/PaymentForm";
import { PaymentHistory } from "../components/prestamo/PaymentHistory";
import { ProrrogaSection } from "../components/prestamo/ProrrogaSection";
import { VoucherGenerator } from "../components/prestamo/VoucherGenerator";

import { useAuth } from "../hooks/useAuth";
import { generarMensajeCobroPredeterminado } from "../lib/formatters";

export const PrestamoDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const {
    loading,
    error: apiError,
    fetchLoanDetails,
    createAdjustment,
    toggleAdjustmentActive
  } = usePrestamos();

  const { registerPago, updatePagoFecha } = usePagos();

  const [data, setData] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [nowTick, setNowTick] = useState(new Date());

  // Modals & Panels State
  const [showProrrogaModal, setShowProrrogaModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVoucherPago, setSelectedVoucherPago] = useState<any | null>(null);

  // Edit Loan Parameters State
  const [editMonto, setEditMonto] = useState("");
  const [editTasa, setEditTasa] = useState("");
  const [editFechaEmision, setEditFechaEmision] = useState("");
  const [editFechaVencimiento, setEditFechaVencimiento] = useState("");
  const [editEstado, setEditEstado] = useState<"activo" | "pagado">("activo");
  const [editTipo, setEditTipo] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [updatingLoan, setUpdatingLoan] = useState(false);

  // IA Message State
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const loadData = useCallback(async () => {
    if (!id) return;
    const result = await fetchLoanDetails(id);
    if (result && result.success) {
      setData(result);
      const computed = buildPaymentSchedule(
        result.prestamo,
        result.pagosRealizados,
        result.ajustes,
        new Date()
      );
      setSchedule(computed);
    }
  }, [id, fetchLoanDetails]);

  useEffect(() => {
    loadData();
    // Keep date ticks up to date
    setNowTick(new Date());
  }, [loadData]);

  // Handle Prorroga Apply Callback
  const handleApplyProrroga = async (days: number, motif: string) => {
    if (!id || !data) return;
    
    // We register prorroga as a dynamic grace adjustment
    const payload = {
      tipo: "periodo_gracia",
      monto_afectado: 0,
      fecha_inicio: new Date().toISOString().split("T")[0],
      periodo_gracia_dias: days,
      descripcion: `Prórroga de gracia concedida: +${days} días.`,
      usuario: "Administración",
      motivo: motif
    };

    const result = await createAdjustment(id, payload);
    if (result.success) {
      setShowProrrogaModal(false);
      await loadData();
    } else {
      alert(result.error || "No se pudo aplicar la prórroga de gracia.");
    }
  };

  // Open Edit parameters modal pre-filled with current loan data
  const handleOpenEditModal = () => {
    if (!prestamo) return;
    setEditMonto(String(prestamo.monto_capital));
    setEditTasa(String(prestamo.tasa_interes_porcentaje));
    setEditFechaEmision(prestamo.fecha_emision);
    setEditFechaVencimiento(prestamo.fecha_vencimiento || "");
    setEditEstado(prestamo.estado);
    setEditTipo(prestamo.tipo_prestamo);
    setEditNotas(prestamo.notas || "");
    setShowEditModal(true);
  };

  // Submit parameter changes
  const handleUpdateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setUpdatingLoan(true);
    try {
      const res = await fetch(`/api/prestamos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto_capital: parseFloat(editMonto),
          tasa_interes_porcentaje: parseFloat(editTasa),
          fecha_emision: editFechaEmision,
          fecha_vencimiento: editFechaVencimiento || null,
          estado: editEstado,
          tipo_prestamo: editTipo,
          notas: editNotas
        })
      });
      if (res.ok) {
        setShowEditModal(false);
        await loadData();
      } else {
        const err = await res.json();
        alert(err.error || "Fallo al actualizar préstamo.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error de conexión al actualizar préstamo.");
    } finally {
      setUpdatingLoan(false);
    }
  };

  // Handle Payment Submit
  // Handle Payment Submit
  const handleRegisterPayment = async (payload: {
    monto: number;
    metodo_pago: string;
    fecha_pago: string;
    tipo_movimiento: string;
    vouchers?: Array<{ fileName: string; mimeType: string; base64Data: string }>;
  }) => {
    if (!id) return false;
    let urls: string[] = [];
    
    // Proactively upload all vouchers if attached
    if (payload.vouchers && payload.vouchers.length > 0) {
      try {
        const uploadPromises = payload.vouchers.map(async (vcr) => {
          const uploadRes = await fetch("/api/upload-voucher", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: vcr.fileName,
              mimeType: vcr.mimeType,
              base64Data: vcr.base64Data
            })
          });
          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            return uploadData.publicUrl || null;
          }
          return null;
        });

        const results = await Promise.all(uploadPromises);
        urls = results.filter((url): url is string => !!url);
      } catch (err) {
        console.error("Error al cargar vouchers soporte:", err);
      }
    }
    
    const comprobanteUrl = urls.length > 0 ? JSON.stringify(urls) : null;
    
    const result = await registerPago(id, {
      monto: payload.monto,
      metodo_pago: payload.metodo_pago,
      fecha_pago: payload.fecha_pago,
      tipo_movimiento: payload.tipo_movimiento,
      comprobante_url: comprobanteUrl
    });
    
    if (result.success) {
      await loadData();
      return true;
    } else {
      alert(result.error || "No se pudo registrar la amortización.");
      return false;
    }
  };

  const handleUpdateFechaPago = async (pagoId: string, nuevaFecha: string) => {
    const res = await updatePagoFecha(pagoId, nuevaFecha);
    if (res.success) {
      await loadData();
      return true;
    } else {
      alert(res.error || "No se pudo actualizar la fecha de pago.");
      return false;
    }
  };

  // Condonar interés rápido (Ajuste rápido)
  const handleQuickAjuste = async (cuotaNumero: number) => {
    if (!id) return;
    const confirm = window.confirm(`¿Estás seguro de que deseas condonar (eliminar) el interés de la Cuota #${cuotaNumero}? Esta acción se registrará en la auditoría.`);
    if (!confirm) return;

    const payload = {
      tipo: "eliminar_interes_cuota",
      monto_afectado: 0,
      cuota_numero: cuotaNumero,
      fecha_inicio: new Date().toISOString().split("T")[0],
      descripcion: `Condonación de interés de la Cuota #${cuotaNumero} (Ajuste rápido)`,
      usuario: "Administración",
      motivo: "Condonación rápida desde el cronograma de pagos."
    };

    const result = await createAdjustment(id, payload);
    if (result.success) {
      await loadData();
    } else {
      alert(result.error || "No se pudo condonar el interés de la cuota.");
    }
  };

  // Generate Gemini IA Recordatorio
  const handleGenerateAiMessage = async () => {
    if (!data?.prestamo || !schedule) return;
    setAiLoading(true);
    setAiError("");
    setAiMessage("");
    
    try {
      const res = await fetch("/api/ai/mensaje-cobro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNombre: data.prestamo.cliente_nombre,
          saldoPendiente: schedule.resumen.saldoPendiente,
          fechaVencimiento: data.prestamo.fecha_vencimiento
        })
      });
      
      const result = await res.json();
      if (res.ok) {
        setAiMessage(result.mensaje);
      } else {
        setAiError(result.error || "No se pudo generar el recordatorio inteligente.");
      }
    } catch (err) {
      setAiError("Error de conexión con la inteligencia artificial.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleGeneratePredefinedMessage = () => {
    if (!data?.prestamo || !schedule) return;

    const nextCuota = schedule.cuotaSiguiente;
    const unpaidCuotas = schedule.cuotas.filter((c: any) => c.estado !== "Saldada");
    const isMora = schedule.resumen.moraAcumulada > 0;
    const amount = isMora 
      ? schedule.resumen.saldoPendiente
      : (nextCuota?.montoExigible || schedule.resumen.saldoPendiente || 0);

    const dueDate = nextCuota?.fechaVencimiento || data.prestamo.fecha_vencimiento;
    const cuotasAtrasadas = unpaidCuotas.filter((c: any) => c.estado === "Vencida").length;

    const msg = generarMensajeCobroPredeterminado({
      clienteNombre: data.prestamo.cliente_nombre,
      tipoPrestamo: data.prestamo.tipo_prestamo,
      remitenteRaw: user,
      monto: amount,
      fechaVencimiento: dueDate,
      estadoCuotaMes: isMora ? "mora_mes" : "pendiente_mes",
      cuotasAtrasadas: cuotasAtrasadas || undefined
    });

    setAiMessage(msg);
    setAiError("");
  };

  const handleSendWhatsApp = () => {
    if (!data?.prestamo || !aiMessage) return;
    const phone = data.prestamo.cliente_telefono?.replace(/[^\d+]/g, "") || "";
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(aiMessage)}`, "_blank");
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="animate-spin text-indigo-400 mb-3" size={32} />
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cargando expediente de deuda...</p>
      </div>
    );
  }

  if (apiError || !data) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/15 rounded-3xl flex items-center justify-center mx-auto text-rose-400 shadow-md select-none">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-lg font-black text-slate-900">Contrato no encontrado</h2>
        <p className="text-xs text-slate-500 font-semibold leading-relaxed">
          {apiError || "No se localizó el contrato solicitado."}
        </p>
        <Button
          onClick={() => navigate("/")}
          variant="secondary"
          size="sm"
        >
          Volver a Cartera
        </Button>
      </div>
    );
  }

  const { prestamo, pagosRealizados = [], ajustes = [], planAyuda } = data;
  const isActivo = prestamo.estado === "activo";

    return (
    <div className="space-y-6 select-none">
      {/* Header Info */}
      <LoanHeader
        prestamo={prestamo}
        deuda={schedule?.resumen || {}}
        planAyuda={planAyuda}
        onBack={() => navigate("/")}
        onEdit={handleOpenEditModal}
        onProrroga={() => setShowProrrogaModal(true)}
      />

      {/* Main Content Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Columns: Payment Schedule & Payments History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cronograma de Cuotas */}
          <PaymentScheduleTable
            cuotas={schedule?.cuotas || []}
            loanState={prestamo.estado}
            onQuickAjuste={handleQuickAjuste}
            loanType={prestamo.tipo_prestamo}
          />

          {/* Historial de Amortizaciones */}
          <PaymentHistory
            pagos={pagosRealizados}
            prestamo={prestamo}
            onVoucherClick={(pago) => setSelectedVoucherPago(pago)}
            onViewComprobante={(url) => window.open(url, "_blank")}
            resolveVoucherUrl={(url) => {
              if (!url) return "";
              if (url.startsWith("/api/vouchers/proxy/")) return url;
              const match = url.match(/(?:\/file\/d\/|\?id=)([a-zA-Z0-9_-]+)/);
              if (match && match[1]) {
                return `/api/vouchers/proxy/${match[1]}`;
              }
              return url;
            }}
            onUpdateFechaPago={handleUpdateFechaPago}
          />
        </div>

        {/* Right Column: Record payment & IA Assistance */}
        <div className="space-y-6">
          {/* Formulario de Pago */}
          <PaymentForm
            expectedAmount={schedule?.cuotaSiguiente?.montoExigible || 0}
            saldoPendiente={schedule?.resumen.saldoPendiente || 0}
            onSubmit={handleRegisterPayment}
            loanType={prestamo.tipo_prestamo}
            debtState={schedule}
          />

          {/* Notas y Observaciones del Contrato */}
          <Card variant="simple" className="space-y-3 relative overflow-hidden">
            <div className="flex justify-between items-center select-none">
              <h3 className="font-black text-slate-800 text-sm tracking-tight leading-none">
                📝 Notas y Observaciones
              </h3>
              <Button variant="secondary" size="sm" onClick={handleOpenEditModal} className="font-bold">
                Editar
              </Button>
            </div>
            <div className="border-t border-slate-200/65 pt-2" />
            {prestamo.notas ? (
              <p className="text-xs text-slate-655 bg-slate-50 border border-slate-200/70 p-3.5 rounded-2xl whitespace-pre-wrap font-mono leading-relaxed">
                {prestamo.notas}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic font-medium leading-relaxed">
                Sin notas registradas para este contrato. Haz clic en Editar para agregar una.
              </p>
            )}
          </Card>

          {/* Asistente de Cobros */}
          {isActivo && (
            <Card variant="simple" className="space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
              
              <h3 className="font-black text-slate-800 text-sm tracking-tight leading-none flex items-center gap-1.5 select-none">
                <span>🤖 Asistente de Cobros</span>
              </h3>
              
              <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                Genera textos amigables y profesionales basados en el estado del préstamo o alquiler del cliente.
              </p>

              <div className="border-t border-slate-200/65 pt-2" />

              {aiError && (
                <p className="text-[10px] text-rose-600 font-bold leading-normal">⚠️ {aiError}</p>
              )}

              {aiMessage ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-xs font-semibold leading-relaxed text-slate-700 whitespace-pre-wrap font-mono">
                    {aiMessage}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendWhatsApp}
                      variant="primary"
                      size="sm"
                      className="flex-1 font-bold"
                      icon={<MessageSquare size={13} />}
                    >
                      Enviar WhatsApp
                    </Button>
                    <Button
                      onClick={() => setAiMessage("")}
                      variant="secondary"
                      size="sm"
                      className="font-bold"
                    >
                      Limpiar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleGeneratePredefinedMessage}
                    variant="primary"
                    size="sm"
                    className="w-full font-bold"
                    icon={<Send size={13} />}
                  >
                    Mensaje Predeterminado
                  </Button>
                  <Button
                    onClick={handleGenerateAiMessage}
                    disabled={aiLoading}
                    variant="secondary"
                    size="sm"
                    className="w-full font-bold"
                    icon={aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  >
                    {aiLoading ? "Redactando..." : "Generar con IA"}
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Modal de Prórroga */}
      <Modal
        isOpen={showProrrogaModal}
        onClose={() => setShowProrrogaModal(false)}
        title="Conceder Prórroga Extraordinaria"
        size="sm"
      >
        <ProrrogaSection
          prestamo={prestamo}
          cuotas={schedule?.cuotas || []}
          ajustes={ajustes}
          onApplyProrroga={async (val) => {
            await handleApplyProrroga(val.dias, val.motivo);
            return true;
          }}
        />
      </Modal>

      {/* Modal de Edición de Parámetros del Contrato */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar Parámetros del Contrato"
        size="md"
      >
        <form onSubmit={handleUpdateLoan} className="space-y-4 font-sans select-none text-xs">
          <Input
            label="Capital / Monto Contratado"
            type="number"
            step="0.01"
            required
            value={editMonto}
            onChange={(e) => setEditMonto(e.target.value)}
          />
          <Input
            label="Tasa de Interés Mensual (%)"
            type="number"
            step="0.1"
            required
            value={editTasa}
            onChange={(e) => setEditTasa(e.target.value)}
          />
          <Input
            label="Fecha de Emisión"
            type="date"
            required
            value={editFechaEmision}
            onChange={(e) => setEditFechaEmision(e.target.value)}
          />
          <Input
            label="Fecha de Vencimiento"
            type="date"
            value={editFechaVencimiento}
            onChange={(e) => setEditFechaVencimiento(e.target.value)}
          />
          
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] md:text-[12px] font-black text-slate-500 uppercase tracking-wider block">
              Estado del Contrato
            </label>
            <select
              value={editEstado}
              onChange={(e) => setEditEstado(e.target.value as any)}
              className="glass-input w-full px-4 rounded-xl border border-slate-200 font-medium bg-white text-slate-800 cursor-pointer h-12 text-sm"
            >
              <option value="activo">Activo</option>
              <option value="pagado">Pagado</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] md:text-[12px] font-black text-slate-500 uppercase tracking-wider block">
              Tipo de Préstamo
            </label>
            <select
              value={editTipo}
              onChange={(e) => setEditTipo(e.target.value)}
              className="glass-input w-full px-4 rounded-xl border border-slate-200 font-medium bg-white text-slate-800 cursor-pointer h-12 text-sm"
            >
              <option value="Personal">Personal</option>
              <option value="Negocio">Negocio</option>
              <option value="Alquiler de Casa">Alquiler de Casa</option>
              <option value="Hipotecario">Hipotecario</option>
              <option value="Garantía">Garantía</option>
              <option value="Otros">Otros</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[11px] md:text-[12px] font-black text-slate-500 uppercase tracking-wider block">
              Notas y Observaciones
            </label>
            <textarea
              value={editNotas}
              onChange={(e) => setEditNotas(e.target.value)}
              rows={4}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none resize-none font-medium"
              placeholder="Agrega notas u observaciones sobre este contrato..."
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 font-bold"
              onClick={() => setShowEditModal(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1 font-bold animate-shimmer"
              disabled={updatingLoan}
            >
              {updatingLoan ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Lightbox Voucher Receipt Generator */}
      {selectedVoucherPago && (
        <VoucherGenerator
          isOpen={!!selectedVoucherPago}
          onClose={() => setSelectedVoucherPago(null)}
          pago={selectedVoucherPago}
          prestamo={prestamo}
        />
      )}
    </div>
  );
};
