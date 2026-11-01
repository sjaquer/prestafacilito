import { TipoDocumento } from "../../types";
import { comprimirImagen, partesDataUrl } from "../../lib/imageCompression";

type Subir = (
  clienteId: string,
  doc: { fileName: string; mimeType: string; base64Data: string; tipo_documento: TipoDocumento }
) => Promise<unknown>;

/**
 * Sube los documentos adjuntados al registrar o editar un cliente. Las fotos se comprimen
 * (perfil "documento"); los PDF y Word van tal cual. Un fallo no detiene a los demás.
 */
export async function subirDocumentosCliente(clienteId: string | undefined, files: { tipo: TipoDocumento; file: File }[], subir: Subir) {
  if (!clienteId || files.length === 0) return;
  for (const doc of files) {
    try {
      const { mimeType, base64Data } = partesDataUrl(await comprimirImagen(doc.file, "documento"));
      await subir(clienteId, {
        fileName: doc.file.name,
        mimeType,
        base64Data,
        tipo_documento: doc.tipo,
      });
    } catch (err) {
      console.error(`No se pudo subir el documento ${doc.file.name}:`, err);
    }
  }
}
