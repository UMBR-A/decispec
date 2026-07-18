// @vitest-environment node

import { describe, expect, it } from "vitest";
import { extractDocument, extractDocuments, MAX_DOCUMENT_BYTES, safePdfExtractionError } from "../lib/documents/extract";
import { POST } from "../app/api/documents/extract/route";

function textFile(name: string, content: string) {
  return new File([content], name, { type: "text/plain" });
}

function simplePdf(text: string): ArrayBuffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length + 33} >>\nstream\nBT /F1 12 Tf 72 720 Td (${text}) Tj ET\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf).buffer as ArrayBuffer;
}

describe("server-side document extraction", () => {
  it("extracts TXT with a stable ID", async () => {
    const first = await extractDocument(textFile("Evidence.txt", "Exact evidence passage."));
    const second = await extractDocument(textFile("Evidence.txt", "Exact evidence passage."));
    expect(first).toMatchObject({ id: second.id, title: "Evidence.txt", content: "[Text]\nExact evidence passage." });
  });

  it("extracts text from a real PDF and retains its page label", async () => {
    const document = await extractDocument(new File([simplePdf("Monthly support is 18 dollars")], "quote.pdf", { type: "application/pdf" }));
    expect(document.content).toContain("Monthly support is 18 dollars");
    expect(document.pages[0].pageLabel).toBe("Page 1");
  });

  it.each([
    ["empty.txt", "", "EMPTY_DOCUMENT"],
    ["bad.pdf", "not a pdf", "UNREADABLE_PDF"],
    ["evidence.docx", "content", "UNSUPPORTED_FILE"],
  ])("rejects %s safely", async (name, content, code) => {
    await expect(extractDocument(new File([content], name))).rejects.toMatchObject({ code });
  });

  it("rejects oversized input and duplicate stable document IDs", async () => {
    const oversized = { name: "large.txt", size: MAX_DOCUMENT_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) } as File;
    await expect(extractDocument(oversized)).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    await expect(extractDocuments([textFile("same.txt", "same"), textFile("same.txt", "same")])).rejects.toBeTruthy();
  });

  it("classifies encrypted PDF failures without leaking parser content", () => {
    const error = safePdfExtractionError(new Error("PasswordException PRIVATE_PDF_DETAIL"));
    expect(error).toMatchObject({ code: "ENCRYPTED_PDF", message: "Encrypted PDFs are not supported." });
    expect(JSON.stringify(error)).not.toContain("PRIVATE_PDF_DETAIL");
  });

  it("returns only extracted text metadata and no secret-shaped fields", async () => {
    const form = new FormData();
    form.append("files", textFile("evidence.txt", "Public evidence only."));
    const response = await POST(new Request("http://local/api/documents/extract", { method: "POST", body: form }));
    const body = await response.json() as { documents: Array<{ content: string }> };
    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toMatch(/OPENAI_API_KEY|sk-proj/i);
    expect(body.documents[0].content).toContain("Public evidence only.");
  });
});
