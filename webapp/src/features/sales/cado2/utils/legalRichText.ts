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

import DOMPurify from "dompurify";

// Legal texts are rich text (2026-10-24): bold, italic, underline, links
// and paragraph alignment, as a small HTML subset, the same allow-list the
// backend's legal package enforces (and enforces again before printing). A
// text saved before then is plain, with line breaks; it reads as paragraphs.

// Its own DOMPurify instance, so the alignment hook below never touches
// another feature's sanitizing.
const purify = typeof window === "undefined" ? null : DOMPurify(window);

const ALIGNMENTS = ["left", "center", "right", "justify"];

purify?.addHook("uponSanitizeAttribute", (node, data) => {
  if (data.attrName !== "style") return;
  // A paragraph's text-align only; every other style is dropped.
  const m = /text-align:\s*([a-z]+)/i.exec(data.attrValue);
  const align = m?.[1].toLowerCase();
  if (node.nodeName === "P" && align && ALIGNMENTS.includes(align)) data.attrValue = `text-align: ${align}`;
  else data.keepAttr = false;
});
purify?.addHook("afterSanitizeAttributes", (node) => {
  // Links open in a new tab, as on the order form.
  if (node.nodeName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener");
  }
});

const CONFIG = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "a"],
  ALLOWED_ATTR: ["href", "target", "rel", "style"],
  ALLOWED_URI_REGEXP: /^(?:https|mailto):/i,
};

/** Whether a text is rich text (has the editor's markup), not a plain text from before. */
export const isLegalHtml = (s: string) => /<\s*\/?\s*(p|br|strong|b|em|i|u|a)\b/i.test(s);

// A preview may also mark the deal's values (<mark>); never saved or printed.
const PREVIEW_CONFIG = { ...CONFIG, ALLOWED_TAGS: [...CONFIG.ALLOWED_TAGS, "mark"] };

/** Rich text cleaned down to the legal allow-list; `marks` keeps a preview's <mark>s. */
export function sanitizeLegalHtml(html: string, marks = false): string {
  return purify ? String(purify.sanitize(html, marks ? PREVIEW_CONFIG : CONFIG)) : "";
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Any legal text as clean rich text: rich text is cleaned; a plain text becomes paragraphs. */
export function toLegalHtml(text: string, marks = false): string {
  const s = text.trim();
  if (!s) return "";
  if (isLegalHtml(s)) return sanitizeLegalHtml(s, marks);
  return s
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** A legal text's words, without markup. */
export function legalPlainText(text: string): string {
  if (!isLegalHtml(text)) return text.trim();
  const spaced = text.replace(/<\/p>|<br\s*\/?>/gi, " ");
  return (new DOMParser().parseFromString(spaced, "text/html").body.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

/** The editor's empty value is "<p><br></p>", not "": check the words. */
export const isEmptyLegalText = (text: string) => legalPlainText(text) === "";

/** Whether two legal texts say the same, plain or rich: compared as clean rich text. */
export const sameLegalText = (a: string, b: string) => cleanLegalText(toLegalHtml(a)) === cleanLegalText(toLegalHtml(b));

/** What a legal text is saved as: clean rich text, or "" with no words. Quill's &nbsp; become spaces. */
export function cleanLegalText(text: string): string {
  if (isEmptyLegalText(text)) return "";
  return isLegalHtml(text) ? sanitizeLegalHtml(text).replace(/&nbsp;|\u00a0/g, " ") : text.trim();
}
