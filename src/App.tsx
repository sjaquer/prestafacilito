import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { MainLayout } from "./layouts/MainLayout";
import { LoginPage } from "./pages/LoginPage";
import { InicioPage } from "./pages/InicioPage";

// Inicio va en el paquete principal (es la primera pantalla); el resto se descarga al abrirlo
const CuentasPage = lazy(() => import("./pages/CuentasPage").then((m) => ({ default: m.CuentasPage })));
const ClientesPage = lazy(() => import("./pages/ClientesPage").then((m) => ({ default: m.ClientesPage })));
const ClienteDetallePage = lazy(() => import("./pages/ClienteDetallePage").then((m) => ({ default: m.ClienteDetallePage })));
const PrestamoDetallePage = lazy(() => import("./pages/PrestamoDetallePage").then((m) => ({ default: m.PrestamoDetallePage })));
const CarteraPage = lazy(() => import("./pages/CarteraPage").then((m) => ({ default: m.CarteraPage })));
const VouchersPage = lazy(() => import("./pages/VouchersPage").then((m) => ({ default: m.VouchersPage })));
const AlquileresPage = lazy(() => import("./pages/AlquileresPage").then((m) => ({ default: m.AlquileresPage })));
const AlquilerDetallePage = lazy(() => import("./pages/AlquilerDetallePage").then((m) => ({ default: m.AlquilerDetallePage })));
const DashboardBIPage = lazy(() => import("./pages/DashboardBIPage").then((m) => ({ default: m.DashboardBIPage })));

/** Mientras se descarga una página: mismo esqueleto gris que usan las listas. */
const CargandoPagina: React.FC = () => (
  <div className="space-y-3 max-w-4xl mx-auto" aria-busy aria-label="Cargando">
    <div className="h-8 w-40 bg-slate-200/70 rounded-xl animate-pulse" />
    <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
    <div className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
  </div>
);
const conCarga = (el: React.ReactNode) => <Suspense fallback={<CargandoPagina />}>{el}</Suspense>;
import { Coins, Loader2 } from "lucide-react";
import { motion } from "motion/react";

const FullScreenLoader: React.FC<{ message: string }> = ({ message }) => (
  <div
    id="app-initial-loader"
    className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden"
  >
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-600/20 relative z-10 select-none"
    >
      <Coins className="text-white" size={26} />
    </motion.div>

    <Loader2 className="animate-spin text-emerald-600/70 mb-4 relative z-10" size={22} />
    <p className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase relative z-10 select-none">
      {message}
    </p>
  </div>
);

interface ProtectedRouteProps {
  children: React.ReactNode;
  authenticated: boolean | null;
  loading: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, authenticated, loading }) => {
  if (loading) {
    return <FullScreenLoader message="Iniciando Sesión..." />;
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  const { authenticated, user, loading, login, logout } = useAuth();

  if (loading && authenticated === null) {
    return <FullScreenLoader message="Cargando sistema..." />;
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
          <Route index element={<InicioPage />} />
          <Route path="bi" element={conCarga(<DashboardBIPage />)} />
          <Route path="cartera" element={conCarga(<CarteraPage />)} />
          <Route path="alquileres" element={conCarga(<AlquileresPage />)} />
          <Route path="alquileres/:id" element={conCarga(<AlquilerDetallePage />)} />
          <Route path="clientes" element={conCarga(<ClientesPage />)} />
          <Route path="clientes/:id" element={conCarga(<ClienteDetallePage />)} />
          <Route path="prestamos/:id" element={conCarga(<PrestamoDetallePage />)} />
          <Route path="reportes" element={<Navigate to="/" replace />} />
          <Route path="bitacora" element={<Navigate to="/" replace />} />
          <Route path="vouchers" element={conCarga(<VouchersPage />)} />
          <Route path="cuentas" element={conCarga(<CuentasPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
