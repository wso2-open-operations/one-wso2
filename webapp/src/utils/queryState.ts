// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// Putting a screen's view into its query string, and reading it back out.
//
// Finance MIS is the first route in One WSO2 to carry filter state in the URL.
// `features/pinned/pinnableRoute.ts` anticipated it — "No route here carries
// filter state in the URL yet; this is the seam that will already be correct
// for the first one that does" — and this is the other half of that sentence:
// the mechanics live here, shared, rather than inside the first app to need
// them. A screen supplies its own vocabulary; what it should not have to supply
// again is the two rules every such URL owes its reader.
//
// ---- rule 1: a default view serialises to an empty query string -----------
//
// So the address bar stays clean, so a link is short enough to paste into a
// chat, and — the load-bearing one — so "did this link carry a view?" has an
// answer. A serialiser that writes every parameter every time makes that
// question unanswerable, and with it the decision of whether to hydrate a
// screen from the URL or leave it on its own defaults.
//
// ---- rule 2: an unrecognised value is ignored, never thrown on ------------
//
// URLs are typed, truncated by chat clients, hand-edited, kept in bookmarks
// across a deploy that renamed a value, and decorated with tracking parameters
// nobody here has heard of. Every one of those has to land on the default view.
// A parser that throws turns a stale bookmark into an error screen; a parser
// that half-accepts turns it into a view the reader cannot account for. So a
// value is either recognised in full or has no effect at all.
//
// The counterpart is `recognised` on the reader: the count of parameters that
// meant something, which is how a caller decides between hydrating from the URL
// and leaving the screen on its defaults.

/**
 * How one parameter is read out of a URL.
 *
 * `parse` returns `undefined` for anything it does not recognise — that is the
 * whole of rule 2, and it is why every codec here returns rather than throws.
 *
 * Separate from the full codec because not every parameter is read and written
 * the same way round. A parameter with exactly one writable value — `scale=k`,
 * `window=ttm` — has no `format` worth writing: the caller either sets the
 * literal or omits the parameter, and a `format` that ignores its argument and
 * returns the literal anyway would be a lie the type could not catch.
 */
export interface QueryParamReader<T> {
  /** The value this raw string means, or `undefined` if it means nothing here. */
  parse(raw: string): T | undefined;
}

/** A parameter that crosses the boundary in both directions. */
export interface QueryParamCodec<T> extends QueryParamReader<T> {
  /** How the value is written into a query string. */
  format(value: T): string;
}

/**
 * A flag, written compactly.
 *
 * Reads `true`/`false` as well as `1`/`0` because a link edited by hand is
 * written the way a person would write it, and accepting both costs one branch.
 * Casing is not guessed at: `TRUE` is not a value this app ever wrote.
 */
export const booleanParam: QueryParamCodec<boolean> = {
  parse: (raw) => (raw === "1" || raw === "true" ? true : raw === "0" || raw === "false" ? false : undefined),
  format: (value) => (value ? "1" : "0"),
};

/**
 * A comma-separated list, trimmed of the whitespace a pasted link picks up.
 *
 * A list with nothing left in it is `undefined`, not `[]`. An empty list is not
 * a filter, and returning one would make `?region=` count as an applied filter
 * that happens to match nothing — a view the reader cannot tell from a bug.
 */
export const listParam: QueryParamCodec<string[]> = {
  parse: (raw) => {
    const items = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length ? items : undefined;
  },
  format: (value) => value.join(","),
};

/**
 * One of a fixed set of values, compared exactly.
 *
 * The allowed list is the display vocabulary — "Sales Region", "Commit" — so
 * matching is case-sensitive on purpose. Normalising casing here would accept
 * strings this app never wrote and quietly widen the contract.
 */
export function oneOfParam<T extends string>(allowed: readonly T[]): QueryParamCodec<T> {
  return {
    parse: (raw) => (allowed.includes(raw as T) ? (raw as T) : undefined),
    format: String,
  };
}

/**
 * A whole number inside a closed range.
 *
 * The blank check is not redundant: `Number("")` and `Number(" ")` are both 0,
 * which passes `Number.isInteger` and lands inside any range that includes
 * zero. `?years=` would then read as a deliberate 0 rather than as nothing.
 */
export function integerParam({ min, max }: { min: number; max: number }): QueryParamCodec<number> {
  return {
    parse: (raw) => {
      if (!raw.trim()) return undefined;
      const value = Number(raw);
      return Number.isInteger(value) && value >= min && value <= max ? value : undefined;
    },
    format: String,
  };
}

/** Builds a query string, omitting everything that is still at its default. */
export interface QueryWriter {
  /**
   * Write `value` unless it is absent or equal to `fallback`.
   *
   * Lists are compared by contents. They are rebuilt on every apply, so they
   * are never the same object as the default — comparing by identity would put
   * every list filter into every URL and rule 1 would never hold.
   */
  setIfChanged<T>(param: string, value: T | null | undefined, fallback: T | undefined, codec: QueryParamCodec<T>): void;
  /** Write a value that has no default to be at. */
  set(param: string, value: string): void;
  /** The query string, without a leading `?`. */
  toString(): string;
}

export function queryWriter(): QueryWriter {
  const query = new URLSearchParams();
  return {
    setIfChanged(param, value, fallback, codec) {
      if (value == null || sameValue(value, fallback)) return;
      query.set(param, codec.format(value));
    },
    set(param, value) {
      query.set(param, value);
    },
    toString: () => query.toString(),
  };
}

/** Reads a query string, ignoring everything it does not recognise. */
export interface QueryReader {
  /**
   * The value of `param`, or `undefined` if it is absent or malformed.
   *
   * Counts towards `recognised` unless `countsAsViewState` says otherwise —
   * for a parameter that rides along in the URL without being part of the view,
   * such as a display preference.
   */
  read<T>(param: string, codec: QueryParamReader<T>, options?: { countsAsViewState?: boolean }): T | undefined;
  /** How many parameters so far meant something. */
  readonly recognised: number;
}

export function queryReader(search: string): QueryReader {
  const query = new URLSearchParams(search.replace(/^\?/, ""));
  let recognised = 0;
  return {
    read(param, codec, { countsAsViewState = true } = {}) {
      const raw = query.get(param);
      if (raw === null) return undefined;
      const value = codec.parse(raw);
      if (value === undefined) return undefined;
      if (countsAsViewState) recognised += 1;
      return value;
    },
    get recognised() {
      return recognised;
    },
  };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }
  return Object.is(a, b);
}
