import Link from "next/link";
import { ArrowRight, Check, FileSearch, GitBranch, ShieldCheck } from "lucide-react";
import { BRAND } from "../lib/config/brand";

export default function Home() {
  return (
    <main className="landing" id="main-content">
      <nav className="landing-nav"><span className="wordmark"><span className="wordmark-mark">{BRAND.monogram}</span> {BRAND.productName}</span><span className="mode-label"><span className="mode-dot" /> Decision verification</span></nav>
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">{BRAND.supportingPositioning}</span>
          <h1>{BRAND.tagline}</h1>
          <p>{BRAND.explanation}</p>
          <div className="hero-inputs" aria-label="What you need to run a decision test">
            <span><strong>01</strong> Source evidence</span>
            <span><strong>02</strong> AI-written recommendation</span>
          </div>
          <div className="landing-actions"><Link href="/workspace/live" className="button button-primary button-large">Analyze my decision <ArrowRight size={18} /></Link></div>
          <div className="hero-footnote"><Check size={14} /> Exact evidence in. Deterministic decision out.</div>
        </div>
        <div className="hero-instrument" aria-label="Decision verification workflow">
          <div className="instrument-top"><span>DECISION SPECIFICATION</span><span className="status-mark status-supported"><ShieldCheck size={13} /> SOURCE-BOUND</span></div>
          <div className="instrument-question"><span>Your decision</span><strong>Test whether the recommendation follows</strong><small>Evidence and recommendation stay traceable</small></div>
          <div className="instrument-path">
            <div className="mini-node supported"><FileSearch size={15} /><span>Evidence</span><small>exact source spans</small></div>
            <ArrowRight size={16} />
            <div className="mini-node supported"><GitBranch size={15} /><span>Proof graph</span><small>executable dependencies</small></div>
            <ArrowRight size={16} />
            <div className="mini-node supported"><ShieldCheck size={15} /><span>Decision</span><small>verified or broken</small></div>
          </div>
          <div className="instrument-evidence"><span>Controlled evaluation</span><blockquote>Exact source text controls evidence. Deterministic code controls calculations and results.</blockquote><small>No unsupported conclusion is treated as verified.</small></div>
          <div className="instrument-footer"><span>Source references</span><span>Typed calculations</span><span>Auditable exports</span></div>
        </div>
      </section>
      <section className="landing-proof-strip"><article><span>01</span><div><strong>Bind</strong><p>Every material claim points to an exact source passage.</p></div></article><article><span>02</span><div><strong>Execute</strong><p>Structured operations recompute in dependency order.</p></div></article><article><span>03</span><div><strong>Break</strong><p>Unit failures travel visibly to the final recommendation.</p></div></article></section>
    </main>
  );
}
