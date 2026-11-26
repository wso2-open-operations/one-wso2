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

// Markdown in, LinkedIn-ready plain text out. LinkedIn commentary has no
// formatting of its own, so bold, italic and code become Unicode look-alikes
// (the Mathematical Alphanumeric Symbols block), strikethrough becomes a
// combining overlay, and lists and quotes become plain glyphs. Pure functions
// only: no React, no network, nothing logged.

/** The most a commentary may be, counted with `linkedInLength`. The API enforces the same number. */
export const COMMENTARY_MAX_LENGTH = 3000;

/** The most mention tokens one commentary may carry. The API refuses more (TOO_MANY_MENTIONS). */
export const MAX_MENTIONS = 20;

/** Bullet that replaces `- item` and `* item`. */
export const BULLET = "●";
/** Bar that starts a `> quote` line. */
export const QUOTE_BAR = "▌";
/** Combining long stroke overlay, written after each struck character. */
export const STRIKE = "̶";

// First code point of each styled alphabet (upper case, lower case) and digit run.
const BOLD = { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec };
const ITALIC = { upper: 0x1d608, lower: 0x1d622, digit: null };
const BOLD_ITALIC = { upper: 0x1d63c, lower: 0x1d656, digit: null };
const MONO = { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 };

type Alphabet = { upper: number; lower: number; digit: number | null };

// Placeholders live in the Unicode Private Use Area. Mentions take E000-E0FF;
// spans that must not be styled again (code, links) take E100 onwards.
const MENTION_BASE = 0xe000;
const PROTECT_BASE = 0xe100;
const PUA = /[\uE000-\uF8FF]/g;

function mapAscii(text: string, alphabet: Alphabet): string {
  let out = "";
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (ch.length === 1 && c >= 65 && c <= 90) out += String.fromCodePoint(alphabet.upper + c - 65);
    else if (ch.length === 1 && c >= 97 && c <= 122) out += String.fromCodePoint(alphabet.lower + c - 97);
    else if (ch.length === 1 && c >= 48 && c <= 57 && alphabet.digit !== null)
      out += String.fromCodePoint(alphabet.digit + c - 48);
    else out += ch;
  }
  return out;
}

export const toBold = (text: string): string => mapAscii(text, BOLD);
export const toItalic = (text: string): string => mapAscii(text, ITALIC);
export const toBoldItalic = (text: string): string => mapAscii(text, BOLD_ITALIC);
export const toMonospace = (text: string): string => mapAscii(text, MONO);

/** Each character followed by the combining overlay. Spaces and placeholders stay unstruck. */
export function toStrike(text: string): string {
  let out = "";
  for (const ch of text) {
    out += ch;
    if (!/\s/.test(ch) && !/[\uE000-\uF8FF]/.test(ch)) out += STRIKE;
  }
  return out;
}

/** Inline rules for one line: code, links, emphasis, strikethrough, in that order. */
function convertInline(line: string, protect: (s: string) => string): string {
  let s = line;
  // Code first, so nothing inside a code span is read as emphasis.
  s = s.replace(/`([^`\n]+)`/g, (_m, code: string) => protect(toMonospace(code)));
  // Links: the URL is protected so an underscore in it is not read as italic.
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => `${text} ${protect(`(${url})`)}`);
  s = s.replace(/\*\*\*([^*\n]+?)\*\*\*/g, (_m, t: string) => toBoldItalic(t));
  s = s.replace(/___([^_\n]+?)___/g, (_m, t: string) => toBoldItalic(t));
  s = s.replace(/\*\*([^\n]+?)\*\*/g, (_m, t: string) => toBold(t));
  s = s.replace(/(^|[^\p{L}\p{N}_])__([^\n]+?)__(?![\p{L}\p{N}_])/gu, (_m, pre: string, t: string) => pre + toBold(t));
  s = s.replace(/\*([^*\s](?:[^*\n]*?[^*\s])?)\*/g, (_m, t: string) => toItalic(t));
  s = s.replace(
    /(^|[^\p{L}\p{N}_])_([^_\s](?:[^_\n]*?[^_\s])?)_(?![\p{L}\p{N}_])/gu,
    (_m, pre: string, t: string) => pre + toItalic(t),
  );
  s = s.replace(/~~([^\n]+?)~~/g, (_m, t: string) => toStrike(t));
  return s;
}

/**
 * Markdown to LinkedIn text.
 *
 *  - `**b**` / `__b__` bold, `*i*` / `_i_` italic, `***bi***` bold italic (sans-serif look-alikes)
 *  - `~~s~~` each character struck with U+0336
 *  - `- item` / `* item` to `● item`; `1. item` keeps its number
 *  - `> quote` to `▌ quote`
 *  - inline and fenced code to monospace look-alikes (the fence lines are dropped)
 *  - `[text](url)` to `text (url)`
 *  - `# Header` (any level) to a bold line
 *
 * Only ASCII letters and digits are restyled; everything else, including
 * non-ASCII letters and Private Use Area placeholders, passes through.
 */
