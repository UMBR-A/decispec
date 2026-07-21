import { describe, expect, it } from "vitest";
import { proofEngineAnalysisInput, proofEngineProject } from "./fixtures/proof-engine-project";
import { validateProviderProposal, AnalysisProviderError, type AnalysisResult, type ProviderAnalysisPlan } from "../lib/providers/analysis-provider";
import { executeLiveProof } from "../lib/providers/live-proof";
import { numericRoleForUnit } from "../lib/providers/source-unit-recovery";
import { buildSourceSegmentRegistry } from "../lib/providers/source-segments";

type RegressionCalculation = NonNullable<(typeof proofEngineProject.graph.nodes)[number]["calculation"]>;
type RegressionArithmeticCalculation = Exclude<RegressionCalculation, { operation: "select-candidate" | "convert-duration" }>;

function arithmeticCalculation(calculation: RegressionArithmeticCalculation) {
  return {
    ...structuredClone(calculation),
    operands: calculation.operands.map((operand) => operand.kind === "ref" ? { ...operand } : { ...operand, label: operand.label ?? null }),
  };
}

function proposal(): ProviderAnalysisPlan {
  const registry = buildSourceSegmentRegistry(proofEngineAnalysisInput());
  const sourceBindings = proofEngineProject.sourceSpans.map((span) => {
    const document = registry.documents.get(span.documentId)!;
    const start = document.content.indexOf(span.quote);
    const candidates = registry.segments.filter((segment) => segment.documentId === span.documentId && segment.start >= start && segment.end <= start + span.quote.length);
    const selected = candidates.filter((segment) => segment.type === "numeric-evidence" && (span.emphasis?.includes(segment.content) || segment.content.includes(span.emphasis ?? "\u0000"))).sort((a, b) => b.content.length - a.content.length)[0]
      ?? candidates.filter((segment) => span.emphasis && segment.content.includes(span.emphasis)).sort((a, b) => a.content.length - b.content.length)[0]
      ?? candidates.find((segment) => segment.content === span.quote);
    if (!selected) throw new Error(`Missing segment for ${span.id}.`);
    const kind = proofEngineProject.documents.find((document) => document.id === span.documentId)?.kind;
    return { bindingId: span.id, documentId: span.documentId, segmentIds: [selected.id], semanticRole: kind === "policy" ? "policy" as const : kind === "memo" ? "recommendation" as const : "fact" as const, emphasisSegmentIds: [selected.id] };
  });
  return {
    sourceBindings,
    graph: {
      id: "opaque-live-graph",
      nodes: proofEngineProject.graph.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        statement: node.statement,
        type: node.type,
        value: node.calculation ? null : node.value ?? null,
        unitSpec: structuredClone(node.unitSpec),
        numericRole: node.calculation ? null : numericRoleForUnit(node.unitSpec.unit),
        sourceSpanIds: [...node.sourceSpanIds],
        calculation: node.id === proofEngineProject.graph.recommendation.nodeId
          ? {
              operation: "select-candidate" as const,
              candidates: [
                { label: "Vendor A", valueNodeId: "a-total", maximumValueNodeId: "budget" },
                { label: "Vendor B", valueNodeId: "b-total", maximumValueNodeId: "budget" },
              ],
              selectionDirection: "minimum" as const,
              tieResult: null,
              outputUnit: "recommendation" as const,
              displayFormula: "Select the minimum eligible candidate",
            }
          : node.calculation ? arithmeticCalculation(node.calculation as RegressionArithmeticCalculation) : null,
      })),
      edges: proofEngineProject.graph.edges.map((edge) => ({ ...edge, kind: edge.kind === "untyped" ? null : edge.kind, label: edge.label ?? null })),
      recommendation: structuredClone(proofEngineProject.graph.recommendation),
      corrections: proofEngineProject.graph.corrections.map((correction) => ({
        ...structuredClone(correction),
        replacementCalculation: arithmeticCalculation(correction.replacementCalculation as RegressionArithmeticCalculation),
      })),
    },
  };
}

function resultFrom(plan: ProviderAnalysisPlan): AnalysisResult {
  return {
    provider: { name: "OpenAI", mode: "live-openai", model: "gpt-5.6-terra" },
    plan: validateProviderProposal(plan, proofEngineAnalysisInput()),
    requestId: "req_semantic_test",
    latencyMs: 1234,
    usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
  };
}

