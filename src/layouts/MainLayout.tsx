import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Sparkles, 
  Coins, 
  LogOut,
  Briefcase,
  Terminal,
  Cloud,
  CloudOff,
  FileText
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

  const [driveConfigured, setDriveConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const checkDriveStatus = async () => {
      try {
        const res = await fetch("/api/drive/status");
        if (res.ok && active) {
          const data = await res.json();
          setDriveConfigured(data.configured);
        } else if (active) {
          setDriveConfigured(false);
        }
      } catch {
        if (active) setDriveConfigured(false);
      }
    };
    checkDriveStatus();
    
    // Interval check every 30 seconds
    const interval = setInterval(checkDriveStatus, 30000);
    
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

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
    {
      path: "/bitacora",
      label: "Bitácora",
      icon: Terminal,
      activePaths: ["/bitacora"],
    },
    {
      path: "/vouchers",
      label: "Vouchers",
      icon: FileText,
      activePaths: ["/vouchers"],
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
      className="workspace-shell min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-24 sm:pb-0"
    >
      {/* ── HEADER ── */}
      <header
        id="workspace-header"
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center gap-4">
            {/* Brand */}
            <div 
              id="nav-brand" 
              onClick={() => navigate("/")} 
              className="flex items-center gap-2.5 shrink-0 cursor-pointer select-none"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-md shrink-0">
                <Coins className="text-white" size={16} />
              </div>
              <div className="hidden sm:block leading-none">
                <span className="font-black text-slate-900 text-sm tracking-tight block">
                  PrestaFacilito
                </span>
                <span className="text-[10px] text-emerald-600 font-bold tracking-wider">
                  Panel Administrativo 🇵🇪
                </span>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav
              id="nav-links"
              className="hidden lg:flex items-center gap-0.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/60 flex-1 max-w-md xl:max-w-lg mx-auto select-none"
            >
              {navItems.map((item) => {
                const isActive = isPathActive(item);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all duration-150 cursor-pointer flex-1 min-w-0 justify-center whitespace-nowrap decoration-none ${
                      isActive
                        ? "bg-white text-emerald-700 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-205/50"
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

              <div className="w-px h-5 bg-slate-200 hidden sm:block" />

              {/* Google Drive Status Indicator & Reconnect Link */}
              <div 
                id="drive-status-indicator"
                className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl select-none"
              >
                {driveConfigured === null ? (
                  <Cloud className="text-slate-450 animate-pulse" size={14} />
                ) : driveConfigured ? (
                  <Cloud className="text-emerald-600" size={14} />
                ) : (
                  <CloudOff className="text-amber-500 animate-pulse" size={14} />
                )}

                <span className={`relative flex h-2 w-2`}>
                  {driveConfigured === null ? (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-450 animate-pulse" />
                  ) : driveConfigured ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-70" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </>
                  ) : (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-450 opacity-70" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </>
                  )}
                </span>
                
                <span className="text-[10px] font-bold text-slate-600 hidden md:inline">
                  {driveConfigured === null ? "Drive..." : driveConfigured ? "Drive Activo" : "Drive Error"}
                </span>

                <button
                  onClick={() => {
                    if (window.confirm("¿Deseas volver a iniciar sesión con Google para conectar Drive?")) {
                      window.location.href = "/api/auth/google/login";
                    }
                  }}
                  title="Conectar o volver a vincular Google Drive"
                  className="p-0.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition cursor-pointer border-none bg-transparent flex items-center justify-center ml-0.5"
                >
                  <span className="text-[9px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-wider px-1">
                    {driveConfigured ? "Reconectar" : "Conectar"}
                  </span>
                </button>
              </div>

              <div className="w-px h-5 bg-slate-200 hidden sm:block" />

              {user && (
                <div className="hidden lg:flex items-center gap-2 select-none">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <span className="text-[10px] font-black text-emerald-700 uppercase">
                      {user.charAt(0)}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700">
                    {user}
                  </span>
                </div>
              )}

              <div className="w-px h-5 bg-slate-200 hidden sm:block" />
              
              <button
                id="btn-logout"
                onClick={onLogout}
                title="Cerrar sesión segura"
                className="hidden sm:inline-flex p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all duration-150 cursor-pointer border-none bg-transparent"
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
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 relative"
      >
        <React.Suspense 
          fallback={
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
              <span className="animate-spin text-emerald-600 shrink-0">
                <Coins size={28} />
              </span>
              <span className="text-xs font-bold text-slate-500 tracking-[0.15em] uppercase">
                Cargando vista...
              </span>
            </div>
          }
        >
          <Outlet />
        </React.Suspense>
      </main>

      {/* ── MOBILE BOTTOM NAV (44px touch height & pb-safe) ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 select-none bg-white border-t border-slate-200 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
        <div className="flex justify-around items-center px-1.5 py-1">
          {navItems.map((item) => {
            const isActive = isPathActive(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[44px] decoration-none"
              >
                <div
                  className={`p-1 rounded-full transition-colors ${
                    isActive ? "bg-emerald-50 text-emerald-600" : "text-slate-400"
                  }`}
                >
                  <item.icon
                    size={18}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span
                  className={`text-[8.5px] font-extrabold mt-0.5 truncate w-full text-center leading-none ${
                    isActive ? "text-emerald-700 font-black" : "text-slate-550"
                  }`}
                >
                  {item.label === "Análisis IA" ? "IA" : item.label}
                </span>
              </Link>
            );
          })}
 
          {/* Logout button at the end of mobile bottom nav */}
          <button
            onClick={onLogout}
            className="flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 py-1.5 min-h-[44px] border-none bg-transparent cursor-pointer"
          >
            <div className="p-1 rounded-full text-rose-500 hover:bg-rose-50 transition-colors">
              <LogOut size={18} />
            </div>
            <span className="text-[8.5px] font-black mt-0.5 text-rose-600 leading-none">
              Salir
            </span>
          </button>
        </div>
      </nav>

      {/* ── FOOTER ── */}
      <footer
        id="workspace-footer"
        className="bg-white border-t border-slate-200 py-4 hidden sm:block select-none relative z-[1]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <p className="text-[11px] text-slate-500 font-medium">
            © 2026 PrestaFacilito · Panel de Administración de Cartera
          </p>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
            <span>Base de datos activa</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-70" />
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
