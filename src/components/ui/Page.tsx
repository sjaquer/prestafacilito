import React from "react";
import { RefreshCw, Search, X } from "lucide-react";

/**
 * Piezas comunes de las páginas, para que todas tengan la misma jerarquía visual:
 *   1. Encabezado (título + resumen en una línea + acción principal)
 *   2. Barra fija con buscador y filtros
 *   3. Resumen en cifras (KPI)
 *   4. Contenido (listas de tarjetas / paneles)
 */

// ── 1. Encabezado ───────────────────────────────────────

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  /** Botones a la derecha (acción principal primero visualmente a la derecha). */
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon, actions }) => (
  <div className="flex items-end justify-between gap-3">
    <div className="min-w-0">
      <h1 className="text-[1.6rem] sm:text-2xl font-black text-slate-900 tracking-tight leading-tight flex items-center gap-2">
        {icon && <span className="text-indigo-600 shrink-0 flex">{icon}</span>}
        <span className="truncate">{title}</span>
      </h1>
      {subtitle && <p className="text-xs text-slate-500 font-semibold mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/** Botón cuadrado de "Actualizar" con el ícono girando mientras carga. */
export const RefreshButton: React.FC<{ onClick: () => void; loading?: boolean }> = ({ onClick, loading }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className="h-11 w-11 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center shrink-0"
    aria-label="Actualizar"
    title="Actualizar"
  >
    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
  </button>
);

type Tono = "primario" | "oscuro" | "claro";

const TONOS: Record<Tono, string> = {
  primario: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",
  oscuro: "bg-slate-900 hover:bg-slate-800 text-white shadow-sm",
  claro: "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700",
};

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  tono?: Tono;
  /** En el celular muestra solo el ícono (el texto queda como etiqueta accesible). */
  compactoEnMovil?: boolean;
}

/** Botón de acción de página: 44 px de alto, ícono + texto. */
export const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  tono = "primario",
  compactoEnMovil,
  children,
  className = "",
  ...rest
}) => (
  <button
    type="button"
    {...rest}
    aria-label={compactoEnMovil && typeof children === "string" ? children : rest["aria-label"]}
    className={`h-11 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition disabled:opacity-50 ${
      compactoEnMovil ? "w-11 sm:w-auto sm:px-4" : "px-4"
    } ${TONOS[tono]} ${className}`}
  >
    {icon}
    <span className={compactoEnMovil ? "hidden sm:inline" : ""}>{children}</span>
  </button>
);

// ── 2. Barra fija: buscador + filtros ───────────────────

/** Se queda pegada bajo la cabecera al hacer scroll. */
export const StickyBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] sm:top-[6.5rem] lg:top-16 z-20 -mx-4 px-4 py-2 bg-slate-50/95 backdrop-blur space-y-2 sm:mx-0 sm:px-0">
    {children}
  </div>
);

export const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({
  value,
  onChange,
  placeholder,
}) => (
  <div className="relative">
    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    <input
      type="search"
      inputMode="search"
      enterKeyHint="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-12 sm:h-11 pl-10 pr-11 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 [&::-webkit-search-cancel-button]:hidden"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange("")}
        className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center"
        aria-label="Borrar búsqueda"
      >
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

export interface ChipOpcion<T extends string> {
  id: T;
  label: string;
  n?: number;
  /** Clase de color del punto (ej. "bg-rose-500"). */
  dot?: string;
}

/** Filtros tipo píldora en una fila desplazable (en el celular se deslizan con el dedo). */
export function Chips<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
}: {
  opciones: ChipOpcion<T>[];
  valor: T | null;
  onChange: (id: T) => void;
  etiqueta: string;
}) {
  return (
    <div className="flex gap-1.5 scroll-x-limpio -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => {
        const activo = valor === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={activo}
            onClick={() => onChange(o.id)}
            className={`h-10 sm:h-9 px-3.5 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 border transition shrink-0 ${
              activo ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {o.dot && <span className={`w-2 h-2 rounded-full ${o.dot}`} />}
            {o.label}
            {o.n !== undefined && <span className={activo ? "text-white/70" : "text-slate-400"}>{o.n}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── 3. Cifras ───────────────────────────────────────────

interface KpiProps {
  label: string;
  valor: React.ReactNode;
  detalle?: React.ReactNode;
  /** Color del valor (ej. "text-rose-600"). */
  tono?: string;
  onClick?: () => void;
}

/** Cifra destacada: etiqueta pequeña, valor grande, detalle de una línea. */
export const Kpi: React.FC<KpiProps> = ({ label, valor, detalle, tono = "text-slate-900", onClick }) => {
  const contenido = (
    <>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">{label}</p>
      <p className={`text-lg sm:text-xl font-black font-mono leading-tight truncate ${tono}`}>{valor}</p>
      {detalle && <p className="text-[11px] text-slate-500 font-semibold truncate">{detalle}</p>}
    </>
  );
  const cls = "bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm text-left min-w-0";
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:border-slate-300 active:scale-[0.98] transition`}>
      {contenido}
    </button>
  ) : (
    <div className={cls}>{contenido}</div>
  );
};

// ── 4. Contenido ────────────────────────────────────────

/** Tarjeta de sección con título (y algo opcional a la derecha). */
export const Panel: React.FC<{
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, aside, className = "", children }) => (
  <section className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 space-y-3 ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold text-slate-800 leading-tight">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{subtitle}</p>}
      </div>
      {aside && <div className="shrink-0 text-xs font-bold text-slate-500">{aside}</div>}
    </div>
    {children}
  </section>
);

export const EmptyState: React.FC<{ titulo: string; detalle?: string; accion?: React.ReactNode }> = ({
  titulo,
  detalle,
  accion,
}) => (
  <div className="text-center py-12 px-4 bg-white border border-dashed border-slate-200 rounded-2xl space-y-3">
    <div>
      <p className="text-sm font-bold text-slate-700">{titulo}</p>
      {detalle && <p className="text-xs text-slate-500 mt-1">{detalle}</p>}
    </div>
    {accion}
  </div>
);

export const ListSkeleton: React.FC<{ filas?: number; alto?: string }> = ({ filas = 3, alto = "h-24" }) => (
  <ul className="space-y-2" aria-busy aria-label="Cargando">
    {Array.from({ length: filas }, (_, i) => (
      <li key={i} className={`${alto} bg-white border border-slate-200 rounded-2xl animate-pulse`} />
    ))}
  </ul>
);

export const ErrorState: React.FC<{ mensaje: string; onReintentar: () => void }> = ({ mensaje, onReintentar }) => (
  <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
    <p className="text-sm font-bold text-rose-800">{mensaje}</p>
    <button
      type="button"
      onClick={onReintentar}
      className="h-11 px-4 bg-white border border-slate-200 text-sm font-bold text-slate-700 rounded-xl"
    >
      Reintentar
    </button>
  </div>
);
