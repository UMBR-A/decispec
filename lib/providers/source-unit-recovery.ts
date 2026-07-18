import type { Unit } from "../domain/schemas";

export type SourceNumericRole =
  | "currency"
  | "per-device-rate"
  | "recurring-rate"
  | "duration"
  | "percentage"
  | "quantity"
  | "scalar";

export type RecoveredSourceNumber = {
  value: number;
  unit: Unit;
  role: SourceNumericRole;
};

export function numericRoleForUnit(unit: Unit): SourceNumericRole | null {
  if (unit === "currency" || unit === "three-year-total") return "currency";
  if (unit === "currency-per-device") return "per-device-rate";
  if (unit === "currency-per-device-per-month") return "recurring-rate";
  if (unit === "month" || unit === "year") return "duration";
  if (unit === "percent" || unit === "ratio") return "percentage";
  if (unit === "devices") return "quantity";
  if (unit === "scalar") return "scalar";
  return null;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function parsingCanonical(value: string): string {
  return value
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u00a0\s]+/g, " ");
}

function numericValue(value: string): number | null {
  const parsed = Number(value.replace(/[$,%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function wordOrNumber(value: string): number | null {
  return NUMBER_WORDS[value.toLowerCase()] ?? numericValue(value);
}

type LocatedNumber = RecoveredSourceNumber & { start: number; end: number };

export function recoverSourceNumbers(exactOriginalQuote: string): RecoveredSourceNumber[] {
  const text = parsingCanonical(exactOriginalQuote);
  const located: LocatedNumber[] = [];
  const covered = (start: number) => located.some((candidate) => start >= candidate.start && start < candidate.end);
  const add = (match: RegExpMatchArray, value: number | null, unit: Unit, role: SourceNumericRole) => {
    if (value === null || match.index === undefined) return;
    located.push({ value, unit, role, start: match.index, end: match.index + match[0].length });
  };

  for (const match of text.matchAll(/\$\s*\d[\d,]*(?:\.\d+)?\s*(?:per\s+device\s+per\s+(month|year)|\/\s*device\s*\/\s*(month|year))/gi)) {
    const time = (match[1] ?? match[2]).toLowerCase();
    if (time !== "month") continue;
    add(match, numericValue(match[0].match(/\$\s*\d[\d,]*(?:\.\d+)?/)?.[0] ?? ""), "currency-per-device-per-month", "recurring-rate");
  }
  for (const match of text.matchAll(/\$\s*\d[\d,]*(?:\.\d+)?\s*(?:per\s+device|\/\s*device)(?!\s*\/)/gi)) {
    if (covered(match.index ?? -1)) continue;
    add(match, numericValue(match[0].match(/\$\s*\d[\d,]*(?:\.\d+)?/)?.[0] ?? ""), "currency-per-device", "per-device-rate");
  }
  for (const match of text.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d[\d,]*)(?:\s*-\s*|\s+)(months?|years?)\b/gi)) {
    add(match, wordOrNumber(match[1]), match[2].toLowerCase().startsWith("month") ? "month" : "year", "duration");
  }
  for (const match of text.matchAll(/[-+]?\d[\d,]*(?:\.\d+)?\s*%/g)) {
    add(match, numericValue(match[0]), "percent", "percentage");
  }
  for (const match of text.matchAll(/\b\d[\d,]*(?:\.\d+)?\s+(?:students?|devices?)\b/gi)) {
    add(match, numericValue(match[0].match(/\d[\d,]*(?:\.\d+)?/)?.[0] ?? ""), "devices", "quantity");
  }
  for (const match of text.matchAll(/\$\s*\d[\d,]*(?:\.\d+)?/g)) {
    if (covered(match.index ?? -1)) continue;
    add(match, numericValue(match[0]), "currency", "currency");
  }

  const deduplicated = new Map<string, RecoveredSourceNumber>();
  for (const { value, unit, role } of located) deduplicated.set(`${role}:${unit}:${value}`, { value, unit, role });
  return [...deduplicated.values()];
}

export function recoverSourceFact(quotes: string[], role: SourceNumericRole): RecoveredSourceNumber[] {
  const candidates = quotes.flatMap(recoverSourceNumbers).filter((candidate) => candidate.role === role);
  const deduplicated = new Map<string, RecoveredSourceNumber>();
  for (const candidate of candidates) deduplicated.set(`${candidate.unit}:${candidate.value}`, candidate);
  return [...deduplicated.values()];
}
