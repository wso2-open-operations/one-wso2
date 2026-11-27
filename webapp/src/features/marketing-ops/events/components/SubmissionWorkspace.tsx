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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  FilterX,
  Maximize2,
  Minimize2,
  PaintBucket,
  Redo2,
  ShieldCheck,
  Sparkles,
  Columns3,
  Table2,
  TriangleAlert,
  Undo2,
  Upload,
  X,
} from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import {
  useCampaignCheck,
  useEscalateSubmission,
  useEventsReference,
  useFieldDefs,
  useMemberStatuses,
  useSaveSubmission,
  useSubmission,
  useSubmissionComments,
  useSubmitSubmission,
  useRunAutomaticReview,
  useSuggest,
  useCheckTitles,
  useUpdateSubmissionMeta,
  useWithdrawSubmission,
} from "../../api/useEvents";
import type { Comment, Problem, ReviewResult, SubmissionFull, SubmitResult, Tab } from "../eventsTypes";
import ReviewDialog, { type ReviewState, type ReviewStep } from "./ReviewDialog";
import { toReference, type Reference } from "../rules/reference";
import { WorkbookError, parseWorkbook, type ParsedWorkbook } from "../rules/workbook";
import {
  accept,
  answerTitle,
  applySuggestions,
  applyTranslations,
  changesOf,
  countsFor,
  edit,
  fillField,
  fromPayload,
  pendingTitles,
  reject,
  rederive,
  removeRows,
  toPayload,
  totalRows,
  unrejectAll,
  type Model,
} from "../rules/model";
import { buildRequest } from "../rules/suggest";
import { distinctTitles, titleKey } from "../rules/titles";
import { buildReport, type Report } from "../rules/report";
import { SPECIAL, labelOf, liveStatuses, picklistOf, type EventsConfig, type Field } from "../rules/schema";
import { columnsFor } from "../rules/columns";
import AttendeeGrid, { type CellRef } from "./AttendeeGrid";
import IssueBar from "./IssueBar";
import { issuesByField } from "../lib/issueGroups";
import { ChangeListButton } from "./ChangeList";
import FillDialog, { type FillTarget } from "./FillDialog";
import TitleDialog from "./TitleDialog";
import {
  CampaignUrlField,
  SdrOwnerField,
  ConfirmDialog,
  EventsLoading,
  Panel,
  StatusChip,
  TabRail,
  WorkspaceHead,
} from "./EventsUi";
import { campaignIdFrom } from "../rules/validate";
import { campaignUrlHint } from "../lib/campaignUrl";
import { describeEventsError } from "../lib/serverError";
import { normaliseSdr, sdrOwnerProblem } from "../lib/sdrOwner";
import { EVENTS_LOADING, LEAVE_MS, primaryBtn, quietBtn, tint, useToneColors } from "./eventsStyles";

// One submission, from the RMM's side.
//
// The list lives in this component's STATE. Accept, reject, edit and delete are local and
// instant — the same feel as accepting an inline suggestion in an editor — and the server
// is touched three times in a session: reference lists on mount, one round of suggestions
// after a load, and a debounced save.
//
// Drafting stays in the Google Sheet. This screen CORRECTS a list, it never creates one:
// rows can be edited and removed, never added.

/** How long after the last change we persist. Long enough that typing across a row is one
 *  save, short enough that nobody loses work by navigating away. */
const SAVE_DEBOUNCE_MS = 1200;

/** How many steps back you can go. Each entry is a whole list, so this is the one place
 *  undo costs anything; 50 corrections is far more than a session needs. */
const HISTORY_LIMIT = 50;

/** Whether a key event came from a text-entry element, where Escape and Ctrl+Z belong
 *  to the field being typed in rather than to the page. */
const isEditableTarget = (el: HTMLElement | null): boolean =>
  Boolean(el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable));

/** Does this row have a problem in scope? With a field, only that column counts. */
const broken = (row: { issues: { field: string }[] }, field: string | null) =>
  field ? row.issues.some((i) => i.field === field) : row.issues.length > 0;

// The outer shell only LOADS. All four of these are needed before a workbook means
// anything: the reference lists to judge countries, the statuses to know which tabs count,
// the columns to know what the headings are, and the submission itself.
//
// The editable model is seeded inside `Workspace`, from props, via useState initialisers —
// which is why this split exists. Seeding local state from an async load in an effect is
// the antipattern React's set-state-in-effect rule exists to catch; keying a child on the
// loaded data is the supported way to do it.
export default function SubmissionWorkspace({
  id,
  onBack,
  backLabel = "My submissions",
}: {
  id: string;
  onBack: () => void;
  /** The back button's label — Lead Import's step 3 goes back to the mapping. */
  backLabel?: string;
}) {
  const reference = useEventsReference();
  const statuses = useMemberStatuses();
  const fields = useFieldDefs();
  const submission = useSubmission(id);
  const comments = useSubmissionComments(id);

  const anyError = reference.error ?? statuses.error ?? fields.error ?? submission.error;
  if (anyError) {
    return <Alert severity="error">Could not open that submission. {describeError(anyError)}</Alert>;
  }
  if (!reference.data || !statuses.data || !fields.data || !submission.data) {
    return <EventsLoading messages={EVENTS_LOADING.list} />;
  }

  return (
    <Workspace
      // Remount on a different submission so nothing carries across.
      key={id}
      id={id}
      onBack={onBack}
      backLabel={backLabel}
      submission={submission.data}
      reference={toReference(reference.data)}
      config={{ statuses: statuses.data, fields: fields.data }}
      comments={comments.data ?? []}
      assisted={reference.data.assisted}
    />
  );
}

