import { z } from "zod";
import {
  ClaimTypeSchema,
  DecisionGraphSchema,
  SourceSpanSchema,
  UnitSchema,
  type CalculationSpec,
  type Unit,
} from "../domain/schemas";
import { DEMO_PROJECT_ID, demoProject } from "../demo/fixture";
import { inferCalculationOutputUnit } from "../domain/engine";
import { recoverSourceFact, type SourceNumericRole } from "./source-unit-recovery";
import {
  buildSourceSegmentRegistry,
  type SourceSegment,
  type SourceSegmentRegistry,
} from "./source-segments";
import {
  SafeValidationError,
  diagnosticId,
  failValidation,
  safeSchemaDiagnostic,
  type SafeValidationDiagnostic,
} from "./safe-validation";

export const NormalizedDocumentSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(120_000),
  pageLabel: z.string().nullable().optional(),
  sections: z.array(z.object({ heading: z.string().min(1), start: z.number().int().nonnegative(), end: z.number().int().positive() })).optional(),
});

export const AnalysisInputSchema = z.object({
  fixtureId: z.string().optional(),
  documents: z.array(NormalizedDocumentSchema).min(1).max(8),
  draftMemo: z.string().min(1).max(120_000),
  draftMemoMetadata: z.object({
    documentId: z.string().min(1).max(80),
    title: z.string().min(1).max(200),
    pageLabel: z.string().nullable(),
    sections: z.array(z.object({ heading: z.string().min(1), start: z.number().int().nonnegative(), end: z.number().int().positive() })),
  }).optional(),
}).superRefine((input, context) => {
  const totalCharacters = input.documents.reduce((total, document) => total + document.content.length, 0) + input.draftMemo.length;
  if (totalCharacters > 320_000) context.addIssue({ code: "custom", message: "Combined analysis input exceeds 320,000 characters." });
  if (new Set(input.documents.map((document) => document.id)).size !== input.documents.length) context.addIssue({ code: "custom", message: "Document IDs must be unique." });
});

const ProviderIdentifierSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/);
const ProviderSegmentIdentifierSchema = z.string().regex(/^[a-z0-9_-]+:[pscn]\d{3}:[0-9a-f]{8}$/);

export const ProviderSourceBindingSchema = z.object({
  bindingId: ProviderIdentifierSchema,
  documentId: ProviderIdentifierSchema,
  segmentIds: z.array(ProviderSegmentIdentifierSchema).min(1),
  semanticRole: z.enum(["fact", "policy", "recommendation", "context"]),
  emphasisSegmentIds: z.array(ProviderSegmentIdentifierSchema).nullable(),
}).strict();

const ProviderOperandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ref"), nodeId: z.string().min(1) }),
  z.object({
    kind: z.literal("literal"),
    value: z.number(),
    unit: UnitSchema,
    label: z.string().nullable(),
  }),
]);

const ProviderArithmeticCalculationSchema = z.object({
  operation: z.enum(["add", "subtract", "multiply", "divide", "percentage-adjustment", "compare-lower"]),
  operands: z.array(ProviderOperandSchema).min(2),
  outputUnit: UnitSchema,
  displayFormula: z.string().min(1),
});

const ProviderCandidateSelectionSchema = z.object({
  operation: z.literal("select-candidate"),
  candidates: z.array(z.object({
    label: z.string().min(1).describe("Canonical candidate label; reuse this exact string in graph.recommendation.original and graph.recommendation.corrected."),
    valueNodeId: z.string().min(1),
    maximumValueNodeId: z.string().min(1),
  })).min(2),
  selectionDirection: z.literal("minimum"),
  tieResult: z.string().nullable(),
  outputUnit: z.literal("recommendation"),
  displayFormula: z.string().min(1),
});

const ProviderDurationConversionSchema = z.object({
  operation: z.literal("convert-duration"),
  inputNodeId: z.string().min(1),
  fromUnit: z.enum(["month", "year"]),
  toUnit: z.enum(["month", "year"]),
  outputUnit: z.enum(["month", "year"]),
  displayFormula: z.string().min(1),
});

const ProviderCalculationSchema = z.discriminatedUnion("operation", [
  ProviderArithmeticCalculationSchema,
  ProviderCandidateSelectionSchema,
  ProviderDurationConversionSchema,
]);

const ProviderUnitSpecSchema = z.object({
  unit: UnitSchema,
});

const ProviderNumericRoleSchema = z.enum([
  "currency",
  "per-device-rate",
  "recurring-rate",
  "duration",
  "percentage",
  "quantity",
  "scalar",
]);

const ProviderClaimNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  statement: z.string().min(1),
  type: ClaimTypeSchema,
  value: z.union([z.number(), z.string()]).nullable(),
  unitSpec: ProviderUnitSpecSchema,
  numericRole: ProviderNumericRoleSchema.nullable(),
  sourceSpanIds: z.array(z.string()),
  calculation: ProviderCalculationSchema.nullable(),
});

const ProviderDependencyEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.enum(["calculation-input", "semantic", "policy", "evidence-support"]).nullable(),
  label: z.string().nullable(),
});

const ProviderCorrectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  targetNodeId: z.string().min(1),
  replacementCalculation: ProviderArithmeticCalculationSchema,
});

