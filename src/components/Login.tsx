import React, { useState } from "react";
import { Lock, User, AlertCircle, Loader2, Coins } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LoginProps {
  onLoginSuccess: (username: string) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        onLoginSuccess(data.username);
      } else {
        const errData = await response.json();
        setError(errData.message || "Credenciales incorrectas");
      }
    } catch (err) {
      setError("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 overflow-hidden font-sans select-none bg-[#070a13]">
      {/* Fondo Gradiente Premium & Elementos Decorativos */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070a13] to-[#0c1122] z-0" />
      
      {/* Círculos Brillantes de Fondo (Glow Effect) */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse z-0" />
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div id="login-card" className="bento-card rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          
          {/* Logo & Encabezado */}
          <div id="logo-header" className="text-center mb-8">
            <motion.div 
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto w-14 h-14 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl flex items-center justify-center mb-4 shadow-[0_8px_20px_rgba(99,102,241,0.3)]"
            >
              <Coins className="text-white" size={28} />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-indigo-200 tracking-tight">
              Control de Cartera
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 font-medium">
              Gestión segura de créditos y amortizaciones
            </p>
          </div>

          <form id="login-form" onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  id="login-error"
                  className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl text-xs sm:text-sm"
                >
                  <AlertCircle size={18} className="shrink-0 text-red-400" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input de Usuario */}
            <div id="username-field" className="space-y-2">
              <label className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest block pl-1">
                Usuario de Administración
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-550 group-focus-within:text-indigo-400 transition-colors">
                  <User size={18} />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  className="w-full glass-input pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Input de Contraseña */}
            <div id="password-field" className="space-y-2">
              <label className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest block pl-1">
                Contraseña
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-555 group-focus-within:text-indigo-400 transition-colors">
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full glass-input pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium"
                  required
                />
              </div>
            </div>

            {/* Botón de Submit */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              id="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full glow-btn text-white py-4 rounded-2xl font-bold text-sm flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2 min-h-[48px]"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Autenticando...</span>
                </>
              ) : (
                <span>Iniciar Sesión</span>
              )}
            </motion.button>
          </form>

          {/* Pie de Página del Login */}
          <div id="login-footer" className="text-center mt-8 pt-6 border-t border-white/5">
            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
              Acceso Restringido a Personal Autorizado 🇵🇪
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
