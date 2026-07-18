import { AlertTriangle, Check, CircleDashed, Calculator, HelpCircle, X } from "lucide-react";
import type { ClaimStatus } from "../lib/domain/schemas";

const statusMeta: Record<ClaimStatus, { label: string; icon: typeof Check }> = {
  supported: { label: "Supported", icon: Check },
  calculated: { label: "Calculated", icon: Calculator },
  assumed: { label: "Assumed", icon: HelpCircle },
  contradicted: { label: "Contradicted", icon: X },
  stale: { label: "Stale", icon: AlertTriangle },
  broken: { label: "Broken", icon: AlertTriangle },
  pending: { label: "Pending", icon: CircleDashed },
};

export function StatusMark({ status, compact = false }: { status: ClaimStatus; compact?: boolean }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <span className={`status-mark status-${status}`} aria-label={meta.label} title={meta.label}>
      <Icon size={compact ? 12 : 14} strokeWidth={2.2} aria-hidden="true" />
      {!compact && <span>{meta.label}</span>}
    </span>
  );
}
