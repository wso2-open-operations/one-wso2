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

import { useEffect, useRef, useState } from "react";
import { Box, Button, IconButton, Snackbar, Tooltip, Typography } from "@wso2/oxygen-ui";
import {
  ArrowLeft,
  Link2,
  Moon,
  Redo2,
  Save,
  Send,
  Sun,
  Undo2,
  Wand2,
  Eye,
} from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useBlocks, useSaveDraft } from "../../api/useEmailWorkbench";
import type { TargetBlock, TemplateBlockSnap } from "../emailWorkbenchTypes";
import {
  aiKinds,
  BTN_VARIANTS,
  disableOsDarkMedia,
  doctypeStr,
  escHtml,
  extractDarkRules,
  findHost,
  hasMergeField,
  isSpacerEl,
  LINK_CLASS,
  LINK_STYLE,
  normalizeBoldSpans,
  prettyPrintBlock,
  rebuildLinkUtm,
  SPACER_SIZES,
  stripEditorAttrs,
  visibleBlocks,
  CATEGORY_ORDER,
  type BlockDef,
} from "../lib/advancedEditorCore";
import type { Sel } from "../lib/editorTypes";
import { toTextVersion } from "../lib/htmlToTextVersion";
import EditorInspector from "./EditorInspector";
import ExportDialog from "./ExportDialog";
import GlobalUtmDialog, { type GlobalUtmFields, type GlobalUtmLink } from "./GlobalUtmDialog";
import PreviewDialog from "./PreviewDialog";
import StructureFillDialog from "./StructureFillDialog";
import UtmDialog from "./UtmDialog";

// The row composer. The rendered email IS the editing surface.
//
// ── How this works, because it isn't a normal React component ────────────────
//
// There are TWO copies of the email at all times:
//
//   docRef  a detached Document parsed from the template HTML. This is the SOURCE
//           OF TRUTH — export, preview and undo all serialise from it.
//   iframe  a live rendering of that document, which the user actually clicks.
//
// Structural edits (move / duplicate / delete / insert) mutate `docRef` and then
// reload the iframe. Text edits go the other way: the live element is
// contentEditable, and `syncRich` mirrors its innerHTML back into `docRef` WITHOUT
// reloading — otherwise every keystroke would destroy the caret.
//
// Elements are addressed by `data-ew-id` (every node) and `data-ew-blk` (top-level
// rows), which exist in both copies. `stripEditorAttrs` removes them on export, so
// none of this scaffolding reaches Pardot.
//
// ── Why so many refs ─────────────────────────────────────────────────────────
//
// The in-iframe event handlers are bound ONCE per iframe load, so anything they
// read must come from a ref rather than a closed-over render value — a `useState`
// value would be permanently stale inside them. That's the reason for
// `insertRowAtRef`, `darkPreviewRef`, `editingRef` and friends; they are not
// premature optimisation.

const noop = () => {};

