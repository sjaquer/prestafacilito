import React, { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { CarteraFilters, ESTADO_FILTROS, estadoFiltroClass, hasAdvancedFilters, hasAnyFilter } from "./carteraUtils";

interface CarteraFiltrosProps {
  filters: CarteraFilters;
  onChange: (patch: Partial<CarteraFilters>) => void;
  onClear: () => void;
  loanTypes: string[];
}

const labelClass = "text-[11px] font-bold text-slate-600 block mb-1";
const inputClass = "w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm outline-none focus:border-indigo-500";

/** Buscador, pestañas de estado (siempre visibles) y filtros adicionales plegables. */
export const CarteraFiltros: React.FC<CarteraFiltrosProps> = ({ filters, onChange, onClear, loanTypes }) => {
  const [masFiltros, setMasFiltros] = useState(false);
  const avanzados = hasAdvancedFilters(filters);

  return (
    <div className="sticky top-14 sm:top-[6.5rem] lg:top-16 z-20 -mx-4 px-4 py-2 bg-slate-50/95 backdrop-blur space-y-2 sm:mx-0 sm:px-0">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar cliente o tipo..."
            value={filters.searchTerm}
            onChange={(e) => onChange({ searchTerm: e.target.value })}
            className="w-full h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setMasFiltros((v) => !v)}
          aria-expanded={masFiltros}
          aria-label="Más filtros"
          className={`relative h-11 w-11 rounded-xl border flex items-center justify-center ${
            masFiltros || avanzados ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {avanzados && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-slate-50" />}
        </button>
        {hasAnyFilter(filters) && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Limpiar filtros"
            title="Limpiar filtros"
            className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-rose-600 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Filtrar por estado">
        {ESTADO_FILTROS.map((est) => {
          const activo = filters.estado === est.value;
          return (
            <button
              key={est.value}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => onChange({ estado: est.value })}
              className={`h-9 px-3 rounded-full text-xs font-bold whitespace-nowrap border transition ${estadoFiltroClass(est.value, activo)}`}
            >
              {est.label}
            </button>
          );
        })}
      </div>

      {masFiltros && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white border border-slate-200 rounded-2xl">
          <div>
            <label className={labelClass} htmlFor="flt-tipo">Tipo de préstamo</label>
            <select id="flt-tipo" value={filters.tipo} onChange={(e) => onChange({ tipo: e.target.value })} className={inputClass}>
              <option value="todos">Todos</option>
              {loanTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className={labelClass}>Prestado entre fechas</span>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" aria-label="Desde" value={filters.fechaMin} onChange={(e) => onChange({ fechaMin: e.target.value })} className={inputClass} />
              <input type="date" aria-label="Hasta" value={filters.fechaMax} onChange={(e) => onChange({ fechaMax: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <span className={labelClass}>Monto prestado (S/)</span>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" inputMode="decimal" placeholder="Mín." value={filters.montoMin} onChange={(e) => onChange({ montoMin: e.target.value })} className={inputClass} />
              <input type="number" inputMode="decimal" placeholder="Máx." value={filters.montoMax} onChange={(e) => onChange({ montoMax: e.target.value })} className={inputClass} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
