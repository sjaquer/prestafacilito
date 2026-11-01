import React, { useState } from "react";
import { AlertCircle, ArrowRight, Coins, Delete, Loader2, Lock, User } from "lucide-react";
import { motion } from "motion/react";

interface LoginPageProps {
  onLoginSuccess: (username: string) => void;
}

const OPERADORES = [
  { usuario: "sjaquer", nombre: "Sebastián", iniciales: "SJ" },
  { usuario: "rjaque", nombre: "Roberto", iniciales: "RJ" },
];

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Ingreso con PIN: elegir operador, teclear el PIN (teclado en pantalla o físico) y entrar. */
export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [usuario, setUsuario] = useState(OPERADORES[0].usuario);
  const [otroUsuario, setOtroUsuario] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!usuario || !pin || loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usuario, password: pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || data.error || "PIN incorrecto");
        setPin("");
        return;
      }
      onLoginSuccess(data.username);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const elegir = (u: string) => {
    setOtroUsuario(false);
    setUsuario(u);
    setError("");
  };

  const teclaCls =
    "h-14 sm:h-12 rounded-2xl bg-white border border-slate-200 text-xl sm:text-lg font-mono font-black text-slate-800 active:bg-slate-100 active:scale-95 transition flex items-center justify-center disabled:opacity-50";

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center px-4 py-8 pt-safe pb-safe-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-sm space-y-6"
      >
        {/* Marca */}
        <div className="text-center space-y-2">
          <span className="mx-auto w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <Coins className="text-white" size={26} />
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">PrestaFácil</h1>
          <p className="text-sm text-slate-500 font-semibold">¿Quién ingresa?</p>
        </div>

        {/* Operador */}
        {!otroUsuario ? (
          <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Operador">
            {OPERADORES.map((op) => {
              const activo = usuario === op.usuario;
              return (
                <button
                  key={op.usuario}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => elegir(op.usuario)}
                  className={`h-16 px-3 rounded-2xl border-2 flex items-center gap-3 text-left transition ${
                    activo ? "bg-emerald-50 border-emerald-500" : "bg-white border-slate-200"
                  }`}
                >
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      activo ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {op.iniciales}
                  </span>
                  <span className={`text-sm font-black ${activo ? "text-emerald-900" : "text-slate-600"}`}>{op.nombre}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <label className="block">
            <span className="sr-only">Usuario</span>
            <span className="relative block">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value.trim())}
                placeholder="Usuario"
                autoComplete="username"
                autoCapitalize="none"
                className="w-full h-14 pl-11 pr-4 bg-white border border-slate-200 rounded-2xl text-base font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
              />
            </span>
          </label>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* PIN: se puede escribir con el teclado del equipo o con el de abajo */}
          <label className="block">
            <span className="sr-only">PIN</span>
            <span className="relative block">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN"
                className="w-full h-14 pl-11 pr-4 bg-white border border-slate-200 rounded-2xl text-center text-2xl font-mono font-black tracking-[0.4em] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 placeholder:text-base placeholder:tracking-normal placeholder:font-sans placeholder:font-semibold"
              />
            </span>
          </label>

          {error && (
            <p role="alert" className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {TECLAS.map((n) => (
              <button key={n} type="button" onClick={() => setPin((p) => p + n)} disabled={loading} className={teclaCls}>
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPin("")}
              disabled={loading || !pin}
              className={`${teclaCls} !text-xs !font-sans uppercase text-slate-500`}
              aria-label="Borrar todo"
            >
              Borrar
            </button>
            <button type="button" onClick={() => setPin((p) => p + "0")} disabled={loading} className={teclaCls}>
              0
            </button>
            <button
              type="button"
              onClick={() => setPin((p) => p.slice(0, -1))}
              disabled={loading || !pin}
              className={teclaCls}
              aria-label="Borrar un dígito"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <button
            type="submit"
            disabled={!pin || !usuario || loading}
            className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-black inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:shadow-none transition"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            {loading ? "Validando..." : "Ingresar"}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setOtroUsuario((v) => !v);
              setUsuario(otroUsuario ? OPERADORES[0].usuario : "");
            }}
            className="h-11 px-4 text-sm font-bold text-slate-500 hover:text-slate-800"
          >
            {otroUsuario ? "Elegir operador" : "Otro usuario"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
