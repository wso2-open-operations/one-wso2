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

// The working copy of a list, and every operation on it.
//
// This is the heart of the rewrite. Accept, reject, edit and delete are **pure
// functions over local state** — the same shape as accepting an inline suggestion in an
// editor. No request, no spinner, no re-render of the world. The server is involved
// exactly twice: once to ask the model about values our own rules could not resolve,
// and once to save.
//
// Validation is recomputed from the rows on every change, which is cheap (string
// comparison over a few hundred rows) and means a stale "all clear" can never survive
// an edit that broke something.

import { COMPUTED_FIELDS, type EventsConfig, type Field, type Tab } from './schema'
import type { Reference } from './reference'
import { deriveAll, validateRows, type EventContext, type Issue, type Row } from './validate'
import { NOT_ENGLISH, TITLE_FIELD, titleIssue, titleKey, type Translation } from './titles'

export interface GridRow {
  /** Stable within the session, for React keys and cell addressing. Not persisted —
   *  rejections are keyed by position instead, which survives a save. */
  id: string
  data: Row
  issues: Issue[]
  /** The row as it arrived, before anybody touched it.
   *
   *  Captured AFTER deriving, so it is what MOP first put on screen — the diff against
   *  it is therefore the human's work, not ours. It exists so someone can answer "what
   *  did I change?" at the end of an hour of fixing, which is otherwise unanswerable:
   *  accepting a column of suggestions is one click and forty silent edits. */
  original: Row
}

export interface Model {
  tabs: Record<string, GridRow[]>
  /** Suggestions the server worked out, keyed by what they are ABOUT rather than where
   *  they were found: `field|value|context`.
   *
   *  This has to be held separately because validation rebuilds every issue from
   *  scratch on each change, which used to throw the server's answers away — accept one
   *  of five country fixes and the other four lost their suggestion and went red.
   *
   *  Keying by value rather than position also means one answer covers every cell that
   *  says the same thing, and survives edits and row deletions. */
  suggestions: Record<string, string>
  /** Suggestions the user rejected, as "Tab|rowIndex|field".
   *
   *  Keyed by POSITION rather than row id because ids are session-local: a rejection
   *  has to survive a save and reload, and row order within a payload does not change.
   *  Rejecting is not fixing — the value stays as it was, so the cell stays flagged and
   *  keeps blocking submission. It simply stops being something we claim to know. */
  dismissed: Set<string>
  /** Job titles that are not in English, by titleKey, as the server answered. Held like
   *  `suggestions`: asked once per session, re-attached on every revalidation. */
  translations: Record<string, Translation>
}

export interface Payload {
  tabs: Record<string, Row[]>
  dismissed?: string[]
  /** Every cell that differs from what was imported, so the change list survives a save
   *  and is there for the reviewer too.
   *
   *  The changes are stored rather than a second copy of the data: a list of edits is
   *  small, a duplicate payload is not, and the original is recoverable either way —
   *  `from` is precisely what the cell used to hold. Keyed by row POSITION for the same
   *  reason `dismissed` is: ids are session-local. */
  changes?: StoredChange[]
}

/** One cell someone changed, as stored. */
export interface StoredChange {
  tab: string
  /** Position in the tab, matching the stored row order. */
  row: number
  field: string
  from: string
  to: string
}

/** One cell someone changed, resolved for display. */
export interface Change extends StoredChange {
  rowId: string
  /** Enough of the person to recognise them without opening the row. */
  who: string
}

export const dismissKey = (tab: string, rowIndex: number, field: string) =>
  `${tab}|${rowIndex}|${field}`

/** What a suggestion is about: the field, the offending value, and the fact that
 *  disambiguates it (for a state, the country). "TN" in India and "TN" in the US are
 *  deliberately different keys. */
export const suggestionKey = (field: string, value: string, context = '') =>
  `${field}|${value.trim().toLowerCase()}|${context}`

let nextId = 0
const newId = () => `r${++nextId}`

// ---- building ---------------------------------------------------------------------------------

