import {
  CalculationSpec,
  ClaimNode,
  ClaimStatus,
  Correction,
  DependencyEdge,
  DecisionGraph,
  DecisionGraphSchema,
  ProofExport,
  ProofExportSchema,
  ProofPhase,
  ProofMode,
  ProofReport,
  ProofReportSchema,
  SourceSpan,
  Unit,
} from "./schemas";
import { CalculationContractError, type CalculationFailureReason } from "./calculation-contract";

export type EvaluatedNode = ClaimNode & {
  value?: number | string;
  status: ClaimStatus;
  statusReason: string;
  testResults: Array<{ label: string; passed: boolean; detail: string }>;
};

export type EvaluationResult = {
  nodes: EvaluatedNode[];
  order: string[];
  propagationTrace: string[];
  integrity: { score: number; passingWeight: number; totalWeight: number; formula: string };
};

type CandidateSelection = Extract<CalculationSpec, { operation: "select-candidate" }>;
export type CandidateSelectionOutcome = { value: string; reason: CalculationFailureReason | null };

const WEIGHTS: Record<ClaimNode["type"], number> = {
  fact: 1,
  policy: 1,
  calculation: 2,
  assumption: 1,
  comparison: 2,
  recommendation: 3,
};

function cloneGraph(graph: DecisionGraph): DecisionGraph {
  return DecisionGraphSchema.parse(structuredClone(graph));
}

export type GraphDependencyErrorCode =
  | "CALCULATION_OPERAND_NODE_MISSING"
  | "CORRECTION_OPERAND_NODE_MISSING"
  | "CORRECTION_SELF_DEPENDENCY"
  | "CORRECTION_CREATES_CYCLE"
  | "CORRECTION_DEPENDENCY_MATERIALIZATION_FAILED"
  | "RECOMMENDATION_CANDIDATE_DEPENDENCY_MISSING"
  | "INVALID_EDGE"
  | "GRAPH_CYCLE";

export class GraphDependencyError extends Error {
  constructor(readonly code: GraphDependencyErrorCode, readonly nodeId: string, readonly dependencyId?: string) {
    super("Graph dependency validation failed.");
    this.name = "GraphDependencyError";
  }
}

export type CalculationDependencyDescriptor = { nodeId: string; kind: DependencyEdge["kind"] };

export function calculationDependencyDescriptors(calculation: CalculationSpec | undefined): CalculationDependencyDescriptor[] {
  if (!calculation) return [];
  if (calculation.operation === "select-candidate") {
    return [...new Map(calculation.candidates.flatMap((candidate) => [
      { nodeId: candidate.valueNodeId, kind: "calculation-input" as const },
      ...(candidate.maximumValueNodeId ? [{ nodeId: candidate.maximumValueNodeId, kind: "policy" as const }] : []),
    ]).map((descriptor) => [`${descriptor.kind}:${descriptor.nodeId}`, descriptor])).values()];
  }
  if (calculation.operation === "convert-duration") return [{ nodeId: calculation.inputNodeId, kind: "calculation-input" }];
  return [...new Map(calculation.operands.flatMap((operand) => operand.kind === "ref" ? [{ nodeId: operand.nodeId, kind: "calculation-input" as const }] : []).map((descriptor) => [descriptor.nodeId, descriptor])).values()];
}

function materializedEdgeId(from: string, to: string, kind: DependencyEdge["kind"]): string {
  return `assert-${kind}-${from}-${to}`;
}

