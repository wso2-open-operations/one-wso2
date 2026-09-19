# PAR (Performance Appraisal Review) — functional specification

**Status:** the employee-facing half of par-app (all five tabs, including F2F) is ported and live under
the Me perspective. The Lead Portal is fully ported (all five tabs) and lives under People Ops. Admin
Portal is not started. Written from the source and cross-checked against the running staging app
(screenshots) — this is the reference for verifying the port and for writing test cases against it, not
a proposal.

**Source of truth for behaviour:** `digiops-hr/apps/par-app/webapp/src` — `OngoingCycleView.tsx` and
its panels/components for the five tabs below (`views/ongoingCycleView/`, `components/common/
RequestFeedbackTab.tsx`, `ProvideFeedbackTab.tsx`, `OfferFeedbackView.tsx`, `F2fPanel.tsx`,
`ScheduleF2F.tsx`, `views/parHistory/ParHistory.tsx`) — and `par-app/backend` (`service.bal` for the
endpoint surface, `manager.bal` for cycle lifecycle and calendar integration, `modules/types/types.bal`
for states, roles and field-level authorization).

**In One WSO2:** the employee half and the Lead Portal are split across two perspectives, the same
split claim-approval already applies (`docs/ported-apps/claim-approval.md`) — completing and sharing
your own PAR is something every employee does for themself, so it lives under **Me**; reviewing and
rating *other people's* PAR is People-Ops-team work, so the Lead Portal stays under **People Ops**.

`/me/performance`, a tab group (`features/par/`) — **Employee Feedback**, **Request 360° Feedback**,
**Provide 360° Feedback**, **F2F**, and **History**, each a real route (`employee-feedback` /
`request-360` / `provide-360` / `f2f` / `history`). The Lead Portal lives at
`/people-ops/performance/lead`, gated on par-app's own `Role.TEAM_LEAD` (`ParRequiresTeamLeadRoute`) —
**Direct Reports**, **Additional Reports**, **Report Chain**, **Employee History**, and
**Top 5%/20% Allocation** (`direct-reports` / `additional-reports` / `report-chain` /
`employee-history` / `allocation`). Backend is par-app's own Ballerina service, configured as
`ONE_WSO2_PAR_BACKEND_URL`.

---

## 1. Purpose and users

Every employee goes through a PAR cycle: write a self-assessment, take part in 360° feedback (both
asking colleagues to review you and reviewing colleagues who asked you), and see your record once
your lead has rated you. There is no separate people-management surface here — that's the Lead
Portal (§8, fully ported) and the Admin Portal (not yet started — see §9).

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

### 2.4 F2F (`ParF2fTab.tsx`)

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

