# PAR (Performance Appraisal Review) — functional specification

**Status:** the employee-facing half of par-app is ported and live under People Ops; the Lead Portal
and Admin Portal are not. Written from the source and cross-checked against the running staging app
(screenshots) — this is the reference for verifying the port and for writing test cases against it,
not a proposal.

**Source of truth for behaviour:** `digiops-hr/apps/par-app/webapp/src` — `OngoingCycleView.tsx` and
its panels/components for the five tabs below (`views/ongoingCycleView/`, `components/common/
RequestFeedbackTab.tsx`, `ProvideFeedbackTab.tsx`, `OfferFeedbackView.tsx`, `F2fPanel.tsx`,
`ScheduleF2F.tsx`, `views/parHistory/ParHistory.tsx`) — and `par-app/backend` (`service.bal` for the
endpoint surface, `manager.bal` for cycle lifecycle and calendar integration, `modules/types/types.bal`
for states, roles and field-level authorization).

**In One WSO2:** `/people-ops/performance`, a tab group (`features/par/`) under the People Ops
perspective — **Employee Feedback**, **Request 360° Feedback**, **Provide 360° Feedback**, **F2F**,
and **History**, each a real route (`employee-feedback` / `request-360` / `provide-360` / `f2f` /
`history`). Backend is par-app's own Ballerina service, configured as `ONE_WSO2_PAR_BACKEND_URL`.

---

## 1. Purpose and users

Every employee goes through a PAR cycle: write a self-assessment, take part in 360° feedback (both
asking colleagues to review you and reviewing colleagues who asked you), and see your record once
your lead has rated you. There is no separate people-management surface here — that's the Lead/Admin
Portal, not yet ported (see §7).