export function materializeCalculationDependencies(input: DecisionGraph): DecisionGraph {
  const graph = cloneGraph(input);
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const required = new Map<string, CalculationDependencyDescriptor>();
  for (const node of graph.nodes) {
    for (const descriptor of calculationDependencyDescriptors(node.calculation)) {
      if (!nodeIds.has(descriptor.nodeId)) {
        throw new GraphDependencyError(node.calculation?.operation === "select-candidate" && descriptor.kind === "calculation-input" ? "RECOMMENDATION_CANDIDATE_DEPENDENCY_MISSING" : "CALCULATION_OPERAND_NODE_MISSING", node.id, descriptor.nodeId);
      }
      if (descriptor.nodeId === node.id) throw new GraphDependencyError("INVALID_EDGE", node.id, descriptor.nodeId);
      required.set(JSON.stringify([descriptor.nodeId, node.id]), descriptor);
    }
  }
  const deduplicated = new Map<string, DependencyEdge>();
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to) || edge.from === edge.to) throw new GraphDependencyError("INVALID_EDGE", edge.to, edge.from);
    const kind = edge.kind === "untyped" ? required.get(JSON.stringify([edge.from, edge.to]))?.kind ?? "semantic" : edge.kind;
    const normalized = { ...edge, kind };
    const key = JSON.stringify([edge.from, edge.to, kind]);
    if (!deduplicated.has(key)) deduplicated.set(key, normalized);
  }
  graph.edges = [...deduplicated.values()];
  const edgeKeys = new Set(graph.edges.map((edge) => JSON.stringify([edge.from, edge.to, edge.kind])));
  for (const node of graph.nodes) {
    for (const descriptor of calculationDependencyDescriptors(node.calculation)) {
      const key = JSON.stringify([descriptor.nodeId, node.id, descriptor.kind]);
      if (edgeKeys.has(key)) continue;
      graph.edges.push({ id: materializedEdgeId(descriptor.nodeId, node.id, descriptor.kind), from: descriptor.nodeId, to: node.id, kind: descriptor.kind });
      edgeKeys.add(key);
    }
  }
  return graph;
}

function topologicalSortMaterialized(graph: DecisionGraph): string[] {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const indegree = new Map(graph.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));
  const relationshipKeys = new Set<string>();
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new GraphDependencyError("INVALID_EDGE", edge.to, edge.from);
    }
    const relationshipKey = `${edge.from}:${edge.to}`;
    if (relationshipKeys.has(relationshipKey)) continue;
    relationshipKeys.add(relationshipKey);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  }

  const queue = graph.nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const next of outgoing.get(current) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }

  if (order.length !== graph.nodes.length) throw new GraphDependencyError("GRAPH_CYCLE", graph.id);
  return order;
}

export function topologicalSort(graph: DecisionGraph): string[] {
  return topologicalSortMaterialized(materializeCalculationDependencies(graph));
}

export function calculationDependencyIds(calculation: CalculationSpec | undefined): string[] {
  return calculationDependencyDescriptors(calculation).map((descriptor) => descriptor.nodeId);
}

export function findDependencyPath(graph: DecisionGraph, fromNodeId: string, toNodeId: string): string[] | null {
  graph = materializeCalculationDependencies(graph);
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(fromNodeId) || !nodeIds.has(toNodeId)) return null;
  const outgoing = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of graph.edges) outgoing.get(edge.from)?.push(edge.to);
  const queue: Array<{ id: string; path: string[] }> = [{ id: fromNodeId, path: [fromNodeId] }];
  const visited = new Set([fromNodeId]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.id === toNodeId) return current.path;
    for (const next of outgoing.get(current.id) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ id: next, path: [...current.path, next] });
    }
  }
  return null;
}

type UnitDimensions = { currency: number; devices: number; time: number; timeBasis: "month" | "year" | null; recommendation: boolean };

const UNIT_DIMENSIONS: Record<Unit, UnitDimensions> = {
  scalar: { currency: 0, devices: 0, time: 0, timeBasis: null, recommendation: false },
  percent: { currency: 0, devices: 0, time: 0, timeBasis: null, recommendation: false },
  ratio: { currency: 0, devices: 0, time: 0, timeBasis: null, recommendation: false },
  devices: { currency: 0, devices: 1, time: 0, timeBasis: null, recommendation: false },
  currency: { currency: 1, devices: 0, time: 0, timeBasis: null, recommendation: false },
  "currency-per-device": { currency: 1, devices: -1, time: 0, timeBasis: null, recommendation: false },
  "currency-per-month": { currency: 1, devices: 0, time: -1, timeBasis: "month", recommendation: false },
  "currency-per-device-per-month": { currency: 1, devices: -1, time: -1, timeBasis: "month", recommendation: false },
  month: { currency: 0, devices: 0, time: 1, timeBasis: "month", recommendation: false },
  year: { currency: 0, devices: 0, time: 1, timeBasis: "year", recommendation: false },
  "three-year-total": { currency: 1, devices: 0, time: 0, timeBasis: null, recommendation: false },
  recommendation: { currency: 0, devices: 0, time: 0, timeBasis: null, recommendation: true },
};

export function dimensionsForUnit(unit: Unit): UnitDimensions {
  return { ...UNIT_DIMENSIONS[unit] };
}

type UnitBearingNode = { unitSpec: { unit: Unit } };

