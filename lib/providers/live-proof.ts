import {
  applyCorrection,
  buildProofReport,
  evaluateGraph,
  findDependencyPath,
  GraphDependencyError,
  type EvaluationResult,
} from "../domain/engine";
import type { ProofReport } from "../domain/schemas";
import { AnalysisProviderError, type AnalysisResult } from "./analysis-provider";
import type { SafeValidationDiagnostic } from "./safe-validation";

export type LiveProofSummary = {
  requestId: string | null;
  latencyMs: number | null;
  usage: AnalysisResult["usage"];
  exactMonthlySupportBound: boolean;
  spareRatioNormalized: boolean;
  requiredDevices: number;
  unitMismatchDetected: boolean;
  failurePathLength: number;
  originalRecommendationBroken: boolean;
  correctedSupportCost: number;
  correctedVendorATotal: number;
  vendorBTotal: number;
  correctedRecommendation: string;
  reportRecommendationState: string;
};

export type LiveProofExecution = {
  original: EvaluationResult;
  corrected: EvaluationResult;
  report: ProofReport;
  summary: LiveProofSummary;
};

function fail(result: AnalysisResult, diagnostic: SafeValidationDiagnostic): never {
  throw new AnalysisProviderError("validation_rejection", "Analysis validation failed.", {
    requestId: result.requestId,
    responseReceived: true,
    latencyMs: result.latencyMs,
    usage: result.usage,
    diagnostic,
  });
}

