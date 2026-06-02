import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Phone, Calendar, AlertCircle, CheckCircle, ChevronDown, ChevronUp,
  Edit3, Eye, Shield, ShieldCheck, ShieldAlert, MapPin, CreditCard,
  Info, MessageSquare, Bell
} from "lucide-react";
import { Cliente } from "../../types";
import { Badge } from "../ui/Badge";
import { DataTable, ColumnDef } from "../ui/DataTable";
import { formatCurrency, formatDate, getNombreUsuario } from "../../lib/formatters";
import { useAuth } from "../../hooks/useAuth";

// Gender detection for WhatsApp templates
const NOMBRES_FEMENINOS = new Set([
  'maria','ana','lucia','sofia','elena','carmen','rosa','claudia','andrea','patricia',
  'laura','diana','gloria','monica','sandra','alejandra','valentina','gabriela','lorena',
  'jessica','vanessa','adriana','paola','natalia','carolina','fernanda','daniela','sara',
  'isabel','pilar','julia','alicia','beatriz','cristina','irene','mariana','raquel',
  'silvia','yolanda','angela','consuelo','esperanza','graciela','luz','mercedes','norma',
  'olga','rebeca','susana','veronica','wendy','xiomara','yasmin','zoraida','pamela',
  'karina','brenda','gisela','rocio','miriam','nancy','marisol','milagros','flor',
  'liliana','estela','cecilia','catalina','evelyn','fabiola','helen','iliana'
]);

function detectarGenero(nombre: string): 'SR.' | 'SRA.' {
  const primerNombre = nombre.trim().split(/\s+/)[0].toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return NOMBRES_FEMENINOS.has(primerNombre) ? 'SRA.' : 'SR.';
}

function getMensajeRecordatorio(cliente: Cliente, username: string | null): string {
  const tratamiento = detectarGenero(cliente.nombre_completo);
  const nombre = cliente.nombre_completo.toUpperCase();
  const exigible = Number(cliente.total_exigible) || 0;
  const amortizado = Number(cliente.total_amortizado) || 0;
  const saldo = Math.max(0, exigible - amortizado);
  const cuota = saldo > 0 ? `S/ ${saldo.toFixed(2)}` : 'la cuota o mensualidad pendiente';
  const remitente = getNombreUsuario(username);
  return (
    `¡Hola, ${tratamiento} ${nombre}! Te saluda ${remitente}.\n` +
    `Te escribo para recordarte amablemente tu pago pendiente a cancelar:\n\n` +
    `${cuota}.\n\n` +
    `Agradezco tu puntualidad y apoyo. ¡Que tengas un gran día!\n` +
    `Cualquier cosa me lo escribe.`
  );
}

interface ClientListProps {
  clientes: Cliente[];
  onEditClient: (cliente: Cliente) => void;
}