function canonicalUnitForDimensions(dimensions: UnitDimensions): Unit | null {
  if (dimensions.recommendation) return "recommendation";
  if (dimensions.currency === 1 && dimensions.devices === 0 && dimensions.time === 0) return "currency";
  if (dimensions.currency === 1 && dimensions.devices === -1 && dimensions.time === 0) return "currency-per-device";
  if (dimensions.currency === 1 && dimensions.devices === 0 && dimensions.time === -1 && dimensions.timeBasis === "month") return "currency-per-month";
  if (dimensions.currency === 1 && dimensions.devices === -1 && dimensions.time === -1 && dimensions.timeBasis === "month") return "currency-per-device-per-month";
  if (dimensions.currency === 0 && dimensions.devices === 1 && dimensions.time === 0) return "devices";
  if (dimensions.currency === 0 && dimensions.devices === 0 && dimensions.time === 1 && dimensions.timeBasis === "month") return "month";
  if (dimensions.currency === 0 && dimensions.devices === 0 && dimensions.time === 1 && dimensions.timeBasis === "year") return "year";
  if (dimensions.currency === 0 && dimensions.devices === 0 && dimensions.time === 0) return "scalar";
  return null;
}

export function inferCalculationOutputUnit(calculation: CalculationSpec, nodeMap: Map<string, UnitBearingNode>): Unit | null {
  if (calculation.operation === "select-candidate" || calculation.operation === "compare-lower") return "recommendation";
  if (calculation.operation === "convert-duration") return calculation.toUnit;
  const units = calculation.operands.map((operand) => operand.kind === "literal" ? operand.unit : nodeMap.get(operand.nodeId)?.unitSpec.unit ?? null);
  if (units.some((unit) => unit === null)) return null;
  const knownUnits = units as Unit[];
  if (calculation.operation === "percentage-adjustment") return knownUnits[0];
  const dimensions = knownUnits.map(dimensionsForUnit);
  if (calculation.operation === "divide" && calculation.outputUnit === "ratio" && dimensions.slice(1).every((dimension) => sameDimensions(dimension, dimensions[0]))) return "ratio";
  if (calculation.operation === "add" || calculation.operation === "subtract") {
    return dimensions.every((dimension) => sameDimensions(dimension, dimensions[0])) ? canonicalUnitForDimensions(dimensions[0]) : null;
  }
  const timeBases = new Set(dimensions.filter((dimension) => dimension.time !== 0 && dimension.timeBasis !== null).map((dimension) => dimension.timeBasis));
  const combined = dimensions.reduce<UnitDimensions>((result, dimension, index) => ({
    currency: result.currency + (calculation.operation === "divide" && index > 0 ? -dimension.currency : dimension.currency),
    devices: result.devices + (calculation.operation === "divide" && index > 0 ? -dimension.devices : dimension.devices),
    time: result.time + (calculation.operation === "divide" && index > 0 ? -dimension.time : dimension.time),
    timeBasis: timeBases.size === 1 ? [...timeBases][0] : null,
    recommendation: result.recommendation || dimension.recommendation,
  }), { currency: 0, devices: 0, time: 0, timeBasis: null, recommendation: false });
  return canonicalUnitForDimensions(combined);
}

function sameDimensions(left: UnitDimensions, right: UnitDimensions): boolean {
  return left.currency === right.currency && left.devices === right.devices && left.time === right.time && left.recommendation === right.recommendation && (left.time === 0 || left.timeBasis === right.timeBasis);
}

function operandUnit(operand: Exclude<CalculationSpec, { operation: "select-candidate" | "convert-duration" }>["operands"][number], nodeMap: Map<string, EvaluatedNode>): Unit | null {
  return operand.kind === "literal" ? operand.unit : nodeMap.get(operand.nodeId)?.unitSpec.unit ?? null;
}

