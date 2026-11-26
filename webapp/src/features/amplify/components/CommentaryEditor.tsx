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

import { forwardRef, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Box, IconButton, Paper, Popper, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  Redo2Icon,
  StrikethroughIcon,
  TextQuoteIcon,
  Undo2Icon,
} from "@wso2/oxygen-ui-icons-react";
import type { MentionCandidate } from "../api/amplifyTypes";
import { MENTION_DEBOUNCE_MS, useMentionCandidates } from "../api/useAmplifyData";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import {
  COMMENTARY_MAX_LENGTH,
  MAX_MENTIONS,
  activeMentions,
  buildCommentary,
  linkedInLength,
  locateMentions,
  sanitizeMentionLabel,
  splitCommentary,
  type TrackedMention,
} from "../util/linkedinMarkdown";
import {
  findMentionQuery,
  insertCode,
  insertLink,
  prefixLines,
  wrapSelection,
  type MentionQuery,
  type TextEdit,
} from "../util/markdownEditing";

// The counter turns to the warning colour from here.
const NEAR_LIMIT = Math.floor(COMMENTARY_MAX_LENGTH * 0.9);
const HISTORY_LIMIT = 200;

interface Snapshot {
  text: string;
  start: number;
  end: number;
}

interface CommentaryEditorProps {
  value: string;
  onChange: (value: string) => void;
  mentions: TrackedMention[];
  onMentionsChange: (mentions: TrackedMention[]) => void;
  disabled?: boolean;
  "data-componentid"?: string;
}

/**
 * "Add your thoughts" for a repost: a markdown textarea with a formatting toolbar, `@` mentions, a character
 * counter and a live preview of the text LinkedIn will show. The markdown becomes LinkedIn text only on send
 * (`buildCommentary`); the preview runs the same conversion, so what you see is what goes out.
 *
 * Undo and redo keep their own history, since toolbar edits set the value from code and the browser's own
 * undo does not see those.
 */
