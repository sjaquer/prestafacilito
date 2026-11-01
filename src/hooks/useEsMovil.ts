import { useEffect, useState } from "react";

/** Mismo corte que `sm:` de Tailwind: debajo de 640 px se usa la interfaz de celular. */
const CONSULTA = "(max-width: 639px)";

/** true en celular. Se actualiza al girar la pantalla o cambiar el tamaño de la ventana. */
export function useEsMovil(): boolean {
  const [esMovil, setEsMovil] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(CONSULTA).matches : false
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(CONSULTA);
    const onChange = () => setEsMovil(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return esMovil;
}
