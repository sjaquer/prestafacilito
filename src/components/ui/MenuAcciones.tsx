import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useEsMovil } from "../../hooks/useEsMovil";
import { BottomSheet } from "./BottomSheet";

export interface AccionMenu {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  /** Si se indica, la acción es un enlace (se abre en otra pestaña). */
  href?: string;
  peligro?: boolean;
  disabled?: boolean;
}

interface MenuAccionesProps {
  /** Título de la hoja en el celular y etiqueta accesible del botón. */
  titulo: string;
  acciones: AccionMenu[];
}

/**
 * Botón "⋯" con acciones secundarias. En el celular abre una hoja con filas grandes;
 * en escritorio, un menú desplegable junto al botón.
 */
export const MenuAcciones: React.FC<MenuAccionesProps> = ({ titulo, acciones }) => {
  const esMovil = useEsMovil();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto || esMovil) return;
    const fuera = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAbierto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto, esMovil]);

  const ejecutar = (a: AccionMenu) => {
    setAbierto(false);
    a.onClick?.();
  };

  const fila = (a: AccionMenu, grande: boolean) => {
    const cls = `w-full flex items-center gap-3 text-left font-bold rounded-xl transition disabled:opacity-40 decoration-none ${
      grande ? "h-14 px-4 text-[15px]" : "h-10 px-3 text-xs"
    } ${a.peligro ? "text-rose-600 hover:bg-rose-50" : "text-slate-700 hover:bg-slate-100"}`;
    const contenido = (
      <>
        <span className={`shrink-0 ${a.peligro ? "text-rose-500" : "text-slate-400"}`}>{a.icon}</span>
        {a.label}
      </>
    );
    return a.href ? (
      <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer" onClick={() => setAbierto(false)} className={cls}>
        {contenido}
      </a>
    ) : (
      <button key={a.label} type="button" disabled={a.disabled} onClick={() => ejecutar(a)} className={cls}>
        {contenido}
      </button>
    );
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`Más acciones: ${titulo}`}
        className="h-10 w-10 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 flex items-center justify-center"
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {esMovil ? (
        <BottomSheet open={abierto} onClose={() => setAbierto(false)} title={titulo}>
          <div className="space-y-1 pb-2" role="menu">
            {acciones.map((a) => fila(a, true))}
          </div>
        </BottomSheet>
      ) : (
        abierto && (
          <div role="menu" className="absolute right-0 top-11 z-30 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5">
            {acciones.map((a) => fila(a, false))}
          </div>
        )
      )}
    </div>
  );
};
