import { useState, useEffect } from "react";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
import { Clientes } from "./components/Clientes";
import { PrestamoDetalle } from "./components/PrestamoDetalle";
import { ReporteIA } from "./components/ReporteIA";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Loader2,
  Coins,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type ViewState = "dashboard" | "clientes" | "loan-detail" | "reporte-ia";

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>("dashboard");
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setAuthenticated(true);
            setUser(data.user);
          } else {
            setAuthenticated(false);
          }
        } else {
          setAuthenticated(false);
        }
      } catch {
        setAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = (username: string) => {
    setAuthenticated(true);
    setUser(username);
    setView("dashboard");
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        setAuthenticated(false);
        setUser(null);
        setView("dashboard");
      }
    } catch (err) {
      console.error("Error al cerrar sesión", err);
    }
  };

  /* ─── Loading Screen ─── */
  if (authenticated === null) {
    return (
      <div
        id="app-initial-loader"
        className="min-h-screen bg-[#070a13] flex flex-col items-center justify-center relative overflow-hidden"
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/6 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-violet-600/5 rounded-full blur-[80px] pointer-events-none" />

        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/25 relative z-10"
        >
          <Coins className="text-white" size={26} />
        </motion.div>

        <Loader2
          className="animate-spin text-indigo-400/70 mb-4 relative z-10"
          size={22}
        />
        <p className="text-[11px] font-bold text-slate-500 tracking-[0.2em] uppercase relative z-10">
          Cargando sistema...
        </p>
      </div>
    );
  }

  if (authenticated === false) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  /* ─── Nav Items ─── */
  const navItems = [
    {
      id: "dashboard" as const,
      label: "Dashboard",
      icon: LayoutDashboard,
      activeViews: ["dashboard", "loan-detail"] as ViewState[],
    },
    {
      id: "clientes" as const,
      label: "Clientes",
      icon: Users,
      activeViews: ["clientes"] as ViewState[],
    },
    {
      id: "reporte-ia" as const,
      label: "Análisis IA",
      icon: Sparkles,
      activeViews: ["reporte-ia"] as ViewState[],
    },
  ];

  return (
    <div
      id="admin-workspace"
      className="min-h-screen flex flex-col bg-[#070a13] text-[#f8fafc] pb-20 sm:pb-0"
    >
      {/* ── HEADER ── */}
      <header
        id="workspace-header"
        className="sticky top-0 z-40 bg-[#070a13]/90 backdrop-blur-xl border-b border-white/[0.055] shadow-sm shadow-black/30"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center gap-4">
            {/* Brand */}
            <div id="nav-brand" className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                <Coins className="text-white" size={16} />
              </div>
              <div className="hidden sm:block leading-none">
                <span className="font-black text-white text-sm tracking-tight block">
                  PrestaFacilito
                </span>
                <span className="text-[10px] text-indigo-400/70 font-semibold tracking-wider">
                  Panel Administrativo 🇵🇪
                </span>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav
              id="nav-links"
              className="hidden sm:flex items-center gap-0.5 bg-white/[0.035] p-1 rounded-xl border border-white/[0.06] flex-1 max-w-sm mx-auto"
            >
              {navItems.map((item) => {
                const isActive = item.activeViews.includes(view);
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-150 cursor-pointer flex-1 justify-center ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                    }`}
                  >
                    <item.icon size={13} strokeWidth={isActive ? 2.5 : 2} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* User + Logout */}
            <div
              id="user-controls"
              className="flex items-center gap-2.5 shrink-0"
            >
              {user && (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                    <span className="text-[10px] font-black text-indigo-300 uppercase">
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
                onClick={handleLogout}
                title="Cerrar sesión segura"
                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-150 cursor-pointer"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main
        id="workspace-content"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={view + (view === "loan-detail" ? `-${selectedLoanId}` : "")}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {view === "dashboard" && (
              <Dashboard
                onSelectLoan={(id) => {
                  setSelectedLoanId(id);
                  setView("loan-detail");
                }}
                onNavigateToClients={() => setView("clientes")}
              />
            )}
            {view === "clientes" && <Clientes />}
            {view === "loan-detail" && selectedLoanId && (
              <PrestamoDetalle
                loanId={selectedLoanId}
                onBack={() => {
                  setSelectedLoanId(null);
                  setView("dashboard");
                }}
              />
            )}
            {view === "reporte-ia" && <ReporteIA />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <div className="sm:hidden fixed bottom-3 left-3 right-3 z-40">
        <div className="bg-[#0c1020]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl px-2 py-1.5 shadow-2xl shadow-black/60 flex justify-around items-center">
          {navItems.map((item) => {
            const isActive = item.activeViews.includes(view);
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-all duration-200 cursor-pointer flex-1 ${
                  isActive
                    ? "text-indigo-400"
                    : "text-slate-600 hover:text-slate-400"
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg transition-all ${isActive ? "bg-indigo-500/15" : ""}`}
                >
                  <item.icon
                    size={18}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                </div>
                <span
                  className={`text-[9px] font-bold tracking-wide ${isActive ? "text-indigo-400" : "text-slate-600"}`}
                >
                  {item.id === "reporte-ia" ? "IA" : item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer
        id="workspace-footer"
        className="bg-[#070a13] border-t border-white/[0.05] py-4 hidden sm:block"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <p className="text-[11px] text-slate-600 font-medium select-none">
            © 2026 PrestaFacilito · Panel de Administración de Cartera
          </p>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold select-none">
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
}
