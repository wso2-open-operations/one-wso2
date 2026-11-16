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

import { AutoAwesome as AutoAwesomeIcon } from "../icons";
import { ArrowUpward as ArrowUpwardIcon } from "../icons";
import { Search as SearchIcon } from "../icons";
import { FileDownloadOutlined as FileDownloadOutlinedIcon } from "../icons";
import { AttachFile as AttachFileIcon } from "../icons";
import { Close as CloseIcon } from "../icons";
import { ThumbUpAltOutlined as ThumbUpIcon } from "../icons";
import { ThumbDownAltOutlined as ThumbDownIcon } from "../icons";
import { InsertDriveFileOutlined as InsertDriveFileOutlinedIcon } from "../icons";
import { Add as AddIcon } from "../icons";
import { DeleteOutline as DeleteOutlineIcon } from "../icons";
import { History as HistoryIcon } from "../icons";
import { OpenInNew as OpenInNewIcon } from "../icons";
import {
  Alert, Avatar, Box, Button, ButtonBase, Checkbox, Chip, CircularProgress, IconButton, InputBase, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from "@wso2/oxygen-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { isacBackendUrl } from "@config/apiConfig";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { RevealBulkResult, useApiClient, useIsacFetch } from "../api/client";
import RevealContactsDialog, { DoNotCallChip, ProviderChip } from "../components/RevealContactsDialog";
import { C, F } from "../theme/pageTokens";
import { FS, FW, LABEL, ROW } from "../theme/typeScale";
import { isacPath } from "../paths";

/** One results block the AI pulled from an Advanced Search API. */
interface RowsBlock {
  tool: string;
  /** The exact filters behind these rows — lets "Download all" re-run them. */
  input?: Record<string, unknown>;
  kind?: string;
  source?: string;
  total?: number;
  columns?: BackendColumn[];
  items: Record<string, unknown>[];
  /** Download name — an enriched upload comes back as "<its name>-enriched.csv". */
  filename?: string;
}

/** Cell render kinds the presentation framework understands. */
type CellType = "text" | "number" | "money" | "score" | "tier" | "stage" | "url" | "tags" | "boolean" | "date" | "link" | "status";

/** A resolved column — how to pull a value from an item and how to render it. */
interface ColumnSpec {
  label: string;
  type: CellType;
  get: (it: Record<string, unknown>) => unknown;
  /** The item field behind it, when there is exactly one — lets an enriched
   * table mark the cells enrichment filled. */
  key?: string;
}

/** One answer on a question card. Picking it sends `prompt` (or the label) as
 * the user's reply; `prompt: null` just closes the card. */
interface QuestionOption {
  label: string;
  description?: string | null;
  recommended?: boolean;
  prompt?: string | null;
}

/** A question the AI asked — shown as a card above the composer. */
interface Question {
  question: string;
  options: QuestionOption[];
  /** Offer "Something else…" so the user can type their own answer. */
  allow_other?: boolean;
}

/** One account from an uploaded list, with how many people ISAC holds there. */
interface UploadAccount {
  name?: string | null;
  domain?: string | null;
  matched_by?: string | null;
  people: number;
  /** Of `people`: Salesforce leads/contacts vs. contacts saved by an earlier
   * ZoomInfo / Apollo discovery. */
  salesforce?: number;
  discovered?: number;
}

/** "Find contacts at these accounts": the free ISAC lookup has run, and the user
 * now picks Salesforce, Apollo, or both. */
interface ContactChoice {
  file: string;
  accounts: UploadAccount[];
  items: Record<string, unknown>[];
  total: number;
}

/** Optional per-column hint a tool/backend may send in the `rows` envelope. */
interface BackendColumn {
  key: string;
  label: string;
  type?: string;
}

/** One tool call as the backend executed it — the trace the user can inspect.
 * Emitted by the executor, not narrated by the model, so it cannot be wrong. */
interface TraceStep {
  tool: string;
  input: Record<string, unknown>;
  total?: number;
  returned?: number;
  ms?: number;
  error?: string;
  done?: boolean;
}

/** Something the agent proposed but did not do — the user confirms it. */
interface ProposedAction {
  action: string;
  name: string;
  total: number;
  will_save: number;
  filters: Record<string, unknown>;
  // Enrichment proposals (see propose_enrichment).
  target?: "leads" | "accounts";
  ids?: number[];
  count?: number;
  labels?: string[];
  skipped_optout?: number;
  missing?: number;
}

/** POST JSON to the backend with the caller's tokens; throws on a non-2xx. */
type ApiPost = <T = unknown>(path: string, body: unknown) => Promise<T>;
/** GET from the backend with the caller's tokens; throws on a non-2xx. */
type ApiGet = <T = unknown>(path: string) => Promise<T>;

/** One saved conversation, as listed in the sidebar. */
interface ThreadSummary {
  id: number;
  title: string;
  turns: number;
  updated_at: string | null;
}

/** A turn as stored server-side (see app/agents/ask/trace.py). */
interface StoredTurn {
  id: string;
  prompt: string;
  answer: string;
  /** The model's narration between tool calls — shown dimmed and collapsed. */
  reasoning?: string;
  rating: number | null;
  steps: { tool: string; input: Record<string, unknown>; total?: number; returned?: number; ms?: number; error?: string }[];
}

/** A single chat turn. Assistant turns stream `text` and may carry `rows`. */
interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  /** The answer. While streaming it may still turn out to be reasoning — a
   * `reasoning_end` event moves it into `reasoning`. */
  text: string;
  reasoning?: string;
  rows: RowsBlock[];
  steps: TraceStep[];
  actions?: ProposedAction[];
  /** The question this answer ends with, until the user answers it. */
  question?: Question;
  contactChoice?: ContactChoice;
  /** Reopened from a saved thread: rows weren't stored, so each search offers
   * to re-run its saved filters. */
  restored?: boolean;
  turnId?: string;
  rating?: number | null;
  /** The prompt this answer is for — lets a failed answer be retried. */
  prompt?: string;
  error?: string;
  streaming?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  search_accounts: "Searched accounts",
  search_people: "Searched people",
  get_facets: "Checked filter values",
  find_person: "Looked up the person",
  get_account_story: "Read the account's signals",
  get_movers: "Checked what changed",
  propose_enrichment: "Prepared enrichment",
  propose_apollo_list: "Prepared Apollo list",
  enrich_csv: "Enriched from file",
  account_contacts: "Looked up contacts at your accounts",
  find_account_contacts: "Checked contacts at the accounts",
};

/** Filters worth showing — pagination is noise. */
const HIDDEN_FILTERS = new Set(["page", "per_page"]);

const fmtFilters = (input: Record<string, unknown>) =>
  Object.entries(input)
    .filter(([k, v]) => !HIDDEN_FILTERS.has(k) && v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);

const EXAMPLES = [
  "Top 20 hot accounts in APAC evaluating APIs",
  "Net-new banks with decision-stage intent",
  "CTOs and VPs of Engineering at fintech companies",
];

let _id = 0;
/** Monotonic id for chat turns (module-local counter). */
const nextId = () => ++_id;

/** What a failed answer says. A pod restart or a dropped network surfaces as the
 * browser's own exception — "network error", "Failed to fetch", "Load failed",
 * an aborted body read — which told the user nothing; those become one plain
 * sentence. Errors the server sent (an SSE `error` event, an HTTP detail) keep
 * their own message. */
function describeFailure(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e ?? "");
  const transport = e instanceof TypeError
    || (e instanceof DOMException && e.name === "AbortError")
    || /network ?error|failed to fetch|load failed|body stream|aborted/i.test(text);
  if (transport) return "The connection to ISAC dropped before the answer finished.";
  return text || "Something went wrong.";
}

/** Shown when a request is refused because the sign-in session has lapsed. */
const SESSION_EXPIRED = "Session expired — please sign in again.";

/** HTTP statuses the gateway answers with while the backend pod is down. */
const GATEWAY_DOWN = new Set([502, 503, 504]);

/** The list without failed answer `id` and the user prompt just before it. */
function withoutFailedTurn(list: ChatMessage[], id: number | undefined): ChatMessage[] {
  const i = id == null ? -1 : list.findIndex((m) => m.id === id);
  if (i < 0) return list;
  const from = i > 0 && list[i - 1].role === "user" ? i - 1 : i;
  return [...list.slice(0, from), ...list.slice(i + 1)];
}

/** Copilot — a standalone chat over the Advanced Search REST APIs. The AI fills
 * the exact same filters that page has and streams its answer + result tables. */