export default function AdvancedEditor({
  html,
  name,
  onBack,
  draftId: initialDraftId,
  pardotTemplateId: initialPardotId,
  sourceTemplateId,
}: {
  html: string;
  name?: string;
  onBack: () => void;
  draftId?: string;
  pardotTemplateId?: number | null;
  sourceTemplateId?: string;
}) {
  const docRef = useRef<Document | null>(null);
  const hostRef = useRef<Element | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const idc = useRef(0);
  const reloadNonce = useRef(0);
  const selElRef = useRef<HTMLElement | null>(null);
  const selPrev = useRef("");
  const hoverIdRef = useRef<string | null>(null);
  const keepTb = useRef(false);
  const insertGapRef = useRef<number | null>(null);
  const lockedGapRef = useRef<number | null>(null);
  // The in-iframe insert menu's click handler is bound once on first load, so it
  // would otherwise close over the first render's insertRowAt — and its then-empty,
  // async-loaded catalog. Call through this ref, refreshed each render.
  const insertRowAtRef = useRef<(type: string, at: number | null) => void>(noop);
  const pendingSelectRef = useRef<string | null>(null);
  const scrollRestore = useRef<number | null>(null);
  const scrollNewRef = useRef(false);
  const editingRef = useRef<HTMLElement | null>(null);
  // Where the current mousedown started, relative to the block being edited — set by the mousedown
  // listener, read by the click listener below (see there for why a click's own target isn't enough).
  const mouseDownInEditingRef = useRef(false);
  const savedRange = useRef<Range | null>(null);
  const undoRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const lastKey = useRef<string | null>(null);
  const darkPreviewRef = useRef(false);

  const [sel, setSel] = useState<Sel | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [utmOpen, setUtmOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportHtml, setExportHtml] = useState("");
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [fullPreviewHtml, setFullPreviewHtml] = useState("");
  const [preview, setPreview] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [globalUtmOpen, setGlobalUtmOpen] = useState(false);
  const [darkPreview, setDarkPreview] = useState(false);
  const [draftId, setDraftId] = useState<string | undefined>(initialDraftId);
  const [pardotId, setPardotId] = useState<number | null>(initialPardotId ?? null);
  const [snack, setSnack] = useState<string | null>(null);

  // The palette comes from the DB with NO hardcoded fallback — the catalog is the
  // single source of truth, so an unreachable catalog means "insertion unavailable",
  // never "insert something that might be wrong".
  const blocksQuery = useBlocks();
  const catalog: BlockDef[] = (blocksQuery.data ?? []).map((b) => ({
    type: b.type,
    label: b.label,
    icon: b.icon,
    category: b.category as BlockDef["category"],
    html: b.html,
    hidden: b.hidden,
  }));
  const catalogStatus: "loading" | "ready" | "error" = blocksQuery.isError
    ? "error"
    : blocksQuery.isLoading
      ? "loading"
      : "ready";

  const saveDraftMutation = useSaveDraft();

  const nid = (p: string) => p + idc.current++;

  // ---- preview-only dark mode ----
  // Re-applies the chassis's @media (prefers-color-scheme: dark) rules
  // unconditionally inside the iframe so a marketer can see the real dark rendering
  // without changing their OS. Injected into the LIVE preview only — never into
  // docRef — so the export is untouched.
  function applyDarkPreview(on: boolean) {
    const d = iframeRef.current?.contentDocument;
    if (!d) return;
    let st = d.getElementById("ew-dark-preview") as HTMLStyleElement | null;
    if (!on) {
      st?.remove();
      return;
    }
    if (!st) {
      st = d.createElement("style");
      st.id = "ew-dark-preview";
      (d.head || d.documentElement).appendChild(st);
    }
    const css = Array.from(docRef.current?.querySelectorAll("style") || [])
      .map((s) => s.textContent || "")
      .join("\n");
    st.textContent = extractDarkRules(css);
  }

  function toggleDarkPreview() {
    const v = !darkPreview;
    setDarkPreview(v);
    darkPreviewRef.current = v;
    applyDarkPreview(v);
  }

  function assignIds(root: Element) {
    root.setAttribute("data-ew-id", nid("e"));
    root.querySelectorAll("*").forEach((e) => e.setAttribute("data-ew-id", nid("e")));
  }
  const nodeByEid = (id: string) =>
    docRef.current?.querySelector(`[data-ew-id="${id}"]`) as HTMLElement | null;
  const liveByEid = (id: string) =>
    iframeRef.current?.contentDocument?.querySelector(`[data-ew-id="${id}"]`) as HTMLElement | null;
  const blockById = (id: string) =>
    hostRef.current?.querySelector(`:scope > [data-ew-blk="${id}"]`) as HTMLElement | null;

  function serializePreview(): string {
    const doc = docRef.current;
    return doc ? doctypeStr(doc) + "\n" + doc.documentElement.outerHTML : "";
  }
  // What actually ships: the editor's own attributes stripped out.
  function serializeClean(): string {
    const doc = docRef.current;
    if (!doc) return "";
    const clone = doc.documentElement.cloneNode(true) as Element;
    stripEditorAttrs(clone);
    return doctypeStr(doc) + "\n" + clone.outerHTML;
  }

  function refresh() {
    selElRef.current = null;
    lastKey.current = null;
    editingRef.current = null; // the iframe is about to reload — drop the stale editable
    savedRange.current = null;
    setSel(null);
    setExportHtml("");
    // The trailing comment makes srcDoc differ from the previous value every time.
    // Without it, an edit that returns the document to a prior state (unlinking text
    // back to plain, say) produces an identical string and the iframe never reloads.
    // disableOsDarkMedia: the preview must follow OUR Dark/Light toggle, not the
    // viewer's device. Applied only to the srcDoc string, not to serializePreview,
    // which also feeds undo snapshots.
    setPreview(
      disableOsDarkMedia(serializePreview()) + `\n<!--ew-reload:${++reloadNonce.current}-->`,
    );
  }

  function captureScroll() {
    const w = iframeRef.current?.contentWindow;
    const d = iframeRef.current?.contentDocument;
    scrollRestore.current = w?.scrollY ?? d?.documentElement?.scrollTop ?? 0;
  }

  // ---- parse the incoming template once ----
  useEffect(() => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const host = findHost(doc);
    normalizeBoldSpans(doc.body);
    assignIds(doc.body);
    host.setAttribute("data-ew-host", "1");
    Array.from(host.children).forEach((c) => c.setAttribute("data-ew-blk", nid("b")));
    docRef.current = doc;
    hostRef.current = host;
    undoRef.current = [];
    redoRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  // ---- the in-place insert menu ----
  function insertMenuHtml(): string {
    const body = CATEGORY_ORDER.map((cat) => {
      const items = visibleBlocks(catalog).filter((b) => b.category === cat.key);
      return items.length
        ? `<div class="ew-im-cat">${cat.label}</div>` +
            items
              .map((rt) => `<button data-a="${rt.type}">${rt.icon}&nbsp;${rt.label}</button>`)
              .join("")
        : "";
    }).join("");
    if (body) return body;
    const msg =
      catalogStatus === "error"
        ? "Block catalog unavailable — check your connection and reload."
        : catalogStatus === "loading"
          ? "Loading blocks…"
          : "No blocks in the catalog yet.";
    return `<div class="ew-im-cat">${msg}</div>`;
  }

  // The menu's DOM is built once on iframe load; refresh its contents when the
  // catalog arrives so it reflects the loaded blocks rather than the empty first render.
  useEffect(() => {
    const m = iframeRef.current?.contentDocument?.getElementById("ew-insertmenu");
    if (m) m.innerHTML = insertMenuHtml();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocksQuery.data, catalogStatus]);

  // ---- undo / redo ----
  const snapshot = () => serializePreview();
  function pushUndo() {
    undoRef.current.push(snapshot());
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }
  // Coalesce a run of edits to the same target into ONE undo step, so undo steps
  // are "a thing the user did", not "a keystroke".
  function beginEdit(key: string) {
    if (key === lastKey.current) return;
    pushUndo();
    lastKey.current = key;
  }
  function restore(snap: string) {
    const doc = new DOMParser().parseFromString(snap, "text/html");
    docRef.current = doc;
    hostRef.current = doc.querySelector("[data-ew-host]") ?? findHost(doc);
    refresh();
  }
  function undo() {
    if (!undoRef.current.length) return;
    captureScroll();
    redoRef.current.push(snapshot());
    restore(undoRef.current.pop()!);
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(true);
  }
  function redo() {
    if (!redoRef.current.length) return;
    captureScroll();
    undoRef.current.push(snapshot());
    restore(redoRef.current.pop()!);
    setCanRedo(redoRef.current.length > 0);
    setCanUndo(true);
  }

  // ---- structural ops ----
  function moveBlk(id: string, dir: -1 | 1) {
    const host = hostRef.current;
    const node = blockById(id);
    if (!host || !node) return;
    const sib = (dir < 0 ? node.previousElementSibling : node.nextElementSibling) as HTMLElement | null;
    if (!sib || !sib.hasAttribute("data-ew-blk")) return;
    captureScroll();
    pushUndo();
    if (dir < 0) host.insertBefore(node, sib);
    else host.insertBefore(sib, node);
    refresh();
  }
  function dupBlk(id: string) {
    const host = hostRef.current;
    const node = blockById(id);
    if (!host || !node) return;
    captureScroll();
    pushUndo();
    const clone = node.cloneNode(true) as Element;
    // Fresh ids: a duplicate sharing its original's ids would make both
    // indistinguishable to every selector in this file.
    assignIds(clone);
    clone.setAttribute("data-ew-blk", nid("b"));
    host.insertBefore(clone, node.nextSibling);
    refresh();
  }
  function removeBlk(id: string) {
    if (!blockById(id)) return;
    captureScroll();
    pushUndo();
    blockById(id)?.remove();
    refresh();
  }

  const parseEl = (h: string): Element | null => {
    const doc = docRef.current;
    if (!doc) return null;
    const p = new DOMParser().parseFromString(h, "text/html").body.firstElementChild;
    return p ? (doc.importNode(p, true) as Element) : null;
  };

  // Replace an element's text while preserving a wrapper that holds ALL of it
  // (<li><p>…</p></li> → set the <p>), so the template's styling on that wrapper
  // survives. Stops at mixed content, replacing the whole thing.
  function setPlainText(el: Element, text: string) {
    let t: Element = el;
    while (t.children.length === 1 && t.firstElementChild) {
      const child = t.firstElementChild;
      const wrapsAll = Array.from(t.childNodes).every(
        (n) => n === child || (n.nodeType === Node.TEXT_NODE && !(n.textContent ?? "").trim()),
      );
      if (!wrapsAll) break;
      t = child;
    }
    t.textContent = text;
  }

  // Indent of the body's existing children, so inserted blocks line up with the
  // hand-formatted template rather than landing flush-left in the exported source.
  function hostContentIndent(host: Element): string {
    for (const c of Array.from(host.children)) {
      const prev = c.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE) {
        const m = (prev.textContent || "").match(/\n([ \t]*)$/);
        if (m) return m[1];
      }
    }
    return "";
  }

  // Insert a catalog block at host-child position `at` (null = append). The block is
  // the approved snippet verbatim — no harvesting, no font sampling — so the same
  // block lands predictably regardless of template.
  function insertRowAt(type: string, at: number | null) {
    const host = hostRef.current;
    const doc = docRef.current;
    const def = catalog.find((t) => t.type === type);
    if (!host || !doc || !def) return;
    const node = parseEl(def.html);
    if (!node) return;
    const blkId = nid("b");
    assignIds(node);
    node.setAttribute("data-ew-blk", blkId);
    const base = hostContentIndent(host);
    prettyPrintBlock(node, base);
    captureScroll();
    pushUndo();
    const ref = at != null ? (host.children[at] ?? null) : null;
    host.insertBefore(node, ref);
    node.before(doc.createTextNode("\n" + base));
    node.after(doc.createTextNode("\n" + base));
    pendingSelectRef.current = blkId; // auto-select the new row after reload
    refresh();
  }
  insertRowAtRef.current = insertRowAt;

  function insertRow(type: string) {
    scrollNewRef.current = true;
    insertRowAt(type, null);
  }

  // ---- AI structure fill ----
  // A semantic snapshot of the body for the model: type + text/items/label only.
  function snapshotBlocks(): TemplateBlockSnap[] {
    const host = hostRef.current;
    if (!host) return [];
    return (Array.from(host.children) as HTMLElement[]).map((c, i) => {
      const tag = c.tagName;
      if (tag === "UL" || tag === "OL") {
        return {
          i,
          type: "list",
          items: Array.from(c.querySelectorAll(":scope > li")).map((li) =>
            (li.textContent || "").replace(/\s+/g, " ").trim(),
          ),
        };
      }
      const a = c.querySelector("a");
      // "Is this a button?" is unavoidably heuristic on arbitrary template HTML —
      // a cta/btn class, an explicit background, a border-radius, or a coloured cell.
      const aBtn =
        a &&
        (/\b(cta|btn|button)/i.test(a.getAttribute("class") || "") ||
          /background(-color)?\s*:/.test(a.getAttribute("style") || "") ||
          /border-radius/.test(a.getAttribute("style") || "") ||
          a.closest("td")?.getAttribute("bgcolor"));
      if (aBtn && !c.querySelector("p, ul, ol")) {
        return { i, type: "button", label: (a.textContent || "").trim(), href: a.getAttribute("href") || "" };
      }
      if (c.querySelector("img") && (c.textContent || "").trim().length < 2) return { i, type: "image" };
      const fs = parseFloat(
        (c.querySelector("p")?.getAttribute("style") || c.getAttribute("style") || "").match(
          /font-size\s*:\s*([0-9.]+)/i,
        )?.[1] || "0",
      );
      const txt = (c.textContent || "").replace(/\s+/g, " ").trim();
      const type = /^H[1-6]$/.test(tag) || fs >= 20 ? "heading" : "paragraph";
      return { i, type, text: txt };
    });
  }

  function hostMergeFields(): string[] {
    const host = hostRef.current;
    if (!host) return [];
    return Array.from(new Set(host.innerHTML.match(/\{\{[^}]+\}\}/g) || []));
  }

  // Fill a cloned list with items, cloning its first <li> per item so each keeps the
  // template's own bullet styling.
  function fillList(ul: Element, items: string[]) {
    const proto = ul.querySelector(":scope > li") as HTMLElement | null;
    if (!proto) return;
    Array.from(ul.querySelectorAll(":scope > li")).forEach((li, k) => {
      if (k > 0) li.remove();
    });
    const list = items.length ? items : ["List item"];
    setPlainText(proto, list[0]);
    for (let k = 1; k < list.length; k++) {
      const li = proto.cloneNode(true) as HTMLElement;
      setPlainText(li, list[k]);
      ul.appendChild(li);
    }
  }

  // Turn one AI target block into a host child using the approved catalog. The model
  // never supplies HTML, so everything here comes from a catalog entry.
  function materializeBlock(b: TargetBlock): Element | null {
    const cat = (type: string) => {
      const def = catalog.find((t) => t.type === type);
      return def ? parseEl(def.html) : null;
    };
    if (b.kind === "list") {
      const ul = cat("list");
      if (ul) fillList(ul, b.items ?? []);
      return ul;
    }
    if (b.kind === "buttons2") {
      const node = cat("buttons2");
      const links = node ? Array.from(node.querySelectorAll("a")) : [];
      // Hrefs are deliberately blanked — the AI shouldn't invent destination URLs.
      if (links[0]) {
        links[0].textContent = b.label || "Button";
        links[0].setAttribute("href", "");
      }
      if (links[1]) {
        links[1].textContent = b.label2 || "Button";
        links[1].setAttribute("href", "");
      }
      return node;
    }
    if (b.kind === "button") {
      const node = cat("button");
      const link = node?.querySelector("a");
      if (link) {
        link.textContent = b.label || "Button";
        link.setAttribute("href", b.href || "");
      }
      return node;
    }
    if (b.kind === "calendar") return cat("calendar");
    if (b.kind === "signoffImage") return cat("signoffImage");
    if (b.kind === "image") return cat("image");
    if (b.kind === "divider") return cat("divider");
    if (b.kind === "spacer") return cat("spacer");
    // Single-<p> text kinds get their own canonical block so they keep its styling
    // (the greeting's dotted rule, the sign-off's spacing) — only the words come
    // from the draft. Anything unrecognised degrades to a paragraph.
    const TEXT_KINDS = new Set(["paragraph", "heading", "greeting", "signoff"]);
    const el = cat(TEXT_KINDS.has(b.kind) ? b.kind : "paragraph");
    if (el) {
      const p = (el.matches("p") ? el : el.querySelector("p")) as HTMLElement | null;
      const target = p ?? el;
      // Draft newlines become <br> — a raw newline would collapse to a space.
      target.innerHTML = (b.text || "")
        .split("\n")
        .map(escHtml)
        .join("<br>");
    }
    return el;
  }

  function applyStructure(blocks: TargetBlock[]) {
    const host = hostRef.current;
    const doc = docRef.current;
    if (!host || !doc) return;
    // Materialise everything BEFORE clearing, so a failure part-way through can't
    // leave the body empty.
    const built = blocks.map(materializeBlock).filter(Boolean) as Element[];
    if (!built.length) return;
    const base = hostContentIndent(host);
    captureScroll();
    pushUndo();
    Array.from(host.childNodes).forEach((c) => c.remove());
    built.forEach((node) => {
      assignIds(node);
      node.setAttribute("data-ew-blk", nid("b"));
      prettyPrintBlock(node, base);
      host.appendChild(doc.createTextNode("\n" + base));
      host.appendChild(node);
    });
    host.appendChild(doc.createTextNode("\n"));
    refresh();
  }

  // ---- global UTM ----
  // Only real http(s) links inside the body qualify. Merge-field / mailto / tel /
  // anchor / relative hrefs are skipped — tagging those would break them.
  function bodyLinks(): HTMLAnchorElement[] {
    const host = hostRef.current;
    if (!host) return [];
    return (Array.from(host.querySelectorAll("a[href]")) as HTMLAnchorElement[]).filter((a) =>
      /^https?:\/\//i.test(a.getAttribute("href") || ""),
    );
  }
  function bodyLinkInfos(): GlobalUtmLink[] {
    return bodyLinks().map((a, index) => ({
      index,
      href: a.getAttribute("href") || "",
      text: (a.textContent || "").replace(/\s+/g, " ").trim(),
    }));
  }
  function applyGlobalUtm(f: GlobalUtmFields, selected: number[]) {
    const links = bodyLinks();
    if (!links.length || !selected.length) return;
    const pick = new Set(selected);
    captureScroll();
    pushUndo();
    links.forEach((a, i) => {
      if (!pick.has(i)) return;
      const url = rebuildLinkUtm(a.getAttribute("href") || "", f);
      if (url) a.setAttribute("href", url);
    });
    refresh();
  }

  // ---- selection ----
  function outlineEl(el: HTMLElement | null) {
    if (selElRef.current) selElRef.current.style.outline = selPrev.current;
    selElRef.current = el;
    if (el) {
      selPrev.current = el.style.outline;
      el.style.outline = "2px solid #F14E23";
    }
  }
  function deselect() {
    endRichEdit();
    outlineEl(null);
    setSel(null);
    setLinkOpen(false);
  }

  function select(kind: "link" | "image" | "spacer", id: string) {
    const node = nodeByEid(id);
    if (!node) return;
    if (kind === "link") {
      // A recolourable button is a TEXT-ONLY <a> carrying a canonical variant class,
      // detected by class and never guessed from colours. Complex buttons (Add to
      // calendar) carry the same class but nest an icon + span; those keep their
      // bespoke styling and are treated as plain links — href/UTM only.
      const textOnly = node.children.length === 0;
      const variant = textOnly ? BTN_VARIANTS.find((v) => node.classList.contains(v.cls)) : undefined;
      let btnId: string | undefined;
      if (variant) btnId = node.closest("td")?.getAttribute("data-ew-id") ?? id;
      setSel({
        kind,
        id,
        href: node.getAttribute("href") ?? "",
        text: node.textContent ?? "",
        textOnly,
        btnId,
        variant: variant?.key,
      });
    } else if (kind === "image") {
      const a = node.closest("a[data-ew-id]") as HTMLElement | null;
      setSel({
        kind,
        id,
        src: node.getAttribute("src") ?? "",
        alt: node.getAttribute("alt") ?? "",
        linkId: a?.getAttribute("data-ew-id") ?? undefined,
        href: a?.getAttribute("href") ?? undefined,
      });
    } else {
      // Map the spacer's current line-height to the nearest approved size.
      const lh = parseFloat(
        (node.getAttribute("style") || "").match(/line-height\s*:\s*([0-9.]+)/i)?.[1] || "24",
      );
      const size = SPACER_SIZES.reduce((a, b) =>
        Math.abs(b.v - lh) < Math.abs(a.v - lh) ? b : a,
      ).key;
      setSel({ kind, id, size });
    }
    outlineEl(liveByEid(id));
  }

  // ---- in-place rich text ----
  // The editable unit for a clicked text node: its list if inside one (so Enter adds
  // a bullet), else the nearest text block.
  function editableFor(node: Node): HTMLElement | null {
    const start = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;
    if (!start) return null;
    const list = start.closest("ul[data-ew-id], ol[data-ew-id]") as HTMLElement | null;
    if (list) return list;
    const block = start.closest("p, h1, h2, h3, h4, h5, h6, blockquote, figcaption") as HTMLElement | null;
    return (
      block ??
      (start.getAttribute("data-ew-id") ? start : (start.closest("[data-ew-id]") as HTMLElement | null))
    );
  }

  function placeCaret(d: Document, x: number, y: number) {
    let range: Range | null = null;
    if (d.caretRangeFromPoint) range = d.caretRangeFromPoint(x, y);
    else {
      // Firefox's equivalent, which isn't in the DOM lib's Document type.
      const legacy = d as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      };
      const cp = legacy.caretPositionFromPoint?.(x, y);
      if (cp) {
        range = d.createRange();
        range.setStart(cp.offsetNode, cp.offset);
        range.collapse(true);
      }
    }
    if (range) {
      const s = d.getSelection?.();
      s?.removeAllRanges();
      s?.addRange(range);
    }
  }

  // Mirror the live element's edited HTML into docRef. We do NOT reload the iframe —
  // that's what keeps the caret where the user left it.
  function syncRich(liveEl: HTMLElement) {
    const id = liveEl.getAttribute("data-ew-id");
    if (!id) return;
    const twin = nodeByEid(id);
    if (twin) twin.innerHTML = liveEl.innerHTML;
  }

  function refreshFmtState() {
    const d = iframeRef.current?.contentDocument;
    if (!d) return;
    let bold = false;
    let italic = false;
    let underline = false;
    try {
      bold = d.queryCommandState("bold");
      italic = d.queryCommandState("italic");
      underline = d.queryCommandState("underline");
    } catch {
      // queryCommandState throws in some states; a missing highlight is harmless.
    }
    let linked = false;
    let linkHref = "";
    const s = d.getSelection?.();
    const el = editingRef.current;
    if (s && s.anchorNode && el) {
      const start = (
        s.anchorNode.nodeType === Node.TEXT_NODE ? s.anchorNode.parentElement : s.anchorNode
      ) as Element | null;
      const a = start?.closest("a");
      if (a && el.contains(a)) {
        linked = true;
        linkHref = a.getAttribute("href") || "";
      }
    }
    setSel((s2) => (s2 && s2.kind === "rich" ? { ...s2, bold, italic, underline, linked, linkHref } : s2));
  }

  function endRichEdit() {
    const el = editingRef.current;
    if (el) {
      syncRich(el);
      el.removeAttribute("contenteditable");
      editingRef.current = null;
    }
    savedRange.current = null;
  }

  function editRich(liveEl: HTMLElement, x?: number, y?: number) {
    const id = liveEl.getAttribute("data-ew-id");
    if (!id) return;
    if (editingRef.current && editingRef.current !== liveEl) endRichEdit();
    liveEl.setAttribute("contenteditable", "true");
    editingRef.current = liveEl;
    outlineEl(liveEl);
    const d = liveEl.ownerDocument;
    liveEl.focus();
    if (x != null && y != null) placeCaret(d, x, y);
    const isList = /^(UL|OL)$/.test(liveEl.tagName);
    setSel({
      kind: "rich",
      id,
      isList,
      bold: false,
      italic: false,
      underline: false,
      hasMerge: hasMergeField(liveEl.textContent ?? ""),
    });
    refreshFmtState();
  }

  // Apply B/I/U via the browser's own rich-text command, then mirror the result.
  // styleWithCSS keeps italic/underline as inline styles, which is what email clients support.
  // Bold is kept OFF styleWithCSS on purpose: with it on, execCommand("bold") wraps the selection in
  // a <span style="font-weight:..."> instead of <strong> — and a template's own dark-mode CSS can carry
  // a broad "p span" rule (meant for one specific highlighted span) that then recolors every bold span
  // too. <strong> can't collide with a span selector.
  function richFmt(cmd: "bold" | "italic" | "underline") {
    const d = iframeRef.current?.contentDocument;
    const el = editingRef.current;
    if (!d || !el) return;
    el.focus();
    if (savedRange.current) {
      const s = d.getSelection?.();
      s?.removeAllRanges();
      s?.addRange(savedRange.current);
    }
    beginEdit("rich-fmt:" + cmd);
    try {
      d.execCommand("styleWithCSS", false, cmd === "bold" ? "false" : "true");
    } catch {
      // Not supported everywhere; the command below still applies formatting.
    }
    try {
      d.execCommand(cmd, false);
    } catch {
      // Nothing to do — the selection simply stays unformatted.
    }
    syncRich(el);
    refreshFmtState();
  }

  function applyLink() {
    const d = iframeRef.current?.contentDocument;
    const el = editingRef.current;
    if (!d || !el) return;
    el.focus();
    if (savedRange.current) {
      const s = d.getSelection?.();
      s?.removeAllRanges();
      s?.addRange(savedRange.current);
    }
    const sn = d.getSelection?.();
    if (!sn || !sn.rangeCount || sn.isCollapsed) {
      setLinkOpen(false);
      return; // needs selected text to wrap
    }
    const url = linkUrl.trim();
    beginEdit("rich-link");
    if (!url) {
      try {
        d.execCommand("unlink");
      } catch {
        // Leave the link in place if the command isn't available.
      }
      syncRich(el);
      setLinkOpen(false);
      refreshFmtState();
      return;
    }
    // Diff the anchors before/after to find the ones execCommand created, then apply
    // the canonical link style + class so an editor-made link adapts in dark mode
    // exactly like the design system's own body links.
    const before = new Set(Array.from(el.querySelectorAll("a")));
    try {
      d.execCommand("createLink", false, url);
    } catch {
      // Nothing created; the syncRich below is then a no-op.
    }
    Array.from(el.querySelectorAll("a"))
      .filter((a) => !before.has(a))
      .forEach((a) => {
        a.setAttribute("href", url);
        a.setAttribute("target", "_blank");
        a.setAttribute("style", LINK_STYLE);
        a.setAttribute("class", LINK_CLASS);
        a.setAttribute("data-ew-id", nid("e")); // so it's selectable afterwards
      });
    syncRich(el);
    setLinkOpen(false);
    refreshFmtState();
  }

  function removeLink() {
    const d = iframeRef.current?.contentDocument;
    const el = editingRef.current;
    if (!d || !el) return;
    el.focus();
    if (savedRange.current) {
      const s = d.getSelection?.();
      s?.removeAllRanges();
      s?.addRange(savedRange.current);
    }
    beginEdit("rich-unlink");
    try {
      d.execCommand("unlink");
    } catch {
      // Nothing to undo.
    }
    syncRich(el);
    setLinkOpen(false);
    refreshFmtState();
  }

  // ---- attribute edits (applied to BOTH copies) ----
  function editById(id: string | undefined, fn: (el: HTMLElement) => void) {
    if (!id) return;
    const p = nodeByEid(id);
    if (p) fn(p);
    const l = liveByEid(id);
    if (l) fn(l);
  }
  function edit(fn: (el: HTMLElement) => void) {
    if (!sel || !("id" in sel)) return;
    editById(sel.id, fn);
  }

  const setHref = (v: string) => {
    if (!sel || sel.kind !== "link") return;
    beginEdit(sel.id + ":href");
    edit((n) => n.setAttribute("href", v));
    setSel((s) => (s && s.kind === "link" ? { ...s, href: v } : s));
  };
  const setLinkText = (v: string) => {
    if (!sel || sel.kind !== "link") return;
    beginEdit(sel.id + ":ltext");
    edit((n) => {
      n.textContent = v;
    });
    setSel((s) => (s && s.kind === "link" ? { ...s, text: v } : s));
  };
  const setSrc = (v: string) => {
    if (!sel || sel.kind !== "image") return;
    beginEdit(sel.id + ":src");
    edit((n) => n.setAttribute("src", v));
    setSel((s) => (s && s.kind === "image" ? { ...s, src: v } : s));
  };
  const setAlt = (v: string) => {
    if (!sel || sel.kind !== "image") return;
    beginEdit(sel.id + ":alt");
    edit((n) => n.setAttribute("alt", v));
    setSel((s) => (s && s.kind === "image" ? { ...s, alt: v } : s));
  };
  const setImgHref = (v: string) => {
    if (!sel || sel.kind !== "image" || !sel.linkId) return;
    beginEdit(sel.linkId + ":ihref");
    editById(sel.linkId, (el) => el.setAttribute("href", v));
    setSel((s) => (s && s.kind === "image" ? { ...s, href: v } : s));
  };
  function setSpacerSize(key: string) {
    if (!sel || sel.kind !== "spacer") return;
    const s = SPACER_SIZES.find((x) => x.key === key);
    if (!s) return;
    beginEdit(sel.id + ":spacer");
    editById(sel.id, (el) => {
      el.style.lineHeight = s.v + "px";
    });
    setSel((p) => (p && p.kind === "spacer" ? { ...p, size: key } : p));
  }
  function removeSelectedEl(id: string) {
    if (!nodeByEid(id)) return;
    captureScroll();
    pushUndo();
    nodeByEid(id)?.remove();
    refresh();
  }
  // Unwrap the selected <a>, keeping its content: the link goes, the words stay.
  function unlinkSelected(id: string) {
    const node = nodeByEid(id);
    const parent = node?.parentNode;
    if (!node || !parent) return;
    captureScroll();
    pushUndo();
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
    refresh();
  }

  // ---- button variants ----
  function setBtnClass(el: HTMLElement, cls: string) {
    const keep = (el.getAttribute("class") || "").split(/\s+/).filter((c) => c && !/^cta/i.test(c));
    keep.push(cls);
    el.setAttribute("class", keep.join(" "));
  }
  // Apply the WHOLE canonical bundle: the <a>'s class + fill/text colour, and the
  // cell's bgcolor. Hover and dark mode come from the chassis class — this injects
  // no CSS of its own.
  const setBtnVariant = (key: string) => {
    if (!sel || sel.kind !== "link" || !sel.btnId) return;
    const v = BTN_VARIANTS.find((x) => x.key === key);
    if (!v) return;
    beginEdit(sel.id + ":variant");
    edit((el) => {
      el.style.backgroundColor = v.aBg;
      el.style.color = v.aColor;
      setBtnClass(el, v.cls);
    });
    editById(sel.btnId, (el) => el.setAttribute("bgcolor", v.tdBg));
    setSel((s) => (s && s.kind === "link" ? { ...s, variant: key } : s));
  };

  // ---- inline toolbar + insert line, injected into the iframe ----
  function positionToolbar(d: Document, blk: HTMLElement) {
    d.querySelectorAll("[data-ew-blk].ew-hover").forEach((e) => e.classList.remove("ew-hover"));
    blk.classList.add("ew-hover");
    hoverIdRef.current = blk.getAttribute("data-ew-blk");
    const tb = d.getElementById("ew-toolbar") as HTMLElement | null;
    if (!tb) return;
    tb.style.display = "flex";
    const r = blk.getBoundingClientRect();
    const sx = d.documentElement.scrollLeft || d.body.scrollLeft || 0;
    const sy = d.documentElement.scrollTop || d.body.scrollTop || 0;
    const w = tb.offsetWidth || 140;
    const h = tb.offsetHeight || 28;
    // Anchored to the block's vertical CENTRE, not its top edge — so moving the
    // cursor across to the toolbar never crosses the gap zones that would swap it
    // for the insert line.
    tb.style.top = Math.max(2, r.top + sy + r.height / 2 - h / 2) + "px";
    tb.style.left = Math.max(2, r.right + sx - w - 2) + "px";
  }

  function onRowAction(a: string, id: string) {
    if (a === "up") moveBlk(id, -1);
    else if (a === "down") moveBlk(id, 1);
    else if (a === "dup") dupBlk(id);
    else if (a === "del") removeBlk(id);
  }

  // Insertable gaps, from the LIVE rendered blocks: gap N sits before host-child N.
  //
  // Normally a gap's Y is the midpoint between the two blocks it separates. But a
  // block can be FLOATED (a button wrapped in <table align="left">), which takes it
  // out of normal flow — the next block's box then starts at the same Y, so the
  // midpoint would land inside the float. When that overlap is detected, anchor to
  // the bottom of the upper block instead.
  function liveGaps(ihost: HTMLElement): { gap: number; y: number }[] {
    const rects = (Array.from(ihost.children) as HTMLElement[])
      .filter((c) => c.hasAttribute("data-ew-blk"))
      .map((c) => c.getBoundingClientRect());
    if (!rects.length) return [];
    const out = [{ gap: 0, y: rects[0].top }];
    for (let i = 0; i < rects.length - 1; i++) {
      const a = rects[i].bottom;
      const b = rects[i + 1].top;
      out.push({ gap: i + 1, y: b > a ? (a + b) / 2 : a });
    }
    out.push({ gap: rects.length, y: rects[rects.length - 1].bottom });
    return out;
  }

  function showInsertLine(d: Document, ihost: HTMLElement, gap: number, y: number) {
    const bar = d.getElementById("ew-insertbar") as HTMLElement | null;
    if (!bar) return;
    insertGapRef.current = gap;
    const hr = ihost.getBoundingClientRect();
    const sx = d.documentElement.scrollLeft || d.body.scrollLeft || 0;
    const sy = d.documentElement.scrollTop || d.body.scrollTop || 0;
    bar.style.display = "flex";
    bar.style.top = y + sy - 10 + "px";
    bar.style.left = hr.left + sx + "px";
    bar.style.width = hr.width + "px";
  }

  function onIframeLoad() {
    const d = iframeRef.current?.contentDocument;
    if (!d || !d.body) return;

    if (!d.getElementById("ew-ui-style")) {
      const st = d.createElement("style");
      st.id = "ew-ui-style";
      // The canvas must render byte-identically to the export, so this injects NO
      // layout-affecting rules — only editing affordances (cursor, hover outline,
      // the toolbar/insert overlays, all absolutely positioned).
      st.textContent =
        '[contenteditable="true"]{cursor:text;}[contenteditable="true"]:focus{outline:none;}' +
        "[data-ew-blk].ew-hover{outline:2px solid rgba(241,78,35,.55);outline-offset:-2px;}" +
        "#ew-toolbar{position:absolute;display:none;gap:2px;background:#fff;border:1px solid #e6e8ec;border-radius:8px;padding:2px;box-shadow:0 6px 20px rgba(20,33,58,.18);z-index:99999;font-family:-apple-system,Segoe UI,sans-serif;}" +
        "#ew-toolbar button{border:0;background:transparent;cursor:pointer;font-size:13px;padding:4px 6px;border-radius:5px;color:#5b6678;line-height:1;}" +
        "#ew-toolbar button:hover{background:rgba(241,78,35,.12);color:#F14E23;}" +
        "#ew-insertbar{position:absolute;display:none;align-items:center;gap:8px;cursor:pointer;z-index:99998;}" +
        "#ew-insertbar .ln{flex:1;height:2px;background:#F14E23;border-radius:2px;}" +
        "#ew-insertbar .lbl{font:700 11px -apple-system,Segoe UI,sans-serif;color:#F14E23;background:#fff;border:1px solid #F14E23;border-radius:999px;padding:2px 10px;white-space:nowrap;}" +
        "#ew-insertmenu{position:absolute;display:none;flex-wrap:wrap;gap:4px;width:300px;background:#fff;border:1px solid #e6e8ec;border-radius:10px;padding:6px;box-shadow:0 8px 24px rgba(20,33,58,.2);z-index:100000;font-family:-apple-system,Segoe UI,sans-serif;}" +
        "#ew-insertmenu button{border:1px solid #e6e8ec;background:#fff;cursor:pointer;font-size:12px;font-weight:650;color:#18233b;padding:6px 9px;border-radius:7px;}" +
        "#ew-insertmenu button:hover{border-color:#F14E23;color:#F14E23;background:rgba(241,78,35,.06);}" +
        "#ew-insertmenu .ew-im-cat{flex-basis:100%;width:100%;font:800 9px -apple-system,Segoe UI,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#9aa3b2;padding:5px 2px 1px;}";
      d.head.appendChild(st);
    }

    if (!d.getElementById("ew-toolbar")) {
      const tb = d.createElement("div");
      tb.id = "ew-toolbar";
      tb.innerHTML =
        '<button data-a="up" title="Move up">▲</button><button data-a="down" title="Move down">▼</button><button data-a="dup" title="Duplicate">⧉</button><button data-a="del" title="Delete">🗑</button>';
      d.body.appendChild(tb);
      tb.addEventListener("mousedown", (e) => e.preventDefault());
      tb.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        const b = (e.target as HTMLElement).closest("button") as HTMLElement | null;
        if (b && hoverIdRef.current) onRowAction(b.dataset.a!, hoverIdRef.current);
      });
      // keepTb stops the mousemove handler hiding the toolbar while the cursor is
      // travelling across it.
      tb.addEventListener("mouseenter", () => {
        keepTb.current = true;
      });
      tb.addEventListener("mouseleave", () => {
        keepTb.current = false;
      });
    }

    if (!d.getElementById("ew-insertbar")) {
      const bar = d.createElement("div");
      bar.id = "ew-insertbar";
      bar.innerHTML = '<span class="ln"></span><span class="lbl">+ insert row</span><span class="ln"></span>';
      const menu = d.createElement("div");
      menu.id = "ew-insertmenu";
      menu.innerHTML = insertMenuHtml();
      d.body.appendChild(bar);
      d.body.appendChild(menu);
      const hideMenu = () => {
        menu.style.display = "none";
      };
      bar.addEventListener("mousedown", (e) => e.preventDefault());
      bar.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        // FREEZE the target gap now: moving the cursor to a menu item must not
        // re-point where the block will land.
        lockedGapRef.current = insertGapRef.current;
        menu.style.display = "flex";
        menu.style.top = bar.offsetTop + 18 + "px";
        menu.style.left = Math.max(4, bar.offsetLeft + bar.offsetWidth / 2 - 150) + "px";
      });
      menu.addEventListener("mousedown", (e) => e.preventDefault());
      menu.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        const b = (e.target as HTMLElement).closest("button") as HTMLElement | null;
        const gap = lockedGapRef.current;
        if (b && gap != null) {
          hideMenu();
          insertRowAtRef.current(b.dataset.a!, gap);
        }
      });
      [bar, menu].forEach((el) => {
        el.addEventListener("mouseenter", () => {
          keepTb.current = true;
        });
        el.addEventListener("mouseleave", () => {
          keepTb.current = false;
        });
      });
    }

    d.addEventListener("mousemove", (e) => {
      const t = e.target as HTMLElement;
      // Over our own injected UI — leave the current state alone so it doesn't
      // flicker or vanish while the user reaches for a button.
      if (t.closest?.("#ew-toolbar") || t.closest?.("#ew-insertbar") || t.closest?.("#ew-insertmenu"))
        return;
      const tb = d.getElementById("ew-toolbar") as HTMLElement | null;
      const bar = d.getElementById("ew-insertbar") as HTMLElement | null;
      // While editing text, suppress both overlays: they'd fight caret placement and
      // drag-selection.
      if (editingRef.current) {
        if (tb) tb.style.display = "none";
        if (bar) bar.style.display = "none";
        return;
      }
      const ihost = d.querySelector("[data-ew-host]") as HTMLElement | null;
      if (!ihost) return;
      const gaps = liveGaps(ihost);
      if (!gaps.length) return;
      let near = gaps[0];
      for (const g of gaps) if (Math.abs(e.clientY - g.y) < Math.abs(e.clientY - near.y)) near = g;
      const SNAP = 14;
      if (Math.abs(e.clientY - near.y) <= SNAP) {
        if (tb) tb.style.display = "none";
        d.querySelectorAll("[data-ew-blk].ew-hover").forEach((x) => x.classList.remove("ew-hover"));
        showInsertLine(d, ihost, near.gap, near.y);
      } else {
        if (bar) bar.style.display = "none";
        const blk = t.closest?.("[data-ew-blk]") as HTMLElement | null;
        if (blk) positionToolbar(d, blk);
        else if (tb) tb.style.display = "none";
      }
    });

    d.body.addEventListener("mouseleave", () => {
      if (keepTb.current) return;
      const tb = d.getElementById("ew-toolbar") as HTMLElement | null;
      if (tb) tb.style.display = "none";
      const bar = d.getElementById("ew-insertbar") as HTMLElement | null;
      if (bar) bar.style.display = "none";
    });

    // Track where the drag started: a click's own target only tells us where the mouse came UP, and a
    // text-selection drag that starts inside the block being edited can easily end (mouseup) over a
    // neighboring block or gap once the cursor drifts past its edge. Without this, that stray mouseup
    // looks just like a genuine "click elsewhere" below and tears down the selection mid-drag.
    d.addEventListener(
      "mousedown",
      (e) => {
        mouseDownInEditingRef.current = !!(
          editingRef.current && editingRef.current.contains(e.target as Node)
        );
      },
      true,
    );

    // Capture-phase click: decide what was selected before the email's own markup
    // (links especially) can act on it.
    d.addEventListener(
      "click",
      (e) => {
        const t = e.target as HTMLElement;
        if (t.closest("#ew-toolbar") || t.closest("#ew-insertbar") || t.closest("#ew-insertmenu")) return;
        // Already editing this block — let the browser handle caret and drag-select. A drag that
        // started inside it counts too, even if the mouseup (and so this click's target) ended up
        // outside — see the mousedown listener above.
        if (editingRef.current && (editingRef.current.contains(t) || mouseDownInEditingRef.current)) return;
        const menu = d.getElementById("ew-insertmenu") as HTMLElement | null;
        if (menu) menu.style.display = "none";
        e.preventDefault();
        const img = (t.tagName === "IMG" ? t : t.closest("img[data-ew-id]")) as HTMLElement | null;
        if (img?.dataset.ewId) {
          endRichEdit();
          select("image", img.dataset.ewId);
          return;
        }
        const a = t.closest("a[data-ew-id]") as HTMLElement | null;
        if (a) {
          endRichEdit();
          select("link", a.dataset.ewId!);
          return;
        }
        // A spacer has no editable text — select it for height, not rich editing.
        const sp = t.closest("p[data-ew-id]") as HTMLElement | null;
        if (sp && isSpacerEl(sp)) {
          endRichEdit();
          select("spacer", sp.dataset.ewId!);
          return;
        }
        const list = t.closest("ul[data-ew-id], ol[data-ew-id]") as HTMLElement | null;
        if (list) {
          editRich(list, e.clientX, e.clientY);
          return;
        }
        const tn = textNodeAt(d, e.clientX, e.clientY, t);
        const host = tn ? editableFor(tn) : null;
        if (host) {
          editRich(host, e.clientX, e.clientY);
          return;
        }
        deselect();
      },
      true,
    );

    d.addEventListener("input", () => {
      const el = editingRef.current;
      if (!el) return;
      beginEdit("rich:" + el.getAttribute("data-ew-id"));
      syncRich(el);
    });

    d.addEventListener("selectionchange", () => {
      const el = editingRef.current;
      if (!el) return;
      const s = d.getSelection?.();
      if (s && s.rangeCount && el.contains(s.anchorNode)) {
        savedRange.current = s.getRangeAt(0).cloneRange();
      }
      refreshFmtState();
    });

    d.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        deselect();
        return;
      }
      // Enter inside a text block inserts a <br>, not a <div>/<p>. A block element
      // inside a <p> is invalid and, when re-parsed, escapes the paragraph and
      // inherits the cell's centre alignment — the text visibly jumps.
      const el = editingRef.current;
      if (e.key === "Enter" && el && !/^(UL|OL)$/.test(el.tagName)) {
        e.preventDefault();
        try {
          d.execCommand("insertLineBreak");
        } catch {
          try {
            d.execCommand("insertHTML", false, "<br>");
          } catch {
            // Neither available — leave the keypress unhandled.
          }
        }
        syncRich(el);
      }
    });

    // A palette append scrolls the new row into view (it's off-screen at the
    // bottom); everything else restores the prior scroll so a reload doesn't jump.
    const goNew = scrollNewRef.current;
    scrollNewRef.current = false;
    if (scrollRestore.current != null) {
      const y = scrollRestore.current;
      scrollRestore.current = null;
      if (!goNew) {
        requestAnimationFrame(() => {
          iframeRef.current?.contentWindow?.scrollTo(0, y);
          if (d.documentElement) d.documentElement.scrollTop = y;
          if (d.body) d.body.scrollTop = y;
        });
      }
    }

    // srcDoc reset drops the injected style, so re-apply after every reload.
    if (darkPreviewRef.current) applyDarkPreview(true);

    if (pendingSelectRef.current) {
      const id = pendingSelectRef.current;
      pendingSelectRef.current = null;
      const blk = hostRef.current?.querySelector(`:scope > [data-ew-blk="${id}"]`);
      if (blk) selectFirstEditable(blk);
      if (goNew) {
        const liveBlk = d.querySelector(`[data-ew-blk="${id}"]`);
        requestAnimationFrame(() => liveBlk?.scrollIntoView({ behavior: "smooth", block: "center" }));
      }
    }
  }

  // Precise text-node hit-testing, so a click lands on the words rather than the
  // nearest block.
  function textNodeAt(d: Document, x: number, y: number, fallback: HTMLElement): Text | null {
    let node: Node | null = null;
    if (d.caretRangeFromPoint) node = d.caretRangeFromPoint(x, y)?.startContainer ?? null;
    else {
      const legacy = d as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
      };
      node = legacy.caretPositionFromPoint?.(x, y)?.offsetNode ?? null;
    }
    if (node?.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim()) return node as Text;
    if (fallback.children.length === 0) {
      const tn = Array.from(fallback.childNodes).find(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim(),
      );
      if (tn) return tn as Text;
    }
    return null;
  }

  // Select the most editable thing in a block — used to auto-focus a freshly
  // inserted row so the user can type immediately.
  function selectFirstEditable(blkEl: Element) {
    const img = blkEl.tagName === "IMG" ? blkEl : blkEl.querySelector("img[data-ew-id]");
    if (img) {
      select("image", (img as HTMLElement).getAttribute("data-ew-id")!);
      return;
    }
    const ul =
      blkEl.tagName === "UL" || blkEl.tagName === "OL"
        ? blkEl
        : blkEl.querySelector("ul[data-ew-id], ol[data-ew-id]");
    const a = blkEl.tagName === "A" ? blkEl : blkEl.querySelector("a[data-ew-id]");
    if (a && !ul) {
      select("link", (a as HTMLElement).getAttribute("data-ew-id")!);
      return;
    }
    if (isSpacerEl(blkEl as HTMLElement) && blkEl.getAttribute("data-ew-id")) {
      select("spacer", blkEl.getAttribute("data-ew-id")!);
      return;
    }
    const liveBlk = blkEl.getAttribute("data-ew-id")
      ? liveByEid(blkEl.getAttribute("data-ew-id")!)
      : null;
    const target = ul ? (liveByEid((ul as HTMLElement).getAttribute("data-ew-id") ?? "") ?? null) : liveBlk;
    if (target) editRich(target);
  }

  // ---- persistence ----
  // `silent` suppresses the toast — used when ensuring a draft row exists before
  // export, which is a side effect the user didn't explicitly ask for.
  async function saveDraft(cleanHtml: string, opts?: { silent?: boolean }): Promise<string | undefined> {
    try {
      const res = await saveDraftMutation.mutateAsync({
        id: draftId,
        body: {
          name: name?.trim() || "Untitled email",
          html: cleanHtml,
          text_version: toTextVersion(cleanHtml),
          source_template_id: sourceTemplateId,
        },
      });
      const id = draftId ?? res?.id;
      if (!draftId && res?.id) setDraftId(res.id);
      if (!opts?.silent) setSnack("Draft saved");
      return id;
    } catch (e) {
      setSnack(describeError(e));
      return undefined;
    }
  }

  async function openExport() {
    const clean = serializeClean();
    setExportHtml(clean);
    // A draft row must exist before it can be pushed, so create one silently.
    await saveDraft(clean, { silent: true });
    setExportOpen(true);
  }
  function openPreview() {
    setFullPreviewHtml(serializeClean());
    setFullPreviewOpen(true);
  }

  const saving = saveDraftMutation.isPending;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* top bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
        <Button
          onClick={onBack}
          startIcon={<ArrowLeft size={16} />}
          sx={{ textTransform: "none", color: "text.secondary" }}
        >
          Back
        </Button>
        {name && <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{name}</Typography>}
        <Box sx={{ flex: 1 }} />
        <Tooltip
          title="Lay out a pasted draft into this template — adds paragraphs, lists & buttons as needed"
          arrow
        >
          <Button
            onClick={() => {
              deselect();
              setAiOpen(true);
            }}
            startIcon={<Wand2 size={16} />}
            sx={{ textTransform: "none", fontWeight: 600, color: "text.secondary" }}
          >
            Fill with AI
          </Button>
        </Tooltip>
        <Tooltip title="Build one tracking URL and apply it to the body links you choose" arrow>
          <Button
            onClick={() => {
              deselect();
              setGlobalUtmOpen(true);
            }}
            startIcon={<Link2 size={16} />}
            sx={{ textTransform: "none", fontWeight: 600, color: "text.secondary" }}
          >
            Build tracking URLs
          </Button>
        </Tooltip>
        <Tooltip
          title={
            darkPreview
              ? "Previewing dark mode — click for light"
              : "Preview how the email looks in dark mode"
          }
          arrow
        >
          <Button
            onClick={toggleDarkPreview}
            startIcon={darkPreview ? <Sun size={16} /> : <Moon size={16} />}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              color: darkPreview ? "primary.main" : "text.secondary",
            }}
          >
            {darkPreview ? "Light" : "Dark"}
          </Button>
        </Tooltip>
        <Button
          onClick={openPreview}
          startIcon={<Eye size={16} />}
          sx={{ textTransform: "none", fontWeight: 600, color: "text.secondary" }}
        >
          Preview
        </Button>
        <Button
          onClick={() => void saveDraft(serializeClean())}
          disabled={saving}
          startIcon={<Save size={16} />}
          sx={{ textTransform: "none", fontWeight: 600, color: "text.secondary" }}
        >
          {saving ? "Saving…" : "Save draft"}
        </Button>
        <Button
          onClick={() => void openExport()}
          variant="contained"
          startIcon={<Send size={16} />}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Export
        </Button>
      </Box>

      {/* editor frame */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.25,
            px: 0.5,
            py: 0.25,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Tooltip title="Undo" arrow>
            <span>
              <IconButton
                size="small"
                disabled={!canUndo}
                onClick={undo}
                aria-label="Undo"
                sx={{ color: "text.secondary" }}
              >
                <Undo2 size={17} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo" arrow>
            <span>
              <IconButton
                size="small"
                disabled={!canRedo}
                onClick={redo}
                aria-label="Redo"
                sx={{ color: "text.secondary" }}
              >
                <Redo2 size={17} />
              </IconButton>
            </span>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 11, color: "text.secondary", pr: 1 }}>
            Hover a row for its controls · click text/links/images to edit
          </Typography>
        </Box>

        <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              // Neutral grey gutter in both themes — the email supplies its own
              // background and a theme-following one would change how it reads.
              bgcolor: "#f0f0f0",
              display: "flex",
              justifyContent: "center",
              overflow: "auto",
            }}
          >
            <Box
              component="iframe"
              ref={iframeRef}
              title="Email preview"
              srcDoc={preview}
              // allow-same-origin so we can reach contentDocument; deliberately NOT
              // allow-scripts — template HTML must never execute.
              sandbox="allow-same-origin"
              onLoad={onIframeLoad}
              sx={{ width: "100%", height: "100%", border: "none", bgcolor: "#fff" }}
            />
          </Box>

          <EditorInspector
            sel={sel}
            catalog={catalog}
            catalogStatus={catalogStatus}
            linkOpen={linkOpen}
            linkUrl={linkUrl}
            onDeselect={deselect}
            onRichFmt={richFmt}
            onOpenLinkEditor={(u) => {
              setLinkUrl(u);
              setLinkOpen(true);
            }}
            onLinkUrlChange={setLinkUrl}
            onApplyLink={applyLink}
            onRemoveLink={removeLink}
            onCloseLinkEditor={() => setLinkOpen(false)}
            onHrefChange={setHref}
            onOpenUtm={() => setUtmOpen(true)}
            onLinkTextChange={setLinkText}
            onBtnVariant={setBtnVariant}
            onSrcChange={setSrc}
            onAltChange={setAlt}
            onImgHrefChange={setImgHref}
            onSpacerSize={setSpacerSize}
            onRemoveSelected={removeSelectedEl}
            onUnlink={unlinkSelected}
            onInsertRow={insertRow}
          />
        </Box>
      </Box>

      {utmOpen && sel?.kind === "link" && (
        <UtmDialog open initialUrl={sel.href} onApply={setHref} onClose={() => setUtmOpen(false)} />
      )}
      {utmOpen && sel?.kind === "image" && sel.linkId && (
        <UtmDialog
          open
          initialUrl={sel.href ?? ""}
          onApply={setImgHref}
          onClose={() => setUtmOpen(false)}
        />
      )}
      {aiOpen && (
        <StructureFillDialog
          open
          snapshot={snapshotBlocks()}
          mergeFields={hostMergeFields()}
          allowedKinds={aiKinds(catalog)}
          onApply={applyStructure}
          onClose={() => setAiOpen(false)}
        />
      )}
      {globalUtmOpen && (
        <GlobalUtmDialog
          open
          links={bodyLinkInfos()}
          onApply={applyGlobalUtm}
          onClose={() => setGlobalUtmOpen(false)}
        />
      )}
      {/* Mounted per open, like GlobalUtmDialog above. Kept mounted, its four
          pieces of local state survived a close: a stale `textOverride` masked the
          text version recomputed from the new HTML, so a reopened dialog could push
          the PREVIOUS body's plain-text half, and the last success alert was still
          sitting there. A remount is the reset. */}
      {exportOpen && (
        <ExportDialog
          open
          html={exportHtml}
          name={name}
          draftId={draftId}
          pardotTemplateId={pardotId}
          onSynced={({ pardotTemplateId }) => setPardotId(pardotTemplateId)}
          onClose={() => setExportOpen(false)}
        />
      )}
      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={2500}
        onClose={() => setSnack(null)}
        message={snack ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
      <PreviewDialog
        open={fullPreviewOpen}
        html={fullPreviewHtml}
        onClose={() => setFullPreviewOpen(false)}
      />
    </Box>
  );
}
