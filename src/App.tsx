import { useState, useEffect } from "react";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
import { Clientes } from "./components/Clientes";
import { PrestamoDetalle } from "./components/PrestamoDetalle";
import { ReporteIA } from "./components/ReporteIA";
import { LayoutDashboard, Users, LogOut, Loader2, Coins, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type ViewState = "dashboard" | "clientes" | "loan-detail" | "reporte-ia";

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>("dashboard");
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  // Verificar sesión persistente al cargar la app
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
      } catch (err) {
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

  if (authenticated === null) {
    return (
      <div id="app-initial-loader" className="min-h-screen bg-[#070a13] flex flex-col items-center justify-center text-slate-200 relative overflow-hidden">
        {/* Glow de fondo */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
        
        <motion.div 
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20 relative z-10"
        >
          <Coins className="text-white" size={28} />
        </motion.div>
        
        <Loader2 className="animate-spin text-indigo-500 mb-4 relative z-10" size={24} />
        <p className="text-sm font-semibold text-slate-400 tracking-wide uppercase relative z-10">
          Iniciando PrestaFacilito...
        </p>
      </div>
    );
  }

  if (authenticated === false) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div id="admin-workspace" className="min-h-screen flex flex-col font-sans bg-[#070a13] text-[#f8fafc] pb-20 sm:pb-0">
      
      {/* Header Premium con Glassmorphism */}
      <header id="workspace-header" className="bg-[#070a13]/80 backdrop-blur-md border-b border-white/5 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            {/* Logo Marca */}
            <div id="nav-brand" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-650 rounded-xl flex items-center justify-center text-white font-black text-sm select-none shadow-md shadow-indigo-500/25 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative z-10 font-extrabold tracking-wider">PF</span>
              </div>
              <div>
                <span className="font-extrabold text-[#f8fafc] text-sm tracking-tight block">PrestaFacilito</span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Cartera & Clientes 🇵🇪</span>
              </div>
            </div>

            {/* Menú de navegación (Desktop) */}
            <nav id="nav-links" className="hidden sm:flex items-center gap-1 bg-[#0f172a]/80 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setView("dashboard")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  view === "dashboard" || view === "loan-detail"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <LayoutDashboard size={14} />
                <span>Dashboard</span>
              </button>
              
              <button
                onClick={() => setView("clientes")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  view === "clientes"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Users size={14} />
                <span>Clientes</span>
              </button>
            </nav>

            {/* Administrador actual & Logout */}
            <div id="user-controls" className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <span className="text-xs font-bold text-slate-300 block">Administrador</span>
                <span className="text-[10px] text-emerald-500 font-bold flex items-center justify-end gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                  <span>En Línea</span>
                </span>
              </div>

              <div className="w-px h-8 bg-white/10 hidden sm:block"></div>

              <button
                id="btn-logout"
                onClick={handleLogout}
                title="Cerrar sesión segura"
                className="p-2.5 text-slate-400 hover:text-red-455 hover:bg-red-500/10 rounded-xl transition duration-150 cursor-pointer"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="workspace-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={view + (view === "loan-detail" ? `-${selectedLoanId}` : "")}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="w-full h-full"
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
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Barra de navegación inferior flotante (Mobile Only) - Super Premium */}
      <div className="sm:hidden fixed bottom-4 left-4 right-4 z-40 bg-[#0f172a]/95 backdrop-blur-lg border border-white/5 rounded-2xl p-1.5 shadow-xl shadow-black/40">
        <div className="flex justify-around items-center">
          <button
            onClick={() => setView("dashboard")}
            className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition duration-200 cursor-pointer ${
              view === "dashboard" || view === "loan-detail"
                ? "text-indigo-400 font-bold bg-indigo-500/15"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <LayoutDashboard size={18} />
            <span className="text-[10px]">Dashboard</span>
          </button>
          
          <button
            onClick={() => setView("clientes")}
            className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition duration-200 cursor-pointer ${
              view === "clientes"
                ? "text-indigo-400 font-bold bg-indigo-500/15"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users size={18} />
            <span className="text-[10px]">Clientes</span>
          </button>

        </div>
      </div>

      {/* Footer */}
      <footer id="workspace-footer" className="bg-[#070a13] border-t border-white/5 py-5 text-[11px] text-slate-500 select-none hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <p>© 2026 PrestaFacilito. Gestión financiera peruana segura y ordenada.</p>
          <div className="flex items-center gap-2.5 font-semibold text-[#f8fafc]">
            <span className="text-slate-400">Sincronizado con Google Sheets</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
