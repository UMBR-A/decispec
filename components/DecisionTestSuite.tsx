import { AlertTriangle, Check, Clock3 } from "lucide-react";
import type { DecisionTestCategory } from "../lib/domain/test-suite";

export function DecisionTestSuite({ categories, onInspect }: { categories: DecisionTestCategory[]; onInspect?: (nodeId: string) => void }) {
  const failedCount = categories.reduce((total, category) => total + category.failed, 0);
  const pending = categories.some((category) => category.pending);
  return (
    <section className="decision-suite" aria-labelledby="decision-suite-title" aria-describedby="decision-suite-summary">
      <div><span className="eyebrow">Executable checks</span><h2 id="decision-suite-title">Decision Test Suite</h2><p id="decision-suite-summary" className="suite-summary">{pending ? "Ready to run" : failedCount ? `${failedCount} check${failedCount === 1 ? "" : "s"} failed` : "All checks passed"}</p></div>
      <div className="suite-grid">
        {categories.map((category) => {
          const resultLabel = category.pending ? "Pending" : `${category.passed} passed, ${category.failed} failed`;
          return (
            <button key={category.id} type="button" aria-label={`${category.label}: ${resultLabel}`} className={`suite-item ${category.failed ? "failed" : category.pending ? "pending" : "passed"}`} disabled={!onInspect || category.inspectNodeIds.length === 0} onClick={() => onInspect?.(category.inspectNodeIds[0])}>
              {category.failed ? <AlertTriangle size={15} /> : category.pending ? <Clock3 size={15} /> : <Check size={15} />}
              <span><strong>{category.label}</strong><small>{category.pending ? "Pending" : `${category.passed} passed · ${category.failed} failed`}</small></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