export const ProviderAnalysisPlanSchema = z.object({
  sourceBindings: z.array(ProviderSourceBindingSchema).min(1),
  graph: z.object({
    id: z.string().min(1),
    nodes: z.array(ProviderClaimNodeSchema).min(1),
    edges: z.array(ProviderDependencyEdgeSchema),
    recommendation: z.object({
      nodeId: z.string().min(1),
      original: z.string().min(1).describe("Exact candidate label recommended by the draft memo; must byte-for-byte equal one select-candidate label."),
      corrected: z.string().min(1).describe("Exact candidate label proposed after the correction; must byte-for-byte equal one select-candidate label. Local execution decides whether it wins."),
    }),
    corrections: z.array(ProviderCorrectionSchema),
  }),
});

export const AnalysisPlanSchema = z.object({
  sourceSpans: z.array(SourceSpanSchema).min(1),
  graph: DecisionGraphSchema,
});

export type NormalizedDocument = z.infer<typeof NormalizedDocumentSchema>;
export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;
export type ProviderAnalysisPlan = z.infer<typeof ProviderAnalysisPlanSchema>;
export type AnalysisPlan = z.infer<typeof AnalysisPlanSchema>;
export type ProviderMode = "deterministic-demo" | "live-openai";
export type AnalysisUsage = { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
export type AnalysisResult = {
  plan: AnalysisPlan;
  provider: { name: string; mode: ProviderMode; model: string | null };
  usage: AnalysisUsage | null;
  requestId: string | null;
  latencyMs: number | null;
};

export interface AnalysisProvider {
  readonly name: string;
  readonly mode: ProviderMode;
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
}

export class AnalysisProviderError extends Error {
  constructor(
    readonly code: "configuration" | "transport" | "authentication" | "quota" | "rate_limit" | "model_access" | "timeout" | "refusal" | "schema_rejection" | "validation_rejection" | "upstream",
    message: string,
    options?: ErrorOptions & {
      requestId?: string | null;
      responseReceived?: boolean;
      usage?: AnalysisUsage | null;
      latencyMs?: number | null;
      diagnostic?: SafeValidationDiagnostic;
      internalReason?: import("../domain/calculation-contract").CalculationFailureReason;
    },
  ) {
    super(message, options);
    this.name = "AnalysisProviderError";
    this.requestId = options?.requestId ?? null;
    this.responseReceived = options?.responseReceived ?? false;
    this.usage = options?.usage ?? null;
    this.latencyMs = options?.latencyMs ?? null;
    this.diagnostic = options?.diagnostic;
    this.internalReason = options?.internalReason;
  }

  readonly requestId: string | null;
  readonly responseReceived: boolean;
  readonly usage: AnalysisUsage | null;
  readonly latencyMs: number | null;
  readonly diagnostic?: SafeValidationDiagnostic;
  readonly internalReason?: import("../domain/calculation-contract").CalculationFailureReason;
}

function calculationToDomain(calculation: z.infer<typeof ProviderCalculationSchema>): CalculationSpec {
  if (calculation.operation === "select-candidate" || calculation.operation === "convert-duration") return calculation;
  return {
    ...calculation,
    operands: calculation.operands.map((operand) => operand.kind === "ref"
      ? operand
      : { ...operand, label: operand.label ?? undefined }),
  };
}

function proposalToPlan(proposal: ProviderAnalysisPlan, sourceSpans: z.infer<typeof SourceSpanSchema>[], providerUnitCorrections: Map<string, boolean>): AnalysisPlan {
  return AnalysisPlanSchema.parse({
    sourceSpans,
    graph: {
      ...proposal.graph,
      nodes: proposal.graph.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        statement: node.statement,
        type: node.type,
        status: "pending",
        statusReason: "Awaiting deterministic evaluation.",
        value: node.calculation === null ? node.value ?? undefined : undefined,
        unitSpec: node.unitSpec,
        providerUnitCorrected: providerUnitCorrections.get(node.id) ?? false,
        sourceSpanIds: node.sourceSpanIds,
        calculation: node.calculation === null ? undefined : calculationToDomain(node.calculation),
        tests: [],
      })),
      edges: proposal.graph.edges.map((edge) => ({ ...edge, kind: edge.kind ?? "semantic", label: edge.label ?? undefined })),
      corrections: proposal.graph.corrections.map((correction) => ({
        ...correction,
        replacementCalculation: calculationToDomain(correction.replacementCalculation),
      })),
    },
  });
}

function setLocallyDerivedOutputUnit(
  calculation: z.infer<typeof ProviderCalculationSchema>,
  unit: Unit,
): void {
  if (calculation.operation === "select-candidate") {
    calculation.outputUnit = "recommendation";
    return;
  }
  if (calculation.operation === "convert-duration") {
    calculation.outputUnit = calculation.toUnit;
    return;
  }
  calculation.outputUnit = unit;
}