function arithmeticUnitMismatch(calc: Exclude<CalculationSpec, { operation: "select-candidate" | "convert-duration" }>, nodeMap: Map<string, EvaluatedNode>): string | null {
  const units = calc.operands.map((operand) => operandUnit(operand, nodeMap));
  if (units.some((unit) => unit === null)) return "Unit provenance missing for a calculation operand.";
  const dimensions = (units as Unit[]).map(dimensionsForUnit);
  const output = dimensionsForUnit(calc.outputUnit);
  if (calc.operation === "percentage-adjustment") {
    if (!sameDimensions(dimensions[0], output) || !["percent", "ratio"].includes(units[1]!)) return "Percentage adjustment has incompatible declared units.";
    return null;
  }
  if (calc.operation === "compare-lower") {
    if (!output.recommendation || !sameDimensions(dimensions[0], dimensions[1])) return "Comparison operands have incompatible declared units.";
    return null;
  }
  if (calc.operation === "add" || calc.operation === "subtract") {
    if (dimensions.some((dimension) => !sameDimensions(dimension, dimensions[0])) || !sameDimensions(dimensions[0], output)) return "Additive operands do not resolve to the declared output unit.";
    return null;
  }
  const timeBases = new Set(dimensions.filter((dimension) => dimension.time !== 0 && dimension.timeBasis).map((dimension) => dimension.timeBasis));
  if (timeBases.size > 1) {
    const monthlyRateOperand = calc.operands.find((operand) => ["currency-per-month", "currency-per-device-per-month"].includes(operandUnit(operand, nodeMap) ?? ""));
    const yearlyDurationOperand = calc.operands.find((operand) => operandUnit(operand, nodeMap) === "year");
    const rateLabel = monthlyRateOperand?.kind === "ref" ? nodeMap.get(monthlyRateOperand.nodeId)?.label ?? "Monthly rate" : "Monthly rate";
    const durationValue = yearlyDurationOperand?.kind === "literal" ? yearlyDurationOperand.value : yearlyDurationOperand?.kind === "ref" ? nodeMap.get(yearlyDurationOperand.nodeId)?.value : undefined;
    return `Unit mismatch: ${rateLabel} is charged per month, but the memo multiplies it by ${typeof durationValue === "number" ? durationValue : "a"} year${durationValue === 1 ? "" : "s"}. Explicit conversion is required.`;
  }
  const combined = dimensions.reduce<UnitDimensions>((result, dimension, index) => ({
    currency: result.currency + (calc.operation === "divide" && index > 0 ? -dimension.currency : dimension.currency),
    devices: result.devices + (calc.operation === "divide" && index > 0 ? -dimension.devices : dimension.devices),
    time: result.time + (calc.operation === "divide" && index > 0 ? -dimension.time : dimension.time),
    timeBasis: result.timeBasis ?? dimension.timeBasis,
    recommendation: result.recommendation || dimension.recommendation,
  }), { currency: 0, devices: 0, time: 0, timeBasis: null, recommendation: false });
  if (!sameDimensions(combined, output)) {
    const recurring = dimensions.some((dimension) => dimension.time < 0);
    const duration = dimensions.some((dimension) => dimension.time > 0);
    if (recurring && !duration) return "Duration unit missing: a recurring rate requires an explicit month or year operand.";
    return "Calculation operands do not resolve to the declared output unit.";
  }
  return null;
}

function unitMismatch(calc: CalculationSpec, nodeMap: Map<string, EvaluatedNode>): string | null {
  if (calc.operation === "select-candidate") return null;
  if (calc.operation === "convert-duration") {
    const input = nodeMap.get(calc.inputNodeId);
    if (!input || input.unitSpec.unit !== calc.fromUnit || calc.outputUnit !== calc.toUnit || calc.fromUnit === calc.toUnit) return "Explicit duration conversion has incompatible declared units.";
    return null;
  }
  return arithmeticUnitMismatch(calc, nodeMap);
}

export function evaluateCandidateSelection(calc: CandidateSelection, nodeMap: Map<string, EvaluatedNode>): CandidateSelectionOutcome {
  const eligible = calc.candidates.flatMap((candidate) => {
    const valueNode = nodeMap.get(candidate.valueNodeId);
    const maximumNode = candidate.maximumValueNodeId ? nodeMap.get(candidate.maximumValueNodeId) : null;
    const maximumValue = maximumNode?.value;
    const numericMaximum = typeof maximumValue === "number" ? maximumValue : null;
    if (!valueNode || (candidate.maximumValueNodeId && !maximumNode)) throw new CalculationContractError("UNDECLARED_DEPENDENCY");
    if (typeof valueNode.value !== "number" || (maximumNode && typeof maximumValue !== "number")) {
      throw new CalculationContractError("INPUT_TYPE_MISMATCH");
    }
    return numericMaximum === null || valueNode.value <= numericMaximum ? [{ label: candidate.label, value: valueNode.value }] : [];
  });
  if (eligible.length === 0) return { value: "Unresolved", reason: "NONDETERMINISTIC_SELECTION" };
  const minimum = Math.min(...eligible.map((candidate) => candidate.value));
  const tied = eligible.filter((candidate) => candidate.value === minimum);
  if (tied.length === 1) return { value: tied[0].label, reason: null };
  if (calc.tieResult === null) return { value: "Unresolved", reason: "UNRESOLVED_TIE" };
  if (!tied.some((candidate) => candidate.label === calc.tieResult)) {
    throw new CalculationContractError("NONDETERMINISTIC_SELECTION");
  }
  return { value: calc.tieResult, reason: null };
}

