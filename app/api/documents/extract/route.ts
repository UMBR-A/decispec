import { NextResponse } from "next/server";
import { DocumentExtractionError, extractDocuments } from "../../../../lib/documents/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
    const documents = await extractDocuments(files);
    return NextResponse.json({ documents }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DocumentExtractionError) {
      const status = error.code === "FILE_TOO_LARGE" || error.code === "TOO_MANY_DOCUMENTS" ? 413 : 422;
      return NextResponse.json({ error: error.message, code: error.code }, { status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Document extraction could not be completed.", code: "UNREADABLE_PDF" }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
