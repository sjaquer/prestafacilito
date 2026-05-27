import { useState, useEffect, useCallback } from "react";
import { Cliente, DocumentoCliente } from "../types";

export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/clientes");
      if (res.ok) {
        const data = await res.json();
        setClientes(data || []);
      } else {
        const errData = await res.json();
        setError(errData.error || "Error al cargar la lista de clientes.");
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const createCliente = async (clienteData: Omit<Cliente, "id" | "fecha_registro">) => {
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clienteData),
      });

      if (res.ok) {
        const newCliente = await res.json();
        setClientes((prev) => [...prev, newCliente]);
        return { success: true, cliente: newCliente };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo crear el cliente." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Error de red al crear cliente." };
    }
  };

  const updateCliente = async (id: string, clienteData: Partial<Cliente>) => {
    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clienteData),
      });

      if (res.ok) {
        const updatedCliente = await res.json();
        setClientes((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...updatedCliente } : c))
        );
        return { success: true, cliente: updatedCliente };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo actualizar el cliente." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Error de red al actualizar cliente." };
    }
  };

  const uploadClienteDocument = async (
    clienteId: string,
    documentData: { fileName: string; mimeType: string; base64Data: string; tipo_documento: string; observacion?: string }
  ) => {
    try {
      const res = await fetch(`/api/clientes/${clienteId}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documentData),
      });

      if (res.ok) {
        const doc = await res.json();
        return { success: true, documento: doc };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo subir el documento." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Error de red al subir documento." };
    }
  };

  const deleteClienteDocument = async (clienteId: string, docId: string) => {
    try {
      const res = await fetch(`/api/clientes/${clienteId}/documentos/${docId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        return { success: true };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo eliminar el documento." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Error de red al eliminar documento." };
    }
  };

  const fetchClienteDocuments = async (clienteId: string): Promise<DocumentoCliente[]> => {
    try {
      const res = await fetch(`/api/clientes/${clienteId}/documentos`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("Error al obtener documentos del cliente:", err);
    }
    return [];
  };

  return {
    clientes,
    loading,
    error,
    refetch: fetchClientes,
    createCliente,
    updateCliente,
    uploadClienteDocument,
    deleteClienteDocument,
    fetchClienteDocuments,
  };
}