function canonicalizeDerivedUnits(proposal: ProviderAnalysisPlan, providerUnitCorrections: Map<string, boolean>): void {
  const nodes = new Map(proposal.graph.nodes.map((node) => [node.id, node]));
  const indegree = new Map(proposal.graph.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(proposal.graph.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of proposal.graph.edges) {
    if (!indegree.has(edge.to) || !outgoing.has(edge.from)) continue;
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }
  const queue = proposal.graph.nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  for (const id of order) {
    const node = nodes.get(id);
    if (!node?.calculation) continue;
    const inferred = inferCalculationOutputUnit(calculationToDomain(node.calculation), nodes);
    if (inferred === null) continue;
    const corrected = node.unitSpec.unit !== inferred || node.calculation.outputUnit !== inferred;
    providerUnitCorrections.set(node.id, (providerUnitCorrections.get(node.id) ?? false) || corrected);
    node.unitSpec = { unit: inferred };
    setLocallyDerivedOutputUnit(node.calculation, inferred);
  }
  for (const correction of proposal.graph.corrections) {
    const inferred = inferCalculationOutputUnit(calculationToDomain(correction.replacementCalculation), nodes);
    if (inferred !== null) correction.replacementCalculation.outputUnit = inferred;
  }
}

export type SourceNumericValue =
  | { value: number; kind: "plain" | "currency" | "percent" }
  | { value: number; kind: "period"; periodUnit: "month" | "year" };

const LEXICAL_PERIOD_VALUES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

export function extractSourceNumericValues(text: string): SourceNumericValue[] {
  const numeric = [...text.matchAll(/[-+]?\$?\d[\d,]*(?:\.\d+)?%?/g)].flatMap((match) => {
    const raw = match[0];
    const value = Number(raw.replace(/[$,%]/g, ""));
    if (!Number.isFinite(value)) return [];
    return [{ value, kind: raw.endsWith("%") ? "percent" as const : raw.includes("$") ? "currency" as const : "plain" as const }];
  });
  const lexicalPeriods: SourceNumericValue[] = [...text.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:-|\s+)(months?|years?)\b/gi)].map((match) => ({
    value: LEXICAL_PERIOD_VALUES[match[1].toLowerCase()],
    kind: "period",
    periodUnit: match[2].toLowerCase().startsWith("month") ? "month" : "year",
  }));
  return [...numeric, ...lexicalPeriods];
}

export function extractNormalizedNumbers(text: string): number[] {
  return extractSourceNumericValues(text).map((number) => number.kind === "percent" ? number.value / 100 : number.value);
}

const CURRENCY_UNITS = new Set<Unit>(["currency", "currency-per-device", "currency-per-device-per-month", "three-year-total"]);

export function isSourceNumericValueBound(value: number, unit: Unit, source: SourceNumericValue): boolean {
  if (source.kind === "period") return unit === source.periodUnit && value === source.value;
  if (source.kind === "percent") {
    if (unit === "percent") return value === source.value;
    if (unit === "ratio") return value === source.value / 100;
    return false;
  }
  if (source.kind === "currency") return CURRENCY_UNITS.has(unit) && value === source.value;
  if (unit === "percent" || unit === "ratio" || CURRENCY_UNITS.has(unit)) return false;
  return value === source.value;
}

function parseProviderProposal(rawProposal: unknown): ProviderAnalysisPlan {
  try {
    const proposal = structuredClone(rawProposal) as { graph?: { edges?: Array<Record<string, unknown>> } };
    for (const edge of proposal?.graph?.edges ?? []) {
      if (!("kind" in edge)) edge.kind = null;
    }
    return ProviderAnalysisPlanSchema.parse(proposal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const diagnostic = safeSchemaDiagnostic(error);
      failValidation(diagnostic, diagnostic.code === "UNSUPPORTED_OPERATION" ? "UNSUPPORTED_OPERATION" : undefined);
    }
    throw error;
  }
}

type MaterializedSourceBinding = {
  span: z.infer<typeof SourceSpanSchema>;
  segments: SourceSegment[];
};

function resolveBindingSegments(
  registry: SourceSegmentRegistry,
  documentId: string,
  segmentIds: string[],
  path: string,
  bindingId: string,
): SourceSegment[] {
  const segments = segmentIds.map((segmentId, index) => {
    const segment = registry.byId.get(segmentId);
    if (!segment) {
      failValidation({ stage: "source-spans", code: "UNKNOWN_SOURCE_SEGMENT", path: `${path}[${index}]`, id: diagnosticId(bindingId), counts: { referencedSegments: segmentIds.length } });
    }
    if (segment.documentId !== documentId) {
      failValidation({ stage: "source-spans", code: "SEGMENT_DOCUMENT_MISMATCH", path: `${path}[${index}]`, id: diagnosticId(bindingId), state: { documentMatches: false } });
    }
    return segment;
  });
  for (let index = 1; index < segments.length; index += 1) {
    if (segments[index].start <= segments[index - 1].start) {
      failValidation({ stage: "source-spans", code: "INVALID_SEGMENT_ORDER", path, id: diagnosticId(bindingId), counts: { referencedSegments: segments.length } });
    }
    if (segments[index - 1].end !== segments[index].start) {
      failValidation({ stage: "source-spans", code: "NONCONTIGUOUS_SOURCE_SEGMENTS", path, id: diagnosticId(bindingId), counts: { referencedSegments: segments.length } });
    }
  }
  return segments;
}

