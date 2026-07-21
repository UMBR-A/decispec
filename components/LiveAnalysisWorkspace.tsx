"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FileCheck2, FileText, LoaderCircle, Play, RotateCcw, Square, UploadCloud } from "lucide-react";
import type { AnalysisPlan, NormalizedDocument } from "../lib/providers/analysis-provider";
import {
  applyCorrection,
  buildProofExport,
  evaluateGraph,
  findDependencyPath,
  semanticDiff,
  type EvaluationResult,
} from "../lib/domain/engine";
import type { DecisionGraph } from "../lib/domain/schemas";
import { buildDecisionTestSuite } from "../lib/domain/test-suite";
import { DecisionTestSuite } from "./DecisionTestSuite";
import { ProofGraph } from "./ProofGraph";
import { StatusMark } from "./StatusMark";
import { BRAND } from "../lib/config/brand";

const progressStages = ["Reading evidence", "Binding claims to sources", "Building dependency graph", "Validating provenance", "Executing calculations", "Testing recommendation", "Preparing report"];
type LiveResponse = { provider: { name: string; mode: "live-openai"; model: string }; usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } | null; requestId: string | null; latencyMs: number | null; analysis: AnalysisPlan; evaluation: EvaluationResult };
type PreflightStatus = { routeAvailable: boolean; provider: string; providerConfigured: boolean; apiKeyDetected: boolean; model: string; modelPresent: boolean; engineReady: boolean; ready: boolean; code: string };

const liveErrorMessages: Record<string, string> = {
  missing_api_key: "Live analysis needs a server-side OpenAI API key.",
  unsupported_provider: "The configured live analysis provider is not supported.",
  invalid_model: "The configured live analysis model name is invalid.",
  authentication: "The live provider could not authenticate. Check the server-side key and project access.",
  quota: "Live analysis is unavailable because API quota or billing is exhausted.",
  rate_limit: "Live analysis is temporarily rate limited. Wait briefly, then retry.",
  model_access: "The configured OpenAI project cannot access the selected model.",
  timeout: "Live analysis timed out. Try again with a smaller evidence set.",
  schema_rejection: "The provider rejected the strict structured-output request.",
  validation_rejection: "The proposed analysis failed Decispec's local validation.",
  transport: "The server could not reach the live provider.",
  upstream: "The live provider is temporarily unavailable.",
  refusal: "The provider declined this analysis. Review the evidence and try again.",
};

