import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_CHARACTERS = 120_000;
export const MAX_DOCUMENTS = 8;

export type ExtractedPage = { pageLabel: string; content: string };
export type ExtractedDocument = { id: string; title: string; content: string; pages: ExtractedPage[] };
export type DocumentExtractionCode = "UNSUPPORTED_FILE" | "FILE_TOO_LARGE" | "EMPTY_DOCUMENT" | "ENCRYPTED_PDF" | "UNREADABLE_PDF" | "TOO_MANY_DOCUMENTS";

export class DocumentExtractionError extends Error {
  constructor(readonly code: DocumentExtractionCode, message: string) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

export function safePdfExtractionError(error: unknown): DocumentExtractionError {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("password") || message.includes("encrypted")
    ? new DocumentExtractionError("ENCRYPTED_PDF", "Encrypted PDFs are not supported.")
    : new DocumentExtractionError("UNREADABLE_PDF", "The PDF is malformed or unreadable.");
}

function stableId(name: string, bytes: Uint8Array): string {
  const slug = name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "document";
  return `doc-${slug}-${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}`;
}

function boundedContent(pages: ExtractedPage[]): string {
  if (!pages.some((page) => page.content.trim().length > 0)) throw new DocumentExtractionError("EMPTY_DOCUMENT", "No readable text was found. Scanned PDFs require OCR, which is not available.");
  const content = pages.map((page) => `[${page.pageLabel}]\n${page.content.trim()}`).join("\n\n").trim();
  if (content.length > MAX_DOCUMENT_CHARACTERS) throw new DocumentExtractionError("FILE_TOO_LARGE", "Extracted text exceeds the 120,000-character document limit.");
  return content;
}

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  if (file.size > MAX_DOCUMENT_BYTES) throw new DocumentExtractionError("FILE_TOO_LARGE", "Each file must be 10 MB or smaller.");
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (extension !== "txt" && extension !== "pdf") throw new DocumentExtractionError("UNSUPPORTED_FILE", "Only TXT and PDF files are supported.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let pages: ExtractedPage[];
  if (extension === "txt") {
    const content = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "");
    pages = [{ pageLabel: "Text", content }];
  } else {
    let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;
    try {
      pdf = await getDocumentProxy(bytes);
      const result = await extractText(pdf);
      pages = result.text.map((content, index) => ({ pageLabel: `Page ${index + 1}`, content }));
    } catch (error) {
      throw safePdfExtractionError(error);
    } finally {
      await pdf?.destroy().catch(() => undefined);
    }
  }
  return { id: stableId(file.name, bytes), title: file.name, content: boundedContent(pages), pages };
}

export async function extractDocuments(files: File[]): Promise<ExtractedDocument[]> {
  if (files.length < 1) throw new DocumentExtractionError("EMPTY_DOCUMENT", "Choose at least one TXT or PDF file.");
  if (files.length > MAX_DOCUMENTS) throw new DocumentExtractionError("TOO_MANY_DOCUMENTS", "You can analyze at most 8 documents.");
  const documents = await Promise.all(files.map(extractDocument));
  if (new Set(documents.map((document) => document.id)).size !== documents.length) {
    throw new DocumentExtractionError("UNREADABLE_PDF", "Duplicate documents are not allowed.");
  }
  return documents;
}
