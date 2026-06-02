import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle, MessageSquare, Send, HeartHandshake } from "lucide-react";
import { usePrestamos } from "../hooks/usePrestamos";
import { usePagos } from "../hooks/usePagos";
import { buildPaymentSchedule } from "../lib/loanLogic";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { LoanHeader } from "../components/prestamo/LoanHeader";
import { PaymentScheduleTable } from "../components/prestamo/PaymentScheduleTable";
import { PaymentForm } from "../components/prestamo/PaymentForm";
import { PaymentHistory } from "../components/prestamo/PaymentHistory";
import { ProrrogaSection } from "../components/prestamo/ProrrogaSection";
import { VoucherGenerator } from "../components/prestamo/VoucherGenerator";

export const PrestamoDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const {
    loading,
    error: apiError,
    fetchLoanDetails,
    createAdjustment,
    toggleAdjustmentActive
  } = usePrestamos();

  const { registerPago } = usePagos();

  const [data, setData] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [nowTick, setNowTick] = useState(new Date());

  // Modals & Panels State
  const [showProrrogaModal, setShowProrrogaModal] = useState(false);
  const [selectedVoucherPago, setSelectedVoucherPago] = useState<any | null>(null);

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

  // Handle Payment Submit
  const handleRegisterPayment = async (payload: {
    monto: number;
    metodo_pago: string;
    fecha_pago: string;
    fileName?: string;
    mimeType?: string;
    base64Data?: string;
  }) => {
    if (!id) return false;
    let url: string | null = null;
    
    // Proactively upload voucher if attached
    if (payload.base64Data && payload.fileName && payload.mimeType) {
      try {
        const uploadRes = await fetch("/api/upload-voucher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: payload.fileName,
            mimeType: payload.mimeType,
            base64Data: payload.base64Data
          })
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          url = uploadData.publicUrl || null;
        }
      } catch (err) {
        console.error("Error al cargar voucher soporte:", err);
      }
    }
    
    const result = await registerPago(id, {
      monto: payload.monto,
      metodo_pago: payload.metodo_pago,
      fecha_pago: payload.fecha_pago,
      comprobante_url: url
    });
    
    if (result.success) {
      await loadData();
      return true;
    } else {
      alert(result.error || "No se pudo registrar la amortización.");
      return false;
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
        <h2 className="text-lg font-black text-white">Contrato no encontrado</h2>
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
      />

      {/* Main Content Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Columns: Payment Schedule & Payments History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cronograma de Cuotas */}
          <PaymentScheduleTable
            cuotas={schedule?.cuotas || []}
            loanState={prestamo.estado}
            onQuickAjuste={() => {}}
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
          />

          {/* Asistente de Cobros IA */}
          {isActivo && (
            <Card variant="simple" className="space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
              
              <h3 className="font-black text-white text-sm tracking-tight leading-none flex items-center gap-1.5 select-none">
                <span>🤖 Asistente de Cobros</span>
                <span className="badge bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 font-bold uppercase tracking-wider text-[8px] py-0.5 px-2">IA Gemini</span>
              </h3>
              
              <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                Genera textos persuasivos y amigables basados en el estado del préstamo o alquiler del cliente.
              </p>

              <div className="border-t border-white/[0.04] pt-2" />

              {aiError && (
                <p className="text-[10px] text-rose-455 font-bold leading-normal">⚠️ {aiError}</p>
              )}

              {aiMessage ? (
                <div className="space-y-3">
                  <div className="bg-white/[0.015] border border-white/[0.04] p-3 rounded-2xl text-xs font-semibold leading-relaxed text-slate-300 whitespace-pre-wrap font-mono">
                    {aiMessage}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSendWhatsApp}
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      icon={<MessageSquare size={13} />}
                    >
                      Enviar WhatsApp
                    </Button>
                    <Button
                      onClick={() => setAiMessage("")}
                      variant="secondary"
                      size="sm"
                    >
                      Limpiar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleGenerateAiMessage}
                  disabled={aiLoading}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  icon={aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                >
                  {aiLoading ? "Redactando recordatorio..." : "Generar Mensaje Cobranza"}
                </Button>
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