function evaluateCalculation(calc: CalculationSpec, nodeMap: Map<string, EvaluatedNode>): number | string {
  if (calc.operation === "select-candidate") return evaluateCandidateSelection(calc, nodeMap).value;
  if (calc.operation === "convert-duration") {
    const value = nodeMap.get(calc.inputNodeId)?.value;
    if (typeof value !== "number") throw new CalculationContractError("INPUT_TYPE_MISMATCH");
    if (calc.fromUnit === "year" && calc.toUnit === "month") return value * 12;
    if (calc.fromUnit === "month" && calc.toUnit === "year") return value / 12;
    throw new CalculationContractError("INVALID_OPERAND");
  }
  const values = calc.operands.map((operand) => {
    if (operand.kind === "literal") return operand.value;
    const value = nodeMap.get(operand.nodeId)?.value;
    if (value === undefined) throw new Error(`Missing calculated value for dependency ${operand.nodeId}`);
    return value;
  });
  const numbers = values.map((value) => {
    if (typeof value !== "number") throw new Error(`Expected numeric operand, received ${value}`);
    return value;
  });
  switch (calc.operation) {
    case "add":
      return numbers.reduce((sum, value) => sum + value, 0);
    case "subtract":
      return numbers.slice(1).reduce((value, operand) => value - operand, numbers[0]);
    case "multiply":
      return numbers.reduce((product, value) => product * value, 1);
    case "divide":
      return numbers.slice(1).reduce((value, operand) => value / operand, numbers[0]);
    case "percentage-adjustment":
      {
        const adjustmentOperand = calc.operands[1];
        const adjustmentUnit = adjustmentOperand.kind === "literal"
          ? adjustmentOperand.unit
          : nodeMap.get(adjustmentOperand.nodeId)?.unitSpec.unit;
        if (adjustmentUnit !== "percent" && adjustmentUnit !== "ratio") {
          throw new Error("Percentage adjustment requires an explicit percent or ratio operand");
        }
        const ratio = adjustmentUnit === "percent" ? numbers[1] / 100 : numbers[1];
        return numbers[0] * (1 + ratio);
      }
    case "compare-lower":
      return numbers[0] <= numbers[1] ? "Vendor A" : "Vendor B";
  }
}

