import React, { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Briefcase,
  Coins,
  FileText,
  Home,
  HandCoins,
  KeyRound,
  Landmark,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Settings,
  Upload,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { SistemaPanel } from "./SistemaPanel";
import { useEstadoSistema } from "./useEstadoSistema";
import { BottomSheet } from "../components/ui/BottomSheet";

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

/** Barra inferior del celular: dos a cada lado del botón "+". El resto va en "Menú". */
const NAV_MOVIL_IZQ = ["/", "/cartera"];
const NAV_MOVIL_DER = ["/clientes"];

/** Acciones del botón "+": cada una abre el formulario en la página que lo maneja. */
const ACCIONES_RAPIDAS = [
  { to: "/?accion=pago", label: "Registrar pago", detalle: "De un préstamo", icon: Wallet, color: "bg-emerald-600 text-white" },
  { to: "/?accion=prestamo", label: "Nuevo préstamo", detalle: "Prestar dinero", icon: HandCoins, color: "bg-slate-900 text-white" },
  { to: "/alquileres?accion=pago", label: "Cobrar alquiler", detalle: "Mensualidad", icon: KeyRound, color: "bg-teal-600 text-white" },
  { to: "/clientes?accion=nuevo", label: "Nuevo cliente", detalle: "Registrar datos", icon: UserPlus, color: "bg-indigo-600 text-white" },
  { to: "/alquileres?accion=nuevo", label: "Nuevo alquiler", detalle: "Contrato", icon: Home, color: "bg-white text-slate-800 border border-slate-200" },
  { to: "/vouchers?accion=subir", label: "Subir voucher", detalle: "A un pago", icon: Upload, color: "bg-white text-slate-800 border border-slate-200" },
];

/** Pantallas de detalle: en el celular muestran "atrás" en la barra superior. */
const DETALLES: { prefijo: string; titulo: string; padre: string }[] = [
  { prefijo: "/prestamos/", titulo: "Préstamo", padre: "/cartera" },
  { prefijo: "/clientes/", titulo: "Cliente", padre: "/clientes" },
  { prefijo: "/alquileres/", titulo: "Alquiler", padre: "/alquileres" },
];

const isActive = (item: NavItem, pathname: string) =>
  item.path === "/"
    ? pathname === "/"
    : [item.path, ...(item.match || [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));

const AlertaDot: React.FC<{ className?: string }> = ({ className = "top-1 right-1" }) => (
  <span className={`absolute ${className} w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white`} aria-label="Requiere atención" />
);

const TabMovil: React.FC<{ item: NavItem; activo: boolean }> = ({ item, activo }) => (
  <Link
    to={item.path}
    aria-current={activo ? "page" : undefined}
    className="flex flex-col items-center justify-center gap-1 h-16 decoration-none"
  >
    <span className={`h-8 w-14 rounded-full flex items-center justify-center transition-colors ${activo ? "bg-emerald-100 text-emerald-700" : "text-slate-500"}`}>
      <item.icon size={22} strokeWidth={activo ? 2.4 : 1.9} />
    </span>
    <span className={`text-[11px] leading-none font-bold ${activo ? "text-emerald-800" : "text-slate-500"}`}>{item.label}</span>
  </Link>
);

export const MainLayout: React.FC<MainLayoutProps> = ({ user, onLogout }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tipoNavegacion = useNavigationType();
  const sistema = useEstadoSistema();
  const [menuSistema, setMenuSistema] = useState(false);
  const [hoja, setHoja] = useState<null | "menu" | "acciones">(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Al navegar: cerrar menús y empezar arriba en la pantalla nueva (al volver atrás se respeta la posición)
  useEffect(() => {
    setMenuSistema(false);
    setHoja(null);
    if (tipoNavegacion !== "POP") window.scrollTo({ top: 0 });
  }, [pathname, tipoNavegacion]);

  // Cerrar el menú de escritorio al hacer clic fuera
  useEffect(() => {
    if (!menuSistema) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuSistema(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuSistema]);

  const detalle = DETALLES.find((d) => pathname.startsWith(d.prefijo));
  const volver = () => {
    // Si se entró directo por un enlace no hay historial en la app: ir a la lista
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(detalle?.padre || "/");
  };

  const navIzq = NAV.filter((n) => NAV_MOVIL_IZQ.includes(n.path));
  const navDer = NAV.filter((n) => NAV_MOVIL_DER.includes(n.path));
  const navMenu = NAV.filter((n) => !NAV_MOVIL_IZQ.includes(n.path) && !NAV_MOVIL_DER.includes(n.path));
  const menuActivo = navMenu.some((n) => isActive(n, pathname));
  const cerrarHoja = () => setHoja(null);

  return (
    <div id="admin-workspace" className="workspace-shell min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* ── CABECERA ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 pt-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center gap-3 sm:gap-4">
          {/* Celular en una pantalla de detalle: botón atrás */}
          {detalle && (
            <button
              type="button"
              onClick={volver}
              className="sm:hidden -ml-2 h-11 pl-1 pr-3 rounded-xl text-slate-800 hover:bg-slate-100 inline-flex items-center gap-1 text-sm font-bold"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5" />
              {detalle.titulo}
            </button>
          )}

          <Link
            to="/"
            className={`${detalle ? "hidden sm:flex" : "flex"} items-center gap-2 shrink-0 decoration-none`}
            aria-label="Ir al inicio"
          >
            <span className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
              <Coins className="text-white" size={16} />
            </span>
            <span className="font-black text-slate-900 text-base sm:text-sm tracking-tight">PrestaFácil</span>
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
            {/* Celular: ajustes del sistema (abre el menú) */}
            <button
              type="button"
              onClick={() => setHoja("menu")}
              className="sm:hidden relative h-11 w-11 -mr-2 rounded-xl text-slate-600 hover:bg-slate-100 flex items-center justify-center"
              aria-label="Sistema y ajustes"
            >
              <Settings className="w-5 h-5" />
              {sistema.alerta && <AlertaDot className="top-2 right-2" />}
            </button>

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
        <nav className="hidden sm:flex lg:hidden gap-1 scroll-x-limpio px-4 pb-2" aria-label="Secciones">
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

      {/* ── CONTENIDO ── (en el celular deja espacio para la barra inferior) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-8">
        <Outlet context={{ user }} />
      </main>

      {/* ── BARRA INFERIOR (celular) ── */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
        aria-label="Principal"
      >
        <div className="grid grid-cols-5 items-end">
          {navIzq.map((item) => (
            <TabMovil key={item.path} item={item} activo={isActive(item, pathname)} />
          ))}

          {/* Acción rápida: el botón más importante, en el centro y al alcance del pulgar */}
          <div className="flex justify-center h-16 items-center">
            <button
              type="button"
              onClick={() => setHoja("acciones")}
              className="-mt-6 h-14 w-14 rounded-2xl bg-emerald-600 active:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 ring-4 ring-white flex items-center justify-center"
              aria-label="Acciones rápidas: registrar pago, nuevo préstamo, nuevo cliente"
            >
              <Plus className="w-7 h-7" strokeWidth={2.5} />
            </button>
          </div>

          {navDer.map((item) => (
            <TabMovil key={item.path} item={item} activo={isActive(item, pathname)} />
          ))}

          <button
            type="button"
            onClick={() => setHoja("menu")}
            className="flex flex-col items-center justify-center gap-1 h-16 bg-transparent border-none"
            aria-label="Menú: más secciones y ajustes"
          >
            <span className={`relative h-8 w-14 rounded-full flex items-center justify-center ${menuActivo ? "bg-emerald-100 text-emerald-700" : "text-slate-500"}`}>
              <Menu size={22} strokeWidth={menuActivo ? 2.4 : 1.9} />
              {sistema.alerta && <AlertaDot className="top-0.5 right-3" />}
            </span>
            <span className={`text-[11px] leading-none font-bold ${menuActivo ? "text-emerald-800" : "text-slate-500"}`}>Menú</span>
          </button>
        </div>
      </nav>

      {/* ── HOJA: ACCIONES RÁPIDAS ── */}
      <BottomSheet open={hoja === "acciones"} onClose={cerrarHoja} title="¿Qué quieres hacer?">
        <div className="grid grid-cols-2 gap-2.5 pb-2">
          {ACCIONES_RAPIDAS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              onClick={cerrarHoja}
              className={`${a.color} rounded-2xl p-4 min-h-[92px] flex flex-col justify-between decoration-none active:scale-[0.98] transition`}
            >
              <a.icon className="w-6 h-6" />
              <span>
                <span className="block text-sm font-black leading-tight">{a.label}</span>
                <span className="block text-[11px] font-semibold opacity-75">{a.detalle}</span>
              </span>
            </Link>
          ))}
        </div>
      </BottomSheet>

      {/* ── HOJA: MENÚ ── */}
      <BottomSheet open={hoja === "menu"} onClose={cerrarHoja} title={user ? `Hola, ${user}` : "Menú"}>
        <div className="space-y-4 pb-2">
          <nav className="grid grid-cols-2 gap-2" aria-label="Más secciones">
            {navMenu.map((item) => {
              const activo = isActive(item, pathname);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`h-14 px-4 rounded-2xl border text-sm font-bold flex items-center gap-3 decoration-none ${
                    activo ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-100 text-slate-700"
                  }`}
                >
                  <item.icon size={20} className={activo ? "text-emerald-600" : "text-slate-500"} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div>
            <p className="px-1 pb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">Sistema</p>
            <SistemaPanel {...sistema} />
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full h-12 rounded-2xl bg-rose-50 text-rose-700 text-sm font-bold inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
