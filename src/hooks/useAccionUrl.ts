import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Atiende acciones pedidas por URL (`?accion=pago`), como las del botón "+" del celular.
 * Ejecuta `alRecibir` una vez y quita el parámetro, para que recargar o volver atrás no lo repita.
 */
export function useAccionUrl(alRecibir: (accion: string) => void) {
  const [params, setParams] = useSearchParams();
  const accion = params.get("accion");

  useEffect(() => {
    if (!accion) return;
    alRecibir(accion);
    const siguientes = new URLSearchParams(params);
    siguientes.delete("accion");
    setParams(siguientes, { replace: true });
    // alRecibir puede cambiar en cada render; solo importa reaccionar a una acción nueva
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accion]);
}
