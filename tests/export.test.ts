import { describe, expect, it } from "vitest";
import { applyCorrection, buildProofExport, evaluateGraph } from "../lib/domain/engine";
import { proofEngineProject, proofEngineSourceSpanIds } from "./fixtures/proof-engine-project";
import type { ClaimStatus, ProofExport, ProofPhase } from "../lib/domain/schemas";

const GENERATED_AT = "2026-07-17T12:00:00.000Z";
const statuses: ClaimStatus[] = ["supported", "calculated", "assumed", "contradicted", "stale", "broken", "pending"];
const original = evaluateGraph(proofEngineProject.graph, proofEngineSourceSpanIds);

function exportAt(phase: ProofPhase): ProofExport {
  const graph = phase === "corrected"
    ? applyCorrection(proofEngineProject.graph, proofEngineProject.graph.corrections[0])
    : proofEngineProject.graph;
  const result = phase === "corrected" ? evaluateGraph(graph, proofEngineSourceSpanIds) : original;
  return buildProofExport(proofEngineProject.id, graph, result, original, proofEngineProject.sourceSpans, { phase, generatedAt: GENERATED_AT });
}

function expectGraphAndReportToAgree(proof: ProofExport) {
  const summary = Object.fromEntries(statuses.map((status) => [
    status,
    proof.graph.nodes.filter((node) => node.status === status).length,
  ]));
  const graphValues = Object.fromEntries(
    proof.graph.nodes.filter((node) => node.value !== undefined).map((node) => [node.id, node.value!]),
  );
  expect(proof.report.summary).toEqual(summary);
  expect(proof.report.currentValues).toEqual(graphValues);
  expect(proof.report.recommendation).toBe(graphValues.recommendation);
  expect(proof.phase).toBe(proof.report.phase);
  expect(proof.generatedAt).toBe(proof.report.generatedAt);
}

describe("proof export lifecycle semantics", () => {
  it("exports an explicitly pending state before verification", () => {
    const proof = exportAt("not-verified");
    expectGraphAndReportToAgree(proof);
    expect(proof.graph.nodes.every((node) => node.status === "pending")).toBe(true);
    expect(proof.report.summary.pending).toBe(proof.graph.nodes.length);
    expect(proof.report.correctedValues).toBeNull();
    expect(proof.report.recommendationState).toBe("not-verified");
  });

  it("exports evaluated broken statuses after verification without implying correction", () => {
    const proof = exportAt("verified");
    expectGraphAndReportToAgree(proof);
    expect(proof.graph.nodes.find((node) => node.id === "a-support")?.status).toBe("broken");
    expect(proof.graph.nodes.find((node) => node.id === "a-total")?.status).toBe("broken");
    expect(proof.graph.nodes.find((node) => node.id === "recommendation")?.status).toBe("broken");
    expect(proof.report.summary.broken).toBe(3);
    expect(proof.report.correctedValues).toBeNull();
    expect(proof.report.recommendation).toBe("Vendor A");
    expect(proof.report.recommendationState).toBe("broken");
    expect(proof.report.failures).toHaveLength(3);
  });

  it("exports recomputed values and a corrected Vendor B recommendation after correction", () => {
    const proof = exportAt("corrected");
    expectGraphAndReportToAgree(proof);
    expect(proof.report.recommendationState).toBe("corrected");
    expect(proof.report.recommendation).toBe("Vendor B");
    expect(proof.report.correctedValues).toMatchObject({
      "a-support": 208008,
      "a-total": 268677,
      "b-total": 85929,
      recommendation: "Vendor B",
    });
    expect(proof.graph.nodes.find((node) => node.id === "a-support")?.calculation?.displayFormula).toContain("36 months");
    expect(proof.graph.nodes.find((node) => node.id === "recommendation")?.status).toBe("calculated");
    expect(proof.report.summary.broken).toBe(0);
  });
});
