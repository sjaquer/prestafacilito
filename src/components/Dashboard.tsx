import React, { useState, useEffect, useRef } from "react";
import { 
  TrendingUp, CreditCard, Users, PlusCircle, ArrowUpRight, Coins, Loader2, 
  Wallet, Landmark, Activity, X, ShieldAlert, CheckCircle, Terminal, 
  UploadCloud, FileImage, Clock3, CalendarDays, Gauge, Target, Phone, MessageSquare,
  Trash2, Edit3, Image, Download, Eye, ExternalLink
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
  const [amortizaciones, setAmortizaciones] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para el modal de edición de préstamos
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEditLoan, setSelectedEditLoan] = useState<any>(null);
  const [editMonto, setEditMonto] = useState("");
  const [editTasa, setEditTasa] = useState("");
  const [editTipo, setEditTipo] = useState("");
  const [editFechaEmision, setEditFechaEmision] = useState("");
  const [editFechaVencimiento, setEditFechaVencimiento] = useState("");
  const [editEstado, setEditEstado] = useState("");
  const [updatingLoan, setUpdatingLoan] = useState(false);

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
  const [ocrRawText, setOcrRawText] = useState("");
  const [showOcrDebug, setShowOcrDebug] = useState(false);
  const [vcrMonto, setVcrMonto] = useState("");
  const [vcrMetodoPago, setVcrMetodoPago] = useState("Yape");
  const [vcrFechaPago, setVcrFechaPago] = useState(new Date().toISOString().split("T")[0]);
  const [vcrSelectedClienteId, setVcrSelectedClienteId] = useState("");
  const [vcrClienteSearch, setVcrClienteSearch] = useState("");
  const [showVcrClienteDropdown, setShowVcrClienteDropdown] = useState(false);
  const [vcrSelectedLoanId, setVcrSelectedLoanId] = useState("");
  const [vcrRegistering, setVcrRegistering] = useState(false);

  // Lightbox para previsualizar vouchers registrados a pantalla completa
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null);

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
        if (data.error && (data.error.includes("Supabase") || data.error.includes("not found") || data.error.includes("configuración") || data.error.includes("inicializar"))) {
          try {
            const initRes = await fetch("/api/initialize-sheets", { method: "POST" });
            if (initRes.ok) {
              const retryRes = await fetch("/api/dashboard");
              if (retryRes.ok) {
                const retryData = await retryRes.json();
                setMetrics(retryData.metrics);
                setUltimosPrestamos(retryData.ultimosPrestamos);
              } else {
                setError("La base de datos se inicializó pero no contiene registros aún.");
              }
            } else {
              setError("No se pudo conectar a la base de datos de forma automática. Revisa las credenciales de tu archivo .env.");
            }
          } catch (initErr) {
            setError("Error al inicializar de manera silenciosa la base de datos de administración.");
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

      // Cargar todas las amortizaciones para la galería de vouchers
      const resAmort = await fetch("/api/amortizaciones");
      if (resAmort.ok) {
        const dataAmort = await resAmort.json();
        setAmortizaciones(dataAmort);
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

  // Abrir Modal de Edición de Deuda
  const handleOpenEditModal = (loan: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar navegar al detalle
    setSelectedEditLoan(loan);
    setEditMonto(String(loan.monto_capital));
    setEditTasa(String(loan.tasa_interes_porcentaje));
    setEditTipo(loan.tipo_prestamo);
    setEditFechaEmision(loan.fecha_emision);
    setEditFechaVencimiento(loan.fecha_vencimiento || "");
    setEditEstado(loan.estado);
    setShowEditModal(true);
  };

  // Guardar Cambios de Préstamo (Editar Deuda)
  const handleUpdateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditLoan) return;

    setUpdatingLoan(true);
    try {
      const res = await fetch(`/api/prestamos/${selectedEditLoan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto_capital: parseFloat(editMonto),
          tasa_interes_porcentaje: parseFloat(editTasa),
          fecha_emision: editFechaEmision,
          fecha_vencimiento: editFechaVencimiento || null,
          estado: editEstado,
          tipo_prestamo: editTipo
        })
      });

      if (res.ok) {
        setShowEditModal(false);
        setSelectedEditLoan(null);
        fetchDashboardData();
      } else {
        const errData = await res.json();
        alert(errData.error || "Fallo al actualizar préstamo.");
      }
    } catch (err) {
      alert("Error de conexión al guardar cambios.");
    } finally {
      setUpdatingLoan(false);
    }
  };

  // Eliminar Préstamo Permanentemente
  const handleDeleteLoan = async (loanId: string) => {
    if (!confirm("¿Estás absolutamente seguro de eliminar este préstamo? Esto borrará irreversiblemente todos los abonos y cuotas asociadas al mismo de la base de datos.")) {
      return;
    }

    try {
      const res = await fetch(`/api/prestamos/${loanId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setShowEditModal(false);
        setSelectedEditLoan(null);
        fetchDashboardData();
      } else {
        const errData = await res.json();
        alert(errData.error || "Fallo al eliminar préstamo.");
      }
    } catch (err) {
      alert("Error de conexión al eliminar.");
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
      rationale = `Cliente nuevo sin historial registrado. Se encuentra libre de deudas.`;
      recommendations = [
        "Comenzar con montos prudentes (menores a S/. 500) para medir puntualidad.",
        "Estructurar plazos cortos (semanales o quincenales).",
        "Solicitar referencias comerciales básicas."
      ];
    }

    return { level, score, rationale, recommendations };
  };

  // Motor Inteligente Ultra-Preciso OCR para vouchers de bancos Peruanos (Yape, Plin, BCP, etc.)
  const handleOcrProcess = async (file: File) => {
    setVcrFile(file);
    setVcrFileName(file.name);
    setVcrMimeType(file.type);
    setVcrOcrLoading(true);
    setOcrProgress("Preparando lector...");
    setOcrRawText("");
    setShowVoucherModal(true);

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setVcrBase64(reader.result.split(",")[1]);
      }
    };
    reader.readAsDataURL(file);

    try {
      const worker = await Tesseract.createWorker("spa", 1, {
        logger: m => {
          if (m.status === "recognizing text") {
            setOcrProgress(`Analizando: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      setOcrRawText(text);

      // Pre-limpieza y normalización de textos OCR (Corrige errores comunes de lectura)
      // Reemplaza símbolos parecidos como 5/, $/, §/ por S/ para el motor de expresiones regulares.
      let normalizedText = text
        .replace(/[§$\xc2\xa2]/g, "S/")
        .replace(/5\/\.?/g, "S/")
        .replace(/s\/\.?/gi, "S/")
        .replace(/[\u201c\u201d\u2018\u2019"]/g, ""); // Quitar comillas raras

      // ESTRATEGIA 1: Buscar monto con prefijo S/ (Estilo Yape/Plin/BCP tradicional)
      let monto = "";
      const yapeRegex = /S\/\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i;
      const matchYape = normalizedText.match(yapeRegex);
      if (matchYape) {
        monto = matchYape[1].replace(/,/g, "");
      } else {
        // ESTRATEGIA 2: Buscar monto tras palabras claves como "Monto", "Importe", "Total", "Monto de pago"
        const keywordRegex = /(?:monto|importe|total|pago|yapeo|yapeaste|recibiste|enviaste)\s*(?:exigible|de)?\s*(?:s\/)?\s*(\d{1,3}(?:[.,]\d{3})*(?:\.\d{2}))/i;
        const matchKeyword = normalizedText.match(keywordRegex);
        if (matchKeyword) {
          monto = matchKeyword[1].replace(/,/g, "");
        } else {
          // ESTRATEGIA 3: Buscar cualquier decimal que parezca un importe razonable de dinero (ej. 100.00, 1500.00)
          const decimalRegex = /\b(\d{2,5}(?:\.\d{2}))\b/;
          const matchDecimal = normalizedText.match(decimalRegex);
          if (matchDecimal) {
            monto = matchDecimal[1];
          }
        }
      }
      setVcrMonto(monto);

      // EXTRAER FECHA DE OPERACIÓN
      const dateRegex = /(\d{2})[/-](\d{2})[/-](\d{4})/;
      const matchDate = normalizedText.match(dateRegex);
      if (matchDate) {
        setVcrFechaPago(`${matchDate[3]}-${matchDate[2]}-${matchDate[1]}`);
      } else {
        // Extraer formato textual "24 Mayo 2026"
        const textLower = normalizedText.toLowerCase();
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

      // DETERMINAR BANCO / MEDIO DE COBRO
      const textLower = normalizedText.toLowerCase();
      if (textLower.includes("yape")) {
        setVcrMetodoPago("Yape");
      } else if (textLower.includes("plin")) {
        setVcrMetodoPago("Plin");
      } else if (textLower.includes("bcp") || textLower.includes("banca móvil")) {
        setVcrMetodoPago("Transferencia BCP");
      } else if (textLower.includes("bbva") || textLower.includes("continental")) {
        setVcrMetodoPago("Transferencia BBVA");
      } else if (textLower.includes("interbank")) {
        setVcrMetodoPago("Transferencia Interbank");
      } else {
        setVcrMetodoPago("Yape");
      }

      setOcrProgress("Lectura Completada");
    } catch (err) {
      console.error("Error en OCR:", err);
      setOcrProgress("Error de lectura");
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
    const text = `¡Hola, ${loan.cliente_nombre}! Te saludamos de la administración. 🇵🇪 Te recordamos amablemente tu cuota/saldo pendiente de ${formattedAmount} con vencimiento el ${loan.fecha_vencimiento}. Agradecemos tu puntualidad y apoyo. ¡Que tengas un gran día!`;
    
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
    const radius = 32;
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
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-5 flex items-center justify-between gap-4 shadow-xl shadow-black/20 hover:border-blue-500/20 transition-all duration-300">
        <div className="flex items-center gap-4 min-w-0">
          {/* Círculo de progreso estilizado */}
          <div className="relative h-20 w-20 shrink-0 select-none">
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
                className="transition-all duration-500 shadow-md"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-white leading-none">
                {timer.remainingDays < 0 ? Math.abs(timer.remainingDays) : Math.max(timer.remainingDays, 0)}
              </span>
              <span className="mt-0.5 text-[8.5px] font-black uppercase tracking-widest text-gray-400">
                {timer.remainingDays < 0 ? "Mora" : timer.remainingDays === 0 ? "Hoy" : "Días"}
              </span>
            </div>
          </div>

          {/* Información del crédito */}
          <div className="min-w-0">
            <h4 className="text-sm font-black text-white truncate leading-snug">{loan.cliente_nombre}</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">{loan.tipo_prestamo} · <span className="font-mono text-[12px] font-black text-indigo-300">{formatCurrency(loan.monto_capital)}</span></p>
            <p className="text-[10px] text-gray-500 mt-1 font-bold flex items-center gap-1">
              <CalendarDays size={11} className="text-slate-600" />
              Vence: {loan.fecha_vencimiento}
            </p>
          </div>
        </div>

        {/* Acciones del vencimiento */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
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
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white transition-all duration-150 shadow-lg shadow-emerald-600/10 transform active:scale-95 min-h-[38px]"
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

  // Filtrar vouchers válidos para la galería (deben tener comprobante_url)
  const registeredVouchers = amortizaciones.filter(a => a.comprobante_url);

  if (loading) {
    return (
      <div id="dashboard-loader" className="flex flex-col items-center justify-center p-12 min-h-[500px]">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={36} />
        <p className="text-gray-400 font-bold text-sm tracking-wide">Actualizando base de datos...</p>
      </div>
    );
  }

  return (
    <div id="dashboard-view" className="space-y-8 max-w-7xl mx-auto pb-12 px-4 sm:px-0">
      
      {/* 1. SECCIÓN DE OPERACIONES RÁPIDAS (Botones Grandes & Glassmorphism) */}
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl shadow-black/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 "></span>
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest select-none">
              Panel Administrativo
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mt-1.5 tracking-tight leading-none">Cartera de Préstamos</h1>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <button
            id="btn-upload-voucher-quick"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-white/5 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] text-xs font-black uppercase tracking-wider text-slate-200 transition-all duration-200 cursor-pointer transform active:scale-98 min-h-[48px]"
          >
            <UploadCloud size={16} className="text-green-400" />
            <span>Escanear Voucher</span>
          </button>
          
          <button
            id="btn-open-prestamo-modal"
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-xs font-black uppercase tracking-wider text-white transition-all duration-200 shadow-lg shadow-indigo-500/15 cursor-pointer transform active:scale-98 min-h-[48px]"
          >
            <PlusCircle size={16} />
            <span>Otorgar Préstamo</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl text-xs flex items-start gap-2.5">
          <ShieldAlert className="shrink-0 text-amber-400 mt-0.5" size={16} />
          <div>
            <span className="font-bold block text-sm">Alerta de sincronización</span>
            <span className="opacity-90 leading-normal mt-0.5 block">{error}</span>
          </div>
        </div>
      )}

      {/* 2. KPIs FINANCIEROS (Verticalidad Nivel 2) */}
      <div id="metrics-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1 - Capital Prestado */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500 shadow-sm" />
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Capital Colocado</span>
            <Landmark size={16} className="text-blue-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
              {formatCurrency(capitalPrestado)}
            </span>
            <p className="text-[10px] text-gray-500 font-bold mt-1.5 uppercase tracking-wide">Flujo emitido acumulado</p>
          </div>
        </div>

        {/* KPI 2 - Total Recuperado */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 shadow-sm" />
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Monto Cobrado</span>
            <Wallet size={16} className="text-green-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black text-green-400 tracking-tight font-mono">
              {formatCurrency(totalRecuperado)}
            </span>
            <p className="text-[10px] text-emerald-500/80 font-bold mt-1.5 flex items-center gap-1">
              <TrendingUp size={12} />
              <span>{recoveryRate.toFixed(1)}% recuperado</span>
            </p>
          </div>
        </div>

        {/* KPI 3 - Saldo Pendiente */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 shadow-sm" />
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Saldo Exigible</span>
            <Target size={16} className="text-blue-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
              {formatCurrency(saldoPendiente)}
            </span>
            <p className="text-[10px] text-gray-500 font-bold mt-1.5 uppercase tracking-wide">Capital + Interés deudor</p>
          </div>
        </div>

        {/* KPI 4 - Mora Activa */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500 shadow-sm" />
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Salud Cartera</span>
            <Activity size={16} className="text-red-400 " />
          </div>
          <div className="mt-4">
            <span className={`text-2xl sm:text-3xl font-black tracking-tight font-mono ${overdueLoans.length > 0 ? 'text-rose-450' : 'text-white'}`}>
              {healthRate.toFixed(0)}%
            </span>
            <p className="text-[10px] font-bold mt-1.5 flex items-center gap-1 uppercase tracking-wide">
              <span className={overdueLoans.length > 0 ? 'text-red-400' : 'text-gray-500'}>
                {overdueLoans.length} retrasados
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. GRÁFICA DE BALANCE DE RETORNO (Estilo Premium con Glow y Bicolor) */}
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 p-6 rounded-3xl shadow-xl shadow-black/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2 text-xs">
          <div>
            <h3 className="font-extrabold text-white text-sm">Visualizador de Cartera y Retorno</h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Dinero amortizado frente a saldo restante</p>
          </div>
          <div className="font-mono text-right">
            <span className="text-green-400 font-black">{recoveryRate.toFixed(1)}%</span> Cobrado · <span className="text-blue-400 font-black">{(100 - recoveryRate).toFixed(1)}%</span> Pendiente
          </div>
        </div>
        
        {/* Barra de progreso bicolor súper estilizada */}
        <div className="w-full h-5 bg-black/60 rounded-full overflow-hidden p-1 border border-white/5 flex relative shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700 ease-out rounded-full shadow-[0_0_12px_rgba(16,185,129,0.4)]" 
            style={{ width: `${recoveryRate}%` }} 
          />
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700 ease-out rounded-full shadow-[0_0_12px_rgba(99,102,241,0.25)] ml-1" 
            style={{ width: `calc(${100 - recoveryRate}% - 4px)` }} 
          />
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-450 mt-4 gap-2.5 font-bold uppercase tracking-wide">
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.5)]" /> Amortizado real: <strong className="text-white font-mono">{formatCurrency(totalRecuperado)}</strong></span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-indigo-500 rounded-full shadow-[0_0_6px_rgba(99,102,241,0.5)]" /> Saldo pendiente: <strong className="text-white font-mono">{formatCurrency(saldoPendiente)}</strong></span>
        </div>
      </div>

      {/* 4. RADAR DE VENCIMIENTOS (Círculos SVG estilizados) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white tracking-tight leading-none">Radar de Cuotas por Vencer</h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1.5">Monitoreo dinámico del vencimiento de créditos</p>
        </div>

        {activeLoansSortedByDueDate.length === 0 ? (
          <div className="p-8 rounded-3xl border border-dashed border-white/5 bg-[#0A0A0C]/10 text-center text-gray-500 text-xs font-semibold">
            No existen créditos activos con vencimientos vigentes.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeLoansSortedByDueDate.slice(0, 3).map((loan) => (
              <CircularTimerCard key={loan.id} loan={loan} />
            ))}
          </div>
        )}
      </div>

      {/* 5. SECCIÓN NUEVA: GALERÍA DE VOUCHERS REGISTRADOS (¡Wow Factor y Utilidad!) */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-white tracking-tight leading-none">Comprobantes y Vouchers Registrados</h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1.5">Galería de recibos escaneados en el sistema</p>
        </div>

        {registeredVouchers.length === 0 ? (
          <div className="p-8 rounded-3xl border border-dashed border-white/5 bg-[#0A0A0C]/10 text-center text-gray-500 text-xs font-semibold">
            No se han registrado vouchers de pago en el sistema todavía.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {registeredVouchers.slice(0, 5).map((voucher) => (
              <div 
                key={voucher.id}
                onClick={() => setSelectedLightboxImage(voucher.comprobante_url)}
                className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl shadow-md hover:border-emerald-500/20 transition-all duration-300 cursor-pointer flex flex-col justify-between group overflow-hidden"
              >
                <div className="w-full h-32 bg-black/50 rounded-xl overflow-hidden border border-white/5 relative flex items-center justify-center">
                  <img 
                    src={voucher.comprobante_url} 
                    alt="Voucher" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-bold">
                    <Eye size={14} />
                    <span>Ver</span>
                  </div>
                </div>
                
                <div className="mt-3 min-w-0">
                  <span className="text-[11px] font-black text-slate-200 block truncate leading-tight">{voucher.cliente_nombre}</span>
                  <div className="flex items-center justify-between gap-1.5 mt-1.5">
                    <span className="text-[11px] font-bold text-emerald-450 font-mono">{formatCurrency(parseFloat(voucher.monto))}</span>
                    <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                      voucher.metodo_pago.includes("Yape") ? "bg-pink-500/10 text-pink-400 border border-pink-500/10" :
                      voucher.metodo_pago.includes("Plin") ? "bg-teal-500/10 text-teal-400 border border-teal-500/10" :
                      "bg-blue-500/10 text-blue-400 border border-indigo-500/10"
                    }`}>
                      {voucher.metodo_pago.split(" ")[0]}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. CARTERA DE PRÉSTAMOS CON EDICIÓN Y BORRADO DE DEUDAS (Nivel 6) */}
      <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-xl flex flex-col">
        <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-black text-white text-base tracking-tight leading-none">Cartera de Deudas</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1.5">Administrar, buscar, editar y borrar deudas en vivo</p>
          </div>
          
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="🔍 Buscar por prestatario o tipo..."
              value={loanSearchQuery}
              onChange={(e) => setLoanSearchQuery(e.target.value)}
              className="w-full pl-3.5 pr-8 py-2.5 glass-input rounded-xl text-xs font-semibold"
            />
            {loanSearchQuery && (
              <button
                type="button"
                onClick={() => setLoanSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-200 p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-between">
          {filteredPrestamos.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Coins className="mx-auto text-slate-700 mb-3" size={32} />
              <p className="text-sm font-bold text-slate-350">No se encontraron deudas</p>
            </div>
          ) : (
            <>
              <div>
                {/* TABLA ESCRITORIO */}
                <div className="hidden md:block overflow-x-auto text-xs md:text-sm">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="bg-white/2 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 select-none">
                        <th className="px-6 py-4.5">Prestatario</th>
                        <th className="px-6 py-4.5">Monto Deuda</th>
                        <th className="px-6 py-4.5">Interés (%)</th>
                        <th className="px-6 py-4.5">F. Emisión</th>
                        <th className="px-6 py-4.5">Tipo</th>
                        <th className="px-6 py-4.5">Estado</th>
                        <th className="px-6 py-4.5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                      {displayedPrestamos.map((prestamo) => {
                        const waLink = getWhatsAppLink(prestamo);
                        return (
                          <tr key={prestamo.id} className="hover:bg-white/[0.02] transition duration-150">
                            <td className="px-6 py-4 font-bold text-slate-100">
                              <div className="flex items-center gap-2">
                                <span>{prestamo.cliente_nombre}</span>
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-500 hover:text-emerald-450 p-0.5 hover:bg-white/5 rounded-md transition"
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
                            <td className="px-6 py-4 text-gray-400 font-medium font-mono">
                              {prestamo.fecha_emision}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-[10px] bg-slate-850 text-gray-400 border border-white/5 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                {prestamo.tipo_prestamo}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  prestamo.estado === "activo"
                                    ? "bg-emerald-500/10 text-green-400 border border-emerald-500/20 shadow-emerald-500/5 shadow-sm"
                                    : "bg-slate-500/10 text-slate-450 border border-slate-500/20"
                                }`}
                              >
                                {prestamo.estado === "activo" ? "Activo" : "Pagado"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={(e) => handleOpenEditModal(prestamo, e)}
                                  className="text-gray-400 hover:text-blue-400 p-2 hover:bg-white/5 rounded-xl transition cursor-pointer"
                                  title="Editar Deuda"
                                >
                                  <Edit3 size={14} />
                                </button>
                                
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteLoan(prestamo.id); }}
                                  className="text-gray-500 hover:text-rose-500 p-2 hover:bg-white/5 rounded-xl transition cursor-pointer"
                                  title="Eliminar Deuda"
                                >
                                  <Trash2 size={14} />
                                </button>

                                <button
                                  onClick={() => onSelectLoan(prestamo.id)}
                                  className="text-xs bg-white/10 hover:bg-white/20 border border-white/10 text-white py-1.5 px-3 rounded-lg font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-sm"
                                >
                                  <span>Ver Deuda</span>
                                  <ArrowUpRight size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* TARJETAS MÓVILES (Optimizado al 100% para celular) */}
                <div className="md:hidden p-4 space-y-3 bg-[#0f172a]/20 max-h-[450px] overflow-y-auto custom-scrollbar">
                  {displayedPrestamos.map((prestamo) => {
                    const waLink = getWhatsAppLink(prestamo);
                    return (
                      <div 
                        key={prestamo.id} 
                        className="bg-[#0f172a]/60 p-4 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all space-y-4 shadow-md"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-slate-100 text-sm leading-tight">{prestamo.cliente_nombre}</h4>
                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-500 p-2 hover:bg-white/5 rounded-lg transition"
                                >
                                  <MessageSquare size={14} />
                                </a>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-450 font-semibold font-mono mt-0.5 block">{prestamo.fecha_emision}</span>
                          </div>
                          
                          <span
                            className={`text-[9px] px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${
                              prestamo.estado === "activo"
                                ? "bg-emerald-500/10 text-green-400 border border-emerald-500/20"
                                : "bg-slate-500/10 text-slate-450 border border-slate-500/20"
                            }`}
                          >
                            {prestamo.estado === "activo" ? "Activo" : "Pagado"}
                          </span>
                        </div>

                        <div className="flex justify-between items-end pt-1">
                          <div>
                            <span className="text-[9px] font-bold text-gray-500 uppercase block">Deuda Capital</span>
                            <span className="font-black text-white font-mono text-sm leading-none">
                              {formatCurrency(prestamo.monto_capital)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2.5">
                            {/* Editar/Eliminar en móvil */}
                            <button
                              onClick={(e) => handleOpenEditModal(prestamo, e)}
                              className="text-gray-400 hover:text-blue-400 p-3 bg-white/[0.02] border border-white/5 rounded-xl transition cursor-pointer"
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              onClick={() => onSelectLoan(prestamo.id)}
                              className="text-xs bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 py-3 rounded-xl font-medium cursor-pointer transition flex items-center gap-2"
                            >
                              <span>Ver Deuda</span>
                              <ArrowUpRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Expansión del listado */}
              {filteredPrestamos.length > 5 && (
                <div className="p-3.5 bg-white/[0.01] border-t border-white/5 flex justify-center items-center">
                  <button
                    type="button"
                    onClick={() => setShowAllLoans(!showAllLoans)}
                    className="px-5 py-2.5 bg-blue-500/10 hover:bg-indigo-500/20 text-blue-400 hover:text-indigo-350 text-xs font-bold rounded-xl transition duration-150 cursor-pointer"
                  >
                    {showAllLoans ? (
                      <span>Mostrar menos deudas</span>
                    ) : (
                      <span>Ver todas las deudas ({filteredPrestamos.length})</span>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 7. HERRAMIENTAS Y CONSULTAS DE RIESGO / OCR (Verticalidad Nivel 7) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evaluador Crediticio Local */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 p-6 rounded-3xl flex flex-col space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Activity size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm tracking-tight">Evaluador de Riesgo Local</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Fórmula y Análisis Matemático en Local</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block pl-0.5">Prestatario a evaluar</label>
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
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-200 p-0.5 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {showEvalDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowEvalDropdown(false)} />
                  <div className="absolute left-0 right-0 mt-1 bg-[#0a0f1d] border border-white/5 rounded-xl max-h-48 overflow-y-auto z-20 shadow-xl custom-scrollbar divide-y divide-white/5">
                    {clientes.filter(c => 
                      c.nombre_completo.toLowerCase().includes(evalClientSearch.toLowerCase())
                    ).length === 0 ? (
                      <div className="p-3 text-xs text-gray-500 text-center">
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
                          className={`w-full text-left p-2.5 px-3.5 hover:bg-blue-500/10 text-xs transition flex items-center justify-between cursor-pointer ${
                            aiClienteId === c.id ? "bg-indigo-500/20 text-indigo-300 font-extrabold" : "text-slate-200 font-semibold"
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
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Riesgo Calculado</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        assessment.level === "Excelente" ? "bg-emerald-500/10 text-green-400 border border-emerald-500/20" :
                        assessment.level === "Bajo" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                        assessment.level === "Medio" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                        "bg-rose-500/10 text-red-400 border border-rose-500/20 "
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
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block">Análisis</span>
                    <p className="text-xs text-gray-300 leading-relaxed font-semibold">{assessment.rationale}</p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <span className="text-[9px] font-bold text-slate-555 uppercase tracking-wide block">Políticas recomendadas</span>
                    <ul className="space-y-1.5">
                      {assessment.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-[11px] text-slate-350 flex items-start gap-1.5 leading-normal">
                          <CheckCircle className="shrink-0 mt-0.5 text-blue-400" size={11} />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              );
            })() : (
              <div className="p-5 bg-[#0A0A0C]/10 border border-dashed border-white/5 rounded-2xl text-center text-gray-500 text-xs">
                Selecciona un prestatario para ver su evaluación crediticia.
              </div>
            )}
          </div>
        </div>

        {/* Lector OCR manual */}
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/5 p-6 rounded-3xl flex flex-col space-y-4 justify-between">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-green-400">
              <UploadCloud size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm tracking-tight">Escanear Voucher manual</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Carga Rápida de Comprobante</p>
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-normal font-semibold">
            Sube un comprobante para que el lector OCR intente descifrar los datos automáticamente, rellenando el abono en un instante.
          </p>

          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/[0.01] hover:bg-emerald-500/[0.03] p-5 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center"
          >
            <FileImage className="text-green-400" size={24} />
            <span className="text-[11px] font-extrabold text-gray-300 block">Subir comprobante de pago</span>
            <span className="text-[9px] text-gray-500 block">JPEG o PNG</span>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-600 transition cursor-pointer min-h-[38px] shadow-lg shadow-emerald-500/10 transform active:scale-95"
          >
            Elegir Archivo
          </button>
        </div>
      </div>

      {/* 8. BITÁCORA DE AUDITORÍA (Consola de Sistema al final) */}
      <div id="logs-audit-section" className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl flex flex-col space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Terminal size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm tracking-tight">Consola de Auditoría</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Logs de operaciones de base de datos</p>
            </div>
          </div>
          <span className="text-[10px] bg-[#070a13] border border-white/5 text-gray-400 px-2.5 py-0.5 rounded-md font-mono select-none">
            Historial
          </span>
        </div>

        <div className="max-h-[160px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
          {logs.length === 0 ? (
            <div className="text-center py-6 text-slate-550 text-xs font-semibold">
              No hay actividades registradas en la bitácora.
            </div>
          ) : (
            logs.slice(0, 10).map((log) => {
              const isDanger = log.accion.includes("ELIMINAR") || log.accion.includes("FALLO") || log.accion.includes("RECHAZAR");
              const isSuccess = log.accion.includes("PAGO") || log.accion.includes("CREAR") || log.accion.includes("CONECTAR") || log.accion.includes("SEMBRAR") || log.accion.includes("EDITAR");
              
              return (
                <div 
                  key={log.id} 
                  className="p-2.5 rounded-xl bg-white/[0.04] border border-white/3 flex items-start justify-between gap-3 text-[11px]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded ${
                        isDanger ? "bg-rose-500/10 text-red-400 border border-rose-500/20" :
                        isSuccess ? "bg-emerald-500/10 text-green-400 border border-emerald-500/20" :
                        "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}>
                        {log.accion}
                      </span>
                      <span className="text-[9.5px] text-gray-400 font-bold font-mono">@{log.usuario}</span>
                    </div>
                    <p className="text-slate-350 font-semibold leading-normal">{log.detalles}</p>
                  </div>
                  <span className="text-[9.5px] text-gray-500 font-mono shrink-0 whitespace-nowrap pt-0.5">
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
          <div id="modal-loans" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-[#0f172a] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/5 font-sans"
            >
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#070a13]/40">
                <h3 className="font-black text-white text-base">Registrar Nuevo Préstamo</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-455 hover:text-slate-200 p-1.5 rounded-xl hover:bg-white/5 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateLoan} className="p-6 space-y-4">
                {clientes.length === 0 ? (
                  <div className="p-4 bg-amber-500/10 text-amber-300 rounded-2xl text-xs space-y-2 border border-amber-500/20">
                    <p className="font-bold">No hay clientes registrados</p>
                    <p>Antes de poder otorgar un préstamo, debes registrar al menos un cliente en el directorio.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        onNavigateToClients();
                      }}
                      className="underline font-extrabold hover:text-amber-250 block mt-2 text-blue-400 cursor-pointer"
                    >
                      Ir a Registrar Cliente &rarr;
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5 relative">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">Prestatario *</label>
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
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-200 p-0.5 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      
                      {showClientDropdown && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowClientDropdown(false)} />
                          <div className="absolute left-0 right-0 mt-1 bg-[#0a0f1d] border border-white/5 rounded-xl max-h-40 overflow-y-auto z-20 shadow-xl custom-scrollbar divide-y divide-white/5">
                            {clientes.filter(c => 
                              c.nombre_completo.toLowerCase().includes(clientSearch.toLowerCase())
                            ).length === 0 ? (
                              <div className="p-3 text-xs text-gray-500 text-center">
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
                                  className={`w-full text-left p-2.5 px-3.5 hover:bg-blue-500/10 text-xs transition flex items-center justify-between cursor-pointer ${
                                    selectedCliente === c.id ? "bg-indigo-500/20 text-indigo-300 font-extrabold" : "text-slate-200 font-semibold"
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

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">Capital (S/.) *</label>
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
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">Tasa (%) *</label>
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
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">Tipo Crédito</label>
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
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">F. Emisión</label>
                        <input
                          type="date"
                          value={fechaEmision}
                          onChange={(e) => setFechaEmision(e.target.value)}
                          className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">Fecha Vencimiento</label>
                      <input
                        type="date"
                        value={fechaVencimiento}
                        onChange={(e) => setFechaVencimiento(e.target.value)}
                        className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold"
                      />
                    </div>

                    {parseFloat(monto) > 0 && (
                      <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-2.5 text-xs font-semibold">
                        <span className="text-[9.5px] font-black text-indigo-300 uppercase tracking-widest block">Balance Estimado</span>
                        <div className="flex justify-between items-center text-slate-350">
                          <span>Capital original:</span>
                          <span className="font-mono">{formatCurrency(parseFloat(monto) || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-350">
                          <span>Interés (+{tasa}%):</span>
                          <span className="font-mono text-indigo-350">+{formatCurrency((parseFloat(monto) || 0) * (parseFloat(tasa) / 100))}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-black text-white pt-2.5 border-t border-white/5">
                          <span className="text-blue-400">Deuda Total:</span>
                          <span className="font-mono">{formatCurrency((parseFloat(monto) || 0) * (1 + parseFloat(tasa) / 100))}</span>
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-white/5 flex justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="px-5 py-2.5 hover:bg-white/5 rounded-xl text-slate-455 font-bold text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-indigo-500 to-violet-600 cursor-pointer"
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

      {/* MODAL EDICIÓN DE DEUDA (EDITAR PÉSTAMO) */}
      <AnimatePresence>
        {showEditModal && selectedEditLoan && (
          <div id="modal-edit-loan" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-[#0f172a] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/5 font-sans"
            >
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#070a13]/40">
                <div>
                  <h3 className="font-black text-white text-base">Modificar Datos de Deuda</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Prestatario: {selectedEditLoan.cliente_nombre}</p>
                </div>
                <button
                  onClick={() => { setShowEditModal(false); setSelectedEditLoan(null); }}
                  className="text-slate-455 hover:text-slate-200 p-1.5 rounded-xl hover:bg-white/5 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdateLoan} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">Capital Activo (S/.) *</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={editMonto}
                      onChange={(e) => setEditMonto(e.target.value)}
                      className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold font-mono"
                      required
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">Tasa (%) *</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editTasa}
                      onChange={(e) => setEditTasa(e.target.value)}
                      className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">Tipo Crédito</label>
                    <select
                      value={editTipo}
                      onChange={(e) => setEditTipo(e.target.value)}
                      className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold"
                    >
                      <option value="Personal" className="bg-[#0f172a]">Personal</option>
                      <option value="Negocio" className="bg-[#0f172a]">Negocio</option>
                      <option value="Hipotecario" className="bg-[#0f172a]">Hipotecario</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">Estado</label>
                    <select
                      value={editEstado}
                      onChange={(e) => setEditEstado(e.target.value)}
                      className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold"
                    >
                      <option value="activo" className="bg-[#0f172a]">Activo</option>
                      <option value="pagado" className="bg-[#0f172a]">Pagado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">F. Emisión</label>
                    <input
                      type="date"
                      value={editFechaEmision}
                      onChange={(e) => setEditFechaEmision(e.target.value)}
                      className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold"
                      required
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">F. Vencimiento</label>
                    <input
                      type="date"
                      value={editFechaVencimiento}
                      onChange={(e) => setEditFechaVencimiento(e.target.value)}
                      className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold"
                    />
                  </div>
                </div>

                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">Zona de Riesgo</span>
                    <span className="text-[10.5px] text-gray-400 mt-0.5 block leading-normal">Eliminarás todos los registros en cascada relacionados.</span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleDeleteLoan(selectedEditLoan.id)}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 text-red-400 hover:text-white transition-all cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Eliminar</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setSelectedEditLoan(null); }}
                    className="px-5 py-2.5 hover:bg-white/5 rounded-xl text-slate-455 font-bold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updatingLoan}
                    className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-indigo-500 to-violet-600 cursor-pointer"
                  >
                    {updatingLoan ? "Guardando..." : "Guardar Cambios"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL PREVISUALIZACIÓN DE VOUCHERS (LIGHTBOX) */}
      <AnimatePresence>
        {selectedLightboxImage && (
          <div 
            onClick={() => setSelectedLightboxImage(null)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer"
          >
            <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
              <a 
                href={selectedLightboxImage} 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={(e) => e.stopPropagation()}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
                title="Abrir en pestaña nueva"
              >
                <ExternalLink size={20} />
              </a>
              <button 
                onClick={() => setSelectedLightboxImage(null)}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <img 
              src={selectedLightboxImage} 
              alt="Voucher Ampliado" 
              className="max-w-full max-h-[85vh] object-contain rounded-3xl border border-white/5 shadow-2xl animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            />
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
          <div id="modal-voucher" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-[#0f172a] rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-white/5 flex flex-col md:flex-row font-sans"
            >
              {/* Left Column: Voucher image */}
              <div className="w-full md:w-1/2 bg-[#070a13]/30 p-6 flex flex-col justify-between items-center border-b md:border-b-0 md:border-r border-white/5">
                <div className="w-full">
                  <span className="text-[10px] font-black text-emerald-450 uppercase tracking-widest block mb-1 pl-0.5">Captura del Abono</span>
                  <p className="text-xs text-gray-500 font-semibold leading-normal mb-4">
                    Comprobante de transferencia subido para verificación.
                  </p>
                </div>

                <div className="w-full flex-1 flex items-center justify-center min-h-[220px] max-h-[300px] bg-slate-955/50 rounded-2xl p-3 border border-white/5 relative overflow-hidden">
                  {vcrOcrLoading && (
                    <div className="absolute inset-0 bg-[#070a13]/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 z-10">
                      <Loader2 className="animate-spin text-emerald-450 mb-3" size={28} />
                      <span className="text-xs font-black text-white tracking-wide">{ocrProgress}</span>
                      <span className="text-[10px] text-gray-500 mt-1.5 block">Leyendo campos financieros del voucher...</span>
                    </div>
                  )}

                  {vcrBase64 ? (
                    <img 
                      src={`data:${vcrMimeType || "image/jpeg"};base64,${vcrBase64}`} 
                      alt="Voucher de Pago" 
                      className="max-w-full max-h-[240px] object-contain rounded-2xl"
                    />
                  ) : (
                    <div className="text-center text-slate-600 text-xs">
                      Ningún voucher cargado.
                    </div>
                  )}
                </div>
                
                {vcrFileName && (
                  <div className="w-full text-center mt-4 p-2.5 bg-white/[0.01] border border-white/5 rounded-xl truncate text-[10px] text-gray-500 font-mono">
                    {vcrFileName}
                  </div>
                )}
              </div>

              {/* Right Column: Form */}
              <div className="w-full md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto max-h-[85vh] md:max-h-none">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <div>
                      <h3 className="font-extrabold text-white text-sm md:text-base">Registrar Abono por OCR</h3>
                      <p className="text-[10px] text-green-400 uppercase tracking-widest font-black">Escaneo de Voucher</p>
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
                        setOcrRawText("");
                        setShowOcrDebug(false);
                      }}
                      className="text-slate-455 hover:text-slate-200 p-1.5 rounded-xl hover:bg-white/5 transition cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Autocomplete de Clientes */}
                  <div className="space-y-1.5 relative">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">Asociar a Prestatario *</label>
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
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-200 p-0.5 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {showVcrClienteDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowVcrClienteDropdown(false)} />
                        <div className="absolute left-0 right-0 mt-1 bg-[#0a0f1d] border border-white/5 rounded-xl max-h-40 overflow-y-auto z-20 shadow-xl custom-scrollbar divide-y divide-white/5">
                          {clientes.filter(c => 
                            c.nombre_completo.toLowerCase().includes(vcrClienteSearch.toLowerCase())
                          ).length === 0 ? (
                            <div className="p-3 text-xs text-gray-500 text-center">
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
                                className={`w-full text-left p-2.5 px-3.5 hover:bg-blue-500/10 text-xs transition flex items-center justify-between cursor-pointer ${
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
                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-2">
                      <span className="text-[9px] font-black text-indigo-350 uppercase tracking-widest block">Crédito del Deudor</span>
                      {vcrClientLoans.length === 0 ? (
                        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-[10.5px] leading-normal font-semibold flex items-center gap-2">
                          <ShieldAlert size={14} className="shrink-0 text-red-400 " />
                          <span>Este prestatario está al día (0 créditos activos).</span>
                        </div>
                      ) : vcrClientLoans.length === 1 ? (
                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-[10.5px] leading-normal font-semibold flex items-center gap-2">
                          <CheckCircle size={14} className="shrink-0 text-green-400" />
                          <div>
                            <span className="block text-[9px] text-gray-500 font-bold uppercase">Asociación Automática</span>
                            <span className="block mt-0.5">{vcrClientLoans[0].tipo_prestamo} · Capital: {formatCurrency(vcrClientLoans[0].monto_capital)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold text-indigo-300 uppercase block">Seleccionar Préstamo *</label>
                          <select
                            value={vcrSelectedLoanId}
                            onChange={(e) => setVcrSelectedLoanId(e.target.value)}
                            className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-semibold"
                            required
                          >
                            <option value="" className="bg-[#0f172a]">-- Elegir Préstamo Destino --</option>
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
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5 font-mono">Dinero (S/.) *</label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="Monto"
                        value={vcrMonto}
                        onChange={(e) => setVcrMonto(e.target.value)}
                        className="w-full glass-input rounded-xl p-2.5 text-xs text-slate-200 outline-none font-black font-mono"
                        required
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">Fecha Operación *</label>
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
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-0.5">Canal de Pago *</label>
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

                  {/* Consola OCR Debugging (Para mayor control del usuario) */}
                  {ocrRawText && (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setShowOcrDebug(!showOcrDebug)}
                        className="text-[9.5px] font-black text-blue-400 uppercase tracking-wider flex items-center gap-1 hover:text-indigo-350 cursor-pointer"
                      >
                        <Terminal size={11} />
                        <span>{showOcrDebug ? "Ocultar" : "Ver"} Consola OCR (Depuración)</span>
                      </button>
                      
                      {showOcrDebug && (
                        <pre className="p-3 bg-black/80 border border-white/5 rounded-xl text-[9px] text-gray-400 font-mono overflow-x-auto whitespace-pre-wrap max-h-32 custom-scrollbar">
                          {ocrRawText}
                        </pre>
                      )}
                    </div>
                  )}

                  {!vcrMonto && !vcrOcrLoading && (
                    <p className="text-[9px] text-amber-400 font-bold bg-amber-500/5 p-2.5 rounded-xl leading-normal border border-amber-500/10">
                      💡 <strong>Aviso:</strong> El lector automático no logró descifrar el monto del voucher debido a la resolución de imagen. Por favor ingresa el monto a mano en la casilla superior para guardar.
                    </p>
                  )}
                </div>

                <div className="pt-5 border-t border-white/5 flex justify-end gap-2.5 shrink-0">
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
                      setOcrRawText("");
                      setShowOcrDebug(false);
                    }}
                    className="px-4 py-2.5 hover:bg-white/5 rounded-xl text-slate-455 font-bold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleVoucherRegister}
                    disabled={vcrRegistering || !vcrSelectedClienteId || !vcrSelectedLoanId || !vcrMonto || vcrOcrLoading}
                    className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-emerald-500 to-teal-600 disabled:opacity-40"
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