export default function Copilot() {
  const isacFetch = useIsacFetch();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  // An attached company list can be enriched, or turned into the people we hold
  // at those accounts. People lists can only be enriched.
  const [uploadMode, setUploadMode] = useState<"enrich" | "contacts">("enrich");
  // The server owns the conversation; this is just the handle to it.
  const [sessionId, setSessionId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // The user chose "Something else…" on a question card and is typing an answer.
  const [answeringOther, setAnsweringOther] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** Patch the in-flight assistant turn (last message) via a functional update. */
  const patchLast = useCallback((fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const next = prev.slice();
      next[next.length - 1] = fn(next[next.length - 1]);
      return next;
    });
  }, []);

  const call = useCallback(async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await isacFetch(`${isacBackendUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try { const j = await res.json(); if (j?.detail) detail = String(j.detail); } catch { /* not JSON */ }
      throw new Error(detail);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }, [isacFetch]);

  const api: ApiPost = useCallback(
    <T,>(path: string, body: unknown) => call<T>("POST", path, body), [call]);
  const apiGet: ApiGet = useCallback(<T,>(path: string) => call<T>("GET", path), [call]);

  // ── Saved threads ──────────────────────────────────────────────────────────
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(false);   // narrow screens only

  const loadThreads = useCallback(async () => {
    try {
      const r = await call<{ retention_days: number; sessions: ThreadSummary[] }>(
        "GET", "/api/v1/ask/sessions");
      setThreads(r.sessions);
      setRetentionDays(r.retention_days);
    } catch { /* the sidebar is a convenience — never block the chat on it */ }
  }, [call]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const newChat = useCallback(() => {
    if (busy) return;
    setMessages([]);
    setSessionId(null);
    setThreadsOpen(false);
  }, [busy]);

  /** Reopen a saved thread: its answers, traces and ratings come back, and the
   * next question continues it — the server rebuilds the context from it. */
  const openThread = useCallback(async (id: number) => {
    if (busy) return;
    try {
      const t = await call<{ id: number; turns: StoredTurn[] }>("GET", `/api/v1/ask/sessions/${id}`);
      setMessages(t.turns.flatMap((turn): ChatMessage[] => [
        { id: nextId(), role: "user", text: turn.prompt, rows: [], steps: [] },
        {
          id: nextId(), role: "assistant", text: turn.answer || "", reasoning: turn.reasoning || "", rows: [],
          steps: (turn.steps ?? []).map((st) => ({ ...st, done: true })),
          turnId: turn.id, rating: turn.rating, restored: true,
        },
      ]));
      setSessionId(t.id);
      setThreadsOpen(false);
    } catch {
      // Expired or deleted since the list loaded — drop it from the list.
      loadThreads();
    }
  }, [busy, call, loadThreads]);

  const deleteThread = useCallback(async (id: number) => {
    if (!window.confirm("Delete this conversation? This can't be undone.")) return;
    try { await call("DELETE", `/api/v1/ask/sessions/${id}`); } catch { /* already gone */ }
    if (id === sessionId) { setMessages([]); setSessionId(null); }
    loadThreads();
  }, [call, loadThreads, sessionId]);

  /** Re-run one restored search's saved filters to show its table again. */
  const showResults = useCallback(async (msgId: number, step: TraceStep) => {
    const r = await api<{ total: number; items: Record<string, unknown>[] }>(
      "/api/v1/ask/resolve", { tool: step.tool, input: step.input, cap: 100 });
    setMessages((prev) => prev.map((m) => (m.id !== msgId ? m : {
      ...m,
      rows: [...m.rows, {
        tool: step.tool, input: step.input, total: r.total, items: r.items,
        kind: step.tool === "search_people" ? "people" : "accounts",
      }],
    })));
  }, [api]);

  /** Record 👍/👎 on one answer, optimistically.
   *
   * ``current`` comes from the caller rather than being read inside the state
   * updater, so the updater stays pure and the revert can restore the rating
   * that was actually saved — not just clear it. */
  const rate = useCallback(async (msgId: number, turnId: string, value: number,
                                  current: number | null) => {
    if (sessionId == null) return;
    const next = current === value ? null : value;   // clicking again clears it
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, rating: next } : m)));
    try {
      const res = await isacFetch(`${isacBackendUrl}/api/v1/ask/sessions/${sessionId}/turns/${turnId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: next }),
      });
      // fetch only rejects on network failure — a 404/422 resolves normally and
      // would otherwise leave the UI showing a rating that was never stored.
      if (!res.ok) throw new Error(`rating failed (${res.status})`);
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, rating: current } : m)));
    }
  }, [sessionId, isacFetch]);

  /** Send a prompt. `retryOf` is a failed answer's id: that answer and its
   * prompt are replaced by the new pair rather than repeated. */
  const send = useCallback(async (prompt: string, retryOf?: number) => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");

    const userTurn: ChatMessage = { id: nextId(), role: "user", text, rows: [], steps: [] };
    const aiTurn: ChatMessage = { id: nextId(), role: "assistant", text: "", rows: [], steps: [], streaming: true, prompt: text };
    // A new message answers (or overrides) any question still on screen.
    setMessages((prev) => [
      ...withoutFailedTurn(prev, retryOf).map((m) => (m.question ? { ...m, question: undefined } : m)),
      userTurn, aiTurn,
    ]);
    setAnsweringOther(false);

    try {
      const res = await isacFetch(`${isacBackendUrl}/api/v1/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, session_id: sessionId }),
      });
      if (res.status === 401) throw new Error(SESSION_EXPIRED);

      if (!res.ok || !res.body) {
        // The gateway answers 502/503/504 (often with an HTML page) while the pod restarts.
        if (GATEWAY_DOWN.has(res.status)) throw new Error(`ISAC isn't reachable right now (${res.status}) — try again in a moment.`);
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      // Read the SSE stream: frames are separated by a blank line; each frame
      // has one `data: {json}` line.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let evt: Record<string, unknown>;
          try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
          handleEvent(evt);
        }
      }
    } catch (e) {
      patchLast((m) => ({ ...m, error: describeFailure(e), streaming: false }));
    } finally {
      patchLast((m) => ({ ...m, streaming: false }));
      setBusy(false);
      loadThreads();
    }

    /** Apply one streamed SSE event to the in-flight assistant turn. */
    function handleEvent(evt: Record<string, unknown>) {
      switch (evt.type) {
        case "token":
          patchLast((m) => ({ ...m, text: m.text + String(evt.text ?? "") }));
          break;
        case "reasoning_end":
          // What just streamed was the model narrating before a tool call, not
          // the answer — move it out of the answer area.
          patchLast((m) => ({
            ...m,
            reasoning: [m.reasoning, m.text.trim()].filter(Boolean).join("\n\n"),
            text: "",
          }));
          break;
        case "session":
          if (typeof evt.session_id === "number") setSessionId(evt.session_id);
          break;
        case "tool":
          // Open a trace step — `tool_result` closes it with counts and timing.
          patchLast((m) => ({
            ...m,
            steps: [...m.steps, {
              tool: String(evt.name ?? ""),
              input: (evt.input as Record<string, unknown>) ?? {},
            }],
          }));
          break;
        case "action":
          patchLast((m) => ({
            ...m,
            actions: [...(m.actions ?? []), {
              action: String(evt.action ?? ""),
              name: String(evt.name ?? ""),
              total: Number(evt.total ?? 0),
              will_save: Number(evt.will_save ?? 0),
              filters: (evt.filters as Record<string, unknown>) ?? {},
              target: evt.target as ProposedAction["target"],
              ids: evt.ids as number[] | undefined,
              count: evt.count as number | undefined,
              labels: evt.labels as string[] | undefined,
              skipped_optout: evt.skipped_optout as number | undefined,
              missing: evt.missing as number | undefined,
            }],
          }));
          break;
        case "question":
          patchLast((m) => ({ ...m, question: {
            question: String(evt.question ?? ""),
            options: (evt.options as QuestionOption[] | undefined) ?? [],
            allow_other: evt.allow_other !== false,
          } }));
          break;
        case "tool_result":
          patchLast((m) => {
            const steps = m.steps.slice();
            for (let i = steps.length - 1; i >= 0; i -= 1) {
              if (steps[i].tool === evt.name && !steps[i].done) {
                steps[i] = {
                  ...steps[i], done: true,
                  total: evt.total as number | undefined,
                  returned: evt.returned as number | undefined,
                  ms: evt.ms as number | undefined,
                  error: evt.error as string | undefined,
                };
                break;
              }
            }
            return { ...m, steps };
          });
          break;
        case "rows":
          patchLast((m) => ({
            ...m,
            rows: [...m.rows, {
              tool: String(evt.tool ?? ""),
              input: evt.input as Record<string, unknown> | undefined,
              kind: evt.kind as string | undefined,
              source: evt.source as string | undefined,
              total: evt.total as number | undefined,
              columns: evt.columns as BackendColumn[] | undefined,
              items: (evt.items as Record<string, unknown>[]) ?? [],
            }],
          }));
          break;
        case "tool_error":
          patchLast((m) => ({ ...m, text: m.text + `\n\n_${String(evt.message ?? "A step was skipped.")}_` }));
          break;
        case "done": {
          const trace = evt.trace as { id?: string } | undefined;
          if (typeof evt.session_id === "number") setSessionId(evt.session_id);
          // If nothing streamed (proxy buffered), fall back to the full payload.
          patchLast((m) => ({
            ...m,
            text: m.text || String(evt.text ?? ""),
            reasoning: m.reasoning || String(evt.reasoning ?? ""),
            turnId: trace?.id,
          }));
          break;
        }
        case "error":
          patchLast((m) => ({ ...m, error: String(evt.message ?? "Something went wrong"), streaming: false }));
          break;
        default:
          break;
      }
    }
  }, [busy, sessionId, isacFetch, patchLast, loadThreads]);

  /** Re-send the prompt a failed answer was for, replacing that answer. */
  const retry = useCallback((msg: ChatMessage) => {
    if (msg.prompt) send(msg.prompt, msg.id);
  }, [send]);

  /** Upload a CSV list: enrich it, or find everyone we hold at its accounts. */
  const uploadCsv = useCallback(async (csv: File, note: string, mode: "enrich" | "contacts") => {
    if (busy) return;
    setBusy(true);
    setInput("");
    setFile(null);

    const label = note.trim() || (mode === "contacts" ? `Find contacts at the accounts in ${csv.name}` : `Enrich ${csv.name}`);
    const userTurn: ChatMessage = { id: nextId(), role: "user", text: label, rows: [], steps: [] };
    const aiTurn: ChatMessage = { id: nextId(), role: "assistant", text: "", rows: [], steps: [{ tool: mode === "contacts" ? "account_contacts" : "enrich_csv", input: {}, done: true }], streaming: true };
    setMessages((prev) => [...prev, userTurn, aiTurn]);

    try {
      // Multipart upload — do NOT set Content-Type; the browser adds the boundary.
      const fd = new FormData();
      fd.append("file", csv);
      const path = mode === "contacts" ? "account-contacts" : "enrich-csv";
      const res = await isacFetch(`${isacBackendUrl}/api/v1/ask/${path}`, { method: "POST", body: fd });
      if (res.status === 401) throw new Error(SESSION_EXPIRED);
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `Upload failed (${res.status})`);
      }

      const data = (await res.json()) as {
        error?: string; kind?: string; total?: number;
        items?: Record<string, unknown>[]; enriched?: number; note?: string;
        columns?: BackendColumn[];
        summary?: { enriched: number; no_match: number; skipped: number; values_added: number;
          fields_added: string[]; by_provider: Record<string, number> };
        accounts?: UploadAccount[];
        rejected?: { line: number; value: string; reason: string }[];
        warnings?: { line: number; value: string; reason: string }[];
      };
      if (data.error) { patchLast((m) => ({ ...m, error: data.error!, streaming: false })); return; }

      if (mode === "contacts") {
        const items = data.items ?? [];
        const accts = data.accounts ?? [];
        const total = data.total ?? items.length;
        const withPeople = accts.filter((a) => a.people > 0);
        const empty = accts.filter((a) => a.people === 0).map((a) => a.name || a.domain).filter(Boolean);
        const rejected = data.rejected ?? [];
        // Ask before listing: the user decides between who we already hold in
        // Salesforce and a fresh search in Apollo (see ContactSourceCard).
        const discovered = accts.reduce((n, a) => n + (a.discovered ?? 0), 0);
        const inSf = total - discovered;
        const held = discovered
          ? `**${inSf.toLocaleString()}** in Salesforce and **${discovered.toLocaleString()}** discovered earlier from ZoomInfo/Apollo`
          : `**${total.toLocaleString()}** ${total === 1 ? "person" : "people"} in Salesforce`;
        const lines = [total
          ? `We already have ${held} at **${withPeople.length}** of ${accts.length} accounts from **${csv.name}**.`
          : `We don't have anyone on record at the ${accts.length} account${accts.length === 1 ? "" : "s"} in **${csv.name}**.`];
        if (total && empty.length) lines.push(`No one on record at: ${empty.join(", ")}.`);
        if (rejected.length) {
          lines.push(`Skipped ${rejected.length} row${rejected.length === 1 ? "" : "s"}: `
            + rejected.slice(0, 5).map((r) => `line ${r.line} (${r.reason})`).join("; ")
            + (rejected.length > 5 ? "; …" : "") + ".");
        }
        const warnings = data.warnings ?? [];
        if (warnings.length) {
          lines.push(`Matched ${warnings.length} account${warnings.length === 1 ? "" : "s"} by name only — the domain was unusable: `
            + warnings.slice(0, 5).map((w) => `line ${w.line} (${w.reason})`).join("; ")
            + (warnings.length > 5 ? "; …" : "") + ".");
        }
        if (data.note) lines.push(`_${data.note}_`);
        patchLast((m) => ({
          ...m,
          text: lines.join("\n\n"),
          contactChoice: { file: csv.name, accounts: accts, items, total },
        }));
        return;
      }

      const items = data.items ?? [];
      const total = data.total ?? items.length;
      const sm = data.summary;
      const enriched = sm?.enriched ?? data.enriched ?? 0;
      const lines = [`Enriched **${enriched}** of ${items.length} row${items.length === 1 ? "" : "s"} from **${csv.name}**`
        + (sm?.values_added ? ` — added **${sm.values_added}** values.` : ".")];
      const misses = [
        sm?.no_match ? `${sm.no_match} had no match` : "",
        sm?.skipped ? `${sm.skipped} skipped (no ${data.kind === "enriched_people" ? "email" : "domain or company"})` : "",
      ].filter(Boolean);
      if (misses.length) lines[0] += ` ${misses.join(", ")}.`;
      if (sm?.fields_added?.length) {
        const by = Object.entries(sm.by_provider ?? {}).map(([p, n]) => `${p} (${n} row${n === 1 ? "" : "s"})`).join(", ");
        lines.push(`Filled in: ${sm.fields_added.slice(0, 8).join(", ")}${sm.fields_added.length > 8 ? " and more." : "."}`
          + (by ? ` Sources: ${by}.` : ""));
      }
      lines.push("Highlighted cells are the ones enrichment filled. Click a row for every field; the CSV has them all.");
      if (data.note) lines.push(`_${data.note}_`);
      patchLast((m) => ({
        ...m,
        text: lines.join("\n\n"),
        rows: [{ tool: "enrich_csv", kind: data.kind, total, items, columns: data.columns,
          filename: `${csv.name.replace(/\.[^.]+$/, "")}-enriched.csv` }],
      }));
    } catch (e) {
      patchLast((m) => ({ ...m, error: describeFailure(e), streaming: false }));
    } finally {
      patchLast((m) => ({ ...m, streaming: false }));
      setBusy(false);
    }
  }, [busy, isacFetch, patchLast]);

  /** Append a result table to one message — the contact-source card adds
   * Salesforce and Apollo results to the answer that asked about them. */
  const addRows = useCallback((msgId: number, block: RowsBlock) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, rows: [...m.rows, block] } : m)));
  }, []);

  /** Close the open question card without answering it. */
  const dismissQuestion = useCallback((msgId: number) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, question: undefined } : m)));
    setAnsweringOther(false);
  }, []);

  /** An option on the question card was picked: it becomes the user's reply. */
  const answerQuestion = useCallback((msgId: number, opt: QuestionOption) => {
    if (busy) return;
    dismissQuestion(msgId);
    if (opt.prompt !== null) send(opt.prompt ?? opt.label);
  }, [busy, send, dismissQuestion]);

  /** "Something else…": keep the card for reference and hand over to the composer. */
  const answerOther = useCallback(() => {
    setAnsweringOther(true);
    inputRef.current?.focus();
  }, []);

  // The question waiting for an answer: only on the latest reply, once it's done.
  const last = messages[messages.length - 1];
  const openQuestion = !busy && last?.role === "assistant" && !last.streaming && last.question?.options.length
    ? { msgId: last.id, q: last.question } : null;

  /** Submit the composer — enrich the attached file if any, else send the prompt. */
  const onSubmit = useCallback(() => {
    if (busy) return;
    if (file) uploadCsv(file, input, uploadMode);
    else send(input);
  }, [busy, file, input, uploadMode, uploadCsv, send]);

  /** Stash the picked file; reset the input so the same file can be re-picked. */
  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
    e.target.value = "";
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  /** The composer card — rendered centred on an empty chat, docked below the
   * conversation once it starts. One element, so behaviour can't diverge. */
  const composer = (centred: boolean) => (
    <>
    <input
      ref={fileInputRef}
      type="file"
      accept=".csv,.txt,text/csv,text/plain"
      onChange={onPickFile}
      style={{ display: "none" }}
    />
    <Box
      sx={{
        display: "flex", flexDirection: "column", gap: 1,
        border: `1px solid ${C.border}`, borderRadius: 3, bgcolor: centred ? C.panel : C.bg,
        px: 2, py: centred ? 1.5 : 1,
        boxShadow: centred ? "0 4px 24px rgba(0,0,0,0.06)" : "none",
        transition: "box-shadow .2s ease",
        "&:focus-within": { borderColor: `${C.orange}88` },
      }}
    >
      {file && (
        <Chip
          icon={<InsertDriveFileOutlinedIcon sx={{ fontSize: 16 }} />}
          label={file.name}
          onDelete={busy ? undefined : () => setFile(null)}
          deleteIcon={<CloseIcon />}
          sx={{ alignSelf: "flex-start", maxWidth: "100%", fontFamily: F, bgcolor: C.card, color: C.textMd }}
        />
      )}
      {file && (
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {([["enrich", "Enrich this list"], ["contacts", "Find contacts at these accounts"]] as const)
            .map(([mode, label]) => (
              <Chip key={mode} size="small" label={label} disabled={busy}
                onClick={() => setUploadMode(mode)}
                variant={uploadMode === mode ? "filled" : "outlined"}
                sx={{ fontFamily: F, fontSize: FS.small,
                  bgcolor: uploadMode === mode ? `${C.orange}22` : "transparent",
                  color: uploadMode === mode ? C.orange : C.sub,
                  borderColor: uploadMode === mode ? C.orange : C.border }} />
            ))}
        </Box>
      )}
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
        <IconButton
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          title="Attach a CSV — enrich it, or find contacts at its accounts"
          size="small"
          sx={{ color: C.sub, "&:hover": { color: C.orange, bgcolor: `${C.orange}14` } }}
        >
          <AttachFileIcon fontSize="small" />
        </IconButton>
        <InputBase
          inputRef={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={file
            ? (uploadMode === "contacts"
              ? "Press send to find everyone we hold at these accounts (company_name,domain — up to 25)"
              : "Press send to enrich the file — add a note (optional)")
            : answeringOther ? "Type your answer…"
            : "Ask for accounts or people — or attach a CSV to enrich"}
          multiline
          minRows={centred ? 2 : 1}
          maxRows={6}
          autoFocus
          disabled={busy}
          sx={{ flex: 1, fontFamily: F, fontSize: FS.body, color: C.text }}
        />
        <IconButton
          onClick={onSubmit}
          disabled={busy || (!input.trim() && !file)}
          sx={{ bgcolor: C.orange, color: "#fff", "&:hover": { bgcolor: C.orangeDark }, "&.Mui-disabled": { bgcolor: C.border, color: C.dim } }}
          size="small"
        >
          {busy ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : <ArrowUpwardIcon fontSize="small" />}
        </IconButton>
      </Box>
    </Box>
    {/* One line; the CSV limits live in the tooltip rather than under every prompt. */}
    <Tooltip arrow placement="top"
      title="Attach a CSV (📎) to enrich up to 20 rows, or upload an account list (company_name,domain) to get everyone we hold at up to 25 accounts.">
      <Typography noWrap sx={{ mt: 1, color: C.dim, fontSize: FS.caption, fontFamily: F, cursor: "help", width: "fit-content" }}>
        Searches ISAC and Apollo with the Advanced Search filters · 📎 attach a CSV to enrich or find contacts ⓘ
      </Typography>
    </Tooltip>
    </>
  );

  return (
    <Box sx={{ height: "100%", display: "flex", position: "relative", bgcolor: C.bg, fontFamily: F }}>
    <ThreadList
      threads={threads} activeId={sessionId} retentionDays={retentionDays}
      open={threadsOpen} busy={busy}
      onNew={newChat} onOpen={openThread} onDelete={deleteThread}
    />
    <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      {/* Narrow screens: the thread list is behind a button. */}
      <Box sx={{ display: { xs: "flex", md: "none" }, gap: 1, px: 2, pt: 1 }}>
        <Button size="small" startIcon={<HistoryIcon sx={{ fontSize: 16 }} />}
          onClick={() => setThreadsOpen((v) => !v)}
          sx={{ fontFamily: F, textTransform: "none", color: C.sub }}>
          {threadsOpen ? "Hide conversations" : "Conversations"}
        </Button>
        <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={newChat}
          disabled={busy} sx={{ fontFamily: F, textTransform: "none", color: C.orange }}>
          New chat
        </Button>
      </Box>
      {messages.length === 0 ? (
        // Empty: everything centred, Claude-style — greeting, the composer in the
        // middle, then the suggestions. The first send docks it at the bottom.
        <Box sx={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column",
          justifyContent: "center", px: { xs: 2, md: 6 }, pb: "8vh" }}>
          <Box sx={{ width: "100%", maxWidth: 720, mx: "auto" }}>
            <Greeting />
            {composer(true)}
            <Suggestions onPick={send} />
          </Box>
        </Box>
      ) : (
        <>
          {/* Conversation */}
          <Box sx={{ flex: 1, overflow: "auto", px: { xs: 2, md: 6 }, py: 3 }}>
            <Box sx={{ maxWidth: 860, mx: "auto" }}>
              {messages.map((m) => <MessageBubble key={m.id} msg={m} onRate={rate} api={api} apiGet={apiGet}
                onShowResults={showResults} onAddRows={addRows} onRetry={busy ? undefined : retry} />)}
              <div ref={bottomRef} />
            </Box>
          </Box>
          {/* Composer, docked — slides up into place after the first message. */}
          <Box sx={{
            borderTop: `1px solid ${C.border}`, bgcolor: C.panel, px: { xs: 2, md: 6 }, py: 1.5,
            "@keyframes composerDock": { from: { opacity: 0, transform: "translateY(-24px)" }, to: { opacity: 1, transform: "none" } },
            animation: "composerDock .28s ease-out",
          }}>
            <Box sx={{ maxWidth: 860, mx: "auto" }}>
              {/* The AI's open question pops up here, right above where you'd type. */}
              {openQuestion && (
                <QuestionCard docked key={openQuestion.msgId}
                  question={openQuestion.q.question} options={openQuestion.q.options}
                  onPick={(o) => answerQuestion(openQuestion.msgId, o)}
                  onOther={openQuestion.q.allow_other ? answerOther : undefined}
                  otherActive={answeringOther}
                  onDismiss={() => dismissQuestion(openQuestion.msgId)} />
              )}
              {composer(false)}
            </Box>
          </Box>
        </>
      )}
    </Box>
    </Box>
  );
}

