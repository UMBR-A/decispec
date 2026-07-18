import { describe, expect, it } from "vitest";
import { applyCorrection, buildProofExport, evaluateGraph, GraphDependencyError, materializeCalculationDependencies, resetGraph, semanticDiff, topologicalSort } from "../lib/domain/engine";
import { demoProject, demoSourceSpanIds } from "../lib/demo/fixture";
import { DecisionProjectSchema } from "../lib/domain/schemas";

const value = (result: ReturnType<typeof evaluateGraph>, id: string) => result.nodes.find((node) => node.id === id)?.value;
const status = (result: ReturnType<typeof evaluateGraph>, id: string) => result.nodes.find((node) => node.id === id)?.status;

describe("ASSERT deterministic proof engine", () => {
  it("runtime-validates the complete demo project", () => {
    expect(DecisionProjectSchema.parse(demoProject).id).toBe("assert-school-device-2026");
  });

  it("computes the imported memo expression exactly", () => {
    const result = evaluateGraph(demoProject.graph, demoSourceSpanIds);
    expect(value(result, "devices")).toBe(321);
    expect(value(result, "a-hardware")).toBe(60669);
    expect(value(result, "a-support")).toBe(17334);
    expect(value(result, "a-total")).toBe(78003);
    expect(value(result, "b-total")).toBe(85929);
  });

  it("detects the monthly-versus-annual unit mismatch", () => {
    const result = evaluateGraph(demoProject.graph, demoSourceSpanIds);
    const support = result.nodes.find((node) => node.id === "a-support")!;
    expect(support.status).toBe("broken");
    expect(support.statusReason).toContain("per month");
    expect(support.statusReason).toContain("3 years");
  });

  it("accepts monthly duration and rejects dimensionless duration for a monthly rate", () => {
    const monthly = applyCorrection(demoProject.graph, demoProject.graph.corrections[0]);
    const monthlyResult = evaluateGraph(monthly, demoSourceSpanIds);
    expect(value(monthlyResult, "a-support")).toBe(208008);
    expect(status(monthlyResult, "a-support")).toBe("calculated");

    const dimensionless = resetGraph(demoProject.graph);
    const support = dimensionless.nodes.find((node) => node.id === "a-support")!.calculation!;
    if (support.operation === "select-candidate" || support.operation === "convert-duration") throw new Error("Expected arithmetic calculation.");
    support.operands[2] = { kind: "literal", value: 3, unit: "scalar", label: "untyped duration" };
    const dimensionlessResult = evaluateGraph(dimensionless, demoSourceSpanIds);
    expect(status(dimensionlessResult, "a-support")).toBe("broken");
    expect(dimensionlessResult.nodes.find((node) => node.id === "a-support")?.statusReason).toContain("Duration unit missing");
  });

  it("requires explicit deterministic conversion from years to months", () => {
    const graph = resetGraph(demoProject.graph);
    graph.nodes.push({
      id: "duration-years", label: "Duration in years", statement: "Duration is three years.", type: "fact", status: "pending", statusReason: "", value: 3,
      unitSpec: { unit: "year" }, providerUnitCorrected: false, sourceSpanIds: [], tests: [],
    }, {
      id: "duration-months", label: "Duration in months", statement: "Convert the duration to months.", type: "calculation", status: "pending", statusReason: "",
      unitSpec: { unit: "month" }, providerUnitCorrected: false, sourceSpanIds: [], tests: [],
      calculation: { operation: "convert-duration", inputNodeId: "duration-years", fromUnit: "year", toUnit: "month", outputUnit: "month", displayFormula: "Convert years to months" },
    });
    const support = graph.nodes.find((node) => node.id === "a-support")!;
    support.calculation = { operation: "multiply", operands: [{ kind: "ref", nodeId: "devices" }, { kind: "ref", nodeId: "a-support-rate" }, { kind: "ref", nodeId: "duration-months" }], outputUnit: "currency", displayFormula: "devices × monthly rate × converted months" };
    graph.edges.push({ id: "duration-conversion", from: "duration-years", to: "duration-months", kind: "calculation-input" }, { id: "duration-support", from: "duration-months", to: "a-support", kind: "calculation-input" });
    const result = evaluateGraph(graph, demoSourceSpanIds);
    expect(value(result, "duration-months")).toBe(36);
    expect(value(result, "a-support")).toBe(208008);
    expect(status(result, "a-support")).toBe("calculated");
  });

  it("does not silently equate three years with three months", () => {
    const yearly = evaluateGraph(demoProject.graph, demoSourceSpanIds);
    const replacementCalculation = demoProject.graph.corrections[0].replacementCalculation;
    if (replacementCalculation.operation === "select-candidate" || replacementCalculation.operation === "convert-duration") {
      throw new Error("Expected an arithmetic replacement calculation.");
    }
    const monthlyGraph = applyCorrection(demoProject.graph, {
      ...demoProject.graph.corrections[0],
      replacementCalculation: { ...replacementCalculation, operands: [{ kind: "ref", nodeId: "devices" }, { kind: "ref", nodeId: "a-support-rate" }, { kind: "literal", value: 3, unit: "month", label: "3 months" }] },
    });
    const monthly = evaluateGraph(monthlyGraph, demoSourceSpanIds);
    expect(status(yearly, "a-support")).toBe("broken");
    expect(value(monthly, "a-support")).toBe(17334);
    expect(status(monthly, "a-support")).toBe("calculated");
  });

  it("propagates broken state in causal order", () => {
    const result = evaluateGraph(demoProject.graph, demoSourceSpanIds);
    expect(result.propagationTrace).toEqual(["a-support", "a-total", "recommendation"]);
    expect(status(result, "recommendation")).toBe("broken");
  });

  it("applies a correction without mutating the original", () => {
    const originalJson = JSON.stringify(demoProject.graph);
    const correctedGraph = applyCorrection(demoProject.graph, demoProject.graph.corrections[0]);
    const corrected = evaluateGraph(correctedGraph, demoSourceSpanIds);
    expect(value(corrected, "a-support")).toBe(208008);
    expect(value(corrected, "a-total")).toBe(268677);
    expect(value(corrected, "b-total")).toBe(85929);
    expect(value(corrected, "recommendation")).toBe("Vendor B");
    expect(status(corrected, "recommendation")).toBe("calculated");
    expect(JSON.stringify(demoProject.graph)).toBe(originalJson);
  });

  it("produces a semantic before/after diff", () => {
    const before = evaluateGraph(demoProject.graph, demoSourceSpanIds);
    const after = evaluateGraph(applyCorrection(demoProject.graph, demoProject.graph.corrections[0]), demoSourceSpanIds);
    expect(semanticDiff(before, after).map((item) => item.nodeId)).toEqual(["a-support", "a-total", "recommendation"]);
  });

  it("resets to an immutable copy", () => {
    const reset = resetGraph(demoProject.graph);
    reset.nodes[0].statement = "changed";
    expect(demoProject.graph.nodes[0].statement).toBe("Enrollment is 300 students.");
  });

  it("rejects cycles", () => {
    const graph = resetGraph(demoProject.graph);
    graph.edges.push({ id: "cycle", from: "recommendation", to: "students", kind: "semantic" });
    expect(() => topologicalSort(graph)).toThrow(GraphDependencyError);
    try { topologicalSort(graph); } catch (error) { expect(error).toMatchObject({ code: "GRAPH_CYCLE" }); }
  });

  it("rejects missing operand nodes and materializes missing calculation edges", () => {
    const missingNode = resetGraph(demoProject.graph);
    const missingCalculation = missingNode.nodes.find((node) => node.id === "devices")!.calculation!;
    if (missingCalculation.operation === "select-candidate" || missingCalculation.operation === "convert-duration") throw new Error("Expected arithmetic calculation.");
    missingCalculation.operands[0] = { kind: "ref", nodeId: "absent" };
    expect(() => topologicalSort(missingNode)).toThrow(GraphDependencyError);
    try { topologicalSort(missingNode); } catch (error) { expect(error).toMatchObject({ code: "CALCULATION_OPERAND_NODE_MISSING", dependencyId: "absent" }); }
    const missingEdge = resetGraph(demoProject.graph);
    missingEdge.edges = missingEdge.edges.filter((edge) => edge.id !== "e1");
    const effective = materializeCalculationDependencies(missingEdge);
    expect(effective.edges).toContainEqual(expect.objectContaining({ from: "students", to: "devices", kind: "calculation-input" }));
    expect(() => topologicalSort(missingEdge)).not.toThrow();
  });

  it("exposes missing-source errors", () => {
    const ids = new Set(demoSourceSpanIds);
    ids.delete("s-a-support");
    const result = evaluateGraph(demoProject.graph, ids);
    expect(result.nodes.find((node) => node.id === "a-support")?.statusReason).toContain("Missing source binding");
  });

  it("calculates the transparent weighted integrity score", () => {
    const broken = evaluateGraph(demoProject.graph, demoSourceSpanIds);
    const corrected = evaluateGraph(applyCorrection(demoProject.graph, demoProject.graph.corrections[0]), demoSourceSpanIds);
    expect(broken.integrity).toMatchObject({ score: 70, passingWeight: 16, totalWeight: 23 });
    expect(corrected.integrity.score).toBe(100);
  });

  it("materializes and deduplicates executable calculation dependencies", () => {
    const graph = resetGraph(demoProject.graph);
    graph.edges.push(
      { id: "duplicate-one", from: "students", to: "devices", kind: "calculation-input" },
      { id: "duplicate-two", from: "students", to: "devices", kind: "calculation-input" },
    );
    const effective = materializeCalculationDependencies(graph);
    expect(effective.edges.filter((edge) => edge.from === "students" && edge.to === "devices" && edge.kind === "calculation-input")).toHaveLength(1);
  });

  it("atomically replaces correction calculation edges while preserving semantic and policy edges", () => {
    const graph = resetGraph(demoProject.graph);
    graph.edges.push(
      { id: "policy-context", from: "budget", to: "a-support", kind: "policy" },
      { id: "semantic-context", from: "a-support-rate", to: "a-support", kind: "semantic" },
    );
    const original = materializeCalculationDependencies(graph);
    const replacement = structuredClone(demoProject.graph.corrections[0].replacementCalculation);
    if (replacement.operation === "select-candidate" || replacement.operation === "convert-duration") throw new Error("Expected arithmetic correction.");
    replacement.operands[1] = { kind: "ref", nodeId: "b-setup" };
    const corrected = applyCorrection(original, { ...demoProject.graph.corrections[0], replacementCalculation: replacement });
    expect(corrected.edges).toContainEqual(expect.objectContaining({ from: "b-setup", to: "a-support", kind: "calculation-input" }));
    expect(corrected.edges.some((edge) => edge.from === "a-support-rate" && edge.to === "a-support" && edge.kind === "calculation-input")).toBe(false);
    expect(corrected.edges).toContainEqual(expect.objectContaining({ from: "a-support-rate", to: "a-support", kind: "semantic" }));
    expect(corrected.edges).toContainEqual(expect.objectContaining({ id: "policy-context", kind: "policy" }));
    expect(resetGraph(original)).toEqual(original);
    expect(applyCorrection(original, { ...demoProject.graph.corrections[0], replacementCalculation: replacement })).toEqual(corrected);
  });

  it("rejects missing, self-referential, and cycle-creating correction operands", () => {
    const correction = structuredClone(demoProject.graph.corrections[0]);
    if (correction.replacementCalculation.operation === "select-candidate" || correction.replacementCalculation.operation === "convert-duration") throw new Error("Expected arithmetic correction.");
    correction.replacementCalculation.operands[0] = { kind: "ref", nodeId: "missing-node" };
    expect(() => applyCorrection(demoProject.graph, correction)).toThrow(expect.objectContaining({ code: "CORRECTION_OPERAND_NODE_MISSING" }));
    correction.replacementCalculation.operands[0] = { kind: "ref", nodeId: "a-support" };
    expect(() => applyCorrection(demoProject.graph, correction)).toThrow(expect.objectContaining({ code: "CORRECTION_SELF_DEPENDENCY" }));
    correction.replacementCalculation.operands[0] = { kind: "ref", nodeId: "a-total" };
    expect(() => applyCorrection(demoProject.graph, correction)).toThrow(expect.objectContaining({ code: "CORRECTION_CREATES_CYCLE" }));
  });

  it("materializes typed recommendation candidate and policy dependencies without using labels", () => {
    const graph = resetGraph(demoProject.graph);
    const recommendation = graph.nodes.find((node) => node.id === "recommendation")!;
    recommendation.label = "Unrelated display text";
    recommendation.calculation = {
      operation: "select-candidate",
      candidates: [
        { label: "Vendor A", valueNodeId: "a-total", maximumValueNodeId: "budget" },
        { label: "Vendor B", valueNodeId: "b-total", maximumValueNodeId: "budget" },
      ],
      selectionDirection: "minimum",
      tieResult: null,
      outputUnit: "recommendation",
      displayFormula: "Select minimum eligible candidate",
    };
    const effective = materializeCalculationDependencies(graph);
    expect(effective.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: "a-total", to: "recommendation", kind: "calculation-input" }),
      expect.objectContaining({ from: "budget", to: "recommendation", kind: "policy" }),
    ]));
  });

  it("exports the effective evaluated dependency structure", () => {
    const graph = resetGraph(demoProject.graph);
    graph.edges = graph.edges.filter((edge) => !(edge.from === "students" && edge.to === "devices"));
    const evaluated = evaluateGraph(graph, demoSourceSpanIds);
    const proof = buildProofExport(demoProject.id, graph, evaluated, evaluated, demoProject.sourceSpans, { phase: "verified", generatedAt: "2026-07-18T00:00:00.000Z" });
    expect(proof.graph.edges).toContainEqual(expect.objectContaining({ from: "students", to: "devices", kind: "calculation-input" }));
    expect(proof.report.currentValues.devices).toBe(321);
  });
});
