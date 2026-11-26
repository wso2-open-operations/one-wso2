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

// Toolbar edits for the commentary editor, as pure functions over the text and
// its selection, so the editor only applies the result.

/** The text and the selection to put back after an edit. */
export interface TextEdit {
  text: string;
  start: number;
  end: number;
}

/**
 * Wraps the selection in `before` and `after` (bold, italic, code...). With nothing selected, inserts
 * `placeholder` between them and selects it, so typing replaces it.
 */
export function wrapSelection(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): TextEdit {
  const selected = text.slice(start, end) || placeholder;
  const next = text.slice(0, start) + before + selected + after + text.slice(end);
  const innerStart = start + before.length;
  return { text: next, start: innerStart, end: innerStart + selected.length };
}

/** `[selection](https://)` with the URL selected, ready to paste over. */
export function insertLink(text: string, start: number, end: number): TextEdit {
  const label = text.slice(start, end) || "link text";
  const url = "https://";
  const inserted = `[${label}](${url})`;
  const next = text.slice(0, start) + inserted + text.slice(end);
  const urlStart = start + label.length + 3;
  return { text: next, start: urlStart, end: urlStart + url.length };
}

/** Inline code for a one-line selection, a fenced block when it spans lines. */
export function insertCode(text: string, start: number, end: number): TextEdit {
  if (text.slice(start, end).includes("\n")) return wrapSelection(text, start, end, "```\n", "\n```", "code");
  return wrapSelection(text, start, end, "`", "`", "code");
}

export type LinePrefix = "bullet" | "numbered" | "quote";

/** Starts every line the selection touches with `- `, `1. `, `2. `... or `> `. */
export function prefixLines(text: string, start: number, end: number, kind: LinePrefix): TextEdit {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nl = text.indexOf("\n", end);
  const lineEnd = nl < 0 ? text.length : nl;
  const lines = text.slice(lineStart, lineEnd).split("\n");
  const prefixed = lines
    .map((line, i) => (kind === "bullet" ? `- ${line}` : kind === "quote" ? `> ${line}` : `${i + 1}. ${line}`))
    .join("\n");
  const next = text.slice(0, lineStart) + prefixed + text.slice(lineEnd);
  const caret = lineStart + prefixed.length;
  return start === end ? { text: next, start: caret, end: caret } : { text: next, start: lineStart, end: caret };
}

/** A mention being typed: the index of its `@` and the text after it, up to the caret. */
export interface MentionQuery {
  start: number;
  query: string;
}

/**
 * The `@name` being typed at the caret, if any: an `@` at the start of the text or after a non-word character (so
 * an email address does not count), followed by 1 to 50 characters with no line break, `@` or bracket.
 */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && /[\p{L}\p{N}_]/u.test(before.charAt(at - 1))) return null;
  const query = before.slice(at + 1);
  if (query.length < 1 || query.length > 50) return null;
  if (/[\n@[\]]/.test(query) || /^\s/.test(query) || /\s{2}$/.test(query)) return null;
  return { start: at, query };
}