function Workspace({
  id,
  onBack,
  backLabel,
  submission,
  reference: ref,
  config,
  comments,
  assisted,
}: {
  id: string;
  onBack: () => void;
  backLabel: string;
  submission: SubmissionFull;
  reference: Reference;
  config: EventsConfig;
  comments: Comment[];
  assisted: boolean;
}) {
  const tones = useToneColors();
  const save = useSaveSubmission();
  const suggestMutation = useSuggest();
  const titlesMutation = useCheckTitles();
  const submitMutation = useSubmitSubmission();
  const escalateMutation = useEscalateSubmission();
  const reviewMutation = useRunAutomaticReview();
  const updateMeta = useUpdateSubmissionMeta();
  const withdrawMutation = useWithdrawSubmission();

  // Seeded once from props. `status` is tracked locally too, because submitting and
  // withdrawing change it and the screen must reflect that without a refetch race.
  const [status, setStatus] = useState(submission.status);
  const [model, setModel] = useState<Model | null>(() =>
    fromPayload(
      submission.payload,
      {
        name: submission.event_name,
        date: submission.event_date ?? "",
        campaignUrl: submission.sf_campaign_url,
      },
      ref,
      config,
    ),
  );
  // No fixed first tab: which statuses exist is CONFIGURATION, so the first one with rows
  // is chosen from the payload.
  const [active, setActive] = useState<Tab>(() => {
    const built = fromPayload(
      submission.payload,
      { name: submission.event_name, date: submission.event_date ?? "", campaignUrl: submission.sf_campaign_url },
      ref,
      config,
    );
    return Object.keys(built.tabs).find((t) => built.tabs[t]?.length) ?? "";
  });

  const [uploading, setUploading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [checkingTitles, setCheckingTitles] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[] | null>(null);
  /** Whether every problem automatic review raised is one an admin may overrule. */
  const [canEscalate, setCanEscalate] = useState(false);
  /** Where the list went after a successful submit, for the banner that says so. */
  const [outcome, setOutcome] = useState<"approved" | "escalated" | "returned" | null>(null);
  const [escalateOpen, setEscalateOpen] = useState(false);
  /** The Review panel while it is open. */
  const [review, setReview] = useState<ReviewState | null>(null);
  /** The grid's report from a failed review, for "Show me where". */
  const [pendingReport, setPendingReport] = useState<Report | null>(null);
  /** Whether the report's problems are ones an admin may overrule (see startReview). */
  const [reportCanEscalate, setReportCanEscalate] = useState(false);
  /** The campaign URL as last saved. Local because fixing it here must reach the grid's
   *  Campaign ID column and any re-upload without waiting on a refetch. */
  const [campaignUrl, setCampaignUrl] = useState(submission.sf_campaign_url ?? "");
  const [editingCampaign, setEditingCampaign] = useState(false);
  /** The SDR owner as last saved — local for the same reason as the campaign URL. */
  const [sdrOwner, setSdrOwner] = useState(submission.sdr_owner_email ?? "");
  const [editingSdr, setEditingSdr] = useState(false);
  const sdrProblem = sdrOwnerProblem(sdrOwner);
  const campaignId = campaignIdFrom(campaignUrl);
  const campaignCheck = useCampaignCheck(campaignId);
  const [uploadNote, setUploadNote] = useState<ParsedWorkbook | null>(null);
  const [dragging, setDragging] = useState(false);
  // Bumped on each chip click so clicking the same field twice still scrolls.
  const [jumpTo, setJumpTo] = useState<{ field: string; nonce: number } | null>(null);
  /** "Show me that one", from the change list. */
  const [jumpToRow, setJumpToRow] = useState<{ rowId: string; nonce: number } | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  /** Undo/redo. Snapshots of the whole list — see `apply`. */
  const [past, setPast] = useState<Model[]>([]);
  const [future, setFuture] = useState<Model[]>([]);
  const [confirming, setConfirming] = useState<"reupload" | "withdraw" | null>(null);
  const [deleting, setDeleting] = useState<{ rowId: string; label: string } | null>(null);
  /** Rows ticked for a bulk edit, and the open fill dialog. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filling, setFilling] = useState<FillTarget | null>(null);
  /** The job-title dialog (TitleDialog). */
  const [reviewingTitles, setReviewingTitles] = useState(false);

  // The active row filter, or null for "show everything". `field` scopes it to one column —
  // an any-issue filter is useless on a real list, where one sheet had a problem in every
  // one of its 55 rows and so hid nothing. What you want is "the 4 rows missing a last name".
  //
  // LIVE, not a snapshot: a row leaves the moment it becomes valid. The count ticking
  // 4 → 3 → 2 → 1 teaches the rule while it still costs nothing to learn.
  const [pinned, setPinned] = useState<{ field: string | null } | null>(null);
  // The grid over the whole window, for working through a long list. Not a route: like an
  // open dialog, it's a way of looking at this screen, and a reload returns to the page.
  const [expanded, setExpanded] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Model | null>(null);
  /** One round of suggestions at a time. */
  const asking = useRef(false);

  const editable = status === "Draft" || status === "ChangesRequested";
  const rows = useMemo(() => model?.tabs[active] ?? [], [model, active]);

  // Everything wrong with the tab, grouped by field — computed in ordinary render, so it
  // can never go stale the way a memoized column header did.
  const issueGroups = useMemo(
    () => issuesByField(rows, columnsFor(rows, active, config), config, active),
    [rows, active, config],
  );

  /** A row's 1-based position in the FULL tab, so a filtered grid still agrees with the
   *  submit report about which row is which. */
  const positions = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => m.set(r.id, i + 1));
    return m;
  }, [rows]);

  /** Rows that match the filter right now — the count the user watches fall. */
  const matching = useMemo(
    () => new Set(pinned ? rows.filter((r) => broken(r, pinned.field)).map((r) => r.id) : []),
    [rows, pinned],
  );

  // Rows that matched a moment ago and no longer do — held on screen for one beat so the
  // row you just fixed is SEEN leaving, and you keep the confirmation of which one it was.
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const wasMatching = useRef<Set<string>>(new Set());
  const leaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!pinned) {
      wasMatching.current = new Set();
      return;
    }
    const gone = [...wasMatching.current].filter((rowId) => !matching.has(rowId));
    wasMatching.current = matching;
    if (!gone.length) return;
    setLeaving((prev) => new Set([...prev, ...gone]));
    for (const rowId of gone) {
      leaveTimers.current.set(
        rowId,
        setTimeout(() => {
          setLeaving((prev) => {
            const next = new Set(prev);
            next.delete(rowId);
            return next;
          });
          leaveTimers.current.delete(rowId);
        }, LEAVE_MS),
      );
    }
  }, [matching, pinned]);

  // Turning the filter off must not leave a row mid-fade, and a pending timer must not fire
  // into an unmounted component.
  const timers = leaveTimers.current;
  useEffect(() => {
    if (pinned) return;
    timers.forEach(clearTimeout);
    timers.clear();
    setLeaving(new Set());
  }, [pinned, timers]);
  useEffect(
    () => () => {
      timers.forEach(clearTimeout);
    },
    [timers],
  );

  const visibleRows = useMemo(
    () => (pinned ? rows.filter((r) => matching.has(r.id) || leaving.has(r.id)) : rows),
    [rows, pinned, matching, leaving],
  );

  // Nothing left to show means the job is done — fall back to the whole list rather than
  // leaving someone staring at an empty grid.
  useEffect(() => {
    if (pinned && visibleRows.length === 0) setPinned(null);
  }, [pinned, visibleRows]);

  /** Every cell that differs from the uploaded workbook. Derived, so undo, redo and a value
   *  edited back to itself all resolve without any bookkeeping. */
  const changes = useMemo(() => (model ? changesOf(model) : []), [model]);

  /** Suggestions currently turned down. The button says so, because "ask again" with
   *  nothing outstanding and "ask again, and bring back the six I refused" are different
   *  promises. */
  const rejected = model?.dismissed.size ?? 0;

  /** Allowed values for a cell, so the grid can offer a list instead of asking someone to
   *  remember the spelling. State depends on the row's COUNTRY, which is why this takes the
   *  row rather than just the field. */
  const optionsFor = useCallback(
    (field: string, row: { data: Record<string, string> }) => {
      if (field === SPECIAL.country) return ref.countries;
      if (field === SPECIAL.state) return ref.states[row.data[SPECIAL.country] ?? ""] ?? undefined;
      return picklistOf(config, active, field);
    },
    [ref, config, active],
  );

  // ---- persistence ---------------------------------------------------------------
  const scheduleSave = useCallback(
    (next: Model, filename = "", version = "") => {
      latest.current = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState("saving");
      saveTimer.current = setTimeout(async () => {
        saveTimer.current = null;
        const snapshot = latest.current;
        if (!snapshot) return;
        try {
          await save.mutateAsync({
            id,
            payload: toPayload(snapshot),
            rowCount: totalRows(snapshot),
            sourceFilename: filename,
            templateVersion: version,
          });
          setSaveState("saved");
        } catch (e) {
          setSaveState("idle");
          setError(`${describeError(e)} Your changes are still here.`);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    // `save` is a stable mutation object from React Query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  // Leaving with a save still pending SENDS it rather than dropping it: in Lead Import
  // the grid is one step of three, and stepping back is a click away from an edit.
  const { mutate: saveNow } = save;
  useEffect(
    () => () => {
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const pending = latest.current;
      if (pending) saveNow({ id, payload: toPayload(pending), rowCount: totalRows(pending) });
    },
    // Once, on unmount; `saveNow` is React Query's stable mutate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ---- suggestions ---------------------------------------------------------------
  /** One round of suggestions for what our own rules could not resolve. Runs after a LOAD,
   *  never per click — and only the ambiguous values travel, never names or emails. */
  const askForSuggestions = useCallback(
    async (current: Model) => {
      const items = buildRequest(current);
      if (!items.length || asking.current || !assisted) return;
      asking.current = true;
      setThinking(true);
      try {
        const res = await suggestMutation.mutateAsync({ id, items });
        if (res) {
          setModel((m) => (m ? applySuggestions(m, res.suggestions, ref, config) : m));
        }
      } catch {
        // Suggestions are a HEAD START, never a dependency. Failing here leaves the user
        // with the same screen and a few more cells to resolve by hand.
      } finally {
        asking.current = false;
        setThinking(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, ref, config, assisted],
  );

  /** Which job titles are not in English. Runs after a load, and again whenever a title
   *  appears that hasn't been asked about — one typed into a cell, or written in the title
   *  dialog — so a new title can't slip past as English. Only the titles travel. Not
   *  gated on `assisted`: answers the server stored earlier still apply when no model is
   *  configured, and automatic review reads the same answers. */
  const askingTitles = useRef(false);
  /** Titles already asked about, by titleKey. */
  const askedTitles = useRef(new Set<string>());
  const askForTitles = useCallback(
    async (current: Model) => {
      const titles = distinctTitles(current.tabs).filter((t) => !askedTitles.current.has(titleKey(t)));
      if (!titles.length || askingTitles.current) return;
      askingTitles.current = true;
      setCheckingTitles(true);
      try {
        const res = await titlesMutation.mutateAsync({ id, titles });
        if (res?.translations.length) {
          setModel((m) => (m ? applyTranslations(m, res.translations, ref, config) : m));
        }
      } catch {
        // A head start like suggestions: failing leaves the titles unchecked, never stuck.
        // Not retried this session — automatic review asks about them again anyway.
      } finally {
        titles.forEach((t) => askedTitles.current.add(titleKey(t)));
        askingTitles.current = false;
        setCheckingTitles(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, ref, config],
  );

  // Suggestions aren't stored — they're recomputed per session — so a submission being
  // reopened needs the same round an upload gets. Fired once on mount for an editable list.
  const askedOnMount = useRef(false);
  useEffect(() => {
    if (askedOnMount.current || !editable || !model) return;
    askedOnMount.current = true;
    void askForSuggestions(model);
    void askForTitles(model);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A title written after loading. Waits a moment so a burst of edits is one request, and
  // re-runs when a request in flight finishes, so a title added meanwhile isn't missed.
  useEffect(() => {
    if (!editable || !model || checkingTitles) return;
    const t = setTimeout(() => void askForTitles(model), 600);
    return () => clearTimeout(t);
  }, [editable, model, checkingTitles, askForTitles]);

  // A highlighted column means nothing on a different tab, and neither does a selection of
  // rows you can no longer see.
  useEffect(() => {
    setJumpTo(null);
    setSelected(new Set());
    setPinned(null);
  }, [active]);

  // Escape clears a column highlight — the conventional way out, next to clicking the chip
  // again. Skipped while a cell is being edited, where Escape already means "cancel this
  // edit" and the grid handles it.
  useEffect(() => {
    if (!jumpTo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = e.target as HTMLElement | null;
      if (isEditableTarget(el)) return;
      setJumpTo(null);
      setPinned(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jumpTo]);

  // Escape also leaves the expanded view — but one thing at a time. While a column is
  // highlighted the first Escape clears that (the effect above), and only the next one
  // exits. Never while editing a cell or inside a dialog, where Escape already means
  // "cancel this".
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || jumpTo) return;
      const el = e.target as HTMLElement | null;
      if (isEditableTarget(el)) return;
      if (el?.closest('[role="dialog"], [role="presentation"]')) return;
      setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    // The page underneath must not scroll: the overlay is the window now, and a wheel that
    // reaches past the grid would otherwise move the page behind it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [expanded, jumpTo]);

  // The highlight exists for one reason: to point at the cells in a column that need
  // attention. Once the last is resolved the column is just a column, and leaving it tinted
  // CLAIMS something is still wrong there. So the highlight ends when its reason does.
  useEffect(() => {
    if (jumpTo && !issueGroups.some((g) => g.field === jumpTo.field)) setJumpTo(null);
  }, [issueGroups, jumpTo]);

  // ---- history -------------------------------------------------------------------
  // Every local mutation goes through here: remember where we were, update state, then
  // schedule one save.
  //
  // Undo is nearly free because a Model is IMMUTABLE — accept, reject, edit and delete
  // already return a fresh one rather than mutating in place, so the previous state is
  // simply the object we were holding. No diffing, no inverse operations.
  //
  // Suggestions arriving are deliberately NOT recorded: they change nothing about the data,
  // only what we know about it, and an undo that silently un-asked the model would be
  // baffling.
  const apply = useCallback(
    (next: Model) => {
      if (model) {
        setPast((p) => [...p.slice(-(HISTORY_LIMIT - 1)), model]);
        setFuture([]); // a new action abandons the redo branch
      }
      setModel(next);
      scheduleSave(next);
    },
    [model, scheduleSave],
  );

  const undo = useCallback(() => {
    if (!past.length || !model) return;
    const previous = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [model, ...f]);
    setModel(previous);
    scheduleSave(previous);
  }, [past, model, scheduleSave]);

  const redo = useCallback(() => {
    if (!future.length || !model) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, model]);
    setModel(next);
    scheduleSave(next);
  }, [future, model, scheduleSave]);

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z. Skipped while a field has focus so the browser's own
  // text undo still works inside a cell being typed into — that's what the user means by
  // undo at that moment, and taking it would be worse than not having ours.
  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const el = e.target as HTMLElement | null;
      if (isEditableTarget(el)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable, undo, redo]);

  // ---- upload --------------------------------------------------------------------
  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setProblems(null);
    try {
      const parsed = await parseWorkbook(file, config);
      const rowsByTab: Record<string, ReturnType<typeof toPayload>["tabs"][string]> = {};
      parsed.tabs.forEach((t) => {
        rowsByTab[t.tab] = t.rows;
      });

      const built = fromPayload(
        { tabs: rowsByTab },
        { name: submission.event_name, date: submission.event_date ?? "", campaignUrl },
        ref,
        config,
      );
      setModel(built);
      // The new model carries no translations, so titles asked about for the previous
      // file are asked again (the server answers them from what it stored, without Claude).
      askedTitles.current.clear();
      // A different file is a different LIST; undoing back into the previous one would
      // interleave two documents' rows.
      setPast([]);
      setFuture([]);
      setUploadNote(parsed);
      const first = Object.keys(built.tabs).find((t) => built.tabs[t]?.length);
      if (first) setActive(first);
      scheduleSave(built, file.name);
      void askForSuggestions(built);
      void askForTitles(built);
    } catch (e) {
      setError(e instanceof WorkbookError ? e.message : describeError(e));
    } finally {
      setUploading(false);
    }
  }

  // ---- actions (all local) -------------------------------------------------------
  const onAccept = useCallback(
    (cells: CellRef[]) => {
      if (!model) return;
      apply(
        accept(model, cells.map((c) => ({ tab: active, rowId: c.row_id, field: c.field })), ref, config),
      );
    },
    [model, active, ref, config, apply],
  );

  const onReject = useCallback(
    (cells: CellRef[]) => {
      if (!model) return;
      apply(
        reject(model, cells.map((c) => ({ tab: active, rowId: c.row_id, field: c.field })), ref, config),
      );
    },
    [model, active, ref, config, apply],
  );

  const onEdit = useCallback(
    (edits: { row_id: string; field: string; value: string }[]) => {
      if (!model) return;
      apply(
        edit(
          model,
          active,
          edits.map((e) => ({ rowId: e.row_id, field: e.field, value: e.value })),
          ref,
          config,
        ),
      );
    },
    [model, active, ref, config, apply],
  );

  /** Set one column to one value across many rows. Routed through `apply` like every other
   *  edit, so it's ONE undo step. */
  const onFill = useCallback(
    (field: Field, value: string, rowIds: string[]) => {
      if (!model) return;
      apply(fillField(model, active, field, value, rowIds, ref, config));
    },
    [model, active, ref, config, apply],
  );

  /** One job title answered on every row that holds it — one undo step per answer. */
  const onAnswerTitle = useCallback(
    (key: string, answer: string) => {
      if (!model) return;
      apply(answerTitle(model, key, answer, ref, config));
    },
    [model, ref, config, apply],
  );
  const titlesLeft = useMemo(() => (model ? pendingTitles(model) : []), [model]);

  const toggleRow = useCallback((rowId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(rowId)) next.add(rowId);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === visibleRows.length ? new Set() : new Set(visibleRows.map((r) => r.id)),
    );
  }, [visibleRows]);

  /** Removing a person is a change to WHO is on the list, so it asks first — and names who,
   *  because "delete this row?" is not something anyone can answer confidently. */
  const onDeleteRow = useCallback(
    (rowId: string) => {
      const row = model?.tabs[active]?.find((r) => r.id === rowId);
      if (!row) return;
      const name = [row.data.first_name, row.data.last_name].filter(Boolean).join(" ").trim();
      setDeleting({ rowId, label: name || row.data.email || "this row" });
    },
    [model, active],
  );

  const confirmDelete = useCallback(() => {
    if (model && deleting) apply(removeRows(model, active, [deleting.rowId], ref, config));
    setDeleting(null);
  }, [model, deleting, active, ref, config, apply]);

  /** Review: every check runs as a visible step, and only a list that passes is offered
   *  "Add to Salesforce". Never blocked, always EXPLAINED — a failed step names what it
   *  found, under the step that found it.
   *
   *  The steps report real results; the pause between them only keeps each one on screen
   *  long enough to read, since most finish in a few milliseconds. */
  async function startReview() {
    if (!model) return;
    setError(null);
    setProblems(null);
    setOutcome(null);
    setReview({
      phase: "running",
      canEscalate: false,
      rowCount: totalRows(model),
      localReport: false,
      steps: REVIEW_STEPS.map((s) => ({ ...s, state: "waiting" as const })),
    });
    const mark = (key: string, patch: Partial<ReviewStep>) =>
      setReview((r) => r && { ...r, steps: r.steps.map((s) => (s.key === key ? { ...s, ...patch } : s)) });
    const finish = (patch: Partial<ReviewState>) =>
      setReview((r) =>
        r && {
          ...r,
          ...patch,
          steps: r.steps.map((s) => (s.state === "waiting" || s.state === "running" ? { ...s, state: "skipped" } : s)),
        },
      );

    // 1 · the grid's own rules, in the browser.
    mark("grid", { state: "running" });
    await pause();
    const outstanding = buildReport(model, config);
    if (!outstanding.ok) {
      setReport(null);
      setPendingReport(outstanding);
      const { lines, unusable } = describeIssues(model, config);
      setReportCanEscalate(!unusable);
      mark("grid", { state: "failed", problems: lines });
      // An admin can't edit the list either, so what makes a row unusable — no name, no
      // usable email, consent not confirmed — is not theirs to overrule. Offering "Send
      // to admin" there only led to the server refusing it.
      finish({ phase: "failed", canEscalate: !unusable, localReport: true });
      return;
    }
    mark("grid", { state: "passed" });

    // 2 · what the server checks is what it has STORED.
    mark("save", { state: "running" });
    try {
      await Promise.all([flush(), pause()]);
    } catch (e) {
      mark("save", { state: "failed", problems: [describeError(e)] });
      finish({ phase: "failed" });
      return;
    }
    mark("save", { state: "passed" });

    // 3 · automatic review on the server, revealed one check at a time.
    mark("rows", { state: "running" });
    let result: ReviewResult | null | undefined;
    try {
      result = await reviewMutation.mutateAsync(id);
    } catch (e) {
      mark("rows", { state: "failed", problems: [describeError(e)] });
      finish({ phase: "failed" });
      return;
    }
    for (const check of result?.checks ?? []) {
      mark(check.key, { state: "running" });
      await pause();
      mark(check.key, {
        state: check.status,
        problems: check.problems.map((p) => (p.tab ? `${p.tab} · row ${p.row} — ${p.message}` : p.message)),
      });
    }
    finish({
      phase: result?.passed ? "passed" : "failed",
      canEscalate: Boolean(result?.can_escalate),
      campaign: result?.campaign ?? null,
      rowCount: result?.row_count ?? totalRows(model),
    });
  }

  /** Flush whatever is pending — the server reviews what it has STORED. */
  async function flush() {
    if (!model) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    await save.mutateAsync({ id, payload: toPayload(model), rowCount: totalRows(model) });
  }

  function landed(res: SubmitResult | null | undefined) {
    // A 200 is not success here: `submitted: false` with problems means automatic review
    // refused it — its own checks, or an invariant a stale tab missed.
    if (res?.submitted) {
      setStatus(res.outcome === "approved" ? "Approved" : "Submitted");
      setOutcome(res.outcome ?? null);
      setProblems(null);
    } else {
      setProblems(res?.problems ?? []);
      setCanEscalate(Boolean(res?.can_escalate));
    }
  }

  /** "Add to Salesforce": the server runs the same checks again before it approves, so a
   *  list changed since the review is never approved on stale results. */
  async function submit() {
    if (!model) return;
    try {
      await flush();
      landed(await submitMutation.mutateAsync(id));
    } catch (e) {
      // Says why — "the list changed while it was being checked" among them.
      setError(describeEventsError(e));
    }
    setReview(null);
  }

  /** Save a corrected campaign URL and re-stamp every row's Campaign ID from it. Not an
   *  undoable grid edit — it changes the submission, not a cell. */
  async function saveCampaignUrl(url: string) {
    await updateMeta.mutateAsync({
      id,
      body: { event_name: submission.event_name, event_date: submission.event_date ?? null, sf_campaign_url: url || null },
    });
    setCampaignUrl(url);
    setProblems(null);
    if (model) {
      const next = rederive(model, { name: submission.event_name, date: submission.event_date ?? "", campaignUrl: url }, ref, config);
      setModel(next);
      scheduleSave(next);
    }
  }

  /** Save the SDR owner. It belongs to the submission, not to any row. */
  async function saveSdrOwner(email: string) {
    const value = normaliseSdr(email);
    await updateMeta.mutateAsync({
      id,
      body: {
        event_name: submission.event_name,
        event_date: submission.event_date ?? null,
        sf_campaign_url: campaignUrl.trim() || null,
        sdr_owner_email: value || null,
      },
    });
    setSdrOwner(value);
    setProblems(null);
  }

  /** Skip automatic review: the list goes to an admin's queue with the note saying why. */
  async function escalate(note: string) {
    if (!model) return;
    setError(null);
    try {
      await flush();
      landed(await escalateMutation.mutateAsync({ id, note }));
    } catch (e) {
      setError(describeError(e));
    }
    setEscalateOpen(false);
  }

  /** Back to Draft, editable again. The reviewer may have acted in the meantime, which the
   *  server answers with a 409 — say so rather than failing silently. */
  async function withdraw() {
    setError(null);
    try {
      await withdrawMutation.mutateAsync(id);
      setStatus("Draft");
      setConfirming(null);
    } catch (e) {
      setError(describeError(e));
      setConfirming(null);
    }
  }

  const ready = Boolean(model) && totalRows(model!) > 0;
  /** How much work a re-upload would throw away. `past` counts ACTIONS taken, which is
   *  closer to what someone means by "my fixes" than any diff of the data would be. */
  const fixCount = past.length;
  const submitting = submitMutation.isPending || save.isPending;
  const escalating = escalateMutation.isPending || save.isPending;
  const busy = withdrawMutation.isPending;

  return (
    <Box>
      <WorkspaceHead
        title={submission.event_name}
        caption={
          submission.event_date
            ? new Date(submission.event_date).toLocaleDateString(undefined, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : undefined
        }
        onBack={onBack}
        backLabel={backLabel}
        status={<StatusChip status={status} />}
      >
        {ready && editable && (
          <>
            <SaveHint state={saveState} thinking={thinking || checkingTitles} />
            {assisted && (
              <Tooltip
                arrow
                title={
                  rejected
                    ? `Ask again — including the ${rejected} you turned down`
                    : "Ask again for suggestions on anything still unresolved"
                }
              >
                <span>
                  <Button
                    disabled={thinking}
                    sx={quietBtn}
                    startIcon={<Sparkles size={16} />}
                    onClick={() => {
                      if (!model) return;
                      // Asking again means asking about the cells you REFUSED too — that's
                      // the only reason to press this twice. Their answers are stripped on
                      // render while the rejection stands, so it has to lift first or the
                      // round trip is thrown away.
                      const base = unrejectAll(model, ref, config);
                      if (base !== model) apply(base);
                      void askForSuggestions(base);
                    }}
                  >
                    Suggest fixes{rejected ? ` (${rejected})` : ""}
                  </Button>
                </span>
              </Tooltip>
            )}
            <Button
              disabled={uploading}
              sx={quietBtn}
              startIcon={<Upload size={16} />}
              onClick={() => setConfirming("reupload")}
            >
              Re-upload
            </Button>
            {/* The one filled button on the screen: what you came here to do. */}
            <Button
              variant="contained"
              sx={primaryBtn}
              startIcon={<ShieldCheck size={16} />}
              disabled={Boolean(review)}
              onClick={() => void startReview()}
            >
              Review
            </Button>
          </>
        )}
        {/* Awaiting review is the last moment this is still yours. Withdrawing is NOT
            destructive — it returns the list to Draft so a wrong file or a wrong event can
            be fixed without asking the marketing team for a send-back. */}
        {status === "Submitted" && (
          <Button sx={quietBtn} disabled={busy} startIcon={<Undo2 size={16} />} onClick={() => setConfirming("withdraw")}>
            Withdraw
          </Button>
        )}
      </WorkspaceHead>

      {/* The campaign, checked the moment the list opens rather than at Submit: machine
          review refuses a list without a campaign ID, and this is where it is fixed. */}
      {editable &&
        (campaignId && campaignCheck.data?.result !== "not_found" ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              Salesforce campaign{" "}
              <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
                {campaignCheck.data?.campaign?.name ?? ""}
              </Box>{" "}
              <Box component="span" sx={{ fontFamily: "monospace" }}>
                {campaignId}
              </Box>
              {campaignCheck.data?.result === "unavailable" && " · couldn’t check Salesforce just now"}
            </Typography>
            <Button onClick={() => setEditingCampaign(true)} sx={{ ...quietBtn, fontSize: 11.5, minWidth: 0 }}>
              Change
            </Button>
          </Box>
        ) : (
          <Alert
            severity="warning"
            sx={{ mb: 2, fontSize: 13 }}
            action={
              <Button size="small" onClick={() => setEditingCampaign(true)}>
                {campaignUrl.trim() ? "Fix URL" : "Add URL"}
              </Button>
            }
          >
            {campaignId
              ? `Salesforce has no campaign with ID ${campaignId}. Automatic review won’t pass until the URL points to a real campaign.`
              : campaignUrl.trim()
                ? "The Salesforce campaign URL doesn’t contain a campaign ID. Automatic review won’t pass until it does."
                : "No Salesforce campaign URL yet. Automatic review needs one to know where these leads go."}
          </Alert>
        ))}

      {/* The SDR owner: required, so it is asked for here as soon as the list opens. */}
      {editable &&
        (!sdrProblem ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, mt: -0.75 }}>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              SDR owner{" "}
              <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
                {sdrOwner}
              </Box>
            </Typography>
            <Button onClick={() => setEditingSdr(true)} sx={{ ...quietBtn, fontSize: 11.5, minWidth: 0 }}>
              Change
            </Button>
          </Box>
        ) : (
          <Alert
            severity="warning"
            sx={{ mb: 2, fontSize: 13 }}
            action={
              <Button size="small" onClick={() => setEditingSdr(true)}>
                {sdrOwner.trim() ? "Fix" : "Add SDR owner"}
              </Button>
            }
          >
            {sdrOwner.trim()
              ? `${sdrProblem} Automatic review won’t pass until it is.`
              : "No SDR owner yet. Automatic review needs the sales development rep who follows up these leads."}
          </Alert>
        ))}

      {status === "ChangesRequested" && comments.length > 0 && (
        <Box
          sx={{
            border: 1,
            borderColor: "error.main",
            bgcolor: tint(tones.blocking, 0.05),
            borderRadius: 1.25,
            px: 2,
            py: 1.5,
            mb: 2,
          }}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "error.main", mb: 0.5 }}>
            Sent back for changes
          </Typography>
          {comments.map((c) => (
            <Typography key={c.id} sx={{ fontSize: 13, mb: 0.5 }}>
              {c.comment}
              <Box component="span" sx={{ color: "text.secondary", ml: 1, fontSize: 11.5 }}>
                — {c.author_email}
              </Box>
            </Typography>
          ))}
        </Box>
      )}

      {!ready ? (
        <Dropzone
          dragging={dragging}
          uploading={uploading}
          setDragging={setDragging}
          onFile={upload}
          onPick={() => fileRef.current?.click()}
          statuses={liveStatuses(config).map((st) => st.name)}
          accent={tones.accent}
        />
      ) : (
        <>
          {uploadNote && <UploadSummary note={uploadNote} onDismiss={() => setUploadNote(null)} />}

          {/* Expanded, everything from the tab rail down becomes the window: the same rail,
              strip and grid, with the page header and summaries out of the way. The grid
              fills what's left rather than measuring for it. */}
          <Box sx={expanded ? EXPANDED : undefined}>
            {expanded && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
                  {submission.event_name}
                </Typography>
                {ready && editable && <SaveHint state={saveState} thinking={thinking || checkingTitles} />}
                <Button sx={quietBtn} startIcon={<Minimize2 size={16} />} onClick={() => setExpanded(false)}>
                  Exit full screen
                </Button>
              </Box>
            )}

            {/* Which list you're looking at. The badge is only ever what needs attention — a
                row count next to a tab name is a number nobody acts on — and it says so on
                hover, because a bare number beside a tab name could mean anything. */}
            <TabRail
              tabs={Object.keys(model!.tabs)
                .filter((t) => model!.tabs[t]?.length)
                .map((t) => {
                  const c = countsFor(model!.tabs[t]);
                  // A DOT, not a count. Which cells and why is on the issue bar directly
                  // below, field by field; all the rail needs to say is whether a tab still
                  // has something on it. Red when only a person can answer, quiet when
                  // everything left has a suggestion waiting.
                  return {
                    key: t,
                    label: t,
                    dot: c.total ? (c.needsYou ? tones.blocking : tones.suggested) : undefined,
                    title: !c.total
                      ? "Nothing left to fix"
                      : [
                          c.fixable && `${c.fixable} suggested ${c.fixable === 1 ? "fix" : "fixes"} waiting`,
                          c.needsYou && `${c.needsYou} only you can answer`,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                  };
                })}
              value={active}
              onChange={setActive}
            />

            <AttendeeGrid
              rows={visibleRows}
              measureRows={rows}
              rowNumber={(r) => positions.get(r.id) ?? 0}
              tab={active}
              editable={editable}
              busy={false}
              onEdit={onEdit}
              onAccept={onAccept}
              onReject={onReject}
              onDeleteRow={onDeleteRow}
              jumpTo={jumpTo ?? undefined}
              jumpToRow={jumpToRow ?? undefined}
              focusField={jumpTo?.field}
              optionsFor={optionsFor}
              attached
              leavingRows={leaving}
              config={config}
              selected={editable ? selected : undefined}
              onToggleRow={editable ? toggleRow : undefined}
              onToggleAll={editable ? toggleAll : undefined}
              fill={expanded}
              toolbar={
                <>
                  {editable ? (
                    <>
                      <Tooltip title="Undo (⌘Z)" arrow>
                        <span>
                          <IconButton
                            size="small"
                            disabled={!past.length}
                            onClick={undo}
                            aria-label="Undo"
                            sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                          >
                            <Undo2 size={16} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Redo (⇧⌘Z)" arrow>
                        <span>
                          <IconButton
                            size="small"
                            disabled={!future.length}
                            onClick={redo}
                            aria-label="Redo"
                            sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                          >
                            <Redo2 size={16} />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Box sx={{ width: "1px", alignSelf: "stretch", bgcolor: "divider", my: 0.5, mx: 0.5 }} />
                      {/* One value down a whole column is the commonest real correction — one
                          AM for the event, one blank opt-in column. */}
                      <Tooltip title="Set a column to one value on many rows" arrow>
                        <Button
                          sx={{ ...quietBtn, fontSize: 11.5, minWidth: 0, px: 1 }}
                          startIcon={<PaintBucket size={14} />}
                          onClick={() =>
                            setFilling({
                              // The column you're looking at, then the first that needs
                              // attention, then simply the first — always something sensible
                              // already chosen rather than an empty picker.
                              field: (jumpTo?.field ??
                                issueGroups[0]?.field ??
                                columnsFor(rows, active, config)[0]) as Field,
                              scope: selected.size ? "selected" : issueGroups.length ? "flagged" : "all",
                            })
                          }
                        >
                          Fill{selected.size ? ` ${selected.size}` : ""}
                        </Button>
                      </Tooltip>
                      {/* One job: get back OUT of a column. Picking a field in the bar below
                          highlights AND filters in one click, so there's nothing left for this
                          button to toggle on. */}
                      {pinned && (
                        <Tooltip arrow title="Show every row again and clear the highlight">
                          <Button
                            sx={{ ...quietBtn, fontSize: 11.5, minWidth: 0, px: 1, color: "primary.main" }}
                            startIcon={<FilterX size={15} />}
                            onClick={() => {
                              setPinned(null);
                              setJumpTo(null);
                            }}
                          >
                            Show all
                          </Button>
                        </Tooltip>
                      )}
                      <ChangeListButton
                        changes={changes}
                        config={config}
                        onJump={(tab, rowId, field) => {
                          if (tab !== active) setActive(tab);
                          // Clear the filter first: the row being looked for is SETTLED, so a
                          // problems-only view is exactly the view it isn't in.
                          setPinned(null);
                          setJumpTo({ field, nonce: (jumpTo?.nonce ?? 0) + 1 });
                          setJumpToRow({ rowId, nonce: (jumpToRow?.nonce ?? 0) + 1 });
                        }}
                      />
                      <Box sx={{ width: "1px", alignSelf: "stretch", bgcolor: "divider", my: 0.5, mx: 0.5 }} />
                      <IssueBar
                        groups={issueGroups}
                        editable={editable}
                        activeField={jumpTo?.field}
                        onAccept={onAccept}
                        onReject={onReject}
                        onReviewTitles={() => setReviewingTitles(true)}
                        onJump={(field) => {
                          const off = jumpTo?.field === field;
                          setJumpTo(off ? null : { field, nonce: (jumpTo?.nonce ?? 0) + 1 });
                          // Picking a field means "show me these", in ONE click — it both
                          // highlights the column and filters to the rows wrong in it. It used
                          // to only highlight, leaving the filter as a second click most people
                          // never made; they scrolled a thousand rows hunting for five red cells
                          // instead.
                          //
                          // Nothing to hide is the one exception: if every row is wrong here the
                          // filter would show the same grid, so it stays off rather than
                          // pretending to act.
                          const wouldHide = rows.some((r) => !broken(r, field));
                          setPinned(off || !wouldHide ? null : { field });
                        }}
                      />
                    </>
                  ) : null}
                  {/* Always there, read-only included: a long list is as hard to READ in a
                      short frame as it is to fix. */}
                  <Tooltip title={expanded ? "Exit full screen (Esc)" : "Full screen"} arrow>
                    <IconButton
                      size="small"
                      onClick={() => setExpanded((v) => !v)}
                      aria-label={expanded ? "Exit full screen" : "Full screen"}
                      sx={{ ml: "auto", color: "text.secondary", "&:hover": { color: "primary.main" } }}
                    >
                      {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </IconButton>
                  </Tooltip>
                </>
              }
            />

            {pinned && (
              <Typography sx={{ fontSize: 11.5, color: "primary.main", fontWeight: 600, mt: 1 }}>
                Showing the {visibleRows.length} of {rows.length} rows that still need
                {pinned.field ? (
                  <>
                    {" "}
                    a <b>{labelOf(config, active, pinned.field)}</b> fix
                  </>
                ) : (
                  <> attention</>
                )}
                . Each one leaves as you fix it, and the full list returns when they're gone.
              </Typography>
            )}
            {!expanded && (
              <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 1.25 }}>
                Click a cell to edit · ↑ ↓ and Tab to move · drag a column edge to widen · hover a row
                number to remove it. Green is a suggested value — accept it on the cell, or a whole column
                from the strip above. To add someone, update the Google Sheet and re-upload.
              </Typography>
            )}
          </Box>
        </>
      )}

      <ReportDialog
        report={report}
        canEscalate={reportCanEscalate}
        onClose={() => setReport(null)}
        onGoTo={(tab, field) => {
          setReport(null);
          setActive(tab);
          setJumpTo((j) => ({ field, nonce: (j?.nonce ?? 0) + 1 }));
        }}
        onEscalate={() => {
          setReport(null);
          setEscalateOpen(true);
        }}
      />

      {problems && (
        <ProblemList
          problems={problems}
          canEscalate={canEscalate}
          onEscalate={() => setEscalateOpen(true)}
          onDismiss={() => setProblems(null)}
        />
      )}
      {outcome && (
        <Alert severity="success" sx={{ mt: 2, fontSize: 13 }} onClose={() => setOutcome(null)}>
          {outcome === "approved"
            ? "Review complete — approved."
            : outcome === "returned"
              ? "Review passed. An admin sent this list back earlier, so it goes back to an admin to approve — you can withdraw it until they do."
              : "Sent to an admin with your note. They'll approve it or send it back — you can withdraw it until they do."}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2, fontSize: 13 }}>
          {error}
        </Alert>
      )}

      {/* Re-upload silently replaced everything, including every fix already made — so it
          says HOW MANY, which is the number that decides the answer. */}
      <ConfirmDialog
        open={confirming === "reupload"}
        title="Replace this list?"
        confirmLabel="Choose a file"
        body={
          <>
            The uploaded file replaces every row currently here
            {fixCount > 0 && (
              <>
                {" "}
                — including the <b>{fixCount}</b> {fixCount === 1 ? "correction" : "corrections"} you've
                made
              </>
            )}
            . Anything not in the new file is gone.
          </>
        }
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          fileRef.current?.click();
        }}
      />

      {review && (
        <ReviewDialog
          review={review}
          submitting={submitting}
          onClose={() => setReview(null)}
          onAdd={() => void submit()}
          onEscalate={() => {
            setReview(null);
            setEscalateOpen(true);
          }}
          onShowWhere={() => {
            setReview(null);
            setReport(pendingReport);
          }}
        />
      )}

      <FillDialog
        // Keyed on the target so reopening for a different column starts fresh.
        key={filling ? `${filling.field}:${filling.scope}` : "none"}
        target={filling}
        rows={rows}
        tab={active}
        columns={columnsFor(rows, active, config)}
        selected={selected}
        config={config}
        optionsFor={optionsFor}
        onClose={() => setFilling(null)}
        onApply={onFill}
      />

      <TitleDialog
        open={reviewingTitles}
        pending={titlesLeft}
        onAnswer={onAnswerTitle}
        onClose={() => setReviewingTitles(false)}
      />

      {editingCampaign && (
        <CampaignDialog
          initial={campaignUrl}
          onCancel={() => setEditingCampaign(false)}
          onSave={async (url) => {
            await saveCampaignUrl(url);
            setEditingCampaign(false);
          }}
        />
      )}

      {editingSdr && (
        <SdrOwnerDialog
          initial={sdrOwner}
          onCancel={() => setEditingSdr(false)}
          onSave={async (email) => {
            await saveSdrOwner(email);
            setEditingSdr(false);
          }}
        />
      )}

      {escalateOpen && (
        <EscalateDialog
          open
          busy={escalating}
          onCancel={() => setEscalateOpen(false)}
          onSend={(note) => void escalate(note)}
        />
      )}

      <ConfirmDialog
        open={confirming === "withdraw"}
        title="Take this back?"
        confirmLabel={busy ? "Withdrawing…" : "Withdraw"}
        busy={busy}
        body={
          <>
            The list leaves the marketing team's queue and becomes editable again. Nothing is deleted
            — you can fix it and submit it a second time. If they've already approved it, this won't
            work and you'll need to ask them to send it back.
          </>
        }
        onCancel={() => setConfirming(null)}
        onConfirm={() => void withdraw()}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remove this person?"
        confirmLabel="Remove"
        tone="danger"
        body={
          <>
            <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
              {deleting?.label}
            </Box>{" "}
            will be dropped from {active} and won't reach Pardot. The Google Sheet is untouched, so a
            re-upload brings them back.
          </>
        }
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />

      <Box
        component="input"
        ref={fileRef}
        type="file"
        accept=".xlsx,.xlsm"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
        sx={{ display: "none" }}
      />
    </Box>
  );
}