export function executeLiveProof(result: AnalysisResult, projectId = "live-analysis"): LiveProofExecution {
  const graph = result.plan.graph;
  const sourceIds = new Set(result.plan.sourceSpans.map((span) => span.id));
  let original: EvaluationResult;
  try {
    original = evaluateGraph(graph, sourceIds);
  } catch {
    fail(result, { stage: "graph", code: "PATH_ASSERTION_FAILED", path: "$.graph" });
  }

  const monthlySpan = result.plan.sourceSpans.find((span) => span.quote.includes("$18 per device per month"));
  if (!monthlySpan) fail(result, { stage: "quotation", code: "PATH_ASSERTION_FAILED", path: "$.sourceSpans", counts: { exactMonthlyBindings: 0 } });
  const monthlyRate = original.nodes.find((node) => (node.type === "fact" || node.type === "policy") && node.sourceSpanIds.includes(monthlySpan.id) && typeof node.value === "number");
  if (!monthlyRate) fail(result, { stage: "units", code: "UNIT_PROVENANCE_MISSING", path: "$.graph.nodes[*].unitSpec", counts: { monthlyRateNodes: 0 } });
  if (monthlyRate.unitSpec.unit !== "currency-per-device-per-month") {
    fail(result, { stage: "units", code: "RATE_DENOMINATOR_MISSING", path: "$.graph.nodes[*].unitSpec", id: monthlyRate.id, state: { compoundRatePreserved: false } });
  }

  const spareSpan = result.plan.sourceSpans.find((span) => span.quote.includes("7%"));
  const spareNode = original.nodes.find((node) => spareSpan && node.sourceSpanIds.includes(spareSpan.id) && (node.unitSpec.unit === "percent" || node.unitSpec.unit === "ratio"));
  const spareRatio = spareNode?.unitSpec.unit === "percent" && typeof spareNode.value === "number" ? spareNode.value / 100 : spareNode?.value;
  if (spareRatio !== 0.07) fail(result, { stage: "numeric-provenance", code: "PATH_ASSERTION_FAILED", path: "$.graph.nodes[*].value", id: spareNode?.id, counts: { matchingNodes: spareNode ? 1 : 0 } });

  const devicesNode = original.nodes.find((node) => node.calculation?.operation === "percentage-adjustment" && node.unitSpec.unit === "devices");
  if (devicesNode?.value !== 321) fail(result, { stage: "calculations", code: "PATH_ASSERTION_FAILED", path: "$.graph.nodes[*].calculation", id: devicesNode?.id, counts: { matchingNodes: devicesNode ? 1 : 0 } });

  const mismatch = original.nodes.find((node) => node.status === "broken" && node.testResults.some((test) => test.label === "Unit compatibility" && !test.passed));
  if (!mismatch) {
    const supportCalculations = original.nodes.filter((node) => {
      const calculation = node.calculation;
      return calculation && calculation.operation !== "select-candidate" && calculation.operation !== "convert-duration" && calculation.operands.some((operand) => operand.kind === "ref" && operand.nodeId === monthlyRate.id);
    });
    if (supportCalculations.length === 0) fail(result, { stage: "calculations", code: "DERIVED_VALUE_NOT_EXECUTABLE", path: "$.graph.nodes[*].calculation", id: monthlyRate.id, counts: { executableSupportCalculations: 0 } });
    const supportCalculation = supportCalculations[0];
    const calculation = supportCalculation.calculation!;
    if (calculation.operation === "select-candidate" || calculation.operation === "convert-duration") fail(result, { stage: "units", code: "UNIT_PATH_ASSERTION_FAILED", path: "$.graph.nodes[*].calculation", id: supportCalculation.id });
    const operandUnits = calculation.operands.map((operand) => operand.kind === "literal" ? operand.unit : original.nodes.find((node) => node.id === operand.nodeId)?.unitSpec.unit);
    const years = operandUnits.filter((unit) => unit === "year").length;
    const months = operandUnits.filter((unit) => unit === "month").length;
    const scalars = operandUnits.filter((unit) => unit === "scalar").length;
    if (years === 0 && months === 0) fail(result, { stage: "units", code: "DURATION_UNIT_MISSING", path: "$.graph.nodes[*].calculation.operands", id: supportCalculation.id, counts: { yearOperands: years, monthOperands: months, scalarOperands: scalars } });
    if (years === 0 && months > 0) fail(result, { stage: "units", code: "IMPLICIT_UNIT_CONVERSION", path: "$.graph.nodes[*].calculation.operands", id: supportCalculation.id, counts: { yearOperands: years, monthOperands: months }, state: { faultyMemoOperationPreserved: false } });
    fail(result, { stage: "units", code: "UNIT_PATH_ASSERTION_FAILED", path: "$.evaluation.nodes", id: supportCalculation.id, counts: { unitFailures: 0, yearOperands: years, monthOperands: months, scalarOperands: scalars }, state: { monthlyRatePreserved: true, supportCalculationExecutable: true } });
  }

  const recommendation = original.nodes.find((node) => node.type === "recommendation");
  if (!recommendation || recommendation.calculation?.operation !== "select-candidate") {
    fail(result, { stage: "recommendation", code: "PATH_ASSERTION_FAILED", path: "$.graph.nodes[*].calculation", id: recommendation?.id });
  }
  const selector = recommendation.calculation;
  const originalCandidate = selector.candidates.find((candidate) => candidate.label === graph.recommendation.original);
  const correctedCandidate = selector.candidates.find((candidate) => candidate.label === graph.recommendation.corrected);
  if (!originalCandidate || !correctedCandidate) {
    fail(result, { stage: "recommendation", code: "CANDIDATE_LABEL_MISMATCH", path: "$.graph.recommendation", id: recommendation.id, counts: { candidates: selector.candidates.length } });
  }
  const originalTotal = original.nodes.find((node) => node.id === originalCandidate.valueNodeId);
  if (!originalTotal) fail(result, { stage: "dependencies", code: "INVALID_CANDIDATE_REFERENCE", path: "$.graph.nodes[*].calculation.candidates", id: recommendation.id });

  const supportToTotal = findDependencyPath(graph, mismatch.id, originalTotal.id);
  const totalToRecommendation = findDependencyPath(graph, originalTotal.id, recommendation.id);
  if (!supportToTotal || !totalToRecommendation) {
    fail(result, {
      stage: "graph",
      code: "PATH_ASSERTION_FAILED",
      path: "$.graph.edges",
      id: recommendation.id,
      counts: { supportToTotalPaths: supportToTotal ? 1 : 0, totalToRecommendationPaths: totalToRecommendation ? 1 : 0 },
    });
  }
  const failurePath = [...supportToTotal, ...totalToRecommendation.slice(1)];
  const tracePositions = failurePath.map((id) => original.propagationTrace.indexOf(id));
  if (tracePositions.some((position) => position < 0) || tracePositions.some((position, index) => index > 0 && position <= tracePositions[index - 1])) {
    fail(result, { stage: "graph", code: "PATH_ASSERTION_FAILED", path: "$.evaluation.propagationTrace", id: recommendation.id, counts: { expectedPathNodes: failurePath.length } });
  }
  if (originalTotal.status !== "broken" || recommendation.status !== "broken") {
    fail(result, { stage: "recommendation", code: "PATH_ASSERTION_FAILED", path: "$.evaluation.nodes", id: recommendation.id, counts: { brokenPathNodes: failurePath.filter((id) => original.nodes.find((node) => node.id === id)?.status === "broken").length } });
  }

  const correction = graph.corrections.find((candidate) => candidate.targetNodeId === mismatch.id);
  if (!correction) fail(result, { stage: "calculations", code: "PATH_ASSERTION_FAILED", path: "$.graph.corrections", id: mismatch.id, counts: { matchingCorrections: 0 } });
  let corrected: EvaluationResult;
  try {
    corrected = evaluateGraph(applyCorrection(graph, correction), sourceIds);
  } catch (error) {
    if (error instanceof GraphDependencyError && ["CORRECTION_OPERAND_NODE_MISSING", "CORRECTION_SELF_DEPENDENCY", "CORRECTION_CREATES_CYCLE", "CORRECTION_DEPENDENCY_MATERIALIZATION_FAILED"].includes(error.code)) {
      fail(result, { stage: "calculations", code: error.code as "CORRECTION_OPERAND_NODE_MISSING" | "CORRECTION_SELF_DEPENDENCY" | "CORRECTION_CREATES_CYCLE" | "CORRECTION_DEPENDENCY_MATERIALIZATION_FAILED", path: "$.graph.corrections", id: correction.id, counts: { dependencyFailures: 1 }, state: { correctionApplied: false } });
    }
    fail(result, { stage: "calculations", code: "PATH_ASSERTION_FAILED", path: "$.graph.corrections", id: correction.id });
  }
  const correctedSupport = corrected.nodes.find((node) => node.id === mismatch.id)?.value;
  const correctedATotal = corrected.nodes.find((node) => node.id === originalCandidate.valueNodeId)?.value;
  const vendorBTotal = corrected.nodes.find((node) => node.id === correctedCandidate.valueNodeId)?.value;
  const correctedRecommendation = corrected.nodes.find((node) => node.id === recommendation.id);
  if (correctedSupport !== 208_008 || correctedATotal !== 268_677 || vendorBTotal !== 85_929 || correctedRecommendation?.value !== graph.recommendation.corrected) {
    fail(result, {
      stage: "calculations",
      code: "PATH_ASSERTION_FAILED",
      path: "$.evaluation.corrected",
      id: recommendation.id,
      counts: {
        supportMatches: correctedSupport === 208_008 ? 1 : 0,
        originalTotalMatches: correctedATotal === 268_677 ? 1 : 0,
        alternateTotalMatches: vendorBTotal === 85_929 ? 1 : 0,
        recommendationMatches: correctedRecommendation?.value === graph.recommendation.corrected ? 1 : 0,
      },
    });
  }

  const report = buildProofReport(projectId, corrected, original, result.plan.sourceSpans, { phase: "corrected", mode: "live-openai" });
  if (report.recommendation !== graph.recommendation.corrected || report.recommendationState !== "corrected") {
    fail(result, { stage: "recommendation", code: "PATH_ASSERTION_FAILED", path: "$.report.recommendation", id: recommendation.id });
  }
  return {
    original,
    corrected,
    report,
    summary: {
      requestId: result.requestId,
      latencyMs: result.latencyMs,
      usage: result.usage,
      exactMonthlySupportBound: true,
      spareRatioNormalized: true,
      requiredDevices: 321,
      unitMismatchDetected: true,
      failurePathLength: failurePath.length,
      originalRecommendationBroken: true,
      correctedSupportCost: correctedSupport,
      correctedVendorATotal: correctedATotal,
      vendorBTotal,
      correctedRecommendation: String(correctedRecommendation.value),
      reportRecommendationState: report.recommendationState,
    },
  };
}
