import { TipoDocumento } from "../../types";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

type Subir = (
  clienteId: string,
  doc: { fileName: string; mimeType: string; base64Data: string; tipo_documento: TipoDocumento }
) => Promise<unknown>;

/** Sube los documentos adjuntados al registrar o editar un cliente. Un fallo no detiene a los demás. */
export async function subirDocumentosCliente(clienteId: string | undefined, files: { tipo: TipoDocumento; file: File }[], subir: Subir) {
  if (!clienteId || files.length === 0) return;
  for (const doc of files) {
    try {
      await subir(clienteId, {
        fileName: doc.file.name,
        mimeType: doc.file.type || "application/octet-stream",
        base64Data: await fileToBase64(doc.file),
        tipo_documento: doc.tipo,
      });
    } catch (err) {
      console.error(`No se pudo subir el documento ${doc.file.name}:`, err);
    }
  }
}
