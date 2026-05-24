import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Landmark, 
  Coins, 
  Loader2, 
  HandCoins, 
  Send, 
  Sparkles, 
  Check, 
  AlertCircle, 
  X,
  Image,
  ExternalLink,
  UploadCloud
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Tesseract from "tesseract.js";

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
  const [tipoMovimiento, setTipoMovimiento] = useState("Pago Ordinario");
  const [metodoPago, setMetodoPago] = useState("Transferencia");
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [pagoSuccess, setPagoSuccess] = useState("");

  // Estados para OCR y Voucher
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [comprobanteName, setComprobanteName] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // Procesamiento de Voucher con OCR local Tesseract.js
  const handleVoucherUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrProgress(0);
    setComprobanteName(file.name);
    setComprobanteUrl("");

    try {
      // 1. Ejecutar OCR localmente con Tesseract.js
      const { data: { text } } = await Tesseract.recognize(
        file,
        "spa",
        {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setOcrProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      console.log("OCR Texto Extraído:", text);

      // 2. Extraer Monto
      // Expresión regular robusta para monedas peruanas (S/., S/, s/., s/)
      const montoRegex = /(?:s\/\.?\s*)(\d+(?:\.\d{1,2})?)/i;
      const matchMonto = text.match(montoRegex);
      if (matchMonto && matchMonto[1]) {
        setMonto(matchMonto[1]);
      } else {
        // Buscar el número con decimales más probable
        const fallbackRegex = /\b\d+(?:\.\d{2})\b/;
        const matchFallback = text.match(fallbackRegex);
        if (matchFallback) {
          setMonto(matchFallback[0]);
        }
      }

      // 3. Extraer Método de Pago
      const lowerText = text.toLowerCase();
      if (lowerText.includes("yape")) {
        setMetodoPago("Yape/Plin");
      } else if (lowerText.includes("plin")) {
        setMetodoPago("Yape/Plin");
      } else if (
        lowerText.includes("bcp") || 
        lowerText.includes("bbva") || 
        lowerText.includes("interbank") || 
        lowerText.includes("transferencia") ||
        lowerText.includes("banco")
      ) {
        setMetodoPago("Transferencia");
      } else if (lowerText.includes("depósito") || lowerText.includes("deposito")) {
        setMetodoPago("Depósito");
      }

      // 4. Extraer Fecha (Formatos: DD/MM/AAAA, DD-MM-AAAA)
      const dateRegex = /(\d{2})[-/](\d{2})[-/](\d{4})/;
      const matchDate = text.match(dateRegex);
      if (matchDate) {
        const [_, day, month, year] = matchDate;
        setFechaPago(`${year}-${month}-${day}`);
      } else {
        // Fecha escrita como "de [mes] de"
        const monthsMap: Record<string, string> = {
          enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
          julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12"
        };
        const spanishDateRegex = /(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i;
        const matchSpanishDate = text.match(spanishDateRegex);
        if (matchSpanishDate) {
          const day = matchSpanishDate[1].padStart(2, "0");
          const monthName = matchSpanishDate[2].toLowerCase();
          const year = matchSpanishDate[3];
          const month = monthsMap[monthName];
          if (month) {
            setFechaPago(`${year}-${month}-${day}`);
          }
        }
      }

      // 5. Subir imagen a Supabase Storage bucket "vouchers"
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
            setComprobanteUrl(uploadResult.publicUrl);
          } else {
            console.error("Error en respuesta de subida del voucher");
          }
        } catch (uploadErr) {
          console.error("Error de comunicación de subida", uploadErr);
        }
      };
      reader.readAsDataURL(file);

    } catch (ocrErr) {
      console.error("Error al procesar el OCR:", ocrErr);
    } finally {
      setOcrLoading(false);
    }
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
          tipo_movimiento: tipoMovimiento,
          metodo_pago: metodoPago,
          fecha_pago: fechaPago,
          comprobante_url: comprobanteUrl || null
        })
      });

      if (res.ok) {
        setPagoSuccess("¡Pago registrado y amortización guardada con éxito!");
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
          saldoPendiente: data.prestamo.saldo_pendiente,
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
      `✍️ *Tipo:* ${pago.tipo_movimiento}\n\n` +
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
      `💵 *Total Exigible:* ${formatCurrency(prestamoObj.total_a_pagar)}\n` +
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

  // Función para estimar las fechas de las cuotas
  const calculateDueDate = (startDateStr: string, monthsToAdd: number) => {
    try {
      const date = new Date(startDateStr);
      if (isNaN(date.getTime())) return startDateStr;
      date.setMonth(date.getMonth() + monthsToAdd);
      return date.toISOString().split("T")[0];
    } catch (e) {
      return startDateStr;
    }
  };

  if (loading) {
    return (
      <div id="loan-details-loader" className="flex flex-col items-center justify-center p-12 min-h-[450px]">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={44} />
        <p className="text-slate-400 font-bold text-sm tracking-wide animate-pulse uppercase">Calculando amortización...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div id="loan-details-error-view" className="p-8 bento-card rounded-3xl max-w-lg mx-auto text-center space-y-5">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center text-rose-400 mx-auto shadow-lg">
          <X size={32} />
        </div>
        <h3 className="font-extrabold text-slate-100 text-lg">Error al cargar detalles</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{error || "No se encontró información del préstamo."}</p>
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
  const progressPercent = Math.min(100, (prestamo.total_pagado / prestamo.total_a_pagar) * 100);

  // Calcular cronograma de pagos sugerido (3 cuotas)
  const totalCuotas = 3;
  const cuotaMonto = prestamo.total_a_pagar / totalCuotas;
  const totalPagadoAcumulado = prestamo.total_pagado;

  const cuotasList = Array.from({ length: totalCuotas }).map((_, idx) => {
    const numCuota = idx + 1;
    const estimatedDate = calculateDueDate(prestamo.fecha_emision, numCuota);
    
    // Determinar estado de la cuota basado en pagos reales acumulados
    let estado = "Pendiente";
    let pagadoEnCuota = 0;
    
    const limiteCobro = cuotaMonto * numCuota;
    const inicioCobro = cuotaMonto * idx;
    
    if (totalPagadoAcumulado >= limiteCobro) {
      estado = "Pagado";
      pagadoEnCuota = cuotaMonto;
    } else if (totalPagadoAcumulado > inicioCobro) {
      estado = "Pago Parcial";
      pagadoEnCuota = totalPagadoAcumulado - inicioCobro;
    } else {
      estado = "Pendiente";
      pagadoEnCuota = 0;
    }

    return {
      numero: numCuota,
      monto: cuotaMonto,
      pagado: pagadoEnCuota,
      fechaVencimiento: estimatedDate,
      estado
    };
  });

  return (
    <div id="loan-details-view" className="space-y-6 font-sans">
      
      {/* Botón Volver */}
      <div className="flex justify-between items-center">
        <button
          id="btn-back-to-dashboard"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-400 transition cursor-pointer group py-2"
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
            <span className="text-[10px] bg-slate-950/70 text-indigo-300 border border-white/5 px-3 py-1 rounded-lg font-mono uppercase tracking-wider font-bold">
              ID: {prestamo.id.substring(0, 8)}
            </span>
            <span
              className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                prestamo.estado === "activo"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
            >
              {prestamo.estado === "activo" ? "Activo / Cobranza" : "Cancelado"}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none mt-1">
            {prestamo.cliente_nombre}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold uppercase tracking-wider">
              <Landmark size={14} className="text-indigo-400" />
              <span>Préstamo {prestamo.tipo_prestamo}</span>
            </div>
            <button
              onClick={handleShareDisbursement}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors ml-4 cursor-pointer"
            >
              <Send size={11} />
              <span>Compartir Desembolso</span>
            </button>
          </div>
        </div>

        <div className="text-left md:text-right border-t border-white/5 md:border-0 pt-4 md:pt-0 w-full md:w-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Saldo por Amortizar</span>
          <p className="text-3xl md:text-4xl font-black text-indigo-400 mt-1 tracking-tight font-mono">
            {formatCurrency(prestamo.saldo_pendiente)}
          </p>
        </div>
      </div>

      {/* Grid Bento del Préstamo */}
      <div id="loan-grid" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Infografía de Estado Financiero & Progreso - Columna 2/3 */}
        <div id="financial-info-card" className="bento-card p-6 rounded-3xl space-y-6 lg:col-span-2 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5">
              <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                <CreditCard size={16} />
              </div>
              <h2 className="font-extrabold text-white text-base tracking-tight">
                Estado Financiero del Préstamo
              </h2>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Capital Recibido</span>
                <span className="text-lg font-black text-slate-200 font-mono">{formatCurrency(prestamo.monto_capital)}</span>
              </div>
              <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Interés</span>
                <span className="text-lg font-black text-slate-200 font-mono">+{prestamo.tasa_interes_porcentaje}%</span>
              </div>
              <div className="bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block mb-1">Total Exigible</span>
                <span className="text-lg font-black text-indigo-400 font-mono">{formatCurrency(prestamo.total_a_pagar)}</span>
              </div>
            </div>

            {/* Barra de Progreso */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-bold text-slate-350">
                <span>Porcentaje Amortizado</span>
                <span className="font-mono text-emerald-400">{progressPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-950/70 h-4 rounded-full overflow-hidden p-0.5 border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full" 
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider pt-1">
                <span>Pagado: {formatCurrency(prestamo.total_pagado)}</span>
                <span>Pendiente: {formatCurrency(prestamo.saldo_pendiente)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 border-t border-white/5 text-xs text-slate-400 font-semibold select-none">
            <div className="flex items-center gap-2.5">
              <Calendar size={16} className="text-slate-500" />
              <span>Emisión de Crédito: <strong className="text-slate-200 font-mono">{prestamo.fecha_emision}</strong></span>
            </div>
            <div className="flex items-center gap-2.5">
              <Calendar size={16} className="text-slate-500" />
              <span>Plazo de Vencimiento: <strong className="text-slate-200 font-mono">{prestamo.fecha_vencimiento || "No establecido"}</strong></span>
            </div>
          </div>
        </div>

        {/* Formulario Registrar Pago - Columna 1/3 */}
        <div id="payment-form-card" className="bento-card p-6 rounded-3xl h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
              <HandCoins size={16} />
            </div>
            <h2 className="font-extrabold text-white text-base tracking-tight">Abonar a Cuenta</h2>
          </div>

          {prestamo.estado === "pagado" ? (
            <div className="p-6 bg-emerald-500/5 text-emerald-400 rounded-2xl text-center text-xs space-y-3 border border-emerald-500/10">
              <CheckCircle2 className="text-emerald-400 mx-auto" size={32} />
              <p className="font-extrabold text-slate-100 text-sm">Crédito Cancelado</p>
              <p className="leading-relaxed text-slate-400">
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
                    className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs font-semibold"
                  >
                    {pagoSuccess}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase block pl-1">Monto de Abono (S/.) *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-xs font-bold font-mono">S/.</span>
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
                    onClick={() => setMonto(String(Math.min(Math.round(prestamo.saldo_pendiente * 100) / 100, Math.round(cuotaMonto * 100) / 100)))}
                    className="px-2.5 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-[9px] font-extrabold uppercase hover:bg-indigo-500/20 transition cursor-pointer select-none"
                  >
                    Siguiente Cuota ({formatCurrency(Math.min(prestamo.saldo_pendiente, cuotaMonto))})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonto(String(Math.round(prestamo.saldo_pendiente * 100) / 100))}
                    className="px-2.5 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl text-[9px] font-extrabold uppercase hover:bg-purple-500/20 transition cursor-pointer select-none"
                  >
                    Liquidar Saldo ({formatCurrency(prestamo.saldo_pendiente)})
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase block pl-1">Tipo de Movimiento</label>
                <select
                  value={tipoMovimiento}
                  onChange={(e) => setTipoMovimiento(e.target.value)}
                  className="w-full glass-input rounded-2xl p-3 bg-slate-900 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  <option value="Pago Ordinario">Pago Ordinario</option>
                  <option value="Abono a Capital">Abono a Capital</option>
                  <option value="Pago de Intereses">Pago de Intereses</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase block pl-1">Medio de Pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full glass-input rounded-2xl p-3 bg-slate-900 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  <option value="Transferencia">Transferencia Bancaria</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Yape/Plin">Yape / Plin</option>
                  <option value="Depósito">Depósito Directo</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase block pl-1">Fecha de Operación</label>
                <input
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  className="w-full glass-input rounded-2xl p-3 text-xs font-bold text-slate-200"
                />
              </div>

              {/* Cargar Voucher con OCR */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase block pl-1">
                  Cargar Voucher (OCR Local)
                </label>
                <div className="relative group/file">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleVoucherUpload}
                    className="hidden"
                    id="voucher-upload-input"
                    disabled={ocrLoading}
                  />
                  <label
                    htmlFor="voucher-upload-input"
                    className={`flex flex-col items-center justify-center p-3.5 border border-dashed rounded-2xl cursor-pointer transition select-none min-h-[85px] ${
                      ocrLoading
                        ? "bg-slate-950/20 border-indigo-500/30 text-indigo-400 cursor-not-allowed"
                        : comprobanteUrl
                        ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40"
                        : "bg-slate-950/40 border-white/10 hover:border-indigo-500/40 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {ocrLoading ? (
                      <div className="flex flex-col items-center gap-2 w-full">
                        <Loader2 className="animate-spin text-indigo-400" size={20} />
                        <span className="text-[9px] font-bold text-slate-400 tracking-wider">
                          Procesando OCR: {ocrProgress}%
                        </span>
                        <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden p-px border border-white/5">
                          <div
                            className="bg-indigo-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${ocrProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : comprobanteUrl ? (
                      <div className="flex items-center gap-2 text-center text-xs">
                        <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                        <div className="text-left">
                          <p className="font-extrabold text-slate-200 text-[11px]">Voucher Listo</p>
                          <p className="text-[9px] text-slate-450 font-bold truncate max-w-[170px]">
                            {comprobanteName}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-center">
                        <UploadCloud size={20} className="text-indigo-400 group-hover/file:scale-105 transition-transform" />
                        <div>
                          <p className="font-extrabold text-xs text-slate-350">Subir imagen de voucher</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                            Auto-completa monto, banco y fecha
                          </p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full glow-btn text-white font-bold py-3 rounded-2xl text-xs sm:text-sm transition cursor-pointer flex justify-center items-center gap-2 min-h-[48px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Procesando abono...</span>
                  </>
                ) : (
                  <span>Registrar Amortización</span>
                )}
              </button>

              <div className="bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-2xl text-[9px] sm:text-[10px] text-slate-400 leading-relaxed font-medium">
                💡 <strong>Política de Amortización:</strong> Los abonos se aplican de manera automática amortizando primero los intereses generados y luego reduciendo el capital deudor, conforme a las políticas establecidas.
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Cronograma de Cuotas Sugerido (Pantalla Completa) */}
      <div className="w-full">
        
        {/* Bento Box: Cronograma de Pagos Sugeridos */}
        <div id="amortization-schedule-card" className="bento-card p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                <Calendar size={16} />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base tracking-tight">Cronograma de Pagos</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Plan de amortización en 3 cuotas</p>
              </div>
            </div>
            <span className="text-[10px] bg-slate-950/70 border border-white/5 text-slate-400 font-bold px-2.5 py-1 rounded-lg">Sugerido</span>
          </div>

          <div className="space-y-3">
            {cuotasList.map((cuota) => (
              <div 
                key={cuota.numero}
                className="p-4 bg-slate-950/30 rounded-2xl border border-white/5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${
                    cuota.estado === "Pagado" 
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
                      : cuota.estado === "Pago Parcial"
                      ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                      : "bg-slate-800 border border-slate-700 text-slate-400"
                  }`}>
                    {cuota.numero}
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-200 text-sm block">Cuota {cuota.numero}</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Vence: {cuota.fechaVencimiento}</span>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <span className="text-sm font-black text-slate-200 font-mono block">{formatCurrency(cuota.monto)}</span>
                  <div className="flex items-center justify-end gap-1.5">
                    {cuota.estado === "Pagado" ? (
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/5 px-2 py-0.5 rounded-md border border-emerald-500/10 flex items-center gap-1">
                        <Check size={9} />
                        Pagado
                      </span>
                    ) : cuota.estado === "Pago Parcial" ? (
                      <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest bg-amber-500/5 px-2 py-0.5 rounded-md border border-amber-500/10 flex items-center gap-1">
                        <Clock size={9} />
                        Parcial ({formatCurrency(cuota.pagado)})
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Historial de Amortizaciones (Diseño Dual) */}
      <div id="amortizations-history-card" className="bento-card rounded-3xl overflow-hidden">
        <div className="p-5 border-b border-white/5 bg-slate-950/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
              <Coins size={16} />
            </div>
            <h3 className="font-extrabold text-white text-base tracking-tight">Historial de Amortizaciones</h3>
          </div>
          <span className="text-[10px] bg-slate-950/70 border border-white/5 text-indigo-300 font-bold px-3 py-1 rounded-lg font-mono select-none">
            Abonos: {pagosRealizados.length}
          </span>
        </div>

        {pagosRealizados.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-slate-950/10">
            <Coins className="mx-auto text-slate-600 mb-3" size={40} />
            <p className="font-extrabold text-sm text-slate-300">No hay amortizaciones registradas</p>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
              Ingresa el monto del abono en el formulario superior para registrar la primera amortización de este crédito.
            </p>
          </div>
        ) : (
          <>
            {/* HISTORIAL TABLA: Escritorio */}
            <div className="hidden sm:block overflow-x-auto text-xs md:text-sm">
              <table className="w-full text-left font-sans">
                <thead>
                  <tr className="bg-slate-950/20 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 select-none">
                    <th className="px-6 py-4.5">ID Transacción</th>
                    <th className="px-6 py-4.5">Fecha Pago</th>
                    <th className="px-6 py-4.5">Tipo Movimiento</th>
                    <th className="px-6 py-4.5">Método de Recibo</th>
                    <th className="px-6 py-4.5">Comprobante</th>
                    <th className="px-6 py-4.5 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {pagosRealizados.map((pago: any) => (
                    <tr key={pago.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-6 py-4 text-xs font-mono text-slate-500 select-all">
                        {pago.id.substring(0, 18)}...
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-300 font-mono">
                        {pago.fecha_pago}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                          {pago.tipo_movimiento}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-350">
                        {pago.metodo_pago}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {pago.comprobante_url ? (
                            <a
                              href={pago.comprobante_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors"
                            >
                              <Image size={12} />
                              <span>Ver Voucher</span>
                              <ExternalLink size={10} className="opacity-60" />
                            </a>
                          ) : (
                            <span className="text-slate-600 font-bold text-[10px] uppercase tracking-wider">- Sin Voucher -</span>
                          )}
                          <button
                            onClick={() => handleShareReceipt(pago)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer"
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
            <div className="sm:hidden p-4 space-y-3 bg-slate-950/20">
              {pagosRealizados.map((pago: any) => (
                <div key={pago.id} className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-3 shadow-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-mono text-slate-500">ID: {pago.id.substring(0, 8)}...</span>
                    <span className="text-[10px] text-slate-400 font-bold font-mono">{pago.fecha_pago}</span>
                  </div>

                  <div className="flex justify-between items-end pt-1">
                    <div className="space-y-1">
                      <span className="text-[9px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider block w-fit">
                        {pago.tipo_movimiento}
                      </span>
                      <span className="text-[10px] text-slate-450 font-bold block text-slate-300">Vía: {pago.metodo_pago}</span>
                      <div className="flex items-center gap-2 mt-1.5">
                        {pago.comprobante_url ? (
                          <a
                            href={pago.comprobante_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-colors"
                          >
                            <Image size={10} />
                            <span>Ver Voucher</span>
                            <ExternalLink size={8} className="opacity-60" />
                          </a>
                        ) : (
                          <span className="text-slate-600 font-bold text-[9px] uppercase tracking-wider select-none">- Sin Voucher -</span>
                        )}
                        <button
                          onClick={() => handleShareReceipt(pago)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-lg font-bold text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
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
