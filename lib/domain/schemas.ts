import { z } from "zod";

export const ClaimTypeSchema = z.enum([
  "fact",
  "policy",
  "calculation",
  "assumption",
  "comparison",
  "recommendation",
]);

export const ClaimStatusSchema = z.enum([
  "supported",
  "calculated",
  "assumed",
  "contradicted",
  "stale",
  "broken",
  "pending",
]);

export const UnitSchema = z.enum([
  "scalar",
  "percent",
  "ratio",
  "devices",
  "currency",
  "currency-per-device",
  "currency-per-month",
  "currency-per-device-per-month",
  "month",
  "year",
  "three-year-total",
  "recommendation",
]);

export const SourceSpanSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  pageLabel: z.string().min(1),
  section: z.string().min(1),
  quote: z.string().min(1),
  emphasis: z.string().nullable(),
});

export const SourceDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(["policy", "quote", "memo"]),
  pageLabel: z.string().min(1),
  sections: z.array(
    z.object({
      heading: z.string(),
      body: z.string(),
    }),
  ),
});

export const OperandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ref"), nodeId: z.string() }),
  z.object({
    kind: z.literal("literal"),
    value: z.number(),
    unit: UnitSchema,
    label: z.string().optional(),
  }),
]);

export const ArithmeticCalculationSpecSchema = z.object({
  operation: z.enum([
    "add",
    "subtract",
    "multiply",
    "divide",
    "percentage-adjustment",
    "compare-lower",
  ]),
  operands: z.array(OperandSchema).min(2),
  outputUnit: UnitSchema,
  displayFormula: z.string(),
});

export const CandidateSelectionCalculationSchema = z.object({
  operation: z.literal("select-candidate"),
  candidates: z.array(z.object({
    label: z.string().min(1),
    valueNodeId: z.string().min(1),
    maximumValueNodeId: z.string().min(1).nullable(),
  })).min(2),
  selectionDirection: z.literal("minimum"),
  tieResult: z.string().nullable(),
  outputUnit: z.literal("recommendation"),
  displayFormula: z.string(),
});

export const DurationConversionCalculationSchema = z.object({
  operation: z.literal("convert-duration"),
  inputNodeId: z.string().min(1),
  fromUnit: z.enum(["month", "year"]),
  toUnit: z.enum(["month", "year"]),
  outputUnit: z.enum(["month", "year"]),
  displayFormula: z.string().min(1),
});

export const CalculationSpecSchema = z.union([
  ArithmeticCalculationSpecSchema,
  CandidateSelectionCalculationSchema,
  DurationConversionCalculationSchema,
]);

export const UnitSpecSchema = z.object({
  unit: UnitSchema,
});

export const VerificationTestSchema = z.object({
  id: z.string(),
  kind: z.enum(["source-binding", "calculation", "unit", "dependency", "policy"]),
  label: z.string(),
  expected: z.string(),
});

export const ClaimNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  statement: z.string(),
  type: ClaimTypeSchema,
  status: ClaimStatusSchema.default("pending"),
  statusReason: z.string(),
  value: z.union([z.number(), z.string()]).optional(),
  unitSpec: UnitSpecSchema,
  providerUnitCorrected: z.boolean().default(false),
  sourceSpanIds: z.array(z.string()).default([]),
  calculation: CalculationSpecSchema.optional(),
  tests: z.array(VerificationTestSchema).default([]),
});

export const DependencyEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  kind: z.enum(["calculation-input", "semantic", "policy", "evidence-support", "untyped"]).default("untyped"),
  label: z.string().optional(),
});

export const RecommendationSchema = z.object({
  nodeId: z.string(),
  original: z.string(),
  corrected: z.string(),
});

export const CorrectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  targetNodeId: z.string(),
  replacementCalculation: CalculationSpecSchema,
});

export const DecisionGraphSchema = z.object({
  id: z.string(),
  nodes: z.array(ClaimNodeSchema),
  edges: z.array(DependencyEdgeSchema),
  recommendation: RecommendationSchema,
  corrections: z.array(CorrectionSchema),
});

export const DecisionProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  question: z.string(),
  documents: z.array(SourceDocumentSchema),
  sourceSpans: z.array(SourceSpanSchema),
  draftMemo: z.object({
    title: z.string(),
    sections: z.array(z.object({ heading: z.string(), body: z.string() })),
  }),
  graph: DecisionGraphSchema,
});

export const ProofPhaseSchema = z.enum(["not-verified", "verified", "corrected"]);
export const ProofModeSchema = z.literal("live-openai");
export const RecommendationStateSchema = z.enum(["not-verified", "valid", "broken", "corrected"]);

export const ProofReportSchema = z.object({
  projectId: z.string(),
  generatedAt: z.string(),
  mode: ProofModeSchema,
  phase: ProofPhaseSchema,
  recommendation: z.string(),
  recommendationState: RecommendationStateSchema,
  summary: z.record(ClaimStatusSchema, z.number()),
  originalValues: z.record(z.string(), z.union([z.number(), z.string()])),
  currentValues: z.record(z.string(), z.union([z.number(), z.string()])),
  correctedValues: z.record(z.string(), z.union([z.number(), z.string()])).nullable(),
  failures: z.array(z.string()),
  assumptions: z.array(z.string()),
  sourceReferences: z.array(SourceSpanSchema),
  dependencyPath: z.array(z.string()),
});

export const ProofExportSchema = z.object({
  schemaVersion: z.literal("1.0"),
  projectId: z.string(),
  generatedAt: z.string(),
  mode: ProofModeSchema,
  phase: ProofPhaseSchema,
  graph: DecisionGraphSchema,
  report: ProofReportSchema,
});

export type ClaimType = z.infer<typeof ClaimTypeSchema>;
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type SourceSpan = z.infer<typeof SourceSpanSchema>;
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;
export type CalculationSpec = z.infer<typeof CalculationSpecSchema>;
export type ClaimNode = z.infer<typeof ClaimNodeSchema>;
export type DependencyEdge = z.infer<typeof DependencyEdgeSchema>;
export type Correction = z.infer<typeof CorrectionSchema>;
export type DecisionGraph = z.infer<typeof DecisionGraphSchema>;
export type DecisionProject = z.infer<typeof DecisionProjectSchema>;
export type ProofPhase = z.infer<typeof ProofPhaseSchema>;
export type ProofMode = z.infer<typeof ProofModeSchema>;
export type RecommendationState = z.infer<typeof RecommendationStateSchema>;
export type ProofReport = z.infer<typeof ProofReportSchema>;
export type ProofExport = z.infer<typeof ProofExportSchema>;
