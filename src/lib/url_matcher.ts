// Centralized URL matching utilities for extension context

/**
 * Check if a single pattern matches the given URL.
 * Supports wildcard '*' and '?', and '*://' to mean 'http(s)://'.
 * Allows trailing query/hash when the pattern ends at path boundary.
 */
export function doesUrlMatch(url: string, pattern: string): boolean {
  if (!url || !pattern) return false;
  try {
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");

    if (pattern.startsWith("*://")) {
      regexPattern = regexPattern.replace(/^\.\*:\/\//, "https?://");
    }

    // Anchor the converted pattern, but allow optional trailing slash and query/hash suffixes
    const regex = new RegExp("^" + regexPattern + "(?:/)?(?:[?#].*)?$", "i");
    return regex.test(url);
  } catch (_e) {
    return false;
  }
}

/**
 * Check if the URL matches any pattern in `matches`, while respecting `excludes`.
 */
export function urlMatches(url: string, matches: string[] = [], excludes: string[] = []): boolean {
  for (const exclude of excludes) {
    if (doesUrlMatch(url, exclude)) return false;
  }
  for (const match of matches) {
    if (doesUrlMatch(url, match)) return true;
  }
  return false;
}

/**
 * Normalize a single Chrome match pattern:
 * - Strip query/hash suffix if present
 * - Ensure trailing '*' to include subpaths/hash (e.g. "/full-screen*" covers hash routing)
 */
export function normalizeMatchPattern(pattern: string): string {
  try {
    let base = String(pattern || "");
    const hashIndex = base.indexOf('#');
    if (hashIndex >= 0) base = base.slice(0, hashIndex);
    const qIndex = base.indexOf('?');
    if (qIndex >= 0) base = base.slice(0, qIndex);
    if (!base.endsWith('*')) base += '*';
    return base;
  } catch {
    return pattern;
  }
}

/**
 * Normalize multiple patterns at once.
 */
export function normalizePatterns(patterns: string[] = []): string[] {
  return (patterns || []).map(normalizeMatchPattern);
}


