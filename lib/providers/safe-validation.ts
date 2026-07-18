import { ZodError } from "zod";
import type { CalculationFailureReason } from "../domain/calculation-contract";

export const SAFE_VALIDATION_CODES = [
  "UNKNOWN_DOCUMENT",
  "DUPLICATE_SPAN_ID",
  "QUOTE_NOT_FOUND",
  "QUOTE_AMBIGUOUS",
  "NUMERIC_VALUE_NOT_BOUND",
  "UNKNOWN_SOURCE_SPAN",
  "DUPLICATE_NODE_ID",
  "UNKNOWN_DEPENDENCY",
  "INVALID_EDGE",
  "GRAPH_CYCLE",
  "INVALID_CALCULATION",
  "UNSUPPORTED_OPERATION",
  "INVALID_UNIT",
  "INVALID_RECOMMENDATION",
  "SCHEMA_VALIDATION_FAILED",
  "INVALID_CANDIDATE_REFERENCE",
  "CANDIDATE_VALUE_NOT_CALCULATED",
  "CANDIDATE_NOT_DECLARED_DEPENDENCY",
  "CANDIDATE_LABEL_MISMATCH",
  "POLICY_REFERENCE_MISSING",
  "PATH_ASSERTION_FAILED",
  "UNIT_PROVENANCE_MISSING",
  "UNIT_PROVENANCE_AMBIGUOUS",
  "DURATION_UNIT_MISSING",
  "DURATION_UNIT_CONFLICT",
  "RATE_DENOMINATOR_MISSING",
  "IMPLICIT_UNIT_CONVERSION",
  "DERIVED_VALUE_NOT_EXECUTABLE",
  "UNIT_PATH_ASSERTION_FAILED",
  "CALCULATION_OPERAND_NODE_MISSING",
  "CORRECTION_OPERAND_NODE_MISSING",
  "CORRECTION_SELF_DEPENDENCY",
  "CORRECTION_CREATES_CYCLE",
  "CORRECTION_DEPENDENCY_MATERIALIZATION_FAILED",
  "RECOMMENDATION_CANDIDATE_DEPENDENCY_MISSING",
  "UNKNOWN_SOURCE_SEGMENT",
  "SEGMENT_DOCUMENT_MISMATCH",
  "NONCONTIGUOUS_SOURCE_SEGMENTS",
  "INVALID_SEGMENT_ORDER",
  "NUMERIC_SEGMENT_REQUIRED",
  "SOURCE_BINDING_MISSING",
] as const;

export type SafeValidationCode = typeof SAFE_VALIDATION_CODES[number];
export type ValidationStage = "schema" | "source-spans" | "quotation" | "numeric-provenance" | "nodes" | "calculations" | "dependencies" | "edges" | "graph" | "units" | "recommendation";

export type SafeValidationDiagnostic = {
  stage: ValidationStage;
  code: SafeValidationCode;
  path: string;
  id?: string;
  counts?: Record<string, number>;
  state?: Record<string, boolean>;
};

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

export function diagnosticId(value: unknown): string | undefined {
  return typeof value === "string" && SAFE_ID.test(value) ? value : undefined;
}

export class SafeValidationError extends Error {
  constructor(readonly diagnostic: SafeValidationDiagnostic, readonly internalReason?: CalculationFailureReason) {
    super("Analysis validation failed.");
    this.name = "SafeValidationError";
  }
}

export function failValidation(diagnostic: SafeValidationDiagnostic, internalReason?: CalculationFailureReason): never {
  throw new SafeValidationError(diagnostic, internalReason);
}

function schemaPath(path: PropertyKey[]): string {
  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") return `${result}[${segment}]`;
    if (typeof segment === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(segment)) return `${result}.${segment}`;
    return result;
  }, "$");
}

export function safeSchemaDiagnostic(error: ZodError): SafeValidationDiagnostic {
  const issue = error.issues[0];
  const path = issue?.path ?? [];
  const last = path.at(-1);
  if (last === "operation") return { stage: "calculations", code: "UNSUPPORTED_OPERATION", path: schemaPath(path) };
  if (last === "unit" || last === "outputUnit" || path.includes("unitSpec")) {
    return { stage: "units", code: "INVALID_UNIT", path: schemaPath(path) };
  }
  return { stage: "schema", code: "SCHEMA_VALIDATION_FAILED", path: schemaPath(path) };
}