### 2.5 History (`ParHistoryTab.tsx`)

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
| `GET /par-cycles/{id}/teams?leadEmail=` | Every team a lead owns (team picker) |
| `GET /par-cycles/{id}/teams/{teamId}` | One team's roster |
| `PATCH /reminders/schedule-360-reminders` | No body; sends 360° reminders to the calling lead's own reports |
| `GET /par-cycles/{id}/special-rating-groups-quota?leadEmail=` | The calling lead's Top 5%/20% quota allocations |
| `GET /calendar/busy-times?date=` | The caller's and their lead's busy periods for one day (flat path, not under `/par-cycles`) |
| `POST /calendar/schedule-f2f` | Creates the Meet event + invite, and flips `parF2fStatus` to `SCHEDULED` server-side; returns bare 201, no body |
| `GET /par-cycles/{id}/reports?leadEmail=` | Direct + indirect reports (Additional Reports keeps the indirect ones) |
| `GET /par-cycles/{id}/report-levels?leadEmail=` | One drill-down level of the report chain |
| `GET /employees?leadEmail=` | Org-chart direct reports, not PAR-cycle-scoped (Employee History's picker) |
| `GET /par-cycles?status=CLOSED` (no email) | Every closed cycle org-wide, gated on being a lead in the active cycle or admin |
| `GET /par-cycles/{id}/participants?leadEmail=` | The calling lead's own reports who have a record in one cycle |
| `GET /par-cycles/{id}/employees/{email}/reviews` | Every review about that employee, for the History tab's 360 section |
| `GET /legacy-par-history/{email}` | One employee's pre-migration legacy PAR record(s) |

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
- [ ] Lead Portal is reachable only by a team lead in the active cycle; a non-lead is redirected away
      even by direct URL, and nobody sees a flash of the portal while the lookup is in flight.
- [ ] Direct Reports: a lead with one team skips the picker; bulk Share only enables when every
      selected row is DRAFT and reports pass/fail counts correctly; opening a member's review shows
      the exact Save Draft/Share rules (Share stays disabled until the employee's own status leaves
      PENDING).
- [ ] Employee review screen (any list tab → click a row): Lead's Feedback / 360 Reviews / F2F tabs and
      PAR HISTORY all open for the right employee; 360 Reviews' Request FAB disables once the lead has
      already shared or the deadline has passed, and "View Feedback" only shows once SHARED/REJECTED;
      F2F's "Schedule Google Meet" stays disabled (lead view only marks complete); PAR HISTORY shows the
      same cycle history as the Employee History tab for that one employee.
- [ ] Top 5%/20% Allocation: rows group correctly by quota id; the search box highlights matches
      across every card; a 1/0 (Top 5%/Top 20%) quota shows "1" for both with the small-team warning.
- [ ] Additional Reports: only indirect reports show (a direct report never appears here); search
      matches email, not name.
- [ ] Report Chain: starts at the caller's own direct reports; "View Subordinates" only shows for a
      row whose `isEmployeeALead` is exactly `"True"`, and drills into that person's own reports with a
      working breadcrumb trail back up; "Show Leads Only" and search combine correctly.
- [ ] Employee History: the cycle picker lists real closed cycles and legacy cycles together, latest
      first; picking a cycle scopes the employee picker to whoever has a record for it; a real cycle
      shows the rating/comments/360 feedback, a legacy cycle shows the derived rating and legacy 360
      feedback; an employee with no record for the selected cycle shows the right "not available"
      message for that cycle type.

## 6. Deviations from the source app

| # | Change | Why |
|---|---|---|
| 1 | No employee name or photo in most other places (reviewer lists, "Shared by", the voluntary picker, PDF headers) — email addresses stand in. Lead Portal roster/history Avatars are the exception: they reuse the Leave feature's own org-wide employee-directory endpoint (`useLeaveEmployees`) for a thumbnail lookup, since this app has no directory of its own. | No whole-org employee directory (name + thumbnail) is available to this app the way source's Redux `employeeMap` is; the correct par-app endpoints this port uses elsewhere (`/participants`, `/reviewers`) don't carry one either, and reusing another feature's directory isn't appropriate for every screen. |
| 2 | No live numeric autosave countdown — a plain "Draft saved" / "Saving draft…" flash instead. | Cosmetic difference only; the autosave timing itself (1s / 5s) matches source exactly. |
| 3 | Tab bar is label-only, no per-tab icons. | The shared routed-tab type this app's tab bars use doesn't carry an icon field; a one-off addition just for PAR was reverted to keep that type consistent app-wide. |
| 4 | `parEmployeeAcceptanceStatus`/`parEmployeeAcceptanceComment` exist in the type but nothing sends them. | Matches source exactly — there is no accept/reject control anywhere in the running app despite the backend supporting the fields. |

## 8. Lead Portal

**Source of truth:** `views/leadPortal/LeadPortal.tsx` and its panels (`panels/LeadOngoingPanel.tsx`,
`panels/TeamSummary.tsx`, the lead-only path of `components/Review.tsx`/`LeadReviewPanel.tsx`,
`components/common/SpecialRatingAllocationView.tsx`), gated in source by `Role.TEAM_LEAD`
(`route.ts`, `/lead-portal`) — sourced from par-app's own `GET /employees/{email}`'s `isTeamLead`
field, which is scoped to the *active* PAR cycle (`isLeadInActiveParCycle`), not a standing role.

### 8.1 Direct Reports (`ParLeadDirectReportsTab.tsx`)

Ports `LeadOngoingPanel.tsx` + `MultiTeamSummary.tsx` (team picker; a lead with exactly one team skips
straight to it) and `TeamSummary.tsx` (`ParLeadTeamRoster.tsx` — one team's roster): completion cards,
member search, bulk **Share** (validated *before* the confirm dialog opens, same as source's
`openParShareDialog`, and again at confirm-time — a client-side loop over the same per-record `PATCH`,
matching source's own `bulkUpdateParRatingOfEmployee` thunk since there is no real bulk endpoint),
**Copy Emails**, and **Send 360° Reminder**. The roster's Team Member cell shows an Avatar thumbnail
and a per-row Copy Email action, matching `TeamSummary.tsx` exactly.

Opening a member's row (`ParLeadReviewTabs.tsx`, ports `Review.tsx`) gives the full three-tab review
screen: a back button + employee Avatar/name chip, then **Lead's Feedback** / **360 Reviews** / **F2F**
tabs and a **PAR HISTORY** button, matching source's own tab bar and layout exactly (every
`isAdminAuditViewOn`/`isAdminHistoryViewOn`-gated branch, e.g. "Update Status", left out — Admin Portal,
out of scope for this portal).

- **Lead's Feedback** (`ParLeadReviewPanel.tsx`, the lead-only path of `LeadReviewPanel.tsx`): rating +
  Top 5%/20% special-rating selection with its confirmation checkbox, a rich-text lead comment with 5s
  autosave, deadline gating on `parLeadDeadline`, the exact Save Draft/Share enable rules (Share
  additionally waits for `parEmployeeStatus !== PENDING` — the employee must have at least started their
  own side — and a warning line explains why Share is disabled while that's true), and a
  **Download PAR details** PDF export (employee/lead comment plus every 360 review, unfiltered by
  status — matching source's own `downloadPDF` exactly, including that it never filters to SHARED-only
  the way the on-screen 360 list does).
- **360 Reviews** (`ParLead360ReviewsTab.tsx`, ports `Review.tsx`'s own reviewer-monitoring table): every
  reviewer ever requested for this employee (by themselves or by this lead) with a status chip, who
  requested them, and a "View Feedback" action once SHARED/REJECTED; a Request FAB reuses the same
  `Par360RequestDialog` (`ReviewRequestModal`) the employee's own Request 360° Feedback tab does, aimed
  at this employee's reviewer list instead of the caller's own, disabled once the 360° deadline has
  passed or the lead's own side is already SHARED.
- **F2F** (`ParLeadF2fPanel.tsx`, ports `F2fPanel.tsx`'s `isEmployeeView=false` render): the same five
  alerts and completed-date form `ParF2fTab.tsx` shows for the employee's own side, but for this
  employee, with "Schedule Google Meet" permanently disabled — matching source's shared component
  exactly (one `F2fPanel`, `isEmployeeView` only ever gates that one button).
- **PAR HISTORY** (`ParLeadHistoryModal.tsx`, ports `EmployeeHistoryCard.tsx` as `Review.tsx`'s own
  "PAR HISTORY" button opens it — a real modal, `CustomModal`): the same merged real+legacy cycle history
  `ParLeadEmployeeHistoryTab.tsx` shows, for this one fixed employee, in a modal instead of a full tab (no
  employee picker). The shared history-rendering logic lives in `ParEmployeeHistoryView.tsx`, which this
  modal wraps in a `Dialog`.

Not ported here: evidence attachments (`parPerformanceNoticeAck`'s Google Drive picker — a capability
nothing else in this app has), and "Sync an Employee" (`TeamSummary.tsx`'s temporary org-chart-search
dialog for this cycle).

### 8.2 Additional Reports (`ParLeadAdditionalReportsTab.tsx`)

Ports `EmployeeReportView.tsx`: `GET /par-cycles/{id}/reports?leadEmail=` returns both direct and
indirect reports, and this tab keeps only `reportingType === "indirect"` (`filterAdditionalReports`)
— direct reports already have their own tab. Same roster columns (Avatar + copy-email included) and
row-click-to-review behaviour as Direct Reports, reusing `ParLeadReviewPanel.tsx`. The header row
(cycle name, search box, and the "Open Cycle Dates" icon) sits in one 3-column layout, matching
source's own `Grid` exactly — not a title/search bar tucked inside the table's own Card. Search matches
the email only, not the name — that's source's own narrower scope here, not an oversight carried over
by accident.

### 8.3 Report Chain (`ParLeadReportChainTab.tsx`)

Ports `ReportChainView.tsx`: starts at the caller's own direct reports (`GET
/par-cycles/{id}/report-levels?leadEmail=`); a row whose `isEmployeeALead` is the exact-case string
`"True"` gets a "View Subordinates" action that drills into that person's own direct reports one level
at a time, with a breadcrumb trail back up. The backend allows this as long as the requested email is
somewhere in the caller's own reporting chain. A "Show Leads Only" toggle filters the current level
(case-insensitive `isEmployeeALead` comparison — source uses a different-cased check here than the
action gate above, and both are reproduced as their own separate comparisons, not unified). Breadcrumbs
sit above a single 3-column header row (cycle name, search box, calendar icon + "Show Leads Only"
switch together) matching source's own `Grid` layout, and the roster's Team Member cell carries the
same Avatar + copy-email affordance as Direct Reports and Additional Reports.

### 8.4 Employee History (`ParLeadEmployeeHistoryTab.tsx`)

Ports `EmployeeHistoryView.tsx` (shared with the Admin Portal there; only the lead-facing side is
ported here) — full parity, legacy pre-migration data included. A PAR cycle is picked first: every
closed real cycle (`GET /par-cycles?status=CLOSED`, org-wide, gated on being a lead in the *active*
cycle or admin — not scoped to the caller's own participation) merged with one entry per distinct
legacy cycle name found across every one of the lead's own direct reports (`GET
/employees?leadEmail=` for the report list, then `GET /legacy-par-history/{email}` fanned out across
all of them at once — there is no lead-scoped "every legacy cycle" endpoint, only a per-employee one
and an admin-only org-wide one, so this is the same fan-out trade-off source makes), latest first.
Selecting a cycle scopes the employee picker to whoever actually has a record for it — real-cycle
participants (`GET .../participants?leadEmail=`) or whichever reports' fanned-out legacy history
includes that cycle name.

A real cycle reuses the same `ParRating` record and `GET .../employees/{email}/reviews` (360 feedback
about that employee, filtered to `SHARED` — the enum source calls `ParThreeSixtyReviewStatus.COMPLETED`
is the identical wire value). A legacy cycle instead reads the migrated JSON columns
(`questionAnswers`, `feedback360`) and derives a display-only rating from `managerScoreCode` (the
legacy system never populated a real rating/special-rating); the legacy "Employee PAR" text itself is
built the same way source does — joining every meaningful `questionAnswers[].employeeAnswer` entry, not
the old fixed `overallCommentEmployee` field, which only ever held the pre-migration format. Both "no
record for this cycle" cases are deliberately worded to not claim certainty for the real-cycle one —
the backend can't distinguish "no rating exists" from a genuine fetch error for that specific lookup,
matching source's own wording exactly; the legacy one is scoped to the *selected employee's own*
fan-out fetch status, not whether any of the lead's other reports still has a fetch in flight. Both
detail views show an Avatar (thumbnail for a real cycle, the bare fallback icon for a legacy one — legacy
records carry no photo, matching source), and "Employee PAR"/"Lead's Feedback" are collapsible
Accordions, collapsed and disabled when there's no comment, exactly like source's own `CommentAccordion`
(its third, Admin Comment, accordion is intentionally never reached here — the backend nils
`parAdminComment` for any lead-relationship viewer, `sanitizeParRatingForLead`, so it would only ever
render empty). The employee picker's Autocomplete falls back to the full in-scope list when its input
text exactly matches the selected option's own label — MUI resets the input to that label on selection,
and filtering literally against it would otherwise leave the dropdown empty on reopen — and its option
rows show the same Avatar + name/email layout as source's own `renderOption`.

### 8.5 Top 5%/20% Allocation (`ParLeadAllocationTab.tsx`)

Ports `SpecialRatingAllocationView.tsx` (`isAdminView=false`): `GET
/par-cycles/{id}/special-rating-groups-quota?leadEmail=` returns one row per (business unit,
department, team) combination a quota group covers; rows sharing a `parQuotaId` are grouped
client-side into one card each, showing the quota name and Top 5%/Top 20% counts, with a search box
that highlights matching business-unit/department/team text across every card. Searching never hides a
non-matching group — every card always stays visible, matching source's own `processedGroupedData`
exactly (its "No results found" text is dead code there for the same reason, and stays unreachable
here too). A quota whose Top 5% is 1 and Top 20% is 0 is a small-team special case — the Top 20% chip
displays "1" too (not the real 0), alongside a warning explaining the pair represents one combined
slot, not two.

## 9. Not yet ported

- **Lead Portal — evidence attachments and every Admin-only branch** of the employee review screen
  (see §8.1) — evidence attachments need a Google Drive picker integration nothing else in this app has;
  the Admin-only branches (force-edit-after-share, share-on-behalf-of-employee, "Update Status" tab) are
  Admin Portal, out of scope for this portal.
- **Admin Portal** — source's `/admin-portal` (`views/adminPortal/`): create/configure cycles, assign
  special-rating quotas, monitor org-wide completion, generate reports, send/schedule reminders, global
  configuration.
- **PAR History's Chain view** — source's `ParHistory.tsx` has a second, lead-only tab alongside "My
  History" (`views/parHistory/ChainViewTab.tsx`): a lead's view of their reports' PAR history across
  cycles, reached by browsing the org chart. A version of this was built and then deliberately removed —
  it duplicated Employee History (§8.4), which already gets to the same `ParEmployeeHistoryView` content
  for any of the lead's reports, just via a cycle+employee picker instead of an org-chart drill-down.
  Distinct from the Lead Portal's own "Report Chain" tab (§8.3, `ReportChainView.tsx`), which is a
  different screen (opens the review panel, not history) and stays.
- **One unified "no cycle" state.** Source gates all Employee Portal tabs behind a single check
  (`OngoingCycleView.tsx`) that replaces the whole tab body with one notice when there's no active
  cycle; this port instead repeats a similar (but not identically worded) message independently in
  each tab file across both portals. Functionally equivalent today, but worth consolidating the next
  time this area is touched rather than leaving further copies to drift.
