import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Sparkles, 
  Coins, 
  LogOut,
  Briefcase
} from "lucide-react";
import { FontSizeControl } from "../components/common/FontSizeControl";

interface MainLayoutProps {
  user: string | null;
  onLogout: () => void;
  children?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      path: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
      activePaths: ["/"],
    },
    {
      path: "/cartera",
      label: "Cartera",
      icon: Briefcase,
      activePaths: ["/cartera", "/prestamos"],
    },
    {
      path: "/clientes",
      label: "Clientes",
      icon: Users,
      activePaths: ["/clientes"],
    },
    {
      path: "/reportes",
      label: "Análisis IA",
      icon: Sparkles,
      activePaths: ["/reportes"],
    },
  ];

  const isPathActive = (item: typeof navItems[0]) => {
    if (item.path === "/") {
      return location.pathname === "/";
    }
    if (item.path === "/cartera") {
      return location.pathname.startsWith("/cartera") || location.pathname.startsWith("/prestamos");
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <div
      id="admin-workspace"
      className="workspace-shell min-h-screen flex flex-col bg-transparent text-[#f8fafc] pb-20 sm:pb-0"
    >
      {/* ── HEADER ── */}
      <header
        id="workspace-header"
        className="sticky top-0 z-40 bg-[#060913]/78 backdrop-blur-2xl border-b border-white/[0.06] shadow-[0_12px_40px_-24px_rgba(0,0,0,0.8)]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center gap-4">
            {/* Brand */}
            <div 
              id="nav-brand" 
              onClick={() => navigate("/")} 
              className="flex items-center gap-2.5 shrink-0 cursor-pointer select-none"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <Coins className="text-white" size={16} />
              </div>
              <div className="hidden sm:block leading-none">
                <span className="font-black text-white text-sm tracking-tight block">
                  PrestaFacilito
                </span>
                <span className="text-[10px] text-emerald-400/70 font-semibold tracking-wider">
                  Panel Administrativo 🇵🇪
                </span>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav
              id="nav-links"
              className="hidden sm:flex items-center gap-0.5 bg-white/[0.035] p-1 rounded-2xl border border-white/[0.06] flex-1 max-w-sm mx-auto select-none"
            >
              {navItems.map((item) => {
                const isActive = isPathActive(item);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all duration-150 cursor-pointer flex-1 justify-center decoration-none ${
                      isActive
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 border border-emerald-400/20"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                    }`}
                  >
                    <item.icon size={13} strokeWidth={isActive ? 2.5 : 2} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Accesibilidad + User + Logout */}
            <div
              id="user-controls"
              className="flex items-center gap-3 shrink-0"
            >
              {/* Aa Zoom Control */}
              <FontSizeControl />

              <div className="w-px h-5 bg-white/[0.08] hidden sm:block" />

              {user && (
                <div className="hidden sm:flex items-center gap-2 select-none">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                    <span className="text-[10px] font-black text-emerald-300 uppercase">
                      {user.charAt(0)}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">
                    {user}
                  </span>
                </div>
              )}

              <div className="w-px h-5 bg-white/[0.08] hidden sm:block" />
              
              <button
                id="btn-logout"
                onClick={onLogout}
                title="Cerrar sesión segura"
                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-150 cursor-pointer border-none"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main
        id="workspace-content"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 relative z-[1]"
      >
        <React.Suspense 
          fallback={
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
              <span className="animate-spin text-emerald-450 shrink-0">
                <Coins size={28} />
              </span>
              <span className="text-xs font-bold text-slate-500 tracking-[0.15em] uppercase">
                Cargando vista...
              </span>
            </div>
          }
        >
          {/* Aquí se renderizan los hijos (las páginas de las rutas) */}
          <Outlet />
        </React.Suspense>
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <div className="sm:hidden fixed bottom-3 left-3 right-3 z-40 select-none">
        <div className="bg-[#0c1020]/92 backdrop-blur-xl border border-white/[0.08] rounded-2xl px-2 py-1.5 shadow-2xl shadow-black/60 flex justify-around items-center">
          {navItems.map((item) => {
            const isActive = isPathActive(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-all duration-200 cursor-pointer flex-1 decoration-none ${
                  isActive
                    ? "text-emerald-300"
                    : "text-slate-600 hover:text-slate-400"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg transition-all ${isActive ? "bg-emerald-500/15" : ""}`}
                >
                  <item.icon
                    size={18}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                </div>
                <span
                  className={`text-[9px] font-bold tracking-wide ${isActive ? "text-emerald-450" : "text-slate-600"}`}
                >
                  {item.label === "Análisis IA" ? "IA" : item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer
        id="workspace-footer"
        className="bg-[#05070f] border-t border-white/[0.05] py-4 hidden sm:block select-none relative z-[1]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <p className="text-[11px] text-slate-600 font-medium">
            © 2026 PrestaFacilito · Panel de Administración de Cartera
          </p>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
            <span>Base de datos activa</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Necesitamos importar Outlet de react-router-dom
import { Outlet } from "react-router-dom";
