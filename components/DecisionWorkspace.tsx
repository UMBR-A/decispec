"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  FileText,
  FlaskConical,
  RotateCcw,
  Search,
  UploadCloud,
} from "lucide-react";
import { applyCorrection, buildProofExport, evaluateGraph, resetGraph, semanticDiff } from "../lib/domain/engine";
import { demoProject, demoSourceSpanIds } from "../lib/demo/fixture";
import type { ClaimStatus, DecisionGraph, SourceSpan } from "../lib/domain/schemas";
import { StatusMark } from "./StatusMark";
import { ProofGraph } from "./ProofGraph";
import { DecisionTestSuite } from "./DecisionTestSuite";
import { buildDecisionTestSuite } from "../lib/domain/test-suite";
import { BRAND } from "../lib/config/brand";

type Phase = "idle" | "verifying" | "verified" | "stress" | "corrected";

const verificationStages = [
  "Binding 11 claims to exact source spans",
  "Executing calculations in dependency order",
  "Checking units and recurring periods",
  "Testing recommendation dependencies",
];

const ORIGINAL_GRAPH = resetGraph(demoProject.graph);
const ORIGINAL_RESULT = evaluateGraph(ORIGINAL_GRAPH, demoSourceSpanIds);
const CORRECTED_RESULT = evaluateGraph(applyCorrection(ORIGINAL_GRAPH, demoProject.graph.corrections[0]), demoSourceSpanIds);
const DEMO_DIFF = semanticDiff(ORIGINAL_RESULT, CORRECTED_RESULT);

function money(value: unknown) {
  return typeof value === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : String(value ?? "—");
}

function highlightQuote(span?: SourceSpan) {
  if (!span?.emphasis) return span?.quote;
  const [before, after = ""] = span.quote.split(span.emphasis);
  return <>{before}<mark>{span.emphasis}</mark>{after}</>;
}

