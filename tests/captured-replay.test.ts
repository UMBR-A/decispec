// @vitest-environment node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { proofEngineAnalysisInput } from "./fixtures/proof-engine-project";
import {
  validateProviderProposal,
  type AnalysisResult,
  type ProviderAnalysisPlan,
} from "../lib/providers/analysis-provider";
import {
  applyCorrection,
  buildProofExport,
  findDependencyPath,
  materializeCalculationDependencies,
  topologicalSort,
} from "../lib/domain/engine";
import { executeLiveProof } from "../lib/providers/live-proof";
import { buildSourceSegmentRegistry } from "../lib/providers/source-segments";
import { SafeValidationError } from "../lib/providers/safe-validation";
import { recoverSourceNumbers, type SourceNumericRole } from "../lib/providers/source-unit-recovery";
import type { CalculationSpec } from "../lib/domain/schemas";

const nativeReplayPath = "work/live-debug/synthetic-school-acceptance-replay.json";
const legacyReplayPath = "work/live-debug/synthetic-school-acceptance-replay.pre-native-live.json";
const repositoryReplayPath = "tests/fixtures/native-segment-replay.json";

type QuoteBinding = { start: number; end: number; length: number; sha256: string };
type ReplayArtifact = {
  fixtureId: string;
  safeMetadata?: Omit<AnalysisResult, "plan" | "provider">;
  structuredOutput: {
    sourceSpans?: Array<Record<string, unknown>>;
    sourceBindings?: Array<Record<string, unknown>>;
    graph?: { nodes?: Array<{ numericRole?: SourceNumericRole | null; sourceSpanIds?: string[] }> };
  };
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function migrateLegacyReplay(artifact: ReplayArtifact): ReplayArtifact {
  const input = proofEngineAnalysisInput();
  const hydrated = structuredClone(artifact.structuredOutput);
  if (!hydrated.sourceSpans) return { ...artifact, structuredOutput: hydrated };
  const registry = buildSourceSegmentRegistry(input);
  const requiredRoles = new Map<string, Set<SourceNumericRole>>();
  for (const node of hydrated.graph?.nodes ?? []) {
    if (!node.numericRole) continue;
    for (const spanId of node.sourceSpanIds ?? []) {
      const roles = requiredRoles.get(spanId) ?? new Set<SourceNumericRole>();
      roles.add(node.numericRole);
      requiredRoles.set(spanId, roles);
    }
  }
  const roleBindingIds = new Map<string, Map<SourceNumericRole, string>>();
  hydrated.sourceBindings = hydrated.sourceSpans.flatMap((span) => {
    const binding = span.quoteBinding as QuoteBinding;
    const document = input.documents.find((candidate) => candidate.id === span.documentId);
    if (!document) throw new Error("Replay document binding is unavailable.");
    const quote = document.content.slice(binding.start, binding.end);
    if (quote.length !== binding.length || sha256(quote) !== binding.sha256) throw new Error("Replay source binding hash mismatch.");
    const emphasis = typeof span.emphasis === "string" ? span.emphasis : null;
    const candidates = registry.segments.filter((segment) => segment.documentId === span.documentId && segment.start >= binding.start && segment.end <= binding.end);
    const baseSelected = candidates.filter((segment) => segment.type === "numeric-evidence" && emphasis !== null && (emphasis.includes(segment.content) || segment.content.includes(emphasis))).sort((a, b) => b.content.length - a.content.length)[0]
      ?? candidates.filter((segment) => emphasis !== null && segment.content.includes(emphasis)).sort((a, b) => a.content.length - b.content.length)[0]
      ?? candidates.find((segment) => segment.content === quote);
    if (!baseSelected) throw new Error("Legacy replay cannot be mapped to a deterministic source segment.");
    const semanticRole = span.documentId === "policy" ? "policy" : span.documentId === "memo" ? "recommendation" : "fact";
    const migrated = [{ bindingId: span.id, documentId: span.documentId, segmentIds: [baseSelected.id], semanticRole, emphasisSegmentIds: [baseSelected.id] }];
    const roles = requiredRoles.get(String(span.id)) ?? new Set<SourceNumericRole>();
    const ids = new Map<SourceNumericRole, string>();
    for (const role of roles) {
      const selected = candidates.filter((segment) => segment.type === "numeric-evidence" && recoverSourceNumbers(segment.content).some((fact) => fact.role === role)).sort((a, b) => b.content.length - a.content.length)[0];
      if (!selected) continue;
      const bindingId = roles.size === 1 ? String(span.id) : `${String(span.id)}-${role}`;
      ids.set(role, bindingId);
      if (bindingId !== span.id) migrated.push({ bindingId, documentId: span.documentId, segmentIds: [selected.id], semanticRole, emphasisSegmentIds: [selected.id] });
      else migrated[0] = { ...migrated[0], segmentIds: [selected.id], emphasisSegmentIds: [selected.id] };
    }
    roleBindingIds.set(String(span.id), ids);
    return migrated;
  });
  for (const node of hydrated.graph?.nodes ?? []) {
    if (!node.numericRole) continue;
    node.sourceSpanIds = (node.sourceSpanIds ?? []).map((spanId) => roleBindingIds.get(spanId)?.get(node.numericRole!) ?? spanId);
  }
  delete hydrated.sourceSpans;
  return { ...artifact, structuredOutput: hydrated };
}

function loadReplay(relativePath: string): ReplayArtifact {
  return migrateLegacyReplay(JSON.parse(readFileSync(path.resolve(relativePath), "utf8")) as ReplayArtifact);
}

function validateReplay(artifact: ReplayArtifact) {
  try {
    return validateProviderProposal(artifact.structuredOutput, proofEngineAnalysisInput());
  } catch (error) {
    if (error instanceof SafeValidationError) throw new Error(`Replay failed safely at ${error.diagnostic.stage}:${error.diagnostic.code}:${error.diagnostic.path}`);
    throw error;
  }
}

function referencedNodeIds(calculation: CalculationSpec | undefined): string[] {
  if (!calculation) return [];
  if (calculation.operation === "select-candidate") return [...new Set(calculation.candidates.flatMap((candidate) => [candidate.valueNodeId, ...(candidate.maximumValueNodeId ? [candidate.maximumValueNodeId] : [])]))];
  if (calculation.operation === "convert-duration") return [calculation.inputNodeId];
  return calculation.operands.flatMap((operand) => operand.kind === "ref" ? [operand.nodeId] : []);
}

function edgeKey(edge: { from: string; to: string; kind: string }): string {
  return JSON.stringify([edge.from, edge.to, edge.kind]);
}

function assertSemanticReplay(artifact: ReplayArtifact) {
  const plan = validateReplay(artifact);
  const result: AnalysisResult = {
    plan,
    provider: { name: "Captured OpenAI replay", mode: "live-openai", model: "gpt-5.6-terra" },
    requestId: artifact.safeMetadata?.requestId ?? null,
    latencyMs: artifact.safeMetadata?.latencyMs ?? null,
    usage: artifact.safeMetadata?.usage ?? null,
  };
  const proof = executeLiveProof(result, artifact.fixtureId);
  const graph = plan.graph;
  const graphNodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const originalNodes = new Map(proof.original.nodes.map((node) => [node.id, node]));
  const correctedNodes = new Map(proof.corrected.nodes.map((node) => [node.id, node]));

  const recommendations = graph.nodes.filter((node) => node.type === "recommendation" && node.calculation?.operation === "select-candidate");
  expect(recommendations).toHaveLength(1);
  const recommendation = recommendations[0];
  if (recommendation.calculation?.operation !== "select-candidate") throw new Error("Expected deterministic selector.");
  const selector = recommendation.calculation;
  const brokenCandidates = selector.candidates.filter((candidate) => originalNodes.get(candidate.valueNodeId)?.status === "broken");
  expect(brokenCandidates).toHaveLength(1);
  const brokenCandidate = brokenCandidates[0];
  const alternateCandidates = selector.candidates.filter((candidate) => candidate.valueNodeId !== brokenCandidate.valueNodeId);
  expect(alternateCandidates).toHaveLength(1);
  const alternateCandidate = alternateCandidates[0];
  const brokenTotal = graphNodes.get(brokenCandidate.valueNodeId)!;

  const monthlyRateNodes = proof.original.nodes.filter((node) => node.value === 18 && node.unitSpec.unit === "currency-per-device-per-month" && node.sourceSpanIds.some((id) => plan.sourceSpans.find((span) => span.id === id)?.quote === "$18 per device per month"));
  expect(monthlyRateNodes).toHaveLength(1);
  const monthlyRate = monthlyRateNodes[0];
  const supportCandidates = graph.nodes.filter((node) => {
    const calculation = node.calculation;
    if (!calculation || calculation.operation !== "multiply") return false;
    const refs = referencedNodeIds(calculation);
    const hasMonthlyRate = refs.includes(monthlyRate.id);
    const hasYearDuration = refs.some((id) => originalNodes.get(id)?.unitSpec.unit === "year");
    return hasMonthlyRate && hasYearDuration && findDependencyPath(graph, node.id, brokenTotal.id) !== null;
  });
  expect(supportCandidates).toHaveLength(1);
  const support = supportCandidates[0];
  expect(originalNodes.get(support.id)?.status).toBe("broken");
  const supportToTotal = findDependencyPath(graph, support.id, brokenTotal.id);
  const totalToRecommendation = findDependencyPath(graph, brokenTotal.id, recommendation.id);
  expect(supportToTotal).not.toBeNull();
  expect(totalToRecommendation).not.toBeNull();
  expect([...supportToTotal!, ...totalToRecommendation!.slice(1)].every((id) => originalNodes.get(id)?.status === "broken")).toBe(true);

  const originalRefs = referencedNodeIds(support.calculation);
  const originalDurations = originalRefs.filter((id) => originalNodes.get(id)?.unitSpec.unit === "year");
  expect(originalDurations).toHaveLength(1);
  const originalDurationId = originalDurations[0];
  expect(originalNodes.get(originalDurationId)).toMatchObject({ value: 3, unitSpec: { unit: "year" } });
  expect(originalNodes.get(support.id)?.testResults).toContainEqual(expect.objectContaining({ label: "Unit compatibility", passed: false }));

  const corrections = graph.corrections.filter((candidate) => candidate.targetNodeId === support.id);
  expect(corrections).toHaveLength(1);
  const correction = corrections[0];
  expect(correction.replacementCalculation.operation).toBe("multiply");
  const replacementRefs = referencedNodeIds(correction.replacementCalculation);
  expect(replacementRefs.every((id) => graphNodes.has(id))).toBe(true);
  const introducedRefs = replacementRefs.filter((id) => !originalRefs.includes(id));
  const monthlyDurations = introducedRefs.filter((id) => originalNodes.get(id)?.unitSpec.unit === "month");
  expect(monthlyDurations).toHaveLength(1);
  const monthlyDurationId = monthlyDurations[0];
  expect(originalNodes.get(monthlyDurationId)).toMatchObject({ value: 36, unitSpec: { unit: "month" } });
  expect(originalNodes.get(monthlyDurationId)?.sourceSpanIds.length).toBeGreaterThan(0);

  const materializedOriginal = materializeCalculationDependencies(graph);
  const correctedGraph = applyCorrection(graph, correction);
  expect(correctedGraph.nodes.find((node) => node.id === support.id)?.calculation).toEqual(correction.replacementCalculation);
  expect(correctedGraph.edges).toContainEqual(expect.objectContaining({ from: monthlyDurationId, to: support.id, kind: "calculation-input" }));
  expect(correctedGraph.edges).not.toContainEqual(expect.objectContaining({ from: originalDurationId, to: support.id, kind: "calculation-input" }));
  const correctedEdgeKeys = new Set(correctedGraph.edges.map(edgeKey));
  for (const edge of materializedOriginal.edges.filter((candidate) => candidate.kind !== "calculation-input")) expect(correctedEdgeKeys.has(edgeKey(edge))).toBe(true);
  expect(topologicalSort(correctedGraph)).toHaveLength(correctedGraph.nodes.length);

  expect(monthlyRate).toMatchObject({ value: 18, unitSpec: { unit: "currency-per-device-per-month" } });
  expect(correctedNodes.get(support.id)?.value).toBe(208_008);
  expect(correctedNodes.get(brokenTotal.id)?.value).toBe(268_677);
  expect(correctedNodes.get(alternateCandidate.valueNodeId)?.value).toBe(85_929);
  expect(correctedNodes.get(recommendation.id)?.value).toBe("Vendor B");
  expect(proof.report).toMatchObject({ recommendation: "Vendor B", recommendationState: "corrected" });
  expect(proof.report.currentValues).toEqual(proof.report.correctedValues);

  const exported = buildProofExport(artifact.fixtureId, correctedGraph, proof.corrected, proof.original, plan.sourceSpans, { phase: "corrected", mode: "live-openai", generatedAt: "2026-07-18T00:00:00.000Z" });
  const exportedNodes = new Map(exported.graph.nodes.map((node) => [node.id, node]));
  for (const evaluated of proof.corrected.nodes) expect(exportedNodes.get(evaluated.id)).toMatchObject({ status: evaluated.status, statusReason: evaluated.statusReason, value: evaluated.value });
  expect(exported.graph.nodes.every((node) => node.status !== "pending" && node.status !== "stale")).toBe(true);
  expect(exported.graph.edges).toContainEqual(expect.objectContaining({ from: monthlyDurationId, to: support.id, kind: "calculation-input" }));
  expect(exported.graph.edges).not.toContainEqual(expect.objectContaining({ from: originalDurationId, to: support.id, kind: "calculation-input" }));
  expect(exported.report.currentValues).toEqual(proof.report.currentValues);
  expect(exported.report.correctedValues).toEqual(proof.report.correctedValues);
  expect(exported.report.recommendation).toBe(correctedNodes.get(recommendation.id)?.value);
  expect(exported.report.currentValues[support.id]).toBe(exportedNodes.get(support.id)?.value);
  expect(exported.report.currentValues[brokenTotal.id]).toBe(exportedNodes.get(brokenTotal.id)?.value);
  expect(exported.report.currentValues[alternateCandidate.valueNodeId]).toBe(exportedNodes.get(alternateCandidate.valueNodeId)?.value);
  return { plan, proof };
}

function shuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let state = seed >>> 0;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    const swap = state % (index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function remapCalculation(calculation: ProviderAnalysisPlan["graph"]["nodes"][number]["calculation"], ref: (id: string) => string) {
  if (calculation === null) return null;
  if (calculation.operation === "select-candidate") return { ...calculation, candidates: calculation.candidates.map((candidate) => ({ ...candidate, valueNodeId: ref(candidate.valueNodeId), maximumValueNodeId: candidate.maximumValueNodeId ? ref(candidate.maximumValueNodeId) : null })) };
  if (calculation.operation === "convert-duration") return { ...calculation, inputNodeId: ref(calculation.inputNodeId) };
  return { ...calculation, operands: calculation.operands.map((operand) => operand.kind === "ref" ? { ...operand, nodeId: ref(operand.nodeId) } : operand) };
}

function randomizedProposal(raw: unknown, seed: number): ProviderAnalysisPlan {
  const proposal = structuredClone(raw) as ProviderAnalysisPlan;
  const arithmeticTarget = proposal.graph.nodes.find((node) => node.calculation && node.calculation.operation !== "select-candidate" && node.calculation.operation !== "convert-duration" && !proposal.graph.corrections.some((correction) => correction.targetNodeId === node.id));
  if (!arithmeticTarget?.calculation || arithmeticTarget.calculation.operation === "select-candidate" || arithmeticTarget.calculation.operation === "convert-duration") throw new Error("No decoy correction target available.");
  proposal.graph.corrections.push({ id: `decoy_${seed}`, title: "Decoy", description: "Decoy", targetNodeId: arithmeticTarget.id, replacementCalculation: structuredClone(arithmeticTarget.calculation) });
  const ids = new Map(proposal.graph.nodes.map((node, index) => [node.id, `opaque_${seed}_${index}_${(seed * 7919 + index * 104729) >>> 0}`]));
  const ref = (id: string) => ids.get(id) ?? id;
  proposal.graph.nodes = shuffle(proposal.graph.nodes.map((node) => ({ ...node, id: ref(node.id), calculation: remapCalculation(node.calculation, ref) })), seed);
  proposal.graph.edges = shuffle(proposal.graph.edges.map((edge, index) => ({ ...edge, id: `edge_${seed}_${index}`, from: ref(edge.from), to: ref(edge.to) })), seed + 1);
  proposal.graph.recommendation.nodeId = ref(proposal.graph.recommendation.nodeId);
  proposal.graph.corrections = shuffle(proposal.graph.corrections.map((correction, index) => ({
    ...correction,
    id: `correction_${seed}_${index}`,
    targetNodeId: ref(correction.targetNodeId),
    replacementCalculation: remapCalculation(correction.replacementCalculation, ref) as typeof correction.replacementCalculation,
  })), seed + 2);
  const recommendation = proposal.graph.nodes.find((node) => node.type === "recommendation");
  if (recommendation?.calculation?.operation === "select-candidate") recommendation.calculation.candidates = shuffle(recommendation.calculation.candidates, seed + 3);
  proposal.graph.id = `graph_${seed}`;
  return proposal;
}

function assertIgnoredReplay(relativePath: string): void {
  execFileSync("git", ["check-ignore", "--quiet", "--", relativePath], { stdio: "ignore" });
  expect(() => execFileSync("git", ["ls-files", "--error-unmatch", "--", relativePath], { stdio: "ignore" })).toThrow();
}

function collectKeysAndStrings(value: unknown, keys: string[] = [], strings: string[] = []): { keys: string[]; strings: string[] } {
  if (Array.isArray(value)) {
    for (const item of value) collectKeysAndStrings(item, keys, strings);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      collectKeysAndStrings(child, keys, strings);
    }
  } else if (typeof value === "string") strings.push(value);
  return { keys, strings };
}

function assertReplayContentSafe(artifact: ReplayArtifact, proseMode: "redacted" | "minimal"): void {
  const { keys, strings } = collectKeysAndStrings(artifact.structuredOutput);
  const forbiddenKeys = new Set(["quote", "sourceSpans", "pageLabel", "section", "start", "end", "content", "prompt", "instructions", "authorization", "apiKey", "error"]);
  expect(keys.some((key) => forbiddenKeys.has(key))).toBe(false);
  expect(strings.join("\n")).not.toMatch(/sk-proj-|OPENAI_API_KEY|raw provider|system prompt|authorization/i);
  const sourceSegments = buildSourceSegmentRegistry(proofEngineAnalysisInput()).segments.filter((segment) => segment.content.length >= 20);
  expect(sourceSegments.some((segment) => strings.some((value) => value.includes(segment.content)))).toBe(false);
  const proposal = artifact.structuredOutput as unknown as ProviderAnalysisPlan;
  for (const node of proposal.graph.nodes) {
    if (proseMode === "redacted") {
      expect(node.label).toMatch(/^\[redacted:/);
      expect(node.statement).toMatch(/^\[redacted:/);
      if (node.calculation) expect(node.calculation.displayFormula).toBe("[redacted formula]");
    } else {
      expect(node.label).toBe("Node");
      expect(node.statement).toBe("Statement");
      if (node.calculation) expect(node.calculation.displayFormula).toBe("Formula");
    }
  }
  for (const correction of proposal.graph.corrections) {
    expect(correction.title).toBe(proseMode === "redacted" ? `[redacted:${correction.id}]` : "Correction");
    expect(correction.description).toBe(proseMode === "redacted" ? `[redacted:${correction.id}]` : "Description");
  }
}

describe("captured real-provider semantic replay", () => {
  const legacyIt = existsSync(path.resolve(legacyReplayPath)) ? it : it.skip;
  const nativeIt = existsSync(path.resolve(nativeReplayPath)) ? it : it.skip;

  legacyIt("replays the legacy redacted structure independently of provider IDs and ordering", () => {
    assertIgnoredReplay(legacyReplayPath);
    assertSemanticReplay(loadReplay(legacyReplayPath));
  });

  nativeIt("replays the native ID-only structure independently of provider IDs and ordering", () => {
    assertIgnoredReplay(nativeReplayPath);
    const artifact = loadReplay(nativeReplayPath);
    assertReplayContentSafe(artifact, "redacted");
    assertSemanticReplay(artifact);
  });

  it.runIf(existsSync(path.resolve(repositoryReplayPath)))("replays the repository-safe native regression fixture", () => {
    const artifact = loadReplay(repositoryReplayPath);
    assertReplayContentSafe(artifact, "minimal");
    assertSemanticReplay(artifact);
  });

  it.each([3, 17, 101, 997])("preserves the semantic proof under opaque IDs and randomized ordering (seed %i)", (seed) => {
    const artifact = loadReplay(nativeReplayPath);
    artifact.structuredOutput = randomizedProposal(artifact.structuredOutput, seed);
    assertSemanticReplay(artifact);
  });
});
