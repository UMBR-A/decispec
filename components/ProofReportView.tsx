"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { applyCorrection, buildProofExport, evaluateGraph } from "../lib/domain/engine";
import { demoProject, demoSourceSpanIds } from "../lib/demo/fixture";
import { BRAND } from "../lib/config/brand";

function money(value: unknown) {
  return typeof value === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : String(value ?? "—");
}

export function ProofReportView({ corrected, generatedAt }: { corrected: boolean; generatedAt: string }) {
  const original = useMemo(() => evaluateGraph(demoProject.graph, demoSourceSpanIds), []);
  const currentGraph = useMemo(() => corrected ? applyCorrection(demoProject.graph, demoProject.graph.corrections[0]) : demoProject.graph, [corrected]);
  const result = useMemo(() => corrected ? evaluateGraph(currentGraph, demoSourceSpanIds) : original, [corrected, currentGraph, original]);
  const proofExport = useMemo(() => buildProofExport(demoProject.id, currentGraph, result, original, demoProject.sourceSpans, {
    phase: corrected ? "corrected" : "verified",
    generatedAt,
  }), [corrected, currentGraph, generatedAt, original, result]);
  const report = proofExport.report;
  const node = (id: string) => result.nodes.find((item) => item.id === id);

  const download = () => {
    const payload = { product: BRAND.exportMetadata, ...proofExport };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "decispec-proof-report.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="report-page" id="main-content">
      <nav className="report-toolbar no-print">
        <Link className="wordmark" href="/" aria-label={`${BRAND.productName} home`}><span className="wordmark-mark">{BRAND.monogram}</span> {BRAND.productName}</Link>
        <div><Link className="button button-quiet" href="/workspace/demo">Back to workspace</Link><button className="button button-quiet" onClick={download}><Download size={15} /> Download JSON</button><button className="button button-primary" onClick={() => window.print()}><Printer size={15} /> Print / Save PDF</button></div>
      </nav>
      <article className="report-sheet">
        <header className="report-header">
          <div><span className="report-kicker">{BRAND.reportLabel} 001</span><h1>{demoProject.title}</h1><p>{demoProject.question}</p></div>
          <div className={`report-stamp ${corrected ? "report-stamp-passed" : "report-stamp-failed"}`}><strong>{corrected ? "PROOF PASSED" : "PROOF FAILED"}</strong><span>Deterministic demo</span></div>
        </header>
        <section className="report-recommendation">
          <span>Recommendation state · {report.recommendationState}</span>
          <strong>{corrected ? "Select Vendor B" : "Imported Vendor A recommendation is not proven"}</strong>
          <p>{corrected ? "Vendor B is $182,748 less expensive than Vendor A and remains $14,071 below the approved three-year budget." : "A monthly support rate was treated as annual, invalidating Vendor A’s total and every dependent conclusion."}</p>
        </section>
        <div className="report-columns">
          <section><span className="report-section-label">Verification summary</span><h2>Claim status</h2><div className="report-status-grid">{Object.entries(report.summary).filter(([, count]) => count > 0).map(([status, count]) => <div key={status}><strong>{count}</strong><span>{status}</span></div>)}</div></section>
          <section><span className="report-section-label">Decision dependency</span><h2>Why the result follows</h2><ol className="dependency-list"><li>300 students × 1.07 = 321 devices</li><li>Quote A support is per device, per month</li><li>321 × $18 × 36 = $208,008 support</li><li>Vendor A total = $268,677</li><li>Vendor B total = $85,929</li></ol></section>
        </div>
        <section className="report-section">
          <span className="report-section-label">Before / after</span><h2>One source-bound correction</h2>
          <div className="report-table-scroll" tabIndex={0} role="region" aria-label="Scrollable before and after comparison"><table><thead><tr><th>Claim</th><th>Imported memo</th><th>Corrected proof</th></tr></thead><tbody>
            <tr><th>Vendor A support</th><td>$17,334 <small>321 × $18 × 3 years</small></td><td>$208,008 <small>321 × $18 × 36 months</small></td></tr>
            <tr><th>Vendor A total</th><td>$78,003</td><td>$268,677</td></tr>
            <tr><th>Recommendation</th><td>Vendor A</td><td>Vendor B</td></tr>
          </tbody></table></div>
        </section>
        <div className="report-columns">
          <section><span className="report-section-label">Material failure</span><h2>Monthly ≠ annual</h2><p>The quote states “$18 per device per month” for a 36-month term. The imported expression used three multipliers, which is dimensionally incompatible.</p><div className="report-callout">No evidence was silently repaired. The corrected state exists only after explicit application.</div></section>
          <section><span className="report-section-label">Material assumption</span><h2>Price stability</h2><p>Quoted prices are assumed to remain fixed through award. This is declared, reviewable, and not represented as source-supported.</p><p><strong>Budget check:</strong> {money(node("b-total")?.value)} ≤ $100,000.</p></section>
        </div>
        <section className="report-section source-register"><span className="report-section-label">Exact source register</span><h2>Evidence used</h2>{demoProject.sourceSpans.filter((span) => ["s-students", "s-spares", "s-standard", "s-a-support", "s-a-term", "s-b-hardware", "s-b-setup"].includes(span.id)).map((span) => <div key={span.id}><strong>{span.pageLabel} · {span.section}</strong><q>{span.quote}</q><code>{span.id}</code></div>)}</section>
        <footer className="report-footer"><span>Generated locally in deterministic demo mode · {new Date(report.generatedAt).toLocaleString()}</span><span>{BRAND.productName} verifies declared support, calculations, units, and dependencies—not universal truth.</span></footer>
      </article>
    </main>
  );
}
