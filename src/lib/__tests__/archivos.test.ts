import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  driveIdDeUrl,
  esMimePermitido,
  esRutaValida,
  nombreArchivoSeguro,
  rutaComprobante,
  rutaDeUrl,
  rutaDocumentoCliente,
  serializarUrls,
  urlDeRuta,
} from "../archivos.js";
import { resolveDocumentUrl, resolveVoucherUrl } from "../formatters.js";

const DRIVE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

describe("rutas de Storage", () => {
  it("el comprobante va a la carpeta del mes del pago, con extensión según el contenido", () => {
    const ruta = rutaComprobante("Captura Yape (1).PNG", "image/jpeg", new Date(2026, 9, 31));
    assert.match(ruta, /^comprobantes\/2026\/10\/[a-z0-9]+-Captura_Yape_1\.jpg$/);
    assert.ok(esRutaValida(ruta));
  });

  it("el documento va a la carpeta del cliente y sin tildes ni espacios", () => {
    const ruta = rutaDocumentoCliente("2d9f7455-8f26-4499-83ba-513ffa016960", "Recibo de luz ñandú.pdf", "application/pdf");
    assert.match(ruta, /^clientes\/2d9f7455-8f26-4499-83ba-513ffa016960\/[a-z0-9]+-Recibo_de_luz_nandu\.pdf$/);
    assert.ok(esRutaValida(ruta));
  });

  it("dos subidas del mismo archivo no se pisan", () => {
    assert.notEqual(rutaComprobante("a.jpg", "image/jpeg"), rutaComprobante("a.jpg", "image/jpeg"));
  });

  it("rechaza rutas fuera de las carpetas permitidas", () => {
    assert.equal(esRutaValida("comprobantes/../secreto.txt"), false);
    assert.equal(esRutaValida("otra/archivo.jpg"), false);
    assert.equal(esRutaValida("comprobantes//a.jpg"), false);
    assert.equal(esRutaValida("comprobantes/2026/10/a b.jpg"), false);
    assert.equal(rutaDeUrl("/api/archivos/comprobantes/%2E%2E/x.jpg"), null);
  });

  it("nombre vacío o raro igual produce un nombre usable", () => {
    assert.equal(nombreArchivoSeguro("", "image/png"), "archivo.png");
    assert.equal(nombreArchivoSeguro("###.pdf"), "archivo.pdf");
  });
});

describe("URLs de archivos", () => {
  it("ida y vuelta entre ruta y URL", () => {
    const ruta = "comprobantes/2026/10/abc-voucher.jpg";
    assert.equal(rutaDeUrl(urlDeRuta(ruta)), ruta);
    assert.equal(rutaDeUrl("/api/vouchers/proxy/xyz"), null);
  });

  it("reconoce IDs de Drive en proxies antiguos, enlaces y IDs puros", () => {
    assert.equal(driveIdDeUrl(`/api/vouchers/proxy/${DRIVE_ID}`), DRIVE_ID);
    assert.equal(driveIdDeUrl(`/api/documentos/proxy/${DRIVE_ID}`), DRIVE_ID);
    assert.equal(driveIdDeUrl(`https://drive.google.com/file/d/${DRIVE_ID}/view`), DRIVE_ID);
    assert.equal(driveIdDeUrl(`https://drive.google.com/uc?export=view&id=${DRIVE_ID}`), DRIVE_ID);
    assert.equal(driveIdDeUrl(DRIVE_ID), DRIVE_ID);
    assert.equal(driveIdDeUrl("/api/archivos/comprobantes/2026/10/a.jpg"), null);
  });

  it("serializa una o varias URLs igual que antes (texto o array JSON)", () => {
    assert.equal(serializarUrls([]), null);
    assert.equal(serializarUrls(["/a"]), "/a");
    assert.equal(serializarUrls(["/a", "/b"]), '["/a","/b"]');
  });

  it("resolveVoucherUrl: Storage tal cual, Drive por el proxy", () => {
    assert.equal(resolveVoucherUrl('["/api/archivos/comprobantes/2026/10/a.jpg","/x"]'), "/api/archivos/comprobantes/2026/10/a.jpg");
    assert.equal(resolveVoucherUrl(`https://drive.google.com/file/d/${DRIVE_ID}/view`), `/api/vouchers/proxy/${DRIVE_ID}`);
    assert.equal(resolveVoucherUrl(null), "");
  });

  it("resolveDocumentUrl: prefiere Storage; documentos antiguos por Drive", () => {
    assert.equal(
      resolveDocumentUrl({ storage_path: "clientes/1/a.pdf", drive_file_id: DRIVE_ID }),
      "/api/archivos/clientes/1/a.pdf"
    );
    assert.equal(resolveDocumentUrl({ drive_file_id: DRIVE_ID }), `/api/documentos/proxy/${DRIVE_ID}`);
    assert.equal(resolveDocumentUrl({ drive_url: `/api/documentos/proxy/${DRIVE_ID}` }), `/api/documentos/proxy/${DRIVE_ID}`);
  });
});

describe("tipos de archivo", () => {
  it("acepta imágenes, PDF y Word; rechaza el resto", () => {
    for (const ok of ["image/jpeg", "image/png", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]) {
      assert.ok(esMimePermitido(ok), ok);
    }
    for (const no of ["text/html", "application/javascript", "image/svg+xml", ""]) {
      assert.equal(esMimePermitido(no), false, no);
    }
  });
});