/** Build a working copy from parsed or loaded rows, deriving and validating as we go. */
export function build(rowsByTab: Record<string, Row[]>, event: EventContext,
                      ref: Reference, config: EventsConfig, dismissed = new Set<string>(),
                      suggestions: Record<string, string> = {},
                      changes: StoredChange[] = []): Model {
  const state: Findings = { dismissed, suggestions, translations: {} }
  const tabs: Record<string, GridRow[]> = {}

  // Rebuild each row's "as imported" state by undoing the recorded changes. Storing the
  // edits rather than a second copy of every row keeps the payload small, and this is
  // exact: `from` is what the cell held before it was touched.
  const undo = new Map<string, Row>()
  for (const c of changes) {
    const key = `${c.tab}|${c.row}`
    undo.set(key, { ...(undo.get(key) ?? {}), [c.field]: c.from })
  }

  // Whatever the payload carries, in its own order. There is no fixed list of statuses
  // to iterate any more — an admin configures them.
  for (const [tab, rows] of Object.entries(rowsByTab)) {
    if (!rows?.length) continue
    const derived = deriveAll(rows, tab, event, config)
    tabs[tab] = withIssues(
      derived.map((data, i) => ({
        id: newId(), data, issues: [],
        original: { ...data, ...(undo.get(`${tab}|${i}`) ?? {}) },
      })), tab, ref, config, state)
  }
  return { tabs, ...state }
}

/** Every cell that differs from what was imported, in tab and row order.
 *
 *  Derived rather than accumulated. An accumulated log has to be kept honest through
 *  undo, redo, re-derive and a value edited back to what it was — four places to get it
 *  wrong. A diff cannot drift: if the cell says what it always said, it is not a change,
 *  whatever route it took to get there. */
export function changesOf(model: Model): Change[] {
  const out: Change[] = []
  // Computed cells are MOP's, not anyone's edit — they are read-only in the grid, and
  // re-deriving after an event is renamed rewrites them on every row. Counting those
  // would bury a handful of real corrections under three hundred entries nobody made.
  const mine = new Set(COMPUTED_FIELDS)
  for (const [tab, rows] of Object.entries(model.tabs)) {
    rows.forEach((r, index) => {
      const fields = new Set([...Object.keys(r.original), ...Object.keys(r.data)])
      for (const field of fields) {
        if (mine.has(field)) continue
        const from = r.original[field] ?? ''
        const to = r.data[field] ?? ''
        if (from === to) continue
        out.push({ tab, row: index, field, from, to, rowId: r.id, who: nameOf(r.data) })
      }
    })
  }
  return out
}

/** Enough of a person to recognise them in a list of changes. */
function nameOf(data: Row): string {
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim()
  return name || data.email || '(unnamed row)'
}

/** Recompute issues for one tab, returning NEW rows.
 *
 *  Immutable on purpose. Mutating `row.issues` in place left every row object
 *  identical by reference, so anything memoizing on row identity could keep rendering
 *  the issue a cell no longer has — an accepted suggestion that stayed struck through.
 *
 *  Dismissed cells keep the finding but lose the suggestion, which drops them into
 *  "only you can answer" — the honest consequence of "no, I'll handle this myself".
 */
type Findings = Pick<Model, 'dismissed' | 'suggestions' | 'translations'>

function withIssues(rows: GridRow[], tab: Tab, ref: Reference, config: EventsConfig,
                    { dismissed, suggestions, translations }: Findings): GridRow[] {
  const perRow = validateRows(rows.map(r => r.data), tab, ref, config)
  return rows.map((row, i) => ({
    ...row,
    issues: withTitle(row.data, translations, perRow[i].map(issue => {
      if (dismissed.has(dismissKey(tab, i, issue.field))) {
        return { ...issue, suggestion: undefined, source: undefined }
      }
      if (issue.suggestion) return issue
      // Re-attach whatever the server told us about this value. Without this, every
      // local change wiped the answers and the user had to ask again.
      const remembered = suggestions[suggestionKey(issue.field, issue.value, issue.context)]
      return remembered ? { ...issue, suggestion: remembered, source: 'llm' as const } : issue
    })),
  }))
}

/** A row's issues plus its job-title finding, if any. A title that already breaks a
 *  column rule (a pattern, a required value) shows that problem instead — one finding per
 *  cell, and the rule's is the one that must be fixed first. */
function withTitle(data: Row, translations: Record<string, Translation>,
                   issues: Issue[]): Issue[] {
  const title = titleIssue(data[TITLE_FIELD] ?? '', translations)
  return title && !issues.some(i => i.field === TITLE_FIELD) ? [...issues, title] : issues
}

function revalidate(model: Model, ref: Reference, config: EventsConfig): Model {
  const tabs: Record<string, GridRow[]> = {}
  for (const tab of Object.keys(model.tabs)) {
    tabs[tab] = withIssues(model.tabs[tab], tab, ref, config, model)
  }
  return { ...model, tabs }
}

/** Fold the server's answers into the model. They are applied as SUGGESTIONS — the
 *  user still accepts or rejects each one — and remembered so a later edit elsewhere
 *  does not discard them. */
