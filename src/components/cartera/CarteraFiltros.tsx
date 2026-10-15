import React, { useState } from "react";
import { Search, Filter, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import {
  CarteraFilters,
  ESTADO_FILTROS,
  estadoFiltroClass,
  hasAdvancedFilters,
  hasAnyFilter,
} from "./carteraUtils";

interface CarteraFiltrosProps {
  filters: CarteraFilters;
  onChange: (patch: Partial<CarteraFilters>) => void;
  onClear: () => void;
  loanTypes: string[];
}

const labelClass = "text-[9.5px] font-black text-slate-500 uppercase tracking-widest block pl-0.5";
const inputClass = "glass-input px-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold";

/** Campos de filtros avanzados compartidos entre el panel de escritorio y el modal móvil. */
const AdvancedFields: React.FC<Omit<CarteraFiltrosProps, "onClear"> & { compact?: boolean }> = ({
  filters,
  onChange,
  loanTypes,
  compact,
}) => {
  const h = compact ? "h-10" : "h-11";
  return (
    <>
      <div className="space-y-1.5">
        <label className={labelClass}>Categoría de Crédito</label>
        <select
          value={filters.tipo}
          onChange={(e) => onChange({ tipo: e.target.value })}
          className={`${inputClass} ${h} w-full cursor-pointer`}
        >
          <option value="todos">Todas las categorías</option>
          {loanTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className={`space-y-1.5 ${compact ? "col-span-1 sm:col-span-2" : ""}`}>
        <label className={labelClass}>Rango de Emisión (Fecha)</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            aria-label="Fecha de emisión desde"
            value={filters.fechaMin}
            onChange={(e) => onChange({ fechaMin: e.target.value })}
            className={`${inputClass} ${h}`}
          />
          <input
            type="date"
            aria-label="Fecha de emisión hasta"
            value={filters.fechaMax}
            onChange={(e) => onChange({ fechaMax: e.target.value })}
            className={`${inputClass} ${h}`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass}>Monto Capital (S/.)</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Mínimo"
            value={filters.montoMin}
            onChange={(e) => onChange({ montoMin: e.target.value })}
            className={`${inputClass} ${h}`}
          />
          <input
            type="number"
            placeholder="Máximo"
            value={filters.montoMax}
            onChange={(e) => onChange({ montoMax: e.target.value })}
            className={`${inputClass} ${h}`}
          />
        </div>
      </div>
    </>
  );
};

const EstadoSegmented: React.FC<{ value: string; onSelect: (v: string) => void; grid?: boolean }> = ({
  value,
  onSelect,
  grid,
}) => (
  <div
    className={
      grid
        ? "grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80"
        : "flex flex-wrap items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80"
    }
  >
    {ESTADO_FILTROS.map((est) => (
      <button
        type="button"
        key={est.value}
        onClick={() => onSelect(est.value)}
        className={`px-3 ${grid ? "py-2" : "py-1.5"} rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer border-none transition-all duration-150 ${estadoFiltroClass(
          est.value,
          value === est.value
        )}`}
      >
        {est.label}
      </button>
    ))}
  </div>
);

export const CarteraFiltros: React.FC<CarteraFiltrosProps> = ({ filters, onChange, onClear, loanTypes }) => {
  const [showPanel, setShowPanel] = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const advanced = hasAdvancedFilters(filters);
  const any = hasAnyFilter(filters);

  return (
    <>
      {/* BARRA DE HERRAMIENTAS - ESCRITORIO */}
      <div className="hidden md:flex p-1 border-b border-slate-200/80 flex-row items-center justify-between gap-4 pb-4 select-none">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por prestatario, categoría..."
            value={filters.searchTerm}
            onChange={(e) => onChange({ searchTerm: e.target.value })}
            className="glass-input pl-10 pr-4 h-11 w-full bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPanel((v) => !v)}
            className={`flex items-center gap-1.5 h-11 px-4 border rounded-xl font-black text-[10px] uppercase tracking-widest transition cursor-pointer ${
              showPanel
                ? "bg-indigo-650 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Filter size={13} />
            <span>Filtros avanzados</span>
            {advanced && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />}
          </button>

          {any && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 h-11 px-3 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition cursor-pointer border-none"
            >
              <X size={13} />
              <span>Limpiar</span>
            </button>
          )}

          <EstadoSegmented value={filters.estado} onSelect={(estado) => onChange({ estado })} />
        </div>
      </div>

      {/* BARRA DE HERRAMIENTAS - MÓVIL */}
      <div className="md:hidden flex items-center gap-2 w-full pb-3 border-b border-slate-100 select-none">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Buscar prestatario o categoría..."
            value={filters.searchTerm}
            onChange={(e) => onChange({ searchTerm: e.target.value })}
            className="glass-input pl-9 pr-3 h-10 w-full bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:border-indigo-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowMobile(true)}
          aria-label="Abrir filtros"
          className={`flex items-center justify-center h-10 w-10 border rounded-xl relative cursor-pointer ${
            advanced ? "bg-indigo-650 border-indigo-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-600"
          }`}
        >
          <Filter size={15} />
          {advanced && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 border border-white text-[8px] font-black flex items-center justify-center text-white">
              !
            </span>
          )}
        </button>
        {any && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center justify-center h-10 w-10 bg-white border border-slate-200 text-rose-600 rounded-xl cursor-pointer"
            title="Limpiar filtros"
            aria-label="Limpiar filtros"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* PANEL DE FILTROS AVANZADOS - ESCRITORIO */}
      {showPanel && (
        <div className="hidden md:grid p-4 bg-slate-50/50 border-b border-slate-200/80 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn select-none">
          <AdvancedFields filters={filters} onChange={onChange} loanTypes={loanTypes} compact />
        </div>
      )}

      {/* MODAL MÓVIL DE FILTROS */}
      {showMobile && (
        <Modal isOpen={showMobile} onClose={() => setShowMobile(false)} title="Filtros y Estados">
          <div className="space-y-4 font-sans text-xs">
            <div className="space-y-1.5">
              <label className={labelClass}>Estado rápido</label>
              <EstadoSegmented value={filters.estado} onSelect={(estado) => onChange({ estado })} grid />
            </div>

            <AdvancedFields filters={filters} onChange={onChange} loanTypes={loanTypes} />

            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  onClear();
                  setShowMobile(false);
                }}
                className="h-11 text-rose-600 border border-slate-200 bg-white font-bold text-xs"
              >
                Limpiar todo
              </Button>
              <Button variant="primary" onClick={() => setShowMobile(false)} className="h-11 font-bold text-xs px-5">
                Aplicar Filtros
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
