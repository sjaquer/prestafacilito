import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Bell, ArrowUpRight, Search, FileDown, User, Info, Calendar } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { DataTable, ColumnDef } from "../ui/DataTable";
import { formatCurrency, formatDateWithDay } from "../../lib/formatters";
import { Cliente } from "../../types";

interface DebtPortfolioTableProps {
  prestamos: any[];
  clientes: Cliente[];
  nowTick: Date;
  onEditLoanClick: (prestamo: any, event: React.MouseEvent) => void;
}

export const DebtPortfolioTable: React.FC<DebtPortfolioTableProps> = ({
  prestamos,
  clientes,
  nowTick,
  onEditLoanClick,
}) => {
  const [filterEstado, setFilterEstado] = useState<"todos" | "activo" | "pagado">("todos");

  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date(nowTick);
  today.setHours(0, 0, 0, 0);

  const getWhatsAppLink = (loan: any) => {
    const cliente = clientes.find(c => c.id === loan.cliente_id);
    if (!cliente || !cliente.telefono) return null;
    const phone = cliente.telefono.replace(/[^\d+]/g, "").trim();
    if (!phone) return null;

    const capital = parseFloat(loan.monto_capital) || 0;
    const interest = parseFloat(loan.tasa_interes_porcentaje) || 0;
    const totalExigible = capital * (1 + interest / 100);

    const formattedAmount = formatCurrency(totalExigible);
    const fechaFormato = formatDateWithDay(loan.fecha_vencimiento);
    const text = `¡Hola, ${loan.cliente_nombre}! Te saludamos de la administración. 🇵🇪 Te recordamos amablemente tu cuota/saldo pendiente de ${formattedAmount} con vencimiento el ${fechaFormato}. Agradecemos tu puntualidad y apoyo. ¡Que tengas un gran día!`;
    
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const getRecordatorioLink = (loan: any) => {
    const cliente = clientes.find(c => c.id === loan.cliente_id);
    if (!cliente || !cliente.telefono) return null;
    const phone = cliente.telefono.replace(/\D/g, '').trim();
    if (!phone) return null;

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
    const primerNombre = loan.cliente_nombre.trim().split(/\s+/)[0].toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tratamiento = NOMBRES_FEMENINOS.has(primerNombre) ? 'SRA.' : 'SR.';

    const capital = parseFloat(loan.monto_capital) || 0;
    const interest = parseFloat(loan.tasa_interes_porcentaje) || 0;
    const totalExigible = capital * (1 + interest / 100);
    const cuota = formatCurrency(totalExigible);
    const fecha = formatDateWithDay(loan.fecha_vencimiento);
    const nombreMayus = loan.cliente_nombre.toUpperCase();

    const mensaje =
      `¡Hola, ${tratamiento} ${nombreMayus}! Te saluda Sebastián.\n` +
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

  // Filtrado por estado rápido
  const prestamosFiltrados = prestamos.filter((p) => {
    if (filterEstado === "todos") return true;
    return p.estado === filterEstado;
  });

  // Columnas para DataTable
  const columns: ColumnDef<any>[] = [
    {
      header: "Prestatario",
      accessorKey: "cliente_nombre",
      sortable: true,
      cell: (loan) => {
        const initials = loan.cliente_nombre.split(" ").map((n: string) => n[0]).join("").slice(0, 2);
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center font-bold text-xs text-indigo-400 select-none">
              {initials}
            </div>
            <span className="font-bold text-white block">{loan.cliente_nombre}</span>
          </div>
        );
      }
    },
    {
      header: "Monto Deuda",
      accessorKey: "monto_capital",
      sortable: true,
      cell: (loan) => (
        <span className="font-extrabold text-white font-mono text-sm">
          {formatCurrency(loan.monto_capital)}
        </span>
      )
    },
    {
      header: "Interés (%)",
      accessorKey: "tasa_interes_porcentaje",
      sortable: true,
      cell: (loan) => (
        <span className="font-extrabold text-indigo-300 font-mono text-xs md:text-sm">
          {loan.tasa_interes_porcentaje}%
        </span>
      )
    },
    {
      header: "F. Emisión",
      accessorKey: "fecha_emision",
      sortable: true,
      cell: (loan) => (
        <span className="text-slate-400 font-mono text-xs">
          {loan.fecha_emision}
        </span>
      )
    },
    {
      header: "Categoría",
      accessorKey: "tipo_prestamo",
      sortable: true,
      cell: (loan) => (
        <Badge variant="neutral">{loan.tipo_prestamo}</Badge>
      )
    },
    {
      header: "Estado",
      accessorKey: "estado",
      sortable: true,
      cell: (loan) => {
        const isActivo = loan.estado === "activo";
        return (
          <Badge variant={isActivo ? "success" : "neutral"}>
            {isActivo ? "Activo" : "Pagado"}
          </Badge>
        );
      }
    },
    {
      header: "Acciones",
      cell: (loan) => {
        const waLink = getWhatsAppLink(loan);
        const recLink = getRecordatorioLink(loan);
        return (
          <div className="flex items-center justify-end gap-2.5">
            {loan.estado === "activo" && waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-500 hover:text-emerald-400 p-1.5 hover:bg-emerald-500/10 rounded-xl transition cursor-pointer"
                title="Cobrar vía WhatsApp"
              >
                <MessageSquare size={15} />
              </a>
            )}
            {loan.estado === "activo" && recLink && (
              <a
                href={recLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-500 hover:text-amber-400 p-1.5 hover:bg-amber-500/10 rounded-xl transition cursor-pointer"
                title="Enviar recordatorio de cuota"
              >
                <Bell size={15} />
              </a>
            )}
            
            <button
              onClick={(e) => onEditLoanClick(loan, e)}
              className="text-slate-400 hover:text-indigo-400 p-1.5 hover:bg-white/5 rounded-xl transition cursor-pointer border-none"
              title="Reprogramar Fechas"
            >
              <Calendar size={15} />
            </button>

            <Link
              to={`/prestamos/${loan.id}`}
              className="text-xs bg-white/5 hover:bg-white/10 border border-white/8 text-white py-1.5 px-3 rounded-lg font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-sm decoration-none"
            >
              <span>Detalles</span>
              <ArrowUpRight size={11} />
            </Link>
          </div>
        );
      }
    }
  ];

  // Renderizado de fila expandible (Mini-detalle amigable)
  const renderExpandedRow = (loan: any) => {
    const days = getRemainingDays(loan.fecha_vencimiento);
    const dateVenc = new Date(`${loan.fecha_vencimiento}T00:00:00`);
    
    return (
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs select-none">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-indigo-400 shrink-0" />
          <div>
            <span className="text-slate-400 font-bold block">Fecha Vencimiento Final:</span>
            <span className="font-extrabold text-white">{loan.fecha_vencimiento ? formatDateWithDay(loan.fecha_vencimiento) : "No configurado"}</span>
          </div>
        </div>

        {loan.estado === "activo" && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold">Estado del plazo:</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider text-[9px] border ${
              days < 0 
                ? "bg-rose-500/10 border-rose-500/15 text-rose-400" 
                : days === 0 
                  ? "bg-amber-500/10 border-amber-500/15 text-amber-400"
                  : "bg-emerald-500/10 border-emerald-500/15 text-emerald-450"
            }`}>
              {days < 0 ? `Vencido hace ${Math.abs(days)} días` : days === 0 ? "Vence hoy" : `Quedan ${days} días`}
            </span>
          </div>
        )}
      </div>
    );
  };

  const handleExportCsv = () => {
    // Generar archivo CSV sencillo
    const csvHeaders = ["Prestatario", "Monto Capital", "Tasa Interes %", "Fecha Emision", "Fecha Vencimiento", "Tipo", "Estado"];
    const csvRows = prestamos.map(p => [
      p.cliente_nombre,
      p.monto_capital,
      p.tasa_interes_porcentaje,
      p.fecha_emision,
      p.fecha_vencimiento || "",
      p.tipo_prestamo,
      p.estado
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [csvHeaders.join(","), ...csvRows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `prestafacilito_cartera_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card variant="simple" className="flex flex-col">
      <div className="p-1 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="font-black text-white text-base tracking-tight leading-none">Cartera de Deudas</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">Monitorear, reprogramar, exportar y cobrar deudas en vivo</p>
        </div>

        {/* Filtros de estado rápido */}
        <div className="flex items-center gap-1 bg-white/[0.03] p-0.5 rounded-xl border border-white/5 select-none">
          {(["todos", "activo", "pagado"] as const).map((est) => (
            <button
              key={est}
              onClick={() => setFilterEstado(est)}
              className={`px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer border-none transition-all duration-150 ${
                filterEstado === est
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/10"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {est === "todos" ? "Todos" : est === "activo" ? "Activos" : "Pagados"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <DataTable
          data={prestamosFiltrados}
          columns={columns}
          searchPlaceholder="Buscar por prestatario, categoría..."
          searchKey={(loan) => `${loan.cliente_nombre} ${loan.tipo_prestamo}`}
          pageSize={10}
          renderExpandedRow={renderExpandedRow}
          emptyMessage="No se encontraron créditos registrados con los filtros actuales."
          onExportCsv={handleExportCsv}
        />
      </div>
    </Card>
  );
};