function materializeSourceBindings(proposal: ProviderAnalysisPlan, input: AnalysisInput): {
  sourceSpans: z.infer<typeof SourceSpanSchema>[];
  bindings: Map<string, MaterializedSourceBinding>;
} {
  const registry = buildSourceSegmentRegistry(input);
  const bindings = new Map<string, MaterializedSourceBinding>();
  const sourceSpans: z.infer<typeof SourceSpanSchema>[] = [];
  for (const [bindingIndex, binding] of proposal.sourceBindings.entries()) {
    const bindingPath = `$.sourceBindings[${bindingIndex}]`;
    if (bindings.has(binding.bindingId)) {
      failValidation({ stage: "source-spans", code: "DUPLICATE_SPAN_ID", path: `${bindingPath}.bindingId`, id: diagnosticId(binding.bindingId) });
    }
    const document = registry.documents.get(binding.documentId);
    if (!document) {
      failValidation({ stage: "source-spans", code: "UNKNOWN_DOCUMENT", path: `${bindingPath}.documentId`, id: diagnosticId(binding.documentId) });
    }
    const segments = resolveBindingSegments(registry, binding.documentId, binding.segmentIds, `${bindingPath}.segmentIds`, binding.bindingId);
    const first = segments[0];
    const last = segments.at(-1)!;
    let emphasis: string | null = null;
    if (binding.emphasisSegmentIds !== null) {
      const emphasisSegments = resolveBindingSegments(registry, binding.documentId, binding.emphasisSegmentIds, `${bindingPath}.emphasisSegmentIds`, binding.bindingId);
      const emphasisFirst = emphasisSegments[0];
      const emphasisLast = emphasisSegments.at(-1)!;
      if (emphasisFirst.start < first.start || emphasisLast.end > last.end) {
        failValidation({ stage: "source-spans", code: "NONCONTIGUOUS_SOURCE_SEGMENTS", path: `${bindingPath}.emphasisSegmentIds`, id: diagnosticId(binding.bindingId), state: { containedByBinding: false } });
      }
      emphasis = document.content.slice(emphasisFirst.start, emphasisLast.end);
    }
    const span = SourceSpanSchema.parse({
      id: binding.bindingId,
      documentId: binding.documentId,
      pageLabel: first.pageLabel ?? document.title,
      section: first.section ?? first.type,
      quote: document.content.slice(first.start, last.end),
      emphasis,
    });
    bindings.set(binding.bindingId, { span, segments });
    sourceSpans.push(span);
  }
  return { sourceSpans, bindings };
}

type ProviderEdgeKind = NonNullable<z.infer<typeof ProviderDependencyEdgeSchema>["kind"]>;

function providerCalculationDependencies(calculation: z.infer<typeof ProviderCalculationSchema> | null): Array<{ nodeId: string; kind: ProviderEdgeKind }> {
  if (!calculation) return [];
  if (calculation.operation === "select-candidate") {
    return [...new Map(calculation.candidates.flatMap((candidate) => [
      { nodeId: candidate.valueNodeId, kind: "calculation-input" as const },
      { nodeId: candidate.maximumValueNodeId, kind: "policy" as const },
    ]).map((descriptor) => [`${descriptor.kind}:${descriptor.nodeId}`, descriptor])).values()];
  }
  if (calculation.operation === "convert-duration") return [{ nodeId: calculation.inputNodeId, kind: "calculation-input" }];
  return [...new Map(calculation.operands.flatMap((operand) => operand.kind === "ref" ? [{ nodeId: operand.nodeId, kind: "calculation-input" as const }] : []).map((descriptor) => [descriptor.nodeId, descriptor])).values()];
}

function materializeProviderDependencies(proposal: ProviderAnalysisPlan, nodeIds: Set<string>): void {
  const required = new Map<string, { from: string; to: string; kind: ProviderEdgeKind }>();
  for (const node of proposal.graph.nodes) {
    for (const descriptor of providerCalculationDependencies(node.calculation)) {
      if (!nodeIds.has(descriptor.nodeId)) {
        failValidation({
          stage: "dependencies",
          code: node.calculation?.operation === "select-candidate"
            ? descriptor.kind === "calculation-input" ? "RECOMMENDATION_CANDIDATE_DEPENDENCY_MISSING" : "POLICY_REFERENCE_MISSING"
            : "CALCULATION_OPERAND_NODE_MISSING",
          path: `$.graph.nodes[*].calculation`,
          id: diagnosticId(node.id),
          counts: { missingReferences: 1 },
        }, "UNDECLARED_DEPENDENCY");
      }
      if (descriptor.nodeId === node.id) {
        failValidation({ stage: "edges", code: "INVALID_EDGE", path: "$.graph.nodes[*].calculation", id: diagnosticId(node.id), state: { selfReference: true } }, "INVALID_OPERAND");
      }
      required.set(JSON.stringify([descriptor.nodeId, node.id]), { from: descriptor.nodeId, to: node.id, kind: descriptor.kind });
    }
  }

  const edgeIds = new Set<string>();
  const deduplicated = new Map<string, z.infer<typeof ProviderDependencyEdgeSchema>>();
  for (const edge of proposal.graph.edges) {
    if (edgeIds.has(edge.id)) failValidation({ stage: "edges", code: "INVALID_EDGE", path: "$.graph.edges[*].id", id: diagnosticId(edge.id) });
    edgeIds.add(edge.id);
    const relationship = JSON.stringify([edge.from, edge.to]);
    const kind = edge.kind ?? required.get(relationship)?.kind ?? "semantic";
    const normalized = { ...edge, kind };
    const key = JSON.stringify([edge.from, edge.to, kind]);
    if (!deduplicated.has(key)) deduplicated.set(key, normalized);
  }
  proposal.graph.edges = [...deduplicated.values()];
  const edgeKeys = new Set(proposal.graph.edges.map((edge) => JSON.stringify([edge.from, edge.to, edge.kind])));
  for (const { from, to, kind } of required.values()) {
    const key = JSON.stringify([from, to, kind]);
    if (edgeKeys.has(key)) continue;
    const baseId = `assert-${kind}-${from}-${to}`;
    let id = baseId;
    for (let suffix = 1; edgeIds.has(id); suffix += 1) id = `${baseId}-${suffix}`;
    edgeIds.add(id);
    proposal.graph.edges.push({ id, from, to, kind, label: null });
    edgeKeys.add(key);
  }
}