/** Greeting lines for an empty chat — ISAC's world (intent, signals, pipeline),
 * a few tied to the time of day. `n` is the user's first name, or "" when we
 * don't know it; every line reads naturally either way. */
const GREETINGS: { when?: "morning" | "afternoon" | "evening"; line: (n: string) => string }[] = [
  { when: "morning", line: (n) => `Morning${n ? `, ${n}` : ""} — who's warming up today?` },
  { when: "morning", line: (n) => `Good morning${n ? `, ${n}` : ""}. Which accounts are leaning in?` },
  { when: "afternoon", line: (n) => `Afternoon${n ? `, ${n}` : ""}. Which signals should we chase?` },
  { when: "evening", line: (n) => `Evening${n ? `, ${n}` : ""}. What should the pipeline know by tomorrow?` },
  { line: (n) => `${n ? `${n}, who's` : "Who's"} showing intent today?` },
  { line: (n) => `Which accounts are heating up${n ? `, ${n}` : ""}?` },
  { line: (n) => `Let's find your next hot account${n ? `, ${n}` : ""}.` },
  { line: (n) => `${n ? `${n}, where` : "Where"} should we look for buyers?` },
  { line: (n) => `Ready to turn signals into pipeline${n ? `, ${n}` : ""}?` },
];

function partOfDay(d = new Date()): "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

/** Empty-chat greeting, shown above the centred composer — personal (first
 * name from the sign-in profile, same source as the page header) and picked
 * fresh per visit from lines that fit the time of day. */
function Greeting() {
  const user = useAsgardeoUser();
  // Hidden until the profile resolves, so the line doesn't jump from
  // "Morning —" to "Morning, Sam —" a moment after the page renders.
  const ready = user.ready;
  // No guessing from an email address — "Samf" reads worse than no name.
  const given = (user.givenName || (user.displayName ?? "").split(/\s+/)[0] || "").trim();
  const first = given ? given.charAt(0).toUpperCase() + given.slice(1) : "";
  // Chosen once per mount so the line doesn't change while you type.
  const [pick] = useState(() => {
    const now = partOfDay();
    const pool = GREETINGS.filter((g) => !g.when || g.when === now);
    return pool[Math.floor(Math.random() * pool.length)];
  });

  return (
    <Box sx={{ textAlign: "center", mb: 2.5 }}>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.25, opacity: ready ? 1 : 0, transition: "opacity .25s ease" }}>
        <AutoAwesomeIcon sx={{ fontSize: 26, color: C.orange }} />
        <Typography component="h1" sx={{ fontFamily: F, fontWeight: FW.semibold, fontSize: FS.kpi, color: C.text, letterSpacing: "-0.01em" }}>
          {pick.line(first)}
        </Typography>
      </Box>
      <Typography sx={{ fontFamily: F, color: C.sub, fontSize: FS.body, mt: 0.75 }}>
        Ask about accounts, people or intent — I search ISAC (and Apollo) and show the results.
      </Typography>
    </Box>
  );
}

/** Example prompts under the centred composer. */
function Suggestions({ onPick }: { onPick: (p: string) => void }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "center", mt: 2 }}>
      {EXAMPLES.map((ex) => (
        <Chip
          key={ex}
          label={ex}
          onClick={() => onPick(ex)}
          icon={<SearchIcon sx={{ fontSize: 15 }} />}
          sx={{ fontFamily: F, fontSize: FS.small, bgcolor: C.card, color: C.textMd, border: `1px solid ${C.border}`, "&:hover": { bgcolor: `${C.orange}14` } }}
        />
      ))}
    </Box>
  );
}

/** A single chat turn — user (right) or assistant (left, with tools + tables). */
// ── Lightweight markdown for the assistant's prose ───────────────────────────
// The model writes short prose with **bold** and "- " bullets. Render those
// nicely (plain text showed literal asterisks). A markdown table is handled as a
// fallback only — the prompt tells the model not to emit one (the UI renders the
// results table itself), but if it slips we render it rather than raw pipes.

/** Inline markdown → nodes: **bold**, *italic*, `code`, [text](url). */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    if (m[1] && m[2]) {
      parts.push(<a key={k++} href={m[2]} target="_blank" rel="noopener noreferrer" style={{ color: C.orange, textDecoration: "none" }}>{m[1]}</a>);
    } else if (m[3]) {
      parts.push(<Box key={k++} component="span" sx={{ fontWeight: FW.semibold }}>{m[3]}</Box>);
    } else if (m[4]) {
      parts.push(<Box key={k++} component="span" sx={{ fontStyle: "italic" }}>{m[4]}</Box>);
    } else if (m[5]) {
      parts.push(<Box key={k++} component="span" sx={{ fontFamily: "monospace", fontSize: "0.85em", px: 0.5, borderRadius: 0.5, bgcolor: `${C.text}14` }}>{m[5]}</Box>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={k++}>{text.slice(last)}</span>);
  return parts.length ? parts : [<span key={0}>{text}</span>];
}