function SaveHint({ state, thinking }: { state: "idle" | "saving" | "saved"; thinking: boolean }) {
  const text = thinking
    ? "Looking at the odd values…"
    : state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved"
        : "";
  if (!text) return null;
  return (
    <Typography
      sx={{
        fontSize: 11.5,
        color: "text.secondary",
        mr: 0.5,
        display: "flex",
        alignItems: "center",
        gap: 0.5,
      }}
    >
      {thinking && (
        <Box sx={{ color: "text.disabled", display: "inline-flex" }}>
          <Sparkles size={12} />
        </Box>
      )}
      {text}
    </Typography>
  );
}

function Dropzone({
  dragging,
  uploading,
  setDragging,
  onFile,
  onPick,
  statuses,
  accent,
}: {
  dragging: boolean;
  uploading: boolean;
  setDragging: (v: boolean) => void;
  onFile: (f: File) => void | Promise<void>;
  onPick: () => void;
  // The tab names that will be read. Shown BEFORE the file is chosen, because this is the
  // one rule that decides whether an upload works, and learning it from an error afterwards
  // means renaming tabs and starting again. A real workbook lost 198 people to tabs called
  // "Event attendees" and "Booth Attendees" — a glance at this list would have prevented it.
  statuses: string[];
  accent: string;
}) {
  return (
    <Box
      onClick={onPick}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void onFile(f);
      }}
      sx={{
        border: 1,
        borderStyle: "dashed",
        borderRadius: 1.25,
        px: 3,
        py: 8,
        textAlign: "center",
        cursor: uploading ? "default" : "pointer",
        borderColor: dragging ? "primary.main" : "divider",
        bgcolor: dragging ? tint(accent, 0.03) : "transparent",
        transition: "border-color .12s, background-color .12s",
        "&:hover": uploading ? undefined : { borderColor: "primary.main" },
      }}
    >
      {uploading ? (
        // Parsing a workbook takes a few seconds on a full template, and a bare spinner for
        // that long says only "something is happening" — this says what.
        <EventsLoading messages={EVENTS_LOADING.workbook} />
      ) : (
        <>
          <Box sx={{ color: "text.disabled", display: "inline-flex", mb: 1 }}>
            <Upload size={30} />
          </Box>
          <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
            Drop your filled List Import Template here
          </Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>
            .xlsx — read here in your browser, nothing is sent until you save
          </Typography>

          {/* The names are on their own line and the sentence on another. Running them
              together as one wrapping sentence broke mid-clause at most widths — the
              trailing half landed alone on a second line and read as if cut off. */}
          {statuses.length > 0 && (
            <Box sx={{ mt: 3, maxWidth: 520, mx: "auto" }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6, justifyContent: "center" }}>
                {statuses.map((name) => (
                  <Box
                    key={name}
                    component="span"
                    sx={{
                      px: 0.9,
                      py: 0.2,
                      borderRadius: 0.5,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "text.primary",
                      bgcolor: "action.hover",
                    }}
                  >
                    {name}
                  </Box>
                ))}
              </Box>
              <Typography sx={{ fontSize: 11.5, color: "text.secondary", mt: 1 }}>
                Only tabs with these names are read. Anything else stays in your workbook.
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

// What the upload left BEHIND.
//
// Only that. What came in is on the screen already — the tab rail says which statuses
// arrived and the counts are on it, so repeating them here was a paragraph describing
// something the reader could see. Two earlier versions did exactly that and neither survived
// contact with someone trying to get on with their work.
//
// So this is a list of OMISSIONS and nothing else, and when there are none it doesn't render
// at all. A clean import should be silent.
//
// And it is ONE LINE, however many omissions there are. It used to list each one in place,
// which on a messy workbook was a dozen lines pushing the grid off the bottom of the screen
// — the thing you came to work in, made smaller by a note about what you didn't. The line
// says how much was left behind; the list itself opens in a side panel, beside the grid
// rather than above it.
function UploadSummary({ note, onDismiss }: { note: ParsedWorkbook; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  const lostTabs = note.skipped.filter((x) => x.rowCount > 0);
  const lostCols = note.tabs.flatMap((t) =>
    t.undefinedHeaders.filter((h) => h.filled > 0).map((h) => ({ tab: t.tab, ...h })),
  );

  if (!lostTabs.length && !lostCols.length) return null;

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const what = [
    lostTabs.length && plural(lostTabs.length, "tab", "tabs"),
    lostCols.length && plural(lostCols.length, "column", "columns"),
  ]
    .filter(Boolean)
    .join(" and ");
  const lostRows = lostTabs.reduce((n, x) => n + x.rowCount, 0);
  // Columns grouped under their tab: the same heading left behind on four tabs is one
  // decision, and reading it as four unrelated lines hides that.
  const colsByTab = lostCols.reduce<Record<string, typeof lostCols>>((acc, h) => {
    (acc[h.tab] ??= []).push(h);
    return acc;
  }, {});

  return (
    <>
      <Panel
        sx={{
          px: 1.5,
          py: 0.75,
          mb: 2,
          borderLeft: 3,
          borderLeftColor: "warning.main",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box sx={{ color: "warning.main", display: "inline-flex", flexShrink: 0 }}>
          <TriangleAlert size={15} />
        </Box>
        <Typography sx={{ fontSize: 13, flex: 1, minWidth: 0 }} noWrap>
          <b>{what}</b> {lostTabs.length + lostCols.length === 1 ? "wasn't" : "weren't"} imported
          {lostRows > 0 && (
            <Box component="span" sx={{ color: "text.secondary" }}>
              {" "}
              — including {plural(lostRows, "row", "rows")} on tabs that aren't member statuses
            </Box>
          )}
        </Typography>
        <Button onClick={() => setOpen(true)} sx={{ ...quietBtn, fontSize: 12, minWidth: 0 }}>
          Show details
        </Button>
        <Button onClick={onDismiss} sx={{ ...quietBtn, fontSize: 12, minWidth: 0 }}>
          Dismiss
        </Button>
      </Panel>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: { xs: "100vw", sm: 420 }, p: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, flex: 1 }}>Not imported</Typography>
            <IconButton size="small" onClick={() => setOpen(false)} aria-label="Close">
              <X size={16} />
            </IconButton>
          </Box>

          {lostTabs.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography sx={SECTION}>Tabs</Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1 }}>
                A tab is imported only when its name is a member status under Settings → Events.
              </Typography>
              {lostTabs.map((x) => (
                <Box key={x.name} sx={LINE}>
                  <Box sx={{ color: "error.main", display: "inline-flex", flexShrink: 0 }}>
                    <Table2 size={13} />
                  </Box>
                  <Typography sx={{ fontSize: 13 }}>
                    <b>{x.name}</b>
                    <Box component="span" sx={{ color: "text.secondary" }}>
                      {" "}
                      — {plural(x.rowCount, "row", "rows")}
                    </Box>
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {lostCols.length > 0 && (
            <Box>
              <Typography sx={SECTION}>Columns</Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1 }}>
                A heading is imported only when it is one of that status' columns under Settings →
                Events.
              </Typography>
              {Object.entries(colsByTab).map(([tab, cols]) => (
                <Box key={tab} sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.25 }}>{tab}</Typography>
                  {cols.map((h) => (
                    <Box key={h.header} sx={LINE}>
                      <Box sx={{ color: "warning.main", display: "inline-flex", flexShrink: 0 }}>
                        <Columns3 size={13} />
                      </Box>
                      <Typography sx={{ fontSize: 13 }}>
                        <b>{h.header}</b>
                        <Box component="span" sx={{ color: "text.secondary" }}>
                          {" "}
                          — {plural(h.filled, "value", "values")}
                        </Box>
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Drawer>
    </>
  );
}

const SECTION = {
  fontSize: 11,
  fontWeight: 700,
  color: "text.secondary",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  mb: 0.5,
} as const;

/** The Review steps, in the order they run. The last five are the server's checks and
 *  share its keys; their labels match the server's so nothing changes when results land. */
const REVIEW_STEPS: Omit<ReviewStep, "state">[] = [
  { key: "grid", label: "Every cell matches the template" },
  { key: "save", label: "Your latest changes are saved" },
  { key: "rows", label: "Every row has a name, a valid email and confirmed opt-in" },
  { key: "duplicates", label: "No one is listed twice" },
  { key: "sdr", label: "An SDR owner is set" },
  { key: "titles", label: "Job titles are in English" },
  { key: "campaign", label: "The campaign exists in Salesforce" },
];

/** Fields whose problems make a row unusable — the server's invariants (invariants.check).
 *  A duplicate is not among them: that one an admin may judge. */
const UNUSABLE_FIELDS = new Set<string>([SPECIAL.firstName, SPECIAL.lastName, SPECIAL.email, SPECIAL.optInStatus]);

/** The grid's problems, one line per distinct message, with the rows that have it.
 *
 *  Grouped by the message itself rather than by column: a column's report used to show
 *  its FIRST row's message for every row ("hasn't confirmed opt-in (6 rows)" when five
 *  of the six were misspellings). The message carries the value, so identical values
 *  still group, and different ones are said separately. */
function describeIssues(model: Model, config: EventsConfig): { lines: string[]; unusable: boolean } {
  const lines: string[] = [];
  let unusable = false;
  for (const [tab, rows] of Object.entries(model.tabs)) {
    const groups = new Map<string, number[]>();
    rows.forEach((row, i) => {
      for (const issue of row.issues) {
        if (UNUSABLE_FIELDS.has(issue.field) && issue.code !== "duplicate") unusable = true;
        const key = `${labelOf(config, tab, issue.field)} — ${issue.message}`;
        groups.set(key, [...(groups.get(key) ?? []), i + 1]);
      }
    });
    for (const [key, at] of groups) {
      const shown = at.length > 8 ? `${at.slice(0, 8).join(", ")} and ${at.length - 8} more` : at.join(", ");
      lines.push(`${tab} · ${key} (${at.length === 1 ? "row" : "rows"} ${shown})`);
    }
  }
  return { lines, unusable };
}

/** Long enough to read a step before the next one starts. */
const pause = () => new Promise((resolve) => setTimeout(resolve, 450));

/** The expanded view: rail, strip and grid over the whole window. Above the page and its
 *  side panels (drawers are 1200), below dialogs and popovers (1300+), which open from
 *  inside it — Fill, the pick-list editor, the submit report. */
const EXPANDED = {
  position: "fixed",
  inset: 0,
  zIndex: 1250,
  bgcolor: "background.default",
  p: 2,
  display: "flex",
  flexDirection: "column",
} as const;

const LINE = { display: "flex", alignItems: "center", gap: 0.75, mt: 0.4 };

/** Automatic review refused the submission. Two cases, worded differently: its own checks
 *  (fix and resubmit, or send it to an admin), or an invariant the browser should have
 *  caught — in practice a stale tab, so say so rather than implying the user erred. */
function ProblemList({
  problems,
  canEscalate,
  onEscalate,
  onDismiss,
}: {
  problems: Problem[];
  canEscalate: boolean;
  onEscalate: () => void;
  onDismiss: () => void;
}) {
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "error.main",
        borderRadius: 1.25,
        px: 2,
        py: 1.5,
        mt: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.75 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: "error.main" }}>
          {canEscalate ? "Automatic review didn't pass" : "The server wouldn't accept this yet"}
        </Typography>
        {canEscalate && (
          <Button onClick={onEscalate} sx={{ ...quietBtn, ml: "auto", fontSize: 11.5 }}>
            Send to admin
          </Button>
        )}
        <Button
          onClick={onDismiss}
          sx={{ ...quietBtn, ml: canEscalate ? 0 : "auto", minWidth: 0, fontSize: 11.5 }}
        >
          Dismiss
        </Button>
      </Box>
      <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 1 }}>
        {canEscalate
          ? "Fix these and submit again. If you're sure the list is right as it is, send it to an admin with a note saying why."
          : "This usually means the page has been open a while. Reload and try again — if it persists, these are the rows it objected to."}
      </Typography>
      {problems.slice(0, 10).map((p, i) => (
        <Typography key={i} sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
          {p.tab ? `${p.tab} · row ${p.row} — ` : ""}
          {p.message}
        </Typography>
      ))}
    </Box>
  );
}

/** What's left before this list can go. Grouped by tab and field, with the ones we can fix
 *  separated from the ones only you can answer — and every line is a WAY TO GET THERE, not
 *  just a complaint. */
function ReportDialog({
  report,
  canEscalate,
  onClose,
  onGoTo,
  onEscalate,
}: {
  report: Report | null;
  /** False when a problem makes rows unusable: an admin can't fix those either. */
  canEscalate: boolean;
  onClose: () => void;
  onGoTo: (tab: Tab, field: string) => void;
  /** The way out when the rules are wrong about this list — an admin decides instead. */
  onEscalate: () => void;
}) {
  const tones = useToneColors();
  if (!report) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800 }}>Not ready to submit yet</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
          {report.fixable > 0 && report.blocking > 0
            ? `${report.fixable} we can fix for you, ${report.blocking} that need your answer.`
            : report.fixable > 0
              ? `${report.fixable} we can fix for you — accept them and you're done.`
              : `${report.blocking} need your answer.`}
        </Typography>

        {report.lines.map((line, i) => (
          <Box
            key={i}
            component="button"
            type="button"
            onClick={() => onGoTo(line.tab, line.field)}
            sx={{
              display: "flex",
              width: "100%",
              textAlign: "left",
              alignItems: "baseline",
              gap: 1.5,
              py: 1,
              cursor: "pointer",
              border: 0,
              borderTop: i === 0 ? 0 : 1,
              borderColor: "divider",
              bgcolor: "transparent",
              fontFamily: "inherit",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                flexShrink: 0,
                bgcolor: line.fixable ? tones.suggested : tones.blocking,
                mt: 0.75,
              }}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                {line.tab} · {line.label}
                <Box
                  component="span"
                  sx={{
                    ml: 1,
                    fontWeight: 500,
                    color: "text.secondary",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {line.rows.length} {line.rows.length === 1 ? "row" : "rows"}
                </Box>
              </Typography>
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                {line.fixable ? "A suggestion is waiting — " : ""}
                {line.message}
              </Typography>
              <Typography
                sx={{ fontSize: 11, color: "text.secondary", mt: 0.25, fontVariantNumeric: "tabular-nums" }}
              >
                {line.rows.length > 12
                  ? `rows ${line.rows.slice(0, 12).join(", ")} and ${line.rows.length - 12} more`
                  : `row${line.rows.length === 1 ? "" : "s"} ${line.rows.join(", ")}`}
              </Typography>
            </Box>
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {canEscalate && (
          <Tooltip arrow title="When you're sure the list is right and the checks are wrong about it">
            <Button onClick={onEscalate} sx={{ ...quietBtn, mr: "auto" }}>
              Send to admin instead
            </Button>
          </Tooltip>
        )}
        <Button variant="contained" onClick={onClose} sx={primaryBtn}>
          Back to the list
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Change the submission's Salesforce campaign URL. Mounted only while open, so it
 *  starts from the saved value every time. Saving a URL with no campaign ID is refused —
 *  that is exactly what automatic review would refuse later. */
function CampaignDialog({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Refused: a link with no campaign ID, or one Salesforce says doesn't exist. Allowed
  // while unchecked or unreachable — automatic review asks again at submit.
  const check = useCampaignCheck(campaignIdFrom(url));
  const invalid =
    campaignUrlHint(url, { checking: check.isFetching, check: check.data }).tone === "error" || check.isFetching;
  return (
    <Dialog open onClose={() => !busy && onCancel()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800 }}>Salesforce campaign</DialogTitle>
      <DialogContent>
        <CampaignUrlField value={url} onChange={setUrl} disabled={busy} autoFocus />
        {error && (
          <Alert severity="error" sx={{ mt: 1.5, fontSize: 13 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} sx={quietBtn}>
          Cancel
        </Button>
        <Button
          variant="contained"
          sx={primaryBtn}
          disabled={busy || invalid || url.trim() === initial.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onSave(url.trim());
            } catch (e) {
              setError(describeError(e));
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Set the SDR owner. Mounted only while open, so it starts from the saved value. Only a
 *  WSO2 address can be saved — anything else automatic review would refuse. */
function SdrOwnerDialog({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unchanged = normaliseSdr(email) === normaliseSdr(initial);
  return (
    <Dialog open onClose={() => !busy && onCancel()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800 }}>SDR owner</DialogTitle>
      <DialogContent>
        <SdrOwnerField value={email} onChange={setEmail} disabled={busy} autoFocus />
        {error && (
          <Alert severity="error" sx={{ mt: 1.5, fontSize: 13 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} sx={quietBtn}>
          Cancel
        </Button>
        <Button
          variant="contained"
          sx={primaryBtn}
          disabled={busy || !!sdrOwnerProblem(email) || unchanged}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onSave(email);
            } catch (e) {
              setError(describeError(e));
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Skip automatic review and ask an admin. The note is required: the admin is being asked
 *  to overrule a check, and needs to know which one and why. */
function EscalateDialog({
  open,
  busy,
  onCancel,
  onSend,
}: {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onSend: (note: string) => void;
}) {
  // Mounted only while open (see the caller), so every opening starts with an empty note.
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onClose={() => !busy && onCancel()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 800 }}>Send to an admin?</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.55, mb: 1.5 }}>
          The list skips automatic review and goes to the marketing team's queue. They'll approve it
          or send it back. Say what the checks got wrong, so they know what to look at.
        </Typography>
        <TextField
          autoFocus
          multiline
          minRows={3}
          fullWidth
          size="small"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Gabon is right for these four rows — they're from the Libreville office."
          inputProps={{ maxLength: 2000, "aria-label": "Note for the admin" }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} disabled={busy} sx={quietBtn}>
          Cancel
        </Button>
        <Button
          variant="contained"
          sx={primaryBtn}
          disabled={busy || !note.trim()}
          onClick={() => onSend(note.trim())}
        >
          {busy ? "Sending…" : "Send to admin"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
