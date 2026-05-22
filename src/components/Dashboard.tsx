import React, { useState, useEffect, useRef } from "react";
import { TrendingUp, CreditCard, Users, PlusCircle, ArrowUpRight, Coins, Loader2, Wallet, Landmark, Activity, X, ShieldAlert, Sparkles, Brain, CheckCircle, Terminal, UploadCloud, FileImage } from "lucide-react";
import Tesseract from "tesseract.js";
import { Cliente } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface DashboardProps {
  onSelectLoan: (id: string) => void;
  onNavigateToClients: () => void;
  onNavigateToAI: () => void;
}

export function Dashboard({ onSelectLoan, onNavigateToClients, onNavigateToAI }: DashboardProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [ultimosPrestamos, setUltimosPrestamos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para el Evaluador de Riesgo Matemático
  const [aiClienteId, setAiClienteId] = useState("");

  // Estados para Carga de Voucher Exprés & OCR local
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [vcrFile, setVcrFile] = useState<File | null>(null);
  const [vcrBase64, setVcrBase64] = useState("");
  const [vcrFileName, setVcrFileName] = useState("");
  const [vcrMimeType, setVcrMimeType] = useState("");
  const [vcrOcrLoading, setVcrOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState("");
  const [vcrMonto, setVcrMonto] = useState("");
  const [vcrMetodoPago, setVcrMetodoPago] = useState("Yape");
  const [vcrFechaPago, setVcrFechaPago] = useState(new Date().toISOString().split("T")[0]);
  const [vcrSelectedClienteId, setVcrSelectedClienteId] = useState("");
  const [vcrClienteSearch, setVcrClienteSearch] = useState("");
  const [showVcrClienteDropdown, setShowVcrClienteDropdown] = useState(false);
  const [vcrSelectedLoanId, setVcrSelectedLoanId] = useState("");
  const [vcrRegistering, setVcrRegistering] = useState(false);

  // Ref para input de archivo invisible
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado para el modal de nuevo préstamo
  const [showModal, setShowModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState("");
  const [monto, setMonto] = useState("");
  const [tasa, setTasa] = useState("10"); // Default 10%
  const [tipo, setTipo] = useState("Personal");
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split("T")[0]);
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [creating, setCreating] = useState(false);

  // Estados de Búsqueda Rápida Autocomplete y Filtros de Dashboard (UI/UX)
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [evalClientSearch, setEvalClientSearch] = useState("");
  const [showEvalDropdown, setShowEvalDropdown] = useState(false);
  const [loanSearchQuery, setLoanSearchQuery] = useState("");
  const [showAllLoans, setShowAllLoans] = useState(false);

  // Cargar datos del dashboard (con inicialización automática y silenciosa de la base de datos)
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch("/api/dashboard");
      const data = await res.json();

      if (res.ok) {
        setMetrics(data.metrics);
        setUltimosPrestamos(data.ultimosPrestamos);
      } else {
        // Inicialización automática transparente si detectamos falta de estructura en Google Sheets
        if (data.error && (data.error.includes("Google Sheets") || data.error.includes("not found") || data.error.includes("configuración") || data.error.includes("inicializar"))) {
          try {
            const initRes = await fetch("/api/initialize-sheets", { method: "POST" });
            if (initRes.ok) {
              // Re-intentar fetch silenciosamente
              const retryRes = await fetch("/api/dashboard");
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                setMetrics(retryData.metrics);
                setUltimosPrestamos(retryData.ultimosPrestamos);
              } else {
                setError("El Google Sheet se configuró pero no tiene datos aún.");
              }
            } else {
              setError("No se pudo conectar con Google Sheets de forma automática. Revisa las credenciales de tu archivo .env.");
            }
          } catch (initErr) {
            setError("Error al inicializar de manera silenciosa las hojas de Google Sheets.");
          }
        } else {
          setError(data.detail || data.error || "Error al obtener info del dashboard");
        }
      }

      // Cargar clientes para los select dropdowns
      const resClientes = await fetch("/api/clientes");
      if (resClientes.ok) {
        const dataClientes = await resClientes.json();
        setClientes(dataClientes);
      }

      // Cargar logs de auditoría en tiempo real
      const resLogs = await fetch("/api/logs");
      if (resLogs.ok) {
        const dataLogs = await resLogs.json();
        setLogs(dataLogs);
      }
    } catch (err: any) {
      setError("Error de comunicación con el servidor backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Sincronizar el texto de búsqueda con el cliente seleccionado en el Evaluador
  useEffect(() => {
    if (aiClienteId) {
      const match = clientes.find(c => c.id === aiClienteId);
      if (match && evalClientSearch !== match.nombre_completo) {
        setEvalClientSearch(match.nombre_completo);
      }
    } else {
      setEvalClientSearch("");
    }
  }, [aiClienteId, clientes]);

  // Sincronizar el texto de búsqueda con el cliente seleccionado en el Modal
  useEffect(() => {
    if (selectedCliente) {
      const match = clientes.find(c => c.id === selectedCliente);
      if (match && clientSearch !== match.nombre_completo) {
        setClientSearch(match.nombre_completo);
      }
    }
  }, [selectedCliente, clientes]);

  // Resolver los préstamos del cliente seleccionado para el voucher en tiempo real en memoria
  const vcrClientLoans = vcrSelectedClienteId 
    ? ultimosPrestamos.filter(p => p.cliente_id === vcrSelectedClienteId && p.estado === "activo")
    : [];

  // Efecto para auto-seleccionar préstamo si el cliente tiene exactamente 1 préstamo activo
  useEffect(() => {
    if (vcrSelectedClienteId) {
      const activeLoans = ultimosPrestamos.filter(p => p.cliente_id === vcrSelectedClienteId && p.estado === "activo");
      if (activeLoans.length === 1) {
        setVcrSelectedLoanId(activeLoans[0].id);
      } else {
        setVcrSelectedLoanId("");
      }
    } else {
      setVcrSelectedLoanId("");
    }
  }, [vcrSelectedClienteId, ultimosPrestamos]);

  // Sincronizar el texto de búsqueda con el cliente seleccionado para el voucher
  useEffect(() => {
    if (vcrSelectedClienteId) {
      const match = clientes.find(c => c.id === vcrSelectedClienteId);
      if (match && vcrClienteSearch !== match.nombre_completo) {
        setVcrClienteSearch(match.nombre_completo);
      }
    } else {
      setVcrClienteSearch("");
    }
  }, [vcrSelectedClienteId, clientes]);

  // Auto-calcular fecha de vencimiento a 30 días si cambia la de emisión
  useEffect(() => {
    if (fechaEmision) {
      const d = new Date(fechaEmision + "T12:00:00");
      d.setDate(d.getDate() + 30);
      setFechaVencimiento(d.toISOString().split("T")[0]);
    }
  }, [fechaEmision]);

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCliente || !monto) {
      alert("Por favor completa los campos obligatorios.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/prestamos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: selectedCliente,
          monto_capital: parseFloat(monto),
          tasa_interes_porcentaje: parseFloat(tasa),
          fecha_emision: fechaEmision,
          fecha_vencimiento: fechaVencimiento,
          tipo_prestamo: tipo
        })
      });

      if (res.ok) {
        setShowModal(false);
        setSelectedCliente("");
        setClientSearch("");
        setShowClientDropdown(false);
        setMonto("");
        setTasa("10");
        setTipo("Personal");
        setFechaEmision(new Date().toISOString().split("T")[0]);
        setFechaVencimiento("");
        fetchDashboardData();
      } else {
        const errData = await res.json();
        alert(errData.error || "Ocurrió un error al otorgar el préstamo");
      }
    } catch (err) {
      alert("Error al otorgar préstamo.");
    } finally {
      setCreating(false);
    }
  };

  // Algoritmo de Riesgo Crediticio Matemático (Costo S/. 0.00)
  const getClientRiskAssessment = (cliente: Cliente) => {
    const activeLoans = cliente.prestamos_activos || 0;
    const totalLoans = cliente.total_prestamos || 0;
    const exigible = Number(cliente.total_exigible) || 0;
    const amortizado = Number(cliente.total_amortizado) || 0;
    const outstanding = Math.max(0, exigible - amortizado);
    
    let level: "Excelente" | "Bajo" | "Medio" | "Alto";
    let score = 100;
    let rationale = "";
    let recommendations: string[] = [];

    if (activeLoans > 1 || outstanding > 1500) {
      level = "Alto";
      score = activeLoans > 2 ? 25 : 45;
      rationale = `El prestatario tiene un nivel de endeudamiento elevado en el sistema con ${activeLoans} préstamos activos y un saldo deudor acumulado de ${formatCurrency(outstanding)}.`;
      recommendations = [
        "Rechazar preventivamente nuevos préstamos hasta liquidar deudas actuales.",
        "Establecer prioridades en el canal de cobros diarios/semanales.",
        "Solicitar un codeudor solidario o aval real si se realiza refinanciación."
      ];
    } else if (activeLoans === 1 || outstanding > 0) {
      level = "Medio";
      score = 70;
      rationale = `El cliente cuenta con un crédito vigente y un saldo pendiente de ${formatCurrency(outstanding)}. Comportamiento regular.`;
      recommendations = [
        "Limitar nuevas ampliaciones a un máximo del 30% del capital amortizado.",
        "Verificar puntualidad e historial de amortizaciones del último préstamo.",
        "Monitorear la fecha de vencimiento y enviar recordatorios anticipados."
      ];
    } else if (totalLoans > 0) {
      level = "Excelente";
      score = 98;
      rationale = `¡Excelente prestatario! Cuenta con historial impecable en PrestaFacilito, habiendo pagado por completo sus ${totalLoans} préstamo(s) anterior(es).`;
      recommendations = [
        "Aprobar líneas de crédito de forma rápida y simplificada.",
        "Ofrecer tasas preferenciales o plazos más flexibles como incentivo.",
        "Priorizar su atención telefónica y fidelización comercial."
      ];
    } else {
      level = "Bajo";
      score = 90;
      rationale = `Cliente nuevo sin historial crediticio registrado en PrestaFacilito. Se encuentra libre de deudas.`;
      recommendations = [
        "Iniciar la relación con montos mínimos (ej. menor a S/. 500) para medir puntualidad.",
        "Solicitar referencias personales o comerciales básicas.",
        "Estructurar cuotas en plazos cortos (semanales o quincenales) para mayor control."
      ];
    }

    return { level, score, rationale, recommendations };
  };

  // Proceso de lectura OCR local del Voucher con Tesseract.js (Costo S/. 0.00)
  const handleOcrProcess = async (file: File) => {
    setVcrFile(file);
    setVcrFileName(file.name);
    setVcrMimeType(file.type);
    setVcrOcrLoading(true);
    setOcrProgress("Iniciando...");
    setShowVoucherModal(true);

    // Generar vista base64
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        const base64String = reader.result.split(",")[1];
        setVcrBase64(base64String);
      }
    };
    reader.readAsDataURL(file);

    try {
      const worker = await Tesseract.createWorker("spa", 1, {
        logger: m => {
          if (m.status === "recognizing text") {
            setOcrProgress(`Analizando: ${Math.round(m.progress * 100)}%`);
          } else {
            setOcrProgress("Preparando OCR...");
          }
        }
      });
      
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      console.log("OCR Extracted Text:", text);

      // 1. Extraer Monto
      const montoRegex = /(?:s\/\.?\s*)(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i;
      const matchMonto = text.match(montoRegex);
      if (matchMonto) {
        let cleanVal = matchMonto[1].replace(/,/g, "");
        setVcrMonto(cleanVal);
      } else {
        const genericRegex = /\b(\d{2,5}(?:\.\d{2}))\b/;
        const matchGen = text.match(genericRegex);
        if (matchGen) {
          setVcrMonto(matchGen[1]);
        } else {
          setVcrMonto("");
        }
      }

      // 2. Extraer Fecha de Pago
      const dateRegex = /(\d{2})[/-](\d{2})[/-](\d{4})/;
      const matchDate = text.match(dateRegex);
      if (matchDate) {
        const yyyy = matchDate[3];
        const mm = matchDate[2];
        const dd = matchDate[1];
        setVcrFechaPago(`${yyyy}-${mm}-${dd}`);
      } else {
        const textLower = text.toLowerCase();
        const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        let foundDate = false;
        for (let i = 0; i < meses.length; i++) {
          if (textLower.includes(meses[i])) {
            const dayRegex = new RegExp(`(\\d{1,2})\\s*(?:de)?\\s*${meses[i]}`);
            const matchDay = textLower.match(dayRegex);
            if (matchDay) {
              const dd = matchDay[1].padStart(2, "0");
              const mm = String(i + 1).padStart(2, "0");
              const yyyy = new Date().getFullYear();
              setVcrFechaPago(`${yyyy}-${mm}-${dd}`);
              foundDate = true;
              break;
            }
          }
        }
        if (!foundDate) {
          setVcrFechaPago(new Date().toISOString().split("T")[0]);
        }
      }

      // 3. Extraer Método de Pago
      const textLower = text.toLowerCase();
      if (textLower.includes("yape")) {
        setVcrMetodoPago("Yape");
      } else if (textLower.includes("plin")) {
        setVcrMetodoPago("Plin");
      } else if (textLower.includes("bcp") || textLower.includes("banca móvil")) {
        setVcrMetodoPago("Transferencia BCP");
      } else if (textLower.includes("bbva")) {
        setVcrMetodoPago("Transferencia BBVA");
      } else if (textLower.includes("interbank")) {
        setVcrMetodoPago("Transferencia Interbank");
      } else {
        setVcrMetodoPago("Yape");
      }

      setOcrProgress("Lectura Completa");
    } catch (err) {
      console.error("Error en OCR:", err);
      setOcrProgress("Error al leer");
    } finally {
      setVcrOcrLoading(false);
    }
  };

  // Registrar abono de voucher y subir constancia de pago a Supabase Storage
  const handleVoucherRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vcrSelectedClienteId || !vcrSelectedLoanId || !vcrMonto) {
      alert("Por favor selecciona un cliente, préstamo activo y confirma el monto.");
      return;
    }

    setVcrRegistering(true);
    try {
      let uploadedUrl = null;

      if (vcrBase64) {
        const uploadRes = await fetch("/api/upload-voucher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: vcrFileName || "voucher.jpg",
            mimeType: vcrMimeType || "image/jpeg",
            base64Data: vcrBase64
          })
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          uploadedUrl = uploadData.publicUrl;
        }
      }

      const paymentRes = await fetch(`/api/prestamos/${vcrSelectedLoanId}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto: parseFloat(vcrMonto),
          tipo_movimiento: "Pago Ordinario",
          metodo_pago: vcrMetodoPago,
          fecha_pago: vcrFechaPago,
          comprobante_url: uploadedUrl
        })
      });

      if (paymentRes.ok) {
        setShowVoucherModal(false);
        setVcrFile(null);
        setVcrBase64("");
        setVcrFileName("");
        setVcrMimeType("");
        setVcrMonto("");
        setVcrMetodoPago("Yape");
        setVcrFechaPago(new Date().toISOString().split("T")[0]);
        setVcrSelectedClienteId("");
        setVcrClienteSearch("");
        setVcrSelectedLoanId("");
        fetchDashboardData();
      } else {
        const errData = await paymentRes.json();
        alert(errData.error || "Ocurrió un error al registrar el abono.");
      }
    } catch (err) {
      console.error("Error al registrar abono:", err);
      alert("Fallo al registrar la amortización.");
    } finally {
      setVcrRegistering(false);
    }
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

  // Filtrado y renderizado dinámico de préstamos en el Dashboard (UI/UX)
  const filteredPrestamos = ultimosPrestamos.filter((p) => {
    const query = loanSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      p.cliente_nombre.toLowerCase().includes(query) ||
      p.tipo_prestamo.toLowerCase().includes(query) ||
      String(p.monto_capital).includes(query) ||
      p.fecha_emision.includes(query) ||
      (p.estado === "activo" ? "activo" : "pagado").includes(query)
    );
  });

  const displayedPrestamos = showAllLoans
    ? filteredPrestamos
    : filteredPrestamos.slice(0, 5);

  if (loading) {
    return (
      <div id="dashboard-loader" className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={38} />
        <p className="text-slate-400 font-semibold text-sm">Cargando métricas desde Google Sheets...</p>
      </div>
    );
  }

  return (
    <div id="dashboard-view" className="space-y-6">
      
      {/* Cabecera del Panel */}
      <div id="dashboard-header" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-indigo-300 tracking-tight">
            Panel de Control
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">Indicadores clave y análisis inteligente de PrestaFacilito</p>
        </div>
        <div className="flex w-full sm:w-auto gap-2.5 flex-wrap">
          <button
            id="btn-goto-clientes"
            onClick={onNavigateToClients}
            className="flex-1 sm:flex-none px-4 py-3 bg-[#0f172a]/60 hover:bg-[#1e293b]/60 border border-white/5 text-slate-350 font-bold text-xs rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md min-h-[44px]"
          >
            <Users size={15} />
            <span>Clientes</span>
          </button>
          <button
            id="btn-upload-voucher-quick"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-none px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-650 hover:from-emerald-550 hover:to-teal-550 text-white font-bold text-xs rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md min-h-[44px]"
          >
            <UploadCloud size={15} />
            <span>Subir Voucher</span>
          </button>
          <button
            id="btn-open-prestamo-modal"
            onClick={() => setShowModal(true)}
            className="flex-1 sm:flex-none px-4 py-3 bg-indigo-650 hover:bg-indigo-550 text-white font-bold text-xs rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/20 min-h-[44px]"
          >
            <PlusCircle size={15} />
            <span>Nuevo préstamo</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl text-xs flex items-start gap-2.5">
          <ShieldAlert className="shrink-0 text-amber-400 animate-bounce" size={16} />
          <div>
            <span className="font-bold block">Conexión con Supabase Database</span>
            <span className="opacity-90 leading-normal">{error}</span>
          </div>
        </div>
      )}

      {/* METRIC BENTO BOXES */}
      {metrics && (
        <div id="metrics-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1 - Capital Prestado */}
          <div id="card-capital-prestado" className="bento-card p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Capital Prestado Total</span>
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform duration-200">
                <Landmark size={18} />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-200 tracking-tight font-mono">
                {formatCurrency(metrics.totalCapitalPrestado)}
              </span>
              <p className="text-xs text-indigo-450 font-bold mt-2 flex items-center gap-1">
                <Activity size={12} />
                <span>Flujo emitido</span>
              </p>
            </div>
          </div>

          {/* Card 2 - Total Recuperado */}
          <div id="card-total-recuperado" className="bento-card p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Recuperado</span>
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform duration-200">
                <Wallet size={18} />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-205 tracking-tight font-mono">
                {formatCurrency(metrics.totalRecuperado)}
              </span>
              <p className="text-xs text-emerald-450 font-bold mt-2 flex items-center gap-1.5">
                <TrendingUp size={12} />
                <span>
                  {metrics.totalCapitalPrestado > 0 
                    ? `${((metrics.totalRecuperado / metrics.totalCapitalPrestado) * 100).toFixed(1)}% cobrado`
                    : "0% cobrado"}
                </span>
              </p>
            </div>
          </div>

          {/* Card 3 - Créditos Activos */}
          <div id="card-prestamos-activos" className="bento-card p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Créditos Activos</span>
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform duration-200">
                <CreditCard size={18} />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-200 tracking-tight font-mono">
                {metrics.prestamosActivos}
              </span>
              <p className="text-xs text-amber-450 font-bold mt-2 flex items-center gap-1">
                <span>Historial: {metrics.totalPrestamosCount} créditos totales</span>
              </p>
            </div>
          </div>

          {/* Card 4 - Registrar Venta (Otorgar Crédito) Glowing Button */}
          <div id="card-registrar-venta" className="bento-card p-5 rounded-2xl relative overflow-hidden group border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-[#0f172a]/60 to-[#0f172a]/60 flex flex-col justify-between shadow-[0_0_15px_rgba(99,102,241,0.15)] min-h-[140px]">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500 animate-pulse" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Acceso Rápido</span>
              <div className="w-7 h-7 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-300 animate-pulse">
                <Sparkles size={13} />
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 w-full py-2.5 bg-gradient-to-r from-indigo-650 to-purple-650 hover:from-indigo-550 hover:to-purple-550 text-white font-extrabold text-xs rounded-xl transition duration-300 shadow-[0_0_10px_rgba(99,102,241,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] flex items-center justify-center gap-2 cursor-pointer border border-indigo-400/30 transform active:scale-98 min-h-[48px]"
            >
              <PlusCircle size={15} />
              <span>Registrar Préstamo / Venta</span>
            </button>
          </div>
        </div>
      )}

      {/* CORE BENTO ROW: AI EVALUATOR & RECENT LOANS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA: HERRAMIENTAS INTELIGENTES (EVALUADOR LOCAL & REPORTE IA) */}
        <div className="space-y-6 lg:col-span-1 flex flex-col justify-between h-full">
          
          {/* SECCIÓN 1: EVALUADOR DE RIESGO MATEMÁTICO LOCAL (S/. 0.00) */}
          <div className="bento-card p-6 rounded-2xl flex flex-col space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                <Activity size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-[#f8fafc] text-sm tracking-tight">Evaluador de Riesgo Local</h3>
                <p className="text-[10px] text-slate-400">Análisis Matemático Fórmulas (S/. 0.00)</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Seleccionar Prestatario</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Buscar prestatario por nombre..."
                    value={evalClientSearch}
                    onChange={(e) => {
                      setEvalClientSearch(e.target.value);
                      setShowEvalDropdown(true);
                    }}
                    onFocus={() => setShowEvalDropdown(true)}
                    className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none pr-8 font-semibold"
                  />
                  {aiClienteId && (
                    <button
                      type="button"
                      onClick={() => {
                        setAiClienteId("");
                        setEvalClientSearch("");
                        setShowEvalDropdown(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 transition-colors cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {showEvalDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowEvalDropdown(false)}
                    />
                    <div className="absolute left-0 right-0 mt-1 bg-[#0a0f1d] border border-white/10 rounded-xl max-h-48 overflow-y-auto z-20 shadow-xl custom-scrollbar divide-y divide-white/5">
                      {clientes.filter(c => 
                        c.nombre_completo.toLowerCase().includes(evalClientSearch.toLowerCase()) ||
                        (c.telefono && c.telefono.includes(evalClientSearch))
                      ).length === 0 ? (
                        <div className="p-3 text-xs text-slate-500 text-center">
                          No se encontraron clientes.
                        </div>
                      ) : (
                        clientes.filter(c => 
                          c.nombre_completo.toLowerCase().includes(evalClientSearch.toLowerCase()) ||
                          (c.telefono && c.telefono.includes(evalClientSearch))
                        ).map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setAiClienteId(c.id);
                              setEvalClientSearch(c.nombre_completo);
                              setShowEvalDropdown(false);
                            }}
                            className={`w-full text-left p-2.5 px-3.5 hover:bg-indigo-500/10 text-xs transition duration-150 flex items-center justify-between cursor-pointer ${
                              aiClienteId === c.id ? "bg-indigo-500/20 text-indigo-300 font-extrabold" : "text-slate-200 font-semibold"
                            }`}
                          >
                            <span>{c.nombre_completo}</span>
                            {c.telefono && (
                              <span className="text-[10px] text-slate-450 font-mono font-medium">{c.telefono.startsWith("'") ? c.telefono.substring(1) : c.telefono}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              {aiClienteId && clientes.find(c => c.id === aiClienteId) ? (() => {
                const selectedRiskClient = clientes.find(c => c.id === aiClienteId)!;
                const assessment = getClientRiskAssessment(selectedRiskClient);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0f172a]/80 border border-white/5 rounded-xl p-4 space-y-3.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Score & Riesgo</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                          assessment.level === "Excelente" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          assessment.level === "Bajo" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                          assessment.level === "Medio" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                          "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse"
                        }`}>
                          {assessment.level}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-200">{assessment.score}/100</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full ${
                          assessment.level === "Excelente" ? "bg-emerald-500" :
                          assessment.level === "Bajo" ? "bg-blue-500" :
                          assessment.level === "Medio" ? "bg-amber-500" :
                          "bg-rose-500"
                        }`}
                        style={{ width: `${assessment.score}%` }}
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Dictamen de Cartera</span>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{assessment.rationale}</p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Políticas de Crédito sugeridas</span>
                      <ul className="space-y-1.5">
                        {assessment.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-[10.5px] text-slate-350 flex items-start gap-1.5 leading-normal">
                            <CheckCircle className={`shrink-0 mt-0.5 ${
                              assessment.level === "Excelente" ? "text-emerald-400" :
                              assessment.level === "Bajo" ? "text-blue-550" :
                              assessment.level === "Medio" ? "text-amber-400" :
                              "text-rose-400"
                            }`} size={11} />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                );
              })() : (
                <div className="p-4 bg-slate-900/30 border border-white/3 rounded-xl text-center text-slate-500 text-[11px] leading-normal">
                  Selecciona un prestatario arriba para evaluar instantáneamente su endeudamiento actual y perfil de riesgo en base a datos agregados del sistema.
                </div>
              )}
            </div>
          </div>

          {/* SECCIÓN 2: CARGA RÁPIDA DE VOUCHER POR OCR (S/. 0.00) */}
          <div className="bento-card p-6 rounded-2xl flex flex-col space-y-4 relative overflow-hidden group border border-emerald-500/10 hover:border-emerald-500/20 transition-all duration-300 shadow-md shadow-emerald-500/[0.02] hover:shadow-emerald-500/[0.05]">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500/80" />
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                <UploadCloud size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-[#f8fafc] text-sm tracking-tight">Carga Rápida de Voucher</h3>
                <p className="text-[10px] text-slate-400">Autoregistro con OCR Local (S/. 0.00)</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-455 leading-relaxed">
              Sube una captura de Yape, Plin o banco. El OCR local extraerá monto, fecha y método de forma automática e inteligente.
            </p>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-emerald-500/25 hover:border-emerald-500/40 bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] p-5 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 text-center"
            >
              <FileImage className="text-emerald-400 shrink-0 group-hover:scale-105 transition-transform" size={24} />
              <div className="space-y-0.5">
                <span className="text-[11px] font-extrabold text-slate-200 block">Subir captura o comprobante</span>
                <span className="text-[9px] text-slate-455 block font-medium">JPEG, PNG o PDF</span>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-white py-2.5 rounded-xl font-bold text-xs flex justify-center items-center gap-1.5 cursor-pointer bg-gradient-to-r from-emerald-650 to-teal-650 hover:from-emerald-550 hover:to-teal-550 min-h-[40px] shadow-md shadow-emerald-500/5 hover:shadow-emerald-500/15 transition-all font-semibold"
            >
              <UploadCloud size={14} />
              <span>Seleccionar Archivo</span>
            </button>
          </div>

        </div>

        {/* BENTO BOX: RECENT LOANS */}
        <div className="bento-card rounded-2xl overflow-hidden flex flex-col lg:col-span-2">
          <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-extrabold text-[#f8fafc] text-sm tracking-tight">Cartera de Préstamos</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Gestión y búsqueda integrada en tiempo real</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-60">
                <input
                  type="text"
                  placeholder="🔍 Buscar por prestatario o tipo..."
                  value={loanSearchQuery}
                  onChange={(e) => setLoanSearchQuery(e.target.value)}
                  className="w-full pl-3.5 pr-8 py-2 glass-input rounded-xl text-xs font-semibold"
                />
                {loanSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLoanSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-1 rounded-md font-mono select-none hidden sm:inline-block">En vivo</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between">
            {filteredPrestamos.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <Coins className="mx-auto text-slate-705 mb-3" size={36} />
                <p className="text-sm font-bold text-slate-350">No se encontraron préstamos</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Prueba modificando los términos del filtro de búsqueda o registra un nuevo crédito.
                </p>
              </div>
            ) : (
              <>
                <div>
                  {/* TABLA: Visible únicamente en escritorio */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs md:text-sm">
                      <thead>
                        <tr className="bg-white/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/5 select-none">
                          <th className="px-6 py-4">Cliente</th>
                          <th className="px-6 py-4">Capital Otorgado</th>
                          <th className="px-6 py-4">Tasa (%)</th>
                          <th className="px-6 py-4">F. Emisión</th>
                          <th className="px-6 py-4">Tipo</th>
                          <th className="px-6 py-4">Estado</th>
                          <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {displayedPrestamos.map((prestamo) => (
                          <tr key={prestamo.id} className="hover:bg-white/2 transition duration-150">
                            <td className="px-6 py-4 font-bold text-slate-205">
                              {prestamo.cliente_nombre}
                            </td>
                            <td className="px-6 py-4 font-extrabold text-white font-mono text-xs md:text-sm">
                              {formatCurrency(prestamo.monto_capital)}
                            </td>
                            <td className="px-6 py-4 text-slate-300 font-bold font-mono">
                              {prestamo.tasa_interes_porcentaje}%
                            </td>
                            <td className="px-6 py-4 text-slate-400 font-medium">
                              {prestamo.fecha_emision}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] bg-[#0f172a] text-slate-350 border border-white/5 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                {prestamo.tipo_prestamo}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  prestamo.estado === "activo"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                                }`}
                              >
                                {prestamo.estado === "activo" ? "Activo" : "Pagado"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => onSelectLoan(prestamo.id)}
                                className="text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 py-1.5 px-3 rounded-lg font-bold transition duration-150 cursor-pointer inline-flex items-center gap-1"
                              >
                                <span>Detalle</span>
                                <ArrowUpRight size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* CARD LIST: Diseñado exclusivamente para celulares (menor a sm) */}
                  <div className="sm:hidden p-4 space-y-3 bg-[#0f172a]/20 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {displayedPrestamos.map((prestamo) => (
                      <div 
                        key={prestamo.id} 
                        onClick={() => onSelectLoan(prestamo.id)}
                        className="bg-[#0f172a]/60 p-4 rounded-xl border border-white/5 hover:border-indigo-500/30 transition duration-150 space-y-3 cursor-pointer shadow-sm active:scale-98"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-205 text-sm leading-tight">{prestamo.cliente_nombre}</h4>
                            <span className="text-[10px] text-slate-450 font-semibold">{prestamo.fecha_emision}</span>
                          </div>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${
                              prestamo.estado === "activo"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-500/10 text-slate-455 border border-slate-500/20"
                            }`}
                          >
                            {prestamo.estado === "activo" ? "Activo" : "Pagado"}
                          </span>
                        </div>

                        <div className="flex justify-between items-end pt-1">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase block">Monto Capital</span>
                            <span className="font-black text-white font-mono text-sm leading-none">
                              {formatCurrency(prestamo.monto_capital)}
                            </span>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[9px] bg-[#0f172a] text-slate-350 px-2 py-0.5 border border-white/5 rounded-md font-bold uppercase tracking-wider">
                              {prestamo.tipo_prestamo}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* BOTÓN DE EXPANSIÓN: "Ver Todos" / "Ver Menos" */}
                {filteredPrestamos.length > 5 && (
                  <div className="p-3 bg-white/[0.01] border-t border-white/5 flex justify-center items-center">
                    <button
                      type="button"
                      onClick={() => setShowAllLoans(!showAllLoans)}
                      className="px-5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-350 text-xs font-bold rounded-xl transition duration-150 cursor-pointer flex items-center gap-1.5"
                    >
                      {showAllLoans ? (
                        <span>Mostrar Menos (Ver 5 más recientes)</span>
                      ) : (
                        <span>Ver Todos los Préstamos Filtrados ({filteredPrestamos.length})</span>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      {/* BENTO BOX: REAL-TIME AUDIT LOGS / BITÁCORA DE AUDITORÍA */}
      <div id="logs-audit-section" className="bento-card p-6 rounded-2xl flex flex-col space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Terminal size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-[#f8fafc] text-sm tracking-tight">Bitácora de Auditoría en Tiempo Real</h3>
              <p className="text-[10px] text-slate-400">Historial reciente de operaciones (Supabase Audit Logs)</p>
            </div>
          </div>
          <span className="text-[10px] bg-[#070a13] border border-white/5 text-slate-400 px-2.5 py-0.5 rounded-md font-mono select-none">
            Total logs: {logs.length}
          </span>
        </div>

        <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No se han registrado operaciones en la bitácora aún.
            </div>
          ) : (
            logs.slice(0, 15).map((log) => {
              // Asignar colores o íconos dependiendo del tipo de acción
              const isDanger = log.accion.includes("ELIMINAR") || log.accion.includes("FALLO") || log.accion.includes("RECHAZAR");
              const isSuccess = log.accion.includes("PAGO") || log.accion.includes("CREAR") || log.accion.includes("CONECTAR") || log.accion.includes("SEMBRAR");
              
              return (
                <div 
                  key={log.id} 
                  className="p-3 rounded-xl bg-[#0f172a]/60 border border-white/3 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        isDanger ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                        isSuccess ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      }`}>
                        {log.accion}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold font-mono">@{log.usuario}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-normal">{log.detalles}</p>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono shrink-0 whitespace-nowrap pt-0.5">
                    {new Date(log.fecha_hora).toLocaleTimeString("es-PE", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL REGISTRO NUEVO PRESTAMO CON BENTO DARK OVERHAUL */}
      <AnimatePresence>
        {showModal && (
          <div id="modal-loans" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[#0f172a] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/5"
            >
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#070a13]/40">
                <h3 className="font-extrabold text-[#f8fafc] text-sm md:text-base">Registrar Nuevo Préstamo</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-205 p-1.5 hover:bg-white/5 rounded-lg transition duration-150 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateLoan} className="p-6 space-y-4">
                {clientes.length === 0 ? (
                  <div className="p-4 bg-amber-500/10 text-amber-300 rounded-2xl text-xs space-y-2 border border-amber-500/20">
                    <p className="font-bold">¡No hay clientes registrados!</p>
                    <p>Antes de poder otorgar un préstamo, debes registrar al menos un cliente en el directorio de clientes.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        onNavigateToClients();
                      }}
                      className="underline font-extrabold hover:text-amber-200 block mt-2 text-indigo-400 cursor-pointer"
                    >
                      Ir a Registrar Cliente &rarr;
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5 relative">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Seleccionar Cliente *</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="🔍 Escribe para buscar cliente..."
                          value={clientSearch}
                          onChange={(e) => {
                            setClientSearch(e.target.value);
                            setShowClientDropdown(true);
                          }}
                          onFocus={() => setShowClientDropdown(true)}
                          className="w-full glass-input rounded-xl p-2.5 text-xs sm:text-sm text-slate-200 outline-none pr-10 font-semibold"
                          required={!selectedCliente}
                        />
                        {selectedCliente && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCliente("");
                              setClientSearch("");
                              setShowClientDropdown(false);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 transition-colors cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      
                      {showClientDropdown && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowClientDropdown(false)}
                          />
                          <div className="absolute left-0 right-0 mt-1 bg-[#0a0f1d] border border-white/10 rounded-xl max-h-48 overflow-y-auto z-20 shadow-xl custom-scrollbar divide-y divide-white/5">
                            {clientes.filter(c => 
                              c.nombre_completo.toLowerCase().includes(clientSearch.toLowerCase()) ||
                              (c.telefono && c.telefono.includes(clientSearch))
                            ).length === 0 ? (
                              <div className="p-3 text-xs text-slate-500 text-center">
                                No se encontraron clientes.
                              </div>
                            ) : (
                              clientes.filter(c => 
                                c.nombre_completo.toLowerCase().includes(clientSearch.toLowerCase()) ||
                                (c.telefono && c.telefono.includes(clientSearch))
                              ).map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCliente(c.id);
                                    setClientSearch(c.nombre_completo);
                                    setShowClientDropdown(false);
                                  }}
                                  className={`w-full text-left p-2.5 px-3.5 hover:bg-indigo-500/10 text-xs transition duration-150 flex items-center justify-between cursor-pointer ${
                                    selectedCliente === c.id ? "bg-indigo-500/20 text-indigo-300 font-extrabold" : "text-slate-200 font-semibold"
                                  }`}
                                >
                                  <span>{c.nombre_completo}</span>
                                  {c.telefono && (
                                    <span className="text-[10px] text-slate-450 font-mono font-medium">{c.telefono.startsWith("'") ? c.telefono.substring(1) : c.telefono}</span>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Monto Capital (S/.) *</label>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          placeholder="Ej. 5000"
                          value={monto}
                          onChange={(e) => setMonto(e.target.value)}
                          className="w-full glass-input rounded-xl p-2.5 text-xs sm:text-sm text-slate-200 outline-none"
                          required
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Tasa Interés (%) *</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Porcentaje, ej: 10"
                          value={tasa}
                          onChange={(e) => setTasa(e.target.value)}
                          className="w-full glass-input rounded-xl p-2.5 text-xs sm:text-sm text-slate-200 outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Tipo de Préstamo</label>
                        <select
                          value={tipo}
                          onChange={(e) => setTipo(e.target.value)}
                          className="w-full glass-input rounded-xl p-2.5 text-xs sm:text-sm text-slate-200 outline-none"
                        >
                          <option value="Personal" className="bg-[#0f172a]">Personal</option>
                          <option value="Negocio" className="bg-[#0f172a]">Negocio</option>
                          <option value="Hipotecario" className="bg-[#0f172a]">Hipotecario</option>
                          <option value="Automotriz" className="bg-[#0f172a]">Automotriz</option>
                        </select>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Fecha Emisión</label>
                        <input
                          type="date"
                          value={fechaEmision}
                          onChange={(e) => setFechaEmision(e.target.value)}
                          className="w-full glass-input rounded-xl p-2.5 text-xs sm:text-sm text-slate-250 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Fecha de Vencimiento</label>
                      <input
                        type="date"
                        value={fechaVencimiento}
                        onChange={(e) => setFechaVencimiento(e.target.value)}
                        className="w-full glass-input rounded-xl p-2.5 text-xs sm:text-sm text-slate-250 outline-none"
                      />
                    </div>

                    {/* Resumen explicativo del cálculo financiero */}
                    {parseFloat(monto) > 0 && (
                      <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-2.5">
                        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">Resumen y Guía del Crédito</span>
                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase tracking-wide">Monto Capital:</span>
                            <span className="text-slate-200 font-mono font-bold">{formatCurrency(parseFloat(monto) || 0)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase tracking-wide">Interés ({(parseFloat(tasa) || 0)}%):</span>
                            <span className="text-slate-200 font-mono font-bold">+{formatCurrency((parseFloat(monto) || 0) * ((parseFloat(tasa) || 0) / 100))}</span>
                          </div>
                          <div className="col-span-2 pt-2 border-t border-white/5 flex justify-between items-center text-sm font-black">
                            <span className="text-indigo-300">Total Deuda Exigible:</span>
                            <span className="text-indigo-400 font-mono">{formatCurrency((parseFloat(monto) || 0) * (1 + (parseFloat(tasa) || 0) / 100))}</span>
                          </div>
                        </div>
                        <p className="text-[9.5px] text-slate-400 leading-relaxed pt-1.5 border-t border-white/5">
                          💡 <strong>¿Cómo funciona?</strong> La tasa del <strong>{(parseFloat(tasa) || 0)}%</strong> se añade directamente al capital de <strong>{formatCurrency(parseFloat(monto) || 0)}</strong>, sumando un total exigible de <strong>{formatCurrency((parseFloat(monto) || 0) * (1 + (parseFloat(tasa) || 0) / 100))}</strong>. Esto equivale a 3 cuotas sugeridas de <strong>{formatCurrency(((parseFloat(monto) || 0) * (1 + (parseFloat(tasa) || 0) / 100)) / 3)}</strong>.
                        </p>
                      </div>
                    )}

                    <div className="pt-4 border-t border-white/5 flex justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="px-4 py-2.5 hover:bg-white/5 rounded-xl text-slate-400 font-bold text-xs sm:text-sm transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="px-5 py-2.5 glow-btn text-white font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                      >
                        {creating ? (
                          <>
                            <Loader2 className="animate-spin" size={14} />
                            <span>Otorgando...</span>
                          </>
                        ) : (
                          <span>Otorgar Crédito</span>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invisible file input for quick upload */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleOcrProcess(e.target.files[0]);
          }
        }}
      />

      {/* MODAL EXPRESS VOUCHER UPLOAD / LOCAL OCR */}
      <AnimatePresence>
        {showVoucherModal && (
          <div id="modal-voucher" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-[#0f172a] rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-white/5 flex flex-col md:flex-row"
            >
              {/* Left Column: Image / OCR Progress */}
              <div className="w-full md:w-1/2 bg-[#070a13]/50 p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-white/5 relative min-h-[300px]">
                {vcrOcrLoading ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                      <UploadCloud className="text-emerald-400 animate-pulse" size={24} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-extrabold text-white">Procesando localmente...</h4>
                      <p className="text-xs text-emerald-400 font-mono tracking-wide font-bold">{ocrProgress}</p>
                      <p className="text-[10px] text-slate-500 max-w-[200px] leading-normal pt-1">
                        Tesseract.js está extrayendo información en tu navegador. S/. 0.00 en tokens de API.
                      </p>
                    </div>
                  </div>
                ) : vcrBase64 ? (
                  <div className="w-full h-full flex flex-col items-center justify-between space-y-4">
                    <span className="text-[9px] font-black text-emerald-450 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md tracking-wider flex items-center gap-1 font-mono uppercase absolute top-4 left-4">
                      <CheckCircle size={10} />
                      <span>OCR Activo</span>
                    </span>
                    
                    <div className="w-full max-h-[250px] overflow-hidden rounded-2xl border border-white/5 shadow-inner flex items-center justify-center bg-black/20 p-2 mt-4">
                      <img 
                        src={`data:${vcrMimeType || "image/jpeg"};base64,${vcrBase64}`} 
                        alt="Comprobante de Pago" 
                        className="max-w-full max-h-[230px] object-contain rounded-xl"
                      />
                    </div>
                    
                    <div className="w-full text-center p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Archivo cargado</span>
                      <span className="text-xs text-slate-205 font-mono font-semibold block truncate mt-0.5">{vcrFileName}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center space-y-3">
                    <UploadCloud className="text-slate-600 animate-bounce" size={32} />
                    <span className="text-xs font-bold text-slate-400">Ningún archivo cargado</span>
                  </div>
                )}
              </div>

              {/* Right Column: Fields / Match / Action Form */}
              <div className="w-full md:w-1/2 p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <div>
                      <h3 className="font-extrabold text-[#f8fafc] text-sm md:text-base">Registrar Abono OCR</h3>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Autogestión de Comprobante</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowVoucherModal(false);
                        setVcrFile(null);
                        setVcrBase64("");
                        setVcrFileName("");
                        setVcrMimeType("");
                        setVcrMonto("");
                        setVcrSelectedClienteId("");
                        setVcrClienteSearch("");
                        setVcrSelectedLoanId("");
                      }}
                      className="text-slate-400 hover:text-slate-205 p-1.5 hover:bg-white/5 rounded-lg transition duration-150 cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Autocomplete de Clientes */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Asociar a Cliente *</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="🔍 Escribe para buscar cliente..."
                        value={vcrClienteSearch}
                        onChange={(e) => {
                          setVcrClienteSearch(e.target.value);
                          setShowVcrClienteDropdown(true);
                        }}
                        onFocus={() => setShowVcrClienteDropdown(true)}
                        className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none pr-10 font-semibold"
                        required
                      />
                      {vcrSelectedClienteId && (
                        <button
                          type="button"
                          onClick={() => {
                            setVcrSelectedClienteId("");
                            setVcrClienteSearch("");
                            setShowVcrClienteDropdown(false);
                            setVcrSelectedLoanId("");
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-202 p-0.5 transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {showVcrClienteDropdown && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setShowVcrClienteDropdown(false)}
                        />
                        <div className="absolute left-0 right-0 mt-1 bg-[#0a0f1d] border border-white/10 rounded-xl max-h-40 overflow-y-auto z-20 shadow-xl custom-scrollbar divide-y divide-white/5">
                          {clientes.filter(c => 
                            c.nombre_completo.toLowerCase().includes(vcrClienteSearch.toLowerCase()) ||
                            (c.telefono && c.telefono.includes(vcrClienteSearch))
                          ).length === 0 ? (
                            <div className="p-3 text-xs text-slate-500 text-center">
                              No se encontraron clientes.
                            </div>
                          ) : (
                            clientes.filter(c => 
                              c.nombre_completo.toLowerCase().includes(vcrClienteSearch.toLowerCase()) ||
                              (c.telefono && c.telefono.includes(vcrClienteSearch))
                            ).map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setVcrSelectedClienteId(c.id);
                                  setVcrClienteSearch(c.nombre_completo);
                                  setShowVcrClienteDropdown(false);
                                }}
                                className={`w-full text-left p-2.5 px-3.5 hover:bg-indigo-500/10 text-xs transition duration-150 flex items-center justify-between cursor-pointer ${
                                  vcrSelectedClienteId === c.id ? "bg-indigo-500/20 text-indigo-300 font-extrabold" : "text-slate-200 font-semibold"
                                }`}
                              >
                                <span>{c.nombre_completo}</span>
                                {c.telefono && (
                                  <span className="text-[10px] text-slate-455 font-mono font-medium">{c.telefono.startsWith("'") ? c.telefono.substring(1) : c.telefono}</span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Detalle Préstamos del Cliente */}
                  {vcrSelectedClienteId && (
                    <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-2">
                      <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider block">Resolución de Deuda Activa</span>
                      {vcrClientLoans.length === 0 ? (
                        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-[11px] leading-normal font-semibold flex items-center gap-2">
                          <ShieldAlert size={14} className="shrink-0 animate-pulse text-rose-400" />
                          <span>Este cliente está solvente (0 deudas activas).</span>
                        </div>
                      ) : vcrClientLoans.length === 1 ? (
                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-[11px] leading-normal font-semibold flex items-center gap-2">
                          <CheckCircle size={14} className="shrink-0 text-emerald-400" />
                          <div>
                            <span className="block text-[10px] text-slate-450 font-bold uppercase">Préstamo Único Activo</span>
                            <span className="block mt-0.5">{vcrClientLoans[0].tipo_prestamo} — Capital: {formatCurrency(vcrClientLoans[0].monto_capital)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider block">Seleccionar Préstamo Destino *</label>
                          <select
                            value={vcrSelectedLoanId}
                            onChange={(e) => setVcrSelectedLoanId(e.target.value)}
                            className="w-full glass-input rounded-xl p-2 text-xs text-slate-200 outline-none"
                            required
                          >
                            <option value="" className="bg-[#0f172a]">-- Elegir Préstamo --</option>
                            {vcrClientLoans.map(p => (
                              <option key={p.id} value={p.id} className="bg-[#0f172a]">
                                {p.tipo_prestamo} — Capital: S/. {p.monto_capital} (F. Emisión: {p.fecha_emision})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Monto y Fecha */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Monto Confirmado (S/.) *</label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="Monto"
                        value={vcrMonto}
                        onChange={(e) => setVcrMonto(e.target.value)}
                        className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold font-mono"
                        required
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Fecha de Pago *</label>
                      <input
                        type="date"
                        value={vcrFechaPago}
                        onChange={(e) => setVcrFechaPago(e.target.value)}
                        className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold"
                        required
                      />
                    </div>
                  </div>

                  {/* Método de Pago */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Medio de Pago *</label>
                    <select
                      value={vcrMetodoPago}
                      onChange={(e) => setVcrMetodoPago(e.target.value)}
                      className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold"
                      required
                    >
                      <option value="Yape" className="bg-[#0f172a]">Yape</option>
                      <option value="Plin" className="bg-[#0f172a]">Plin</option>
                      <option value="Transferencia BCP" className="bg-[#0f172a]">Transferencia BCP</option>
                      <option value="Transferencia BBVA" className="bg-[#0f172a]">Transferencia BBVA</option>
                      <option value="Transferencia Interbank" className="bg-[#0f172a]">Transferencia Interbank</option>
                      <option value="Efectivo" className="bg-[#0f172a]">Efectivo</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowVoucherModal(false);
                      setVcrFile(null);
                      setVcrBase64("");
                      setVcrFileName("");
                      setVcrMimeType("");
                      setVcrMonto("");
                      setVcrSelectedClienteId("");
                      setVcrClienteSearch("");
                      setVcrSelectedLoanId("");
                    }}
                    className="px-4 py-2.5 hover:bg-white/5 rounded-xl text-slate-400 font-bold text-xs sm:text-sm transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleVoucherRegister}
                    disabled={vcrRegistering || !vcrSelectedClienteId || !vcrSelectedLoanId || !vcrMonto || vcrOcrLoading}
                    className="px-5 py-2.5 glow-btn text-white font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-650 to-teal-650 disabled:opacity-50 font-semibold"
                  >
                    {vcrRegistering ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        <span>Registrando...</span>
                      </>
                    ) : (
                      <span>Registrar Pago</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