export function toLinkedInText(markdown: string): string {
  const protectedSpans: string[] = [];
  const protect = (span: string): string => {
    protectedSpans.push(span);
    return String.fromCharCode(PROTECT_BASE + protectedSpans.length - 1);
  };

  const out: string[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push(toMonospace(line));
      continue;
    }
    const header = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (header) {
      out.push(toBold(convertInline(header[1], protect)));
      continue;
    }
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      out.push(`${QUOTE_BAR} ${convertInline(quote[1], protect)}`);
      continue;
    }
    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      out.push(`${bullet[1]}${BULLET} ${convertInline(bullet[2], protect)}`);
      continue;
    }
    const numbered = /^(\s*\d+[.)]\s+)(.*)$/.exec(line);
    if (numbered) {
      out.push(numbered[1] + convertInline(numbered[2], protect));
      continue;
    }
    out.push(convertInline(line, protect));
  }
  return out
    .join("\n")
    .replace(/[\uE100-\uF8FF]/g, (ch) => protectedSpans[ch.charCodeAt(0) - PROTECT_BASE] ?? "");
}

// --- Mentions -------------------------------------------------------------

export type MentionKind = "PERSON" | "ORGANIZATION";

/** A mention picked from the typeahead: shown as `@label` in the editor, sent as a token. */
export interface TrackedMention {
  label: string;
  ref: string;
  kind: MentionKind;
}

/** Matches a wire token, `@[label](amplify:ref)`. */
export const MENTION_TOKEN = /@\[([^[\]\n]*)\]\(amplify:([^)\s]*)\)/g;

/** A label safe inside the token: no brackets, no line breaks. */
export function sanitizeMentionLabel(label: string): string {
  return label.replace(/[[\]\r\n]/g, "").trim();
}

export function mentionToken(m: TrackedMention): string {
  return `@[${sanitizeMentionLabel(m.label)}](amplify:${m.ref})`;
}

const NAME_CHAR = /[\p{L}\p{N}]/u;

/**
 * Where each tracked mention still sits in the text: the start index of its `@label`, or -1 once the text was
 * edited away. Each tracked entry claims one occurrence, in order, so the same person picked twice maps to two
 * occurrences. Longer labels claim first, so "@Jane Smith" is not taken for "@Jane".
 */
export function locateMentions(text: string, mentions: TrackedMention[]): number[] {
  const at = mentions.map(() => -1);
  const claimed: Array<[number, number]> = [];
  const order = mentions.map((_, i) => i).sort((a, b) => mentions[b].label.length - mentions[a].label.length);
  for (const i of order) {
    const needle = `@${mentions[i].label}`;
    let from = 0;
    for (;;) {
      const idx = text.indexOf(needle, from);
      if (idx < 0) break;
      const end = idx + needle.length;
      const overlaps = claimed.some(([s, e]) => idx < e && end > s);
      const after = text.charAt(end);
      if (!overlaps && !(after && NAME_CHAR.test(after))) {
        at[i] = idx;
        claimed.push([idx, end]);
        break;
      }
      from = idx + 1;
    }
  }
  return at;
}

/** The tracked mentions whose `@label` is still in the text. */
export function activeMentions(text: string, mentions: TrackedMention[]): TrackedMention[] {
  const at = locateMentions(text, mentions);
  return mentions.filter((_, i) => at[i] >= 0);
}

