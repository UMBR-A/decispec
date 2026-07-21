import { DecisionProjectSchema, type DecisionProject } from "../../lib/domain/schemas";
import type { AnalysisInput } from "../../lib/providers/analysis-provider";

export const PROOF_ENGINE_PROJECT_ID = "proof-engine-school-device";

export const proofEngineProject: DecisionProject = DecisionProjectSchema.parse({
  id: PROOF_ENGINE_PROJECT_ID,
  title: "Three-year student device purchase",
  question: "Which vendor should Northfield School select for 321 student devices?",
  documents: [
    {
      id: "policy",
      title: "Enrollment & Device Policy",
      kind: "policy",
      pageLabel: "Policy · p. 2",
      sections: [
        { heading: "2026 enrollment", body: "Northfield School will serve 300 students in the 2026–27 academic year." },
        { heading: "Device reserve", body: "All purchases must include a 7% spare-device allowance." },
        { heading: "Comparison standard", body: "Vendor comparisons must use three-year total cost of ownership. The approved maximum is $100,000." },
      ],
    },
    {
      id: "vendor-a",
      title: "Vendor A · AtlasBook Quote",
      kind: "quote",
      pageLabel: "Quote A · p. 1",
      sections: [
        { heading: "Hardware", body: "AtlasBook 11 student device — $189 per device." },
        { heading: "Support plan", body: "Managed Care support — $18 per device per month. Term: 36 months." },
        { heading: "Commercial terms", body: "Pricing valid for 45 days. Taxes excluded." },
      ],
    },
    {
      id: "vendor-b",
      title: "Vendor B · BeaconPad Quote",
      kind: "quote",
      pageLabel: "Quote B · p. 1",
      sections: [
        { heading: "Hardware", body: "BeaconPad EDU student device — $249 per device." },
        { heading: "Support", body: "Three years of standard support are included with every device." },
        { heading: "Setup", body: "District enrollment and setup — one-time fee of $6,000." },
      ],
    },
    {
      id: "memo",
      title: "Imported Draft Decision Memo",
      kind: "memo",
      pageLabel: "Draft · p. 1",
      sections: [
        { heading: "Recommendation", body: "Select Vendor A for the student device purchase." },
        { heading: "Cost basis", body: "321 devices are required. Vendor A totals $78,003 over three years; Vendor B totals $85,929." },
      ],
    },
  ],
  sourceSpans: [
    { id: "s-students", documentId: "policy", pageLabel: "Policy · p. 2", section: "2026 enrollment", quote: "Northfield School will serve 300 students in the 2026–27 academic year.", emphasis: "300 students" },
    { id: "s-spares", documentId: "policy", pageLabel: "Policy · p. 2", section: "Device reserve", quote: "All purchases must include a 7% spare-device allowance.", emphasis: "7% spare-device allowance" },
    { id: "s-standard", documentId: "policy", pageLabel: "Policy · p. 2", section: "Comparison standard", quote: "Vendor comparisons must use three-year total cost of ownership. The approved maximum is $100,000.", emphasis: "three-year total cost of ownership" },
    { id: "s-budget", documentId: "policy", pageLabel: "Policy · p. 2", section: "Comparison standard", quote: "Vendor comparisons must use three-year total cost of ownership. The approved maximum is $100,000.", emphasis: "$100,000" },
    { id: "s-a-hardware", documentId: "vendor-a", pageLabel: "Quote A · p. 1", section: "Hardware", quote: "AtlasBook 11 student device — $189 per device.", emphasis: "$189 per device" },
    { id: "s-a-support", documentId: "vendor-a", pageLabel: "Quote A · p. 1", section: "Support plan", quote: "Managed Care support — $18 per device per month. Term: 36 months.", emphasis: "$18 per device per month" },
    { id: "s-a-term", documentId: "vendor-a", pageLabel: "Quote A · p. 1", section: "Support plan", quote: "Managed Care support — $18 per device per month. Term: 36 months.", emphasis: "36 months" },
    { id: "s-b-hardware", documentId: "vendor-b", pageLabel: "Quote B · p. 1", section: "Hardware", quote: "BeaconPad EDU student device — $249 per device.", emphasis: "$249 per device" },
    { id: "s-b-support", documentId: "vendor-b", pageLabel: "Quote B · p. 1", section: "Support", quote: "Three years of standard support are included with every device.", emphasis: "Three years of standard support are included" },
    { id: "s-b-setup", documentId: "vendor-b", pageLabel: "Quote B · p. 1", section: "Setup", quote: "District enrollment and setup — one-time fee of $6,000.", emphasis: "$6,000" },
    { id: "s-memo-rec", documentId: "memo", pageLabel: "Draft · p. 1", section: "Recommendation", quote: "Select Vendor A for the student device purchase.", emphasis: "Vendor A" },
  ],
  draftMemo: {
    title: "Student Device Vendor Recommendation",
    sections: [
      { heading: "Decision", body: "Northfield School should select Vendor A for its three-year student-device purchase." },
      { heading: "Demand", body: "Enrollment of 300 students plus the required 7% spare allowance produces a purchase quantity of 321 devices." },
      { heading: "Cost comparison", body: "Vendor A’s three-year total is $78,003. Vendor B’s three-year total is $85,929. Vendor A appears $7,926 less expensive." },
      { heading: "Budget", body: "Both options appear to remain below the approved $100,000 three-year budget." },
    ],
  },
  graph: {
    id: "school-device-proof",
    nodes: [
      { id: "students", label: "Student enrollment", statement: "Enrollment is 300 students.", type: "fact", status: "pending", statusReason: "Awaiting source binding.", value: 300, unitSpec: { unit: "devices" }, sourceSpanIds: ["s-students"], tests: [] },
      { id: "spare-rate", label: "Spare allowance", statement: "The policy requires 7% spare devices.", type: "policy", status: "pending", statusReason: "Awaiting source binding.", value: 0.07, unitSpec: { unit: "ratio" }, sourceSpanIds: ["s-spares"], tests: [] },
      { id: "devices", label: "Required devices", statement: "321 devices are required.", type: "calculation", status: "pending", statusReason: "Awaiting calculation.", unitSpec: { unit: "devices" }, sourceSpanIds: [], calculation: { operation: "percentage-adjustment", operands: [{ kind: "ref", nodeId: "students" }, { kind: "ref", nodeId: "spare-rate" }], outputUnit: "devices", displayFormula: "300 × (1 + 0.07) = 321" }, tests: [] },
      { id: "budget", label: "Approved budget", statement: "The three-year budget ceiling is $100,000.", type: "policy", status: "pending", statusReason: "Awaiting source binding.", value: 100000, unitSpec: { unit: "three-year-total" }, sourceSpanIds: ["s-budget", "s-standard"], tests: [] },
      { id: "a-hardware-rate", label: "Vendor A hardware rate", statement: "Vendor A charges $189 per device.", type: "fact", status: "pending", statusReason: "Awaiting source binding.", value: 189, unitSpec: { unit: "currency-per-device" }, sourceSpanIds: ["s-a-hardware"], tests: [] },
      { id: "a-support-rate", label: "Vendor A support rate", statement: "Support costs $18 per device per month.", type: "fact", status: "pending", statusReason: "Awaiting source binding.", value: 18, unitSpec: { unit: "currency-per-device-per-month" }, sourceSpanIds: ["s-a-support", "s-a-term"], tests: [] },
      { id: "a-hardware", label: "Vendor A hardware", statement: "Vendor A hardware costs $60,669.", type: "calculation", status: "pending", statusReason: "Awaiting calculation.", unitSpec: { unit: "currency" }, sourceSpanIds: [], calculation: { operation: "multiply", operands: [{ kind: "ref", nodeId: "devices" }, { kind: "ref", nodeId: "a-hardware-rate" }], outputUnit: "currency", displayFormula: "321 × $189 = $60,669" }, tests: [] },
      { id: "a-support", label: "Vendor A support", statement: "The memo reports three-year support as $17,334.", type: "calculation", status: "pending", statusReason: "Awaiting calculation.", unitSpec: { unit: "currency" }, sourceSpanIds: ["s-a-support", "s-a-term"], calculation: { operation: "multiply", operands: [{ kind: "ref", nodeId: "devices" }, { kind: "ref", nodeId: "a-support-rate" }, { kind: "literal", value: 3, unit: "year", label: "3 years" }], outputUnit: "currency", displayFormula: "321 × $18 × 3 years = $17,334" }, tests: [] },
      { id: "a-total", label: "Vendor A · 3-year total", statement: "The memo reports Vendor A at $78,003.", type: "calculation", status: "pending", statusReason: "Awaiting calculation.", unitSpec: { unit: "three-year-total" }, sourceSpanIds: [], calculation: { operation: "add", operands: [{ kind: "ref", nodeId: "a-hardware" }, { kind: "ref", nodeId: "a-support" }], outputUnit: "three-year-total", displayFormula: "$60,669 + $17,334 = $78,003" }, tests: [] },
      { id: "b-hardware-rate", label: "Vendor B hardware rate", statement: "Vendor B charges $249 per device.", type: "fact", status: "pending", statusReason: "Awaiting source binding.", value: 249, unitSpec: { unit: "currency-per-device" }, sourceSpanIds: ["s-b-hardware"], tests: [] },
      { id: "b-setup", label: "Vendor B setup", statement: "Vendor B charges a one-time $6,000 setup fee.", type: "fact", status: "pending", statusReason: "Awaiting source binding.", value: 6000, unitSpec: { unit: "currency" }, sourceSpanIds: ["s-b-setup", "s-b-support"], tests: [] },
      { id: "b-hardware", label: "Vendor B hardware", statement: "Vendor B hardware costs $79,929.", type: "calculation", status: "pending", statusReason: "Awaiting calculation.", unitSpec: { unit: "currency" }, sourceSpanIds: [], calculation: { operation: "multiply", operands: [{ kind: "ref", nodeId: "devices" }, { kind: "ref", nodeId: "b-hardware-rate" }], outputUnit: "currency", displayFormula: "321 × $249 = $79,929" }, tests: [] },
      { id: "b-total", label: "Vendor B · 3-year total", statement: "Vendor B totals $85,929 over three years.", type: "calculation", status: "pending", statusReason: "Awaiting calculation.", unitSpec: { unit: "three-year-total" }, sourceSpanIds: [], calculation: { operation: "add", operands: [{ kind: "ref", nodeId: "b-hardware" }, { kind: "ref", nodeId: "b-setup" }], outputUnit: "three-year-total", displayFormula: "$79,929 + $6,000 = $85,929" }, tests: [] },
      { id: "price-assumption", label: "Price stability", statement: "Quoted prices are assumed to remain fixed through award.", type: "assumption", status: "pending", statusReason: "Declared and reviewable; not source-backed.", value: "Prices remain fixed", unitSpec: { unit: "scalar" }, sourceSpanIds: [], tests: [] },
      { id: "recommendation", label: "Vendor recommendation", statement: "The imported memo recommends Vendor A.", type: "recommendation", status: "pending", statusReason: "Awaiting dependency verification.", unitSpec: { unit: "recommendation" }, sourceSpanIds: ["s-memo-rec", "s-standard"], calculation: { operation: "compare-lower", operands: [{ kind: "ref", nodeId: "a-total" }, { kind: "ref", nodeId: "b-total" }], outputUnit: "recommendation", displayFormula: "Choose the lower valid three-year total" }, tests: [] },
    ],
    edges: [
      { id: "e1", from: "students", to: "devices" }, { id: "e2", from: "spare-rate", to: "devices" },
      { id: "e3", from: "devices", to: "a-hardware" }, { id: "e4", from: "a-hardware-rate", to: "a-hardware" },
      { id: "e5", from: "devices", to: "a-support" }, { id: "e6", from: "a-support-rate", to: "a-support" },
      { id: "e7", from: "a-hardware", to: "a-total" }, { id: "e8", from: "a-support", to: "a-total" },
      { id: "e9", from: "devices", to: "b-hardware" }, { id: "e10", from: "b-hardware-rate", to: "b-hardware" },
      { id: "e11", from: "b-hardware", to: "b-total" }, { id: "e12", from: "b-setup", to: "b-total" },
      { id: "e13", from: "a-total", to: "recommendation" }, { id: "e14", from: "b-total", to: "recommendation" }, { id: "e15", from: "budget", to: "recommendation", label: "policy constraint" },
    ],
    recommendation: { nodeId: "recommendation", original: "Vendor A", corrected: "Vendor B" },
    corrections: [
      {
        id: "correct-support-period",
        title: "Use the quoted monthly support term",
        description: "Replace 3 annual periods with the quote’s explicit 36 monthly periods. No source evidence is changed.",
        targetNodeId: "a-support",
        replacementCalculation: {
          operation: "multiply",
          operands: [{ kind: "ref", nodeId: "devices" }, { kind: "ref", nodeId: "a-support-rate" }, { kind: "literal", value: 36, unit: "month", label: "36 months" }],
          outputUnit: "currency",
          displayFormula: "321 × $18 × 36 months = $208,008",
        },
      },
    ],
  },
});