function remapAndReorder(plan: ProviderAnalysisPlan): ProviderAnalysisPlan {
  const ids = new Map(plan.graph.nodes.map((node, index) => [node.id, `opaque_${(index + 17) * 7919}`]));
  const ref = (id: string) => ids.get(id) ?? id;
  const mapped = structuredClone(plan);
  mapped.graph.nodes = mapped.graph.nodes.reverse().map((node) => ({
    ...node,
    id: ref(node.id),
    calculation: node.calculation?.operation === "select-candidate"
      ? { ...node.calculation, candidates: node.calculation.candidates.toReversed().map((candidate) => ({ ...candidate, valueNodeId: ref(candidate.valueNodeId), maximumValueNodeId: candidate.maximumValueNodeId ? ref(candidate.maximumValueNodeId) : null })) }
      : node.calculation?.operation === "convert-duration" ? { ...node.calculation, inputNodeId: ref(node.calculation.inputNodeId) }
      : node.calculation ? { ...node.calculation, operands: node.calculation.operands.map((operand) => operand.kind === "ref" ? { ...operand, nodeId: ref(operand.nodeId) } : operand) }
      : null,
  }));
  mapped.graph.edges = mapped.graph.edges.toReversed().map((edge, index) => ({ ...edge, id: `opaque_edge_${index}`, from: ref(edge.from), to: ref(edge.to) }));
  mapped.graph.recommendation.nodeId = ref(mapped.graph.recommendation.nodeId);
  mapped.graph.corrections = mapped.graph.corrections.map((correction) => ({
    ...correction,
    targetNodeId: ref(correction.targetNodeId),
    replacementCalculation: {
      ...correction.replacementCalculation,
      operands: correction.replacementCalculation.operands.map((operand) => operand.kind === "ref" ? { ...operand, nodeId: ref(operand.nodeId) } : operand),
    },
  }));
  return mapped;
}

describe("semantic live proof", () => {
  it("traces and corrects the proof with randomized IDs, node order, edge order, and candidate order", () => {
    const proof = executeLiveProof(resultFrom(remapAndReorder(proposal())));
    expect(proof.summary).toMatchObject({
      exactMonthlySupportBound: true,
      spareRatioNormalized: true,
      requiredDevices: 321,
      unitMismatchDetected: true,
      originalRecommendationBroken: true,
      correctedSupportCost: 208_008,
      correctedVendorATotal: 268_677,
      vendorBTotal: 85_929,
      correctedRecommendation: "Vendor B",
      reportRecommendationState: "corrected",
    });
    expect(proof.summary.failurePathLength).toBeGreaterThanOrEqual(3);
  });

  it("preserves safe request metadata when an engine postcondition fails", () => {
    const result = resultFrom(proposal());
    result.plan.graph.edges.push({ id: "safe-cycle", from: "recommendation", to: "a-support", kind: "semantic" });
    let observed: unknown;
    try {
      executeLiveProof(result);
    } catch (error) {
      observed = error;
    }
    expect(observed).toBeInstanceOf(AnalysisProviderError);
    const error = observed as AnalysisProviderError;
    expect(error).toMatchObject({ requestId: "req_semantic_test", latencyMs: 1234, usage: { totalTokens: 300 } });
    expect(error.diagnostic).toMatchObject({ code: "PATH_ASSERTION_FAILED", stage: "graph" });
    const serialized = JSON.stringify(error.diagnostic);
    expect(serialized).not.toContain("$18");
    expect(serialized).not.toContain("Vendor A charges");
  });

  it("classifies a silently corrected memo calculation with content-safe structure only", () => {
    const result = resultFrom(proposal());
    const support = result.plan.graph.nodes.find((node) => node.id === "a-support")!.calculation;
    if (!support || support.operation === "select-candidate" || support.operation === "convert-duration") throw new Error("Expected arithmetic.");
    support.operands[2] = { kind: "literal", value: 36, unit: "month", label: "duration" };
    let observed: unknown;
    try { executeLiveProof(result); } catch (error) { observed = error; }
    expect(observed).toBeInstanceOf(AnalysisProviderError);
    const error = observed as AnalysisProviderError;
    expect(error.diagnostic).toMatchObject({ stage: "units", code: "IMPLICIT_UNIT_CONVERSION", state: { faultyMemoOperationPreserved: false } });
    expect(error).toMatchObject({ requestId: "req_semantic_test", usage: { totalTokens: 300 } });
    expect(JSON.stringify(error.diagnostic)).not.toMatch(/\$18|per device|Vendor A charges/i);
  });

  it("classifies a discarded monthly denominator without leaking evidence", () => {
    const result = resultFrom(proposal());
    const rate = result.plan.graph.nodes.find((node) => node.id === "a-support-rate")!;
    rate.unitSpec = { unit: "currency-per-device" };
    let observed: unknown;
    try { executeLiveProof(result); } catch (error) { observed = error; }
    const error = observed as AnalysisProviderError;
    expect(error.diagnostic).toMatchObject({ stage: "units", code: "RATE_DENOMINATOR_MISSING", state: { compoundRatePreserved: false } });
    expect(JSON.stringify(error.diagnostic)).not.toMatch(/\$18|per month|PRIVATE/i);
  });
});