/**
 * What POST /shares gets as `commentary`. Each tracked `@label` still in the text becomes a Private Use Area
 * placeholder, the markdown is converted, then each placeholder becomes its wire token. A mention whose text was
 * edited away stays plain text. Private Use Area characters the employee typed are dropped first, so they cannot
 * pose as placeholders.
 */
export function buildCommentary(markdown: string, mentions: TrackedMention[]): string {
  const clean = markdown.replace(PUA, "");
  const at = locateMentions(clean, mentions);
  const spots = mentions
    .map((m, i) => ({ m, start: at[i] }))
    .filter((x) => x.start >= 0)
    .sort((a, b) => a.start - b.start);
  let withPlaceholders = "";
  let cursor = 0;
  spots.forEach((x, n) => {
    withPlaceholders += clean.slice(cursor, x.start) + String.fromCharCode(MENTION_BASE + n);
    cursor = x.start + x.m.label.length + 1;
  });
  withPlaceholders += clean.slice(cursor);
  const converted = toLinkedInText(withPlaceholders);
  return converted
    .replace(/[\uE000-\uE0FF]/g, (ch) => {
      const spot = spots[ch.charCodeAt(0) - MENTION_BASE];
      return spot ? mentionToken(spot.m) : "";
    })
    .trim();
}

/**
 * Commentary length, the way the API counts it: UTF-16 code units (JavaScript `length`), with each mention token
 * counted as its label alone. LinkedIn does not document how it counts, so this is the rule both sides agreed on.
 */
export function linkedInLength(text: string): number {
  return text.replace(MENTION_TOKEN, (_m, label: string) => label).length;
}

// --- Hashtags ---------------------------------------------------------------

// The backend's rule (amplify-common `little_text.bal`, `escapeWithHashtags`), kept the same here so the preview
// marks exactly what LinkedIn will get as a hashtag: a `#` at the start of a word, followed by letters or digits.
// The tag is those letters and digits only; `C#`, `#` alone, `#_x` and a `#` straight after a mention are text.
const TAG_CHAR = /[\p{L}\p{N}]/u;
const WORD_CHAR = /[\p{L}\p{N}_\\&]/u;

/** A piece of wire commentary as the preview shows it. */
export type CommentaryPart =
  | { kind: "text"; text: string }
  | { kind: "hashtag"; text: string }
  | { kind: "mention"; text: string };

function splitHashtags(text: string, precededBy: string | null, parts: CommentaryPart[]): void {
  const chars = Array.from(text);
  let plain = "";
  let i = 0;
  while (i < chars.length) {
    const previous = i === 0 ? precededBy : chars[i - 1];
    if (chars[i] === "#" && (previous === null || !WORD_CHAR.test(previous))) {
      let j = i + 1;
      while (j < chars.length && TAG_CHAR.test(chars[j])) j += 1;
      if (j > i + 1) {
        if (plain) parts.push({ kind: "text", text: plain });
        parts.push({ kind: "hashtag", text: chars.slice(i, j).join("") });
        plain = "";
        i = j;
        continue;
      }
    }
    plain += chars[i];
    i += 1;
  }
  if (plain) parts.push({ kind: "text", text: plain });
}

/**
 * Splits wire commentary into text, hashtags and mentions (shown as their label), with the same hashtag rule
 * the backend uses when it writes the post.
 */
export function splitCommentary(wire: string): CommentaryPart[] {
  const parts: CommentaryPart[] = [];
  let cursor = 0;
  let shownBefore: string | null = null;
  for (const m of wire.matchAll(new RegExp(MENTION_TOKEN.source, "g"))) {
    const idx = m.index ?? 0;
    splitHashtags(wire.slice(cursor, idx), shownBefore, parts);
    const label = m[1] ?? "";
    parts.push({ kind: "mention", text: label });
    const shown = Array.from(label);
    shownBefore = shown.length > 0 ? shown[shown.length - 1] : "@";
    cursor = idx + m[0].length;
  }
  splitHashtags(wire.slice(cursor), shownBefore, parts);
  return parts;
}
