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

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon, ChevronUpIcon, RotateCcwIcon, SendHorizontalIcon, SparklesIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "../../util/salesError";
import { useAskDeal } from "../api/useMeddpiccMutations";
import type { AskCitation, AskTurn } from "../types";
import EvidenceItem from "./EvidenceItem";

/** One message in the thread. An assistant message carries its cited quotes, or the error. */
export interface ChatEntry {
  role: "user" | "assistant";
  text: string;
  citations?: AskCitation[];
  error?: string;
}

const SUGGESTIONS = [
  "Summarise where this deal stands.",
  "What's blocking the next stage?",
  "Who is the economic buyer, and how do we know?",
  "What did the customer say about competitors?",
  "What should I ask on the next call?",
];

/** How many earlier turns go back with each question; the backend uses at most eight. */
const HISTORY_TURNS = 8;

/**
 * Ask anything about this opportunity. Answers come from the deal's own record (its
 * fields, the AI's proposals, the quotes and who said them, the activity), never from
 * outside it, and each cites the quotes it relied on so the reader can check them.
 * Nothing here writes to Salesforce.
 *
 * The thread is held by the deal page, so it survives switching tabs; it is not kept
 * after the page is left.
 */
export default function DealChat({
  opportunityId,
  entries,
  onChange,
}: {
  opportunityId: string;
  entries: ChatEntry[];
  onChange: (entries: ChatEntry[]) => void;
}) {
  const ask = useAskDeal(opportunityId);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" });
  }, [entries.length, ask.isPending]);

  const send = async (question: string, thread: ChatEntry[] = entries) => {
    const text = question.trim();
    if (!text || ask.isPending) return;
    const history: AskTurn[] = thread
      .filter((e) => !e.error)
      .slice(-HISTORY_TURNS)
      .map((e) => ({ role: e.role, text: e.text }));
    const withQuestion = [...thread, { role: "user" as const, text }];
    onChange(withQuestion);
    setDraft("");
    try {
      const answer = await ask.mutateAsync({ question: text, history });
      onChange([...withQuestion, { role: "assistant", text: answer.answer, citations: answer.citations }]);
    } catch (error: unknown) {
      onChange([...withQuestion, { role: "assistant", text: "", error: describeError(error) }]);
    }
  };

  // Retry the question an error answered, dropping the failed pair first.
  const retry = (index: number) => {
    const question = entries[index - 1]?.text;
    if (question) void send(question, entries.slice(0, index - 1));
  };

  // A few suggestions not yet asked, offered as follow-ups once the thread has started.
  const asked = new Set(entries.filter((e) => e.role === "user").map((e) => e.text));
  const followUps = SUGGESTIONS.filter((q) => !asked.has(q)).slice(0, 3);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  };

  return (
    <Box sx={{ maxWidth: 860 }}>
      <Stack spacing={2} role="log" aria-label="Conversation about this deal" aria-live="polite" sx={{ mb: 2 }}>
        {entries.length === 0 && (
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
              <Box component="span" sx={{ color: "primary.main", display: "inline-flex" }} aria-hidden>
                <SparklesIcon size={18} />
              </Box>
              <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
                Ask about this deal
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Answers come from what Echo has on this deal: its MEDDPICC, the AI&apos;s proposals, what was said on
              calls and in emails, and its activity. Each answer shows the quotes it used.
            </Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} label={s} variant="outlined" onClick={() => void send(s)} disabled={ask.isPending} />
              ))}
            </Stack>
          </Box>
        )}

        {entries.map((entry, i) =>
          entry.role === "user" ? (
            <Box key={i} sx={{ alignSelf: "flex-end", maxWidth: "80%" }}>
              <Box sx={{ bgcolor: "primary.main", color: "primary.contrastText", px: 1.75, py: 1, borderRadius: 2, borderBottomRightRadius: 4 }}>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {entry.text}
                </Typography>
              </Box>
            </Box>
          ) : entry.error ? (
            <Alert
              key={i}
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => retry(i)} disabled={ask.isPending}>
                  Retry
                </Button>
              }
            >
              Couldn&apos;t answer that: {entry.error}
            </Alert>
          ) : (
            <Answer key={i} entry={entry} />
          ),
        )}

        {ask.isPending && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }} role="status">
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              Reading the deal…
            </Typography>
          </Stack>
        )}
        <div ref={endRef} />
      </Stack>

      {/* Pinned to the bottom of the view, so the question box is always at hand. */}
      <Box sx={{ position: "sticky", bottom: 0, bgcolor: "background.default", pt: 1, pb: 1.5, zIndex: 1 }}>
        {entries.length > 0 && (
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, mb: 1, alignItems: "center" }}>
            {followUps.map((q) => (
              <Chip key={q} label={q} size="small" variant="outlined" onClick={() => void send(q)} disabled={ask.isPending} />
            ))}
            <Button
              size="small"
              color="primary"
              variant="text"
              startIcon={<RotateCcwIcon size={13} />}
              onClick={() => onChange([])}
              disabled={ask.isPending}
              sx={{ textTransform: "none", ml: "auto" }}
            >
              New conversation
            </Button>
          </Stack>
        )}
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
          <TextField
            fullWidth
            multiline
            maxRows={5}
            size="small"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={entries.length ? "Ask a follow-up" : "Ask anything about this opportunity"}
            slotProps={{ htmlInput: { "aria-label": "Your question", maxLength: 2000 } }}
          />
          <Tooltip title="Send (Enter)" arrow>
            <span>
              <IconButton
                color="primary"
                onClick={() => void send(draft)}
                disabled={!draft.trim() || ask.isPending}
                aria-label="Send question"
              >
                <SendHorizontalIcon size={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>
          Answers can be wrong: check the quotes. Asking changes nothing in Salesforce; changes are approved on the
          MEDDPICC tab.
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * An answer: the text, with each [n] marked so it can be matched to its quote, then the
 * quotes themselves, numbered the same way.
 */
function Answer({ entry }: { entry: ChatEntry }) {
  const [showQuotes, setShowQuotes] = useState(false);
  const cited = new Map((entry.citations ?? []).map((c) => [c.number, c]));
  const parts = entry.text.split(/(\[\d+\])/g);
  const count = entry.citations?.length ?? 0;
  return (
    <Box sx={{ alignSelf: "flex-start", maxWidth: "92%" }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mb: 0.5, color: "primary.main" }}>
        <SparklesIcon size={13} aria-hidden />
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          Echo AI
        </Typography>
      </Stack>
      <Box sx={{ bgcolor: "action.hover", px: 1.75, py: 1.25, borderRadius: 2, borderTopLeftRadius: 4 }}>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {parts.map((part, i) => {
            const n = /^\[(\d+)\]$/.exec(part);
            if (!n) return part;
            const c = cited.get(Number(n[1]));
            return (
              <Tooltip key={i} title={c ? `“${c.quote.quote}” — ${c.quote.speaker}` : ""} arrow>
                <Box component="sup" sx={{ color: "primary.main", fontWeight: 700, px: 0.25, cursor: c ? "help" : "default" }}>
                  {part}
                </Box>
              </Tooltip>
            );
          })}
        </Typography>
      </Box>
      {count > 0 && (
        <Box sx={{ mt: 0.5, pl: 0.5 }}>
          {/* Folded by default: the [n] markers already show each quote on hover. */}
          <Button
            size="small"
            onClick={() => setShowQuotes((open) => !open)}
            endIcon={showQuotes ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
            aria-expanded={showQuotes}
            sx={{ textTransform: "none", px: 0.5, minWidth: 0 }}
          >
            {count === 1 ? "1 quote used" : `${count} quotes used`}
          </Button>
          {showQuotes && (
          <Stack component="ol" spacing={0.75} sx={{ listStyle: "none", p: 0, m: 0, mt: 0.5 }} aria-label="Quotes used">
            {(entry.citations ?? []).map((c) => (
              <Stack component="li" key={c.number} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700, minWidth: 22, pt: "2px" }}>
                  [{c.number}]
                </Typography>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <EvidenceItem quote={c.quote} />
                </Box>
              </Stack>
            ))}
          </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}
