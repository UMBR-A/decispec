import Link from "next/link";
import { ArrowRight, Check, FileSearch, GitBranch, TriangleAlert } from "lucide-react";
import { BRAND } from "../lib/config/brand";

export default function Home() {
  return (
    <main className="landing" id="main-content">
      <nav className="landing-nav"><span className="wordmark"><span className="wordmark-mark">{BRAND.monogram}</span> {BRAND.productName}</span><span className="mode-label"><span className="mode-dot" /> Deterministic demo</span></nav>
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">{BRAND.supportingPositioning}</span>
          <h1>{BRAND.tagline}</h1>
          <p>{BRAND.explanation}</p>
          <div className="hero-inputs" aria-label="What you need to run a decision test">
            <span><strong>01</strong> Source evidence</span>
            <span><strong>02</strong> AI-written recommendation</span>
          </div>
          <div className="landing-actions"><Link href="/workspace/demo" className="button button-primary button-large">Instant demonstration <ArrowRight size={18} /></Link><Link href="/workspace/live" className="button button-quiet button-large">Analyze my decision</Link></div>
          <div className="hero-footnote"><Check size={14} /> Exact evidence in. Deterministic decision out.</div>
        </div>
        <div className="hero-instrument" aria-label="Preview of a broken decision proof">
          <div className="instrument-top"><span>DECISION PROOF / 001</span><span className="status-mark status-broken"><TriangleAlert size={13} /> BROKEN</span></div>
          <div className="instrument-question"><span>Imported recommendation</span><strong>Select Vendor A</strong><small>Three-year student device purchase</small></div>
          <div className="instrument-path">
            <div className="mini-node supported"><FileSearch size={15} /><span>Quote A</span><small>$18 / device / month</small></div>
            <ArrowRight size={16} />
            <div className="mini-node broken"><TriangleAlert size={15} /><span>Support cost</span><small>unit mismatch</small></div>
            <ArrowRight size={16} />
            <div className="mini-node broken"><GitBranch size={15} /><span>Recommendation</span><small>dependency failed</small></div>
          </div>
          <div className="instrument-evidence"><span>Exact evidence</span><blockquote>Managed Care support — <mark>$18 per device per month</mark>. Term: 36 months.</blockquote><small>Vendor A Quote · p. 1 · Support plan</small></div>
          <div className="instrument-footer"><span>11 source bindings</span><span>15 claims</span><span>15 dependencies</span></div>
        </div>
      </section>
      <section className="landing-proof-strip"><article><span>01</span><div><strong>Bind</strong><p>Every material claim points to an exact source passage.</p></div></article><article><span>02</span><div><strong>Execute</strong><p>Structured operations recompute in dependency order.</p></div></article><article><span>03</span><div><strong>Break</strong><p>Unit failures travel visibly to the final recommendation.</p></div></article></section>
    </main>
  );
}
