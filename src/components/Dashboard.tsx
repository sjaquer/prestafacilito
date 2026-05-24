import React, { useState, useEffect, useRef } from "react";
import { 
  TrendingUp, CreditCard, Users, PlusCircle, ArrowUpRight, Coins, Loader2, 
  Wallet, Landmark, Activity, X, ShieldAlert, CheckCircle, Terminal, 
  UploadCloud, FileImage, Clock3, CalendarDays, Gauge, Target, Phone, MessageSquare 
} from "lucide-react";
import Tesseract from "tesseract.js";
import { Cliente } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface DashboardProps {
  onSelectLoan: (id: string) => void;
  onNavigateToClients: () => void;
}

export function Dashboard({ onSelectLoan, onNavigateToClients }: DashboardProps) {
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
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Cargar datos del dashboard
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
        // Inicialización automática transparente
        if (data.error && (data.error.includes("Google Sheets") || data.error.includes("not found") || data.error.includes("configuración") || data.error.includes("inicializar"))) {
          try {
            const initRes = await fetch("/api/initialize-sheets", { method: "POST" });
            if (initRes.ok) {
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
      rationale = `El prestatario tiene un nivel de endeudamiento elevado con ${activeLoans} préstamos activos y un saldo deudor acumulado de ${formatCurrency(outstanding)}.`;
      recommendations = [
        "Rechazar preventivamente nuevos préstamos hasta liquidar deudas vigentes.",
        "Priorizar visitas y llamadas en el canal de cobros.",
        "Solicitar un codeudor solidario o aval para futuras operaciones."
      ];
    } else if (activeLoans === 1 || outstanding > 0) {
      level = "Medio";
      score = 70;
      rationale = `El cliente cuenta con un crédito vigente y un saldo pendiente de ${formatCurrency(outstanding)}. Comportamiento regular.`;
      recommendations = [
        "Limitar nuevas ampliaciones de capital por el momento.",
        "Monitorear la puntualidad de sus cuotas actuales.",
        "Enviar recordatorios amistosos 2 días antes de la fecha de cobro."
      ];
    } else if (totalLoans > 0) {
      level = "Excelente";
      score = 98;
      rationale = `¡Excelente prestatario! Historial impecable con ${totalLoans} préstamo(s) totalmente cancelado(s).`;
      recommendations = [
        "Aprobar ampliaciones de crédito de forma rápida y preferente.",
        "Ofrecer tasas reducidas o incentivos de fidelidad.",
        "Brindar plazos flexibles adaptados a su negocio."
      ];
    } else {
      level = "Bajo";
      score = 90;
      rationale = `Cliente nuevo sin historial registrado en PrestaFacilito. Se encuentra libre de deudas.`;
      recommendations = [
        "Comenzar con montos prudentes (menores a S/. 500) para medir puntualidad.",
        "Estructurar plazos cortos (semanales o quincenales).",
        "Solicitar referencias comerciales básicas."
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
            setOcrProgress(`Leyendo: ${Math.round(m.progress * 100)}%`);
          } else {
            setOcrProgress("Cargando OCR...");
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

      setOcrProgress("Lectura Completada");
    } catch (err) {
      console.error("Error en OCR:", err);
      setOcrProgress("Fallo al leer");
    } finally {
      setVcrOcrLoading(false);
    }
  };

  // Registrar abono de voucher
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

  // Generador de enlaces para WhatsApp rápidos
  const getWhatsAppLink = (loan: any) => {
    const cliente = clientes.find(c => c.id === loan.cliente_id);
    if (!cliente || !cliente.telefono) return null;
    
    const phone = cliente.telefono.replace(/[^\d+]/g, "").trim();
    if (!phone) return null;

    const capital = parseFloat(loan.monto_capital) || 0;
    const interest = parseFloat(loan.tasa_interes_porcentaje) || 0;
    const totalExigible = capital * (1 + interest / 100);

    const formattedAmount = formatCurrency(totalExigible);
    const text = `¡Hola, ${loan.cliente_nombre}! Te saludamos de parte de PrestaFacilito. 🇵🇪 Te recordamos amablemente tu cuota/saldo pendiente de ${formattedAmount} con vencimiento el ${loan.fecha_vencimiento}. Agradecemos tu puntualidad y apoyo. ¡Que tengas un gran día!`;
    
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date(nowTick);
  today.setHours(0, 0, 0, 0);

  const activeLoans = ultimosPrestamos.filter((p) => p.estado === "activo");
  const activeLoansSortedByDueDate = [...activeLoans].sort(
    (a, b) => new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime()
  );
  
  const overdueLoans = activeLoans.filter((p) => new Date(`${p.fecha_vencimiento}T00:00:00`).getTime() < today.getTime());
  const dueSoonLoans = activeLoans.filter((p) => {
    const dueDate = new Date(`${p.fecha_vencimiento}T00:00:00`);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / dayMs);
    return diffDays >= 0 && diffDays <= 7;
  });

  const estimatedExigible = ultimosPrestamos.reduce(
    (sum, loan) => sum + (Number(loan.monto_capital) || 0) * (1 + (Number(loan.tasa_interes_porcentaje) || 0) / 100),
    0
  );
  const totalRecuperado = Number(metrics?.totalRecuperado) || 0;
  const capitalPrestado = Number(metrics?.totalCapitalPrestado) || 0;
  const saldoPendiente = Math.max(0, estimatedExigible - totalRecuperado);
  
  const recoveryRate = estimatedExigible > 0 ? Math.min(100, (totalRecuperado / estimatedExigible) * 100) : 0;
  const healthRate = activeLoans.length > 0 ? Math.max(0, 100 - (overdueLoans.length / activeLoans.length) * 100) : 100;

  const getRemainingDays = (dateValue: string) => {
    const dueDate = new Date(`${dateValue}T00:00:00`);
    return Math.ceil((dueDate.getTime() - today.getTime()) / dayMs);
  };

  const getLoanTimer = (loan: any) => {
    const remainingDays = getRemainingDays(loan.fecha_vencimiento);
    const emissionDate = new Date(`${loan.fecha_emision}T00:00:00`);
    const dueDate = new Date(`${loan.fecha_vencimiento}T00:00:00`);
    const totalWindowDays = Math.max(1, Math.ceil((dueDate.getTime() - emissionDate.getTime()) / dayMs));
    const elapsedDays = Math.min(totalWindowDays, Math.max(0, totalWindowDays - Math.max(remainingDays, 0)));
    const progress = remainingDays < 0 ? 100 : Math.min(100, (elapsedDays / totalWindowDays) * 100);
    
    let label = "";
    if (remainingDays < 0) {
      const absDays = Math.abs(remainingDays);
      label = `Atrasado ${absDays} d${absDays === 1 ? "" : "s"}`;
    } else if (remainingDays === 0) {
      label = "Vence hoy";
    } else {
      label = `Faltan ${remainingDays} d${remainingDays === 1 ? "" : "s"}`;
    }

    return {
      remainingDays,
      progress,
      label,
      status: remainingDays < 0 ? "danger" : remainingDays <= 3 ? "urgent" : remainingDays <= 7 ? "warning" : "healthy"
    };
  };

  // Círculo de vencimiento con WhatsApp rápido integrado
  const CircularTimerCard = ({ loan }: { loan: any }) => {
    const timer = getLoanTimer(loan);
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (circumference * timer.progress) / 100;
    
    const ringColor = timer.status === "danger"
      ? "text-rose-500"
      : timer.status === "urgent"
        ? "text-amber-500"
        : timer.status === "warning"
          ? "text-yellow-400"
          : "text-emerald-500";

    const waLink = getWhatsAppLink(loan);

    return (
      <div className="rounded-2xl border border-white/5 bg-[#0f172a]/40 p-5 flex items-center justify-between gap-4 shadow-lg shadow-black/10 hover:border-white/10 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          {/* Círculo de progreso */}
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 80 80" className={`h-20 w-20 -rotate-90 ${ringColor}`}>
              <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="6" fill="none" className="opacity-10" />
              <circle
                cx="40"
                cy="40"
                r={radius}
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-extrabold text-white leading-none">
                {timer.remainingDays < 0 ? Math.abs(timer.remainingDays) : Math.max(timer.remainingDays, 0)}
              </span>
              <span className="mt-0.5 text-[8.5px] font-bold uppercase tracking-wider text-slate-400">
                {timer.remainingDays < 0 ? "Mora" : timer.remainingDays === 0 ? "Hoy" : "Días"}
              </span>
            </div>
          </div>

          {/* Información del crédito */}
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white truncate">{loan.cliente_nombre}</h4>
            <p className="text-xs text-slate-400 mt-0.5">{loan.tipo_prestamo} · <span className="font-mono text-[11px] font-bold">{formatCurrency(loan.monto_capital)}</span></p>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold flex items-center gap-1">
              <Clock3 size={10} />
              Vence: {loan.fecha_vencimiento}
            </p>
          </div>
        </div>

        {/* Acciones del vencimiento */}
        <div className="flex flex-col items-end gap-2.5 shrink-0">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border ${
            timer.status === "danger" ? "border-rose-500/20 bg-rose-500/10 text-rose-300" :
            timer.status === "urgent" ? "border-amber-500/20 bg-amber-500/10 text-amber-300" :
            timer.status === "warning" ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-250" :
            "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          }`}>
            {timer.label}
          </span>

          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Notificar Cobro por WhatsApp"
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold bg-emerald-555 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-md shadow-emerald-550/15"
            >
              <MessageSquare size={12} />
              <span>Cobrar</span>
            </a>
          )}
        </div>
      </div>
    );
  };

  // Filtrado de préstamos
  const filteredPrestamos = ultimosPrestamos.filter((p) => {
    const query = loanSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      p.cliente_nombre.toLowerCase().includes(query) ||
      p.tipo_prestamo.toLowerCase().includes(query) ||
      String(p.monto_capital).includes(query) ||
      p.fecha_emision.includes(query)
    );
  });

  const displayedPrestamos = showAllLoans
    ? filteredPrestamos
    : filteredPrestamos.slice(0, 5);

  if (loading) {
    return (
      <div id="dashboard-loader" className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
        <p className="text-slate-400 font-semibold text-sm">Cargando base de datos de préstamos...</p>
      </div>
    );
  }

  return (
    <div id="dashboard-view" className="space-y-8 max-w-7xl mx-auto pb-10">
      
      {/* 1. SECCIÓN DE OPERACIONES RÁPIDAS (Verticalidad Nivel 1) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-md font-mono font-bold uppercase tracking-wider select-none">
            Consola del Administrador
          </span>
          <h1 className="text-2xl font-black text-white mt-1 tracking-tight">PrestaFacilito</h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            id="btn-upload-voucher-quick"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] text-xs font-bold text-slate-200 transition cursor-pointer min-h-[42px]"
          >
            <UploadCloud size={14} />
            <span>Registrar Abono OCR</span>
          </button>
          
          <button
            id="btn-open-prestamo-modal"
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-4.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-extrabold text-white transition shadow-lg shadow-indigo-500/15 cursor-pointer min-h-[42px]"
          >
            <PlusCircle size={14} />
            <span>Otorgar Préstamo</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl text-xs flex items-start gap-2.5">
          <ShieldAlert className="shrink-0 text-amber-400 mt-0.5" size={15} />
          <div>
            <span className="font-bold block text-sm">Alerta del Sistema</span>
            <span className="opacity-90 leading-normal mt-0.5 block">{error}</span>
          </div>
        </div>
      )}

      {/* 2. FILA DE KPIs FINANCIEROS (Verticalidad Nivel 2) */}
      <div id="metrics-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1 - Capital Prestado */}
        <div className="bg-[#0f172a]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Capital Colocado</span>
            <Landmark size={15} />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white tracking-tight font-mono">
              {formatCurrency(capitalPrestado)}
            </span>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wide">Flujo emitido total</p>
          </div>
        </div>

        {/* KPI 2 - Total Recuperado */}
        <div className="bg-[#0f172a]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Monto Cobrado</span>
            <Wallet size={15} />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white tracking-tight font-mono">
              {formatCurrency(totalRecuperado)}
            </span>
            <p className="text-[10px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
              <TrendingUp size={11} />
              <span>{recoveryRate.toFixed(1)}% recuperado</span>
            </p>
          </div>
        </div>

        {/* KPI 3 - Saldo Pendiente */}
        <div className="bg-[#0f172a]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Saldo por Cobrar</span>
            <Target size={15} />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white tracking-tight font-mono">
              {formatCurrency(saldoPendiente)}
            </span>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wide">Capital + Interés restante</p>
          </div>
        </div>

        {/* KPI 4 - Mora Activa */}
        <div className="bg-[#0f172a]/60 border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Salud de Cartera</span>
            <Activity size={15} />
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black tracking-tight font-mono ${overdueLoans.length > 0 ? 'text-rose-400' : 'text-white'}`}>
              {healthRate.toFixed(0)}%
            </span>
            <p className="text-[10px] font-bold mt-1 flex items-center gap-1 uppercase tracking-wide">
              <span className={overdueLoans.length > 0 ? 'text-rose-400' : 'text-slate-550'}>
                {overdueLoans.length} créditos en mora
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. CHART DE RECUPERACIÓN VISUAL (Verticalidad Nivel 3) */}
      <div className="bg-[#0f172a]/60 border border-white/5 p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-3 text-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Balance y Retorno de Cartera</span>
          <span className="font-mono font-bold text-white">{recoveryRate.toFixed(1)}% Cobrado / {(100 - recoveryRate).toFixed(1)}% Pendiente</span>
        </div>
        
        {/* Barra de progreso bicolor */}
        <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-500 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${recoveryRate}%` }} />
          <div className="h-full bg-indigo-500/80 transition-all duration-500" style={{ width: `${100 - recoveryRate}%` }} />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2.5 font-semibold">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> Cobro Realizado ({formatCurrency(totalRecuperado)})</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" /> Saldo Pendiente ({formatCurrency(saldoPendiente)})</span>
        </div>
      </div>

      {/* 4. RADAR DE VENCIMIENTOS (Verticalidad Nivel 4) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-white tracking-tight">Radar de Vencimientos</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Control de cobros y alertas de mora inmediata</p>
        </div>

        {activeLoansSortedByDueDate.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.01] text-center text-slate-500 text-xs">
            No hay préstamos activos con fechas de vencimiento pendientes.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeLoansSortedByDueDate.slice(0, 3).map((loan) => (
              <CircularTimerCard key={loan.id} loan={loan} />
            ))}
          </div>
        )}
      </div>

      {/* 5. CARTERA DE PRÉSTAMOS (Verticalidad Nivel 5) */}
      <div className="bg-[#0f172a]/60 border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-extrabold text-white text-sm md:text-base tracking-tight">Lista de Préstamos</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Búsqueda y gestión general</p>
          </div>
          
          <div className="relative w-full sm:w-64">
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
        </div>

        <div className="flex-1 flex flex-col justify-between">
          {filteredPrestamos.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Coins className="mx-auto text-slate-700 mb-3" size={32} />
              <p className="text-sm font-bold text-slate-350">No se encontraron préstamos</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                Prueba buscando por el nombre del prestatario o cambia tu término de búsqueda.
              </p>
            </div>
          ) : (
            <>
              <div>
                {/* TABLA ESCRITORIO */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs md:text-sm">
                    <thead>
                      <tr className="bg-white/2 text-[10px] font-bold text-slate-450 uppercase tracking-wider border-b border-white/5 select-none">
                        <th className="px-6 py-4">Prestatario</th>
                        <th className="px-6 py-4">Capital</th>
                        <th className="px-6 py-4">Tasa (%)</th>
                        <th className="px-6 py-4">F. Emisión</th>
                        <th className="px-6 py-4">Tipo</th>
                        <th className="px-6 py-4">Estado</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {displayedPrestamos.map((prestamo) => {
                        const waLink = getWhatsAppLink(prestamo);
                        return (
                          <tr key={prestamo.id} className="hover:bg-white/2 transition duration-150">
                            <td className="px-6 py-4 font-bold text-slate-200">
                              <div className="flex items-center gap-2">
                                <span>{prestamo.cliente_nombre}</span>
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Chatear / Cobrar por WhatsApp"
                                    className="text-emerald-500 hover:text-emerald-400 p-0.5 hover:bg-white/5 rounded-md transition"
                                  >
                                    <MessageSquare size={13} />
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-extrabold text-white font-mono text-xs md:text-sm">
                              {formatCurrency(prestamo.monto_capital)}
                            </td>
                            <td className="px-6 py-4 text-slate-350 font-bold font-mono">
                              {prestamo.tasa_interes_porcentaje}%
                            </td>
                            <td className="px-6 py-4 text-slate-400 font-medium">
                              {prestamo.fecha_emision}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] bg-[#0f172a] text-slate-400 border border-white/5 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                {prestamo.tipo_prestamo}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  prestamo.estado === "activo"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-slate-500/10 text-slate-450 border border-slate-500/20"
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
                                <ArrowUpRight size={11} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* TARJETAS MÓVILES */}
                <div className="sm:hidden p-4 space-y-3 bg-[#0f172a]/20 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {displayedPrestamos.map((prestamo) => {
                    const waLink = getWhatsAppLink(prestamo);
                    return (
                      <div 
                        key={prestamo.id} 
                        className="bg-[#0f172a]/60 p-4 rounded-xl border border-white/5 hover:border-indigo-500/20 transition duration-150 space-y-3 shadow-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-200 text-sm leading-tight">{prestamo.cliente_nombre}</h4>
                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-500 p-0.5"
                                >
                                  <MessageSquare size={13} />
                                </a>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-450 font-semibold">{prestamo.fecha_emision}</span>
                          </div>
                          
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${
                              prestamo.estado === "activo"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-500/10 text-slate-450 border border-slate-500/20"
                            }`}
                          >
                            {prestamo.estado === "activo" ? "Activo" : "Pagado"}
                          </span>
                        </div>

                        <div className="flex justify-between items-end pt-1">
                          <div>
                            <span className="text-[9px] font-bold text-slate-550 uppercase block">Monto Capital</span>
                            <span className="font-black text-white font-mono text-sm leading-none">
                              {formatCurrency(prestamo.monto_capital)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] bg-[#0f172a] text-slate-350 px-2 py-0.5 border border-white/5 rounded-md font-bold uppercase tracking-wider">
                              {prestamo.tipo_prestamo}
                            </span>

                            <button
                              onClick={() => onSelectLoan(prestamo.id)}
                              className="text-xs bg-indigo-500/15 text-indigo-400 p-1.5 rounded-lg font-bold cursor-pointer"
                            >
                              <ArrowUpRight size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Paginación / Mostrar todos */}
              {filteredPrestamos.length > 5 && (
                <div className="p-3 bg-white/[0.01] border-t border-white/5 flex justify-center items-center">
                  <button
                    type="button"
                    onClick={() => setShowAllLoans(!showAllLoans)}
                    className="px-5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-xl transition duration-150 cursor-pointer"
                  >
                    {showAllLoans ? (
                      <span>Mostrar menos deudas</span>
                    ) : (
                      <span>Ver todos los créditos ({filteredPrestamos.length})</span>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 6. SECCIÓN DE CONSULTAS Y HERRAMIENTAS MÓDULO (Verticalidad Nivel 6) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Evaluador Crediticio Local */}
        <div className="bg-[#0f172a]/60 border border-white/5 p-6 rounded-2xl flex flex-col space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Activity size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm tracking-tight">Evaluador de Riesgo Local</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Fórmula y Análisis Matemático en Local</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Prestatario a evaluar</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Buscar por nombre..."
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {showEvalDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowEvalDropdown(false)} />
                  <div className="absolute left-0 right-0 mt-1 bg-[#0a0f1d] border border-white/10 rounded-xl max-h-48 overflow-y-auto z-20 shadow-xl custom-scrollbar divide-y divide-white/5">
                    {clientes.filter(c => 
                      c.nombre_completo.toLowerCase().includes(evalClientSearch.toLowerCase())
                    ).length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 text-center">
                        No se encontraron clientes.
                      </div>
                    ) : (
                      clientes.filter(c => 
                        c.nombre_completo.toLowerCase().includes(evalClientSearch.toLowerCase())
                      ).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setAiClienteId(c.id);
                            setEvalClientSearch(c.nombre_completo);
                            setShowEvalDropdown(false);
                          }}
                          className={`w-full text-left p-2.5 px-3.5 hover:bg-indigo-500/10 text-xs transition flex items-center justify-between cursor-pointer ${
                            aiClienteId === c.id ? "bg-indigo-500/20 text-indigo-300 font-extrabold" : "text-slate-200 font-semibold"
                          }`}
                        >
                          <span>{c.nombre_completo}</span>
                          {c.telefono && (
                            <span className="text-[10px] text-slate-500 font-mono">{c.telefono.startsWith("'") ? c.telefono.substring(1) : c.telefono}</span>
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
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Riesgo Calculado</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        assessment.level === "Excelente" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        assessment.level === "Bajo" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                        assessment.level === "Medio" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {assessment.level}
                      </span>
                      <span className="font-mono font-bold text-slate-200">{assessment.score}/100</span>
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
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Análisis</span>
                    <p className="text-xs text-slate-300 leading-relaxed font-semibold">{assessment.rationale}</p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <span className="text-[9px] font-bold text-slate-555 uppercase tracking-wide block">Políticas recomendadas</span>
                    <ul className="space-y-1.5">
                      {assessment.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-[11px] text-slate-350 flex items-start gap-1.5 leading-normal">
                          <CheckCircle className="shrink-0 mt-0.5 text-indigo-400" size={11} />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              );
            })() : (
              <div className="p-4 bg-slate-900/10 border border-dashed border-white/5 rounded-xl text-center text-slate-500 text-xs">
                Selecciona un cliente para diagnosticar su riesgo crediticio al instante.
              </div>
            )}
          </div>
        </div>

        {/* Carga Exprés Manual (Arrastrar Archivo) */}
        <div className="bg-[#0f172a]/60 border border-white/5 p-6 rounded-2xl flex flex-col space-y-4 justify-between">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
              <UploadCloud size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm tracking-tight">Acceso Rápido OCR</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Carga Rápida de Comprobante</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-normal font-semibold">
            Puedes cargar una captura de pantalla de Yape, Plin o del banco. Nuestro lector OCR local descifrará los datos de la transferencia al instante para que registres el abono en un clic.
          </p>

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/[0.01] hover:bg-emerald-500/[0.03] p-5 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center"
          >
            <FileImage className="text-emerald-400" size={22} />
            <span className="text-[11px] font-extrabold text-slate-300 block">Subir comprobante de pago</span>
            <span className="text-[9px] text-slate-500 block">JPEG o PNG</span>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full text-white py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 transition cursor-pointer min-h-[38px] shadow-md shadow-emerald-600/10"
          >
            Seleccionar Comprobante
          </button>
        </div>
      </div>

      {/* 7. BITÁCORA DE AUDITORÍA (Verticalidad Nivel 7) */}
      <div id="logs-audit-section" className="bg-[#0f172a]/60 border border-white/5 p-6 rounded-2xl flex flex-col space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Terminal size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm tracking-tight">Consola de Auditoría</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Registro de acciones y logs del sistema (Supabase)</p>
            </div>
          </div>
          <span className="text-[10px] bg-[#070a13] border border-white/5 text-slate-400 px-2.5 py-0.5 rounded-md font-mono select-none">
            Total: {logs.length}
          </span>
        </div>

        <div className="max-h-[160px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
          {logs.length === 0 ? (
            <div className="text-center py-6 text-slate-550 text-xs font-semibold">
              No hay actividades registradas en la bitácora de auditoría.
            </div>
          ) : (
            logs.slice(0, 10).map((log) => {
              const isDanger = log.accion.includes("ELIMINAR") || log.accion.includes("FALLO") || log.accion.includes("RECHAZAR");
              const isSuccess = log.accion.includes("PAGO") || log.accion.includes("CREAR") || log.accion.includes("CONECTAR") || log.accion.includes("SEMBRAR");
              
              return (
                <div 
                  key={log.id} 
                  className="p-2.5 rounded-xl bg-[#0f172a]/80 border border-white/3 flex items-start justify-between gap-3 text-[11px]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded ${
                        isDanger ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                        isSuccess ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      }`}>
                        {log.accion}
                      </span>
                      <span className="text-[9.5px] text-slate-400 font-bold font-mono">@{log.usuario}</span>
                    </div>
                    <p className="text-slate-300 font-semibold leading-normal">{log.detalles}</p>
                  </div>
                  <span className="text-[9.5px] text-slate-500 font-mono shrink-0 whitespace-nowrap pt-0.5">
                    {new Date(log.fecha_hora).toLocaleTimeString("es-PE", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL REGISTRO NUEVO PRESTAMO */}
      <AnimatePresence>
        {showModal && (
          <div id="modal-loans" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/5 font-sans"
            >
              <div className="p-4.5 border-b border-white/5 flex justify-between items-center bg-[#070a13]/40">
                <h3 className="font-extrabold text-white text-sm md:text-base">Registrar Nuevo Préstamo</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-455 hover:text-slate-200 p-1 rounded-lg transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateLoan} className="p-5 space-y-4">
                {clientes.length === 0 ? (
                  <div className="p-4 bg-amber-500/10 text-amber-300 rounded-xl text-xs space-y-2 border border-amber-500/20">
                    <p className="font-bold">No hay clientes registrados</p>
                    <p>Antes de poder otorgar un préstamo, debes registrar al menos un cliente en el directorio.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        onNavigateToClients();
                      }}
                      className="underline font-extrabold hover:text-amber-250 block mt-2 text-indigo-400 cursor-pointer"
                    >
                      Ir a Registrar Cliente &rarr;
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5 relative">
                      <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Prestatario *</label>
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
                          className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none pr-10 font-semibold"
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
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      
                      {showClientDropdown && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowClientDropdown(false)} />
                          <div className="absolute left-0 right-0 mt-1 bg-[#0a0f1d] border border-white/10 rounded-xl max-h-40 overflow-y-auto z-20 shadow-xl custom-scrollbar divide-y divide-white/5">
                            {clientes.filter(c => 
                              c.nombre_completo.toLowerCase().includes(clientSearch.toLowerCase())
                            ).length === 0 ? (
                              <div className="p-3 text-xs text-slate-500 text-center">
                                No se encontraron clientes.
                              </div>
                            ) : (
                              clientes.filter(c => 
                                c.nombre_completo.toLowerCase().includes(clientSearch.toLowerCase())
                              ).map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCliente(c.id);
                                    setClientSearch(c.nombre_completo);
                                    setShowClientDropdown(false);
                                  }}
                                  className={`w-full text-left p-2.5 px-3.5 hover:bg-indigo-500/10 text-xs transition flex items-center justify-between cursor-pointer ${
                                    selectedCliente === c.id ? "bg-indigo-500/20 text-indigo-300 font-extrabold" : "text-slate-200 font-semibold"
                                  }`}
                                >
                                  <span>{c.nombre_completo}</span>
                                  {c.telefono && (
                                    <span className="text-[10px] text-slate-500 font-mono">{c.telefono.startsWith("'") ? c.telefono.substring(1) : c.telefono}</span>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Monto Capital (S/.) *</label>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          placeholder="Ej. 1500"
                          value={monto}
                          onChange={(e) => setMonto(e.target.value)}
                          className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold font-mono"
                          required
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Tasa Interés (%) *</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Ej: 10"
                          value={tasa}
                          onChange={(e) => setTasa(e.target.value)}
                          className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Tipo Crédito</label>
                        <select
                          value={tipo}
                          onChange={(e) => setTipo(e.target.value)}
                          className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold"
                        >
                          <option value="Personal" className="bg-[#0f172a]">Personal</option>
                          <option value="Negocio" className="bg-[#0f172a]">Negocio</option>
                          <option value="Hipotecario" className="bg-[#0f172a]">Hipotecario</option>
                        </select>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Fecha Emisión</label>
                        <input
                          type="date"
                          value={fechaEmision}
                          onChange={(e) => setFechaEmision(e.target.value)}
                          className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Fecha Vencimiento</label>
                      <input
                        type="date"
                        value={fechaVencimiento}
                        onChange={(e) => setFechaVencimiento(e.target.value)}
                        className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold"
                      />
                    </div>

                    {parseFloat(monto) > 0 && (
                      <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2">
                        <span className="text-[9.5px] font-bold text-indigo-300 uppercase tracking-wider block">Balance Financiero Sugerido</span>
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-300 pt-0.5">
                          <span>Capital original:</span>
                          <span className="font-mono">{formatCurrency(parseFloat(monto) || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-350">
                          <span>Interés (+{(parseFloat(tasa) || 0)}%):</span>
                          <span className="font-mono text-indigo-300">+{formatCurrency((parseFloat(monto) || 0) * ((parseFloat(tasa) || 0) / 100))}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-black text-white pt-2 border-t border-white/5">
                          <span className="text-indigo-400">Deuda Total:</span>
                          <span className="font-mono">{formatCurrency((parseFloat(monto) || 0) * (1 + (parseFloat(tasa) || 0) / 100))}</span>
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-white/5 flex justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="px-4 py-2 hover:bg-white/5 rounded-xl text-slate-455 font-bold text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="px-4.5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        {creating ? "Registrando..." : "Registrar Crédito"}
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
          <div id="modal-voucher" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-[#0f172a] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-white/5 flex flex-col md:flex-row font-sans"
            >
              {/* Left Column: Voucher image */}
              <div className="w-full md:w-1/2 bg-[#070a13]/30 p-6 flex flex-col justify-between items-center border-b md:border-b-0 md:border-r border-white/5">
                <div className="w-full">
                  <span className="text-[9.5px] font-bold text-emerald-450 uppercase tracking-wider block mb-2 pl-0.5">Captura de Pago</span>
                  <p className="text-xs text-slate-500 font-semibold leading-normal mb-4">
                    Vista previa del comprobante cargado para verificación visual.
                  </p>
                </div>

                <div className="w-full flex-1 flex items-center justify-center min-h-[220px] max-h-[300px] bg-slate-950/40 rounded-2xl p-3 border border-white/5 relative overflow-hidden">
                  {vcrOcrLoading && (
                    <div className="absolute inset-0 bg-[#070a13]/85 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 z-10">
                      <Loader2 className="animate-spin text-emerald-450 mb-3" size={26} />
                      <span className="text-xs font-bold text-white">{ocrProgress}</span>
                      <span className="text-[10px] text-slate-500 mt-1">Escaneando comprobante en local...</span>
                    </div>
                  )}

                  {vcrBase64 ? (
                    <img 
                      src={`data:${vcrMimeType || "image/jpeg"};base64,${vcrBase64}`} 
                      alt="Voucher de Pago" 
                      className="max-w-full max-h-[240px] object-contain rounded-xl"
                    />
                  ) : (
                    <div className="text-center text-slate-550 text-xs">
                      Ningún archivo cargado.
                    </div>
                  )}
                </div>
                
                {vcrFileName && (
                  <div className="w-full text-center mt-4 p-2 bg-white/[0.01] border border-white/5 rounded-xl truncate text-[10px] text-slate-400 font-mono">
                    {vcrFileName}
                  </div>
                )}
              </div>

              {/* Right Column: Form */}
              <div className="w-full md:w-1/2 p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                    <div>
                      <h3 className="font-extrabold text-white text-sm md:text-base">Registrar Abono OCR</h3>
                      <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Verificación y Registro</p>
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
                      className="text-slate-455 hover:text-slate-200 p-1 transition cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Autocomplete de Clientes */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Asociar a Prestatario *</label>
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
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {showVcrClienteDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowVcrClienteDropdown(false)} />
                        <div className="absolute left-0 right-0 mt-1 bg-[#0a0f1d] border border-white/10 rounded-xl max-h-40 overflow-y-auto z-20 shadow-xl custom-scrollbar divide-y divide-white/5">
                          {clientes.filter(c => 
                            c.nombre_completo.toLowerCase().includes(vcrClienteSearch.toLowerCase())
                          ).length === 0 ? (
                            <div className="p-3 text-xs text-slate-500 text-center">
                              No se encontraron clientes.
                            </div>
                          ) : (
                            clientes.filter(c => 
                              c.nombre_completo.toLowerCase().includes(vcrClienteSearch.toLowerCase())
                            ).map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setVcrSelectedClienteId(c.id);
                                  setVcrClienteSearch(c.nombre_completo);
                                  setShowVcrClienteDropdown(false);
                                }}
                                className={`w-full text-left p-2.5 px-3.5 hover:bg-indigo-500/10 text-xs transition flex items-center justify-between cursor-pointer ${
                                  vcrSelectedClienteId === c.id ? "bg-indigo-500/20 text-indigo-300 font-extrabold" : "text-slate-200 font-semibold"
                                }`}
                              >
                                <span>{c.nombre_completo}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Préstamo Destino */}
                  {vcrSelectedClienteId && (
                    <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2">
                      <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider block">Crédito del Deudor</span>
                      {vcrClientLoans.length === 0 ? (
                        <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-[10.5px] leading-normal font-semibold flex items-center gap-2">
                          <ShieldAlert size={13} className="shrink-0 text-rose-400" />
                          <span>Este prestatario no tiene deudas activas.</span>
                        </div>
                      ) : vcrClientLoans.length === 1 ? (
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg text-[10.5px] leading-normal font-semibold flex items-center gap-2">
                          <CheckCircle size={13} className="shrink-0 text-emerald-400" />
                          <div>
                            <span className="block text-[9px] text-slate-450 font-bold uppercase">Asociación Automática</span>
                            <span className="block mt-0.5">{vcrClientLoans[0].tipo_prestamo} · Capital: {formatCurrency(vcrClientLoans[0].monto_capital)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider block">Seleccionar Préstamo *</label>
                          <select
                            value={vcrSelectedLoanId}
                            onChange={(e) => setVcrSelectedLoanId(e.target.value)}
                            className="w-full glass-input rounded-xl p-2 text-xs text-slate-200 outline-none font-semibold"
                            required
                          >
                            <option value="" className="bg-[#0f172a]">-- Elegir Préstamo Activo --</option>
                            {vcrClientLoans.map(p => (
                              <option key={p.id} value={p.id} className="bg-[#0f172a]">
                                {p.tipo_prestamo} — Capital: S/. {p.monto_capital} ({p.fecha_emision})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Monto y Fecha Confirmados */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Monto Confirmado (S/.) *</label>
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
                      <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Fecha de Cobro *</label>
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
                    <label className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block pl-0.5">Método de Cobro *</label>
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

                <div className="pt-5 border-t border-white/5 flex justify-end gap-2 shrink-0">
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
                    className="px-4 py-2 hover:bg-white/5 rounded-xl text-slate-455 font-bold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleVoucherRegister}
                    disabled={vcrRegistering || !vcrSelectedClienteId || !vcrSelectedLoanId || !vcrMonto || vcrOcrLoading}
                    className="px-4.5 py-2 rounded-xl text-xs font-bold text-white transition cursor-pointer bg-gradient-to-r from-emerald-650 to-emerald-555 disabled:opacity-40"
                  >
                    {vcrRegistering ? "Procesando..." : "Confirmar Abono"}
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