/** Fallback renderer for a stray markdown table in the prose. */
function MdTable({ rows }: { rows: string[] }) {
  const cells = (r: string) => r.trim().slice(1, -1).split("|").map((c) => c.trim());
  const header = cells(rows[0]);
  const body = rows.slice(1).filter((r) => !/^\|[\s:|-]+\|$/.test(r.trim())).map(cells);
  return (
    <TableContainer sx={{ my: 1, border: `1px solid ${C.border}`, borderRadius: 0, bgcolor: C.panel, overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: C.card }}>
            {header.map((h, i) => <TableCell key={i} sx={{ fontFamily: F, fontWeight: FW.semibold, fontSize: FS.small, color: C.textMd, borderColor: C.border, whiteSpace: "nowrap" }}>{renderInline(h)}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {body.map((r, ri) => <TableRow key={ri} hover>{r.map((c, ci) => <TableCell key={ci} sx={cellSx}>{renderInline(c)}</TableCell>)}</TableRow>)}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Render assistant prose: paragraphs, bullet lists, inline formatting, tables. */
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  const isTableRow = (s: string) => s.trim().startsWith("|") && s.trim().endsWith("|");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    if (isTableRow(lines[i])) {
      const tbl: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) { tbl.push(lines[i]); i++; }
      if (tbl.length >= 2) { blocks.push(<MdTable key={key++} rows={tbl} />); continue; }
    }
    if (/^\s*[-*]\s+/.test(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
      blocks.push(
        <Box key={key++} component="ul" sx={{ m: 0, pl: 2.5, my: 0.5, "& li": { mb: 0.25 } }}>
          {items.map((it, j) => <Box key={j} component="li" sx={{ fontFamily: F, fontSize: FS.body, color: C.text, lineHeight: 1.55 }}>{renderInline(it)}</Box>)}
        </Box>,
      );
      continue;
    }
    blocks.push(
      <Typography key={key++} sx={{ fontFamily: F, fontSize: FS.body, color: C.text, lineHeight: 1.6, mb: 0.75 }}>{renderInline(lines[i])}</Typography>,
    );
    i++;
  }
  return <>{blocks}</>;
}

function MessageBubble({ msg, onRate, api, apiGet, onShowResults, onAddRows, onRetry }: {
  msg: ChatMessage;
  api: ApiPost;
  apiGet: ApiGet;
  onShowResults: (msgId: number, step: TraceStep) => Promise<void>;
  onAddRows: (msgId: number, block: RowsBlock) => void;
  onRate: (msgId: number, turnId: string, value: number, current: number | null) => void;
  /** Re-sends a failed answer's prompt; absent while another answer is in flight. */
  onRetry?: (msg: ChatMessage) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <Box sx={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", mb: 2.5 }}>
      {!isUser && (
        <Avatar sx={{ bgcolor: `${C.orange}1f`, color: C.orange, width: 30, height: 30, mr: 1.5, mt: 0.5 }}>
          <AutoAwesomeIcon sx={{ fontSize: 17 }} />
        </Avatar>
      )}
      <Box sx={{ maxWidth: isUser ? "78%" : "100%", minWidth: 0 }}>
        {isUser ? (
          <Box sx={{ bgcolor: C.orange, color: "#fff", px: 2, py: 1.25, borderRadius: 3, borderTopRightRadius: 6 }}>
            <Typography sx={{ fontFamily: F, fontSize: FS.body, whiteSpace: "pre-wrap" }}>{msg.text}</Typography>
          </Box>
        ) : (
          <>
            {/* A question shows as its own card, not as a step in the trace. */}
            {msg.steps.some((st) => st.tool !== "ask_user")
              && <Trace steps={msg.steps.filter((st) => st.tool !== "ask_user")} />}
            {msg.reasoning && <Reasoning text={msg.reasoning} />}
            {msg.text && (msg.streaming
              // Still streaming: this may yet be reasoning, so keep it quiet.
              ? <Box sx={{ "& p, & li": { color: C.sub } }}><Markdown text={msg.text} /></Box>
              : <Answer text={msg.text} />)}
            {msg.streaming && !msg.text && (
              <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.sub, fontStyle: "italic" }}>Thinking…</Typography>
            )}
            {msg.restored && <RestoredResults msg={msg} onShow={onShowResults} />}
            {msg.contactChoice && (
              <ContactSourceCard msgId={msg.id} choice={msg.contactChoice} api={api} onAddRows={onAddRows} />
            )}
            {msg.rows.map((r, i) => (r.kind === "discovered_contacts"
              ? <DiscoveredContactsTable key={i} block={r} />
              : <ResultsTable key={i} block={r} api={api} />))}
            {(msg.actions ?? []).map((a, i) =>
              a.action === "save_apollo_list" ? <ApolloListConfirm key={i} proposal={a} api={api} />
              : a.action.startsWith("enrich_") ? <EnrichConfirm key={i} proposal={a} api={api} apiGet={apiGet} />
              : null)}
            {msg.error && (
              <Alert severity="error" sx={{ mt: 1, fontFamily: F }}
                action={onRetry && msg.prompt && !msg.streaming ? (
                  <Button size="small" color="inherit" onClick={() => onRetry(msg)}
                    sx={{ textTransform: "none", fontFamily: F, fontWeight: FW.semibold }}>
                    Retry
                  </Button>
                ) : undefined}>
                {msg.error}
              </Alert>
            )}
            {!msg.streaming && msg.turnId && (
              <Box sx={{ display: "flex", gap: 0.5, mt: 0.75 }}>
                {([1, -1] as const).map((v) => (
                  <IconButton key={v} size="small" aria-label={v === 1 ? "Good answer" : "Bad answer"}
                    onClick={() => onRate(msg.id, msg.turnId!, v, msg.rating ?? null)}
                    sx={{ color: msg.rating === v ? C.orange : C.sub, p: 0.4 }}>
                    {v === 1 ? <ThumbUpIcon sx={{ fontSize: 14 }} /> : <ThumbDownIcon sx={{ fontSize: 14 }} />}
                  </IconButton>
                ))}
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

/** The answer: its first paragraph is the stand-alone summary (the prompt asks
 * for one), shown as a highlighted card; the rest follows as normal text. */
function Answer({ text }: { text: string }) {
  const trimmed = text.trim();
  const cut = trimmed.indexOf("\n\n");
  const summary = cut === -1 ? trimmed : trimmed.slice(0, cut);
  const rest = cut === -1 ? "" : trimmed.slice(cut + 2).trim();
  return (
    <>
      <Box sx={{
        px: 1.75, py: 1.25, mb: rest ? 1.25 : 0, borderRadius: "10px",
        bgcolor: `${C.orange}0f`, borderLeft: `3px solid ${C.orange}`,
        "& p, & li": { fontSize: FS.body, fontWeight: FW.medium, color: C.text },
        "& p": { m: 0 },
      }}>
        <Markdown text={summary} />
      </Box>
      {rest && <Markdown text={rest} />}
    </>
  );
}

/** The model's narration between tool calls — kept (useful for checking its
 * work) but collapsed and dimmed, so it never competes with the answer. */
function Reasoning({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ mb: 1.25 }}>
      <Typography component="button" type="button" onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        sx={{
          fontFamily: F, fontSize: FS.small, color: C.sub, background: "none", border: 0, p: 0,
          cursor: "pointer", "&:hover": { color: C.orange },
        }}>
        {open ? "Hide reasoning" : "Show reasoning"}
      </Typography>
      {open && (
        <Box sx={{
          mt: 0.75, pl: 1.5, borderLeft: `2px solid ${C.border}`, color: C.sub,
          "& p, & li": { fontSize: FS.body, color: C.sub, fontStyle: "italic" },
        }}>
          <Markdown text={text} />
        </Box>
      )}
    </Box>
  );
}

/** What the agent actually did, step by step.
 *
 * Collapsed to one line per call by default — enough to see which filters
 * produced the list without burying the answer — and expands to the full filter
 * set. This is recorded by the backend as it executes, so unlike the model's own
 * description of its work it cannot be wrong. */
function Trace({ steps }: { steps: TraceStep[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ mb: 1, borderLeft: `2px solid ${C.border}`, pl: 1 }}>
      {steps.map((s, i) => {
        const filters = fmtFilters(s.input);
        const label = TOOL_LABELS[s.tool] ?? s.tool;
        return (
          <Box key={i} sx={{ display: "flex", alignItems: "baseline", gap: 0.75, flexWrap: "wrap", py: 0.2 }}>
            <SearchIcon sx={{ fontSize: 12, color: C.sub, position: "relative", top: 2 }} />
            <Typography component="span" sx={{ fontFamily: F, fontSize: FS.caption, color: C.text, fontWeight: FW.semibold }}>
              {label}
            </Typography>
            {filters.length > 0 && (
              <Typography component="span" sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>
                {open ? filters.join(" · ") : `${filters.length} filter${filters.length === 1 ? "" : "s"}`}
              </Typography>
            )}
            {s.error ? (
              <Typography component="span" sx={{ fontFamily: F, fontSize: FS.caption, color: C.pink }}>
                — failed
              </Typography>
            ) : s.done ? (
              <Typography component="span" sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub }}>
                {/* Non-search tools (enrichment, CSV) report no total — showing
                    "0 results" there would contradict the answer beneath it. A
                    search that genuinely matched nothing has total === 0. */}
                {s.total != null ? `— ${s.total} result${s.total === 1 ? "" : "s"}` : "— done"}
                {s.ms != null && ` · ${(s.ms / 1000).toFixed(1)}s`}
              </Typography>
            ) : (
              <Typography component="span" sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, fontStyle: "italic" }}>
                — running…
              </Typography>
            )}
          </Box>
        );
      })}
      {steps.some((s) => fmtFilters(s.input).length > 0) && (
        <Button size="small" onClick={() => setOpen((v) => !v)}
          sx={{ fontFamily: F, fontSize: FS.micro, color: C.sub, textTransform: "none", minWidth: 0, p: 0, mt: 0.25 }}>
          {open ? "Hide filters" : "Show filters"}
        </Button>
      )}
    </Box>
  );
}

/** Apollo saves make ~1 provider call per company, so chunks stay well inside
 * the 120s gateway budget — the same size the Advanced Search page uses. */
const APOLLO_CHUNK = 10;

/** The agent proposed an Apollo list; nothing is written until this is confirmed.
 *
 * Confirm re-runs the proposal's exact filters for the full set, then saves in
 * chunks through the existing /prospect-search/save-apollo-list endpoint, keeping
 * a running tally so a mid-run failure still reports what made it through. */
function ApolloListConfirm({ proposal, api }: { proposal: ProposedAction; api: ApiPost }) {
  type Phase = "pending" | "saving" | "done" | "cancelled" | "error";
  const [phase, setPhase] = useState<Phase>("pending");
  const [message, setMessage] = useState("");

  const confirm = async () => {
    setPhase("saving");
    let created = 0;
    let failed = 0;
    try {
      setMessage("Collecting the companies…");
      const r = await api<{ items: { name?: string; domain?: string }[] }>(
        "/api/v1/ask/resolve",
        { tool: "search_accounts", input: proposal.filters, cap: proposal.will_save });
      const rows = r.items.filter((c) => (c.name ?? "").trim());
      for (let i = 0; i < rows.length; i += APOLLO_CHUNK) {
        const chunk = rows.slice(i, i + APOLLO_CHUNK);
        setMessage(`Saving to Apollo… ${Math.min(i + chunk.length, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`);
        const saved = await api<{ created: number; failed: unknown[] }>(
          "/api/v1/prospect-search/save-apollo-list",
          { name: proposal.name, companies: chunk.map((c) => ({ name: c.name, domain: c.domain || undefined })) });
        created += saved.created;
        failed += saved.failed.length;
      }
      setPhase("done");
      setMessage(`Saved ${created.toLocaleString()} companies to "${proposal.name}" in Apollo`
        + (failed ? ` · ${failed.toLocaleString()} couldn't be saved.` : "."));
    } catch (e) {
      // Scope, auth and rate-limit errors won't fix themselves mid-run — stop,
      // and report what made it through.
      const detail = e instanceof Error ? e.message : "Saving to Apollo failed.";
      setPhase("error");
      setMessage(created ? `Saved ${created.toLocaleString()} before failing: ${detail}` : detail);
    }
  };

  return (
    <Box sx={{ mt: 1.5, p: 1.5, border: `1px solid ${C.border}`, borderRadius: 2, bgcolor: C.card }}>
      <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.text, mb: phase === "pending" ? 1 : 0.5 }}>
        Save <b>{proposal.will_save.toLocaleString()}</b> {proposal.will_save === 1 ? "company" : "companies"} to
        the Apollo list <b>“{proposal.name}”</b>?
        {proposal.total > proposal.will_save && ` (${proposal.total.toLocaleString()} match — the first ${proposal.will_save.toLocaleString()} will be saved.)`}
      </Typography>
      {phase === "pending" && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" variant="contained" onClick={confirm}
            sx={{ fontFamily: F, textTransform: "none", bgcolor: C.orange, "&:hover": { bgcolor: C.orange } }}>
            Save to Apollo
          </Button>
          <Button size="small" onClick={() => { setPhase("cancelled"); setMessage("Not saved."); }}
            sx={{ fontFamily: F, textTransform: "none", color: C.sub }}>
            Cancel
          </Button>
        </Box>
      )}
      {phase !== "pending" && (
        <Typography sx={{ fontFamily: F, fontSize: FS.small, color: phase === "error" ? C.pink : C.sub,
          display: "flex", alignItems: "center", gap: 1 }}>
          {phase === "saving" && <CircularProgress size={12} />}{message}
        </Typography>
      )}
    </Box>
  );
}

/** A question with its answers as rows: the recommended one first and marked,
 * each with a line on what it does, and optionally "Something else…".
 *
 * Docked above the composer for the AI's questions (it pops up where you'd
 * type); inline in a message for an upload's own choices. */