export const proofEngineSourceSpanIds = new Set(proofEngineProject.sourceSpans.map((span) => span.id));

function joinSections(sections: Array<{ heading: string; body: string }>, includeHeadings: boolean) {
  const separator = includeHeadings ? "\n\n" : "\n";
  let content = "";
  const metadata: Array<{ heading: string; start: number; end: number }> = [];
  for (const section of sections) {
    if (content) content += separator;
    const start = content.length;
    content += includeHeadings ? `${section.heading}\n${section.body}` : section.body;
    metadata.push({ heading: section.heading, start, end: content.length });
  }
  return { content, sections: metadata };
}

export function proofEngineAnalysisInput(): AnalysisInput {
  const draft = joinSections(proofEngineProject.draftMemo.sections, true);
  return {
    fixtureId: PROOF_ENGINE_PROJECT_ID,
    documents: proofEngineProject.documents.map((document) => {
      const joined = joinSections(document.sections, false);
      return { id: document.id, title: document.title, content: joined.content, pageLabel: document.pageLabel, sections: joined.sections };
    }),
    draftMemo: draft.content,
    draftMemoMetadata: { documentId: "draft-memo", title: proofEngineProject.draftMemo.title, pageLabel: "Draft memo · p. 1", sections: draft.sections },
  };
}
