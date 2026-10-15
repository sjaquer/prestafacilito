import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Briefcase,
  Coins,
  FileText,
  Home,
  Landmark,
  LayoutGrid,
  LogOut,
  MoreHorizontal,
  Settings,
  Users,
  X,
} from "lucide-react";
import { SistemaPanel } from "./SistemaPanel";
import { useEstadoSistema } from "./useEstadoSistema";

interface MainLayoutProps {
  user: string | null;
  onLogout: () => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  /** Rutas adicionales que marcan este ítem como activo. */
  match?: string[];
}

const NAV: NavItem[] = [
  { path: "/", label: "Inicio", icon: LayoutGrid },
  { path: "/cartera", label: "Cartera", icon: Briefcase, match: ["/prestamos"] },
  { path: "/alquileres", label: "Alquileres", icon: Home },
  { path: "/clientes", label: "Clientes", icon: Users },
  { path: "/cuentas", label: "Cuentas", icon: Landmark },
  { path: "/vouchers", label: "Vouchers", icon: FileText },
  { path: "/bi", label: "Reportes", icon: BarChart3 },
];

/** En el celular, la barra inferior muestra estos; el resto va en "Más". */
const NAV_MOVIL = ["/", "/cartera", "/cuentas", "/clientes"];

const isActive = (item: NavItem, pathname: string) =>
  item.path === "/"
    ? pathname === "/"
    : [item.path, ...(item.match || [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));

const AlertaDot: React.FC = () => <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />;

export const MainLayout: React.FC<MainLayoutProps> = ({ user, onLogout }) => {
  const { pathname } = useLocation();
  const sistema = useEstadoSistema();
  const [menuSistema, setMenuSistema] = useState(false);
  const [masAbierto, setMasAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menús al navegar
  useEffect(() => {
    setMenuSistema(false);
    setMasAbierto(false);
  }, [pathname]);

  // Cerrar el menú de escritorio al hacer clic fuera
  useEffect(() => {
    if (!menuSistema) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuSistema(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuSistema]);

  // Bloquear scroll de fondo con la hoja "Más" abierta
  useEffect(() => {
    if (!masAbierto) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [masAbierto]);

  const navMovil = NAV.filter((n) => NAV_MOVIL.includes(n.path));
  const navMas = NAV.filter((n) => !NAV_MOVIL.includes(n.path));
  const masActivo = navMas.some((n) => isActive(n, pathname));

  return (
    <div id="admin-workspace" className="workspace-shell min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0 decoration-none" aria-label="Ir al inicio">
            <span className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
              <Coins className="text-white" size={16} />
            </span>
            <span className="font-black text-slate-900 text-sm tracking-tight">PrestaFácil</span>
          </Link>

          {/* Navegación de escritorio */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center" aria-label="Principal">
            {NAV.map((item) => {
              const activo = isActive(item, pathname);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={activo ? "page" : undefined}
                  className={`h-9 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition decoration-none ${
                    activo ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <item.icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 ml-auto lg:ml-0 shrink-0">
            {/* Sistema (tablet/escritorio) */}
            <div className="relative hidden sm:block" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuSistema((v) => !v)}
                aria-expanded={menuSistema}
                aria-label="Estado del sistema y ajustes"
                className="relative h-10 w-10 rounded-xl text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              >
                <Settings className="w-[18px] h-[18px]" />
                {sistema.alerta && <AlertaDot />}
              </button>
              {menuSistema && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50">
                  <SistemaPanel {...sistema} />
                </div>
              )}
            </div>

            {user && (
              <span className="hidden md:flex items-center gap-2 pl-2 pr-1 text-xs font-bold text-slate-700">
                <span className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black uppercase flex items-center justify-center">
                  {user.charAt(0)}
                </span>
                {user}
              </span>
            )}
            <button
              type="button"
              onClick={onLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="hidden sm:flex h-10 w-10 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 items-center justify-center"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navegación de tablet (sm a lg) */}
        <nav className="hidden sm:flex lg:hidden gap-1 overflow-x-auto px-4 pb-2" aria-label="Secciones">
          {NAV.map((item) => {
            const activo = isActive(item, pathname);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={activo ? "page" : undefined}
                className={`h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap decoration-none ${
                  activo ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <item.icon size={13} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* ── CONTENIDO ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-28 sm:pb-8">
        <Outlet context={{ user }} />
      </main>

      {/* ── BARRA INFERIOR (celular) ── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-safe" aria-label="Principal">
        <div className="grid grid-cols-5">
          {navMovil.map((item) => {
            const activo = isActive(item, pathname);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={activo ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-0.5 min-h-[56px] decoration-none"
              >
                <span className={`px-4 py-1 rounded-full ${activo ? "bg-emerald-100 text-emerald-700" : "text-slate-500"}`}>
                  <item.icon size={20} strokeWidth={activo ? 2.5 : 2} />
                </span>
                <span className={`text-[10px] font-bold ${activo ? "text-emerald-800" : "text-slate-500"}`}>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMasAbierto(true)}
            className="flex flex-col items-center justify-center gap-0.5 min-h-[56px] bg-transparent border-none"
            aria-label="Más opciones"
          >
            <span className={`relative px-4 py-1 rounded-full ${masActivo ? "bg-emerald-100 text-emerald-700" : "text-slate-500"}`}>
              <MoreHorizontal size={20} />
              {sistema.alerta && <AlertaDot />}
            </span>
            <span className={`text-[10px] font-bold ${masActivo ? "text-emerald-800" : "text-slate-500"}`}>Más</span>
          </button>
        </div>
      </nav>

      {/* ── HOJA "MÁS" (celular) ── */}
      {masAbierto && (
        <div className="sm:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Más opciones">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMasAbierto(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto pb-safe">
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 pt-4 pb-2">
              <span className="text-sm font-black text-slate-900">{user ? `Hola, ${user}` : "Más opciones"}</span>
              <button
                type="button"
                onClick={() => setMasAbierto(false)}
                className="h-10 w-10 rounded-xl hover:bg-slate-100 flex items-center justify-center"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 pb-5 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {navMas.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border text-xs font-bold decoration-none ${
                      isActive(item, pathname) ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-100 text-slate-700"
                    }`}
                  >
                    <item.icon size={20} />
                    {item.label}
                  </Link>
                ))}
              </div>
              <SistemaPanel {...sistema} />
              <button
                type="button"
                onClick={onLogout}
                className="w-full h-12 rounded-2xl bg-rose-50 text-rose-700 text-sm font-bold inline-flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