function QuestionCard({ question, options, onPick, onOther, otherActive, onDismiss, docked, isDisabled }: {
  question: string;
  options: QuestionOption[];
  onPick: (o: QuestionOption) => void;
  onOther?: () => void;
  otherActive?: boolean;
  onDismiss?: () => void;
  docked?: boolean;
  isDisabled?: (o: QuestionOption) => boolean;
}) {
  const row = {
    display: "flex", alignItems: "flex-start", justifyContent: "flex-start", gap: 1.25, width: "100%", textAlign: "left",
    px: 1.25, py: 0.9, borderRadius: 1.5, border: `1px solid ${C.border}`, fontFamily: F,
    transition: "background-color .12s, border-color .12s",
    "&:hover": { bgcolor: `${C.orange}0d`, borderColor: `${C.orange}66` },
    "&.Mui-disabled": { opacity: 0.5 },
  } as const;
  const badge = (n: string, on: boolean) => (
    <Box sx={{ flex: "0 0 auto", width: 20, height: 20, mt: "1px", borderRadius: "6px", display: "grid", placeItems: "center",
      fontSize: FS.caption, fontWeight: FW.semibold, color: on ? "#fff" : C.sub, bgcolor: on ? C.orange : C.card }}>{n}</Box>
  );
  return (
    <Box role="group" aria-label={question} sx={{
      mb: docked ? 1.25 : 0, mt: docked ? 0 : 1.5, p: 1.5, borderRadius: 2,
      border: `1px solid ${docked ? `${C.orange}55` : C.border}`, bgcolor: C.panel,
      boxShadow: docked ? "0 6px 24px rgba(0,0,0,0.08)" : "none",
      "@keyframes questionUp": { from: { opacity: 0, transform: "translateY(10px)" }, to: { opacity: 1, transform: "none" } },
      animation: docked ? "questionUp .22s ease-out" : undefined,
    }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
        <AutoAwesomeIcon sx={{ fontSize: 16, color: C.orange, mt: "2px" }} />
        <Typography sx={{ flex: 1, fontFamily: F, fontSize: FS.reading, fontWeight: FW.semibold, color: C.text }}>
          {question}
        </Typography>
        {onDismiss && (
          <IconButton size="small" aria-label="Close question" onClick={onDismiss} sx={{ color: C.sub, p: 0.25 }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        {options.map((o, i) => (
          <ButtonBase key={i} onClick={() => onPick(o)} disabled={isDisabled?.(o)}
            sx={{ ...row, ...(o.recommended ? { borderColor: `${C.orange}88`, bgcolor: `${C.orange}0a` } : {}) }}>
            {badge(String(i + 1), !!o.recommended)}
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                <Typography component="span" sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.medium, color: C.text }}>
                  {o.label}
                </Typography>
                {o.recommended && (
                  <Chip size="small" label="Recommended"
                    sx={{ height: 18, fontSize: FS.micro, fontFamily: F, fontWeight: FW.semibold, color: C.orange, bgcolor: `${C.orange}1a` }} />
                )}
              </Box>
              {o.description && (
                <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, mt: 0.25 }}>{o.description}</Typography>
              )}
            </Box>
          </ButtonBase>
        ))}
        {onOther && (
          <ButtonBase onClick={onOther} sx={{ ...row, borderStyle: "dashed", ...(otherActive ? { borderColor: C.orange } : {}) }}>
            {badge("…", false)}
            <Box>
              <Typography component="span" sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.medium, color: C.text }}>
                Something else
              </Typography>
              <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, mt: 0.25 }}>
                {otherActive ? "Type your answer in the box below." : "If you see it differently, tell me in your own words."}
              </Typography>
            </Box>
          </ButtonBase>
        )}
      </Box>
    </Box>
  );
}

/** What the provider search returns — the Contacts tab's decision-maker titles,
 * ranked, top 10 per account (see account_contacts.discover_contacts_for_accounts). */
const DISCOVERY_SCOPE_NOTE = "decision-makers, best 10 per account";

/** After an account-list upload: who we already hold is known (free), and the
 * user chooses what to see — those Salesforce contacts, an Apollo search for the
 * accounts with no one, or Apollo for all of them. Each choice adds its own table
 * below, so they can have both. */
function ContactSourceCard({ msgId, choice, api, onAddRows }: {
  msgId: number; choice: ContactChoice; api: ApiPost;
  onAddRows: (msgId: number, block: RowsBlock) => void;
}) {
  type Phase = "idle" | "loading" | "done" | "error";
  const [shownSf, setShownSf] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [declined, setDeclined] = useState(false);
  const [message, setMessage] = useState("");
  // Which provider searches ran — searching "all" after "the ones with none" is fine.
  const [used, setUsed] = useState<{ missing?: boolean; all?: boolean }>({});
  const base = choice.file.replace(/\.[^.]+$/, "");
  const empty = choice.accounts.filter((a) => a.people === 0);
  const n = choice.accounts.length;

  const showSf = () => {
    setShownSf(true);
    onAddRows(msgId, { tool: "account_contacts", kind: "contacts", total: choice.items.length,
      items: choice.items, filename: `${base}-known-contacts.csv` });
  };

  const searchProviders = async (accounts: UploadAccount[], scope: "missing" | "all") => {
    setUsed((u) => ({ ...u, [scope]: true }));
    setPhase("loading");
    setMessage(`Searching ZoomInfo and Apollo at ${accounts.length} account${accounts.length === 1 ? "" : "s"}…`);
    try {
      const r = await api<{ error?: string; total?: number; items?: Record<string, unknown>[]; note?: string;
        accounts?: { name?: string; domain?: string; status: string; people: number; in_isac: boolean }[] }>(
        "/api/v1/ask/account-contacts/discover",
        { accounts: accounts.map((a) => ({ name: a.name || undefined, domain: a.domain || undefined })) });
      if (r.error) throw new Error(r.error);
      const items = r.items ?? [];
      const missing = (r.accounts ?? []).filter((a) => a.people === 0 && a.status !== "over_budget")
        .map((a) => a.name || a.domain).filter(Boolean);
      const notInIsac = (r.accounts ?? []).filter((a) => a.people > 0 && !a.in_isac).map((a) => a.name || a.domain);
      setPhase("done");
      setMessage(`Found ${items.length.toLocaleString()} ${items.length === 1 ? "person" : "people"} in ZoomInfo and Apollo (${DISCOVERY_SCOPE_NOTE}). `
        + "Tick up to 10 and click Reveal to see the exact credit cost first."
        + (missing.length ? ` Nothing found for: ${missing.join(", ")}.` : "")
        + (notInIsac.length ? ` Not in ISAC, so they can't be revealed from here yet: ${notInIsac.join(", ")}.` : "")
        + (r.note ? ` ${r.note}` : ""));
      if (items.length) {
        onAddRows(msgId, { tool: "account_contacts_discover", kind: "discovered_contacts",
          total: items.length, items, filename: `${base}-new-contacts.csv` });
      }
    } catch (e) {
      setPhase("error");
      setUsed((u) => ({ ...u, [scope]: false }));
      setMessage(e instanceof Error ? e.message : "The contact search failed.");
    }
  };

  const busy = phase === "loading";
  // Same choices, same recommendation as the chat's own question
  // (tools._coverage_reply): fill the gaps first when there are some.
  const gaps = choice.total > 0 && empty.length > 0 && empty.length < n;
  const findDesc = "Free search for decision-makers. Shows who has an email, direct line or mobile; "
    + "revealing them uses credits and you see the cost first.";
  const names = empty.map((a) => a.name || a.domain).filter(Boolean);
  type Opt = QuestionOption & { key: "held" | "missing" | "all" | "no" };
  const options: Opt[] = [];
  if (choice.total > 0) {
    options.push({ key: "held", label: shownSf ? "Shown below" : `Show the ${choice.total.toLocaleString()} we already hold`,
      description: "People we already know — free, and warmer to reach out to.", recommended: !gaps });
  }
  if (gaps) {
    options.push({ key: "missing", label: `Find new people for the ${empty.length} with no one`, recommended: true,
      description: `Fills the gaps at ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}. ${findDesc}` });
  }
  options.push({ key: "all", label: choice.total ? `Find new people at all ${n}` : "Yes, find people",
    description: findDesc, recommended: choice.total === 0 });
  if (!choice.total) options.push({ key: "no", label: "No thanks" });
  options.sort((x, y) => Number(!!y.recommended) - Number(!!x.recommended));

  const pick = (o: QuestionOption) => {
    const key = (o as Opt).key;
    if (key === "held") showSf();
    else if (key === "missing") searchProviders(empty, "missing");
    else if (key === "all") searchProviders(choice.accounts, "all");
    else setDeclined(true);
  };
  const disabled = (o: QuestionOption) => {
    const key = (o as Opt).key;
    return key === "held" ? shownSf
      : key === "missing" ? busy || !!used.missing || !!used.all
      : key === "all" ? busy || !!used.all
      : phase !== "idle";
  };
  return (
    <Box>
      {!declined && (
        <QuestionCard question="Where should the contacts come from?" options={options}
          onPick={pick} isDisabled={disabled} />
      )}
      {declined && (
        <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, mt: 1 }}>Okay — no new search.</Typography>
      )}
      {phase !== "idle" && (
        <Typography sx={{ fontFamily: F, fontSize: FS.small, mt: 1, color: phase === "error" ? C.pink : C.sub,
          display: "flex", alignItems: "center", gap: 1 }}>
          {busy && <CircularProgress size={12} />}{message}
        </Typography>
      )}
    </Box>
  );
}

/** Bucket a timestamp for the sidebar's date headings. */
function dayBucket(iso: string | null): string {
  if (!iso) return "Earlier";
  // Stored as naive UTC; treat it as UTC so local-time grouping is right.
  const then = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const days = Math.floor((start.getTime() - then.getTime()) / 86_400_000) + 1;
  if (then >= start) return "Today";
  if (days <= 1) return "Yesterday";
  if (days <= 7) return "Previous 7 days";
  return "Earlier";
}

/** Saved conversations — reopen one to carry on where you stopped. */
function ThreadList({ threads, activeId, retentionDays, open, busy, onNew, onOpen, onDelete }: {
  threads: ThreadSummary[]; activeId: number | null; retentionDays: number | null;
  open: boolean; busy: boolean;
  onNew: () => void; onOpen: (id: number) => void; onDelete: (id: number) => void;
}) {
  const groups: [string, ThreadSummary[]][] = [];
  for (const t of threads) {
    const b = dayBucket(t.updated_at);
    const g = groups.find(([name]) => name === b);
    if (g) g[1].push(t); else groups.push([b, [t]]);
  }
  return (
    <Box sx={{
      width: 260, flexShrink: 0, borderRight: `1px solid ${C.border}`, bgcolor: C.panel,
      display: { xs: open ? "flex" : "none", md: "flex" }, flexDirection: "column",
      position: { xs: "absolute", md: "static" }, zIndex: { xs: 5, md: "auto" },
      height: "100%", left: 0, top: 0,
    }}>
      <Box sx={{ p: 1.5, pb: 1 }}>
        {/* Same height / radius / surface as the filter pills on the list pages,
            the + in a small orange badge — the old full-width outlined pill with
            orange text read as a different UI. */}
        <Button fullWidth onClick={onNew} disabled={busy} disableElevation
          startIcon={
            <Box component="span" sx={{
              width: 18, height: 18, borderRadius: "5px", bgcolor: C.orange, color: "#fff",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <AddIcon sx={{ fontSize: 14 }} />
            </Box>
          }
          sx={{
            height: 34, px: 1.25, justifyContent: "flex-start", gap: 0.25,
            borderRadius: "8px", border: `1px solid ${C.border}`, bgcolor: C.cardBg,
            fontFamily: F, fontSize: FS.body, fontWeight: FW.medium, textTransform: "none", color: C.text,
            transition: "border-color .15s, background-color .15s",
            "& .MuiButton-startIcon": { mr: 0.75, ml: 0 },
            "&:hover": { borderColor: C.orange, bgcolor: `${C.orange}0d` },
            "&.Mui-disabled": { color: C.dim, "& .MuiButton-startIcon > span": { bgcolor: C.border } },
          }}>
          New chat
        </Button>
      </Box>
      <Box sx={{ flex: 1, overflow: "auto", px: 1, pb: 1 }}>
        {threads.length === 0 && (
          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub, px: 1, py: 2 }}>
            Your conversations will appear here.
          </Typography>
        )}
        {groups.map(([name, items]) => (
          <Box key={name} sx={{ mb: 1 }}>
            <Typography sx={{ fontFamily: F, ...LABEL, color: C.sub, px: 1, pt: 1, pb: 0.5 }}>
              {name}
            </Typography>
            {items.map((t) => (
              <Box key={t.id} onClick={() => !busy && onOpen(t.id)}
                sx={{
                  display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.75, borderRadius: 1.5,
                  cursor: busy ? "default" : "pointer",
                  bgcolor: t.id === activeId ? `${C.orange}1F` : "transparent",
                  "&:hover": { bgcolor: t.id === activeId ? `${C.orange}1F` : C.card },
                  "&:hover .thread-delete": { opacity: 1 },
                }}>
                <Typography title={t.title} sx={{ flex: 1, minWidth: 0, fontFamily: F,
                  ...(t.id === activeId ? ROW.primary : ROW.cell),
                  color: t.id === activeId ? C.text : C.textMd,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.title}
                </Typography>
                <IconButton className="thread-delete" size="small" aria-label="Delete conversation"
                  onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                  sx={{ opacity: { xs: 1, md: 0 }, p: 0.25, color: C.sub, "&:hover": { color: C.pink } }}>
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
      {retentionDays != null && (
        <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, px: 2, py: 1.25,
          borderTop: `1px solid ${C.border}` }}>
          Conversations are kept for {retentionDays} days after you last use them.
        </Typography>
      )}
    </Box>
  );
}

/** A reopened turn: tables weren't stored, so each search can be re-run from
 * its saved filters — today's data, exactly the search that ran then. */
function RestoredResults({ msg, onShow }: {
  msg: ChatMessage; onShow: (msgId: number, step: TraceStep) => Promise<void>;
}) {
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Per search, not per turn: a turn can run several, and showing one must
  // leave the others available.
  const [shown, setShown] = useState<Set<number>>(new Set());
  const searches = msg.steps
    .map((st, i) => ({ st, i }))
    .filter(({ st, i }) => !shown.has(i) && !st.error
      && (st.tool === "search_accounts" || st.tool === "search_people"));
  if (!searches.length) return null;
  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1, alignItems: "center" }}>
      {searches.map(({ st, i }) => (
        <Button key={i} size="small" variant="outlined" disabled={loading !== null}
          startIcon={loading === i ? <CircularProgress size={12} /> : <SearchIcon sx={{ fontSize: 14 }} />}
          onClick={async () => {
            setLoading(i); setError(null);
            try { await onShow(msg.id, st); setShown((prev) => new Set(prev).add(i)); }
            catch (e) { setError(e instanceof Error ? e.message : "Couldn't load results."); }
            finally { setLoading(null); }
          }}
          sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", color: C.textMd, borderColor: C.border }}>
          Show {TOOL_LABELS[st.tool]?.replace("Searched ", "") ?? "results"}
          {st.total != null ? ` (${st.total.toLocaleString()})` : ""}
        </Button>
      ))}
      {error && <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.pink }}>{error}</Typography>}
    </Box>
  );
}