export function evaluateGraph(input: DecisionGraph, sourceSpanIds: Set<string>): EvaluationResult {
  const graph = materializeCalculationDependencies(DecisionGraphSchema.parse(input));
  const order = topologicalSortMaterialized(graph);
  const incoming = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of graph.edges) incoming.get(edge.to)?.push(edge.from);

  const nodeMap = new Map<string, EvaluatedNode>();
  for (const node of graph.nodes) {
    nodeMap.set(node.id, { ...structuredClone(node), testResults: [] });
  }

  const propagationTrace: string[] = [];
  for (const id of order) {
    const node = nodeMap.get(id)!;
    const dependencies = incoming.get(id) ?? [];
    const brokenDependency = dependencies.find((dependencyId) => nodeMap.get(dependencyId)?.status === "broken");
    const missingSource = node.sourceSpanIds.find((spanId) => !sourceSpanIds.has(spanId));

    if (missingSource) {
      node.status = "broken";
      node.statusReason = `Missing source binding: ${missingSource}`;
      node.testResults.push({ label: "Source binding", passed: false, detail: node.statusReason });
      propagationTrace.push(id);
      continue;
    }

    if (node.sourceSpanIds.length > 0) {
      node.testResults.push({ label: "Source binding", passed: true, detail: `${node.sourceSpanIds.length} exact source passage${node.sourceSpanIds.length === 1 ? "" : "s"} bound.` });
    }

    if (brokenDependency && nodeMap.get(brokenDependency)?.value === undefined) {
      node.status = "broken";
      node.statusReason = `Depends on broken claim: ${nodeMap.get(brokenDependency)?.label}.`;
      node.testResults.push({ label: "Dependency integrity", passed: false, detail: node.statusReason });
      propagationTrace.push(id);
      continue;
    }

    if (node.calculation) {
      node.value = evaluateCalculation(node.calculation, nodeMap);
      const mismatch = unitMismatch(node.calculation, nodeMap);
      node.testResults.push({ label: "Deterministic calculation", passed: true, detail: node.calculation.displayFormula });
      if (mismatch) {
        node.status = "broken";
        node.statusReason = mismatch;
        node.testResults.push({ label: "Unit compatibility", passed: false, detail: mismatch });
        propagationTrace.push(id);
        continue;
      }
      node.testResults.push({ label: "Unit compatibility", passed: true, detail: `Operands resolve to ${node.calculation.outputUnit}.` });
    }

    if (brokenDependency) {
      node.status = "broken";
      node.statusReason = `Depends on broken claim: ${nodeMap.get(brokenDependency)?.label}.`;
      node.testResults.push({ label: "Dependency integrity", passed: false, detail: node.statusReason });
      propagationTrace.push(id);
      continue;
    }

    if (node.type === "assumption") {
      node.status = "assumed";
      node.statusReason = node.statusReason || "Declared assumption; not source-backed.";
    } else if (node.calculation) {
      node.status = "calculated";
      node.statusReason = `Computed deterministically in topological position ${order.indexOf(id) + 1}.`;
    } else {
      node.status = "supported";
      node.statusReason = `Bound to ${node.sourceSpanIds.length} exact source passage${node.sourceSpanIds.length === 1 ? "" : "s"}.`;
    }
  }

  const nodes = graph.nodes.map((node) => nodeMap.get(node.id)!);
  const totalWeight = nodes.reduce((sum, node) => sum + WEIGHTS[node.type], 0);
  const passingWeight = nodes.reduce(
    (sum, node) => sum + (node.status === "broken" || node.status === "contradicted" ? 0 : WEIGHTS[node.type]),
    0,
  );
  return {
    nodes,
    order,
    propagationTrace,
    integrity: {
      score: Math.round((passingWeight / totalWeight) * 100),
      passingWeight,
      totalWeight,
      formula: "sum(passing claim weights) ÷ sum(all claim weights) × 100; fact/policy/assumption=1, calculation/comparison=2, recommendation=3",
    },
  };
}

export function applyCorrection(graph: DecisionGraph, correction: Correction): DecisionGraph {
  const next = materializeCalculationDependencies(graph);
  const target = next.nodes.find((node) => node.id === correction.targetNodeId);
  if (!target) throw new Error(`Correction target not found: ${correction.targetNodeId}`);
  const nodeIds = new Set(next.nodes.map((node) => node.id));
  const replacementDependencies = calculationDependencyDescriptors(correction.replacementCalculation);
  for (const descriptor of replacementDependencies) {
    if (!nodeIds.has(descriptor.nodeId)) throw new GraphDependencyError("CORRECTION_OPERAND_NODE_MISSING", target.id, descriptor.nodeId);
    if (descriptor.nodeId === target.id) throw new GraphDependencyError("CORRECTION_SELF_DEPENDENCY", target.id, descriptor.nodeId);
  }
  const replacementCalculationInputs = new Set(replacementDependencies.filter((descriptor) => descriptor.kind === "calculation-input").map((descriptor) => descriptor.nodeId));
  next.edges = next.edges.filter((edge) => edge.to !== target.id || edge.kind !== "calculation-input" || replacementCalculationInputs.has(edge.from));
  target.calculation = structuredClone(correction.replacementCalculation);
  let corrected: DecisionGraph;
  try {
    corrected = materializeCalculationDependencies(next);
  } catch (error) {
    if (error instanceof GraphDependencyError) throw error;
    throw new GraphDependencyError("CORRECTION_DEPENDENCY_MATERIALIZATION_FAILED", target.id);
  }
  try {
    topologicalSortMaterialized(corrected);
  } catch (error) {
    if (error instanceof GraphDependencyError && error.code === "GRAPH_CYCLE") throw new GraphDependencyError("CORRECTION_CREATES_CYCLE", target.id);
    throw error;
  }
  return corrected;
}

export function resetGraph(original: DecisionGraph): DecisionGraph {
  return cloneGraph(original);
}

