import { DecisionGraphSchema, type ClaimNode, type DecisionGraph, type SourceSpan } from "../../lib/domain/schemas";

const node = (value: Omit<ClaimNode, "status" | "statusReason" | "providerUnitCorrected" | "tests"> & { statusReason?: string }): ClaimNode => ({
  status: "pending",
  statusReason: value.statusReason ?? "Awaiting deterministic evaluation.",
  providerUnitCorrected: false,
  tests: [],
  ...value,
});

export const vendorSourceSpans: SourceSpan[] = [
  ["a-implementation-source", "$180,000"],
  ["a-support-source", "$2,334 per month"],
  ["a-deployment-source", "4 months"],
  ["b-implementation-source", "$210,000"],
  ["b-support-source", "$1,250 per month"],
  ["b-deployment-source", "5 months"],
  ["period-source", "3 years"],
  ["threshold-source", "10%"],
  ["documented-costs-source", "Only documented costs may be used"],
].map(([id, quote]) => ({ id, documentId: "source-documents", pageLabel: "source_documents.txt", section: "Vendor comparison", quote, emphasis: quote }));

export const vendorSourceSpanIds = new Set(vendorSourceSpans.map((span) => span.id));

export const vendorGraph: DecisionGraph = DecisionGraphSchema.parse({
  id: "vendor-live-example",
  nodes: [
    node({ id: "a-implementation", label: "Vendor A implementation", statement: "Vendor A implementation costs $180,000.", type: "fact", value: 180000, unitSpec: { unit: "currency" }, sourceSpanIds: ["a-implementation-source"] }),
    node({ id: "a-support-rate", label: "Vendor A monthly support", statement: "Vendor A support costs $2,334 per month.", type: "fact", value: 2334, unitSpec: { unit: "currency-per-month" }, sourceSpanIds: ["a-support-source"] }),
    node({ id: "b-implementation", label: "Vendor B implementation", statement: "Vendor B implementation costs $210,000.", type: "fact", value: 210000, unitSpec: { unit: "currency" }, sourceSpanIds: ["b-implementation-source"] }),
    node({ id: "b-support-rate", label: "Vendor B monthly support", statement: "Vendor B support costs $1,250 per month.", type: "fact", value: 1250, unitSpec: { unit: "currency-per-month" }, sourceSpanIds: ["b-support-source"] }),
    node({ id: "evaluation-years", label: "Evaluation period", statement: "Evaluate costs over three years.", type: "policy", value: 3, unitSpec: { unit: "year" }, sourceSpanIds: ["period-source"] }),
    node({ id: "evaluation-months", label: "Evaluation period in months", statement: "Convert the sourced three-year period to months.", type: "calculation", unitSpec: { unit: "month" }, sourceSpanIds: [], calculation: { operation: "convert-duration", inputNodeId: "evaluation-years", fromUnit: "year", toUnit: "month", outputUnit: "month", displayFormula: "3 years × 12 months per year = 36 months" } }),
    node({ id: "a-support", label: "Vendor A three-year support", statement: "The memo treats monthly support as if its three-year multiplier were compatible.", type: "calculation", unitSpec: { unit: "currency" }, sourceSpanIds: [], calculation: { operation: "multiply", operands: [{ kind: "ref", nodeId: "a-support-rate" }, { kind: "ref", nodeId: "evaluation-years" }], outputUnit: "currency", displayFormula: "$2,334 per month × 3 years" } }),
    node({ id: "a-total", label: "Vendor A three-year cost", statement: "Implementation plus support.", type: "calculation", unitSpec: { unit: "three-year-total" }, sourceSpanIds: [], calculation: { operation: "add", operands: [{ kind: "ref", nodeId: "a-implementation" }, { kind: "ref", nodeId: "a-support" }], outputUnit: "three-year-total", displayFormula: "$180,000 + Vendor A support" } }),
    node({ id: "b-support", label: "Vendor B three-year support", statement: "The memo treats monthly support as if its three-year multiplier were compatible.", type: "calculation", unitSpec: { unit: "currency" }, sourceSpanIds: [], calculation: { operation: "multiply", operands: [{ kind: "ref", nodeId: "b-support-rate" }, { kind: "ref", nodeId: "evaluation-years" }], outputUnit: "currency", displayFormula: "$1,250 per month × 3 years" } }),
    node({ id: "b-total", label: "Vendor B three-year cost", statement: "Implementation plus support.", type: "calculation", unitSpec: { unit: "three-year-total" }, sourceSpanIds: [], calculation: { operation: "add", operands: [{ kind: "ref", nodeId: "b-implementation" }, { kind: "ref", nodeId: "b-support" }], outputUnit: "three-year-total", displayFormula: "$210,000 + Vendor B support" } }),
    node({ id: "cost-difference", label: "Vendor B cost advantage", statement: "Vendor A total minus Vendor B total.", type: "comparison", unitSpec: { unit: "currency" }, sourceSpanIds: [], calculation: { operation: "subtract", operands: [{ kind: "ref", nodeId: "a-total" }, { kind: "ref", nodeId: "b-total" }], outputUnit: "currency", displayFormula: "Vendor A total − Vendor B total" } }),
    node({ id: "cost-difference-ratio", label: "Cost difference percentage", statement: "Cost difference divided by the lower-cost Vendor B total.", type: "comparison", unitSpec: { unit: "ratio" }, sourceSpanIds: [], calculation: { operation: "divide", operands: [{ kind: "ref", nodeId: "cost-difference" }, { kind: "ref", nodeId: "b-total" }], outputUnit: "ratio", displayFormula: "Cost difference ÷ Vendor B total (lower-cost denominator)" } }),
    node({ id: "deployment-threshold", label: "Deployment consideration threshold", statement: "Deployment may affect the decision only below a 10% total-cost difference.", type: "policy", value: 10, unitSpec: { unit: "percent" }, sourceSpanIds: ["threshold-source"] }),
    node({ id: "a-deployment", label: "Vendor A deployment", statement: "Vendor A deploys in four months.", type: "fact", value: 4, unitSpec: { unit: "month" }, sourceSpanIds: ["a-deployment-source"] }),
    node({ id: "b-deployment", label: "Vendor B deployment", statement: "Vendor B deploys in five months.", type: "fact", value: 5, unitSpec: { unit: "month" }, sourceSpanIds: ["b-deployment-source"] }),
    node({ id: "documented-costs", label: "Documented-cost rule", statement: "Only documented costs may be used.", type: "policy", unitSpec: { unit: "scalar" }, sourceSpanIds: ["documented-costs-source"] }),
    node({ id: "recommendation", label: "Final recommendation", statement: "Select the minimum documented three-year cost; deployment is reviewable because the difference is below the policy threshold, but no deterministic override was supplied.", type: "recommendation", unitSpec: { unit: "recommendation" }, sourceSpanIds: [], calculation: { operation: "select-candidate", candidates: [{ label: "Vendor A", valueNodeId: "a-total", maximumValueNodeId: null }, { label: "Vendor B", valueNodeId: "b-total", maximumValueNodeId: null }], selectionDirection: "minimum", tieResult: null, outputUnit: "recommendation", displayFormula: "Select the minimum documented three-year cost" } }),
  ],
  edges: [
    { id: "threshold-to-ratio", from: "deployment-threshold", to: "cost-difference-ratio", kind: "policy", label: "10% gate" },
    { id: "ratio-to-recommendation", from: "cost-difference-ratio", to: "recommendation", kind: "policy", label: "deployment consideration gate" },
    { id: "a-deployment-to-recommendation", from: "a-deployment", to: "recommendation", kind: "semantic", label: "reviewable deployment factor" },
    { id: "b-deployment-to-recommendation", from: "b-deployment", to: "recommendation", kind: "semantic", label: "reviewable deployment factor" },
    { id: "documented-costs-to-recommendation", from: "documented-costs", to: "recommendation", kind: "policy", label: "selection boundary" },
  ],
  recommendation: { nodeId: "recommendation", original: "Vendor A", corrected: "Vendor B" },
  corrections: [
    { id: "correct-a-support-duration", title: "Use the explicit monthly duration for Vendor A support", description: "Replace the incompatible three-year operand with the deterministic 36-month conversion.", targetNodeId: "a-support", replacementCalculation: { operation: "multiply", operands: [{ kind: "ref", nodeId: "a-support-rate" }, { kind: "ref", nodeId: "evaluation-months" }], outputUnit: "currency", displayFormula: "$2,334 × 36 months" } },
    { id: "correct-b-support-duration", title: "Use the explicit monthly duration for Vendor B support", description: "Replace the incompatible three-year operand with the deterministic 36-month conversion.", targetNodeId: "b-support", replacementCalculation: { operation: "multiply", operands: [{ kind: "ref", nodeId: "b-support-rate" }, { kind: "ref", nodeId: "evaluation-months" }], outputUnit: "currency", displayFormula: "$1,250 × 36 months" } },
  ],
});