**Who sees which tabs** is decided by one fact: whether the employee has a lead
(`OngoingCycleView.tsx`'s `employeeInfo.leadEmail !== null`, ported as `useParHasLead` reading
par-app's own `GET /employees/{email}`). Someone with a lead gets all five tabs; someone without one
(e.g. the top of a reporting chain) gets only **Provide 360° Feedback** and **History** — there is
nothing to self-assess, request reviewers, or hold a face-to-face for if nobody above you administers
your cycle. The gate fails *open*: until the fetch has actually confirmed `leadEmail === null`, every
tab shows. This is a UX-only visibility decision, not the access boundary — every screen's own API
calls enforce who may read or write what, regardless of which tabs the client renders.

## 2. Screens and features

### 2.1 Employee Feedback (`ParEmployeeFeedbackTab.tsx`)

The self-assessment for the current cycle (`ParInputForm.tsx`/`ParStatusView.tsx`/`EmployeePar.tsx`).

- **PENDING** (never started): a centered "Start" button, disabled once the deadline has passed.
- **DRAFT**: the form is shown directly — the cycle's configured question, then a rich-text answer
  (`ParRichTextField.tsx`), autosaving 1s after you stop typing. Save draft / Share buttons sit below;
  both stay visible and simply disable past the deadline rather than disappearing. Past the deadline,
  the field itself becomes read-only text instead of the editor, but the form and its buttons remain.
- **SHARED / SHARED_BLOCKED**: replaced by the finalized view (`ParRatingSummary.tsx`) — your
  submitted answer, your lead's rating/comment once *they've* shared (never before), and a PDF export
  of the record. An **Unshare** button reverts you to DRAFT so you can revise — offered only while
  your lead hasn't shared their side yet.

### 2.2 Request 360° Feedback (`ParRequestFeedbackTab.tsx`)

The reviewers you've asked (or your lead asked, on your behalf) this cycle — a plain list of
addresses, no status column (the backend hardcodes a placeholder status for your own reviewer list,
so a real column would just read "Unavailable" forever). A fixed "+" FAB opens the picker
(`Par360RequestDialog.tsx`): search-and-multi-select over the org, excluding yourself, your own lead,
and anyone already on the list. An info alert always shows the deadline; the FAB disables past it.

### 2.3 Provide 360° Feedback (`ParProvideFeedbackTab.tsx`)

Two sub-views, toggled by tabs with counts — **Requested Feedback** (someone asked you to review
them) and **Voluntary Feedback** (review someone who didn't ask). Each row is "Provide feedback" while
`PENDING`/`DRAFT`, or "View" once decided; the action disappears entirely past the deadline. A
voluntary request still `PENDING` once the deadline passes shows "Abandoned" instead of a status chip.
A fixed "+" FAB (Voluntary tab only) opens the offer picker (`Par360OfferDialog.tsx`): anyone in the
cycle, minus yourself and anyone already requesting/requested, confirmed before it's recorded.

Giving a review (`Par360ReviewDialog.tsx`, shared by both sub-views): the cycle's configured question
and rating scale, a rich-text comment, autosaving 5s after you stop typing. Share and Decline are both
behind their own confirmation dialog (irreversible once recorded). Declining asks for a reason instead
of a rating. Voluntary/offered reviews hide Decline — there was no request to decline.

### 2.5 F2F (`ParF2fTab.tsx`)

The employee-facing half of `F2fPanel.tsx` (`isEmployeeView=true`; the lead's own render of the same
component belongs with the Lead Portal, not here). Five independent status alerts stack rather than
switch — e.g. "F2F meeting is scheduled" and the deadline reminder both show together when the
meeting is SCHEDULED and the deadline hasn't passed, matching source exactly rather than collapsing
them into one.

A **F2F Completed Date** field (native date input, min the cycle's start date, max today) and two
actions, both disabled until the lead has shared their side (`parLeadStatus === SHARED`) and hidden
entirely once COMPLETED or past the deadline:

- **Schedule Google Meet** (shown only while `parF2fStatus === PENDING`) opens a picker
  (`ParScheduleF2fDialog.tsx`, porting `ScheduleF2F.tsx`): pick a date, the app checks the caller's and
  their lead's Google Calendar availability (`GET .../calendar/busy-times`) and computes free
  half-hour slots client-side (9am–5pm, `util/parF2fSlots.ts`), then a title/description — **Schedule
  Meeting** stays disabled until both a slot and a title are filled — creates the event
  (`POST .../calendar/schedule-f2f`), which the backend also uses to flip `parF2fStatus` to `SCHEDULED`
  as a side effect. The dialog closes immediately on success, same as source; see the deviation below
  for why no Meet link is shown.
- **Mark as completed** saves the picked date with `parF2fStatus: COMPLETED` through the same
  par-rating PATCH every other tab uses.

### 2.6 History (`ParHistoryTab.tsx`)

Past (closed) cycles, in a table — click one to see that cycle's record (the same read-only summary
as Employee Feedback's finalized view, including the PDF export). A standing notice explains that
history is only available from 2024 H2 onward.

## 3. Business rules

1. **Deadlines** are per-field on the cycle (`parEmployeeDeadline`, `parThreeSixtyRatingDeadline`,
   `parF2FDeadline`) and evaluated as end-of-day in the browser's own timezone. Every screen disables
   rather than hides its actions once passed, except Provide 360°'s per-row action and F2F's
   date-field/actions block, both of which the source hides entirely.
2. **Comments are rich text**, base64-of-URI-encoded on the wire (the backend rejects anything else),
   sanitized through the same DOMPurify allowlist on both save and render.
3. **The finalized summary only ever shows once your own status is SHARED/SHARED_BLOCKED.** A lapsed
   but never-shared draft stays the (now read-only) form — never the PDF-downloadable summary.
4. **Lead's feedback (rating, special rating, comment) is only visible once actually shared** — its
   presence in the response *is* the signal; the backend omits it entirely until then.
5. **Unshare** is offered only while your own status is SHARED and your lead's is not, and never past
   the deadline.
6. **PAR-rating and special-rating codes are mapped to display text** (`TOP5P` → "Top 5%", `NOT_ASSIGNED`
   → "Not Assigned", etc. — `util/parLabels.ts`) on screen, but *not* in the PDF export, which writes a
   real code raw and only substitutes text for the placeholder — matching the source's own PDF exactly
   rather than "improving" on it.
7. **`parF2fStatus`/`parF2fDate` are self-editable through the same `PATCH .../par-ratings/{id}` as the
   comment/status pair**, despite being set by the employee for what looks like a lead-facing field.
   `checkForModifiableFieldsForSelf` (backend) is a denylist (blocks `parRating`, `parSpecialRating`,
   `parLeadComment`, `parLeadStatus`, `parAdminComment`, `parPerformanceNoticeAck`), not an allowlist —
   anything not named there, F2F fields included, goes through.
8. **F2F's "Schedule Google Meet" never shows a Meet link back to the user, and the dialog closes on
   success rather than holding a confirmation screen — both matching source, not simplifying it.**
   `ScheduleF2F.tsx`'s own `useEffect` calls `onClose()` the instant scheduling succeeds, before its
   "click here to open Google Meet link" panel could ever be seen — and that panel could never have
   shown a link anyway, since `POST .../calendar/schedule-f2f` returns a bare 201 with no body
   (`CreateCalendarEventResponse` only ever carried `message`/`id`). The calendar event is real (Google
   generates the Meet link, both attendees get an emailed invite via `sendUpdates=all`), and source's
   actual confirmation is a snackbar toast ("F2F scheduled successfully") dispatched alongside the
   auto-close — ported as the same toast text on success, dialog closing immediately after.

## 4. API contract

All requests carry the signed-in user's bearer token plus `x-user-timezone-offset`
(`digiopsHeaders()`); base URL is `ONE_WSO2_PAR_BACKEND_URL`.

| Endpoint | Purpose |
|---|---|
| `GET /employees/{workEmail}` | `leadEmail` — drives the tab-set gate |
| `GET /par-cycles?email=&status=` | The caller's OPEN or CLOSED cycles |
| `GET /par-cycles/{id}/employees/{email}/par-ratings` | Own rating record for a cycle |
| `PATCH .../par-ratings/{id}` | Save draft / share / unshare (self-editable fields only — backend enforces this) |
| `GET/POST .../employees/{email}/reviewers` | Reviewers you've named (GET), add more (POST) |
| `GET .../employees/{email}/review-requests` | Requests waiting on you as a reviewer |
| `GET/PATCH .../employees/{email}/review` | Your review of one employee — draft, share, decline |
| `GET /par-cycles/{id}/participants` | Cycle-scoped name+email list, for the voluntary-offer picker |
| `GET /calendar/busy-times?date=` | The caller's and their lead's busy periods for one day (flat path, not under `/par-cycles`) |
| `POST /calendar/schedule-f2f` | Creates the Meet event + invite, and flips `parF2fStatus` to `SCHEDULED` server-side; returns bare 201, no body |

## 5. Test checklist

- [ ] An employee with a lead sees all five tabs; one without sees only Provide 360° and History, and
      is redirected away from a directly-typed F2F/Employee Feedback/Request 360° URL.
- [ ] Employee Feedback: PENDING shows a disabled-after-deadline Start button; DRAFT shows the form;
      typing autosaves after 1s with a "Draft saved" flash; Save/Share disable but don't hide past the
      deadline; Share opens a confirmation naming your lead.
- [ ] Once shared, the finalized view shows your answer, your lead's rating/comment (only once *they*
      share), and a working PDF download.
- [ ] Unshare is visible only while your status is SHARED and your lead's isn't; using it returns you
      to an editable draft.
- [ ] Request 360°: the picker excludes yourself, your own lead, and existing reviewers; the FAB
      disables past the deadline.
- [ ] Provide 360°: Requested/Voluntary tabs show correct counts; a lapsed voluntary PENDING request
      reads "Abandoned"; declining requires a reason and a confirmation; offering voluntary feedback
      excludes yourself and existing requests and asks for confirmation first.
- [ ] F2F: date field and both actions are disabled until your lead has shared, and disappear entirely
      once COMPLETED or past the deadline; "Schedule Google Meet" only shows while PENDING, and its
      "Schedule Meeting" button stays disabled until both a slot and a title are filled; scheduling
      closes the dialog immediately with a toast (no in-dialog Meet link) and flips the status to
      SCHEDULED; "Mark as completed" requires a date and moves the status to COMPLETED.
- [ ] History: past cycles list, oldest data is explained by the notice, opening one shows the same
      read-only summary as a shared Employee Feedback record.

## 6. Deviations from the source app

| # | Change | Why |
|---|---|---|
| 1 | No employee name or photo anywhere (reviewer lists, "Shared by", the voluntary picker, PDF headers) — email addresses stand in throughout. | No whole-org employee directory (name + thumbnail) is available to this app the way source's Redux `employeeMap` is; the correct par-app endpoints this port uses (`/participants`, `/reviewers`) don't carry one either. |
| 2 | No live numeric autosave countdown — a plain "Draft saved" / "Saving draft…" flash instead. | Cosmetic difference only; the autosave timing itself (1s / 5s) matches source exactly. |
| 3 | Tab bar is label-only, no per-tab icons. | The shared routed-tab type this app's tab bars use doesn't carry an icon field; a one-off addition just for PAR was reverted to keep that type consistent app-wide. |
| 4 | `parEmployeeAcceptanceStatus`/`parEmployeeAcceptanceComment` exist in the type but nothing sends them. | Matches source exactly — there is no accept/reject control anywhere in the running app despite the backend supporting the fields. |

## 7. Not yet ported

Only the Employee Portal's five tabs (§2) are ported. The rest of par-app is not:

- **Lead Portal** — a separate top-level view in source (`route.ts`'s `/lead-portal`,
  `views/leadPortal/`): review direct/additional reports, rate them, allocate top-5%/20% special-rating
  quota, monitor team completion, share results. Includes `F2fPanel.tsx`'s `isEmployeeView=false` render
  (a lead marking F2F complete for a report), which this port's `ParF2fTab.tsx` doesn't cover.
- **Admin Portal** — source's `/admin-portal` (`views/adminPortal/`): create/configure cycles, assign
  special-rating quotas, monitor org-wide completion, generate reports, send/schedule reminders, global
  configuration.
- **Report Chain** — source's `ParHistory.tsx` has a second, lead-only tab alongside "My History"
  (`views/parHistory/ChainViewTab.tsx`): a lead's view of their reports' PAR history.
- **One unified "no cycle" state.** Source gates all Employee Portal tabs behind a single check
  (`OngoingCycleView.tsx`) that replaces the whole tab body with one notice when there's no active
  cycle; this port instead repeats a similar (but not identically worded) message independently in
  each tab file. Functionally equivalent today, but worth consolidating the next time this area is
  touched rather than leaving five copies to drift.
