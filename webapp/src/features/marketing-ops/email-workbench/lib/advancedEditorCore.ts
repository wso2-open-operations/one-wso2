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

// Pure, layout-independent core of the Advanced editor: the HTML/string transformations and the
// approved-style catalog. Everything here is free of React, MUI, refs and getComputedStyle, so it
// can be unit-tested in jsdom (see __tests__/advancedEditorCore.test.ts). Anything that needs the
// live iframe's computed layout (e.g. harvesting a template's own button by measuring font sizes)
// stays in AdvancedEditor.tsx, which imports the helpers below.

// The UTM builder is shared with the Utilities UTM Link Generator (ported in
// Phase 1) — the same schema and the same builder, so a link tagged from inside
// the email editor is identical to one built by the standalone tool. This reuse
// is exactly why Marketing Ops moved the builder into shared/ in the first place.
import { buildUtmUrl } from "../../utilities/utm"

export const hasMergeField = (s: string) => /\{\{/.test(s)
export const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---- Editor style constants + pure helpers ----------------------------------------------------
// The reusable BLOCKS (Paragraph, Button, Add to calendar, …) are DB-backed and admin-editable —
// fetched at runtime (see catalogLoader.ts), NOT hardcoded here. This module keeps only the editor's
// style constants and layout-independent helpers.

// Canonical in-text link style (one place): inline light-mode colour + the `linkdark2` class, which the
// chassis <head> flips to its dark-mode colour. Both are applied so editor-created links adapt in dark
// mode exactly like the design system's own body links.
export const LINK_STYLE = 'color:#1968b5;text-decoration:none;font-weight:bold;'
export const LINK_CLASS = 'linkdark2'

// Approved button colour variants — the SINGLE source of truth for both the catalog button blocks and
// the config picker. A variant is the full canonical bundle (cell bgcolor + the <a>'s fill/text colour +
// the chassis class that owns hover/dark-mode). Switching a button's "colour" swaps this whole bundle —
// no arbitrary style input. Extensible: add variants here as the design system defines them.
export interface BtnVariant { key: string; n: string; cls: string; tdBg: string; aBg: string; aColor: string }
export const BTN_VARIANTS: BtnVariant[] = [
  { key: 'orange', n: 'Orange', cls: 'ctaorange1', tdBg: '#ff7300', aBg: '#ff6700', aColor: '#000000' },
  { key: 'navy', n: 'Navy', cls: 'ctaorange2', tdBg: '#17223a', aBg: '#17223a', aColor: '#ffffff' },
]
export type BlockCategory = 'simple' | 'complex'
// A catalog block (DB-backed; fetched at runtime — see catalogLoader.ts). `hidden` = defined but not
// offered in the palette, and therefore not offered to the AI structure-fill either (being visible in
// the palette is the sole AI-eligibility — there is no separate flag).
export interface BlockDef { type: string; label: string; icon: string; category: BlockCategory; html: string; hidden?: boolean }


// Category order + labels — the SAME grouping shown in the side panel and the in-place insert menu.
export const CATEGORY_ORDER: { key: BlockCategory; label: string }[] = [
  { key: 'simple', label: 'Simple' },
  { key: 'complex', label: 'Complex' },
]
// Blocks offered for insertion (palette + in-place menu): everything not hidden.
export const visibleBlocks = (catalog: BlockDef[]): BlockDef[] => catalog.filter(b => !b.hidden)
// Kinds the AI structure-fill may emit = the visible (non-hidden) blocks. Being offered in the palette
// is the sole eligibility — there is no separate flag.
export const aiKinds = (catalog: BlockDef[]): string[] => visibleBlocks(catalog).map(b => b.type)

// Approved, enumerated style options (the start of the configurable style catalog — token
// values are sensible defaults for now; the brand doc will replace them once confirmed).
export const BULLET_COLORS = [{ n: 'Orange', v: '#ff7300' }, { n: 'Black', v: '#000000' }]
// Approved text sizes for a text block. Body is the paragraph default; the rest are heading sizes.
// (Sensible defaults for now; the brand doc will set the scale once confirmed.)
export const TEXT_SIZES = [
  { key: 'body', n: 'Body', size: 16, lh: 28 },
  { key: 'h3', n: 'Heading S', size: 20, lh: 28 },
  { key: 'h2', n: 'Heading M', size: 24, lh: 32 },
  { key: 'h1', n: 'Heading L', size: 32, lh: 40 },
]
// Spacer heights (the gap block's line-height, in px). Medium (24px) is the inserted default.
export const SPACER_SIZES = [{ key: 'xs', n: 'XS', v: 8 }, { key: 's', n: 'S', v: 16 }, { key: 'm', n: 'M', v: 24 }, { key: 'l', n: 'L', v: 40 }, { key: 'xl', n: 'XL', v: 64 }]

// Normalize a CSS colour (rgb/rgba) to lowercase hex so it matches the token swatches.
export function toHex(c: string): string {
  const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (!m) return c.trim().toLowerCase()
  return '#' + [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, '0')).join('')
}

// The structural (editable) body region is the canonical chassis's single `.bodyContent` cell —
// looked up deterministically, never guessed. Every conformant (revamped) template has exactly one;
// header/footer live outside it and are content-only. Falls back to <body> only for a non-conformant
// template (which onboarding validation should have rejected) so the editor degrades instead of crashing.
export const HOST_SELECTOR = '.bodyContent'
export function findHost(doc: Document): Element {
  return doc.querySelector(HOST_SELECTOR) ?? doc.body
}
export function doctypeStr(doc: Document): string {
  const d = doc.doctype
  if (!d) return '<!DOCTYPE html>'
  let s = '<!DOCTYPE ' + d.name
  if (d.publicId) s += ` PUBLIC "${d.publicId}"`
  if (d.systemId) s += (d.publicId ? '' : ' SYSTEM') + ` "${d.systemId}"`
  return s + '>'
}

// A spacer is an empty vertical-gap <p> (font-size:0, no border, no real text). A divider also
// uses font-size:0 but carries a border-top — exclude it so it isn't mistaken for a spacer.
export function isSpacerEl(el: Element | null): boolean {
  if (!el || el.tagName !== 'P') return false
  const st = el.getAttribute('style') || ''
  if (/border-top/i.test(st) || !/font-size\s*:\s*0(?:px)?\b/i.test(st)) return false
  // trim() also strips the no-break space the spacer carries, so an empty gap reads as ''.
  return (el.textContent || '').trim() === ''
}

export interface UtmFields { source: string; medium: string; region: string; bu: string; campaign: string; startDate: string }

// Rewrite one link's URL with the chosen UTM parameters: strip any existing utm_* (keeping other
// query params + the fragment), then rebuild via the shared UTM builder. Returns '' if the builder
// produces nothing (e.g. an empty base), in which case the caller leaves the link untouched.
export function rebuildLinkUtm(href: string, f: UtmFields): string {
  const hashIdx = href.indexOf('#'), frag = hashIdx >= 0 ? href.slice(hashIdx) : ''
  const [path, query = ''] = (hashIdx >= 0 ? href.slice(0, hashIdx) : href).split('?')
  const kept = query.split('&').filter(p => p && !/^utm_/i.test(p))
  const base = (kept.length ? `${path}?${kept.join('&')}` : path) + frag
  const { url } = buildUtmUrl({ pageUrl: base, source: f.source, medium: f.medium, region: f.region, bu: f.bu, campaign: f.campaign, startDate: f.startDate })
  return url
}

// Remove the editor's tracking attributes so they never leak into exported/saved HTML.
export function stripEditorAttrs(root: Element): void {
  root.querySelectorAll('[data-ew-id], [data-ew-blk], [data-ew-host]').forEach(e => {
    e.removeAttribute('data-ew-id'); e.removeAttribute('data-ew-blk'); e.removeAttribute('data-ew-host')
  })
}

// Heal legacy bold markup on load: a <span> whose ENTIRE inline style is just a bold font-weight
// (produced by the old styleWithCSS-based Bold command, or by a source template authored elsewhere)
// is indistinguishable from any other span to a template's own CSS — so a chassis rule as generic as
// "p span { color: ... }" (meant for one specific highlighted span) also recolors it. A bare <strong>
// can't match a span selector. Only touches spans whose style is font-weight and nothing else, so any
// genuinely styled span (color, size, …) is left byte-faithful.
const BOLD_WEIGHT_RE = /^font-weight\s*:\s*(bold|[6-9]00)\s*$/i
export function normalizeBoldSpans(root: Element): void {
  root.querySelectorAll('span[style]').forEach(span => {
    const decls = (span.getAttribute('style') || '').split(';').map(s => s.trim()).filter(Boolean)
    if (decls.length !== 1 || !BOLD_WEIGHT_RE.test(decls[0])) return
    const strong = span.ownerDocument.createElement('strong')
    // Carry over everything except style (already fully consumed above) — class, id, lang, data-*,
    // etc. — so a span that also served as a styling/metadata hook doesn't silently lose it.
    Array.from(span.attributes).forEach(({ name, value }) => {
      if (name !== 'style') strong.setAttribute(name, value)
    })
    while (span.firstChild) strong.appendChild(span.firstChild)
    span.replaceWith(strong)
  })
}

// Pretty-print an inserted block as indented XHTML so it matches the hand-formatted templates (each
// structural tag on its own line), instead of a minified one-liner. Render-NEUTRAL: whitespace is only
// added between the children of structural containers (table/tr/td/ul/…), where it's ignored by
// rendering — never inside inline/text elements (<p>, <a>, <span>, …), so no visible spacing changes.
// &nbsp; and other content text nodes are preserved; only formatting whitespace is re-laid.
const PRETTY_BLOCK = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'UL', 'OL'])
const PRETTY_CELL = new Set(['TD', 'TH', 'LI'])
// Excludes &nbsp; (U+00A0) on purpose — a non-breaking space in an email
// template is CONTENT the designer put there, not formatting whitespace to be
// collapsed. (The original embedded a literal U+00A0 in this comment to show
// what it looks like; spelled out here instead, because a stray invisible
// character in source is its own hazard — and eslint's no-irregular-whitespace
// rightly flags it.)
const isFormattingWs = (t: string) => t.length > 0 && /^[ \t\r\n]+$/.test(t)
function hasDirectText(el: Element): boolean {
  return Array.from(el.childNodes).some(n => n.nodeType === 3 && (n.textContent || '').trim() !== '')
}
export function prettyPrintBlock(el: Element, baseIndent = '', unit = '\t'): void {
  const doc = el.ownerDocument
  const fmt = (node: Element, indent: string) => {
    // Indent children only for structural containers (and cells/list-items that hold no direct text).
    const indentKids = PRETTY_BLOCK.has(node.tagName) || (PRETTY_CELL.has(node.tagName) && !hasDirectText(node))
    if (!indentKids) return
    const kids = Array.from(node.children)
    if (!kids.length) return
    Array.from(node.childNodes).forEach(n => { if (n.nodeType === 3 && isFormattingWs(n.textContent || '')) (n as ChildNode).remove() })
    const childIndent = indent + unit
    for (const child of kids) {
      node.insertBefore(doc.createTextNode('\n' + childIndent), child)
      fmt(child, childIndent)
    }
    node.appendChild(doc.createTextNode('\n' + indent))
  }
  fmt(el, baseIndent)
}