function validateGraphStructure(proposal: ProviderAnalysisPlan, nodeIds: Set<string>): void {
  const nodes = new Map(proposal.graph.nodes.map((node) => [node.id, node]));
  const edgeIds = new Set<string>();
  const edgeKeys = new Set<string>();
  for (const [edgeIndex, edge] of proposal.graph.edges.entries()) {
    const path = `$.graph.edges[${edgeIndex}]`;
    if (edgeIds.has(edge.id) || edge.from === edge.to) {
      failValidation({ stage: "edges", code: "INVALID_EDGE", path, id: diagnosticId(edge.id) });
    }
    edgeIds.add(edge.id);
    edgeKeys.add(JSON.stringify([edge.from, edge.to, edge.kind]));
  }

  for (const [nodeIndex, node] of proposal.graph.nodes.entries()) {
    const calculationPath = `$.graph.nodes[${nodeIndex}].calculation`;
    if (node.calculation?.operation === "percentage-adjustment") {
      if (node.calculation.operands.length !== 2) {
        failValidation({ stage: "calculations", code: "INVALID_CALCULATION", path: `${calculationPath}.operands`, id: diagnosticId(node.id), counts: { operands: node.calculation.operands.length } }, "INVALID_OPERAND");
      }
      const adjustment = node.calculation.operands[1];
      const adjustmentUnit = adjustment.kind === "literal" ? adjustment.unit : nodes.get(adjustment.nodeId)?.unitSpec.unit;
      if (adjustmentUnit !== "percent" && adjustmentUnit !== "ratio") {
        failValidation({ stage: "units", code: "INVALID_UNIT", path: `${calculationPath}.operands[1]`, id: diagnosticId(node.id) }, "INPUT_TYPE_MISMATCH");
      }
    }

    if (node.calculation?.operation === "select-candidate") {
      const labels = new Set(node.calculation.candidates.map((candidate) => candidate.label));
      if (labels.size !== node.calculation.candidates.length || (node.calculation.tieResult !== null && !labels.has(node.calculation.tieResult))) {
        failValidation({ stage: "recommendation", code: "CANDIDATE_LABEL_MISMATCH", path: `${calculationPath}.tieResult`, id: diagnosticId(node.id), counts: { candidates: node.calculation.candidates.length, uniqueLabels: labels.size } }, "NONDETERMINISTIC_SELECTION");
      }
      for (const [candidateIndex, candidate] of node.calculation.candidates.entries()) {
        const candidatePath = `${calculationPath}.candidates[${candidateIndex}]`;
        const valueNode = nodes.get(candidate.valueNodeId);
        const maximumNode = nodes.get(candidate.maximumValueNodeId);
        if (!valueNode) {
          failValidation({ stage: "dependencies", code: "INVALID_CANDIDATE_REFERENCE", path: `${candidatePath}.valueNodeId`, id: diagnosticId(node.id) }, "UNDECLARED_DEPENDENCY");
        }
        if (!maximumNode) {
          failValidation({ stage: "recommendation", code: "POLICY_REFERENCE_MISSING", path: `${candidatePath}.maximumValueNodeId`, id: diagnosticId(node.id) }, "UNDECLARED_DEPENDENCY");
        }
        const valueIsNumeric = valueNode.calculation !== null && valueNode.calculation.outputUnit !== "recommendation" && (valueNode.unitSpec.unit === "currency" || valueNode.unitSpec.unit === "three-year-total");
        const maximumIsNumericPolicy = maximumNode.type === "policy" && typeof maximumNode.value === "number";
        if (!valueIsNumeric) {
          failValidation({ stage: "calculations", code: "CANDIDATE_VALUE_NOT_CALCULATED", path: `${candidatePath}.valueNodeId`, id: diagnosticId(node.id) }, "INPUT_TYPE_MISMATCH");
        }
        if (!maximumIsNumericPolicy) {
          failValidation({ stage: "recommendation", code: "POLICY_REFERENCE_MISSING", path: `${candidatePath}.maximumValueNodeId`, id: diagnosticId(node.id) }, "INPUT_TYPE_MISMATCH");
        }
        if (!edgeKeys.has(JSON.stringify([candidate.valueNodeId, node.id, "calculation-input"]))) {
          failValidation({ stage: "edges", code: "CANDIDATE_NOT_DECLARED_DEPENDENCY", path: `${candidatePath}.valueNodeId`, id: diagnosticId(node.id) }, "UNDECLARED_DEPENDENCY");
        }
        if (!edgeKeys.has(JSON.stringify([candidate.maximumValueNodeId, node.id, "policy"]))) {
          failValidation({ stage: "edges", code: "POLICY_REFERENCE_MISSING", path: `${candidatePath}.maximumValueNodeId`, id: diagnosticId(node.id) }, "UNDECLARED_DEPENDENCY");
        }
      }
    } else if (node.calculation?.operation === "convert-duration") {
      const dependencyId = node.calculation.inputNodeId;
      if (!nodeIds.has(dependencyId)) {
        failValidation({ stage: "dependencies", code: "UNKNOWN_DEPENDENCY", path: `${calculationPath}.inputNodeId`, id: diagnosticId(node.id) }, "UNDECLARED_DEPENDENCY");
      }
      if (!edgeKeys.has(JSON.stringify([dependencyId, node.id, "calculation-input"]))) {
        failValidation({ stage: "edges", code: "INVALID_EDGE", path: `${calculationPath}.inputNodeId`, id: diagnosticId(node.id) }, "UNDECLARED_DEPENDENCY");
      }
      const input = nodes.get(dependencyId);
      if (!input || input.unitSpec.unit !== node.calculation.fromUnit || node.calculation.toUnit !== node.calculation.outputUnit || node.calculation.fromUnit === node.calculation.toUnit) {
        failValidation({ stage: "units", code: input && ["month", "year"].includes(input.unitSpec.unit) && input.unitSpec.unit !== node.calculation.fromUnit ? "DURATION_UNIT_CONFLICT" : "IMPLICIT_UNIT_CONVERSION", path: calculationPath, id: diagnosticId(node.id), state: { inputUnitMatches: input?.unitSpec.unit === node.calculation.fromUnit, outputUnitMatches: node.calculation.toUnit === node.calculation.outputUnit } }, "INPUT_TYPE_MISMATCH");
      }
    } else {
      const arithmetic = node.calculation;
      if (arithmetic) {
        const referencesRecurringRate = arithmetic.operands.some((operand) => operand.kind === "ref" && nodes.get(operand.nodeId)?.unitSpec.unit === "currency-per-device-per-month");
        const hasDuration = arithmetic.operands.some((operand) => operand.kind === "literal" ? operand.unit === "month" || operand.unit === "year" : ["month", "year"].includes(nodes.get(operand.nodeId)?.unitSpec.unit ?? ""));
        const hasBareDuration = arithmetic.operands.some((operand) => operand.kind === "literal" && operand.unit === "scalar");
        if (referencesRecurringRate && !hasDuration && hasBareDuration) {
          failValidation({ stage: "units", code: "DURATION_UNIT_MISSING", path: `${calculationPath}.operands`, id: diagnosticId(node.id), state: { durationUnitPresent: false } }, "INPUT_TYPE_MISMATCH");
        }
      }
      for (const [operandIndex, operand] of (node.calculation?.operands ?? []).entries()) {
        if (operand.kind !== "ref") continue;
        const path = `${calculationPath}.operands[${operandIndex}].nodeId`;
        if (!nodeIds.has(operand.nodeId)) {
          failValidation({ stage: "dependencies", code: "UNKNOWN_DEPENDENCY", path, id: diagnosticId(node.id) }, "UNDECLARED_DEPENDENCY");
        }
        if (!edgeKeys.has(JSON.stringify([operand.nodeId, node.id, "calculation-input"]))) {
          failValidation({ stage: "edges", code: "INVALID_EDGE", path, id: diagnosticId(node.id) }, "UNDECLARED_DEPENDENCY");
        }
      }
    }
  }

  for (const [edgeIndex, edge] of proposal.graph.edges.entries()) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      failValidation({ stage: "edges", code: "INVALID_EDGE", path: `$.graph.edges[${edgeIndex}]`, id: diagnosticId(edge.id) });
    }
  }

  const indegree = new Map(proposal.graph.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(proposal.graph.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of proposal.graph.edges) {
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }
  const queue = proposal.graph.nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited += 1;
    for (const next of outgoing.get(current) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  if (visited !== proposal.graph.nodes.length) {
    failValidation({ stage: "graph", code: "GRAPH_CYCLE", path: "$.graph.edges", counts: { nodes: proposal.graph.nodes.length, visited } });
  }
}

export function validateProviderProposal(rawProposal: unknown, rawInput: AnalysisInput): AnalysisPlan {
  const input = AnalysisInputSchema.parse(rawInput);
  const proposal = parseProviderProposal(rawProposal);
  const { sourceSpans, bindings } = materializeSourceBindings(proposal, input);
  const spans = new Map(sourceSpans.map((span) => [span.id, span]));
  const nodeIds = new Set<string>();
  const correctionTargetIds = new Set(proposal.graph.corrections.map((correction) => correction.targetNodeId));
  const providerUnitCorrections = new Map<string, boolean>();

  for (const [nodeIndex, node] of proposal.graph.nodes.entries()) {
    const nodePath = `$.graph.nodes[${nodeIndex}]`;
    if (nodeIds.has(node.id)) failValidation({ stage: "nodes", code: "DUPLICATE_NODE_ID", path: `${nodePath}.id`, id: diagnosticId(node.id) });
    nodeIds.add(node.id);
    for (const sourceSpanId of node.sourceSpanIds) {
      if (!spans.has(sourceSpanId)) failValidation({ stage: "source-spans", code: "SOURCE_BINDING_MISSING", path: `${nodePath}.sourceSpanIds`, id: diagnosticId(node.id), counts: { missingBindings: 1 } });
    }
    if ((node.type === "fact" || node.type === "policy") && typeof node.value === "number") {
      if (node.numericRole === null || node.sourceSpanIds.length === 0) {
        failValidation({ stage: "units", code: "UNIT_PROVENANCE_MISSING", path: `${nodePath}.numericRole`, id: diagnosticId(node.id), counts: { boundSpans: node.sourceSpanIds.length }, state: { numericRolePresent: node.numericRole !== null } });
      }
      const numericSegments = node.sourceSpanIds.flatMap((spanId) => bindings.get(spanId)?.segments ?? []).filter((segment) => segment.type === "numeric-evidence");
      if (numericSegments.length === 0) {
        failValidation({ stage: "numeric-provenance", code: "NUMERIC_SEGMENT_REQUIRED", path: `${nodePath}.sourceSpanIds`, id: diagnosticId(node.id), counts: { boundSpans: node.sourceSpanIds.length, numericSegments: 0 } });
      }
      const recoveredFacts = recoverSourceFact(node.sourceSpanIds.map((spanId) => spans.get(spanId)!.quote), node.numericRole as SourceNumericRole);
      if (recoveredFacts.length === 0) {
        failValidation({ stage: "units", code: "UNIT_PROVENANCE_MISSING", path: `${nodePath}.sourceSpanIds`, id: diagnosticId(node.id), counts: { boundSpans: node.sourceSpanIds.length, recoveredFacts: 0 }, state: { numericRolePresent: true } });
      }
      if (recoveredFacts.length > 1) {
        failValidation({ stage: "units", code: "UNIT_PROVENANCE_AMBIGUOUS", path: `${nodePath}.sourceSpanIds`, id: diagnosticId(node.id), counts: { boundSpans: node.sourceSpanIds.length, recoveredFacts: recoveredFacts.length } });
      }
      const [recoveredFact] = recoveredFacts;
      providerUnitCorrections.set(node.id, node.unitSpec.unit !== recoveredFact.unit);
      node.value = recoveredFact.value;
      node.unitSpec = { unit: recoveredFact.unit };
    }
    if (node.calculation !== null && node.value !== null) {
      failValidation({ stage: "calculations", code: "INVALID_CALCULATION", path: `${nodePath}.value`, id: diagnosticId(node.id), state: { calculationPresent: true, valuePresent: true } }, "OUTPUT_TYPE_MISMATCH");
    }
    if (correctionTargetIds.has(node.id) && ((node.type !== "calculation" && node.type !== "comparison") || node.calculation === null)) {
      failValidation({ stage: "calculations", code: "DERIVED_VALUE_NOT_EXECUTABLE", path: `${nodePath}.calculation`, id: diagnosticId(node.id), state: { correctionTarget: true, calculationPresent: node.calculation !== null } }, "INVALID_OPERAND");
    }
    if (["calculation", "comparison", "recommendation"].includes(node.type) && node.calculation === null) {
      failValidation(
        { stage: "calculations", code: node.type === "recommendation" ? "INVALID_CALCULATION" : "DERIVED_VALUE_NOT_EXECUTABLE", path: `${nodePath}.calculation`, id: diagnosticId(node.id), state: { calculationPresent: false } },
        node.type === "recommendation" ? "NONDETERMINISTIC_SELECTION" : "INVALID_OPERAND",
      );
    }
    if (node.type === "assumption" && typeof node.value === "number" && ["currency", "three-year-total"].includes(node.unitSpec.unit)) {
      failValidation({ stage: "calculations", code: "DERIVED_VALUE_NOT_EXECUTABLE", path: `${nodePath}.value`, id: diagnosticId(node.id), state: { calculationPresent: false } }, "INVALID_OPERAND");
    }
    if (node.type === "recommendation" && node.calculation?.operation !== "select-candidate") {
      failValidation({ stage: "recommendation", code: "INVALID_RECOMMENDATION", path: `${nodePath}.calculation.operation`, id: diagnosticId(node.id) }, "OUTPUT_TYPE_MISMATCH");
    }
    if (node.type !== "recommendation" && node.calculation?.operation === "select-candidate") {
      failValidation({ stage: "calculations", code: "INVALID_CALCULATION", path: `${nodePath}.calculation.operation`, id: diagnosticId(node.id) }, "OUTPUT_TYPE_MISMATCH");
    }
  }

  canonicalizeDerivedUnits(proposal, providerUnitCorrections);

  const recommendation = proposal.graph.recommendation;
  const recommendationNode = proposal.graph.nodes.find((node) => node.id === recommendation.nodeId);
  if (!recommendationNode || recommendationNode.type !== "recommendation" || recommendationNode.calculation?.operation !== "select-candidate") {
    failValidation({ stage: "recommendation", code: "INVALID_RECOMMENDATION", path: "$.graph.recommendation.nodeId", id: diagnosticId(recommendation.nodeId), state: { nodeExists: Boolean(recommendationNode) } }, "NONDETERMINISTIC_SELECTION");
  }
  const recommendationLabels = new Set(recommendationNode.calculation.candidates.map((candidate) => candidate.label));
  if (!recommendationLabels.has(recommendation.original) || !recommendationLabels.has(recommendation.corrected)) {
    failValidation({ stage: "recommendation", code: "CANDIDATE_LABEL_MISMATCH", path: "$.graph.recommendation", id: diagnosticId(recommendation.nodeId), counts: { candidates: recommendationLabels.size } }, "NONDETERMINISTIC_SELECTION");
  }

  for (const [correctionIndex, correction] of proposal.graph.corrections.entries()) {
    if (!nodeIds.has(correction.targetNodeId)) {
      failValidation({ stage: "dependencies", code: "UNKNOWN_DEPENDENCY", path: `$.graph.corrections[${correctionIndex}].targetNodeId`, id: diagnosticId(correction.id) });
    }
    for (const [operandIndex, operand] of correction.replacementCalculation.operands.entries()) {
      if (operand.kind === "ref" && !nodeIds.has(operand.nodeId)) {
        failValidation({ stage: "dependencies", code: "CORRECTION_OPERAND_NODE_MISSING", path: `$.graph.corrections[${correctionIndex}].replacementCalculation.operands[${operandIndex}].nodeId`, id: diagnosticId(correction.id), counts: { missingReferences: 1 } });
      }
      if (operand.kind === "ref" && operand.nodeId === correction.targetNodeId) {
        failValidation({ stage: "dependencies", code: "CORRECTION_SELF_DEPENDENCY", path: `$.graph.corrections[${correctionIndex}].replacementCalculation.operands[${operandIndex}].nodeId`, id: diagnosticId(correction.id), state: { selfReference: true } });
      }
    }
    const target = proposal.graph.nodes.find((node) => node.id === correction.targetNodeId);
    if (target?.calculation && target.calculation.operation !== "select-candidate" && target.calculation.operation !== "convert-duration") {
      const unitOf = (operand: z.infer<typeof ProviderOperandSchema>) => operand.kind === "literal" ? operand.unit : proposal.graph.nodes.find((node) => node.id === operand.nodeId)?.unitSpec.unit;
      const originalUnits = target.calculation.operands.map(unitOf);
      const replacementUnits = correction.replacementCalculation.operands.map(unitOf);
      const referencesMonthlyRate = target.calculation.operands.some((operand) => operand.kind === "ref" && proposal.graph.nodes.find((node) => node.id === operand.nodeId)?.unitSpec.unit === "currency-per-device-per-month");
      if (referencesMonthlyRate && replacementUnits.includes("month") && !originalUnits.includes("year")) {
        failValidation({ stage: "units", code: originalUnits.includes("scalar") ? "DURATION_UNIT_MISSING" : "IMPLICIT_UNIT_CONVERSION", path: `$.graph.corrections[${correctionIndex}]`, id: diagnosticId(correction.id), counts: { originalYearOperands: 0, replacementMonthOperands: replacementUnits.filter((unit) => unit === "month").length }, state: { faultyMemoOperationPreserved: false } });
      }
    }
  }

  materializeProviderDependencies(proposal, nodeIds);
  validateGraphStructure(proposal, nodeIds);
  const plan = proposalToPlan(proposal, sourceSpans, providerUnitCorrections);
  try {
    return AnalysisPlanSchema.parse(plan);
  } catch (error) {
    if (error instanceof z.ZodError) failValidation(safeSchemaDiagnostic(error));
    if (error instanceof SafeValidationError) throw error;
    throw error;
  }
}

function joinSections(sections: Array<{ heading: string; body: string }>, includeHeadings: boolean) {
  const separator = includeHeadings ? "\n\n" : "\n";
  let content = "";
  const metadata: Array<{ heading: string; start: number; end: number }> = [];
  for (const section of sections) {
    if (content) content += separator;
    const start = content.length;
    content += includeHeadings ? `${section.heading}\n${section.body}` : section.body;
    metadata.push({ heading: section.heading, start, end: content.length });
  }
  return { content, sections: metadata };
}

export function demoAnalysisInput(): AnalysisInput {
  const draft = joinSections(demoProject.draftMemo.sections, true);
  return {
    fixtureId: DEMO_PROJECT_ID,
    documents: demoProject.documents.map((document) => {
      const joined = joinSections(document.sections, false);
      return { id: document.id, title: document.title, content: joined.content, pageLabel: document.pageLabel, sections: joined.sections };
    }),
    draftMemo: draft.content,
    draftMemoMetadata: { documentId: "draft-memo", title: demoProject.draftMemo.title, pageLabel: "Draft memo · p. 1", sections: draft.sections },
  };
}

export class DemoAnalysisProvider implements AnalysisProvider {
  readonly name = "Deterministic demo";
  readonly mode = "deterministic-demo" as const;

  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    if (input.fixtureId !== DEMO_PROJECT_ID) throw new Error("Offline demo analysis is available only for the bundled ASSERT fixture.");
    return {
      plan: AnalysisPlanSchema.parse({ sourceSpans: structuredClone(demoProject.sourceSpans), graph: structuredClone(demoProject.graph) }),
      provider: { name: this.name, mode: this.mode, model: null },
      usage: null,
      requestId: null,
      latencyMs: null,
    };
  }
}
