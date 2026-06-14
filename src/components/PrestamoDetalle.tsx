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
  Scissors
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { buildPaymentSchedule } from "../lib/loanLogic";
import { formatDateWithDay, formatDateShort } from "../lib/formatters";
import { AjustePrestamo } from "../types";
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
      `📅 *Fecha de Emisión:* ${formatDateWithDay(prestamoObj.fecha_emision)}\n` +
      `📅 *Fecha de Vencimiento:* ${prestamoObj.fecha_vencimiento ? formatDateWithDay(prestamoObj.fecha_vencimiento) : "No establecida"}\n\n` +
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
    <div id="loan-details-view" className="space-y-6 font-sans text-slate-800">
      
      {/* Botón Volver */}
      <div className="flex justify-between items-center">
        <button
          id="btn-back-to-dashboard"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer group py-2 border-none bg-transparent"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Volver al Panel Principal</span>
        </button>
      </div>

      {/* Header Info Principal - Rediseño Hero */}
      <div id="loan-header-card" className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        {/* Indicador de estado en el borde superior */}
        <div className={`absolute top-0 left-0 w-full h-1.5 ${resumenDeuda.cuotasVencidas > 0 ? 'bg-red-600' : 'bg-emerald-600'}`} />
        
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 rounded-lg font-mono uppercase tracking-wider font-bold">
              ID: {prestamo.id.substring(0, 8)}
            </span>
            <span
              className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                prestamo.estado === "activo"
                  ? resumenDeuda.cuotasVencidas > 0
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              {prestamo.estado === "activo" ? (resumenDeuda.cuotasVencidas > 0 ? "En Mora" : "Al día / Activo") : "Cancelado"}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">
            {prestamo.cliente_nombre}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-indigo-650 font-bold uppercase tracking-wider">
              <Landmark size={14} />
              <span>Préstamo {prestamo.tipo_prestamo}</span>
            </div>
            <button
              onClick={handleShareDisbursement}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors ml-2 cursor-pointer"
            >
              <Send size={11} />
              <span>Compartir Desembolso</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 md:gap-8 md:items-center w-full md:w-auto">
          {cuotaSiguiente && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex-1 sm:flex-initial">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Próxima Cuota</p>
              <p className="text-2xl text-slate-900 font-black tabular-nums">{formatCurrency(cuotaRapida)}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                Vence: {formatDateShort(cuotaSiguiente.fechaVencimiento)}
              </p>
            </div>
          )}
          
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Saldo Pendiente</span>
            <p className="text-3xl font-black text-emerald-600 tracking-tight font-mono">
              {formatCurrency(resumenDeuda.saldoPendiente)}
            </p>
          </div>
        </div>
      </div>

      {/* Grid Bento del Préstamo */}
      <div id="loan-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Infografía de Estado Financiero & Progreso - Columna 2/3 */}
        <div id="financial-info-card" className="bg-white border border-slate-200 p-6 rounded-3xl space-y-6 lg:col-span-2 flex flex-col justify-between shadow-sm">
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center text-blue-600">
                <CreditCard size={16} />
              </div>
              <h2 className="font-extrabold text-slate-900 text-base tracking-tight">
                Estado Financiero del Préstamo
              </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Capital recibido</span>
                <span className="text-lg font-black text-slate-800 font-mono">{formatCurrency(prestamo.monto_capital)}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Interés mensual</span>
                <span className="text-lg font-black text-slate-800 font-mono">{formatCurrency(interesMensual)}</span>
                <span className="text-[10px] text-slate-500 font-semibold block mt-1">Tasa {prestamo.tasa_interes_porcentaje}%</span>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl border">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block mb-1">Total exigible actualizado</span>
                <span className="text-lg font-black text-indigo-800 font-mono">{formatCurrency(deudaTotalActual)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Capital pendiente</span>
                <span className="text-2xl font-black text-slate-800 font-mono">{formatCurrency(resumenDeuda.capitalPendiente)}</span>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cuotas vencidas</span>
                <span className={`text-2xl font-black font-mono ${resumenDeuda.cuotasVencidas > 0 ? "text-red-600" : "text-slate-700"}`}>{resumenDeuda.cuotasVencidas}</span>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cuotas pendientes</span>
                <span className="text-2xl font-black text-amber-600 font-mono">{resumenDeuda.cuotasPendientes}</span>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Mora acumulada</span>
                <span className="text-2xl font-black text-orange-600 font-mono">{formatCurrency(resumenDeuda.moraAcumulada)}</span>
              </div>
            </div>

            {/* Barra de Progreso */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>Porcentaje Amortizado</span>
                <span className="font-mono text-emerald-600">{progressPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-550 h-full rounded-full" 
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider pt-1">
                <span>Pagado: {formatCurrency(resumenDeuda.totalPagado)}</span>
                <span>Pendiente: {formatCurrency(resumenDeuda.saldoPendiente)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Formulario Registrar Pago - Columna 1/3 */}
        <div id="payment-form-card" className="bg-white border border-slate-200 p-6 rounded-3xl h-fit shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center text-emerald-600">
              <HandCoins size={16} />
            </div>
            <h2 className="font-extrabold text-slate-900 text-base tracking-tight">Abonar a Cuenta</h2>
          </div>

          {prestamo.estado === "pagado" ? (
            <div className="p-6 bg-emerald-50 text-emerald-700 rounded-2xl text-center text-xs space-y-3 border border-emerald-250">
              <CheckCircle2 className="text-emerald-600 mx-auto" size={32} />
              <p className="font-extrabold text-slate-800 text-sm">Crédito Cancelado</p>
              <p className="leading-relaxed text-slate-500">
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
                    className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-semibold"
                  >
                    {pagoSuccess}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block pl-1">Monto de Abono (S/.) *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 text-xs font-bold font-mono">S/.</span>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="Ej. 150"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-3 glass-input rounded-2xl text-xs font-bold font-mono border-slate-200 focus:border-emerald-600"
                    required
                  />
                </div>
                {/* CHIPS DE MONTOS RÁPIDOS */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setMonto(String(Math.round(cuotaRapida * 100) / 100))}
                    className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-[9px] font-extrabold uppercase hover:bg-blue-100 transition cursor-pointer select-none"
                  >
                    {cuotaSiguiente ? `Cuota #${cuotaSiguiente.numero} (${formatCurrency(cuotaRapida)})` : `Abono (${formatCurrency(cuotaRapida)})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonto(String(Math.round(resumenDeuda.saldoPendiente * 100) / 100))}
                    className="px-2.5 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-xl text-[9px] font-extrabold uppercase hover:bg-purple-100 transition cursor-pointer select-none"
                  >
                    Liquidar ({formatCurrency(resumenDeuda.saldoPendiente)})
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block pl-1">Medio de Pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full glass-input rounded-2xl p-3 bg-white text-xs font-bold text-slate-800 cursor-pointer border-slate-200"
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m} value={m} className="bg-white text-slate-800">{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Fecha de Operación</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFechaPago(new Date().toISOString().split("T")[0])}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition cursor-pointer select-none ${
                        fechaPago === new Date().toISOString().split("T")[0]
                          ? "bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold"
                          : "bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300"
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
                          ? "bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold"
                          : "bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300"
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
                  className="w-full glass-input rounded-2xl p-3 text-xs font-bold text-slate-700 border-slate-200"
                />
                {fechaPago && (
                  <p className="text-[10px] text-indigo-600 font-semibold pl-1 capitalize mt-1">
                    {new Date(`${fechaPago}T00:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>

              {/* Cargar Voucher con OCR */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase block pl-1">
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
                    className={`flex flex-col items-center justify-center p-3.5 border border-dashed rounded-2xl cursor-pointer transition select-none min-h-[85px] focus:outline-none focus:border-indigo-500 focus:bg-indigo-50/20 ${
                      uploadStatus === "uploading"
                        ? "bg-slate-50 border-indigo-200 text-indigo-650 cursor-not-allowed"
                        : uploadStatus === "done" || comprobanteUrl
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
                        : uploadStatus === "error"
                        ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                        : "bg-slate-50 border-slate-200 hover:border-indigo-400/40 text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {uploadStatus === "uploading" ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-indigo-600" size={20} />
                        <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase">
                          Subiendo a Drive...
                        </span>
                      </div>
                    ) : uploadStatus === "done" || comprobanteUrl ? (
                      <div className="flex items-center gap-2 text-center text-xs">
                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        <div className="text-left">
                          <p className="font-extrabold text-slate-800 text-[11px]">Voucher listo ✓</p>
                          <p className="text-[9px] text-slate-500 font-bold truncate max-w-[170px]">
                            {comprobanteName}
                          </p>
                          <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Clic o Ctrl+V para cambiar</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-center">
                        <UploadCloud size={20} className="text-indigo-600 group-hover/file:scale-105 transition-transform" />
                        <div>
                          <p className="font-extrabold text-xs text-slate-700">Subir imagen de voucher</p>
                          <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wider mt-0.5">
                            JPG, PNG o WEBP · Ctrl+V para pegar
                          </p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
                {voucherError && (
                  <p className="text-[10px] text-red-600 font-semibold">
                    {voucherError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || uploadStatus === "uploading"}
                className="w-full bg-slate-900 hover:bg-slate-800 transition-all text-white font-bold py-3 rounded-2xl text-xs sm:text-sm cursor-pointer flex justify-center items-center gap-2 min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
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
      <div id="plan-ayuda-section" className="bg-white border border-slate-200 p-6 rounded-3xl relative overflow-hidden shadow-sm">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center text-indigo-600">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-lg tracking-tight flex items-center gap-2">
                Plan de Ayuda al Cliente
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-indigo-150">
                  Recuperación de Cartera
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Facilidades y herramientas excepcionales para regularizar la situación de deuda del cliente
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowHistorialModal(true)}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer flex items-center gap-2 border-none"
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
              className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm flex items-center gap-2 border-none"
            >
              <HandCoins size={14} />
              <span>Aplicar Nueva Facilidad</span>
            </button>
          </div>
        </div>

        {/* Resumen del Plan de Ayuda */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Beneficio Total Aplicado</span>
            <span className="text-xl font-black text-indigo-600 font-mono">
              {formatCurrency(planAyuda?.totalBeneficioAplicado || 0)}
            </span>
            <span className="text-[9px] text-slate-500 block mt-0.5">Ahorro real generado al cliente</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Interés Congelado</span>
            <span className={`text-xl font-black ${planAyuda?.interesCongelado ? "text-emerald-600" : "text-slate-400"}`}>
              {planAyuda?.interesCongelado ? "Sí (Activo)" : "No"}
            </span>
            <span className="text-[9px] text-slate-500 block mt-0.5">
              {planAyuda?.fechaCongelamientoHasta 
                ? `Hasta: ${planAyuda.fechaCongelamientoHasta}` 
                : "Sin congelamientos vigentes"}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Mora Eliminada / Reducida</span>
            <span className={`text-xl font-black ${planAyuda?.moraEliminada ? "text-emerald-600" : "text-slate-400"}`}>
              {planAyuda?.moraEliminada ? "Sí (Activo)" : "No"}
            </span>
            <span className="text-[9px] text-slate-500 block mt-0.5">Exoneración de penalidades</span>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Facilidades Activas</span>
            <span className="text-xl font-black text-slate-700 font-mono">
              {ajustes.filter((a: AjustePrestamo) => a.activo).length}
            </span>
            <span className="text-[9px] text-slate-500 block mt-0.5">Ajustes manuales vigentes</span>
          </div>
        </div>
      </div>

      {/* Cronograma de Cuotas (Diseño Dual) */}
      <div id="payment-schedule-card" className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-center text-indigo-600">
              <Calendar size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base tracking-tight">Cronograma de Cuotas</h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Calendario planificado de vencimientos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-3 py-1 rounded-lg font-mono">
              Pagadas: {debtState.cuotas.filter((c: any) => c.estado === "Saldada").length}
            </span>
            <span className="text-[10px] bg-red-50 border border-red-200 text-red-650 font-bold px-3 py-1 rounded-lg font-mono">
              Vencidas: {debtState.cuotas.filter((c: any) => c.estado === "Vencida").length}
            </span>
          </div>
        </div>

        {debtState.cuotas.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-slate-550">
            <Calendar className="mx-auto text-slate-300 mb-3" size={36} />
            <p className="font-extrabold text-sm text-slate-600">No hay cuotas programadas</p>
          </div>
        ) : (
          <>
            {/* VISTA ESCRITORIO */}
            <div className="hidden sm:block overflow-x-auto text-xs md:text-sm">
              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 select-none">
                    <th className="px-6 py-4.5">N° Cuota</th>
                    <th className="px-6 py-4.5">Fecha Vencimiento</th>
                    <th className="px-6 py-4.5">Monto Cuota (Interés)</th>
                    <th className="px-6 py-4.5">Mora Calculada</th>
                    <th className="px-6 py-4.5">Total Pagado</th>
                    <th className="px-6 py-4.5">Saldo Restante</th>
                    <th className="px-6 py-4.5 text-right">Estado</th>
                    <th className="sticky right-0 px-4 py-4.5 bg-slate-50 border-l border-slate-200 z-10 w-12 shadow-[-8px_0_15px_-5px_rgba(0,0,0,0.05)] text-center">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {debtState.cuotas.map((cuota: any) => {
                    const readableDate = formatDateWithDay(cuota.fechaVencimiento);
                    const isVencida = cuota.estado === "Vencida";
                    
                    return (
                      <tr key={cuota.numero} className={`hover:bg-slate-50/50 transition group ${isVencida ? "bg-red-500/[0.015]" : ""}`}>
                        <td className="px-6 py-4 font-mono font-bold text-slate-400">
                          Cuota #{cuota.numero}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-800">
                          {readableDate}
                        </td>
                        <td className="px-6 py-4 font-mono font-semibold">
                          {cuota.congelada ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="line-through text-red-500/70 text-[10px]">{formatCurrency(cuota.montoCuotaBase)}</span>
                              <span className="text-emerald-650 font-extrabold">{formatCurrency(cuota.interesPendiente)}</span>
                              <span className="inline-flex items-center gap-1 text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wide w-fit">
                                <CheckCircle2 size={9} /> Ajuste
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-800">{formatCurrency(cuota.montoCuotaBase)}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono">
                          {cuota.moraPendiente > 0 ? (
                            <span className="text-orange-600 font-extrabold">{formatCurrency(cuota.moraPendiente)}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono">
                          {cuota.pagado > 0 || cuota.capitalAmortizado > 0 ? (
                            <div className="flex flex-col">
                              <span className="text-emerald-600 font-bold">
                                {formatCurrency(cuota.pagado + (cuota.capitalAmortizado || 0))}
                              </span>
                              {cuota.capitalAmortizado > 0 && (
                                <span className="text-[10px] text-slate-500 font-semibold mt-0.5 font-sans">
                                  -{formatCurrency(cuota.capitalAmortizado)} Capital
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-800 font-semibold">
                          {cuota.saldoPendiente > 0 ? formatCurrency(cuota.saldoPendiente) : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                              cuota.estado === "Saldada"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : cuota.estado === "Vencida"
                                ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                                : cuota.estado === "Parcial"
                                ? "bg-amber-50 text-amber-700 border-amber-250"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            {cuota.estado} {cuota.diasVencidos > 0 && `(${cuota.diasVencidos}d vencida)`}
                          </span>
                        </td>
                        <td className="sticky right-0 px-2 py-4 bg-white group-hover:bg-slate-50 border-l border-slate-100 z-10 text-center shadow-[-8px_0_15px_-5px_rgba(0,0,0,0.02)]">
                          <div className="flex items-center gap-1.5 justify-center">
                            <button
                              type="button"
                              onClick={() => handleQuickAjuste(cuota.numero, 'eliminar_interes_cuota')}
                              title="Quitar interés de esta cuota (auditoría/apoyo)"
                              className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 border border-red-200 text-red-650 hover:bg-red-100 transition cursor-pointer"
                            >
                              <Scissors size={12} />
                            </button>
                            {cuota.estado === "Saldada" && (
                              <span title="Cuota completamente saldada" className="text-emerald-600 shrink-0 ml-1">
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
            <div className="sm:hidden p-4 space-y-3 bg-slate-50/50">
              {debtState.cuotas.map((cuota: any) => {
                const readableDate = formatDateWithDay(cuota.fechaVencimiento);
                const isVencida = cuota.estado === "Vencida";

                return (
                  <div key={cuota.numero} className={`bg-white p-4 rounded-2xl border space-y-3 shadow-sm ${isVencida ? "border-red-200 bg-red-50/10" : "border-slate-200"}`}>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <span className="text-[10px] font-mono font-black text-indigo-700">CUOTA #{cuota.numero}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${
                          cuota.estado === "Saldada"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                            : cuota.estado === "Vencida"
                            ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                            : cuota.estado === "Parcial"
                            ? "bg-amber-50 text-amber-700 border-amber-250"
                            : "bg-slate-100 border border-slate-200 text-slate-500"
                        }`}
                      >
                        {cuota.estado}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-700 font-medium">
                      <div>
                        <span className="text-slate-400 block">Vencimiento:</span>
                        <span className="font-bold text-slate-800">{readableDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Cuota Base:</span>
                        {cuota.congelada ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="line-through text-red-500/60 text-[9px] font-mono">{formatCurrency(cuota.montoCuotaBase)}</span>
                            <span className="font-mono font-extrabold text-emerald-700">{formatCurrency(cuota.interesPendiente)} <span className="text-[8px] normal-case">ajustado</span></span>
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-slate-800">{formatCurrency(cuota.montoCuotaBase)}</span>
                        )}
                      </div>
                      {cuota.moraPendiente > 0 && (
                        <div>
                          <span className="text-slate-400 block">Mora:</span>
                          <span className="font-mono font-extrabold text-orange-655">{formatCurrency(cuota.moraPendiente)}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400 block">Saldo Restante:</span>
                        <span className="font-mono font-bold text-slate-900">{formatCurrency(cuota.saldoPendiente)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Total Pagado:</span>
                        {cuota.pagado > 0 || cuota.capitalAmortizado > 0 ? (
                          <div className="flex flex-col font-mono">
                            <span className="text-emerald-750 font-bold">
                              {formatCurrency(cuota.pagado + (cuota.capitalAmortizado || 0))}
                            </span>
                            {cuota.capitalAmortizado > 0 && (
                              <span className="text-[9px] text-slate-500 font-semibold font-sans mt-0.5 block">
                                -{formatCurrency(cuota.capitalAmortizado)} Capital
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </div>
                      {cuota.diasVencidos > 0 && (
                        <div className="col-span-2">
                          <span className="inline-flex items-center gap-1 text-red-600 font-extrabold font-mono uppercase text-[8px] tracking-wider">
                            <AlertCircle size={10} /> {cuota.diasVencidos} días de retraso acumulados
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ACCIONES RAPIDAS MOBILE */}
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleQuickAjuste(cuota.numero, 'eliminar_interes_cuota')}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 border border-red-150 text-red-655 text-[10px] font-extrabold uppercase hover:bg-red-100 transition cursor-pointer"
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
      <div id="amortizations-history-card" className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-50 border border-blue-250 rounded-xl flex items-center justify-center text-blue-650">
              <Coins size={16} />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base tracking-tight">Historial de Pagos</h3>
          </div>
          <span className="text-[10px] bg-slate-105 border border-slate-200 text-slate-700 font-bold px-3 py-1 rounded-lg font-mono select-none">
            Pagos: {pagosRealizados.length}
          </span>
        </div>
        {voucherUpdateError && (
          <div className="px-5 py-3 text-[11px] text-red-600 font-semibold border-b border-red-200 bg-red-50">
            {voucherUpdateError}
          </div>
        )}

        {pagosRealizados.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-slate-50">
            <Coins className="mx-auto text-slate-300 mb-3" size={40} />
            <p className="font-extrabold text-sm text-slate-700">No hay pagos registrados</p>
            <p className="text-xs text-slate-550 mt-1.5 max-w-xs mx-auto leading-relaxed">
              Ingresa el monto del abono en el formulario superior para registrar el primer pago de este crédito.
            </p>
          </div>
        ) : (
          <>
            {/* HISTORIAL TABLA: Escritorio */}
            <div className="hidden sm:block overflow-x-auto text-xs md:text-sm">
              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 select-none">
                    <th className="px-6 py-4.5">ID Transacción</th>
                    <th className="px-6 py-4.5">Fecha Pago</th>
                    <th className="px-6 py-4.5">Aplicacion</th>
                    <th className="px-6 py-4.5">Comprobante</th>
                    <th className="px-6 py-4.5 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {pagosRealizados.map((pago: any) => (
                    <tr key={pago.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 text-xs font-mono text-slate-400 select-all">
                        {pago.id.substring(0, 18)}...
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800 font-mono">
                        {pago.fecha_pago}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-900 block">
                            {getAplicacionLabel(pago)}
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold mt-0.5 block">
                            Método: {pago.metodo_pago}
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
                              ? "border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20"
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
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors"
                            >
                              <Image size={12} />
                              <span>Ver Voucher</span>
                              <ExternalLink size={10} className="opacity-60" />
                            </a>
                          ) : (
                            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider pl-1.5">- Sin Voucher -</span>
                          )}
                          <button
                            type="button"
                            onClick={() => voucherInputRefs.current[pago.id]?.click()}
                            disabled={voucherUpdatingId === pago.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all duration-250 cursor-pointer disabled:opacity-60 ${
                              activePastePagoId === pago.id
                                ? "border-indigo-500 bg-indigo-100 text-indigo-700 animate-pulse"
                                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-250 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            <Send size={11} />
                            <span>Compartir Recibo</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 font-mono text-xs md:text-sm">
                        {formatCurrency(parseFloat(pago.monto))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* HISTORIAL TARJETAS: Celular */}
            <div className="sm:hidden p-4 space-y-3 bg-slate-50/50">
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
                  className={`p-4 rounded-2xl border space-y-3 shadow-sm bg-white transition-all duration-250 focus:outline-none ${
                    activePastePagoId === pago.id
                      ? "bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/10 scale-[1.01]"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-mono text-slate-400">ID: {pago.id.substring(0, 8)}...</span>
                    <span className="text-[10px] text-slate-500 font-bold font-mono">{pago.fecha_pago}</span>
                  </div>

                  <div className="flex justify-between items-end pt-1">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-900 block">
                        {getAplicacionLabel(pago)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold block">Método: {pago.metodo_pago}</span>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {pago.comprobante_url ? (
                          <a
                            href={resolveVoucherUrl(pago.comprobante_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-indigo-500/20 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-colors"
                          >
                            <Image size={10} />
                            <span>Ver Voucher</span>
                            <ExternalLink size={8} className="opacity-60" />
                          </a>
                        ) : (
                          <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider select-none">- Sin Voucher -</span>
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
                              ? "border-indigo-500 bg-indigo-100 text-indigo-700 animate-pulse"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
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
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-250 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          <Send size={10} />
                          <span>Compartir Recibo</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-slate-900 font-mono text-xs sm:text-sm">
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
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden text-slate-800"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-center text-indigo-650">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Aplicar Nueva Facilidad</h3>
                    <p className="text-[10px] text-slate-500">Selecciona y configura el plan de apoyo manual</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAyudaModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer border-none"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateAjuste} className="space-y-4">
                {ayudaError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-650 text-xs rounded-xl font-semibold flex items-center gap-2">
                    <AlertCircle size={14} />
                    {ayudaError}
                  </div>
                )}
                
                <div className="space-y-4">
                  {/* Tipo de Ayuda/Ajuste - Fijo ya que es la única opción */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tipo de Ayuda/Ajuste</label>
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm font-semibold flex items-center gap-2">
                      <Scissors size={14} className="text-red-600" />
                      <span className="text-slate-800 font-bold">Eliminar Interés de una Cuota</span>
                    </div>
                  </div>

                  {/* N° de Cuota a afectar */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">N° de Cuota a Afectar *</label>
                    <input
                      type="number"
                      min="1"
                      value={ajusteCuotaNumero}
                      onChange={(e) => setAjusteCuotaNumero(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none font-mono"
                      placeholder="Ej. 3"
                      required
                    />
                  </div>

                  {/* Motivo / Justificación */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Motivo / Justificación (Obligatorio) *</label>
                    <input
                      type="text"
                      value={ajusteMotivo}
                      onChange={(e) => setAjusteMotivo(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none"
                      placeholder="Ej: Cliente con problemas de salud, acuerdo especial, etc."
                      required
                    />
                  </div>
                  
                  {/* Detalles Adicionales */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Detalles Adicionales (Opcional)</label>
                    <textarea
                      value={ajusteDescripcion}
                      onChange={(e) => setAjusteDescripcion(e.target.value)}
                      rows={3}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition outline-none resize-none"
                      placeholder="Agrega notas o detalles sobre el acuerdo..."
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAyudaModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border-none"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={ayudaSubmitting}
                    className="flex-[2] py-3 px-4 rounded-xl font-bold text-xs bg-indigo-650 hover:bg-indigo-700 text-white transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 border-none"
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
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] font-sans text-left text-slate-800"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-center text-indigo-600">
                    <Coins size={16} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Historial de Facilidades de Pago</h3>
                    <p className="text-[10px] text-slate-500">Registro histórico de modificaciones y apoyos al préstamo</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHistorialModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer border-none"
                >
                  <X size={16} />
                </button>
              </div>

              {ajustes.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <p className="text-xs text-slate-500">No hay ajustes o facilidades de pago registradas para este préstamo.</p>
                </div>
              ) : (
                <div className="overflow-y-auto pr-1 flex-1 space-y-4">
                  {ajustes.map((ajuste: AjustePrestamo) => {
                    let tipoBadge = "";
                    let tipoTexto = "";

                    switch (ajuste.tipo) {
                      case "congelar_interes_temporal":
                        tipoBadge = "bg-blue-50 text-blue-700 border-blue-200";
                        tipoTexto = "Congelar Interés Temporal";
                        break;
                      case "congelar_interes_permanente":
                        tipoBadge = "bg-cyan-50 text-cyan-700 border-cyan-200";
                        tipoTexto = "Congelar Interés Permanente";
                        break;
                      case "eliminar_interes_cuota":
                        tipoBadge = "bg-amber-50 text-amber-700 border-amber-250";
                        tipoTexto = `Eliminar Interés Cuota ${ajuste.cuota_numero}`;
                        break;
                      case "reducir_mora":
                        tipoBadge = "bg-indigo-50 text-indigo-700 border-indigo-200";
                        tipoTexto = `Reducir Mora (${ajuste.monto_afectado}%)`;
                        break;
                      case "eliminar_mora":
                        tipoBadge = "bg-red-50 text-red-700 border-red-200";
                        tipoTexto = "Eliminar Mora";
                        break;
                      case "periodo_gracia":
                        tipoBadge = "bg-purple-50 text-purple-700 border-purple-200";
                        tipoTexto = `Período de Gracia (${ajuste.periodo_gracia_dias} días)`;
                        break;
                      default:
                        tipoBadge = "bg-slate-100 text-slate-600 border border-slate-200";
                        tipoTexto = ajuste.tipo;
                    }

                    return (
                      <div
                        key={ajuste.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          ajuste.activo
                            ? "bg-slate-50/50 border-slate-200"
                            : "bg-slate-50/10 border-slate-150 opacity-60"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[9px] px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wide border ${tipoBadge}`}>
                              {tipoTexto}
                            </span>
                            {!ajuste.activo && (
                              <span className="text-[9px] bg-slate-150 text-slate-600 font-bold px-2 py-0.5 rounded-md uppercase border border-slate-200">
                                Inactivo
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(ajuste.fecha_registro).toLocaleString("es-PE")}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-150">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Registrado por</span>
                            <p className="text-xs text-slate-850 font-semibold">{ajuste.usuario}</p>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Vigencia</span>
                            <p className="text-xs text-slate-850 font-semibold font-mono">
                              {ajuste.fecha_fin 
                                ? `Del ${ajuste.fecha_inicio} al ${ajuste.fecha_fin}` 
                                : `Desde ${ajuste.fecha_inicio}`}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Motivo justificado</span>
                          <p className="text-xs text-slate-700 mt-0.5 italic">"{ajuste.motivo}"</p>
                        </div>

                        {ajuste.descripcion && (
                          <div className="mt-2">
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Detalles adicionales</span>
                            <p className="text-xs text-slate-600 mt-0.5">{ajuste.descripcion}</p>
                          </div>
                        )}

                        {/* Toggle de activación del ajuste */}
                        <div className="mt-4 pt-3 border-t border-slate-150 flex justify-end">
                          <button
                            onClick={() => handleToggleAjuste(ajuste.id, ajuste.activo)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer border ${
                              ajuste.activo
                                ? "bg-red-50 hover:bg-red-100 text-red-650 border-red-200"
                                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-250"
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
