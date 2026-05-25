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
  UploadCloud
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { buildPaymentSchedule } from "../lib/loanLogic";

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
  const [metodoPago, setMetodoPago] = useState("Transferencia");
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

  // Subida de Voucher a Google Drive
  const handleVoucherUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus("uploading");
    setComprobanteName(file.name);
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
            fileName: file.name,
            mimeType: file.type,
            base64Data
          })
        });

        if (uploadRes.ok) {
          const uploadResult = await uploadRes.json();
          if (uploadResult?.publicUrl) {
            setComprobanteUrl(uploadResult.publicUrl);
            setUploadStatus("done");
          } else {
            setVoucherError("La subida se completó, pero no se recibió la URL del voucher.");
            setUploadStatus("error");
          }
        } else {
          const errData = await uploadRes.json().catch(() => ({}));
          console.error("Error en respuesta de subida del voucher:", errData);
          setVoucherError("No se pudo subir el voucher. Puedes registrar el pago sin él.");
          setUploadStatus("error");
        }
      } catch (uploadErr) {
        console.error("Error de red al subir el voucher:", uploadErr);
        setVoucherError("Error de red al subir el voucher. Puedes registrar el pago sin él.");
        setUploadStatus("error");
      }
    };
    reader.onerror = () => {
      setVoucherError("No se pudo leer el archivo seleccionado.");
      setUploadStatus("error");
    };
    reader.readAsDataURL(file);
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

        if (res.ok) {
          await fetchLoanDetails();
        } else {
          const errData = await res.json().catch(() => ({}));
          setVoucherUpdateError(errData.error || "No se pudo adjuntar el voucher.");
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

  const { prestamo, pagosRealizados } = data;
  const debtState = buildPaymentSchedule(prestamo, pagosRealizados, new Date());
  const resumenDeuda = debtState.resumen;
  const cuotaSiguiente = debtState.cuotaSiguiente;
  const progressPercent = Math.min(100, resumenDeuda.totalExigible > 0 ? (resumenDeuda.totalPagado / resumenDeuda.totalExigible) * 100 : 0);
  const deudaTotalActual = resumenDeuda.totalExigible || prestamo.total_exigible_actual || prestamo.total_a_pagar;
  const cuotaRapida = cuotaSiguiente ? Math.min(resumenDeuda.saldoPendiente, cuotaSiguiente.montoExigible || cuotaSiguiente.montoCuotaBase || 0) : resumenDeuda.saldoPendiente;
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
                  <option value="Transferencia">Transferencia Bancaria</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Yape/Plin">Yape / Plin</option>
                  <option value="Depósito">Depósito Directo</option>
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
                    className={`flex flex-col items-center justify-center p-3.5 border border-dashed rounded-2xl cursor-pointer transition select-none min-h-[85px] ${
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
                          <p className="text-[9px] text-gray-500 font-semibold mt-0.5">Clic para cambiar</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-center">
                        <UploadCloud size={20} className="text-blue-400 group-hover/file:scale-105 transition-transform" />
                        <div>
                          <p className="font-extrabold text-xs text-slate-300">Subir imagen de voucher</p>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                            JPG, PNG o WEBP · Opcional
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
                        <div className="flex items-center gap-2">
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
                            <span className="text-slate-600 font-bold text-[10px] uppercase tracking-wider">- Sin Voucher -</span>
                          )}
                          <button
                            type="button"
                            onClick={() => voucherInputRefs.current[pago.id]?.click()}
                            disabled={voucherUpdatingId === pago.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/70 border border-slate-700 text-slate-300 hover:bg-slate-700 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-60"
                          >
                            {voucherUpdatingId === pago.id ? "Subiendo..." : (pago.comprobante_url ? "Actualizar Voucher" : "Adjuntar Voucher")}
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
                <div key={pago.id} className="bg-[#0A0A0C]/60 p-4 rounded-2xl border border-white/5 space-y-3 shadow-sm">
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
                          className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800/60 border border-slate-700 text-slate-300 rounded-md text-[9px] font-bold cursor-pointer disabled:opacity-60"
                        >
                          {voucherUpdatingId === pago.id ? "Subiendo..." : (pago.comprobante_url ? "Actualizar" : "Adjuntar")}
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
    </div>
  );
}
