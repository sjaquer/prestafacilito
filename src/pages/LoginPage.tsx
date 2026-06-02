import React, { useState, useEffect } from "react";
import { Lock, User, AlertCircle, Loader2, Coins, ChevronRight, UserCheck, Delete, Backspace } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "../components/ui/Button";

interface LoginPageProps {
  onLoginSuccess: (username: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [operator, setOperator] = useState<"sjaquer" | "rjaque" | "custom">("sjaquer");
  const [username, setUsername] = useState("sjaquer");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Sync username state when operator changes
  useEffect(() => {
    if (operator !== "custom") {
      setUsername(operator);
    } else {
      setUsername("");
    }
  }, [operator]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
        // Clear password on error
        setPassword("");
      }
    } catch (err) {
      setError("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  // Virtual Keypad handlers
  const handleKeypadPress = (val: string) => {
    if (password.length < 6) {
      setPassword(prev => prev + val);
    }
  };

  const handleKeypadDelete = () => {
    setPassword(prev => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setPassword("");
  };

  // Submit automatically if PIN reaches 6 digits and it's standard login
  useEffect(() => {
    if (password.length === 6 && username) {
      handleSubmit();
    }
  }, [password, username]);

  return (
    <div id="login-container" className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 overflow-hidden font-sans select-none bg-[#050811]">
      {/* Fondo Gradiente Premium & Elementos Decorativos */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050811] via-[#070b16] to-[#0b1020] z-0" />
      
      {/* Círculos Brillantes de Fondo (Glow Effect) */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl z-0" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl z-0" />
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div id="login-card" className="bento-card rounded-3xl p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.8)] border border-white/5 bg-[#080c16]/90">
          
          {/* Logo & Encabezado */}
          <div id="logo-header" className="text-center mb-6">
            <motion.div 
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto w-14 h-14 bg-black/40 border border-white/10 rounded-2xl flex items-center justify-center mb-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden shrink-0"
            >
              <img src="/brand_logo_icon.png" alt="PrestaFacilito" className="w-full h-full object-cover" />
            </motion.div>
            <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-emerald-300 tracking-tight">
              PrestaFacilito
            </h1>
            <p className="text-slate-500 text-[10px] sm:text-xs mt-1.5 font-bold uppercase tracking-wider">
              Sistema Cerrado · Control Operacional 🇵🇪
            </p>
          </div>

          {error && (
            <div
              id="login-error"
              className="flex items-start gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-350 rounded-2xl text-xs mb-4"
            >
              <AlertCircle size={16} className="shrink-0 text-rose-455 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Selector de Operador (Sebastián o Roberto) */}
          <div className="space-y-3 mb-5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-center select-none">
              Seleccionar Operador
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Sebastián */}
              <button
                type="button"
                onClick={() => setOperator("sjaquer")}
                className={`p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between h-20 ${
                  operator === "sjaquer"
                    ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] text-white"
                    : "bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${
                    operator === "sjaquer" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/[0.04] text-slate-500"
                  }`}>
                    SJ
                  </div>
                  {operator === "sjaquer" && <UserCheck size={14} className="text-emerald-400" />}
                </div>
                <div className="mt-2">
                  <span className="text-xs font-black block leading-none">Sebastián</span>
                  <span className="text-[8px] font-bold text-slate-550 block mt-1">sjaquer</span>
                </div>
              </button>

              {/* Roberto */}
              <button
                type="button"
                onClick={() => setOperator("rjaque")}
                className={`p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between h-20 ${
                  operator === "rjaque"
                    ? "bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] text-white"
                    : "bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black ${
                    operator === "rjaque" ? "bg-indigo-500/20 text-indigo-300" : "bg-white/[0.04] text-slate-500"
                  }`}>
                    RJ
                  </div>
                  {operator === "rjaque" && <UserCheck size={14} className="text-indigo-400" />}
                </div>
                <div className="mt-2">
                  <span className="text-xs font-black block leading-none">Roberto</span>
                  <span className="text-[8px] font-bold text-slate-550 block mt-1">rjaque</span>
                </div>
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setOperator(operator === "custom" ? "sjaquer" : "custom")}
                className="text-[9px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-wider transition-colors cursor-pointer border-none bg-transparent"
              >
                {operator === "custom" ? "Volver a operadores" : "Otro usuario de acceso"}
              </button>
            </div>
          </div>

          <div id="login-form" className="space-y-4">
            {/* Input Manual de Usuario (Si es custom) */}
            {operator === "custom" && (
              <div id="username-field" className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block pl-1">
                  Nombre de Usuario
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 group-focus-within:text-emerald-400 transition-colors">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ingresa usuario"
                    className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-xs font-medium"
                    required
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            {/* Input de PIN de Acceso */}
            <div id="password-field" className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                  PIN de Acceso ({password.length}/6 dígitos)
                </label>
                {password.length > 0 && (
                  <button
                    type="button"
                    onClick={handleKeypadClear}
                    className="text-[8px] font-black text-rose-455 hover:text-rose-350 uppercase tracking-wider border-none bg-transparent cursor-pointer"
                  >
                    Borrar Todo
                  </button>
                )}
              </div>
              
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 group-focus-within:text-emerald-400 transition-colors">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  value={password}
                  readOnly
                  placeholder="••••••"
                  className="w-full glass-input pl-10 pr-4 py-3 rounded-xl text-sm font-mono font-bold tracking-[0.4em] text-center bg-[#070912]"
                  required
                />
              </div>
            </div>

            {/* Teclado Virtual Numérico (Premium ATM Style) */}
            <div className="pt-2">
              <div className="grid grid-cols-3 gap-2 bg-black/20 p-2.5 rounded-2xl border border-white/[0.03]">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    disabled={loading || password.length >= 6}
                    className="h-10 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs font-mono font-black text-slate-200 hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer flex items-center justify-center animate-none"
                  >
                    {num}
                  </button>
                ))}
                
                {/* Limpiar */}
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  disabled={loading || password.length === 0}
                  className="h-10 rounded-xl bg-rose-500/5 border border-rose-500/10 text-[9px] font-black text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center uppercase"
                >
                  C
                </button>

                {/* 0 */}
                <button
                  type="button"
                  onClick={() => handleKeypadPress("0")}
                  disabled={loading || password.length >= 6}
                  className="h-10 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs font-mono font-black text-slate-200 hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                >
                  0
                </button>

                {/* Borrar uno */}
                <button
                  type="button"
                  onClick={handleKeypadDelete}
                  disabled={loading || password.length === 0}
                  className="h-10 rounded-xl bg-slate-550/5 border border-white/[0.04] text-xs font-black text-slate-400 hover:bg-white/[0.06] active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                  title="Retroceso"
                >
                  <Backspace size={14} />
                </button>
              </div>
            </div>

            {/* Botón de Submit Manual (Respaldo) */}
            <Button
              onClick={() => handleSubmit()}
              variant={password.length === 6 ? "primary" : "secondary"}
              loading={loading}
              disabled={password.length < 6}
              className="w-full py-3 mt-2 font-bold text-xs min-h-[42px] flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <span>Validando PIN...</span>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ChevronRight size={14} />
                </>
              )}
            </Button>
          </div>

          {/* Pie de Página del Login */}
          <div id="login-footer" className="text-center mt-6 pt-5 border-t border-white/5 select-none">
            <p className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">
              Acceso Restringido a Administradores
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
