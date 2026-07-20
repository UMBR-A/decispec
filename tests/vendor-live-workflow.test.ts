import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { applyCorrection, buildProofExport, evaluateGraph, findDependencyPath } from "../lib/domain/engine";
import { recoverSourceNumbers } from "../lib/providers/source-unit-recovery";
import { buildSourceSegmentRegistry } from "../lib/providers/source-segments";
import { vendorGraph, vendorSourceSpanIds, vendorSourceSpans } from "./fixtures/vendor-example";

const source = readFileSync(resolve(process.cwd(), "tests/fixtures/source_documents.txt"), "utf8");
const memo = readFileSync(resolve(process.cwd(), "tests/fixtures/ai_recommendation.txt"), "utf8");

describe("supplied vendor live-analysis example", () => {
  it("creates authoritative monthly numeric-evidence atoms", () => {
    const registry = buildSourceSegmentRegistry({ documents: [{ id: "source-documents", title: "source_documents.txt", content: source }], draftMemo: memo });
    const monthlyAtoms = registry.segments.filter((segment) => segment.type === "numeric-evidence" && ["$2,334 per month", "$1,250 per month"].includes(segment.content));
    expect(monthlyAtoms.map((segment) => segment.content)).toEqual(["$2,334 per month", "$1,250 per month"]);
    expect(recoverSourceNumbers(monthlyAtoms[0].content)).toContainEqual({ value: 2334, unit: "currency-per-month", role: "recurring-rate" });
    expect(recoverSourceNumbers(monthlyAtoms[1].content)).toContainEqual({ value: 1250, unit: "currency-per-month", role: "recurring-rate" });
  });

  it("breaks the memo path, applies both corrections atomically, and selects Vendor B", () => {
    const original = evaluateGraph(vendorGraph, vendorSourceSpanIds);
    expect(original.nodes.find((node) => node.id === "a-support")).toMatchObject({ value: 7002, status: "broken" });
    expect(original.nodes.find((node) => node.id === "a-total")).toMatchObject({ value: 187002, status: "broken" });
    expect(original.nodes.find((node) => node.id === "b-total")).toMatchObject({ value: 213750, status: "broken" });
    expect(original.nodes.find((node) => node.id === "recommendation")?.status).toBe("broken");
    expect(findDependencyPath(vendorGraph, "a-support-rate", "recommendation")).toEqual(["a-support-rate", "a-support", "a-total", "recommendation"]);

    const correctedGraph = vendorGraph.corrections.reduce((graph, correction) => applyCorrection(graph, correction), vendorGraph);
    const corrected = evaluateGraph(correctedGraph, vendorSourceSpanIds);
    expect(corrected.nodes.find((node) => node.id === "evaluation-months")?.value).toBe(36);
    expect(corrected.nodes.find((node) => node.id === "a-support")).toMatchObject({ value: 84024, status: "calculated" });
    expect(corrected.nodes.find((node) => node.id === "a-total")).toMatchObject({ value: 264024, status: "calculated" });
    expect(corrected.nodes.find((node) => node.id === "b-support")).toMatchObject({ value: 45000, status: "calculated" });
    expect(corrected.nodes.find((node) => node.id === "b-total")).toMatchObject({ value: 255000, status: "calculated" });
    expect(corrected.nodes.find((node) => node.id === "cost-difference")?.value).toBe(9024);
    expect(corrected.nodes.find((node) => node.id === "cost-difference-ratio")).toMatchObject({ value: 9024 / 255000, unitSpec: { unit: "ratio" }, status: "calculated" });
    expect(9024 / 255000).toBeLessThan(0.1);
    expect(corrected.nodes.find((node) => node.id === "recommendation")).toMatchObject({ value: "Vendor B", status: "calculated" });

    const proof = buildProofExport(vendorGraph.id, correctedGraph, corrected, original, vendorSourceSpans, { phase: "corrected", mode: "live-openai", generatedAt: "2026-07-20T00:00:00.000Z" });
    expect(proof.report).toMatchObject({ recommendation: "Vendor B", recommendationState: "corrected" });
    expect(proof.graph.nodes.find((node) => node.id === "a-total")).toMatchObject({ value: 264024, status: "calculated" });
    expect(proof.graph.nodes.every((node) => node.status !== "pending")).toBe(true);
  });
});