export function semanticDiff(before: EvaluationResult, after: EvaluationResult) {
  const beforeMap = new Map(before.nodes.map((node) => [node.id, node]));
  return after.nodes
    .filter((node) => beforeMap.get(node.id)?.value !== node.value || beforeMap.get(node.id)?.status !== node.status)
    .map((node) => ({
      nodeId: node.id,
      label: node.label,
      before: beforeMap.get(node.id)?.value,
      after: node.value,
      statusBefore: beforeMap.get(node.id)?.status,
      statusAfter: node.status,
    }));
}

export function buildProofReport(
  projectId: string,
  result: EvaluationResult,
  original: EvaluationResult,
  spans: SourceSpan[],
  options: { phase: ProofPhase; generatedAt?: string; mode?: ProofMode },
): ProofReport {
  const effectiveResult = evaluationForPhase(result, options.phase);
  const recommendation = effectiveResult.nodes.find((node) => node.type === "recommendation");
  const recommendationState = options.phase === "not-verified"
    ? "not-verified"
    : options.phase === "corrected"
      ? "corrected"
      : recommendation?.status === "broken" || recommendation?.status === "contradicted"
        ? "broken"
        : "valid";
  const summary = Object.fromEntries(
    ["supported", "calculated", "assumed", "contradicted", "stale", "broken", "pending"].map((status) => [
      status,
      effectiveResult.nodes.filter((node) => node.status === status).length,
    ]),
  ) as ProofReport["summary"];
  return ProofReportSchema.parse({
    projectId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    mode: options.mode ?? "deterministic-demo",
    phase: options.phase,
    recommendation: String(recommendation?.value ?? "Unresolved"),
    recommendationState,
    summary,
    originalValues: Object.fromEntries(original.nodes.filter((node) => node.value !== undefined).map((node) => [node.id, node.value!])),
    currentValues: Object.fromEntries(effectiveResult.nodes.filter((node) => node.value !== undefined).map((node) => [node.id, node.value!])),
    correctedValues: options.phase === "corrected"
      ? Object.fromEntries(effectiveResult.nodes.filter((node) => node.value !== undefined).map((node) => [node.id, node.value!]))
      : null,
    failures: effectiveResult.nodes.filter((node) => node.status === "broken" || node.status === "contradicted").map((node) => `${node.label}: ${node.statusReason}`),
    assumptions: effectiveResult.nodes.filter((node) => node.status === "assumed").map((node) => node.statement),
    sourceReferences: spans,
    dependencyPath: effectiveResult.order,
  });
}

export function evaluationForPhase(result: EvaluationResult, phase: ProofPhase): EvaluationResult {
  if (phase !== "not-verified") return result;
  return {
    ...result,
    nodes: result.nodes.map((node) => ({
      ...node,
      status: "pending",
      statusReason: "Verification has not run yet.",
      testResults: [],
    })),
    propagationTrace: [],
    integrity: {
      score: 0,
      passingWeight: 0,
      totalWeight: result.integrity.totalWeight,
      formula: result.integrity.formula,
    },
  };
}

export function materializeEvaluatedGraph(graph: DecisionGraph, result: EvaluationResult): DecisionGraph {
  const evaluatedById = new Map(result.nodes.map((node) => [node.id, node]));
  graph = materializeCalculationDependencies(graph);
  return DecisionGraphSchema.parse({
    ...structuredClone(graph),
    nodes: graph.nodes.map((node) => {
      const evaluated = evaluatedById.get(node.id);
      if (!evaluated) throw new Error(`Evaluated node not found: ${node.id}`);
      return {
        ...structuredClone(node),
        status: evaluated.status,
        statusReason: evaluated.statusReason,
        value: evaluated.value,
      };
    }),
  });
}

export function buildProofExport(
  projectId: string,
  graph: DecisionGraph,
  result: EvaluationResult,
  original: EvaluationResult,
  spans: SourceSpan[],
  options: { phase: ProofPhase; generatedAt?: string; mode?: ProofMode },
): ProofExport {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const effectiveResult = evaluationForPhase(result, options.phase);
  return ProofExportSchema.parse({
    schemaVersion: "1.0",
    projectId,
    generatedAt,
    mode: options.mode ?? "deterministic-demo",
    phase: options.phase,
    graph: materializeEvaluatedGraph(graph, effectiveResult),
    report: buildProofReport(projectId, result, original, spans, { ...options, generatedAt }),
  });
}
