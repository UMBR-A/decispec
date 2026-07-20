export const DRAFT_MEMO_DOCUMENT_ID = "draft-memo";

export type SourceSectionMetadata = {
  heading: string;
  start: number;
  end: number;
};

export type SegmentableDocument = {
  id: string;
  title: string;
  content: string;
  pageLabel?: string | null;
  sections?: SourceSectionMetadata[];
};

export type SegmentableInput = {
  documents: SegmentableDocument[];
  draftMemo: string;
  draftMemoMetadata?: {
    documentId: string;
    title: string;
    pageLabel: string | null;
    sections: SourceSectionMetadata[];
  };
};

export type SourceSegmentType = "paragraph" | "sentence" | "clause" | "numeric-evidence";

export type SourceSegment = {
  id: string;
  documentId: string;
  content: string;
  normalizedContent: string;
  start: number;
  end: number;
  pageLabel: string | null;
  section: string | null;
  type: SourceSegmentType;
  ordinal: number;
};

export type SourceSegmentDocument = {
  id: string;
  title: string;
  content: string;
};

export type SourceSegmentRegistry = {
  segments: SourceSegment[];
  byId: Map<string, SourceSegment>;
  documents: Map<string, SourceSegmentDocument>;
};

const SEGMENT_TYPE_CODE: Record<SourceSegmentType, string> = {
  paragraph: "p",
  sentence: "s",
  clause: "c",
  "numeric-evidence": "n",
};

function normalizeForAnalysis(value: string): string {
  return value.normalize("NFKC").replace(/\r\n?/g, "\n").replace(/[\t\f\v ]+/g, " ").trim();
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function safeIdPart(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 28) || "document";
}

function trimRange(content: string, start: number, end: number): { start: number; end: number } | null {
  while (start < end && /\s/u.test(content[start])) start += 1;
  while (end > start && /\s/u.test(content[end - 1])) end -= 1;
  return end > start ? { start, end } : null;
}

type PageRange = { start: number; end: number; pageLabel: string | null };

function pageRanges(document: SegmentableDocument): PageRange[] {
  const markers = [...document.content.matchAll(/^\[([^\]\r\n]+)\][ \t]*(?:\r?\n|$)/gm)];
  if (markers.length === 0) return [{ start: 0, end: document.content.length, pageLabel: document.pageLabel ?? null }];
  return markers.map((marker, index) => ({
    start: (marker.index ?? 0) + marker[0].length,
    end: markers[index + 1]?.index ?? document.content.length,
    pageLabel: marker[1],
  }));
}

function sectionAt(document: SegmentableDocument, start: number, end: number): string | null {
  const section = document.sections?.find((candidate) => start >= candidate.start && end <= candidate.end);
  return section?.heading ?? null;
}

type Candidate = { start: number; end: number; type: SourceSegmentType; pageLabel: string | null; section: string | null };

function addCandidate(candidates: Candidate[], document: SegmentableDocument, page: PageRange, start: number, end: number, type: SourceSegmentType): void {
  const trimmed = trimRange(document.content, Math.max(start, page.start), Math.min(end, page.end));
  if (!trimmed) return;
  candidates.push({ ...trimmed, type, pageLabel: page.pageLabel, section: sectionAt(document, trimmed.start, trimmed.end) });
}

const NUMERIC_ATOM_PATTERNS = [
  /\$\d[\d,]*(?:\.\d+)?\s+per\s+device\s+per\s+(?:month|year)/gi,
  /\$\d[\d,]*(?:\.\d+)?\s+per\s+device/gi,
  /\$\d[\d,]*(?:\.\d+)?\s+per\s+(?:month|year)/gi,
  /(?:one-time\s+fee\s+of\s+)?\$\d[\d,]*(?:\.\d+)?/gi,
  /\d+(?:\.\d+)?%/g,
  /\d[\d,]*(?:\.\d+)?\s+(?:students?|devices?|months?|years?)/gi,
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:-|\s+)(?:months?|years?)\b/gi,
];

function segmentDocument(document: SegmentableDocument): SourceSegment[] {
  const candidates: Candidate[] = [];
  for (const page of pageRanges(document)) {
    const pageText = document.content.slice(page.start, page.end);
    for (const match of pageText.matchAll(/[^\r\n]+(?:\r?\n(?!\s*\r?\n)[^\r\n]+)*/g)) {
      const start = page.start + (match.index ?? 0);
      addCandidate(candidates, document, page, start, start + match[0].length, "paragraph");
    }
    for (const match of pageText.matchAll(/[^.!?\r\n]+(?:[.!?]+|$)/g)) {
      const start = page.start + (match.index ?? 0);
      const end = start + match[0].length;
      addCandidate(candidates, document, page, start, end, "sentence");
      const sentence = document.content.slice(start, end);
      for (const clause of sentence.matchAll(/[^;,]+(?:[;,]|$)/g)) {
        const clauseStart = start + (clause.index ?? 0);
        addCandidate(candidates, document, page, clauseStart, clauseStart + clause[0].length, "clause");
      }
    }
    for (const pattern of NUMERIC_ATOM_PATTERNS) {
      for (const match of pageText.matchAll(pattern)) {
        const start = page.start + (match.index ?? 0);
        addCandidate(candidates, document, page, start, start + match[0].length, "numeric-evidence");
      }
    }
  }

  const unique = [...new Map(candidates.map((candidate) => [`${candidate.type}:${candidate.start}:${candidate.end}`, candidate])).values()]
    .sort((left, right) => left.start - right.start || left.end - right.end || left.type.localeCompare(right.type));
  const ordinals = new Map<SourceSegmentType, number>();
  return unique.map((candidate) => {
    const ordinal = (ordinals.get(candidate.type) ?? 0) + 1;
    ordinals.set(candidate.type, ordinal);
    const content = document.content.slice(candidate.start, candidate.end);
    const id = `${safeIdPart(document.id)}:${SEGMENT_TYPE_CODE[candidate.type]}${String(ordinal).padStart(3, "0")}:${stableHash(`${document.id}\u0000${candidate.type}\u0000${content}`)}`;
    return {
      id,
      documentId: document.id,
      content,
      normalizedContent: normalizeForAnalysis(content),
      start: candidate.start,
      end: candidate.end,
      pageLabel: candidate.pageLabel,
      section: candidate.section,
      type: candidate.type,
      ordinal,
    };
  });
}

export function sourceDocuments(input: SegmentableInput): SegmentableDocument[] {
  const memo = input.draftMemoMetadata ?? {
    documentId: DRAFT_MEMO_DOCUMENT_ID,
    title: "Draft recommendation memo",
    pageLabel: null,
    sections: [],
  };
  return [
    ...input.documents,
    { id: memo.documentId, title: memo.title, content: input.draftMemo, pageLabel: memo.pageLabel, sections: memo.sections },
  ];
}

export function buildSourceSegmentRegistry(input: SegmentableInput): SourceSegmentRegistry {
  const documents = sourceDocuments(input);
  const segments = documents.flatMap(segmentDocument);
  return {
    segments,
    byId: new Map(segments.map((segment) => [segment.id, segment])),
    documents: new Map(documents.map((document) => [document.id, { id: document.id, title: document.title, content: document.content }])),
  };
}

export function providerSegmentRecords(registry: SourceSegmentRegistry) {
  return registry.segments.map((segment) => ({
    segmentId: segment.id,
    documentId: segment.documentId,
    pageLabel: segment.pageLabel,
    section: segment.section,
    segmentType: segment.type,
    content: segment.content,
  }));
}
