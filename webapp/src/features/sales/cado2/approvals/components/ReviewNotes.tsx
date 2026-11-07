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

import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { Box, Stack, Typography } from "@wso2/oxygen-ui";
import type { LensRole, ReviewLens, ReviewNote } from "@features/sales/cado2/approvals/api/approvalTypes";
import { noteText, stateLabel } from "@features/sales/cado2/approvals/model/reviewNotes";

/** A note's colour: the accent, or green once a note to write is written. */
const tone = (n: ReviewNote) => (n.state === "DONE" ? "success" : "primary");

/** Controls inside a marked place keep their own clicks (an editor's Save, a switch). */
const CONTROLS = "button, a, input, textarea, select, label, [contenteditable='true'], [role='switch'], [role='textbox'], .ql-editor";

/** The quote element a note points at: its target, or the nearest shown parent (a folded year). */
function targetOf(sheet: HTMLElement, n: ReviewNote): HTMLElement | null {
  let el = sheet.querySelector<HTMLElement>(`[data-note-target~="${n.target}"]`);
  while (el && el !== sheet && el.getClientRects().length === 0) el = el.parentElement;
  return el && el !== sheet ? el : null;
}

/**
 * A lens's notes (D129), the last part of the approval card beside the
 * quote: in the order their places appear in the quote, each marked there
 * with a thin line in its colour. Clicking a note shows its place; clicking
 * a marked place selects its note. A plain list: nothing to mark (D140).
 */
export default function ReviewNotes({
  lens,
  sheet,
  empty,
}: {
  readonly lens: ReviewLens;
  /** The element holding the quote sheet, where the notes find their places. */
  readonly sheet: HTMLElement | null;
  /** What the panel says when the rules flag nothing. */
  readonly empty: string;
}): JSX.Element {
  const cards = useRef(new Map<string, HTMLDivElement>());
  const [active, setActive] = useState<string | null>(null);

  // In the order their places appear in the quote; notes without one last.
  const notes = useMemo(() => {
    if (!sheet) return lens.notes;
    const at = new Map(lens.notes.map((n) => [n.key, targetOf(sheet, n)]));
    return [...lens.notes].sort((a, b) => {
      const x = at.get(a.key);
      const y = at.get(b.key);
      if (!x || !y) return x ? -1 : y ? 1 : 0;
      if (x === y) return 0;
      return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }, [lens.notes, sheet]);

  // Mark each place in the quote, and let a click on it select its note.
  useEffect(() => {
    if (!sheet) return undefined;
    const marked = new Map<HTMLElement, { state: string; keys: string[] }>();
    for (const n of notes) {
      const el = targetOf(sheet, n);
      if (!el) continue;
      const m = marked.get(el) ?? { state: "fine", keys: [] };
      if (n.state !== "DONE") m.state = "open";
      m.keys.push(n.key);
      marked.set(el, m);
    }
    const off: (() => void)[] = [];
    marked.forEach((m, el) => {
      el.dataset.noteState = m.state;
      if (active && m.keys.includes(active)) el.dataset.noteActive = "true";
      // A plain listener: it never stops the click, so React's handlers inside
      // (an editor's Save) still run; the panel's "click elsewhere" ignores it.
      const onClick = (e: MouseEvent) => {
        if ((e.target as Element | null)?.closest?.(CONTROLS)) return;
        setActive(m.keys[0]);
        cards.current.get(m.keys[0])?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      };
      el.addEventListener("click", onClick);
      off.push(() => {
        el.removeEventListener("click", onClick);
        delete el.dataset.noteState;
        delete el.dataset.noteActive;
      });
    });
    return () => off.forEach((f) => f());
  }, [sheet, notes, active]);

  // A click anywhere else clears the selection.
  useEffect(() => {
    const clear = (e: MouseEvent) => {
      const at = e.target as Element | null;
      if (at?.closest?.("[data-note-state]") && !at.closest(CONTROLS)) return;
      setActive(null);
    };
    document.addEventListener("click", clear);
    return () => document.removeEventListener("click", clear);
  }, []);

  const open = (n: ReviewNote) => {
    setActive(n.key);
    const el = sheet ? targetOf(sheet, n) : null;
    el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };

  return (
    <Box
      component="aside"
      aria-label={`${lens.roleLabel} approval notes`}
      sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Approval notes
        </Typography>
        <Typography variant="caption" color="text.secondary">
          From the approval rules. Select one to see it in the quote.
        </Typography>
      </Box>
      <Stack spacing={1} sx={{ p: 1.25, overflowY: "auto", minHeight: 0 }}>
        {notes.length ? (
          notes.map((n) => (
            <NoteCard
              key={n.key}
              note={n}
              role={lens.role}
              active={active === n.key}
              onOpen={() => open(n)}
              cardRef={(el) => {
                if (el) cards.current.set(n.key, el);
                else cards.current.delete(n.key);
              }}
            />
          ))
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 0.75 }}>
            {empty}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function NoteCard({
  note: n,
  role,
  active,
  onOpen,
  cardRef,
}: {
  readonly note: ReviewNote;
  readonly role: LensRole;
  readonly active: boolean;
  readonly onOpen: () => void;
  readonly cardRef: (el: HTMLDivElement | null) => void;
}): JSX.Element {
  const text = noteText(n, role);
  const done = n.state === "DONE";
  const label = stateLabel(n);
  return (
    <Box
      ref={cardRef}
      role="article"
      aria-label={text.title}
      aria-current={active || undefined}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      sx={{
        p: 1.25,
        borderRadius: 1.5,
        border: 1,
        borderColor: active ? "primary.main" : "divider",
        borderLeft: 3,
        borderLeftColor: `${tone(n)}.main`,
        bgcolor: active ? "action.hover" : "background.paper",
        cursor: "pointer",
        transition: "border-color .15s, background-color .15s",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="baseline">
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {text.title}
        </Typography>
        {label ? (
          <Typography variant="caption" sx={{ fontWeight: 700, color: `${tone(n)}.main`, whiteSpace: "nowrap" }}>
            {label}
          </Typography>
        ) : null}
      </Stack>
      {done ? null : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {text.detail}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, fontWeight: 600 }}>
            {text.who}
          </Typography>
        </>
      )}
    </Box>
  );
}