export default function CommentaryEditor({
  value,
  onChange,
  mentions,
  onMentionsChange,
  disabled = false,
  "data-componentid": componentId = "amplify-commentary-editor",
}: CommentaryEditorProps) {
  const ids = useId();
  const listboxId = `${ids}-mentions`;
  const counterId = `${ids}-counter`;
  const helpId = `${ids}-help`;
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  const history = useRef<{ stack: Snapshot[]; index: number }>({ stack: [{ text: value, start: 0, end: 0 }], index: 0 });
  const pendingSelection = useRef<[number, number] | null>(null);
  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const active = useMemo(() => activeMentions(value, mentions), [value, mentions]);
  const atMentionLimit = active.length >= MAX_MENTIONS;
  const commentary = useMemo(() => buildCommentary(value, mentions), [value, mentions]);
  const length = linkedInLength(commentary);

  const typing = mentionQuery !== null && mentionQuery.start !== dismissedAt && !atMentionLimit;
  const currentQuery = typing ? mentionQuery.query.trim() : "";
  const debouncedQuery = useDebouncedValue(currentQuery, MENTION_DEBOUNCE_MS);
  const candidatesQuery = useMentionCandidates(debouncedQuery);
  // Results show (and can be picked) only for the `@` query as typed now: while the debounce or the request
  // catches up, the list is hidden, so a pick never replaces text the results weren't for. Typing on without a
  // pick is fine: the `@` text is then sent as plain text.
  const fresh = currentQuery !== "" && debouncedQuery === currentQuery && !candidatesQuery.isPlaceholderData;
  const candidates: MentionCandidate[] = fresh ? (candidatesQuery.data ?? []) : [];
  const listOpen = candidates.length > 0;
  const highlighted = listOpen ? Math.min(activeIndex, candidates.length - 1) : -1;

  // Put the caret back after a value set from code (toolbar, undo, mention insert).
  useLayoutEffect(() => {
    const el = inputRef.current;
    const sel = pendingSelection.current;
    if (el && sel) {
      el.setSelectionRange(sel[0], sel[1]);
      pendingSelection.current = null;
    }
  }, [value]);

  const trackQuery = (text: string, caret: number) => {
    const q = findMentionQuery(text, caret);
    // Right after a mention that was already picked, the "query" is its own name: no list for that.
    const picked = q !== null && locateMentions(text, mentions).includes(q.start);
    setMentionQuery(picked ? null : q);
    setActiveIndex(0);
  };

  const record = (snap: Snapshot) => {
    const h = history.current;
    const stack = h.stack.slice(0, h.index + 1);
    stack.push(snap);
    if (stack.length > HISTORY_LIMIT) stack.shift();
    history.current = { stack, index: stack.length - 1 };
  };

  const apply = (edit: TextEdit, remember = true) => {
    if (remember) record({ text: edit.text, start: edit.start, end: edit.end });
    pendingSelection.current = [edit.start, edit.end];
    onChange(edit.text);
    trackQuery(edit.text, edit.end);
    inputRef.current?.focus();
  };

  const selection = (): [number, number] => {
    const el = inputRef.current;
    return el ? [el.selectionStart, el.selectionEnd] : [value.length, value.length];
  };

  const run = (edit: (text: string, start: number, end: number) => TextEdit) => {
    if (disabled) return;
    const [start, end] = selection();
    apply(edit(value, start, end));
  };

  const undo = () => {
    const h = history.current;
    if (h.index === 0) return;
    h.index -= 1;
    apply(h.stack[h.index], false);
  };

  const redo = () => {
    const h = history.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    apply(h.stack[h.index], false);
  };

  const pick = (candidate: MentionCandidate | undefined) => {
    if (!candidate || !mentionQuery || atMentionLimit) return;
    const label = sanitizeMentionLabel(candidate.displayName);
    if (!label) return;
    const [, caret] = selection();
    const inserted = `@${label} `;
    const text = value.slice(0, mentionQuery.start) + inserted + value.slice(caret);
    const at = mentionQuery.start + inserted.length;
    onMentionsChange([...mentions, { label, ref: candidate.ref, kind: candidate.kind }]);
    apply({ text, start: at, end: at });
    setMentionQuery(null);
  };

  const bold = (t: string, s: number, e: number) => wrapSelection(t, s, e, "**", "**", "bold text");
  const italic = (t: string, s: number, e: number) => wrapSelection(t, s, e, "*", "*", "italic text");
  const strike = (t: string, s: number, e: number) => wrapSelection(t, s, e, "~~", "~~", "struck text");

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (listOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((highlighted + step + candidates.length) % candidates.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(candidates[highlighted]);
        return;
      }
      if (e.key === "Escape") {
        // Close the list, not the dialog.
        e.preventDefault();
        e.stopPropagation();
        setDismissedAt(mentionQuery?.start ?? null);
        return;
      }
    }
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "b") {
      e.preventDefault();
      run(bold);
    } else if (key === "i") {
      e.preventDefault();
      run(italic);
    } else if (key === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (key === "y") {
      e.preventDefault();
      redo();
    }
  };

  const runTool = (id: ToolId) => {
    switch (id) {
      case "bold":
        return run(bold);
      case "italic":
        return run(italic);
      case "strike":
        return run(strike);
      case "link":
        return run(insertLink);
      case "bullet":
        return run((t, s, e) => prefixLines(t, s, e, "bullet"));
      case "numbered":
        return run((t, s, e) => prefixLines(t, s, e, "numbered"));
      case "quote":
        return run((t, s, e) => prefixLines(t, s, e, "quote"));
      case "code":
        return run(insertCode);
      case "undo":
        return undo();
      case "redo":
        return redo();
    }
  };

  const overLimit = length > COMMENTARY_MAX_LENGTH;
  const counterColor = overLimit ? "error.main" : length >= NEAR_LIMIT ? "warning.main" : "text.secondary";

  return (
    <Box data-componentid={componentId} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box role="toolbar" aria-label="Formatting" aria-controls={`${ids}-input`} sx={{ display: "flex", flexWrap: "wrap", gap: 0.25 }}>
        {TOOLS.map((tool) => {
          const title = tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label;
          return (
            <Tooltip key={tool.label} title={title}>
              <span>
                <IconButton
                  size="small"
                  aria-label={tool.label}
                  disabled={disabled}
                  // Keep the textarea's selection: a mouse down on the button would otherwise blur it first.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => runTool(tool.id)}
                >
                  {tool.icon}
                </IconButton>
              </span>
            </Tooltip>
          );
        })}
      </Box>
      <Typography id={helpId} variant="caption" color="text.secondary">
        Type @ to mention a colleague or Chore Labs. Bold, italic and the other styles use special Unicode letters,
        which screen readers may read letter by letter, so use them sparingly.
      </Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, alignItems: "start" }}>
        <Box ref={setAnchor}>
          <TextField
            id={`${ids}-input`}
            label="Add your thoughts (optional)"
            placeholder="Say why this matters to you. It shows above the repost on your LinkedIn."
            value={value}
            onChange={(e) => {
              const el = e.target as HTMLTextAreaElement;
              record({ text: el.value, start: el.selectionStart, end: el.selectionEnd });
              onChange(el.value);
              trackQuery(el.value, el.selectionEnd);
            }}
            onSelect={(e) => {
              const el = e.target as HTMLTextAreaElement;
              if (el.selectionStart === el.selectionEnd) trackQuery(el.value, el.selectionEnd);
            }}
            onBlur={() => setMentionQuery(null)}
            onKeyDown={onKeyDown}
            multiline
            minRows={5}
            maxRows={14}
            fullWidth
            disabled={disabled}
            inputRef={inputRef}
            slotProps={{
              htmlInput: {
                "aria-describedby": `${counterId} ${helpId}`,
                "aria-autocomplete": "list",
                "aria-controls": listOpen ? listboxId : undefined,
                "aria-expanded": listOpen,
                "aria-activedescendant": highlighted >= 0 ? `${listboxId}-${highlighted}` : undefined,
              },
            }}
          />
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5, gap: 1 }}>
            <Typography variant="caption" color={atMentionLimit ? "warning.main" : "text.secondary"}>
              {atMentionLimit ? `You can mention up to ${MAX_MENTIONS} people or pages in one post.` : ""}
            </Typography>
            <Typography id={counterId} variant="caption" sx={{ color: counterColor, fontWeight: overLimit ? 700 : 400 }}>
              {length} / {COMMENTARY_MAX_LENGTH}
              {overLimit ? " (too long for LinkedIn)" : ""}
            </Typography>
          </Box>
        </Box>

        {/* An outlined field with the same notched label as "Add your thoughts", so the two headers and box tops line up. */}
        <TextField
          id={`${ids}-preview`}
          label="LinkedIn preview"
          fullWidth
          slotProps={{
            inputLabel: { shrink: true },
            input: { readOnly: true, inputComponent: PreviewSurface as never },
            htmlInput: { previewText: commentary, labelId: `${ids}-preview-label` },
          }}
        />
      </Box>

      <Popper
        open={listOpen && !disabled}
        anchorEl={anchor}
        placement="bottom-start"
        style={{ zIndex: 1500 }}
      >
        <Paper elevation={6} sx={{ minWidth: 240, maxHeight: 280, overflowY: "auto" }}>
          <Box component="ul" role="listbox" id={listboxId} aria-label="People and pages to mention" sx={{ listStyle: "none", m: 0, p: 0.5 }}>
            {candidates.map((c, i) => (
              <Box
                component="li"
                key={c.ref}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={i === highlighted}
                // Keep focus in the textarea, so the caret and the query survive the click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
                onMouseEnter={() => setActiveIndex(i)}
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1,
                  cursor: "pointer",
                  bgcolor: i === highlighted ? "action.selected" : "transparent",
                }}
              >
                <Typography variant="body2">{c.displayName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {c.kind === "ORGANIZATION" ? "Company page" : "Colleague"}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      </Popper>
    </Box>
  );
}

