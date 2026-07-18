import type { EvaluationResult } from "./engine";

export type DecisionTestCategory = {
  id: string;
  label: string;
  passed: number;
  failed: number;
  pending: boolean;
  inspectNodeIds: string[];
};

const categories = [
  ["evidence", "Evidence bindings", "Source binding"],
  ["provenance", "Numeric provenance", "Source binding"],
  ["arithmetic", "Arithmetic", "Deterministic calculation"],
  ["units", "Unit compatibility", "Unit compatibility"],
  ["dependencies", "Dependency integrity", "Dependency integrity"],
] as const;

export function buildDecisionTestSuite(evaluation: EvaluationResult | null, pending = false): DecisionTestCategory[] {
  if (!evaluation || pending) return [
    ...categories.map(([id, label]) => ({ id, label, passed: 0, failed: 0, pending: true, inspectNodeIds: [] })),
    { id: "policy", label: "Policy constraints", passed: 0, failed: 0, pending: true, inspectNodeIds: [] },
    { id: "recommendation", label: "Recommendation validity", passed: 0, failed: 0, pending: true, inspectNodeIds: [] },
  ];
  const result: DecisionTestCategory[] = categories.map(([id, label, testLabel]) => {
    const relevant = evaluation.nodes.flatMap((node) => node.testResults.filter((test) => test.label === testLabel).map((test) => ({ nodeId: node.id, passed: test.passed })))
      .filter((test) => id !== "provenance" || evaluation.nodes.some((node) => node.id === test.nodeId && (node.type === "fact" || node.type === "policy") && typeof node.value === "number"));
    return { id, label, passed: relevant.filter((test) => test.passed).length, failed: relevant.filter((test) => !test.passed).length, pending: false, inspectNodeIds: [...new Set(relevant.map((test) => test.nodeId))] };
  });
  const recommendation = evaluation.nodes.find((node) => node.type === "recommendation");
  const policyNodes = evaluation.nodes.filter((node) => node.type === "policy");
  result.splice(4, 0, {
    id: "policy",
    label: "Policy constraints",
    passed: policyNodes.filter((node) => node.status !== "broken" && node.status !== "contradicted").length,
    failed: policyNodes.filter((node) => node.status === "broken" || node.status === "contradicted").length,
    pending: false,
    inspectNodeIds: policyNodes.map((node) => node.id),
  });
  result.push({
    id: "recommendation",
    label: "Recommendation validity",
    passed: recommendation && recommendation.status !== "broken" && recommendation.status !== "contradicted" ? 1 : 0,
    failed: recommendation && (recommendation.status === "broken" || recommendation.status === "contradicted") ? 1 : 0,
    pending: false,
    inspectNodeIds: recommendation ? [recommendation.id] : [],
  });
  return result;
}