/** How often a running enrichment is polled, and for how long. */
const ENRICH_POLL_MS = 3000;
const ENRICH_POLL_MAX = 200;          // ~10 minutes

/** The agent proposed enriching some records; nothing runs until this is confirmed.
 *
 * Confirm starts ISAC's own background enrichment — /lead-enrichment/bulk or
 * /company-enrichment/progressive — which fills empty fields only, saves to ISAC
 * and applies its usual rate limits and opt-out checks; then polls its progress. */
function EnrichConfirm({ proposal, api, apiGet }: { proposal: ProposedAction; api: ApiPost; apiGet: ApiGet }) {
  type Phase = "pending" | "running" | "done" | "cancelled" | "error";
  const [phase, setPhase] = useState<Phase>("pending");
  const [message, setMessage] = useState("");
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const leads = proposal.target === "leads";
  const noun = (n: number) => (leads ? (n === 1 ? "lead" : "leads") : (n === 1 ? "account" : "accounts"));
  const count = proposal.count ?? proposal.ids?.length ?? 0;

  const confirm = async () => {
    setPhase("running");
    setMessage("Starting…");
    try {
      const base = leads ? "/api/v1/lead-enrichment/bulk" : "/api/v1/company-enrichment/progressive";
      const started = await api<{ run_id: string }>(base,
        leads ? { lead_ids: proposal.ids } : { company_ids: proposal.ids });
      for (let i = 0; i < ENRICH_POLL_MAX && alive.current; i += 1) {
        await new Promise((r) => setTimeout(r, ENRICH_POLL_MS));
        // The status endpoints return get_sync_run(), which spreads the run's
        // detail (done / total / counts) onto the top level — there is no nested
        // `detail` (same shape Leads.tsx and ProspectSearch.tsx poll).
        const run = await apiGet<{ status: string; error?: string; done?: number;
          total?: number; counts?: Record<string, number> }>(`${base}/${started.run_id}`);
        const d = run;
        if (run.status === "running") {
          setMessage(`Enriching… ${d.done ?? 0} / ${d.total ?? count}`);
          continue;
        }
        if (run.status === "done") {
          const c = d.counts;
          setPhase("done");
          setMessage(c
            ? `Filled in details for ${c.applied ?? 0} of ${d.total ?? count} ${noun(d.total ?? count)}`
              + (c.no_data ? ` · ${c.no_data} had nothing new` : "")
              + (c.ineligible ? ` · ${c.ineligible} not eligible` : "")
              + (c.skipped_optout ? ` · ${c.skipped_optout} skipped (opted out)` : "")
              + (c.failed ? ` · ${c.failed} failed` : "") + ". Saved to ISAC."
            : `Enriched ${d.done ?? count} ${noun(d.done ?? count)}. Saved to ISAC.`);
          return;
        }
        if (run.status === "interrupted") {
          setPhase("error");
          setMessage("The run was interrupted (a server restart). ISAC resumes interrupted runs — check the records again shortly.");
          return;
        }
        throw new Error(run.error || "Enrichment failed.");
      }
      if (alive.current) {
        setPhase("done");
        setMessage("Still running in the background — results are saved to ISAC as each record finishes.");
      }
    } catch (e) {
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "Enrichment failed.");
    }
  };

  return (
    <Box sx={{ mt: 1.5, p: 1.5, border: `1px solid ${C.border}`, borderRadius: 2, bgcolor: C.card }}>
      <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.text, mb: 0.5 }}>
        Enrich <b>{count}</b> {noun(count)}? Fills in <b>empty fields only</b> and saves to ISAC.
        Uses provider credits.
      </Typography>
      {!!proposal.labels?.length && (
        <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
          {proposal.labels.join(", ")}{count > proposal.labels.length ? `, +${count - proposal.labels.length} more` : ""}
        </Typography>
      )}
      {!!proposal.skipped_optout && (
        <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
          {proposal.skipped_optout} opted-out {noun(proposal.skipped_optout)} will be skipped.
        </Typography>
      )}
      {phase === "pending" && (
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <Button size="small" variant="contained" onClick={confirm}
            sx={{ fontFamily: F, textTransform: "none", bgcolor: C.orange, "&:hover": { bgcolor: C.orange } }}>
            Enrich {count} {noun(count)}
          </Button>
          <Button size="small" onClick={() => { setPhase("cancelled"); setMessage("Not enriched."); }}
            sx={{ fontFamily: F, textTransform: "none", color: C.sub }}>
            Cancel
          </Button>
        </Box>
      )}
      {phase !== "pending" && (
        <Typography sx={{ fontFamily: F, fontSize: FS.small, mt: 0.75, color: phase === "error" ? C.pink : C.sub,
          display: "flex", alignItems: "center", gap: 1 }}>
          {phase === "running" && <CircularProgress size={12} />}{message}
        </Typography>
      )}
    </Box>
  );
}

/** Serialise result items to CSV — the full field set (every key across rows),
 * not just the columns shown in the table, so "give me their details" exports
 * everything the search returned. */
/** Add full ISAC links to export rows, so they're clickable in Excel/Sheets.
 *
 * Uses the same rules as the table (ISAC rows only; a contact that was never a
 * lead gets a company link only). A column is added only when at least one row
 * has a link, so Apollo and enrichment exports don't gain an empty column. */
function withIsacLinks(items: Record<string, unknown>[], kind?: string): Record<string, unknown>[] {
  const abs = (href?: string) => (href ? new URL(href, window.location.origin).toString() : undefined);
  const companyRows = COMPANY_ROW_KINDS.has(kind ?? "");
  const rows = items.map((it) => ({
    it,
    lead: companyRows ? undefined : abs(leadHref(it)),
    company: abs(companyHref(it, companyRows)),
  }));
  const anyLead = rows.some((r) => r.lead);
  const anyCompany = rows.some((r) => r.company);
  if (!anyLead && !anyCompany) return items;
  return rows.map(({ it, lead, company }) => ({
    ...it,
    ...(anyLead ? { isac_lead_url: lead ?? "" } : {}),
    ...(anyCompany ? { isac_company_url: company ?? "" } : {}),
  }));
}

function itemsToCsv(items: Record<string, unknown>[]): string {
  if (!items.length) return "";
  const keys: string[] = [];
  for (const it of items) {
    for (const k of Object.keys(it)) {
      // `_`-prefixed keys are UI bookkeeping (e.g. which cells enrichment filled).
      if (!k.startsWith("_") && !keys.includes(k)) keys.push(k);
    }
  }
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    // A list reads as "a; b; c" in a spreadsheet, not as JSON.
    let s = Array.isArray(v) ? v.map(String).join("; ")
      : typeof v === "object" ? JSON.stringify(v) : String(v);
    // CSV formula-injection guard: a cell beginning with = + - @ (or a leading
    // tab/CR) can execute as a formula when the file is opened in Excel/Sheets.
    // These values are round-tripped from user-uploaded CSVs, so neutralise them
    // by prefixing an apostrophe.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = keys.map(esc).join(",");
  const rows = items.map((it) => keys.map((k) => esc(it[k])).join(","));
  return [header, ...rows].join("\n");
}

/** Trigger a client-side download of the given text as a file. */
function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8;"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Render one Advanced Search results block as a compact table with CSV export. */
// ── Presentation framework ───────────────────────────────────────────────────
// Any tool that returns a list of JSON objects renders as a table for free.
// Columns come from (in priority order): the backend `columns` hint → a default
// spec for the result `kind` → inference from the item keys. Cell rendering is
// driven by a small type registry, so a new field type is added once here and
// every tool benefits.

/** "city, state, country" — the common location roll-up. */
const locOf = (it: Record<string, unknown>) =>
  [it.city, it.state, it.country].filter(Boolean).join(", ");

/** Default column specs per result kind. Omit a kind → columns are inferred. */
/** A cell that opens an ISAC page in a new tab; falls back to plain text. */
interface LinkValue { text: unknown; href?: string }

const isIsac = (it: Record<string, unknown>) =>
  typeof it.source === "string" && it.source.toLowerCase().startsWith("isac");

/** ISAC company page. Only ISAC rows: an Apollo row's id is Apollo's, and
 * linking it would open an unrelated ISAC record. */
function companyHref(it: Record<string, unknown>, rowIsCompany = false): string | undefined {
  const id = it.isac_company_id ?? (isIsac(it) ? (rowIsCompany ? it.id : it.company_id) : undefined);
  return id ? isacPath(`/companies/${id}`) : undefined;
}

/** ISAC lead page. /leads/:id opens a Salesforce lead (sf_leads) row; search
 * results expose that id as `id`, other tools as `isac_lead_id`. A contact that
 * was never a lead has no page, so it gets no link. */
function leadHref(it: Record<string, unknown>): string | undefined {
  const id = it.isac_lead_id !== undefined ? it.isac_lead_id : (it.source === "isac" ? it.id : undefined);
  return id ? isacPath(`/leads/${id}`) : undefined;
}

/** Result kinds whose rows ARE companies: their `id` is a company id, so it must
 * never be read as a lead id. */
const COMPANY_ROW_KINDS = new Set(["accounts", "movers"]);

const signed = (n: unknown) => (typeof n === "number" ? (n > 0 ? `+${n}` : String(n)) : n);