type ToolId = "bold" | "italic" | "strike" | "link" | "bullet" | "numbered" | "quote" | "code" | "undo" | "redo";

const TOOLS: Array<{
  id: ToolId;
  label: string;
  shortcut?: string;
  icon: ReactNode;
}> = [
  { id: "bold", label: "Bold", shortcut: "Ctrl+B", icon: <BoldIcon size={16} /> },
  { id: "italic", label: "Italic", shortcut: "Ctrl+I", icon: <ItalicIcon size={16} /> },
  { id: "strike", label: "Strikethrough", icon: <StrikethroughIcon size={16} /> },
  { id: "link", label: "Link", icon: <LinkIcon size={16} /> },
  { id: "bullet", label: "Bulleted list", icon: <ListIcon size={16} /> },
  { id: "numbered", label: "Numbered list", icon: <ListOrderedIcon size={16} /> },
  { id: "quote", label: "Quote", icon: <TextQuoteIcon size={16} /> },
  { id: "code", label: "Code", icon: <CodeIcon size={16} /> },
  { id: "undo", label: "Undo", shortcut: "Ctrl+Z", icon: <Undo2Icon size={16} /> },
  { id: "redo", label: "Redo", shortcut: "Ctrl+Shift+Z", icon: <Redo2Icon size={16} /> },
];

/**
 * The body of the "LinkedIn preview" field. The field passes its input styling in `className`, which gives the
 * text the same padding and font as the "Add your thoughts" box beside it. It stays a labelled live region so a
 * screen reader hears the text change. Defined at module level: the field would remount a new function each render.
 */
const PreviewSurface = forwardRef<HTMLDivElement, { className?: string; previewText?: string; labelId?: string }>(
  function PreviewSurface({ className, previewText, labelId }, ref) {
    return (
      <div
        ref={ref}
        className={className}
        role="region"
        aria-labelledby={labelId}
        aria-live="polite"
        style={{ height: "auto", minHeight: "7.2em", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      >
        {previewText ? (
          <PreviewText text={previewText} />
        ) : (
          <Typography variant="body2" color="text.secondary" component="span">
            Your thoughts show here the way LinkedIn will show them.
          </Typography>
        )}
      </div>
    );
  },
);

/**
 * The commentary as LinkedIn shows it: mention tokens as the name, mentions and hashtags in link colour. Hashtags
 * follow the backend's rule (`splitCommentary`), so the preview marks what LinkedIn will get as one.
 */
function PreviewText({ text }: { text: string }) {
  return (
    <>
      {splitCommentary(text).map((part, i) =>
        part.kind === "text" ? (
          <span key={`t-${i}`}>{part.text}</span>
        ) : (
          <Box
            component="span"
            key={`${part.kind}-${i}`}
            data-kind={part.kind}
            sx={{ color: "info.main", fontWeight: part.kind === "mention" ? 600 : 500 }}
          >
            {part.text}
          </Box>
        ),
      )}
    </>
  );
}