export function applySuggestions(model: Model, answers: {
  key: string; value?: string | null
}[], ref: Reference, config: EventsConfig): Model {
  if (!answers.length) return model
  const suggestions = { ...model.suggestions }

  for (const answer of answers) {
    if (!answer.value) continue
    // The key the request carried is `tab|rowId|field`; find that issue so the
    // suggestion can be stored against its value rather than its position.
    const [tab, rowId, field] = answer.key.split('|')
    const row = model.tabs[tab]?.find(r => r.id === rowId)
    const issue = row?.issues.find(i => i.field === field)
    if (!issue) continue
    suggestions[suggestionKey(field, issue.value, issue.context)] = answer.value
  }
  return revalidate({ ...model, suggestions }, ref, config)
}

/** Fold the server's job-title answers into the model, as suggestions on every cell
 *  holding that title. */
export function applyTranslations(model: Model, answers: {
  key: string; english: string; language?: string | null
}[], ref: Reference, config: EventsConfig): Model {
  if (!answers.length) return model
  const translations = { ...model.translations }
  for (const a of answers) {
    if (a.english) translations[a.key] = { english: a.english, language: a.language ?? null }
  }
  return revalidate({ ...model, translations }, ref, config)
}

// ---- operations (all local, all instant) -------------------------------------------------------

/** Apply the suggestions standing on these cells. One cell and a whole column are the
 *  same operation with a different list.
 *
 *  A job title's translation is the exception that reaches further: accepting it on one
 *  cell answers it on every row with that title. */
export function accept(model: Model, cells: { tab: Tab; rowId: string; field: Field }[],
                       ref: Reference, config: EventsConfig): Model {
  let next: Model = { ...model, tabs: { ...model.tabs },
                      dismissed: new Set(model.dismissed) }
  const titles = new Map<string, string>()

  for (const { tab, rowId, field } of cells) {
    const rows = next.tabs[tab]
    const index = rows?.findIndex(r => r.id === rowId) ?? -1
    if (index < 0) continue
    const issue = rows[index].issues.find(i => i.field === field)
    const suggestion = issue?.suggestion
    if (!suggestion) continue
    if (issue.code === NOT_ENGLISH) {
      titles.set(titleKey(issue.value), suggestion)
      continue
    }

    next.tabs[tab] = rows.map((r, i) =>
      i === index ? { ...r, data: { ...r.data, [field]: suggestion } } : r)
    // Accepting settles the cell, so any earlier rejection of it is moot.
    next.dismissed.delete(dismissKey(tab, index, field))
  }
  for (const [key, english] of titles) next = retitle(next, key, english)
  return revalidate(next, ref, config)
}

/** Replace one job title not in English, on every row that holds it, in every tab, with
 *  the suggested English or the RMM's own. One decision per title — two rows saying
 *  "Directeur Technique" are one question, not two.
 *
 *  There is no keeping it: an empty answer, or the same title typed back in another
 *  case or spacing, changes nothing and the title stays flagged. */
export function answerTitle(model: Model, key: string, answer: string,
                            ref: Reference, config: EventsConfig): Model {
  const value = answer.trim()
  if (!value || titleKey(value) === key) return model
  return revalidate(retitle(model, key, value), ref, config)
}

/** Every row whose title has this key, set to `value`. Not revalidated. */
function retitle(model: Model, key: string, value: string): Model {
  const tabs = { ...model.tabs }
  const dismissed = new Set(model.dismissed)
  for (const [tab, rows] of Object.entries(tabs)) {
    if (!rows.some(r => titleKey(r.data[TITLE_FIELD] ?? '') === key)) continue
    tabs[tab] = rows.map((r, i) => {
      if (titleKey(r.data[TITLE_FIELD] ?? '') !== key) return r
      dismissed.delete(dismissKey(tab, i, TITLE_FIELD))
      return { ...r, data: { ...r.data, [TITLE_FIELD]: value } }
    })
  }
  return { ...model, tabs, dismissed }
}

/** A job title waiting for an answer: one per distinct title, whatever tab it is on. */
export interface PendingTitle {
  key: string
  /** As first typed in the list. */
  title: string
  english: string
  language: string | null
  rows: number
}

/** Every job title still to be answered, in the order the list first mentions them. */
export function pendingTitles(model: Model): PendingTitle[] {
  const out = new Map<string, PendingTitle>()
  for (const rows of Object.values(model.tabs)) {
    for (const r of rows) {
      const issue = r.issues.find(i => i.code === NOT_ENGLISH)
      if (!issue?.suggestion) continue
      const key = titleKey(issue.value)
      const seen = out.get(key)
      if (seen) seen.rows++
      else out.set(key, { key, title: issue.value.trim(), english: issue.suggestion,
                          language: model.translations[key]?.language ?? null, rows: 1 })
    }
  }
  return [...out.values()]
}

