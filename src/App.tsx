import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { MainLayout } from "./layouts/MainLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ClientesPage } from "./pages/ClientesPage";
import { ClienteDetallePage } from "./pages/ClienteDetallePage";
import { PrestamoDetallePage } from "./pages/PrestamoDetallePage";
import { ReportesPage } from "./pages/ReportesPage";
import { CarteraPage } from "./pages/CarteraPage";
import { Coins, Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  authenticated: boolean | null;
  loading: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, authenticated, loading }) => {
  if (loading) {
    return (
      <div
        id="app-initial-loader"
        className="min-h-screen bg-[#070a13] flex flex-col items-center justify-center relative overflow-hidden"
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/5 rounded-full blur-[85px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-violet-600/4 rounded-full blur-[80px] pointer-events-none" />

        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/20 relative z-10 select-none"
        >
          <Coins className="text-white" size={26} />
        </motion.div>

        <Loader2
          className="animate-spin text-indigo-400/60 mb-4 relative z-10"
          size={22}
        />
        <p className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase relative z-10 select-none">
          Iniciando Sesión...
        </p>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  const { authenticated, user, loading, login, logout } = useAuth();

  // If initially loading user credentials
  if (loading && authenticated === null) {
    return (
      <div
        id="app-initial-loader"
        className="min-h-screen bg-[#070a13] flex flex-col items-center justify-center relative overflow-hidden"
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/5 rounded-full blur-[85px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-violet-600/4 rounded-full blur-[80px] pointer-events-none" />

        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/20 relative z-10 select-none"
        >
          <Coins className="text-white" size={26} />
        </motion.div>

        <Loader2
          className="animate-spin text-indigo-400/60 mb-4 relative z-10"
          size={22}
        />
        <p className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase relative z-10 select-none">
          Cargando PrestaFacilito...
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public login route */}
        <Route
          path="/login"
          element={
            authenticated ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage onLoginSuccess={login} />
            )
          }
        />

        {/* Private workspace routes under MainLayout */}
        <Route
          path="/"
          element={
            <ProtectedRoute authenticated={authenticated} loading={loading}>
              <MainLayout user={user} onLogout={logout} />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="cartera" element={<CarteraPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="clientes/:id" element={<ClienteDetallePage />} />
          <Route path="prestamos/:id" element={<PrestamoDetallePage />} />
          <Route path="reportes" element={<ReportesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
