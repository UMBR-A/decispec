export const CALCULATION_FAILURE_REASONS = [
  "UNSUPPORTED_OPERATION",
  "INPUT_TYPE_MISMATCH",
  "OUTPUT_TYPE_MISMATCH",
  "UNDECLARED_DEPENDENCY",
  "INVALID_OPERAND",
  "NONDETERMINISTIC_SELECTION",
  "UNRESOLVED_TIE",
] as const;

export type CalculationFailureReason = typeof CALCULATION_FAILURE_REASONS[number];

export class CalculationContractError extends Error {
  constructor(readonly reason: CalculationFailureReason) {
    super("Deterministic calculation contract failed.");
    this.name = "CalculationContractError";
  }
}
