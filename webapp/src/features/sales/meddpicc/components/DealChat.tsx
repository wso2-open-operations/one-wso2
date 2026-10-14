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
import { SendHorizontalIcon, SparklesIcon } from "@wso2/oxygen-ui-icons-react";
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

      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
        <TextField
          fullWidth
          multiline
          maxRows={5}
          size="small"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything about this opportunity"
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
  );
}

/**
 * An answer: the text, with each [n] marked so it can be matched to its quote, then the
 * quotes themselves, numbered the same way.
 */
function Answer({ entry }: { entry: ChatEntry }) {
  const cited = new Map((entry.citations ?? []).map((c) => [c.number, c]));
  const parts = entry.text.split(/(\[\d+\])/g);
  return (
    <Box sx={{ alignSelf: "flex-start", maxWidth: "92%" }}>
      <Box sx={{ bgcolor: "action.hover", px: 1.75, py: 1.25, borderRadius: 2, borderBottomLeftRadius: 4 }}>
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
      {entry.citations && entry.citations.length > 0 && (
        <Box sx={{ mt: 1, pl: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Quotes used
          </Typography>
          <Stack component="ol" spacing={0.75} sx={{ listStyle: "none", p: 0, m: 0, mt: 0.5 }} aria-label="Quotes used">
            {entry.citations.map((c) => (
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
        </Box>
      )}
    </Box>
  );
}
