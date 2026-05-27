import React, { useState, useMemo } from "react";
import { ArrowUpDown, ChevronDown, ChevronUp, Search, FileDown } from "lucide-react";
import { Button } from "./Button";

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  searchKey?: keyof T | ((item: T) => string);
  pageSize?: number;
  renderExpandedRow?: (item: T) => React.ReactNode;
  emptyMessage?: string;
  onExportCsv?: () => void;
  showSearch?: boolean;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  searchPlaceholder = "Buscar...",
  searchKey,
  pageSize = 10,
  renderExpandedRow,
  emptyMessage = "No se encontraron registros.",
  onExportCsv,
  showSearch = true,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Record<string | number, boolean>>({});

  // 1. Filtrado
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    
    const query = searchQuery.toLowerCase().trim();
    return data.filter((item) => {
      if (typeof searchKey === "function") {
        return searchKey(item).toLowerCase().includes(query);
      }
      if (searchKey) {
        return String(item[searchKey] || "").toLowerCase().includes(query);
      }
      // Búsqueda genérica por todos los campos de texto
      return Object.values(item).some(
        (val) => typeof val === "string" && val.toLowerCase().includes(query)
      );
    });
  }, [data, searchQuery, searchKey]);

  // 2. Ordenamiento
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];

      if (aVal === undefined || bVal === undefined) return 0;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      return sortOrder === "asc" 
        ? aStr.localeCompare(bStr, "es") 
        : bStr.localeCompare(aStr, "es");
    });
  }, [filteredData, sortKey, sortOrder]);

  // 3. Paginación
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  
  // Reiniciar página si el filtro cambia
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // 4. Expandir fila
  const toggleRow = (id: string | number) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controles de Búsqueda y Acciones */}
      {showSearch && (
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 shrink-0" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="glass-input w-full pl-10.5 pr-4 rounded-2xl border-white/6 focus:border-indigo-500/80 font-medium"
            />
          </div>

          {onExportCsv && (
            <Button 
              onClick={onExportCsv} 
              variant="secondary" 
              size="sm"
              icon={<FileDown size={14} />}
              className="shrink-0"
            >
              Exportar CSV
            </Button>
          )}
        </div>
      )}

      {/* Contenedor de la Tabla */}
      <div className="w-full bg-[#0c1020]/45 border border-white/[0.055] rounded-3xl overflow-hidden shadow-xl table-scroll-x">
        <table className="w-full data-table border-collapse select-none">
          <thead>
            <tr className="bg-white/[0.015]">
              {renderExpandedRow && <th className="w-10"></th>}
              {columns.map((col, idx) => (
                <th 
                  key={idx}
                  onClick={() => col.sortable && col.accessorKey && handleSort(String(col.accessorKey))}
                  className={`${col.sortable ? "cursor-pointer hover:bg-white/5 hover:text-slate-300" : ""} transition-colors select-none text-left`}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>{col.header}</span>
                    {col.sortable && col.accessorKey && (
                      <ArrowUpDown size={11} className="text-slate-500" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td 
                  colSpan={columns.length + (renderExpandedRow ? 1 : 0)} 
                  className="text-center py-12 text-slate-500 text-xs md:text-sm font-semibold"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, idx) => {
                const isExpanded = !!expandedRows[item.id];
                return (
                  <React.Fragment key={item.id}>
                    <tr 
                      className={`transition-colors duration-150 ${
                        isExpanded ? "bg-white/[0.01]" : ""
                      }`}
                    >
                      {renderExpandedRow && (
                        <td className="text-center">
                          <button
                            onClick={() => toggleRow(item.id)}
                            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      )}
                      {columns.map((col, cIdx) => {
                        const cellContent = col.cell 
                          ? col.cell(item) 
                          : col.accessorKey 
                            ? String((item as any)[col.accessorKey] ?? "") 
                            : "";
                        return (
                          <td key={cIdx} className="text-xs md:text-sm font-semibold text-slate-300">
                            {cellContent}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Fila expandible */}
                    {renderExpandedRow && isExpanded && (
                      <tr>
                        <td 
                          colSpan={columns.length + 1} 
                          className="bg-black/15 p-5 md:p-6 border-b border-white/[0.03]"
                        >
                          <div className="animate-fadeIn">
                            {renderExpandedRow(item)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Controles de Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center px-2 select-none">
          <span className="text-[11px] md:text-xs font-bold text-slate-500">
            Mostrando {Math.min(sortedData.length, (currentPage - 1) * pageSize + 1)}-
            {Math.min(sortedData.length, currentPage * pageSize)} de {sortedData.length} registros
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
            >
              Primero
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => prev - 1)}
            >
              Anterior
            </Button>
            <span className="px-3 py-1 bg-white/5 border border-white/8 rounded-xl text-xs md:text-sm font-bold text-slate-300 min-w-[34px] text-center">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Siguiente
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              Último
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