export function DecisionWorkspace() {
  const [graph, setGraph] = useState<DecisionGraph>(() => resetGraph(ORIGINAL_GRAPH));
  const [phase, setPhase] = useState<Phase>("idle");
  const [verificationStage, setVerificationStage] = useState(0);
  const [selectedId, setSelectedId] = useState("recommendation");
  const [selectedDocumentId, setSelectedDocumentId] = useState("memo");
  const [traceCount, setTraceCount] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("PDF or TXT · processed only in this browser · 10 MB max");
  const [uploadPreview, setUploadPreview] = useState("");
  const [graphOpen, setGraphOpen] = useState(true);
  const [focusedPath, setFocusedPath] = useState(false);
  const graphSectionRef = useRef<HTMLElement>(null);

  const originalResult = ORIGINAL_RESULT;
  const evaluated = useMemo(() => evaluateGraph(graph, demoSourceSpanIds), [graph]);
  const pendingNodes = useMemo(() => evaluated.nodes.map((node) => phase === "idle" || phase === "verifying" ? { ...node, status: "pending" as ClaimStatus, statusReason: "Verification has not run yet." } : node), [evaluated.nodes, phase]);
  const failurePath = useMemo(() => ["a-support-rate", ...evaluated.propagationTrace], [evaluated.propagationTrace]);
  const activeTrace = phase === "stress" ? failurePath.slice(0, traceCount) : phase === "corrected" ? ["a-support-rate", "a-support", "a-total", "recommendation"] : [];
  const selected = pendingNodes.find((node) => node.id === selectedId) ?? pendingNodes[0];
  const selectedSpan = demoProject.sourceSpans.find((span) => selected.sourceSpanIds.includes(span.id));
  const selectedDocument = demoProject.documents.find((doc) => doc.id === (selectedSpan?.documentId ?? selectedDocumentId)) ?? demoProject.documents[0];
  const diff = DEMO_DIFF;

  useEffect(() => {
    document.documentElement.dataset.assertHydrated = "true";
    return () => {
      delete document.documentElement.dataset.assertHydrated;
    };
  }, []);

  useEffect(() => {
    if (phase !== "verifying") return;
    if (verificationStage >= verificationStages.length - 1) {
      const done = window.setTimeout(() => {
        setPhase("verified");
        setSelectedId("a-support");
        setSelectedDocumentId("vendor-a");
      }, 360);
      return () => window.clearTimeout(done);
    }
    const next = window.setTimeout(() => setVerificationStage((stage) => stage + 1), 360);
    return () => window.clearTimeout(next);
  }, [phase, verificationStage]);

  useEffect(() => {
    if (phase !== "stress") return;
    if (traceCount >= failurePath.length) return;
    const next = window.setTimeout(() => setTraceCount((count) => count + 1), 420);
    return () => window.clearTimeout(next);
  }, [failurePath.length, phase, traceCount]);

  const selectClaim = (id: string) => {
    setSelectedId(id);
    const node = evaluated.nodes.find((item) => item.id === id);
    const span = demoProject.sourceSpans.find((item) => node?.sourceSpanIds.includes(item.id));
    if (span) setSelectedDocumentId(span.documentId);
  };

  const verify = () => {
    setVerificationStage(0);
    setPhase("verifying");
  };

  const breakDecision = () => {
    setGraph(resetGraph(ORIGINAL_GRAPH));
    setGraphOpen(true);
    setFocusedPath(true);
    setPhase("stress");
    setTraceCount(1);
    setSelectedId("a-support");
    setSelectedDocumentId("vendor-a");
    window.requestAnimationFrame(() => {
      graphSectionRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  };

  const correct = () => {
    setGraph(applyCorrection(ORIGINAL_GRAPH, demoProject.graph.corrections[0]));
    setPhase("corrected");
    setSelectedId("recommendation");
    setTraceCount(4);
    setFocusedPath(false);
  };

  const reset = () => {
    setGraph(resetGraph(ORIGINAL_GRAPH));
    setPhase("verified");
    setSelectedId("a-support");
    setTraceCount(0);
    setFocusedPath(false);
  };

  const downloadGraph = () => {
    if (phase === "idle" || phase === "verifying") return;
    const payload = buildProofExport(demoProject.id, graph, evaluated, originalResult, demoProject.sourceSpans, {
      phase: phase === "corrected" ? "corrected" : "verified",
    });
    const brandedPayload = { product: BRAND.exportMetadata, ...payload };
    const url = URL.createObjectURL(new Blob([JSON.stringify(brandedPayload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "decispec-school-device-proof.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file?: File) => {
    setUploadPreview("");
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setUploadMessage("File rejected: the local 10 MB limit was exceeded.");
    const isText = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isText && !isPdf) return setUploadMessage("File rejected: choose a PDF or plain-text file.");
    if (isText) {
      const text = await file.text();
      setUploadPreview(text.slice(0, 700));
      setUploadMessage(`${file.name} previewed locally. Semantic analysis is unavailable until the live provider is connected.`);
    } else {
      setUploadMessage(`${file.name} validated locally. PDF semantic analysis is unavailable in offline demo mode.`);
    }
  };

  const isVerified = phase !== "idle" && phase !== "verifying";
  const isCorrected = phase === "corrected";
  const aTotal = evaluated.nodes.find((node) => node.id === "a-total");
  const bTotal = evaluated.nodes.find((node) => node.id === "b-total");
  const recommendation = evaluated.nodes.find((node) => node.id === "recommendation");

  return (
    <main className="workspace-shell" id="main-content">
      <header className="workspace-header">
        <Link href="/" className="wordmark" aria-label={`${BRAND.productName} home`}><span className="wordmark-mark">{BRAND.monogram}</span> {BRAND.productName}</Link>
        <div className="decision-heading">
          <span className="eyebrow">Decision under test</span>
          <h1>{demoProject.title}</h1>
        </div>
        <div className="header-actions">
          <span className="mode-label"><span className="mode-dot" /> Deterministic demo</span>
          <button className="button button-quiet" data-testid="export-proof" onClick={downloadGraph} disabled={!isVerified} title={isVerified ? "Export the current verified proof state" : "Verify the decision before exporting proof JSON"}><Download size={15} /> Proof JSON</button>
          {isVerified
            ? <Link className="button button-quiet" data-testid="view-report" href={`/report/demo?state=${isCorrected ? "corrected" : "original"}`}>View report</Link>
            : <button className="button button-quiet" data-testid="view-report" disabled title="Verify the decision before viewing a report">View report</button>}
        </div>
      </header>

      <section className={`decision-banner ${isCorrected ? "decision-banner-corrected" : isVerified ? "decision-banner-broken" : ""}`} aria-live="polite">
        <div>
          <span className="eyebrow">{isCorrected ? "Corrected recommendation" : isVerified ? "Imported recommendation · Select Vendor A" : "Imported recommendation"}</span>
          <strong>{isCorrected ? "Select Vendor B" : isVerified ? "Decision broken" : "Select Vendor A"}</strong>
          <span className="decision-question">{demoProject.question}</span>
        </div>
        <div className="banner-result">
          {phase === "idle" && <><span className="pending-pulse" /> Not verified</>}
          {phase === "verifying" && <><span className="spinner" /> {verificationStages[verificationStage]}</>}
          {phase === "verified" && <><AlertTriangle size={18} /> Monthly support error · 3 dependent claims broken</>}
          {phase === "stress" && <><FlaskConical size={18} /> Load-bearing unit failure isolated</>}
          {phase === "corrected" && <><Check size={18} /> Corrected · Vendor B is $182,748 less</>}
        </div>
      </section>

      <DecisionTestSuite categories={buildDecisionTestSuite(evaluated, phase === "idle" || phase === "verifying")} onInspect={selectClaim} />

      <div className="workspace-grid">
        <aside className="source-rail" aria-label="Source documents">
          <div className="rail-heading"><div><span className="eyebrow">Evidence set</span><h2>4 source files</h2></div><Search size={17} aria-hidden="true" /></div>
          <nav className="document-list" aria-label="Bundled documents">
            {demoProject.documents.map((doc) => (
              <button key={doc.id} className={selectedDocument.id === doc.id ? "document-item active" : "document-item"} aria-pressed={selectedDocument.id === doc.id} onClick={() => setSelectedDocumentId(doc.id)}>
                <FileText size={17} aria-hidden="true" />
                <span><strong>{doc.title}</strong><small>{doc.pageLabel}</small></span>
              </button>
            ))}
          </nav>

          <div className="evidence-viewer" aria-live="polite">
            <div className="viewer-bar"><span>{selectedDocument.pageLabel}</span><span>Local fixture</span></div>
            <h3>{selectedDocument.title}</h3>
            {selectedDocument.sections.map((section) => {
              const spanForSection = selectedSpan?.documentId === selectedDocument.id && selectedSpan.section === section.heading ? selectedSpan : undefined;
              return (
                <section key={section.heading} className={spanForSection ? "source-section highlighted" : "source-section"}>
                  <h4>{section.heading}</h4>
                  <p>{spanForSection ? highlightQuote(spanForSection) : section.body}</p>
                  {spanForSection && <span className="evidence-anchor">Exact passage · {spanForSection.id}</span>}
                </section>
              );
            })}
          </div>

          <label className="upload-zone">
            <UploadCloud size={20} aria-hidden="true" />
            <strong>Preview a local file</strong>
            <span aria-live="polite">{uploadMessage}</span>
            <input type="file" accept="application/pdf,text/plain,.pdf,.txt" onChange={(event) => onFile(event.target.files?.[0])} />
          </label>
          {uploadPreview && <pre className="upload-preview">{uploadPreview}</pre>}
        </aside>

        <article className="memo" aria-labelledby="memo-title">
          <div className="memo-masthead">
            <div><span className="eyebrow">Imported draft · v3</span><h2 id="memo-title">{demoProject.draftMemo.title}</h2></div>
            <span>18 June 2026</span>
          </div>
          <p className="memo-dek">Recommendation to the Northfield School procurement committee</p>
          <section className="memo-section">
            <h3>Decision</h3>
            <p>Northfield School should select <button className="claim-inline" data-testid="claim-recommendation" onClick={() => selectClaim("recommendation")}><span>{isCorrected ? "Vendor B" : "Vendor A"}</span><StatusMark status={pendingNodes.find((n) => n.id === "recommendation")!.status} compact /></button> for its three-year student-device purchase.</p>
          </section>
          <section className="memo-section">
            <h3>Demand</h3>
            <p>Enrollment of <button className="claim-inline" onClick={() => selectClaim("students")}><span>300 students</span><StatusMark status={pendingNodes.find((n) => n.id === "students")!.status} compact /></button> plus the required <button className="claim-inline" onClick={() => selectClaim("spare-rate")}><span>7% spare allowance</span><StatusMark status={pendingNodes.find((n) => n.id === "spare-rate")!.status} compact /></button> produces a purchase quantity of <button className="claim-inline" data-testid="claim-devices" onClick={() => selectClaim("devices")}><span>321 devices</span><StatusMark status={pendingNodes.find((n) => n.id === "devices")!.status} compact /></button>.</p>
          </section>
          <section className="memo-section">
            <h3>Three-year cost comparison</h3>
            <div className="cost-table" role="table" aria-label="Vendor cost comparison">
              <div role="row" className="cost-row cost-head"><span role="columnheader">Vendor</span><span role="columnheader">Hardware</span><span role="columnheader">Support + setup</span><span role="columnheader">3-year total</span></div>
              <button role="row" className={`cost-row ${aTotal?.status === "broken" && isVerified ? "row-broken" : ""}`} onClick={() => selectClaim("a-total")} data-testid="vendor-a-total" aria-label={`Inspect Vendor A total, ${money(aTotal?.value)}, ${isVerified ? aTotal?.status : "pending"}`}>
                <strong role="cell">Vendor A</strong><span role="cell" data-label="Hardware">$60,669</span><span role="cell" data-label="Support + setup">{isCorrected ? "$208,008" : "$17,334"}</span><span role="cell" data-label="3-year total"><strong>{money(aTotal?.value)}</strong> <StatusMark status={isVerified ? aTotal!.status : "pending"} compact /></span>
              </button>
              <button role="row" className="cost-row" onClick={() => selectClaim("b-total")} aria-label={`Inspect Vendor B total, ${money(bTotal?.value)}, ${isVerified ? bTotal?.status : "pending"}`}>
                <strong role="cell">Vendor B</strong><span role="cell" data-label="Hardware">$79,929</span><span role="cell" data-label="Support + setup">$6,000</span><span role="cell" data-label="3-year total"><strong>{money(bTotal?.value)}</strong> <StatusMark status={isVerified ? bTotal!.status : "pending"} compact /></span>
              </button>
            </div>
            <p className="memo-note">Comparison basis: three-year total cost of ownership. <button className="text-link" onClick={() => selectClaim("price-assumption")}>Review declared assumptions</button>.</p>
          </section>
          <section className="memo-section memo-conclusion">
            <span className="eyebrow">Conclusion</span>
            <p>{isCorrected ? "Vendor B is the lower-cost compliant choice and remains within the approved budget." : "On the reported totals, Vendor A appears to be the lower-cost compliant choice."}</p>
            {isVerified && <div className={isCorrected ? "conclusion-verdict valid" : "conclusion-verdict invalid"}><StatusMark status={recommendation!.status} /> <span>{recommendation!.statusReason}</span></div>}
          </section>

          <div className="primary-action-row">
            <div className="action-context">
              <strong>{phase === "idle" ? "Ready to run 7 deterministic checks" : phase === "verifying" ? "Testing the recommendation" : phase === "verified" ? "A load-bearing failure was found" : phase === "stress" ? "The broken dependency path is isolated" : "The correction has been recomputed"}</strong>
              <span>{phase === "idle" ? "Evidence is bound. Run the suite to test whether Vendor A follows." : phase === "verifying" ? verificationStages[verificationStage] : phase === "verified" ? "Trace the monthly support error through the recommendation." : phase === "stress" ? "Review the before/after values, then apply the source-bound correction." : "Vendor B now follows from the corrected totals and budget policy."}</span>
            </div>
            <div className="action-controls">
            {phase === "idle" && <button className="button button-primary" data-testid="verify-decision" onClick={verify}>Run decision tests <ArrowRight size={17} /></button>}
            {phase === "verifying" && <div className="verification-progress"><div className="progress-track"><span style={{ width: `${((verificationStage + 1) / verificationStages.length) * 100}%` }} /></div><span>{verificationStages[verificationStage]}</span></div>}
            {phase === "verified" && <button className="button button-danger" data-testid="break-decision" onClick={breakDecision}><FlaskConical size={17} /> Break this decision</button>}
            {phase === "stress" && traceCount >= failurePath.length && <button className="button button-danger" onClick={correct} data-testid="apply-correction">Apply source-bound correction <ArrowRight size={17} /></button>}
            {phase === "corrected" && <><button className="button button-primary" onClick={breakDecision}><FlaskConical size={17} /> Replay propagation</button><button className="button button-quiet" onClick={reset} data-testid="reset-correction"><RotateCcw size={16} /> Undo correction</button></>}
            </div>
          </div>

          {(phase === "stress" || phase === "corrected") && (
            <section className="proof-diff" data-testid="proof-diff">
              <div className="diff-header"><span className="eyebrow">Semantic correction preview</span><strong>One unit fix. Three conclusions change.</strong></div>
              <div className="diff-grid">
                {diff.filter((item) => ["a-support", "a-total", "recommendation"].includes(item.nodeId)).map((item) => (
                  <div className="diff-item" key={item.nodeId}><span>{item.label}</span><del>{typeof item.before === "number" ? money(item.before) : item.before}</del><ArrowRight size={14} /><ins>{typeof item.after === "number" ? money(item.after) : item.after}</ins></div>
                ))}
              </div>
              <p>No evidence is rewritten. The calculation changes from <code>3 years</code> to the quote’s explicit <code>36 months</code>.</p>
            </section>
          )}
        </article>

        <aside className="inspector" aria-label="Claim inspector">
          <div className="inspector-heading"><span className="eyebrow">Claim inspector</span><StatusMark status={selected.status} /></div>
          <h2>{selected.label}</h2>
          <p className="inspector-statement">{selected.statement}</p>
          <dl className="claim-facts">
            <div><dt>Type</dt><dd>{selected.type}</dd></div>
            <div><dt>Machine reason</dt><dd>{selected.statusReason}</dd></div>
            <div><dt>Unit</dt><dd>{selected.unitSpec.unit}</dd></div>
            {selected.value !== undefined && <div><dt>Computed value</dt><dd>{selected.unitSpec.unit.includes("currency") || selected.unitSpec.unit === "three-year-total" ? money(selected.value) : String(selected.value)}</dd></div>}
          </dl>
          {selected.calculation && <section className="inspector-block"><span className="block-label">Executable formula</span><code>{selected.calculation.displayFormula}</code><span className="calculation-mode">Safe structured operation · no eval</span></section>}
          <section className="inspector-block">
            <span className="block-label">Source binding</span>
            {selected.sourceSpanIds.length ? selected.sourceSpanIds.map((id) => {
              const span = demoProject.sourceSpans.find((item) => item.id === id)!;
              return <button className="source-binding" key={id} onClick={() => { setSelectedDocumentId(span.documentId); }}><span>{span.pageLabel} · {span.section}</span><q>{highlightQuote(span)}</q></button>;
            }) : <p className="muted">Derived only from declared dependencies.</p>}
          </section>
          <section className="inspector-block"><span className="block-label">Test results</span><div className="test-list">
            {(isVerified ? selected.testResults : [{ label: "Verification", passed: false, detail: "Run verification to execute this test." }]).map((test) => <div className={`test-result ${test.passed ? "pass" : "fail"}`} key={test.label}><span>{test.passed ? <Check size={14} /> : <AlertTriangle size={14} />}{test.label}</span><small>{test.detail}</small></div>)}
          </div></section>
          {isVerified && <details className="integrity-details"><summary>Integrity score · {evaluated.integrity.score}/100</summary><p>{evaluated.integrity.passingWeight} passing weight ÷ {evaluated.integrity.totalWeight} total weight. {evaluated.integrity.formula}</p></details>}
        </aside>
      </div>

      <section className="graph-section" id="proof-graph-section" ref={graphSectionRef}>
        <button className="graph-heading" onClick={() => setGraphOpen((open) => !open)} aria-expanded={graphOpen} aria-controls="proof-graph-panel"><div><span className="eyebrow">Executable proof graph</span><h2>{isCorrected ? "Correction recomputed in topological order" : phase === "stress" ? "Quote → Support cost → Vendor A total → Recommendation" : isVerified ? "Failure propagation path" : "15 claims · 15 dependencies"}</h2></div><div className="graph-legend"><span><i className="legend-supported" /> supported</span><span><i className="legend-calculated" /> calculated</span><span><i className="legend-broken" /> broken</span><ChevronDown className={graphOpen ? "chevron-open" : ""} size={20} aria-hidden="true" /></div></button>
        {graphOpen && phase === "stress" && <div className="graph-focus-bar"><span><strong>Decision broken</strong><small>{focusedPath ? "Focused failure path · unrelated claims are temporarily hidden." : "Complete dependency graph · the broken path remains highlighted."}</small></span><button className="button button-quiet" data-testid="toggle-graph-focus" onClick={() => setFocusedPath((focused) => !focused)}>{focusedPath ? "Show full graph" : "Focus broken path"}</button></div>}
        {graphOpen && <div id="proof-graph-panel"><ProofGraph nodes={pendingNodes} edges={graph.edges} activeTrace={activeTrace} focused={phase === "stress" && focusedPath} selectedId={selectedId} onSelect={selectClaim} /></div>}
      </section>
    </main>
  );
}
