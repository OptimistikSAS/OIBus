import { JSONPath } from 'jsonpath-plus';

/**
 * Splits a JSONPath expression into its individual navigation segments.
 * e.g. "$[0].data.diameters[1].value" -> ["$", "[0]", ".data", ".diameters", "[1]", ".value"]
 */
function splitPathSegments(path: string): Array<string> {
  const segments: Array<string> = [];
  const regex = /\$|\.[^.[\]]+|\[[^\]]+\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(path)) !== null) {
    segments.push(match[0]);
  }
  return segments;
}

/** Extracts every numeric array index found in a JSONPath "path" string, in encounter order. */
function extractIndices(path: string): Array<number> {
  const indices: Array<number> = [];
  const indexRegex = /\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = indexRegex.exec(path)) !== null) {
    indices.push(Number(match[1]));
  }
  return indices;
}

/**
 * Resolves a JSONPath expression against a value, automatically parsing any
 * JSON-stringified intermediate node when normal traversal would otherwise fail
 * (e.g. an MQTT message whose payload is a JSON string). Leaf strings are left untouched.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveJsonPath(path: string, json: unknown): any {
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json);
    } catch {
      return undefined;
    }
  }
  if (json === null || json === undefined) return undefined;

  const result = JSONPath({ path, json: json as object, wrap: false });
  if (result !== undefined && result !== null) return result;

  // Direct traversal returned nothing. Scan right-to-left through path segments
  // to find the deepest JSON-stringified intermediate node, parse it, then run
  // the remaining suffix path on the parsed value.
  const segments = splitPathSegments(path);
  for (let i = segments.length - 1; i >= 2; i--) {
    const prefix = segments.slice(0, i).join('');
    const suffix = '$' + segments.slice(i).join('');
    const intermediate = JSONPath({ path: prefix, json: json as object, wrap: false });
    if (typeof intermediate !== 'string') continue;
    try {
      const parsed = JSON.parse(intermediate);
      return resolveJsonPath(suffix, parsed);
    } catch {
      continue;
    }
  }

  return result;
}

/**
 * Resolves every row matched by a row-iterator JSONPath, returning the ordered array indices
 * consumed along each match — including indices from *inside* a JSON-stringified intermediate
 * node (e.g. a single MQTT message payload holding several metrics in one string field).
 *
 * This mirrors `resolveJsonPath`'s "auto-parse an embedded JSON string" behavior, but fans out
 * across every match instead of returning one value, so a row-iterator path can cross a string
 * boundary (e.g. `$[*].message.metrics[*]`) and still yield one row per nested match rather than
 * being stuck at one row per top-level element. The returned indices feed `injectIndices` so each
 * column's per-row path resolves to the right specific row.
 */
export function resolveJsonPathRows(path: string, json: unknown): Array<{ indices: Array<number> }> {
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json);
    } catch {
      return [];
    }
  }
  if (json === null || json === undefined) return [];

  const direct = JSONPath({ path, json: json as object, resultType: 'all' }) as Array<{ path: string }>;
  if (direct.length > 0) {
    return direct.map(node => ({ indices: extractIndices(node.path) }));
  }

  // No direct matches: scan right-to-left for the deepest JSON-stringified intermediate node(s),
  // parse each, and recurse into it with the remaining suffix path. The prefix may itself match
  // several nodes (e.g. one string per top-level array element), each expanded independently.
  const segments = splitPathSegments(path);
  for (let i = segments.length - 1; i >= 2; i--) {
    const prefix = segments.slice(0, i).join('');
    const suffix = '$' + segments.slice(i).join('');
    const prefixMatches = JSONPath({ path: prefix, json: json as object, resultType: 'all' }) as Array<{
      value: unknown;
      path: string;
    }>;
    const rows: Array<{ indices: Array<number> }> = [];
    for (const prefixMatch of prefixMatches) {
      if (typeof prefixMatch.value !== 'string') continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(prefixMatch.value);
      } catch {
        continue;
      }
      const prefixIndices = extractIndices(prefixMatch.path);
      for (const suffixRow of resolveJsonPathRows(suffix, parsed)) {
        rows.push({ indices: [...prefixIndices, ...suffixRow.indices] });
      }
    }
    if (rows.length > 0) return rows;
  }

  return [];
}