export const ClientList: React.FC<ClientListProps> = ({ clientes, onEditClient }) => {
  const { user } = useAuth();
  const [filterType, setFilterType] = useState<"todos" | "con_deuda" | "sin_deuda">("todos");

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
      rationale = `El prestatario tiene un nivel de endeudamiento elevado con ${activeLoans} deudas activas y un saldo pendiente de S/. ${outstanding.toLocaleString("es-PE", { minimumFractionDigits: 2 })}.`;
      recommendations = [
        "Rechazar preventivamente nuevos préstamos hasta liquidar deudas vigentes.",
        "Priorizar visitas y llamadas en el canal de cobros.",
        "Solicitar un codeudor solidario o aval para futuras deudas."
      ];
    } else if (activeLoans === 1 || outstanding > 0) {
      level = "Medio";
      score = 70;
      rationale = `El cliente cuenta con una deuda vigente y un saldo pendiente de S/. ${outstanding.toLocaleString("es-PE", { minimumFractionDigits: 2 })}. Comportamiento regular.`;
      recommendations = [
        "Limitar nuevas deudas o ampliaciones de capital por el momento.",
        "Monitorear la puntualidad de sus cuotas actuales.",
        "Enviar recordatorios amistosos 2 días antes de la fecha de cobro."
      ];
    } else if (totalLoans > 0) {
      level = "Excelente";
      score = 98;
      rationale = `¡Excelente historial! Cuenta con ${totalLoans} deuda(s) totalmente cancelada(s) y sin atrasos.`;
      recommendations = [
        "Aprobar ampliaciones de crédito de forma rápida y preferente.",
        "Ofrecer incentivos de fidelidad o flexibilizar plazos."
      ];
    } else {
      level = "Bajo";
      score = 90;
      rationale = "Cliente nuevo sin historial de deudas registrado en la plataforma.";
      recommendations = [
        "Comenzar con montos prudentes (menores a S/. 500) para medir puntualidad.",
        "Evaluar estabilidad residencial y referencias personales básicas."
      ];
    }

    return { level, score, rationale, recommendations };
  };

  const getAvatarGradient = (name: string) => {
    const gradients = [
      "from-indigo-500 to-violet-600",
      "from-emerald-500 to-teal-600",
      "from-amber-500 to-orange-500",
      "from-rose-500 to-pink-600",
      "from-blue-500 to-cyan-600",
      "from-purple-500 to-fuchsia-600"
    ];
    return gradients[name.charCodeAt(0) % gradients.length];
  };

  const riskConfig = {
    Excelente: { color: "text-emerald-455", bg: "bg-emerald-500/10 border-emerald-500/15", bar: "bg-emerald-500", Icon: ShieldCheck },
    Bajo: { color: "text-blue-455", bg: "bg-blue-500/10 border-blue-500/15", bar: "bg-blue-500", Icon: Shield },
    Medio: { color: "text-amber-455", bg: "bg-amber-500/10 border-amber-500/15", bar: "bg-amber-500", Icon: ShieldAlert },
    Alto: { color: "text-rose-455", bg: "bg-rose-500/10 border-rose-500/15", bar: "bg-rose-500", Icon: ShieldAlert },
  };

  const displayPhone = (phoneNum?: string) => {
    if (!phoneNum) return "Sin teléfono";
    const clean = phoneNum.replace(/\D/g, '');
    if (clean.startsWith('51') && clean.length === 11) {
      return `+51 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
    }
    return phoneNum.startsWith("'") ? phoneNum.substring(1) : phoneNum;
  };

  // Filtrar clientes
  const clientesFiltrados = clientes.filter((c) => {
    if (filterType === "con_deuda") return (c.prestamos_activos || 0) > 0;
    if (filterType === "sin_deuda") return !(c.prestamos_activos || 0);
    return true;
  });

  const columns: ColumnDef<Cliente>[] = [
    {
      header: "Cliente",
      accessorKey: "nombre_completo",
      sortable: true,
      cell: (c) => {
        return (
          <div className="flex flex-col py-0.5">
            <span className="font-bold text-white leading-none">{c.nombre_completo}</span>
            <span className="text-[10px] text-slate-500 font-semibold mt-1 flex items-center gap-1">
              <Calendar size={10} className="shrink-0" /> Registrado: {formatDate(c.fecha_registro || "")}
            </span>
          </div>
        );
      }
    },
    {
      header: "Contacto",
      accessorKey: "telefono",
      sortable: true,
      cell: (c) => (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-300 font-mono font-bold">{displayPhone(c.telefono)}</span>
          {c.direccion && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1 max-w-[180px] truncate">
              <MapPin size={9} className="shrink-0" /> {c.direccion}
            </span>
          )}
        </div>
      )
    },
    {
      header: "Deuda Activa",
      accessorKey: "prestamos_activos",
      sortable: true,
      cell: (c) => {
        const hasDebt = (c.prestamos_activos || 0) > 0;
        const exigible = Number(c.total_exigible) || 0;
        const amortizado = Number(c.total_amortizado) || 0;
        const saldo = Math.max(0, exigible - amortizado);

        return (
          <div className="flex flex-col gap-1">
            {hasDebt ? (
              <>
                <span className="font-mono text-rose-400 font-extrabold text-xs md:text-sm">
                  {formatCurrency(saldo)}
                </span>
                <span className="text-[10px] text-indigo-400 font-bold">
                  {c.prestamos_activos} deuda{c.prestamos_activos !== 1 ? "s" : ""} activa{c.prestamos_activos !== 1 ? "s" : ""}
                </span>
              </>
            ) : (
              <span className="text-emerald-450 text-xs font-bold flex items-center gap-1 select-none">
                <CheckCircle size={11} /> Al día
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: "Riesgo & Score",
      accessorKey: "total_prestamos",
      sortable: true,
      cell: (c) => {
        const assessment = getClientRiskAssessment(c);
        const risk = riskConfig[assessment.level];
        return (
          <div className="flex flex-col gap-1">
            <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider ${risk.color}`}>
              <risk.Icon size={12} className="shrink-0" /> {assessment.level}
            </span>
            <span className="text-[10px] text-slate-550 font-semibold font-mono">
              Score: {assessment.score}/100
            </span>
          </div>
        );
      }
    },
    {
      header: "Acciones",
      cell: (c) => {
        const hasDebt = (c.prestamos_activos || 0) > 0;
        const waPhone = (c.telefono || '').replace(/\D/g, '');
        const recordatorio = getMensajeRecordatorio(c, user);

        return (
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            {waPhone && hasDebt && (
              <a
                href={`https://wa.me/${waPhone}?text=${encodeURIComponent(recordatorio)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition min-w-[34px] h-[34px] flex items-center justify-center shrink-0 decoration-none cursor-pointer"
                title="Enviar recordatorio de cuota"
              >
                <Bell size={13} />
              </a>
            )}
            
            {waPhone && (
              <a
                href={`https://wa.me/${waPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-emerald-600/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/25 transition min-w-[34px] h-[34px] flex items-center justify-center shrink-0 decoration-none cursor-pointer"
                title="WhatsApp Directo"
              >
                <Phone size={13} />
              </a>
            )}

            <button
              onClick={() => onEditClient(c)}
              className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08] transition min-w-[34px] h-[34px] flex items-center justify-center shrink-0 border-none cursor-pointer"
              title="Editar cliente"
            >
              <Edit3 size={13} />
            </button>

            <Link
              to={`/clientes/${c.id}`}
              className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition min-w-[34px] h-[34px] flex items-center justify-center shrink-0 decoration-none cursor-pointer"
              title="Ver Perfil y Notas"
            >
              <Eye size={13} />
            </Link>
          </div>
        );
      }
    }
  ];

  const renderExpandedRow = (c: Cliente) => {
    const assessment = getClientRiskAssessment(c);
    const risk = riskConfig[assessment.level];

    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Evaluación de Crédito</span>
              <span className={`text-[10px] font-black font-mono px-2.5 py-0.5 rounded-lg border ${risk.bg} ${risk.color}`}>
                Score: {assessment.score}/100
              </span>
            </div>
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div className={`h-full rounded-full transition-all duration-700 ${risk.bar}`} style={{ width: `${assessment.score}%` }} />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold mt-1.5">{assessment.rationale}</p>
          </div>

          {(c.numero_cuenta || c.informacion_adicional) && (
            <div className="md:w-72 bg-white/[0.02] border border-white/5 rounded-2xl p-3 space-y-2">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Datos Financieros</span>
              {c.numero_cuenta && (
                <div className="flex items-start gap-2 text-xs">
                  <CreditCard size={12} className="text-indigo-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300 font-mono break-all">{c.numero_cuenta}</span>
                </div>
              )}
              {c.informacion_adicional && (
                <div className="flex items-start gap-2 text-xs">
                  <Info size={12} className="text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-slate-400 font-medium">{c.informacion_adicional}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.05] pt-3">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Recomendaciones del Evaluador</span>
          <ul className="space-y-1.5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
            {assessment.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400 font-semibold leading-relaxed">
                <CheckCircle size={12} className="text-indigo-400 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const handleExportCsv = () => {
    const csvHeaders = ["Nombre Completo", "Telefono", "Direccion", "Registro", "Préstamos Activos", "Total Exigible", "Total Amortizado", "Observaciones"];
    const csvRows = clientes.map(c => [
      c.nombre_completo,
      c.telefono || "",
      c.direccion || "",
      c.fecha_registro || "",
      c.prestamos_activos || 0,
      c.total_exigible || 0,
      c.total_amortizado || 0,
      c.observaciones || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [csvHeaders.join(","), ...csvRows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `prestafacilito_clientes_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Filtros Rápidos */}
      <div className="flex justify-between items-center gap-4">
        <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 gap-0.5 select-none shrink-0">
          {(["todos", "con_deuda", "sin_deuda"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer border-none ${
                filterType === f 
                  ? "bg-indigo-650 text-white shadow-md shadow-indigo-500/10" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {f === "todos" ? "Todos" : f === "con_deuda" ? "Con Deuda" : "Sin Deuda"}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        data={clientesFiltrados}
        columns={columns}
        searchPlaceholder="Buscar clientes por nombre, teléfono..."
        searchKey={(c) => `${c.nombre_completo} ${c.telefono || ""} ${c.direccion || ""}`}
        pageSize={12}
        renderExpandedRow={renderExpandedRow}
        emptyMessage="No se encontraron clientes registrados con los filtros actuales."
        onExportCsv={handleExportCsv}
      />
    </div>
  );
};
