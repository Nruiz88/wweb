// Proteccion basica contra ReDoS (catastrophic backtracking).
// Un patron tipo (a+)+, (a*)*, (a|a)+ puede colgar el webhook.

export const MAX_REGEX_LENGTH = 200;

// Detectar grupos anidados con cuantificadores: (X+)+, (X*)*, (X+)*, (X*)+
const NESTED_QUANTIFIER = /\([^)]*[+*][^)]*\)[+*]/;

// Cuantificadores sobre grupos que ya contienen alternancia con cuantificadores: (a|a)+
const AMBIGUOUS_QUANTIFIER = /\(\s*(?:[^)]*\|[^)]*){2,}\s*\)[+*]/;

export function isReDosLike(pattern: string): boolean {
  if (pattern.length > MAX_REGEX_LENGTH) {
    return true;
  }
  return NESTED_QUANTIFIER.test(pattern) || AMBIGUOUS_QUANTIFIER.test(pattern);
}

export function isSafeRegex(pattern: string): boolean {
  if (!pattern || pattern.length > MAX_REGEX_LENGTH) {
    return false;
  }
  if (isReDosLike(pattern)) {
    return false;
  }
  try {
    new RegExp(pattern, "i");
    return true;
  } catch {
    return false;
  }
}