// Pull the INNER rules out of every `@media (prefers-color-scheme: dark){…}` block in the given CSS,
// with balanced-brace matching (the block contains nested rules). Re-applying these unconditionally in
// the preview shows the email's real dark-mode appearance without changing the viewer's OS setting.
// Preview-only — the export keeps the media query untouched.
export function extractDarkRules(css: string): string {
  let out = ''
  const re = /@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\{/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    let i = m.index + m[0].length, depth = 1
    const start = i
    while (i < css.length && depth > 0) {
      const ch = css[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      i++
    }
    out += css.slice(start, i - 1) + '\n'   // inner rules, excluding the block's closing brace
    re.lastIndex = i
  }
  return out
}

// A preview <iframe> reports the VIEWER'S real device prefers-color-scheme, so an email's own
// `@media (prefers-color-scheme: dark)` rules fire on a dark device and the preview can't be forced
// back to light. In a preview the TOGGLE — not the device — should decide the scheme, so we disable
// the OS-driven dark blocks by rewriting their media prelude to one that never matches (`not all`),
// leaving the inner rules + braces intact. Preview-only; the exported HTML keeps the real query.
export function disableOsDarkMedia(html: string): string {
  return html.replace(/@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\{/gi, '@media not all {')
}

// Build preview-ready HTML for an explicit, OS-independent colour scheme — the one mechanism shared
// by the editor canvas and the full-screen Preview dialog. Always disables OS-driven dark (so the
// device has no say); for 'dark' it then re-applies the email's own dark rules unconditionally.
// Never used for export.
export function renderPreviewHtml(html: string, scheme: 'light' | 'dark'): string {
  const base = disableOsDarkMedia(html)
  if (scheme === 'light') return base
  const rules = extractDarkRules(html)   // from the ORIGINAL html — `base` no longer contains the query
  if (!rules) return base
  const style = `<style id="ew-dark-preview">${rules}</style>`
  return /<\/head>/i.test(base) ? base.replace(/<\/head>/i, `${style}</head>`) : style + base
}