/** Dismiss the suggestions on these cells. The value is untouched, so the cell stays
 *  flagged and keeps blocking submission.
 *
 *  Not a job title not in English: its translation can't be turned down (see
 *  titles.ts), and dismissing it would only hide the English the RMM still needs. */
export function reject(model: Model, cells: { tab: Tab; rowId: string; field: Field }[],
                       ref: Reference, config: EventsConfig): Model {
  const next: Model = { ...model, tabs: { ...model.tabs },
                        dismissed: new Set(model.dismissed) }
  for (const { tab, rowId, field } of cells) {
    const index = next.tabs[tab]?.findIndex(r => r.id === rowId) ?? -1
    if (index < 0) continue
    const issue = next.tabs[tab][index].issues.find(i => i.field === field)
    if (issue?.code === NOT_ENGLISH) continue
    next.dismissed.add(dismissKey(tab, index, field))
  }
  return revalidate(next, ref, config)
}

/** Take back every rejection, so refused suggestions can be offered again.
 *
 *  Rejecting is otherwise permanent, and invisibly so: `withIssues` strips the
 *  suggestion off a dismissed cell on EVERY render, so asking the server again returned
 *  a perfectly good answer that was then discarded on its way to the screen. "Suggest
 *  fixes" therefore did nothing at all for the one case anybody would press it for.
 *
 *  All of them rather than a chosen few, because that is what the button means: show me
 *  what you have again. It is a normal undoable step, so it costs one ⌘Z to change your
 *  mind. */
export function unrejectAll(model: Model, ref: Reference, config: EventsConfig): Model {
  if (!model.dismissed.size) return model
  return revalidate({ ...model, dismissed: new Set() }, ref, config)
}

/** How many suggestions are currently turned down. */
export const rejectedCount = (model: Model): number => model.dismissed.size

/** Edit cells directly. Answering a cell yourself clears any rejection on it — the old
 *  proposal no longer refers to anything, and the new value deserves a fresh look. */
export function edit(model: Model, tab: Tab,
                     edits: { rowId: string; field: Field; value: string }[],
                     ref: Reference, config: EventsConfig): Model {
  const next: Model = { ...model, tabs: { ...model.tabs },
                        dismissed: new Set(model.dismissed) }
  const rows = next.tabs[tab]
  if (!rows) return model

  next.tabs[tab] = rows.map((r, i) => {
    const mine = edits.filter(e => e.rowId === r.id)
    if (!mine.length) return r
    const data = { ...r.data }
    for (const e of mine) {
      data[e.field] = e.value
      next.dismissed.delete(dismissKey(tab, i, e.field))
    }
    return { ...r, data }
  })
  return revalidate(next, ref, config)
}

/** Set one field to one value across many rows.
 *
 *  Deliberately a thin wrapper over `edit` rather than a new operation: it produces the
 *  same edit list, so it revalidates the same way, clears rejections the same way, and
 *  lands as a single undo step. Filling 55 cells and undoing it is one press.
 *
 *  This exists because the common shape of a real list is one value repeated down a
 *  whole column — an event with a single account manager, or an opt-in column the
 *  organiser left blank. Correcting that a cell at a time is not a workflow. */
export function fillField(model: Model, tab: Tab, field: Field, value: string,
                          rowIds: string[], ref: Reference,
                          config: EventsConfig): Model {
  const wanted = new Set(rowIds)
  const rows = model.tabs[tab] ?? []
  const edits = rows
    .filter(r => wanted.has(r.id) && (r.data[field] ?? '') !== value)
    .map(r => ({ rowId: r.id, field, value }))
  if (!edits.length) return model
  return edit(model, tab, edits, ref, config)
}

/** Remove rows the user is unsure about. There is no matching add — putting someone on
 *  the list is a change to the Google Sheet, which stays authoritative about who is on
 *  it. Positions shift, so dismissals for the tab are rebuilt. */