function formatValue(value: unknown, unit?: string): string {
  if (typeof value !== "number") return String(value ?? "—");
  if (unit === "currency" || unit === "three-year-total") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  if (unit === "percent") return `${value.toLocaleString()}%`;
  if (unit === "ratio") return `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function LiveAnalysisWorkspace() {
  const [memo, setMemo] = useState("");
  const [manualEvidence, setManualEvidence] = useState("");
  const [documents, setDocuments] = useState<NormalizedDocument[]>([]);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<LiveResponse | null>(null);
  const [currentGraph, setCurrentGraph] = useState<DecisionGraph | null>(null);
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluationResult | null>(null);
  const [corrected, setCorrected] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showFullGraph, setShowFullGraph] = useState(false);
  const [preflight, setPreflight] = useState<PreflightStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.dataset.assertLiveHydrated = "true";
    return () => { delete document.documentElement.dataset.assertLiveHydrated; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/analyze/status", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("missing_route");
        setPreflight(await response.json() as PreflightStatus);
      })
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setPreflight({ routeAvailable: false, provider: "openai", providerConfigured: false, apiKeyDetected: false, model: "—", modelPresent: false, engineReady: false, ready: false, code: "missing_route" });
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setStage((value) => Math.min(value + 1, progressStages.length - 1)), 2300);
    return () => window.clearInterval(timer);
  }, [running]);

  const allDocuments = useMemo(() => {
    const manual = manualEvidence.trim() ? [{ id: "manual-evidence", title: "Pasted evidence", content: manualEvidence.trim() }] : [];
    return [...manual, ...documents];
  }, [documents, manualEvidence]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const form = new FormData();
    [...files].forEach((file) => form.append("files", file));
    try {
      const response = await fetch("/api/documents/extract", { method: "POST", body: form });
      const body = await response.json() as { documents?: NormalizedDocument[]; error?: string };
      if (!response.ok || !body.documents) throw new Error(body.error ?? "Files could not be read.");
      setDocuments((current) => [...current, ...body.documents!].slice(0, 8));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Files could not be read.");
    }
  };

  const uploadMemo = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    const form = new FormData();
    form.append("files", file);
    try {
      const response = await fetch("/api/documents/extract", { method: "POST", body: form });
      const body = await response.json() as { documents?: NormalizedDocument[]; error?: string };
      if (!response.ok || !body.documents?.[0]) throw new Error(body.error ?? "The recommendation file could not be read.");
      setMemo(body.documents[0].content);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The recommendation file could not be read.");
    }
  };

  const run = async () => {
    if (!memo.trim() || allDocuments.length === 0 || running) return;
    controller.current = new AbortController();
    setRunning(true); setStage(0); setError(null); setResult(null); setCurrentGraph(null); setCurrentEvaluation(null); setCorrected(false); setShowReport(false); setShowFullGraph(false);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documents: allDocuments, draftMemo: memo.trim() }), signal: controller.current.signal });
      const body = await response.json() as LiveResponse & { error?: string; code?: string };
      if (!response.ok) throw new Error(body.code && liveErrorMessages[body.code] ? liveErrorMessages[body.code] : body.error ?? (body.code ? `Analysis stopped safely (${body.code}).` : "Analysis could not be completed."));
      setResult(body); setCurrentGraph(body.analysis.graph); setCurrentEvaluation(body.evaluation); setSelectedId(body.evaluation.nodes.find((node) => node.type === "recommendation")?.id ?? body.evaluation.nodes[0]?.id ?? "");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") setError("Analysis cancelled. No retry was made.");
      else setError(caught instanceof Error ? caught.message : "Analysis could not be completed.");
    } finally {
      setRunning(false); controller.current = null;
    }
  };

  const sourceSpanIds = useMemo(() => new Set(result?.analysis.sourceSpans.map((span) => span.id) ?? []), [result]);
  const correctionPreview = useMemo(() => {
    if (!result || result.analysis.graph.corrections.length === 0) return null;
    try {
      const graph = result.analysis.graph.corrections.reduce((next, correction) => applyCorrection(next, correction), result.analysis.graph);
      const evaluation = evaluateGraph(graph, sourceSpanIds);
      return { graph, evaluation, diff: semanticDiff(result.evaluation, evaluation) };
    } catch {
      return null;
    }
  }, [result, sourceSpanIds]);

  const applyProposedCorrections = () => {
    if (!correctionPreview) return;
    setCurrentGraph(correctionPreview.graph);
    setCurrentEvaluation(correctionPreview.evaluation);
    setCorrected(true);
    setShowFullGraph(true);
    setShowReport(false);
  };

  const undoCorrections = () => {
    if (!result) return;
    setCurrentGraph(result.analysis.graph);
    setCurrentEvaluation(result.evaluation);
    setCorrected(false);
    setShowReport(false);
    setShowFullGraph(false);
  };

  const recommendation = currentEvaluation?.nodes.find((node) => node.type === "recommendation");
  const broken = recommendation?.status === "broken" || recommendation?.status === "contradicted";
  const brokenPath = useMemo(() => {
    if (!currentGraph || !currentEvaluation || !recommendation || !broken) return [];
    const recurringUnits = new Set(["currency-per-month", "currency-per-device-per-month"]);
    const brokenCalculation = currentEvaluation.nodes.find((node) => node.status === "broken" && node.calculation && node.calculation.operation !== "select-candidate" && node.calculation.operation !== "convert-duration" && node.calculation.operands.some((operand) => operand.kind === "ref" && recurringUnits.has(currentEvaluation.nodes.find((candidate) => candidate.id === operand.nodeId)?.unitSpec.unit ?? "")));
    if (!brokenCalculation?.calculation || brokenCalculation.calculation.operation === "select-candidate" || brokenCalculation.calculation.operation === "convert-duration") return currentEvaluation.propagationTrace;
    const rateOperand = brokenCalculation.calculation.operands.find((operand) => operand.kind === "ref" && recurringUnits.has(currentEvaluation.nodes.find((candidate) => candidate.id === operand.nodeId)?.unitSpec.unit ?? ""));
    return rateOperand?.kind === "ref" ? findDependencyPath(currentGraph, rateOperand.nodeId, recommendation.id) ?? currentEvaluation.propagationTrace : currentEvaluation.propagationTrace;
  }, [broken, currentEvaluation, currentGraph, recommendation]);
  const focusedPath = broken && !showFullGraph && brokenPath.length > 1;
  const proofExport = useMemo(() => {
    if (!result || !currentGraph || !currentEvaluation) return null;
    return buildProofExport(currentGraph.id, currentGraph, currentEvaluation, result.evaluation, result.analysis.sourceSpans, { phase: corrected ? "corrected" : "verified", mode: "live-openai" });
  }, [corrected, currentEvaluation, currentGraph, result]);

  const downloadProof = () => {
    if (!proofExport) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ product: BRAND.exportMetadata, ...proofExport }, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "decispec-live-proof.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="live-workspace" id="main-content">
      <header className="workspace-header live-header"><Link href="/" className="wordmark" aria-label={`${BRAND.productName} home`}><span className="wordmark-mark">{BRAND.monogram}</span> {BRAND.productName}</Link><div className="decision-heading"><span className="eyebrow">Analyze my decision</span><h1>Live, source-bound analysis</h1></div><span className="mode-label"><span className="mode-dot" /> GPT semantic analysis + local proof engine</span></header>
      <section className="live-intro"><div><span className="eyebrow">Source-bound analysis</span><h2>Test an AI-written recommendation against its evidence.</h2><p>GPT proposes source spans and graph structure. Strict local validation and the deterministic engine decide what passes, breaks, and follows.</p></div></section>
      <section className={`live-preflight ${preflight?.ready ? "ready" : preflight ? "blocked" : "checking"}`} aria-label="Live analysis preflight" aria-live="polite">
        <div><strong>{preflight?.ready ? "Live analysis ready" : preflight ? "Live analysis needs attention" : "Checking live analysis…"}</strong><small>{preflight?.code === "missing_route" ? "The server analysis route is unavailable." : preflight && !preflight.ready ? liveErrorMessages[preflight.code] ?? "Review the server configuration before recording." : "Server-only provider and deterministic engine checks."}</small></div>
        <ul>
          <li data-ready={Boolean(preflight?.routeAvailable)}>{preflight?.routeAvailable ? "Route available" : "Route unavailable"}</li>
          <li data-ready={Boolean(preflight?.apiKeyDetected)}>{preflight?.apiKeyDetected ? "Server key detected" : "Server key missing"}</li>
          <li data-ready={Boolean(preflight?.modelPresent)}>{preflight?.modelPresent ? `Model ${preflight.model}` : "Model missing"}</li>
          <li data-ready={Boolean(preflight?.engineReady)}>{preflight?.engineReady ? "Proof engine ready" : "Proof engine unavailable"}</li>
        </ul>
      </section>
      <div className="live-input-grid">
        <section className="live-card"><span className="eyebrow">1 · Draft recommendation</span><h2><label htmlFor="draft-recommendation">AI-written memo</label></h2><p className="field-help" id="draft-recommendation-help">Paste the recommendation, or upload the TXT/PDF memo you want to test.</p><textarea id="draft-recommendation" aria-describedby="draft-recommendation-help draft-recommendation-count" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Paste the recommendation you want to test…" maxLength={120000} disabled={running} /><small id="draft-recommendation-count">{memo.length.toLocaleString()} / 120,000 characters</small><label className="live-upload"><UploadCloud size={18} /><span><strong>Upload recommendation</strong><small>TXT or text PDF · 10 MB · no OCR</small></span><input data-testid="memo-upload" type="file" accept=".txt,.pdf,text/plain,application/pdf" disabled={running} onChange={(event) => uploadMemo(event.target.files)} /></label></section>
        <section className="live-card"><span className="eyebrow">2 · Supporting evidence</span><h2><label htmlFor="supporting-evidence">Evidence documents</label></h2><p className="field-help" id="supporting-evidence-help">Paste or upload the source material the recommendation is expected to follow.</p><textarea id="supporting-evidence" aria-describedby="supporting-evidence-help" value={manualEvidence} onChange={(event) => setManualEvidence(event.target.value)} placeholder="Paste evidence text, or upload TXT/PDF files below…" maxLength={120000} disabled={running} />
          <label className="live-upload"><UploadCloud size={18} /><span><strong>Upload evidence</strong><small>Up to 8 TXT/text PDF files · 10 MB each · no OCR</small></span><input data-testid="evidence-upload" type="file" accept=".txt,.pdf,text/plain,application/pdf" multiple disabled={running} onChange={(event) => upload(event.target.files)} /></label>
          {documents.length > 0 && <ul className="live-documents">{documents.map((document) => <li key={document.id}><FileText size={14} /><span>{document.title}<small>{document.content.length.toLocaleString()} characters</small></span></li>)}</ul>}
        </section>
      </div>
      <section className="live-runbar" aria-live="polite" aria-atomic="true">
        <div><strong>{running ? progressStages[stage] : result ? "Analysis complete" : error ? "Analysis could not be completed" : "Ready to test"}</strong><small>{running ? "Long evidence sets can take up to 90 seconds. The page remains responsive." : "The API is called only when you press Test decision."}</small></div>
        {running ? <button className="button button-danger" onClick={() => controller.current?.abort()}><Square size={14} /> Cancel</button> : <button className="button button-primary" data-testid="test-live-decision" disabled={!memo.trim() || allDocuments.length === 0} onClick={run}><Play size={15} /> Test decision</button>}
        {running && <LoaderCircle className="live-spinner" size={20} />}
      </section>
      {error && <section className="live-error" role="alert"><AlertTriangle size={20} /><div><strong>Analysis could not be completed</strong><p>{error}</p><small>You can revise the evidence and retry. No unverified result has been substituted.</small></div></section>}
      {result && currentGraph && currentEvaluation && <section className={`live-result ${broken ? "broken" : "verified"}`}>
        <header><div><span className="eyebrow">Deterministic result</span><h2>{broken ? "Decision broken" : "Decision verified"}</h2><p>{recommendation?.statusReason ?? "The recommendation was evaluated from its declared dependencies."}</p></div>{recommendation && <div><StatusMark status={recommendation.status} /><strong>{String(recommendation.value ?? "Unresolved")}</strong></div>}</header>
        <DecisionTestSuite categories={buildDecisionTestSuite(currentEvaluation)} onInspect={setSelectedId} />
        {broken && correctionPreview && !corrected && <section className="live-correction" data-testid="live-correction-preview"><div><span className="eyebrow">Source-bound repair</span><h3>{result.analysis.graph.corrections.length} correction{result.analysis.graph.corrections.length === 1 ? "" : "s"} ready</h3><p>Decispec will replace only the declared faulty operations, rematerialize their dependencies, and recompute every downstream claim.</p></div><div className="live-diff">{correctionPreview.diff.filter((item) => item.statusBefore !== item.statusAfter || item.before !== item.after).slice(0, 8).map((item) => <div key={item.nodeId}><strong>{item.label}</strong><span>{formatValue(item.before)} → {formatValue(item.after)}</span><small>{item.statusBefore} → {item.statusAfter}</small></div>)}</div><button className="button button-primary" data-testid="apply-live-correction" onClick={applyProposedCorrections}><CheckCircle2 size={15} /> Apply and recompute</button></section>}
        <div className="live-graph-toolbar"><strong>{focusedPath ? "Broken dependency path" : "Complete dependency graph"}</strong>{broken && <button className="button button-quiet" onClick={() => setShowFullGraph((value) => !value)}>{focusedPath ? "Show full graph" : "Focus broken path"}</button>}</div>
        <div className="live-proof-grid"><div className="live-graph"><ProofGraph nodes={currentEvaluation.nodes} edges={currentGraph.edges} activeTrace={currentEvaluation.propagationTrace} focused={focusedPath} focusedIds={focusedPath ? brokenPath : undefined} selectedId={selectedId} onSelect={setSelectedId} /></div><aside className="live-sources"><span className="eyebrow">Exact source register</span><h3>{result.analysis.sourceSpans.length} bound passages</h3>{result.analysis.sourceSpans.map((span) => <article key={span.id}><strong>{span.pageLabel} · {span.section}</strong><q>{span.quote}</q><code>{span.id}</code></article>)}</aside></div>
        {corrected && <section className="live-result-actions"><button className="button button-quiet" onClick={undoCorrections}><RotateCcw size={15} /> Undo correction</button><button className="button button-quiet" onClick={downloadProof}><Download size={15} /> Download proof JSON</button><button className="button button-primary" data-testid="view-live-report" onClick={() => setShowReport((value) => !value)}><FileCheck2 size={15} /> {showReport ? "Hide report" : "View final report"}</button></section>}
        {showReport && proofExport && <article className="live-report" data-testid="live-proof-report"><header><div><span className="eyebrow">{BRAND.reportLabel}</span><h2>Live decision proof</h2></div><div className="live-report-stamp"><strong>PROOF PASSED</strong><span>Deterministic result</span></div></header><section><span>Recommendation state · {proofExport.report.recommendationState}</span><strong>{proofExport.report.recommendation}</strong><p>The final result was recomputed from the corrected graph. GPT proposed structure; Decispec evaluated the evidence, units, calculations, dependencies, and winner.</p></section><div className="live-report-values">{currentEvaluation.nodes.filter((node) => node.value !== undefined && ["calculation", "comparison", "recommendation"].includes(node.type)).map((node) => <div key={node.id}><span>{node.label}</span><strong>{formatValue(node.value, node.unitSpec.unit)}</strong><small>{node.status}</small></div>)}</div></article>}
        <footer>Provider: {result.provider.model} · Local integrity {currentEvaluation.integrity.score}% · {result.usage?.totalTokens?.toLocaleString() ?? "—"} tokens</footer>
      </section>}
    </main>
  );
}
