import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Bell, ArrowUpRight, Search, FileDown, Info, Calendar, Briefcase, Filter, X, Edit, Landmark, Target, Activity, AlertTriangle } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { DataTable, ColumnDef } from "../components/ui/DataTable";
import { formatCurrency, formatDateWithDay, round2, getNombreUsuario } from "../lib/formatters";
import { usePrestamos } from "../hooks/usePrestamos";
import { useClientes } from "../hooks/useClientes";
import { useAuth } from "../hooks/useAuth";

export const CarteraPage: React.FC = () => {
  const { user } = useAuth();
  const { clientes } = useClientes();
  const { updatePrestamo } = usePrestamos();

  const [prestamos, setPrestamos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowTick] = useState(() => new Date());

  // Form edit states
  const [selectedEditLoan, setSelectedEditLoan] = useState<any>(null);
  const [editFechaEmision, setEditFechaEmision] = useState("");
  const [editFechaVencimiento, setEditFechaVencimiento] = useState("");
  const [editMontoCapital, setEditMontoCapital] = useState("");
  const [editTasaInteres, setEditTasaInteres] = useState("");
  const [editMontoMensual, setEditMontoMensual] = useState("");
  const [editDuracionMeses, setEditDuracionMeses] = useState("6");
  const [showEditModal, setShowEditModal] = useState(false);
  const [updatingLoan, setUpdatingLoan] = useState(false);

  // Advanced Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<"todos" | "activo" | "pagado" | "mora" | "todos">("todos");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [fechaMin, setFechaMin] = useState("");
  const [fechaMax, setFechaMax] = useState("");
  const [montoMin, setMontoMin] = useState("");
  const [montoMax, setMontoMax] = useState("");
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date(nowTick);
  today.setHours(0, 0, 0, 0);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/prestamos");
      if (res.ok) {
        const data = await res.json();
        setPrestamos(data || []);
      }
    } catch (err) {
      console.error("Error al cargar préstamos para la cartera:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const getWhatsAppLink = (loan: any) => {
    const cliente = clientes.find((c) => c.id === loan.cliente_id);
    if (!cliente || !cliente.telefono) return null;
    const phone = cliente.telefono.replace(/[^\d+]/g, "").trim();
    if (!phone) return null;

    const isAlquiler = loan.tipo_prestamo === "Alquiler de Casa";
    let amount = 0;
    if (isAlquiler) {
      const start = new Date(loan.fecha_emision + "T12:00:00");
      const end = loan.fecha_vencimiento ? new Date(loan.fecha_vencimiento + "T12:00:00") : null;
      let duration = 6;
      if (end && !isNaN(end.getTime()) && !isNaN(start.getTime())) {
        duration = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
      }
      amount = round2(parseFloat(loan.monto_capital) / duration);
    } else {
      const capital = parseFloat(loan.monto_capital) || 0;
      const interest = parseFloat(loan.tasa_interes_porcentaje) || 0;
      amount = round2(capital * (1 + interest / 100));
    }

    const formattedAmount = formatCurrency(amount);
    const fechaFormato = formatDateWithDay(loan.fecha_vencimiento);
    
    const text = isAlquiler
      ? `¡Hola, ${loan.cliente_nombre}! Te saludamos de la administración. 🇵🇪 Te recordamos amablemente tu mensualidad de alquiler de ${formattedAmount} con vencimiento el ${fechaFormato}. Agradecemos tu puntualidad y apoyo. ¡Que tengas un gran día!`
      : `¡Hola, ${loan.cliente_nombre}! Te saludamos de la administración. 🇵🇪 Te recordamos amablemente tu cuota/saldo pendiente de ${formattedAmount} con vencimiento el ${fechaFormato}. Agradecemos tu puntualidad y apoyo. ¡Que tengas un gran día!`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const getRecordatorioLink = (loan: any) => {
    const cliente = clientes.find((c) => c.id === loan.cliente_id);
    if (!cliente || !cliente.telefono) return null;
    const phone = cliente.telefono.replace(/\D/g, "").trim();
    if (!phone) return null;

    const NOMBRES_FEMENINOS = new Set([
      "maria", "ana", "lucia", "sofia", "elena", "carmen", "rosa", "claudia", "andrea", "patricia",
      "laura", "diana", "gloria", "monica", "sandra", "alejandra", "valentina", "gabriela", "lorena",
      "jessica", "vanessa", "adriana", "paola", "natalia", "carolina", "fernanda", "daniela", "sara",
      "isabel", "pilar", "julia", "alicia", "beatriz", "cristina", "irene", "mariana", "raquel",
      "silvia", "yolanda", "angela", "consuelo", "esperanza", "graciela", "luz", "mercedes", "norma",
      "olga", "rebeca", "susana", "veronica", "wendy", "xiomara", "yasmin", "zoraida", "pamela",
      "karina", "brenda", "gisela", "rocio", "miriam", "nancy", "marisol", "milagros", "flor",
      "liliana", "estela", "cecilia", "catalina", "evelyn", "fabiola", "helen", "iliana"
    ]);
    const primerNombre = loan.cliente_nombre.trim().split(/\s+/)[0].toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tratamiento = NOMBRES_FEMENINOS.has(primerNombre) ? "SRA." : "SR.";

    const isAlquiler = loan.tipo_prestamo === "Alquiler de Casa";
    let amount = 0;
    if (isAlquiler) {
      const start = new Date(loan.fecha_emision + "T12:00:00");
      const end = loan.fecha_vencimiento ? new Date(loan.fecha_vencimiento + "T12:00:00") : null;
      let duration = 6;
      if (end && !isNaN(end.getTime()) && !isNaN(start.getTime())) {
        duration = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
      }
      amount = round2(parseFloat(loan.monto_capital) / duration);
    } else {
      const capital = parseFloat(loan.monto_capital) || 0;
      const interest = parseFloat(loan.tasa_interes_porcentaje) || 0;
      amount = round2(capital * (1 + interest / 100));
    }

    const cuota = formatCurrency(amount);
    const fecha = formatDateWithDay(loan.fecha_vencimiento);
    const nombreMayus = loan.cliente_nombre.toUpperCase();
    const remitente = getNombreUsuario(user);

    const mensaje = isAlquiler
      ? `¡Hola, ${tratamiento} ${nombreMayus}! Te saluda ${remitente}.\n` +
        `Te escribo para recordarte amablemente tu mensualidad de alquiler pendiente a cancelar:\n\n` +
        `${cuota} con vencimiento el ${fecha}.\n\n` +
        `Agradezco tu puntualidad y apoyo. ¡Que tengas un gran día!\n` +
        `Cualquier cosa me lo escribe.`
      : `¡Hola, ${tratamiento} ${nombreMayus}! Te saluda ${remitente}.\n` +
        `Te escribo para recordarte amablemente tu cuota pendiente a cancelar:\n\n` +
        `${cuota} con vencimiento el ${fecha} para no generar intereses.\n\n` +
        `Agradezco tu puntualidad y apoyo. ¡Que tengas un gran día!\n` +
        `Cualquier cosa me lo escribe.`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
  };

  const getRemainingDays = (dateValue: string) => {
    if (!dateValue) return 0;
    const dueDate = new Date(`${dateValue}T00:00:00`);
    return Math.ceil((dueDate.getTime() - today.getTime()) / dayMs);
  };

  // Auto-calcular fecha de vencimiento al cambiar fecha de emisión o duración en modo Alquiler (Modo Edición)
  useEffect(() => {
    if (selectedEditLoan && selectedEditLoan.tipo_prestamo === "Alquiler de Casa") {
      if (editFechaEmision) {
        const d = new Date(editFechaEmision + "T12:00:00");
        d.setMonth(d.getMonth() + parseInt(editDuracionMeses || "6"));
        setEditFechaVencimiento(d.toISOString().split("T")[0]);
      }
    }
  }, [editFechaEmision, editDuracionMeses, selectedEditLoan]);

  const handleOpenEditModal = (loan: any, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedEditLoan(loan);
    setEditFechaEmision(loan.fecha_emision);
    setEditFechaVencimiento(loan.fecha_vencimiento || "");

    const isAlq = loan.tipo_prestamo === "Alquiler de Casa";
    if (isAlq) {
      const start = new Date(loan.fecha_emision + "T12:00:00");
      const end = loan.fecha_vencimiento ? new Date(loan.fecha_vencimiento + "T12:00:00") : null;
      let duration = 6;
      if (end && !isNaN(end.getTime()) && !isNaN(start.getTime())) {
        duration = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
      }
      const monthly = round2(parseFloat(loan.monto_capital) / duration);
      setEditMontoMensual(String(monthly));
      setEditDuracionMeses(String(duration));
    } else {
      setEditMontoCapital(String(loan.monto_capital || ""));
      setEditTasaInteres(String(loan.tasa_interes_porcentaje || ""));
    }
    setShowEditModal(true);
  };

  const handleEditLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditLoan) return;

    let finalCapital = parseFloat(editMontoCapital);
    let finalTasa = parseFloat(editTasaInteres);
    let finalVencimiento = editFechaVencimiento;

    if (selectedEditLoan.tipo_prestamo === "Alquiler de Casa") {
      finalCapital = parseFloat(editMontoMensual) * parseInt(editDuracionMeses);
      finalTasa = 0; // Tasa es 0 para alquileres
    }

    setUpdatingLoan(true);
    const res = await updatePrestamo(selectedEditLoan.id, {
      fecha_emision: editFechaEmision,
      fecha_vencimiento: finalVencimiento || null,
      monto_capital: finalCapital || undefined,
      tasa_interes_porcentaje: finalTasa,
    });
    setUpdatingLoan(false);

    if (res.success) {
      setShowEditModal(false);
      await fetchLoans();
    } else {
      alert(res.error || "No se pudo actualizar la información del préstamo.");
    }
  };

  // Get distinct loan types for filter dropdown
  const loanTypes = useMemo(() => {
    const typesSet = new Set<string>();
    prestamos.forEach((p) => {
      if (p.tipo_prestamo) typesSet.add(p.tipo_prestamo);
    });
    return Array.from(typesSet);
  }, [prestamos]);

  // Compute portfolio-wide KPIs based on current dataset (pre-filter)
  const portfolioKPIs = useMemo(() => {
    const totalColocado = prestamos.reduce((sum, p) => sum + (parseFloat(p.monto_capital) || 0), 0);
    const activasCount = prestamos.filter((p) => p.estado === "activo").length;
    
    // Mora: status active and overdue (days remaining < 0)
    const enMoraLoans = prestamos.filter((p) => {
      if (p.estado !== "activo") return false;
      const remaining = getRemainingDays(p.fecha_vencimiento);
      return remaining < 0;
    });
    const enMoraCount = enMoraLoans.length;
    const enMoraPct = activasCount > 0 ? (enMoraCount / activasCount) * 100 : 0;

    const totalExigible = prestamos.reduce((sum, p) => {
      const cap = parseFloat(p.monto_capital) || 0;
      const rate = parseFloat(p.tasa_interes_porcentaje) || 0;
      return sum + cap * (1 + rate / 100);
    }, 0);

    return {
      totalColocado,
      activasCount,
      enMoraCount,
      enMoraPct,
      totalExigible,
    };
  }, [prestamos]);

  // Apply all advanced filters
  const filteredLoans = useMemo(() => {
    return prestamos.filter((p) => {
      // 1. Search term
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const clientMatch = p.cliente_nombre?.toLowerCase().includes(query);
        const typeMatch = p.tipo_prestamo?.toLowerCase().includes(query);
        if (!clientMatch && !typeMatch) return false;
      }

      // 2. Estado
      if (filterEstado !== "todos") {
        if (filterEstado === "mora") {
          const remaining = getRemainingDays(p.fecha_vencimiento);
          if (p.estado !== "activo" || remaining >= 0) return false;
        } else {
          if (p.estado !== filterEstado) return false;
          // Si filtra por activos puros, excluir mora
          if (filterEstado === "activo") {
            const remaining = getRemainingDays(p.fecha_vencimiento);
            if (remaining < 0) return false;
          }
        }
      }

      // 3. Tipo préstamo
      if (filterTipo !== "todos") {
        if (p.tipo_prestamo !== filterTipo) return false;
      }

      // 4. Fechas
      if (fechaMin && p.fecha_emision < fechaMin) return false;
      if (fechaMax && p.fecha_emision > fechaMax) return false;

      // 5. Montos
      const capital = parseFloat(p.monto_capital) || 0;
      if (montoMin && capital < parseFloat(montoMin)) return false;
      if (montoMax && capital > parseFloat(montoMax)) return false;

      return true;
    });
  }, [prestamos, searchTerm, filterEstado, filterTipo, fechaMin, fechaMax, montoMin, montoMax]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterEstado("todos");
    setFilterTipo("todos");
    setFechaMin("");
    setFechaMax("");
    setMontoMin("");
    setMontoMax("");
  };

  const handleExportCsv = () => {
    const csvHeaders = ["Prestatario", "Monto Capital (S/.)", "Tasa Interes %", "Fecha Emision", "Fecha Vencimiento", "Tipo", "Dias Estado", "Estado"];
    const csvRows = filteredLoans.map((p) => {
      const remaining = getRemainingDays(p.fecha_vencimiento);
      let statusStr = p.estado === "pagado" ? "Pagado" : "Activo";
      let daysStr = "";

      if (p.estado === "activo") {
        if (remaining < 0) {
          statusStr = "En Mora";
          daysStr = `Vencido hace ${Math.abs(remaining)} dias`;
        } else if (remaining === 0) {
          daysStr = "Vence hoy";
        } else {
          daysStr = `Quedan ${remaining} dias`;
        }
      }

      return [
        p.cliente_nombre,
        p.monto_capital,
        p.tasa_interes_porcentaje,
        p.fecha_emision,
        p.fecha_vencimiento || "",
        p.tipo_prestamo,
        daysStr,
        statusStr,
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,"
      + [csvHeaders.join(","), ...csvRows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `prestafacilito_cartera_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns: ColumnDef<any>[] = [
    {
      header: "Prestatario",
      accessorKey: "cliente_nombre",
      sortable: true,
      cell: (loan) => {
        return (
          <Link to={`/clientes/${loan.cliente_id}`} className="flex items-center gap-1 hover:opacity-90 select-none cursor-pointer group decoration-none">
            <span className="font-bold text-slate-900 block group-hover:text-indigo-600 transition leading-tight">{loan.cliente_nombre}</span>
          </Link>
        );
      },
    },
    {
      header: "Capital",
      accessorKey: "monto_capital",
      sortable: true,
      cell: (loan) => (
        <span className="font-extrabold text-slate-800 font-mono text-xs sm:text-sm">
          {formatCurrency(loan.monto_capital)}
        </span>
      ),
    },
    {
      header: "Tasa (%)",
      accessorKey: "tasa_interes_porcentaje",
      sortable: true,
      cell: (loan) => (
        <span className="font-bold text-indigo-600 font-mono text-xs">
          {loan.tasa_interes_porcentaje}%
        </span>
      ),
    },
    {
      header: "F. Emisión",
      accessorKey: "fecha_emision",
      sortable: true,
      cell: (loan) => (
        <span className="text-slate-600 font-mono text-[11px]">
          {loan.fecha_emision}
        </span>
      ),
    },
    {
      header: "F. Vencimiento",
      accessorKey: "fecha_vencimiento",
      sortable: true,
      cell: (loan) => (
        <span className="text-slate-600 text-[11px] whitespace-normal">
          {loan.fecha_vencimiento ? formatDateWithDay(loan.fecha_vencimiento) : "No est."}
        </span>
      ),
    },
    {
      header: "Plazo Restante",
      cell: (loan) => {
        if (loan.estado === "pagado") {
          return <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Liquidador</span>;
        }
        const days = getRemainingDays(loan.fecha_vencimiento);
        if (days < 0) {
          return (
            <Badge variant="danger" className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5">
              Mora -{Math.abs(days)}d
            </Badge>
          );
        }
        if (days === 0) {
          return (
            <Badge variant="warning" className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 animate-pulse">
              Vence hoy
            </Badge>
          );
        }
        if (days <= 5) {
          return (
            <Badge variant="info" className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5">
              En {days} días
            </Badge>
          );
        }
        return (
          <Badge variant="neutral" className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 text-slate-600">
            {days} días
          </Badge>
        );
      },
    },
    {
      header: "Categoría",
      accessorKey: "tipo_prestamo",
      sortable: true,
      cell: (loan) => (
        <Badge variant="neutral" className="text-[9px] font-bold py-0.5">{loan.tipo_prestamo}</Badge>
      ),
    },
    {
      header: "Estado",
      accessorKey: "estado",
      sortable: true,
      cell: (loan) => {
        const isPagado = loan.estado === "pagado";
        const isMora = loan.estado === "activo" && getRemainingDays(loan.fecha_vencimiento) < 0;

        if (isPagado) {
          return <Badge variant="neutral" className="bg-slate-100 text-slate-700 border border-slate-200">Pagado</Badge>;
        }
        if (isMora) {
          return <Badge variant="danger">En Mora</Badge>;
        }
        return <Badge variant="success">Activo</Badge>;
      },
    },
    {
      header: "Acciones",
      cell: (loan) => {
        const waLink = getWhatsAppLink(loan);
        const recLink = getRecordatorioLink(loan);
        return (
          <div className="flex items-center justify-end gap-2 shrink-0">
            {loan.estado === "activo" && waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
                title="Cobrar vía WhatsApp"
              >
                <MessageSquare size={14} />
              </a>
            )}
            {loan.estado === "activo" && recLink && (
              <a
                href={recLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 hover:text-amber-700 p-1.5 hover:bg-amber-55 rounded-xl transition cursor-pointer"
                title="Enviar recordatorio de cuota"
              >
                <Bell size={14} />
              </a>
            )}

            <button
              onClick={(e) => handleOpenEditModal(loan, e)}
              className="text-slate-500 hover:text-indigo-650 p-1.5 hover:bg-slate-100 rounded-xl transition cursor-pointer border-none bg-transparent"
              title="Editar Parámetros"
            >
              <Edit size={14} />
            </button>

            <Link
              to={`/prestamos/${loan.id}`}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-800 py-1 px-2.5 rounded-lg font-bold transition cursor-pointer inline-flex items-center gap-1 decoration-none"
            >
              <span>Ver</span>
              <ArrowUpRight size={10} />
            </Link>
          </div>
        );
      },
    },
  ];

  const renderExpandedRow = (loan: any) => {
    const days = getRemainingDays(loan.fecha_vencimiento);
    const interest = parseFloat(loan.tasa_interes_porcentaje) || 0;
    const capital = parseFloat(loan.monto_capital) || 0;
    const totalAmortizable = round2(capital * (1 + interest / 100));

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs select-none p-2 bg-slate-50 border border-slate-200 rounded-2xl">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-indigo-650 shrink-0" />
          <div>
            <span className="text-slate-500 font-bold block uppercase text-[9px] tracking-wider">Flujo Total Estimado:</span>
            <span className="font-extrabold text-slate-800 text-xs">{formatCurrency(totalAmortizable)} (con intereses)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-indigo-650 shrink-0" />
          <div>
            <span className="text-slate-500 font-bold block uppercase text-[9px] tracking-wider">Vencimiento Final:</span>
            <span className="font-extrabold text-slate-800 text-xs">{loan.fecha_vencimiento ? formatDateWithDay(loan.fecha_vencimiento) : "No configurado"}</span>
          </div>
        </div>

        {loan.estado === "activo" && (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 animate-ping" />
            <div>
              <span className="text-slate-500 font-bold block uppercase text-[9px] tracking-wider">Cronograma:</span>
              <span className={`inline-flex items-center gap-1.5 font-black uppercase tracking-wider text-[9px] ${
                days < 0 ? "text-rose-600" : days === 0 ? "text-amber-600" : "text-emerald-600"
              }`}>
                {days < 0 ? `Expirado hace ${Math.abs(days)} días` : days === 0 ? "Vence hoy" : `Queda un plazo de ${days} días`}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none flex items-center gap-2">
            <Briefcase className="text-indigo-650 shrink-0" size={24} />
            <span>Cartera de Deudas</span>
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mt-1.5">
            Gestión ejecutiva, búsqueda multinivel, filtros avanzados y auditoría de créditos
          </p>
        </div>

        <div className="flex items-center gap-2 select-none">
          <Button
            variant="secondary"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 text-xs font-bold py-2.5 px-4 h-11"
          >
            <FileDown size={14} />
            <span>Exportar CSV</span>
          </Button>
          
          <Link to="/clientes" className="decoration-none">
            <Button
              variant="primary"
              className="flex items-center gap-1.5 text-xs font-bold py-2.5 px-4 h-11"
            >
              <span>Ver Clientes</span>
              <ArrowUpRight size={14} />
            </Button>
          </Link>
        </div>
      </div>

      {/* MINI-KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <Card variant="bento" className="relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Capital Colocado</span>
            <div className="p-1 bg-indigo-50 rounded-lg text-indigo-600">
              <Landmark size={14} />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-lg sm:text-xl font-black text-slate-900 font-mono block leading-none">
              {formatCurrency(portfolioKPIs.totalColocado)}
            </span>
            <span className="text-[8px] text-slate-500 font-bold uppercase mt-1 block">Suma de capital directo</span>
          </div>
        </Card>

        {/* KPI 2 */}
        <Card variant="bento" className="relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Deudas Activas</span>
            <div className="p-1 bg-emerald-50 rounded-lg text-emerald-600">
              <Activity size={14} />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-lg sm:text-xl font-black text-slate-900 font-mono block leading-none">
              {portfolioKPIs.activasCount} préstamos
            </span>
            <span className="text-[8px] text-slate-500 font-bold uppercase mt-1 block">Préstamos vigentes</span>
          </div>
        </Card>

        {/* KPI 3 */}
        <Card variant="bento" className="relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">En Mora</span>
            <div className="p-1 bg-rose-50 rounded-lg text-rose-600">
              <AlertTriangle size={14} />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-lg sm:text-xl font-black text-rose-600 font-mono block leading-none">
              {portfolioKPIs.enMoraCount} ({portfolioKPIs.enMoraPct.toFixed(0)}%)
            </span>
            <span className="text-[8px] text-rose-600 font-bold uppercase mt-1 block">Retraso acumulado</span>
          </div>
        </Card>

        {/* KPI 4 */}
        <Card variant="bento" className="relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Retorno Estimado</span>
            <div className="p-1 bg-blue-50 rounded-lg text-blue-600">
              <Target size={14} />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-lg sm:text-xl font-black text-slate-900 font-mono block leading-none">
              {formatCurrency(portfolioKPIs.totalExigible)}
            </span>
            <span className="text-[8px] text-slate-500 font-bold uppercase mt-1 block">Capital + Interés total</span>
          </div>
        </Card>
      </div>

      {/* TABLA PRINCIPAL Y FILTROS */}
      <Card variant="simple" className="flex flex-col">
        {/* BARRA DE HERRAMIENTAS */}
        <div className="p-1 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 select-none">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por prestatario, categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input pl-10 pr-4 h-11 w-full bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`flex items-center gap-1.5 h-11 px-4 border rounded-xl font-black text-[10px] uppercase tracking-widest transition cursor-pointer ${
                showFiltersPanel
                  ? "bg-indigo-650 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Filter size={13} />
              <span>Filtros avanzados</span>
              {(filterEstado !== "todos" || filterTipo !== "todos" || fechaMin || fechaMax || montoMin || montoMax) && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              )}
            </button>

            {(filterEstado !== "todos" || filterTipo !== "todos" || fechaMin || fechaMax || montoMin || montoMax || searchTerm) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 h-11 px-3 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition cursor-pointer border-none"
              >
                <X size={13} />
                <span>Limpiar</span>
              </button>
            )}

            {/* SEGMENTED CONTROL: ESTADOS RÁPIDOS */}
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
              {(["todos", "activo", "pagado", "mora"] as const).map((est) => (
                <button
                  key={est}
                  onClick={() => setFilterEstado(est)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer border-none transition-all duration-150 ${
                    filterEstado === est
                      ? est === "mora"
                        ? "bg-rose-600 text-white shadow-md"
                        : est === "pagado"
                        ? "bg-slate-700 text-white"
                        : "bg-indigo-650 text-white shadow-md shadow-indigo-650/10"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {est === "todos" ? "Todos" : est === "activo" ? "Vigentes" : est === "pagado" ? "Pagados" : "En Mora"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PANEL DE FILTROS AVANZADOS EXPANDIBLE */}
        {showFiltersPanel && (
          <div className="p-4 bg-slate-50/50 border-b border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn select-none">
            {/* Filtro por Categoría */}
            <div className="space-y-1.5">
              <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest block">Categoría de Crédito</label>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="glass-input w-full px-3 h-10 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold cursor-pointer"
              >
                <option value="todos">Todas las categorías</option>
                {loanTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Fechas de Emisión Min/Max */}
            <div className="space-y-1.5 col-span-1 sm:col-span-2">
              <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest block">Rango de Emisión (Fecha)</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={fechaMin}
                  onChange={(e) => setFechaMin(e.target.value)}
                  className="glass-input flex-1 px-3 h-10 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold cursor-pointer"
                />
                <span className="text-slate-550 font-bold self-center text-xs">al</span>
                <input
                  type="date"
                  value={fechaMax}
                  onChange={(e) => setFechaMax(e.target.value)}
                  className="glass-input flex-1 px-3 h-10 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold cursor-pointer"
                />
              </div>
            </div>

            {/* Monto Min/Max */}
            <div className="space-y-1.5">
              <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest block">Monto Capital (S/.)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={montoMin}
                  onChange={(e) => setMontoMin(e.target.value)}
                  className="glass-input flex-1 px-3 h-10 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold"
                />
                <span className="text-slate-550 font-bold self-center text-xs">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={montoMax}
                  onChange={(e) => setMontoMax(e.target.value)}
                  className="glass-input flex-1 px-3 h-10 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold"
                />
              </div>
            </div>
          </div>
        )}

        {/* TABLA */}
        <div className="mt-5">
          <DataTable
            data={filteredLoans}
            columns={columns}
            pageSize={15}
            renderExpandedRow={renderExpandedRow}
            emptyMessage={loading ? "Cargando base de datos..." : "No se encontraron préstamos que coincidan con la búsqueda."}
            showSearch={false}
          />
        </div>
      </Card>

      {/* EDIT LOAN MODAL */}
      {showEditModal && selectedEditLoan && (() => {
        const isAlquiler = selectedEditLoan.tipo_prestamo === "Alquiler de Casa";
        return (
          <Modal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            title={isAlquiler ? `Editar Contrato de Alquiler: ${selectedEditLoan.cliente_nombre}` : `Editar Parámetros: ${selectedEditLoan.cliente_nombre}`}
          >
            <form onSubmit={handleEditLoanSubmit} className="space-y-4 font-sans select-none">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-[10.5px] font-bold text-indigo-700 leading-normal flex items-start gap-2.5">
                <Info size={14} className="shrink-0 mt-0.5 text-indigo-650" />
                <span>
                  {isAlquiler
                    ? "Editar estos valores recalcula automáticamente la mensualidad y cronograma de cobros para este alquiler. Los cambios se sincronizarán con Google Calendar de inmediato."
                    : "Editar estos valores recalcula automáticamente el capital, tasa y cronograma de cobros para este crédito. Los cambios se sincronizarán con Google Calendar de inmediato."
                  }
                </span>
              </div>

              {isAlquiler ? (
                <>
                  {/* Campos de Alquiler */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Monto Mensual (S/.) *"
                      type="number"
                      step="any"
                      required
                      value={editMontoMensual}
                      onChange={(e) => setEditMontoMensual(e.target.value)}
                    />
                    <div className="flex flex-col gap-1.5 w-full">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block pl-0.5">
                        Duración (Meses) *
                      </label>
                      <select
                        value={editDuracionMeses}
                        onChange={(e) => setEditDuracionMeses(e.target.value)}
                        className="w-full h-11 px-4 glass-input rounded-xl border border-slate-200 outline-none bg-white cursor-pointer text-slate-800 text-xs font-bold"
                      >
                        {[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(m => (
                          <option key={m} value={m} className="bg-white text-slate-800">{m} {m === 1 ? 'Mes' : 'Meses'}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Fecha de Inicio de Contrato *"
                      type="date"
                      required
                      value={editFechaEmision}
                      onChange={(e) => setEditFechaEmision(e.target.value)}
                    />
                    <Input
                      label="Fin del Contrato (Auto)"
                      type="date"
                      required
                      disabled
                      className="opacity-60"
                      value={editFechaVencimiento}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Monto Capital */}
                  <Input
                    label="Monto Capital Inicial (S/.)"
                    type="number"
                    step="0.01"
                    required
                    value={editMontoCapital}
                    onChange={(e) => setEditMontoCapital(e.target.value)}
                  />

                  {/* Tasa de Interes */}
                  <Input
                    label="Tasa de Interés Mensual (%)"
                    type="number"
                    step="0.1"
                    required
                    value={editTasaInteres}
                    onChange={(e) => setEditTasaInteres(e.target.value)}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Fecha Emisión */}
                    <Input
                      label="Fecha de Emisión"
                      type="date"
                      required
                      value={editFechaEmision}
                      onChange={(e) => setEditFechaEmision(e.target.value)}
                    />

                    {/* Fecha Vencimiento */}
                    <Input
                      label="Fecha de Vencimiento Final"
                      type="date"
                      value={editFechaVencimiento}
                      onChange={(e) => setEditFechaVencimiento(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/80 mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={updatingLoan}
                  className="h-11 font-bold text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={updatingLoan}
                  className="h-11 font-bold text-xs px-5"
                >
                  Guardar Parámetros
                </Button>
              </div>
            </form>
          </Modal>
        );
      })()}
    </div>
  );
};
export default CarteraPage;
