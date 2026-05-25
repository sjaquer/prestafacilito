import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, 
  CreditCard, 
  CheckCircle2, 
  Landmark, 
  Coins, 
  Loader2, 
  HandCoins, 
  Send, 
  Sparkles, 
  AlertCircle, 
  X,
  Image,
  ExternalLink,
  UploadCloud,
  Calendar,
  Scissors,
  Snowflake,
  Pencil,
  WifiOff,
  ServerCrash
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { buildPaymentSchedule } from "../lib/loanLogic";
import { AjustePrestamo, PlanAyudaCliente } from "../types";
import { METODOS_PAGO } from "../lib/constants";

const resolveVoucherUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("/api/vouchers/proxy/")) return url;
  
  // Extract File ID from Google Drive URL if applicable
  const match = url.match(/(?:\/file\/d\/|\?id=)([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `/api/vouchers/proxy/${match[1]}`;
  }
  
  return url;
};

interface PrestamoDetalleProps {
  loanId: string;
  onBack: () => void;
}

export function PrestamoDetalle({ loanId, onBack }: PrestamoDetalleProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulario de Pago / Amortización
  const [monto, setMonto] = useState("");
  const [metodoPago, setMetodoPago] = useState("Yape");
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [pagoSuccess, setPagoSuccess] = useState("");

  // Estados para Voucher
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [comprobanteName, setComprobanteName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [voucherError, setVoucherError] = useState("");
  const [voucherUpdatingId, setVoucherUpdatingId] = useState<string | null>(null);
  const [voucherUpdateError, setVoucherUpdateError] = useState("");
  const voucherInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [activePastePagoId, setActivePastePagoId] = useState<string | null>(null);

  // Plan de Ayuda al Cliente - Estados
  const [showAyudaModal, setShowAyudaModal] = useState(false);
  const [isQuickAjuste, setIsQuickAjuste] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [ayudaSubmitting, setAyudaSubmitting] = useState(false);
  const [ayudaError, setAyudaError] = useState("");
  
  // Formulario del nuevo ajuste
  const [ajusteTipo, setAjusteTipo] = useState<'congelar_interes_temporal' | 'congelar_interes_permanente' | 'eliminar_interes_cuota' | 'reducir_mora' | 'eliminar_mora'>("eliminar_interes_cuota");
  const [ajusteMontoAfectado, setAjusteMontoAfectado] = useState("");
  const [ajusteMontoAntes, setAjusteMontoAntes] = useState("");
  const [ajusteMontoDespues, setAjusteMontoDespues] = useState("");
  const [ajusteCuotaNumero, setAjusteCuotaNumero] = useState("");
  const [ajusteFechaInicio, setAjusteFechaInicio] = useState(new Date().toISOString().split("T")[0]);
  const [ajusteFechaFin, setAjusteFechaFin] = useState("");
  const [ajustePeriodoGraciaDias, setAjustePeriodoGraciaDias] = useState("7");
  const [ajusteDescripcion, setAjusteDescripcion] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");
  // Cuota seleccionada para accion rapida desde el cronograma
  const [quickAjusteCuotaLocked, setQuickAjusteCuotaLocked] = useState(false);

  const handleCreateAjuste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ajusteMotivo.trim()) {
      setAyudaError("El motivo del ajuste es obligatorio.");
      return;
    }

    try {
      setAyudaSubmitting(true);
      setAyudaError("");

      const body = {
        tipo: ajusteTipo,
        monto_afectado: parseFloat(ajusteMontoAfectado) || 0,
        monto_antes: parseFloat(ajusteMontoAntes) || 0,
        monto_despues: parseFloat(ajusteMontoDespues) || 0,
        cuota_numero: ajusteCuotaNumero ? parseInt(ajusteCuotaNumero) : null,
        fecha_inicio: ajusteFechaInicio,
        fecha_fin: ajusteFechaFin || null,
        periodo_gracia_dias: parseInt(ajustePeriodoGraciaDias) || 0,
        descripcion: ajusteDescripcion,
        motivo: ajusteMotivo
      };

      const res = await fetch(`/api/prestamos/${loanId}/ajustes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const result = await res.json();
      if (res.ok) {
        setShowAyudaModal(false);
        // Reset form
        setAjusteTipo("eliminar_interes_cuota");
        setAjusteMontoAfectado("");
        setAjusteMontoAntes("");
        setAjusteMontoDespues("");
        setAjusteCuotaNumero("");
        setAjusteFechaInicio(new Date().toISOString().split("T")[0]);
        setAjusteFechaFin("");
        setAjustePeriodoGraciaDias("7");
        setAjusteDescripcion("");
        setAjusteMotivo("");
        // Reload details
        await fetchLoanDetails();
      } else {
        setAyudaError(result.error || "No se pudo aplicar el ajuste.");
      }
    } catch (err) {
      setAyudaError("Error de red al aplicar el ajuste.");
    } finally {
      setAyudaSubmitting(false);
    }
  };

  const handleToggleAjuste = async (ajusteId: string, currentActive: boolean) => {
    if (!confirm(`¿Estás seguro de que deseas ${currentActive ? 'desactivar' : 'activar'} este ajuste?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/prestamos/${loanId}/ajustes/${ajusteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !currentActive })
      });

      if (res.ok) {
        await fetchLoanDetails();
      } else {
        const result = await res.json();
        alert(result.error || "No se pudo cambiar el estado del ajuste.");
      }
    } catch (err) {
      alert("Error de red al cambiar el estado del ajuste.");
    }
  };

  // Subida de Voucher a Google Drive (Core)
  const uploadVoucherFile = async (file: File) => {
    setUploadStatus("uploading");
    setComprobanteName(file.name || "voucher_pasted.png");
    setComprobanteUrl("");
    setVoucherError("");

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(",")[1];
        const uploadRes = await fetch("/api/upload-voucher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name || "voucher_pasted.png",
            mimeType: file.type || "image/png",
            base64Data
          })
        });

        const errData = await uploadRes.json().catch(() => ({}));

        if (uploadRes.ok) {
          if (errData?.publicUrl) {
            setComprobanteUrl(errData.publicUrl);
            setUploadStatus("done");
          } else {
            setVoucherError("La subida se completo, pero no se recibio la URL del voucher.");
            setUploadStatus("error");
          }
        } else if (uploadRes.status === 503) {
          // Drive no configurado
          setVoucherError("Google Drive no esta configurado en el servidor. Registra el pago sin voucher y adjuntalo luego.");
          setUploadStatus("error");
        } else if (uploadRes.status === 502) {
          // Drive fallo al subir
          setVoucherError("No se pudo conectar a Google Drive. Registra el pago sin voucher y adjuntalo luego.");
          setUploadStatus("error");
        } else {
          setVoucherError(errData?.error || "No se pudo subir el voucher. Puedes registrar el pago sin el.");
          setUploadStatus("error");
        }
      } catch (uploadErr) {
        console.error("Error de red al subir el voucher:", uploadErr);
        setVoucherError("Error de red al subir el voucher. Puedes registrar el pago sin el.");
        setUploadStatus("error");
      }
    };
    reader.onerror = () => {
      setVoucherError("No se pudo leer el archivo seleccionado.");
      setUploadStatus("error");
    };
    reader.readAsDataURL(file);
  };

  // Subida de Voucher desde selector clásico
  const handleVoucherUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadVoucherFile(file);
  };

  // Estados para el Asistente de Cobro por IA (Gemini)
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchLoanDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/prestamos/${loanId}`);
      const result = await res.json();
      if (res.ok) {
        setData(result);
      } else {
        setError(result.error || "No se pudo recuperar la información del préstamo.");
      }
    } catch (err) {
      setError("Error de comunicación con el backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoanDetails();
  }, [loanId]);

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monto || parseFloat(monto) <= 0) {
      alert("Por favor ingresa un monto válido.");
      return;
    }

    setSubmitting(true);
    setPagoSuccess("");
    try {
      const res = await fetch(`/api/prestamos/${loanId}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: parseFloat(monto),
          metodo_pago: metodoPago,
          fecha_pago: fechaPago,
          comprobante_url: comprobanteUrl || null
        })
      });

      if (res.ok) {
        setPagoSuccess("¡Pago registrado con éxito!");
        setMonto("");
        setComprobanteUrl("");
        setComprobanteName("");
        // Recargar info
        await fetchLoanDetails();
        
        // Limpiar mensaje
        setTimeout(() => setPagoSuccess(""), 4000);
      } else {
        const errData = await res.json();
        alert(errData.error || "Error al aplicar el pago.");
      }
    } catch (err) {
      alert("Error al conectar de red con el backend.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoucherUpdate = async (pagoId: string, file: File) => {
    if (!file) return;
    setVoucherUpdatingId(pagoId);
    setVoucherUpdateError("");

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(",")[1];
        const res = await fetch(`/api/amortizaciones/${pagoId}/voucher`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "image/jpeg",
            base64Data
          })
        });

        const errData = await res.json().catch(() => ({}));

        if (res.ok) {
          await fetchLoanDetails();
        } else if (res.status === 503) {
          setVoucherUpdateError("Google Drive no esta configurado. Consulta al administrador del sistema.");
        } else if (res.status === 502) {
          setVoucherUpdateError("No se pudo conectar a Google Drive. Intenta nuevamente en unos minutos.");
        } else {
          setVoucherUpdateError(errData?.error || "No se pudo adjuntar el voucher.");
        }
      } catch (err) {
        console.error("Error al adjuntar voucher:", err);
        setVoucherUpdateError("Error de red al adjuntar el voucher.");
      } finally {
        setVoucherUpdatingId(null);
      }
    };

    reader.onerror = () => {
      setVoucherUpdatingId(null);
      setVoucherUpdateError("No se pudo leer el archivo seleccionado.");
    };

    reader.readAsDataURL(file);
  };

  // Abrir modal de ajuste rapido pre-completado desde una cuota del cronograma
  const handleQuickAjuste = (
    cuotaNumero: number,
    tipo: 'eliminar_interes_cuota' | 'congelar_interes_temporal' | 'congelar_interes_permanente' | 'reducir_mora' | 'eliminar_mora'
  ) => {
    setIsQuickAjuste(true);
    setAjusteTipo(tipo);
    setAjusteCuotaNumero(tipo === 'eliminar_interes_cuota' || tipo === 'reducir_mora' ? String(cuotaNumero) : "");
    setAjusteFechaInicio(new Date().toISOString().split("T")[0]);
    setAjusteFechaFin("");
    setAjusteMontoAfectado(tipo === 'reducir_mora' ? "100" : "");
    setAjusteMontoAntes("");
    setAjusteMontoDespues("");
    setAjusteDescripcion(
      tipo === 'eliminar_interes_cuota'
        ? `Condonación interés Cuota #${cuotaNumero}`
        : tipo === 'congelar_interes_temporal'
        ? `Congelar interés desde Cuota #${cuotaNumero}`
        : `Reducir mora Cuota #${cuotaNumero}`
    );
    setAjusteMotivo("");
    setAyudaError("");
    setShowAyudaModal(true);
  };

  // Escuchar pegado de voucher desde portapapeles
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items || []);
      const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
      const file = imageItem?.getAsFile() || event.clipboardData?.files?.[0] || null;

      if (file && file.type.startsWith("image/")) {
        event.preventDefault();
        if (activePastePagoId) {
          handleVoucherUpdate(activePastePagoId, file);
        } else {
          uploadVoucherFile(file);
        }
      }
    };

    window.addEventListener("paste", onPaste as unknown as EventListener);
    return () => window.removeEventListener("paste", onPaste as unknown as EventListener);
  }, [activePastePagoId]);

  // Generador de Mensaje de Cobro con Gemini
  const handleGenerateAiMessage = async () => {
    if (!data?.prestamo) return;
    setAiLoading(true);
    setAiError(null);
    setAiMessage("");
    
    try {
      const res = await fetch("/api/ai/mensaje-cobro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNombre: data.prestamo.cliente_nombre,
          saldoPendiente: resumenDeuda.saldoPendiente,
          fechaVencimiento: data.prestamo.fecha_vencimiento
        })
      });
      
      const result = await res.json();
      if (res.ok) {
        setAiMessage(result.mensaje);
      } else {
        setAiError(result.error || "Error al generar el recordatorio con IA.");
      }
    } catch (err) {
      setAiError("Error de conexión con el servidor.");
    } finally {
      setAiLoading(false);
    }
  };

  // Abrir WhatsApp con el mensaje
  const handleSendWhatsApp = () => {
    if (!data?.prestamo || !aiMessage) return;
    const rawPhone = data.prestamo.cliente_telefono || "";
    // Limpiar caracteres que no sean números
    const sanitizedPhone = rawPhone.replace(/[^\d+]/g, "");
    const encodedMsg = encodeURIComponent(aiMessage);
    const waUrl = `https://wa.me/${sanitizedPhone}?text=${encodedMsg}`;
    window.open(waUrl, "_blank");
  };

  // Copiar mensaje al portapapeles
  const handleCopyMessage = async () => {
    if (!aiMessage) return;
    try {
      await navigator.clipboard.writeText(aiMessage);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch (err) {
      console.error("No se pudo copiar el texto", err);
    }
  };

  const handleShareReceipt = (pago: any) => {
    if (!data?.prestamo) return;
    const prestamoObj = data.prestamo;
    const rawPhone = prestamoObj.cliente_telefono || "";
    const sanitizedPhone = rawPhone.replace(/[^\d+]/g, "");
    const msg = `*Constancia de Pago* 📋✨\n\n` +
      `Estimado(a) *${prestamoObj.cliente_nombre}*,\n` +
      `Confirmamos el registro exitoso de tu abono:\n\n` +
      `💵 *Monto:* ${formatCurrency(parseFloat(pago.monto))}\n` +
      `📅 *Fecha:* ${pago.fecha_pago}\n` +
      `💳 *Método de Pago:* ${pago.metodo_pago}\n` +
      `✍️ *Aplicacion:* ${getAplicacionLabel(pago)}\n\n` +
      `📉 *Saldo Restante Actual:* ${formatCurrency(prestamoObj.saldo_pendiente)}\n\n` +
      `¡Muchas gracias por tu puntualidad y confianza! 🤝`;
    const waUrl = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };

  const handleShareDisbursement = () => {
    if (!data?.prestamo) return;
    const prestamoObj = data.prestamo;
    const rawPhone = prestamoObj.cliente_telefono || "";
    const sanitizedPhone = rawPhone.replace(/[^\d+]/g, "");
    const msg = `*Detalles del Préstamo Otorgado* 💸✨\n\n` +
      `Estimado(a) *${prestamoObj.cliente_nombre}*,\n` +
      `Nos complace confirmar el desembolso de tu crédito:\n\n` +
      `💰 *Monto Capital:* ${formatCurrency(prestamoObj.monto_capital)}\n` +
      `📈 *Tasa de Interés:* ${prestamoObj.tasa_interes_porcentaje}%\n` +
      `💵 *Total Exigible:* ${formatCurrency(prestamoObj.total_exigible_actual || prestamoObj.total_a_pagar)}\n` +
      `📅 *Fecha de Emisión:* ${prestamoObj.fecha_emision}\n` +
      `📅 *Fecha de Vencimiento:* ${prestamoObj.fecha_vencimiento || "No establecida"}\n\n` +
      `Recuerda que tus pagos se pueden realizar a través de transferencia bancaria o billeteras digitales como Yape o Plin. ¡Estamos para servirte! 🤝`;
    const waUrl = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };

  // Formateador de moneda en Soles Peruanos (S/.)
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatMonthYear = (dateValue: string) => {
    const parsed = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return "Periodo sin fecha";
    const raw = parsed.toLocaleString("es-ES", { month: "long", year: "numeric" });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const getAplicacionLabel = (pago: any) => {
    const period = formatMonthYear(pago.fecha_pago);
    const tipo = String(pago.tipo_movimiento || "").toLowerCase();

    if (tipo.includes("liquidacion") || tipo.includes("liquidación")) {
      return "Liquidacion total";
    }
    if (tipo.includes("parcial")) {
      return `Amortizacion parcial ${period}`;
    }
    if (tipo.includes("adelantado")) {
      return `Pago adelantado ${period}`;
    }
    if (tipo.includes("exacto")) {
      return `Pago aplicado a ${period}`;
    }

    return `Pago aplicado a ${period}`;
  };

  if (loading) {
    return (
      <div id="loan-details-loader" className="flex flex-col items-center justify-center p-12 min-h-[450px]">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={44} />
        <p className="text-gray-400 font-bold text-sm tracking-wide  uppercase">Calculando amortización...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div id="loan-details-error-view" className="p-8 bento-card rounded-3xl max-w-lg mx-auto text-center space-y-5">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center text-red-400 mx-auto shadow-lg">
          <X size={32} />
        </div>
        <h3 className="font-extrabold text-slate-100 text-lg">Error al cargar detalles</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{error || "No se encontró información del préstamo."}</p>
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          Volver al Dashboard
        </button>
      </div>
    );
  }

  const { prestamo, pagosRealizados, ajustes = [], planAyuda } = data;
  const debtState = buildPaymentSchedule(prestamo, pagosRealizados, ajustes, new Date());
  const resumenDeuda = debtState.resumen;
  const cuotaSiguiente = debtState.cuotaSiguiente;
  const progressPercent = Math.min(100, resumenDeuda.totalExigible > 0 ? (resumenDeuda.totalPagado / resumenDeuda.totalExigible) * 100 : 0);
  const deudaTotalActual = resumenDeuda.totalExigible || prestamo.total_exigible_actual || prestamo.total_a_pagar;
  const cuotaRapida = cuotaSiguiente ? Math.min(resumenDeuda.saldoPendiente, cuotaSiguiente.montoExigible) : resumenDeuda.saldoPendiente;
  const interesMensual = (prestamo.monto_capital * prestamo.tasa_interes_porcentaje) / 100;

  return (
    <div id="loan-details-view" className="space-y-6 font-sans">
      
      {/* Botón Volver */}
      <div className="flex justify-between items-center">
        <button
          id="btn-back-to-dashboard"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-blue-400 transition cursor-pointer group py-2"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Volver al Panel Principal</span>
        </button>
      </div>

      {/* Header Info Principal - Bento Glass */}
      <div id="loan-header-card" className="bento-card p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2.5 h-full bg-gradient-to-b from-indigo-500 to-indigo-600" />
        <div className="space-y-2 pl-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[10px] bg-white/[0.03] text-indigo-300 border border-white/5 px-3 py-1 rounded-lg font-mono uppercase tracking-wider font-bold">
              ID: {prestamo.id.substring(0, 8)}
            </span>
            <span
              className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                prestamo.estado === "activo"
                  ? "bg-emerald-500/10 text-green-400 border border-emerald-500/20"
                  : "bg-slate-800 text-gray-400 border border-slate-700"
              }`}
            >
              {prestamo.estado === "activo" ? "Activo / Cobranza" : "Cancelado"}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none mt-1">
            {prestamo.cliente_nombre}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-bold uppercase tracking-wider">
              <Landmark size={14} className="text-blue-400" />
              <span>Préstamo {prestamo.tipo_prestamo}</span>
            </div>
            <button
              onClick={handleShareDisbursement}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-green-400 hover:bg-emerald-500/20 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors ml-4 cursor-pointer"
            >
              <Send size={11} />
              <span>Compartir Desembolso</span>
            </button>
          </div>
        </div>

        <div className="text-left md:text-right border-t border-white/5 md:border-0 pt-4 md:pt-0 w-full md:w-auto">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Saldo por Amortizar</span>
          <p className="text-3xl md:text-4xl font-black text-blue-400 mt-1 tracking-tight font-mono">
            {formatCurrency(resumenDeuda.saldoPendiente)}
          </p>
        </div>
      </div>

      {/* Grid Bento del Préstamo */}
      <div id="loan-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Infografía de Estado Financiero & Progreso - Columna 2/3 */}
        <div id="financial-info-card" className="bento-card p-6 rounded-3xl space-y-6 lg:col-span-2 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5">
              <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                <CreditCard size={16} />
              </div>
              <h2 className="font-extrabold text-white text-base tracking-tight">
                Estado Financiero del Préstamo
              </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/[0.04] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Capital recibido</span>
                <span className="text-lg font-black text-slate-200 font-mono">{formatCurrency(prestamo.monto_capital)}</span>
              </div>
              <div className="bg-white/[0.04] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Interes mensual</span>
                <span className="text-lg font-black text-slate-200 font-mono">{formatCurrency(interesMensual)}</span>
                <span className="text-[10px] text-slate-500 font-semibold block mt-1">Tasa {prestamo.tasa_interes_porcentaje}%</span>
              </div>
              <div className="bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block mb-1">Total exigible actualizado</span>
                <span className="text-lg font-black text-blue-400 font-mono">{formatCurrency(deudaTotalActual)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Capital pendiente</span>
                <span className="text-2xl font-black text-slate-100 font-mono">{formatCurrency(resumenDeuda.capitalPendiente)}</span>
              </div>
              <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Cuotas vencidas</span>
                <span className="text-2xl font-black text-rose-400 font-mono">{resumenDeuda.cuotasVencidas}</span>
              </div>
              <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Cuotas pendientes</span>
                <span className="text-2xl font-black text-amber-400 font-mono">{resumenDeuda.cuotasPendientes}</span>
              </div>
              <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Mora acumulada</span>
                <span className="text-2xl font-black text-orange-400 font-mono">{formatCurrency(resumenDeuda.moraAcumulada)}</span>
              </div>
            </div>

            {/* Barra de Progreso */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold text-slate-350">
                <span>Porcentaje Amortizado</span>
                <span className="font-mono text-green-400">{progressPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-white/[0.03] h-4 rounded-full overflow-hidden p-0.5 border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full" 
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider pt-1">
                <span>Pagado: {formatCurrency(resumenDeuda.totalPagado)}</span>
                <span>Pendiente: {formatCurrency(resumenDeuda.saldoPendiente)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Formulario Registrar Pago - Columna 1/3 */}
        <div id="payment-form-card" className="bento-card p-6 rounded-3xl h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-green-400">
              <HandCoins size={16} />
            </div>
            <h2 className="font-extrabold text-white text-base tracking-tight">Abonar a Cuenta</h2>
          </div>

          {prestamo.estado === "pagado" ? (
            <div className="p-6 bg-emerald-500/5 text-green-400 rounded-2xl text-center text-xs space-y-3 border border-emerald-500/10">
              <CheckCircle2 className="text-green-400 mx-auto" size={32} />
              <p className="font-extrabold text-slate-100 text-sm">Crédito Cancelado</p>
              <p className="leading-relaxed text-gray-400">
                Este préstamo ya se encuentra completamente pagado e inactivo. No requiere abonos adicionales.
              </p>
            </div>
          ) : (
            <form onSubmit={handleRegisterPayment} className="space-y-4">
              <AnimatePresence>
                {pagoSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-green-400 rounded-2xl text-xs font-semibold"
                  >
                    {pagoSuccess}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase block pl-1">Monto de Abono (S/.) *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 text-xs font-bold font-mono">S/.</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="Ej. 150"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-3 glass-input rounded-2xl text-xs font-bold font-mono"
                    required
                  />
                </div>
                {/* CHIPS DE MONTOS RÁPIDOS */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setMonto(String(Math.round(cuotaRapida * 100) / 100))}
                    className="px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-[9px] font-extrabold uppercase hover:bg-indigo-500/20 transition cursor-pointer select-none"
                  >
                    {cuotaSiguiente ? `Siguiente Cuota #${cuotaSiguiente.numero} (${formatCurrency(cuotaRapida)})` : `Aplicar Pago (${formatCurrency(cuotaRapida)})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonto(String(Math.round(resumenDeuda.saldoPendiente * 100) / 100))}
                    className="px-2.5 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl text-[9px] font-extrabold uppercase hover:bg-purple-500/20 transition cursor-pointer select-none"
                  >
                    Liquidar Saldo ({formatCurrency(resumenDeuda.saldoPendiente)})
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase block pl-1">Medio de Pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full glass-input rounded-2xl p-3 bg-[#0A0A0C] text-xs font-bold text-slate-200 cursor-pointer"
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m} value={m} className="bg-[#0f172a]">{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Fecha de Operación</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFechaPago(new Date().toISOString().split("T")[0])}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition cursor-pointer select-none ${
                        fechaPago === new Date().toISOString().split("T")[0]
                          ? "bg-indigo-500/20 border border-indigo-500/30 text-indigo-300"
                          : "bg-white/[0.04] border border-white/5 text-gray-400 hover:text-slate-200 hover:border-white/10"
                      }`}
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setFechaPago(yesterday.toISOString().split("T")[0]);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition cursor-pointer select-none ${
                        (() => { const y = new Date(); y.setDate(y.getDate() - 1); return fechaPago === y.toISOString().split("T")[0]; })()
                          ? "bg-indigo-500/20 border border-indigo-500/30 text-indigo-300"
                          : "bg-white/[0.04] border border-white/5 text-gray-400 hover:text-slate-200 hover:border-white/10"
                      }`}
                    >
                      Ayer
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  className="w-full glass-input rounded-2xl p-3 text-xs font-bold text-slate-200"
                />
                {fechaPago && (
                  <p className="text-[10px] text-indigo-300/80 font-semibold pl-1 capitalize">
                    {new Date(`${fechaPago}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>

              {/* Cargar Voucher con OCR */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase block pl-1">
                  Cargar Voucher (Opcional)
                </label>
                <div className="relative group/file">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleVoucherUpload}
                    className="hidden"
                    id="voucher-upload-input"
                    disabled={uploadStatus === "uploading"}
                  />
                  <label
                    htmlFor="voucher-upload-input"
                    tabIndex={0}
                    onFocus={() => setActivePastePagoId(null)}
                    className={`flex flex-col items-center justify-center p-3.5 border border-dashed rounded-2xl cursor-pointer transition select-none min-h-[85px] focus:outline-none focus:border-indigo-500 focus:bg-indigo-500/[0.02] ${
                      uploadStatus === "uploading"
                        ? "bg-white/[0.02] border-indigo-500/30 text-blue-400 cursor-not-allowed"
                        : uploadStatus === "done" || comprobanteUrl
                        ? "bg-emerald-500/5 border-emerald-500/30 text-green-400 hover:bg-emerald-500/10 hover:border-emerald-500/40"
                        : uploadStatus === "error"
                        ? "bg-rose-500/5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                        : "bg-white/[0.04] border-white/5 hover:border-indigo-500/40 text-gray-400 hover:text-slate-200"
                    }`}
                  >
                    {uploadStatus === "uploading" ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-blue-400" size={20} />
                        <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase">
                          Subiendo a Drive...
                        </span>
                      </div>
                    ) : uploadStatus === "done" || comprobanteUrl ? (
                      <div className="flex items-center gap-2 text-center text-xs">
                        <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                        <div className="text-left">
                          <p className="font-extrabold text-slate-200 text-[11px]">Voucher listo ✓</p>
                          <p className="text-[9px] text-slate-400 font-bold truncate max-w-[170px]">
                            {comprobanteName}
                          </p>
                          <p className="text-[9px] text-gray-500 font-semibold mt-0.5">Clic o Ctrl+V para cambiar</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-center">
                        <UploadCloud size={20} className="text-blue-400 group-hover/file:scale-105 transition-transform" />
                        <div>
                          <p className="font-extrabold text-xs text-slate-300">Subir imagen de voucher</p>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                            JPG, PNG o WEBP · Ctrl+V para pegar
                          </p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
                {voucherError && (
                  <p className="text-[10px] text-rose-400 font-semibold">
                    {voucherError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || uploadStatus === "uploading"}
                className="w-full bg-white/10 hover:bg-white/15 border border-white/10 backdrop-blur-md transition-all text-white font-medium text-white font-bold py-3 rounded-2xl text-xs sm:text-sm transition cursor-pointer flex justify-center items-center gap-2 min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Procesando abono...</span>
                  </>
                ) : uploadStatus === "uploading" ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Subiendo voucher...</span>
                  </>
                ) : (
                  <span>Registrar pago</span>
                )}
              </button>

            </form>
          )}
        </div>
      </div>

      {/* Sección Plan de Ayuda al Cliente */}
      <div id="plan-ayuda-section" className="bento-card p-6 rounded-3xl relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border border-white/5 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="font-extrabold text-white text-lg tracking-tight flex items-center gap-2">
                Plan de Ayuda al Cliente
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Recuperación de Cartera
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Facilidades y herramientas excepcionales para regularizar la situación de deuda del cliente
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowHistorialModal(true)}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md rounded-xl text-xs font-bold text-slate-200 transition cursor-pointer flex items-center gap-2"
            >
              <Coins size={14} />
              <span>Ver Historial ({ajustes.length})</span>
            </button>
            <button
              onClick={() => {
                setIsQuickAjuste(false);
                setAjusteTipo("eliminar_interes_cuota");
                setAjusteCuotaNumero("");
                setAjusteFechaInicio(new Date().toISOString().split("T")[0]);
                setAjusteFechaFin("");
                setAjusteMontoAfectado("");
                setAjusteMontoAntes("");
                setAjusteMontoDespues("");
                setAjusteDescripcion("");
                setAjusteMotivo("");
                setAyudaError("");
                setShowAyudaModal(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-indigo-500/20 flex items-center gap-2"
            >
              <HandCoins size={14} />
              <span>Aplicar Nueva Facilidad</span>
            </button>
          </div>
        </div>

        {/* Resumen del Plan de Ayuda */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Beneficio Total Aplicado</span>
            <span className="text-xl font-black text-indigo-400 font-mono">
              {formatCurrency(planAyuda?.totalBeneficioAplicado || 0)}
            </span>
            <span className="text-[9px] text-gray-500 block mt-0.5">Ahorro real generado al cliente</span>
          </div>

          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Interés Congelado</span>
            <span className={`text-xl font-black ${planAyuda?.interesCongelado ? "text-emerald-400" : "text-slate-400"}`}>
              {planAyuda?.interesCongelado ? "Sí (Activo)" : "No"}
            </span>
            <span className="text-[9px] text-gray-500 block mt-0.5">
              {planAyuda?.fechaCongelamientoHasta 
                ? `Hasta: ${planAyuda.fechaCongelamientoHasta}` 
                : "Sin congelamientos vigentes"}
            </span>
          </div>

          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Mora Eliminada / Reducida</span>
            <span className={`text-xl font-black ${planAyuda?.moraEliminada ? "text-emerald-400" : "text-slate-400"}`}>
              {planAyuda?.moraEliminada ? "Sí (Activo)" : "No"}
            </span>
            <span className="text-[9px] text-gray-500 block mt-0.5">Exoneración de penalidades</span>
          </div>

          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Facilidades Activas</span>
            <span className="text-xl font-black text-slate-200 font-mono">
              {ajustes.filter((a: AjustePrestamo) => a.activo).length}
            </span>
            <span className="text-[9px] text-gray-500 block mt-0.5">Ajustes manuales vigentes</span>
          </div>
        </div>
      </div>

      {/* Cronograma de Cuotas (Diseño Dual) */}
      <div id="payment-schedule-card" className="bento-card rounded-3xl overflow-hidden">
        <div className="p-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
              <Calendar size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base tracking-tight">Cronograma de Cuotas</h3>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Calendario planificado de vencimientos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-green-400 font-bold px-3 py-1 rounded-lg font-mono">
              Pagadas: {debtState.cuotas.filter((c: any) => c.estado === "Saldada").length}
            </span>
            <span className="text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold px-3 py-1 rounded-lg font-mono">
              Vencidas: {debtState.cuotas.filter((c: any) => c.estado === "Vencida").length}
            </span>
          </div>
        </div>

        {debtState.cuotas.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-black/10">
            <Calendar className="mx-auto text-slate-600 mb-3" size={36} />
            <p className="font-extrabold text-sm text-gray-300">No hay cuotas programadas</p>
          </div>
        ) : (
          <>
            {/* VISTA ESCRITORIO */}
            <div className="hidden sm:block overflow-x-auto text-xs md:text-sm">
              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="bg-white/[0.02] text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 select-none">
                    <th className="px-6 py-4.5">N° Cuota</th>
                    <th className="px-6 py-4.5">Fecha Vencimiento</th>
                    <th className="px-6 py-4.5">Monto Cuota (Interés)</th>
                    <th className="px-6 py-4.5">Mora Calculada</th>
                    <th className="px-6 py-4.5">Total Pagado</th>
                    <th className="px-6 py-4.5">Saldo Restante</th>
                    <th className="px-6 py-4.5 text-right">Estado</th>
                    <th className="px-4 py-4.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {debtState.cuotas.map((cuota: any) => {
                    const readableDate = new Date(`${cuota.fechaVencimiento}T00:00:00`).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    });
                    
                    return (
                      <tr key={cuota.numero} className="hover:bg-white/[0.02] transition group">
                        <td className="px-6 py-4 font-mono font-bold text-slate-400">
                          Cuota #{cuota.numero}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-200">
                          {readableDate}
                        </td>
                        <td className="px-6 py-4 font-mono font-semibold">
                          {cuota.congelada ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="line-through text-rose-500/60 text-[10px]">{formatCurrency(cuota.montoCuotaBase)}</span>
                              <span className="text-emerald-400 font-extrabold">{formatCurrency(cuota.interesPendiente)}</span>
                              <span className="inline-flex items-center gap-1 text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wide w-fit">
                                <CheckCircle2 size={9} /> Ajuste
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-200">{formatCurrency(cuota.montoCuotaBase)}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono">
                          {cuota.moraPendiente > 0 ? (
                            <span className="text-orange-400 font-extrabold">{formatCurrency(cuota.moraPendiente)}</span>
                          ) : (
                            <span className="text-slate-650">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono">
                          {cuota.pagado > 0 || cuota.capitalAmortizado > 0 ? (
                            <div className="flex flex-col">
                              <span className="text-green-400 font-bold">
                                {formatCurrency(cuota.pagado + (cuota.capitalAmortizado || 0))}
                              </span>
                              {cuota.capitalAmortizado > 0 && (
                                <span className="text-[10px] text-gray-400 font-semibold mt-0.5 font-sans">
                                  -{formatCurrency(cuota.capitalAmortizado)} Capital
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-655">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-blue-400">
                          {cuota.saldoPendiente > 0 ? formatCurrency(cuota.saldoPendiente) : <span className="text-slate-650">-</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              cuota.estado === "Saldada"
                                ? "bg-emerald-500/10 text-green-400 border border-emerald-500/20"
                                : cuota.estado === "Vencida"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse"
                                : cuota.estado === "Parcial"
                                ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {cuota.estado} {cuota.diasVencidos > 0 && `(${cuota.diasVencidos}d vencida)`}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity justify-center">
                            <button
                              type="button"
                              onClick={() => handleQuickAjuste(cuota.numero, 'eliminar_interes_cuota')}
                              title="Quitar interés de esta cuota (auditoría/apoyo)"
                              className="flex items-center justify-center w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                            >
                              <Scissors size={12} />
                            </button>
                            {cuota.estado === "Saldada" && (
                              <span title="Cuota completamente saldada" className="text-emerald-500 shrink-0 ml-1">
                                <CheckCircle2 size={13} />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VISTA CELULAR */}
            <div className="sm:hidden p-4 space-y-3 bg-white/[0.02]">
              {debtState.cuotas.map((cuota: any) => {
                const readableDate = new Date(`${cuota.fechaVencimiento}T00:00:00`).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                });

                return (
                  <div key={cuota.numero} className="bg-[#0A0A0C]/60 p-4 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <span className="text-[10px] font-mono font-black text-indigo-400">CUOTA #{cuota.numero}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                          cuota.estado === "Saldada"
                            ? "bg-emerald-500/10 text-green-400 border border-emerald-500/20"
                            : cuota.estado === "Vencida"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse"
                            : cuota.estado === "Parcial"
                            ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {cuota.estado}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-gray-500 block">Vencimiento:</span>
                        <span className="font-bold text-slate-200">{readableDate}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Cuota Base:</span>
                        {cuota.congelada ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="line-through text-rose-500/60 text-[9px] font-mono">{formatCurrency(cuota.montoCuotaBase)}</span>
                            <span className="font-mono font-extrabold text-emerald-400">{formatCurrency(cuota.interesPendiente)} <span className="text-[8px] normal-case">ajustado</span></span>
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-slate-300">{formatCurrency(cuota.montoCuotaBase)}</span>
                        )}
                      </div>
                      {cuota.moraPendiente > 0 && (
                        <div>
                          <span className="text-gray-500 block">Mora:</span>
                          <span className="font-mono font-extrabold text-orange-400">{formatCurrency(cuota.moraPendiente)}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500 block">Saldo Restante:</span>
                        <span className="font-mono font-bold text-blue-400">{formatCurrency(cuota.saldoPendiente)}</span>
                      </div>
                      <div>
                        <span className="text-gray-505 block">Total Pagado:</span>
                        {cuota.pagado > 0 || cuota.capitalAmortizado > 0 ? (
                          <div className="flex flex-col font-mono">
                            <span className="text-green-400 font-bold">
                              {formatCurrency(cuota.pagado + (cuota.capitalAmortizado || 0))}
                            </span>
                            {cuota.capitalAmortizado > 0 && (
                              <span className="text-[9px] text-gray-400 font-semibold font-sans mt-0.5 block">
                                -{formatCurrency(cuota.capitalAmortizado)} Capital
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-655 font-mono">-</span>
                        )}
                      </div>
                      {cuota.diasVencidos > 0 && (
                        <div className="col-span-2">
                          <span className="inline-flex items-center gap-1 text-rose-400/90 font-extrabold font-mono uppercase text-[8px] tracking-wider">
                            <AlertCircle size={10} /> {cuota.diasVencidos} dias de retraso acumulados
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ACCIONES RAPIDAS MOBILE */}
                    <div className="flex gap-2 pt-2 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => handleQuickAjuste(cuota.numero, 'eliminar_interes_cuota')}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-extrabold uppercase hover:bg-rose-500/20 transition cursor-pointer"
                      >
                        <Scissors size={12} />
                        Condonar Interés de Cuota
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Historial de Pagos (Diseño Dual) */}
      <div id="amortizations-history-card" className="bento-card rounded-3xl overflow-hidden">
        <div className="p-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
              <Coins size={16} />
            </div>
            <h3 className="font-extrabold text-white text-base tracking-tight">Historial de Pagos</h3>
          </div>
          <span className="text-[10px] bg-white/[0.03] border border-white/5 text-indigo-300 font-bold px-3 py-1 rounded-lg font-mono select-none">
            Pagos: {pagosRealizados.length}
          </span>
        </div>
        {voucherUpdateError && (
          <div className="px-5 py-3 text-[11px] text-rose-400 font-semibold border-b border-white/5 bg-rose-500/5">
            {voucherUpdateError}
          </div>
        )}

        {pagosRealizados.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-black/10">
            <Coins className="mx-auto text-slate-600 mb-3" size={40} />
            <p className="font-extrabold text-sm text-gray-300">No hay pagos registrados</p>
            <p className="text-xs text-gray-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
              Ingresa el monto del abono en el formulario superior para registrar el primer pago de este credito.
            </p>
          </div>
        ) : (
          <>
            {/* HISTORIAL TABLA: Escritorio */}
            <div className="hidden sm:block overflow-x-auto text-xs md:text-sm">
              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="bg-white/[0.02] text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 select-none">
                    <th className="px-6 py-4.5">ID Transacción</th>
                    <th className="px-6 py-4.5">Fecha Pago</th>
                    <th className="px-6 py-4.5">Aplicacion</th>
                    <th className="px-6 py-4.5">Comprobante</th>
                    <th className="px-6 py-4.5 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {pagosRealizados.map((pago: any) => (
                    <tr key={pago.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-6 py-4 text-xs font-mono text-gray-500 select-all">
                        {pago.id.substring(0, 18)}...
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-300 font-mono">
                        {pago.fecha_pago}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-200">
                            {getAplicacionLabel(pago)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            Metodo: {pago.metodo_pago}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div 
                          tabIndex={0}
                          onFocus={() => setActivePastePagoId(pago.id)}
                          onBlur={() => {
                            setTimeout(() => {
                              setActivePastePagoId((curr) => (curr === pago.id ? null : curr));
                            }, 120);
                          }}
                          className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all duration-200 focus:outline-none ${
                            activePastePagoId === pago.id
                              ? "border-indigo-500 bg-indigo-500/5 ring-2 ring-indigo-500/20"
                              : "border-transparent"
                          }`}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={(el) => {
                              voucherInputRefs.current[pago.id] = el;
                            }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleVoucherUpdate(pago.id, file);
                              }
                              e.currentTarget.value = "";
                            }}
                          />
                          {pago.comprobante_url ? (
                            <a
                              href={resolveVoucherUrl(pago.comprobante_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-indigo-500/20 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors"
                            >
                              <Image size={12} />
                              <span>Ver Voucher</span>
                              <ExternalLink size={10} className="opacity-60" />
                            </a>
                          ) : (
                            <span className="text-slate-555 font-bold text-[10px] uppercase tracking-wider pl-1.5">- Sin Voucher -</span>
                          )}
                          <button
                            type="button"
                            onClick={() => voucherInputRefs.current[pago.id]?.click()}
                            disabled={voucherUpdatingId === pago.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all duration-250 cursor-pointer disabled:opacity-60 ${
                              activePastePagoId === pago.id
                                ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 animate-pulse"
                                : "border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {voucherUpdatingId === pago.id 
                              ? "Subiendo..." 
                              : activePastePagoId === pago.id
                              ? "Pegar (Ctrl+V)"
                              : (pago.comprobante_url ? "Actualizar Voucher" : "Adjuntar Voucher")
                            }
                          </button>
                          <button
                            onClick={() => handleShareReceipt(pago)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-green-400 hover:bg-emerald-500/20 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            <Send size={11} />
                            <span>Compartir Recibo</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-white font-mono text-xs md:text-sm">
                        {formatCurrency(parseFloat(pago.monto))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* HISTORIAL TARJETAS: Celular */}
            <div className="sm:hidden p-4 space-y-3 bg-white/[0.02]">
              {pagosRealizados.map((pago: any) => (
                <div 
                  key={pago.id} 
                  tabIndex={0}
                  onFocus={() => setActivePastePagoId(pago.id)}
                  onBlur={() => {
                    setTimeout(() => {
                      setActivePastePagoId((curr) => (curr === pago.id ? null : curr));
                    }, 120);
                  }}
                  className={`p-4 rounded-2xl border space-y-3 shadow-sm transition-all duration-250 focus:outline-none ${
                    activePastePagoId === pago.id
                      ? "bg-indigo-950/20 border-indigo-500 ring-2 ring-indigo-500/25 scale-[1.01]"
                      : "bg-[#0A0A0C]/60 border-white/5"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-mono text-gray-500">ID: {pago.id.substring(0, 8)}...</span>
                    <span className="text-[10px] text-gray-400 font-bold font-mono">{pago.fecha_pago}</span>
                  </div>

                  <div className="flex justify-between items-end pt-1">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-200 block">
                        {getAplicacionLabel(pago)}
                      </span>
                      <span className="text-[10px] text-slate-450 font-bold block text-gray-300">Metodo: {pago.metodo_pago}</span>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {pago.comprobante_url ? (
                          <a
                            href={resolveVoucherUrl(pago.comprobante_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-indigo-500/20 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-colors"
                          >
                            <Image size={10} />
                            <span>Ver Voucher</span>
                            <ExternalLink size={8} className="opacity-60" />
                          </a>
                        ) : (
                          <span className="text-slate-600 font-bold text-[9px] uppercase tracking-wider select-none">- Sin Voucher -</span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={(el) => { voucherInputRefs.current[pago.id] = el; }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVoucherUpdate(pago.id, file);
                            e.currentTarget.value = "";
                          }}
                        />
                        <button
                          onClick={() => voucherInputRefs.current[pago.id]?.click()}
                          disabled={voucherUpdatingId === pago.id}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold cursor-pointer disabled:opacity-60 border transition-all duration-250 ${
                            activePastePagoId === pago.id
                              ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 animate-pulse"
                              : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {voucherUpdatingId === pago.id 
                            ? "Subiendo..." 
                            : activePastePagoId === pago.id
                            ? "Pegar (Ctrl+V)"
                            : (pago.comprobante_url ? "Actualizar" : "Adjuntar")
                          }
                        </button>
                        <button
                          onClick={() => handleShareReceipt(pago)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-green-400 hover:bg-emerald-500/20 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          <Send size={10} />
                          <span>Compartir Recibo</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-white font-mono text-xs sm:text-sm">
                        {formatCurrency(parseFloat(pago.monto))}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal: Aplicar Nueva Facilidad */}
      <AnimatePresence>
        {showAyudaModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base">Aplicar Nueva Facilidad</h3>
                    <p className="text-[10px] text-gray-400">Selecciona y configura el plan de apoyo manual</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAyudaModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateAjuste} className="space-y-4">
                {ayudaError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-semibold flex items-center gap-2">
                    <AlertCircle size={14} />
                    {ayudaError}
                  </div>
                )}
                
                <div className="space-y-4">
                  {/* Tipo de Ayuda/Ajuste - Fijo ya que es la única opción */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Tipo de Ayuda/Ajuste</label>
                    <div className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm font-semibold flex items-center gap-2">
                      <Scissors size={14} className="text-rose-450" />
                      <span className="text-slate-100 font-bold">Eliminar Interés de una Cuota</span>
                    </div>
                  </div>

                  {/* N° de Cuota a afectar */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">N° de Cuota a Afectar *</label>
                    <input
                      type="number"
                      min="1"
                      value={ajusteCuotaNumero}
                      onChange={(e) => setAjusteCuotaNumero(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition outline-none font-mono"
                      placeholder="Ej. 3"
                      required
                    />
                  </div>

                  {/* Motivo / Justificación */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Motivo / Justificación (Obligatorio) *</label>
                    <input
                      type="text"
                      value={ajusteMotivo}
                      onChange={(e) => setAjusteMotivo(e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition outline-none"
                      placeholder="Ej: Cliente con problemas de salud, acuerdo especial, etc."
                      required
                    />
                  </div>
                  
                  {/* Detalles Adicionales */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Detalles Adicionales (Opcional)</label>
                    <textarea
                      value={ajusteDescripcion}
                      onChange={(e) => setAjusteDescripcion(e.target.value)}
                      rows={3}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition outline-none resize-none"
                      placeholder="Agrega notas o detalles sobre el acuerdo..."
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAyudaModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 text-white transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={ayudaSubmitting}
                    className="flex-[2] py-3 px-4 rounded-xl font-bold text-xs bg-rose-500 hover:bg-rose-600 text-white transition shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {ayudaSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        Aplicar Facilidad
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Historial de Ajustes */}
      <AnimatePresence>
        {showHistorialModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] font-sans text-left"
            >
              <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                    <Coins size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base">Historial de Facilidades de Pago</h3>
                    <p className="text-[10px] text-gray-400">Registro histórico de modificaciones y apoyos al préstamo</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHistorialModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {ajustes.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <p className="text-xs text-gray-400">No hay ajustes o facilidades de pago registradas para este préstamo.</p>
                </div>
              ) : (
                <div className="overflow-y-auto pr-1 flex-1 space-y-4">
                  {ajustes.map((ajuste: AjustePrestamo) => {
                    let tipoBadge = "";
                    let tipoTexto = "";

                    switch (ajuste.tipo) {
                      case "congelar_interes_temporal":
                        tipoBadge = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                        tipoTexto = "Congelar Interés Temporal";
                        break;
                      case "congelar_interes_permanente":
                        tipoBadge = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                        tipoTexto = "Congelar Interés Permanente";
                        break;
                      case "eliminar_interes_cuota":
                        tipoBadge = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                        tipoTexto = `Eliminar Interés Cuota ${ajuste.cuota_numero}`;
                        break;
                      case "reducir_mora":
                        tipoBadge = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                        tipoTexto = `Reducir Mora (${ajuste.monto_afectado}%)`;
                        break;
                      case "eliminar_mora":
                        tipoBadge = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                        tipoTexto = "Eliminar Mora";
                        break;
                      case "periodo_gracia":
                        tipoBadge = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                        tipoTexto = `Período de Gracia (${ajuste.periodo_gracia_dias} días)`;
                        break;
                      default:
                        tipoBadge = "bg-slate-500/10 text-slate-400 border-slate-500/20";
                        tipoTexto = ajuste.tipo;
                    }

                    return (
                      <div
                        key={ajuste.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          ajuste.activo
                            ? "bg-white/[0.02] border-white/5"
                            : "bg-white/[0.01] border-white/[0.02] opacity-60"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[9px] px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wide border ${tipoBadge}`}>
                              {tipoTexto}
                            </span>
                            {!ajuste.activo && (
                              <span className="text-[9px] bg-slate-800 text-gray-400 font-bold px-2 py-0.5 rounded-md uppercase border border-slate-700">
                                Inactivo
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {new Date(ajuste.fecha_registro).toLocaleString("es-PE")}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-4 bg-black/10 p-3 rounded-xl border border-white/5">
                          <div>
                            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Registrado por</span>
                            <p className="text-xs text-slate-300 font-semibold">{ajuste.usuario}</p>
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Vigencia</span>
                            <p className="text-xs text-slate-300 font-semibold font-mono">
                              {ajuste.fecha_fin 
                                ? `Del ${ajuste.fecha_inicio} al ${ajuste.fecha_fin}` 
                                : `Desde ${ajuste.fecha_inicio}`}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Motivo justificado</span>
                          <p className="text-xs text-slate-200 mt-0.5 italic">"{ajuste.motivo}"</p>
                        </div>

                        {ajuste.descripcion && (
                          <div className="mt-2">
                            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Detalles adicionales</span>
                            <p className="text-xs text-gray-300 mt-0.5">{ajuste.descripcion}</p>
                          </div>
                        )}

                        {/* Toggle de activación del ajuste */}
                        <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
                          <button
                            onClick={() => handleToggleAjuste(ajuste.id, ajuste.activo)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer border ${
                              ajuste.activo
                                ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20"
                                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            {ajuste.activo ? "❌ Desactivar Ajuste" : "✅ Activar Ajuste"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
