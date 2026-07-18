"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, LoaderCircle, Play, Square, UploadCloud } from "lucide-react";
import type { AnalysisPlan, NormalizedDocument } from "../lib/providers/analysis-provider";
import type { EvaluationResult } from "../lib/domain/engine";
import { buildDecisionTestSuite } from "../lib/domain/test-suite";
import { DecisionTestSuite } from "./DecisionTestSuite";
import { ProofGraph } from "./ProofGraph";
import { StatusMark } from "./StatusMark";
import { BRAND } from "../lib/config/brand";

const progressStages = ["Reading evidence", "Binding claims to sources", "Building dependency graph", "Validating provenance", "Executing calculations", "Testing recommendation", "Preparing report"];
type LiveResponse = { provider: { name: string; mode: "live-openai"; model: string }; usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null } | null; requestId: string | null; latencyMs: number | null; analysis: AnalysisPlan; evaluation: EvaluationResult };

export function LiveAnalysisWorkspace() {
  const [memo, setMemo] = useState("");
  const [manualEvidence, setManualEvidence] = useState("");
  const [documents, setDocuments] = useState<NormalizedDocument[]>([]);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<LiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.dataset.assertLiveHydrated = "true";
    return () => { delete document.documentElement.dataset.assertLiveHydrated; };
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

  const run = async () => {
    if (!memo.trim() || allDocuments.length === 0 || running) return;
    controller.current = new AbortController();
    setRunning(true); setStage(0); setError(null); setResult(null);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documents: allDocuments, draftMemo: memo.trim() }), signal: controller.current.signal });
      const body = await response.json() as LiveResponse & { error?: string; code?: string };
      if (!response.ok) throw new Error(body.error ?? (body.code ? `Analysis stopped safely (${body.code}).` : "Analysis could not be completed."));
      setResult(body); setSelectedId(body.evaluation.nodes.find((node) => node.type === "recommendation")?.id ?? body.evaluation.nodes[0]?.id ?? "");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") setError("Analysis cancelled. No retry was made.");
      else setError(caught instanceof Error ? caught.message : "Analysis could not be completed.");
    } finally {
      setRunning(false); controller.current = null;
    }
  };

  const recommendation = result?.evaluation.nodes.find((node) => node.type === "recommendation");
  const broken = recommendation?.status === "broken" || recommendation?.status === "contradicted";
  return (
    <main className="live-workspace">
      <header className="workspace-header live-header"><Link href="/" className="wordmark" aria-label={`${BRAND.productName} home`}><span className="wordmark-mark">{BRAND.monogram}</span> {BRAND.productName}</Link><div className="decision-heading"><span className="eyebrow">Analyze my decision</span><h1>Live, source-bound analysis</h1></div><span className="mode-label"><span className="mode-dot" /> GPT semantic analysis + local proof engine</span></header>
      <section className="live-intro"><div><span className="eyebrow">Explicit live mode</span><h2>Test an AI-written recommendation against its evidence.</h2><p>GPT proposes source spans and graph structure. Strict local validation and the deterministic engine decide what passes, breaks, and follows.</p></div><Link className="button button-quiet" href="/workspace/demo">Use instant demonstration</Link></section>
      <div className="live-input-grid">
        <section className="live-card"><span className="eyebrow">1 · Draft recommendation</span><h2>AI-written memo</h2><textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Paste the recommendation you want to test…" maxLength={120000} disabled={running} /><small>{memo.length.toLocaleString()} / 120,000 characters</small></section>
        <section className="live-card"><span className="eyebrow">2 · Supporting evidence</span><h2>Evidence documents</h2><textarea value={manualEvidence} onChange={(event) => setManualEvidence(event.target.value)} placeholder="Paste evidence text, or upload TXT/PDF files below…" maxLength={120000} disabled={running} />
          <label className="live-upload"><UploadCloud size={18} /><span><strong>Upload TXT or text PDF</strong><small>Up to 8 files · 10 MB each · no OCR</small></span><input type="file" accept=".txt,.pdf,text/plain,application/pdf" multiple disabled={running} onChange={(event) => upload(event.target.files)} /></label>
          {documents.length > 0 && <ul className="live-documents">{documents.map((document) => <li key={document.id}><FileText size={14} /><span>{document.title}<small>{document.content.length.toLocaleString()} characters</small></span></li>)}</ul>}
        </section>
      </div>
      <section className="live-runbar" aria-live="polite">
        <div><strong>{running ? progressStages[stage] : result ? "Analysis complete" : error ? "Analysis could not be completed" : "Ready to test"}</strong><small>{running ? "Long evidence sets can take up to 90 seconds. The page remains responsive." : "The API is called only when you press Test decision."}</small></div>
        {running ? <button className="button button-danger" onClick={() => controller.current?.abort()}><Square size={14} /> Cancel</button> : <button className="button button-primary" data-testid="test-live-decision" disabled={!memo.trim() || allDocuments.length === 0} onClick={run}><Play size={15} /> Test decision</button>}
        {running && <LoaderCircle className="live-spinner" size={20} />}
      </section>
      {error && <section className="live-error" role="alert"><AlertTriangle size={20} /><div><strong>Analysis could not be completed</strong><p>{error}</p><small>You can revise the evidence and retry. No demonstration result has been substituted.</small></div></section>}
      {result && <section className={`live-result ${broken ? "broken" : "verified"}`}>
        <header><div><span className="eyebrow">Deterministic result</span><h2>{broken ? "Decision broken" : "Decision verified"}</h2><p>{recommendation?.statusReason ?? "The recommendation was evaluated from its declared dependencies."}</p></div>{recommendation && <div><StatusMark status={recommendation.status} /><strong>{String(recommendation.value ?? "Unresolved")}</strong></div>}</header>
        <DecisionTestSuite categories={buildDecisionTestSuite(result.evaluation)} onInspect={setSelectedId} />
        <div className="live-proof-grid"><div className="live-graph"><ProofGraph nodes={result.evaluation.nodes} edges={result.analysis.graph.edges} activeTrace={result.evaluation.propagationTrace} focused={false} selectedId={selectedId} onSelect={setSelectedId} /></div><aside className="live-sources"><span className="eyebrow">Exact source register</span><h3>{result.analysis.sourceSpans.length} bound passages</h3>{result.analysis.sourceSpans.map((span) => <article key={span.id}><strong>{span.pageLabel} · {span.section}</strong><q>{span.quote}</q><code>{span.id}</code></article>)}</aside></div>
        <footer>Provider: {result.provider.model} · Local integrity {result.evaluation.integrity.score}% · {result.usage?.totalTokens?.toLocaleString() ?? "—"} tokens</footer>
      </section>}
    </main>
  );
}