/** Apollo's seniority codes ("c_suite", "vp") as people say them. */
const seniorityLabel = (v: unknown) => {
  if (typeof v !== "string" || !v) return v;
  const special: Record<string, string> = { c_suite: "C-suite", vp: "VP" };
  return special[v] ?? v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

const fullName = (it: Record<string, unknown>) =>
  [it.first_name, it.last_name].filter(Boolean).join(" ") || it.name;

const COLUMN_SPECS: Record<string, ColumnSpec[]> = {
  movers: [
    { label: "Company", type: "link", get: (it) => ({ text: it.name, href: companyHref(it, true) }) },
    { label: "Change", type: "text", get: (it) => signed(it.change) },
    { label: "Intent now", type: "score", get: (it) => it.intent_now },
    { label: "Stage", type: "stage", get: (it) => it.stage_now },
    { label: "Heat", type: "tier", get: (it) => it.heat_now },
    {
      label: "Driven by", type: "text",
      get: (it) => {
        const ds = (it.drivers as { source: string; change?: number; now?: number }[] | undefined) ?? [];
        if (it.drivers_basis === "not_recorded") return "not recorded";
        return ds.map((d) => `${d.source} ${d.change !== undefined ? signed(d.change) : `(${d.now} now)`}`)
          .join(", ") || "—";
      },
    },
    {
      label: "Caveat", type: "text",
      get: (it) => ((it.stale_sources_involved as string[] | undefined) ?? []).length
        ? `stale feed: ${(it.stale_sources_involved as string[]).join(", ")}` : "",
    },
    { label: "Location", type: "text", get: locOf },
  ],
  accounts: [
    { label: "Company", type: "link", get: (it) => ({ text: it.name, href: companyHref(it, true) }) },
    { label: "Intent", type: "score", get: (it) => it.intent_score },
    { label: "Stage", type: "stage", get: (it) => it.funnel_stage },
    { label: "Heat", type: "tier", get: (it) => it.heat_tier },
    { label: "Buying stage", type: "stage", get: (it) => it.buying_stage },
    { label: "Industry", type: "text", get: (it) => it.industry },
    { label: "Location", type: "text", get: locOf },
  ],
  contacts: [
    { label: "Account", type: "link", get: (it) => ({ text: it.account_name, href: companyHref(it) }) },
    { label: "Name", type: "link", get: (it) => ({ text: fullName(it), href: leadHref(it) }) },
    { label: "Title", type: "text", get: (it) => it.job_title },
    { label: "Email", type: "text", get: (it) => it.email },
    { label: "Source", type: "text", get: (it) => it.source },
    { label: "Stage", type: "stage", get: (it) => it.lead_stage },
    { label: "Matched on", type: "text", get: (it) => it.matched_on },
  ],
  people: [
    { label: "Name", type: "link", get: (it) => ({ text: fullName(it), href: leadHref(it) }) },
    { label: "Title", type: "text", get: (it) => it.job_title || it.title },
    { label: "Seniority", type: "text", get: (it) => it.seniority },
    { label: "Company", type: "link", get: (it) => ({ text: it.company_name || it.company, href: companyHref(it) }) },
    { label: "Source", type: "text", get: (it) => it.source },
    { label: "Location", type: "text", get: locOf },
  ],
};

/** snake_case / camelCase key → "Title Case" label. */
function humanize(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Infer a cell type from a key name and its sample values. */
function guessType(key: string, values: unknown[]): CellType {
  const k = key.toLowerCase();
  if (k === "url" || k === "domain" || k.endsWith("_url")) return "url";
  if (k.includes("score")) return "score";
  if (k === "heat_tier" || k === "heat") return "tier";
  if (k.includes("stage")) return "stage";
  const sample = values.find((v) => v !== null && v !== undefined);
  if (typeof sample === "number") return "number";
  if (typeof sample === "boolean") return "boolean";
  if (Array.isArray(sample)) return "tags";
  if (typeof sample === "string" && /^\d{4}-\d{2}-\d{2}/.test(sample)) return "date";
  return "text";
}

/** Build columns from the item keys when no spec is available. Hides id-like keys. */
function inferColumns(items: Record<string, unknown>[]): ColumnSpec[] {
  const keys: string[] = [];
  for (const it of items) {
    for (const k of Object.keys(it)) {
      if (!keys.includes(k)) keys.push(k);
    }
  }
  return keys
    .filter((k) => k !== "id" && !k.endsWith("_id") && !k.startsWith("_"))
    // A nested object has no sensible cell; it is still in the CSV.
    .filter((k) => !items.some((it) => it[k] !== null && typeof it[k] === "object" && !Array.isArray(it[k])))
    .map((k) => ({ label: humanize(k), type: guessType(k, items.map((it) => it[k])), get: (it: Record<string, unknown>) => it[k] }));
}

/** Resolve the columns to render: backend hint → kind default → inference. */
function resolveColumns(block: RowsBlock): ColumnSpec[] {
  if (block.columns?.length) {
    return block.columns.map((c) => ({
      label: c.label,
      key: c.key,
      type: (c.type as CellType) || "text",
      get: (it: Record<string, unknown>) => it[c.key],
    }));
  }
  const kind = block.kind || (block.tool === "search_people" ? "people" : "accounts");
  return COLUMN_SPECS[kind] ?? inferColumns(block.items);
}

/** Render a single value according to its cell type. */
function GenericCell({ type, value }: { type: CellType; value: unknown }) {
  if (type === "link" && value && typeof value === "object") {
    const { text, href } = value as LinkValue;
    if (text === null || text === undefined || text === "") {
      return <Box component="span" sx={{ color: C.dim }}>—</Box>;
    }
    // New tab, so the conversation stays where it is.
    return href
      ? <a href={href} target="_blank" rel="noopener noreferrer"
          style={{ color: C.orange, textDecoration: "none" }}>{String(text)}</a>
      : <>{String(text)}</>;
  }
  if (value === null || value === undefined || value === "") {
    return <Box component="span" sx={{ color: C.dim }}>—</Box>;
  }
  switch (type) {
    case "score": {
      const n = Number(value) || 0;
      const pct = Math.max(0, Math.min(100, n));
      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 72 }}>
          <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: C.card, overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${pct}%`, bgcolor: C.orange }} />
          </Box>
          <Box component="span" sx={{ fontVariantNumeric: "tabular-nums", fontSize: FS.small }}>{n}</Box>
        </Box>
      );
    }
    case "tier": {
      const v = String(value).toLowerCase();
      const color = v === "hot" ? C.red : v === "warm" ? C.amber : C.slate;
      return <Chip size="small" label={String(value)} sx={{ height: 20, fontSize: FS.caption, fontFamily: F, textTransform: "capitalize", color: "#fff", bgcolor: color }} />;
    }
    case "stage":
      return <Chip size="small" label={String(value)} sx={{ height: 20, fontSize: FS.caption, fontFamily: F, textTransform: "capitalize", bgcolor: C.card, color: C.textMd }} />;
    case "url": {
      const raw = String(value);
      const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: C.orange, textDecoration: "none" }}>{raw.replace(/^https?:\/\//i, "")}</a>;
    }
    case "status": {
      const v = String(value).toLowerCase();
      const color = v === "enriched" ? C.green : v.startsWith("skipped") ? C.amber : C.slate;
      return <Chip size="small" label={String(value)} sx={{ height: 20, fontSize: FS.caption, fontFamily: F, color, bgcolor: `${color}1a`, fontWeight: FW.medium }} />;
    }
    case "tags": {
      // A few chips and a count — a 60-item tech stack made every row taller
      // than the screen. The full list is in the tooltip, row details and CSV.
      const all = Array.isArray(value) ? value.map(String) : [String(value)];
      const shown = all.slice(0, TAG_LIMIT);
      return (
        <Tooltip title={all.length > TAG_LIMIT ? all.join(", ") : ""} arrow>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "nowrap", overflow: "hidden" }}>
            {shown.map((t, i) => (
              <Chip key={i} size="small" label={t} sx={{ height: 18, fontSize: FS.micro, fontFamily: F, bgcolor: C.card, color: C.textMd, maxWidth: 120 }} />
            ))}
            {all.length > TAG_LIMIT && (
              <Box component="span" sx={{ fontSize: FS.micro, color: C.sub, whiteSpace: "nowrap", alignSelf: "center" }}>+{all.length - TAG_LIMIT}</Box>
            )}
          </Box>
        </Tooltip>
      );
    }
    case "boolean":
      return <>{value ? "Yes" : "No"}</>;
    case "date":
      return <>{String(value).slice(0, 10)}</>;
    case "money": {
      // $4.2B, not 4,200,000,000 — revenue is read at a glance.
      const n = Number(value);
      return <Box component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>{Number.isFinite(n) ? money.format(n) : String(value)}</Box>;
    }
    case "number":
      return <Box component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>{typeof value === "number" ? value.toLocaleString() : String(value)}</Box>;
    default:
      return <>{typeof value === "object" ? "—" : String(value)}</>;
  }
}

const TAG_LIMIT = 3;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

/** Plain text of a cell for its hover tooltip — truncated cells stay readable. */
function cellTitle(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && !Array.isArray(value)) {
    const t = (value as LinkValue).text;
    return t === null || t === undefined ? "" : String(t);
  }
  return Array.isArray(value) ? "" : String(value);
}

/** Display names for result kinds whose raw key isn't reader-friendly. */
const KIND_LABELS: Record<string, string> = {
  enriched_people: "enriched people",
  enriched_companies: "enriched companies",
  contacts: "people",
  discovered_contacts: "new people · ZoomInfo + Apollo",
  movers: "accounts that changed",
};

/** Rows drawn on screen. A big account can hold thousands of people; drawing them
 * all freezes the page. Download CSV always has the full set. */
const MAX_TABLE_ROWS = 200;

/** Render one result block (any tool that returns items) as a table + CSV export. */
/** Mirrors the backend /ask/resolve ceiling. */
const RESOLVE_CAP = 1000;

function ResultsTable({ block, api }: { block: RowsBlock; api: ApiPost }) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // Enriched uploads: a row opens to show every field, filled ones marked.
  const [openRow, setOpenRow] = useState<number | null>(null);
  const enriched = (block.kind ?? "").startsWith("enriched_");
  const kindLabel = KIND_LABELS[block.kind ?? ""]
    || block.kind || (block.tool === "search_people" ? "people" : "accounts");
  if (!block.items.length) {
    return (
      <Typography sx={{ fontFamily: F, fontSize: FS.body, color: C.sub, mt: 1 }}>
        No {kindLabel} matched.
      </Typography>
    );
  }
  const columns = resolveColumns(block);
  const downloadBtn = (
    <Button
      size="small"
      startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />}
      onClick={() => downloadText(block.filename ?? `copilot-${kindLabel.replace(/\s+/g, "-")}-${Date.now()}.csv`, itemsToCsv(withIsacLinks(block.items, block.kind)))}
      sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", color: C.orange, minWidth: 0, flexShrink: 0, "&:hover": { bgcolor: `${C.orange}14` } }}
    >
      Download CSV
    </Button>
  );
  // The table holds one page. When there are more matches, export them all by
  // re-running this step's exact filters server-side.
  const total = block.total ?? block.items.length;
  const canExportAll = !!block.input && total > block.items.length
    && (block.tool === "search_accounts" || block.tool === "search_people");
  const exportAll = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const r = await api<{ items: Record<string, unknown>[]; truncated: boolean }>(
        "/api/v1/ask/resolve", { tool: block.tool, input: block.input });
      downloadText(`copilot-${kindLabel.replace(/\s+/g, "-")}-all-${Date.now()}.csv`, itemsToCsv(withIsacLinks(r.items, block.kind)));
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };
  const exportAllBtn = canExportAll && (
    <Button size="small" disabled={exporting} onClick={exportAll}
      startIcon={exporting ? <CircularProgress size={12} /> : <FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />}
      sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", color: C.orange, minWidth: 0, flexShrink: 0, "&:hover": { bgcolor: `${C.orange}14` } }}>
      {exporting ? "Exporting…" : `Download all ${Math.min(total, RESOLVE_CAP).toLocaleString()}`}
    </Button>
  );
  return (
    <Box sx={{ mt: 1.5, mb: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.5 }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
          {block.total ?? block.items.length} {kindLabel}
          {block.source ? ` · ${block.source}` : ""} — showing {Math.min(block.items.length, MAX_TABLE_ROWS).toLocaleString()}
          {block.items.length > MAX_TABLE_ROWS ? " (Download CSV has all of them)" : ""}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5 }}>{exportAllBtn}{downloadBtn}</Box>
      </Box>
      {exportError && <Alert severity="error" sx={{ mb: 1, fontFamily: F }}>{exportError}</Alert>}
      {/* Fixed height with its own scroll and a sticky header, so a long list
          doesn't push the conversation (and the composer) out of reach. */}
      <TableContainer sx={{ border: `1px solid ${C.border}`, borderRadius: 0, bgcolor: C.panel, overflow: "auto", maxHeight: TABLE_MAX_HEIGHT }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((c, i) => (
                <TableCell key={i} sx={{ fontFamily: F, fontWeight: FW.semibold, fontSize: FS.small, color: C.textMd, borderColor: C.border, whiteSpace: "nowrap", bgcolor: C.card }}>{c.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {block.items.slice(0, MAX_TABLE_ROWS).map((it, ri) => {
              const filled = enriched ? (it._filled as Record<string, string> | undefined) ?? {} : {};
              return (
                <TableRow key={ri} hover selected={enriched && openRow === ri}
                  onClick={enriched ? () => setOpenRow(openRow === ri ? null : ri) : undefined}
                  sx={enriched ? { cursor: "pointer" } : undefined}>
                  {columns.map((c, ci) => {
                    const value = c.get(it);
                    const by = c.key ? filled[c.key] : undefined;
                    return (
                      <TableCell key={ci} title={by ? undefined : cellTitle(value)}
                        sx={by ? { ...cellSx, bgcolor: `${C.orange}1f` } : cellSx}>
                        {by ? (
                          <Tooltip arrow title={`${cellTitle(value)}${cellTitle(value) ? " — " : ""}added from ${PROVIDER_LABELS[by] ?? by}`}>
                            <span><GenericCell type={c.type} value={value} /></span>
                          </Tooltip>
                        ) : <GenericCell type={c.type} value={value} />}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Below the table, not inside it: a detail row would span the table's
          full scroll width and push half its fields off-screen. */}
      {enriched && openRow !== null && block.items[openRow] && (
        <RowDetails item={block.items[openRow]} onClose={() => setOpenRow(null)}
          filled={(block.items[openRow]._filled as Record<string, string> | undefined) ?? {}} />
      )}
      {/* Long lists: repeat the export at the bottom so it's reachable without scrolling up. */}
      {block.items.length > 8 && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
          {downloadBtn}
        </Box>
      )}
    </Box>
  );
}

/** The account page opened on its Contacts tab — where revealed contacts live unmasked. */
const contactsTabHref = (companyId: number) => isacPath(`/companies/${companyId}?tab=contacts`);

/** Same format as the backend's Ask AI masking (app.agents.ask.masking). */
const maskEmail = (v: string | null | undefined) => {
  if (!v) return v ?? null;
  const at = v.indexOf("@");
  return at < 0 ? "***" : `${v.slice(0, Math.min(2, at))}***${v.slice(at)}`;
};
const maskPhone = (v: string | null | undefined) => (v ? `${v.slice(0, 3)}****` : v ?? null);

/** Contacts per reveal run until the estimate reports the server's cap
 * (CONTACT_REVEAL_MAX_PER_RUN). */
const REVEAL_MAX = 10;

/** One discovered person → the /contact-enrichment/save payload (as the Contacts
 * tab sends it), so the saved contact keeps its flags, quality and provider id. */
const toSavePayload = (it: Record<string, unknown>) => ({
  first_name: it.first_name, last_name: it.last_name, job_title: it.job_title,
  source: it.provider, external_id: it.external_id,
  has_email: !!it.has_email, has_phone: !!it.has_phone,
  has_direct_phone: it.has_direct_phone ?? null, has_mobile_phone: it.has_mobile_phone ?? null,
  match_confidence: it.match_confidence ?? null, email_status: it.email_status ?? null,
  direct_phone_do_not_call: it.direct_phone_do_not_call ?? null,
  mobile_phone_do_not_call: it.mobile_phone_do_not_call ?? null,
  last_refreshed_at: it.last_refreshed_at ?? null, seniority: it.seniority ?? null,
  department: it.department ?? null, country: it.country ?? null, city: it.city ?? null,
  linkedin_url: it.linkedin_url ?? null,
});

/** A revealed value, or whether a reveal can get one. */
function Availability({ value, available, dnc }: { value: unknown; available: unknown; dnc?: unknown }) {
  if (value) {
    return (
      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
        {String(value)}{dnc ? <DoNotCallChip /> : null}
      </Box>
    );
  }
  if (!available) return <Box component="span" sx={{ color: C.dim }}>—</Box>;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      <Chip size="small" label="Available" sx={{ height: 18, fontSize: FS.micro, fontFamily: F, color: C.green, bgcolor: `${C.green}14` }} />
      {dnc ? <DoNotCallChip /> : null}
    </Box>
  );
}

/** New people from ZoomInfo + Apollo at a set of accounts — the Contacts tab's
 * discovery, for many accounts at once.
 *
 * Shows what a reveal can return (email / direct / mobile) without spending
 * anything. Ticking people and clicking Reveal saves them to their ISAC account
 * (free — the same /save the Contacts tab uses) and opens the Contacts tab's
 * estimate → confirm dialog, so the credit cost is always shown before it is
 * spent. Revealed values then appear in the rows. */
function DiscoveredContactsTable({ block }: { block: RowsBlock }) {
  const { request } = useApiClient();
  const [rows, setRows] = useState(block.items);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  // row → saved contact id. Rows answered from an earlier discovery are saved already.
  const [savedIds, setSavedIds] = useState<Map<number, number>>(() => new Map(
    block.items.flatMap((it, i) => (typeof it.contact_id === "number" ? [[i, it.contact_id] as [number, number]] : []))));
  const [dialogIds, setDialogIds] = useState<number[] | null>(null);
  const [cap, setCap] = useState(REVEAL_MAX);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  // Accounts with contacts revealed from here (id → name): their Contacts tab
  // holds the full values Ask AI shows masked.
  const [revealedTo, setRevealedTo] = useState<Map<number, string>>(new Map());

  const revealed = (it: Record<string, unknown>) => !!(it.email || it.phone || it.mobile_phone);
  const pickable = (it: Record<string, unknown>) => !!it.isac_company_id && !revealed(it);
  const toggle = (i: number) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i);
    else if (next.size < cap) next.add(i);
    return next;
  });

  const startReveal = async () => {
    setSaving(true);
    setNote(null);
    try {
      // Reveal works on saved contacts, so save the picked rows to their accounts
      // first — grouped per account, as the Contacts tab saves them.
      const ids = new Map(savedIds);
      const byCompany = new Map<number, number[]>();
      for (const i of picked) {
        if (ids.has(i)) continue;
        const cid = Number(rows[i].isac_company_id);
        byCompany.set(cid, [...(byCompany.get(cid) ?? []), i]);
      }
      for (const [cid, idx] of byCompany) {
        const r = await request<{ saved: { id: number }[] }>("post", "/contact-enrichment/save", {
          company_id: cid, contacts: idx.map((i) => toSavePayload(rows[i])),
          total_available: rows[idx[0]].total_available ?? null,
        });
        r.saved.forEach((sv, k) => ids.set(idx[k], sv.id));   // /save answers in input order
      }
      setSavedIds(ids);
      setDialogIds([...picked].map((i) => ids.get(i)).filter((x): x is number => x !== undefined));
    } catch (e) {
      setNote({ text: e instanceof Error ? e.message : "Couldn't prepare those contacts.", error: true });
    } finally {
      setSaving(false);
    }
  };

  const onRevealed = (r: RevealBulkResult) => {
    const rowOf = new Map([...savedIds].map(([row, id]) => [id, row]));
    // Ask AI keeps contact details masked (as the backend does for everything it
    // shows); the full values are saved on each account's Contacts tab.
    setRows((prev) => prev.map((it, i) => {
      const hit = r.results.find((x) => rowOf.get(x.contact_id) === i && x.contact);
      return hit?.contact ? { ...it, email: maskEmail(hit.contact.email), phone: maskPhone(hit.contact.phone),
        mobile_phone: maskPhone(hit.contact.mobile_phone), linkedin_url: hit.contact.linkedin_url ?? it.linkedin_url,
        last_name: hit.contact.last_name ?? it.last_name } : it;
    }));
    setPicked(new Set());
    setRevealedTo((prev) => {
      const next = new Map(prev);
      for (const x of r.results) {
        const row = rowOf.get(x.contact_id);
        if (row === undefined || x.status !== "revealed") continue;
        const it = rows[row];
        next.set(Number(it.isac_company_id), String(it.account_name ?? "Account"));
      }
      return next;
    });
    setNote({ text: `Revealed ${r.revealed} of ${r.results.length} · ${r.total_credits_used} credit${r.total_credits_used === 1 ? "" : "s"} used. `
      + "Ask AI keeps contact details masked — open the Contacts tab for the full email and numbers." });
  };

  const name = (it: Record<string, unknown>) => [it.first_name, it.last_name].filter(Boolean).join(" ") || "—";
  const head = { fontFamily: F, fontWeight: FW.semibold, fontSize: FS.small, color: C.textMd, borderColor: C.border, whiteSpace: "nowrap", bgcolor: C.card } as const;
  const kindLabel = KIND_LABELS.discovered_contacts;
  return (
    <Box sx={{ mt: 1.5, mb: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>
          {rows.length} {kindLabel} — ranked best first
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          <Button size="small" variant="contained" disabled={!picked.size || saving} onClick={startReveal}
            startIcon={saving ? <CircularProgress size={12} sx={{ color: "#fff" }} /> : undefined}
            sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", bgcolor: C.orange, "&:hover": { bgcolor: C.orangeDark } }}>
            {picked.size ? `Reveal ${picked.size} — see cost first` : `Tick up to ${cap} to reveal`}
          </Button>
          <Button size="small" startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={() => downloadText(block.filename ?? `copilot-new-contacts-${Date.now()}.csv`, itemsToCsv(rows))}
            sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", color: C.orange, "&:hover": { bgcolor: `${C.orange}14` } }}>
            Download CSV
          </Button>
        </Box>
      </Box>
      {note && (
        <Typography sx={{ fontFamily: F, fontSize: FS.small, color: note.error ? C.pink : C.sub, mb: 0.5 }}>{note.text}</Typography>
      )}
      {revealedTo.size > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", mb: 0.75 }}>
          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.sub }}>Full details:</Typography>
          {[...revealedTo].map(([cid, acct]) => (
            <Button key={cid} size="small" variant="outlined" href={contactsTabHref(cid)} target="_blank" rel="noopener noreferrer"
              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              sx={{ fontFamily: F, fontSize: FS.small, textTransform: "none", py: 0.1, color: C.orange, borderColor: `${C.orange}88` }}>
              {acct} — Contacts tab
            </Button>
          ))}
        </Box>
      )}
      <TableContainer sx={{ border: `1px solid ${C.border}`, borderRadius: 0, bgcolor: C.panel, overflow: "auto", maxHeight: TABLE_MAX_HEIGHT }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={head} />
              {["Account", "Name", "Title", "Quality", "Email", "Direct", "Mobile", "Found in"].map((h) => (
                <TableCell key={h} sx={head}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.slice(0, MAX_TABLE_ROWS).map((it, i) => {
              const can = pickable(it);
              const checked = picked.has(i);
              const why = !it.isac_company_id ? "This account isn't in ISAC, so its people can't be saved or revealed here."
                : revealed(it) ? "Already revealed." : !checked && picked.size >= cap ? `Up to ${cap} per reveal.` : "";
              const also = (it.also_found_in as string[] | undefined) ?? [];
              return (
                <TableRow key={i} hover selected={checked}>
                  <TableCell padding="checkbox" sx={{ ...cellSx, maxWidth: "none" }}>
                    <Tooltip title={why} arrow>
                      <span>
                        <Checkbox size="small" checked={checked} disabled={!can || (!checked && picked.size >= cap)}
                          onChange={() => toggle(i)} inputProps={{ "aria-label": `Select ${name(it)}` }} />
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={cellSx} title={cellTitle(it.account_name)}>
                    <GenericCell type="link" value={{ text: it.account_name, href: companyHref(it) }} />
                  </TableCell>
                  <TableCell sx={cellSx} title={name(it)}>{name(it)}</TableCell>
                  <TableCell sx={cellSx} title={[it.job_title, seniorityLabel(it.seniority)].filter(Boolean).join(" · ")}><GenericCell type="text" value={it.job_title} /></TableCell>
                  <TableCell sx={cellSx}><GenericCell type="number" value={typeof it.match_confidence === "number" ? Math.round(it.match_confidence) : null} /></TableCell>
                  <TableCell sx={cellSx}>
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                      <Availability value={it.email} available={it.has_email} />
                      {revealed(it) && !!it.isac_company_id && (
                        <Tooltip arrow title="Masked in Ask AI — open the account's Contacts tab for the full email and numbers">
                          <a href={contactsTabHref(Number(it.isac_company_id))} target="_blank" rel="noopener noreferrer"
                            style={{ color: C.orange, textDecoration: "none", fontSize: FS.small, whiteSpace: "nowrap" }}>
                            Full details ↗
                          </a>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={cellSx}><Availability value={it.phone} available={it.has_direct_phone} dnc={it.direct_phone_do_not_call} /></TableCell>
                  <TableCell sx={cellSx}><Availability value={it.mobile_phone} available={it.has_mobile_phone} dnc={it.mobile_phone_do_not_call} /></TableCell>
                  <TableCell sx={{ ...cellSx, maxWidth: "none" }}>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <ProviderChip provider={String(it.provider ?? "")} />
                      {also.map((p) => <ProviderChip key={p} provider={p} />)}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {dialogIds && (
        <RevealContactsDialog open contactIds={dialogIds}
          onClose={() => setDialogIds(null)}
          onEstimate={(e) => setCap(e.max_per_run)}
          onRevealed={onRevealed}
          onError={(m) => setNote({ text: m, error: true })} />
      )}
    </Box>
  );
}

const TABLE_MAX_HEIGHT = 440;
const PROVIDER_LABELS: Record<string, string> = { apollo: "Apollo", zoominfo: "ZoomInfo" };

/** Every field of one enriched row — the table shows a few, this shows them all,
 * with the ones enrichment added marked by provider. */
function RowDetails({ item, filled, onClose }: {
  item: Record<string, unknown>; filled: Record<string, string>; onClose: () => void;
}) {
  const entries = Object.entries(item).filter(([k, v]) => !k.startsWith("_")
    && v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length));
  const title = String(item.Company ?? item.company ?? item.canonical_name
    ?? ([item.first_name, item.last_name].filter(Boolean).join(" ") || item.email || "Row details"));
  const show = (k: string, v: unknown) => (Array.isArray(v) ? v.join(", ")
    : typeof v === "number" ? (/revenue|funding/i.test(k) ? money.format(v) : /year/i.test(k) ? String(v) : v.toLocaleString())
    : typeof v === "object" ? "—" : String(v));
  return (
    <Box sx={{ mt: 1, p: 1.5, border: `1px solid ${C.border}`, bgcolor: C.card }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography sx={{ fontFamily: F, fontSize: FS.body, fontWeight: FW.semibold, color: C.text }}>{title}</Typography>
        <IconButton size="small" aria-label="Close details" onClick={onClose} sx={{ color: C.sub, p: 0.25 }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, columnGap: 3, rowGap: 0.75 }}>
      {entries.map(([k, v]) => (
        <Box key={k} sx={{ display: "flex", gap: 1, minWidth: 0, alignItems: "baseline" }}>
          <Typography sx={{ fontFamily: F, fontSize: FS.caption, color: C.sub, flex: "0 0 132px", overflow: "hidden", textOverflow: "ellipsis" }}>
            {humanize(k)}
          </Typography>
          <Typography sx={{ fontFamily: F, fontSize: FS.small, color: C.text, minWidth: 0, overflowWrap: "anywhere" }}>
            {show(k, v)}
            {filled[k] && (
              <Box component="span" sx={{ ml: 0.75, px: 0.5, borderRadius: 0.5, fontSize: FS.micro, color: C.orange, bgcolor: `${C.orange}14` }}>
                {PROVIDER_LABELS[filled[k]] ?? filled[k]}
              </Box>
            )}
          </Typography>
        </Box>
      ))}
    </Box>
    </Box>
  );
}

/** Rows stay one line: text starts at the top and long values truncate with the
 * full text on hover, so one wordy cell can't make every row screen-tall. */
const cellSx = {
  fontFamily: F, fontSize: FS.body, color: C.text, borderColor: C.border,
  verticalAlign: "top", maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
} as const;