export function removeRows(model: Model, tab: Tab, rowIds: string[], ref: Reference,
                           config: EventsConfig): Model {
  const rows = model.tabs[tab]
  if (!rows) return model
  const drop = new Set(rowIds)

  const kept: GridRow[] = []
  const remapped = new Set<string>()
  rows.forEach((r, i) => {
    if (drop.has(r.id)) return
    const to = kept.length
    for (const key of model.dismissed) {
      const [t, idx, field] = key.split('|')
      if (t === tab && Number(idx) === i) remapped.add(dismissKey(tab, to, field))
    }
    kept.push(r)
  })

  const dismissed = new Set(
    [...model.dismissed].filter(k => !k.startsWith(`${tab}|`)))
  remapped.forEach(k => dismissed.add(k))

  const tabs = { ...model.tabs }
  if (kept.length) tabs[tab] = kept
  else delete tabs[tab]
  return revalidate({ ...model, tabs, dismissed }, ref, config)
}

/** Re-derive every row — after the event name or date changes. */
export function rederive(model: Model, event: EventContext, ref: Reference,
                         config: EventsConfig): Model {
  const tabs: Record<string, GridRow[]> = {}
  for (const tab of Object.keys(model.tabs)) {
    tabs[tab] = deriveAll(model.tabs[tab].map(r => r.data), tab, event, config)
      .map((data, i) => ({ ...model.tabs[tab][i], data }))
  }
  return revalidate({ ...model, tabs }, ref, config)
}

// ---- counts and payload -------------------------------------------------------------------

export interface Counts {
  rows: number
  /** Every flagged cell on the tab. Always `needsYou + fixable`. */
  total: number
  /** Only you can settle these: no suggestion stands on them. */
  needsYou: number
  /** A suggestion is waiting to be accepted or rejected. */
  fixable: number
}

/** Counts for one tab — the numbers beside the grid describe what you are looking at,
 *  not the whole submission.
 *
 *  The two categories are deliberately disjoint and exhaustive, so `total` is a real
 *  total and a caller can show one number without hiding the other. They were not:
 *  `needsYou` took anything without a suggestion while `fixable` took anything with
 *  one, and a caller showing `needsYou || fixable` printed "1" on a tab holding six
 *  suggested country fixes and one blocked state cell — the six simply vanished. */
export function countsFor(rows: GridRow[] | undefined): Counts {
  const issues = (rows ?? []).flatMap(r => r.issues)
  const fixable = issues.filter(i => i.bucket === 'fixable' && !!i.suggestion).length
  return {
    rows: rows?.length ?? 0,
    total: issues.length,
    needsYou: issues.length - fixable,
    fixable,
  }
}

// canSubmit lived here and was never called. It answered a different question from the
// real gate — it allowed submission while suggestions sat unaccepted, where the button
// requires buildReport(model).ok, meaning no issues at all. Two rules for one decision,
// one of them wrong and invisible: deleted rather than corrected, since report.ts is
// already the single answer.

export function totalRows(model: Model): number {
  return Object.values(model.tabs).reduce((n, r) => n + r.length, 0)
}

export function toPayload(model: Model): Payload {
  const tabs: Record<string, Row[]> = {}
  for (const [tab, rows] of Object.entries(model.tabs)) tabs[tab] = rows.map(r => r.data)
  return {
    tabs,
    dismissed: [...model.dismissed],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    changes: changesOf(model).map(({ rowId, who, ...stored }) => stored),
  }
}

export function fromPayload(payload: Payload | undefined, event: EventContext,
                            ref: Reference, config: EventsConfig): Model {
  return build(payload?.tabs ?? {}, event, ref, config, new Set(payload?.dismissed ?? []),
               {}, payload?.changes ?? [])
}

/** Shape stored rows into grid rows and run NOTHING over them.
 *
 *  For the review side, which is read-only. Re-judging there would be redundant at
 *  best — a list cannot be submitted with anything unresolved — and it was worse than
 *  redundant in practice: the reviewer has no country and state lists loaded, so every
 *  value was measured against an empty reference and came back "isn't a country we
 *  recognise". A clean list looked entirely broken.
 *
 *  The fix is not to load the reference on that screen. It is to stop asking the
 *  question: validation belongs where someone can act on the answer. */
export function fromPayloadReadOnly(payload: Payload | undefined): Model {
  const tabs: Record<string, GridRow[]> = {}
  const undo = new Map<string, Row>()
  for (const c of payload?.changes ?? []) {
    const key = `${c.tab}|${c.row}`
    undo.set(key, { ...(undo.get(key) ?? {}), [c.field]: c.from })
  }
  for (const [tab, rows] of Object.entries(payload?.tabs ?? {})) {
    if (!rows?.length) continue
    tabs[tab] = rows.map((data, i) => ({
      id: newId(), data, issues: [],
      original: { ...data, ...(undo.get(`${tab}|${i}`) ?? {}) },
    }))
  }
  return { tabs, suggestions: {}, dismissed: new Set(), translations: {} }
}
