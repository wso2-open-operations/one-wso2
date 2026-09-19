# Security (GRC platform) — lift-and-shift

The GRC platform's Risk Hub, Audit Hub and Admin Console, **copied** from
`grc-tools/apps/grc-platform` rather than rewritten, on the reasoning that GRC is
new and a rewrite is where new bugs come from.

**32,824 lines across 178 files**, carried unedited except where listed in §3.

**Lifted from grc-tools `8c002b9` (2026-09-17).** Record this on every refresh: a
sweep needs a baseline, and without one "is the copy current?" cannot be
answered — only "does it differ from whatever is checked out right now".

**The two apps do not run the same pins**, which is worth knowing before
blaming a lifted screen for behaving oddly:

| | grc-tools | here |
|---|---|---|
| `@wso2/oxygen-ui` | 0.13.0 | 0.13.1 |
| `react-router` | 7.1.5 | 7.18.2 |
| `react` | 19.2.3 | 19.2.3 |

MUI is identical in effect — both resolve it through Oxygen, which pins
`@mui/material` 7.3.4 in either version. The Oxygen gap is a patch. The
`react-router` gap is 17 minors under every lifted `navigate()` and `<Route>`,
and none of it has been exercised against a running app (§5).

## 1. How it is wired

| | |
|---|---|
| `features/security/grc/modules/{risk,audit,admin}` | the source, unedited |
| `features/security/grc/{components,utils,hooks}` | the shared pieces those modules import |
| `features/security/grc/shim/` | **2 files** — the entire seam between the two apps |
| `constants/securityApps.ts`, `features/security/api/useSecurityGate.ts` | rail registry and gate — the only navigation code written for this |
| `App.tsx` | the source's own `<Route>` fragments, spread inside `<Route path="security">` |

Nesting the fragments is what turns the source's `/risk/*`, `/audit/*` and
`/admin/*` into `/security/risk/*`, `/security/audit/*` and `/security/admin/*`
without editing the route files themselves. Their per-route `PrivilegeGuard`s
come along, including the deliberate absence of one on Risk Registers.

Nesting does NOT fix navigation BETWEEN those routes — the source uses absolute
paths, which had to be re-pointed. See E7, and read it before assuming anything
else about the source's surroundings carried across.

Everything else was a mechanical import-alias rewrite across 108 files.

**Security is on by default** — no preview flag. The perspective appears for
everyone; the GRC backend's own privilege set decides what is inside it, and
someone holding no grant is told plainly that they have none rather than never
seeing the perspective at all.

**The backend URL is `ONE_WSO2_GRC_PLATFORM_BACKEND_URL`**, following this
file's `ONE_WSO2_<app>_BACKEND_URL` convention like every other key. It carried
the source's own name for a while, on the reasoning that a GRC deployment
already publishes that value; but nobody copies a whole config between the two
apps, so the only thing that bought was a shared search term, at the cost of one
key in `apiConfig.ts` looking like an oversight.

It names the BACKEND, not the perspective. The perspective's label has already
changed once — "Security" became "Security and Compliance" — and a key that
tracks a label goes stale the next time. The service, its Choreo component and
its repo are all `grc-platform`, so this name stays greppable across all three.

## 2. The seam

`shim/useAuthApiClient.ts` reproduces the source's hook signature, which is what
lets every call site come across unedited. It is the one place the two apps'
auth differ, and the first thing to read when a Security screen misbehaves in a
way no other perspective does.

**It sends this app's access token**, via `fetchWithReauth`, like every other
backend here. The source sends the ID token. Both come from the same Asgardeo
application with the same scopes, and in this tenant their claim sets are close
enough. `@hooks/useIdToken` exists for the one-line swap if that turns out to be
wrong — the symptom would be specific and misleading: every Risk and Admin route
403s looking exactly like a missing permission, while `/me/privileges` itself
succeeds. Decode both tokens with the dev debug panel before believing anything
else.

A comment in `config/apiConfig.ts` asserted the opposite — that these screens
send the ID token — for several commits. The code never did; only the comment
was wrong, and it has been corrected. Worth recording because of where it would
have led: it is the first thing someone reads when a Security call 401s, and it
would have sent them to swap tokens instead of at the audience.

## 3. Everything edited after copying

Eight categories, and nothing else was touched.

| # | Change | Why |
|---|---|---|
| E1 | **Mock-auth bypass removed** from `AddRisk.tsx` | Gated data-loading effects on `isSignedIn \|\| isMockAuth`. A config-driven auth bypass must not ship. See §4.1 — this is the most important thing the lift found |
| E2 | **Theme literals replaced** in 8 files | `#ffffff`/`#1a1a24`/`#1e1e1e` hardcoded to opt dialogs out of AcrylicOrange's glassmorphism. This app now defaults to WSO2Theme, whose dark canvas is navy `#0f172a` — those literals would sit as a visibly wrong shade, and a theme switch would strand them. Now `var(--oxygen-palette-background-default)`, which follows the active theme. CSS variables not `theme.palette.*`, because that accessor freezes the light scheme at first paint under CssVarsProvider |
| E3 | **Error pages replaced** with one self-contained `Error403Page` | The source's build on a `@assets/error/*.svg` alias this app lacks, and assume GRC's shell. Here the page already sits inside this app's layout, so a full-bleed error screen would render inside the frame and read as broken rather than refused |
| E4 | **`nav.ts` deleted** from all three modules | The source's sidebar tables. This app's rail reads `securityApps.ts` instead; the labels, ids, ordering and privileges there are transcribed from these so the two can be diffed |
| E5 | **An `enabled` parameter added** to `useRiskPrivileges`, `useAuditPrivileges` and `useAdminPrivileges` | See below — the one edit made for a difference in how this app mounts the code, rather than for something wrong with it |
| E6 | **Mock-auth bypass removed** from `audit/utils/auditor.ts` and `audit/hooks/useAuditPrivileges.ts` | Same class as E1 and worse: `isAssignedAuditor` returned `true` **unconditionally**, showing every auditor-only surface — sampling, evidence validation — to every user whenever the flag was set, and `useAuditPrivileges.can()` granted every privilege with no API call at all. The widest bypasses the port encountered |
| E7 | **Absolute navigation paths re-pointed** under `/security` — 17 sites in 10 files | See below. The one place where "identical to the source" was itself the bug |
| E8 | **Previous-score outline thickened** in `RiskScoreGrid.tsx` — `2px dashed rgba(0,0,0,0.55)` → `3px dashed rgba(0,0,0,0.75)` | Requested for this app: the dashed marker for the previous score in the Reassess dialog was too faint. One string; re-apply on refresh unless the source adopts it |

**E5 in full**, because it is the only change driven by this app's shape rather than
the source's content. In GRC these hooks only ever mount inside the GRC app, so
fetching on mount is free. Here `SideRail` asks for a Security gate on **every**
perspective, to decide whether the Security entry is shown at all. So an
unconditional fetch meant every user of this app — including everyone holding no
GRC grant at all — fired `GET /me/privileges` twice and `GET /risks/me/involvement`
once on every page load, and collected the 401s in their console.

The parameter **defaults to `true`**, so all the lifted call sites — every
`PrivilegeGuard`, `admin/routes.tsx`, `UsersPage` — are unchanged and behave
exactly as they do in GRC; they only ever mount on a Security route, where the
answer is wanted anyway. Only `useSecurityGate` passes `false`, and it passes
`enabled && isSecurityBackendConfigured()`, so an unconfigured deployment also
calls nothing. `loading` initialises to `enabled` rather than `true`: a disabled
hook is not in flight, and a consumer waiting on `isResolving` would otherwise
wait for a request that is never made.

`useSecurityGate.test.tsx` pins this — that a disabled gate makes **no** request.
It was mutation-tested: reverting the parameter fails two of its cases.

**E7 in full**, because it corrects a claim §1 used to make. Nesting the route
fragments does turn `/risk/*`, `/audit/*` and `/admin/*` into `/security/...`
without editing them — but only the ROUTES. The source also navigates BETWEEN
those routes with absolute paths:

```js
onClick={() => void navigate(`/audit/audits/${audit.id}`)}   // AuditsListPage
```

Correct in GRC, wrong here. This app has no `/audit/*` route, so `App.tsx`'s
catch-all matched and redirected the user to their landing page — click an audit,
land on Home, with no error anywhere. 14 sites in audit, 3 in risk, 0 in admin:
every list-or-dashboard-into-detail link, the dashboard's chart drill-down into
Risk Registers, the post-create redirect, both back
buttons, and Add Risk's cancel.

Worth dwelling on how this hid. A source diff cannot find it: these files were
**byte-identical to the source**, and that was precisely the defect. The path is
right in GRC and wrong at this mount point, so "matches source" was the wrong
test. Anything the source asserts about its own surroundings — routes, DOM ids,
origins — needs checking against THIS app, separately from checking the copy is
faithful.

The related case, same root: `AddRisk.tsx` scrolls its wizard by looking up
`document.getElementById("main-scroll-container")`, GRC's shell element. This app
scrolls an inner Box and the window not at all, so the lookup found nothing and
the wizard silently stopped scrolling between steps. Fixed on OUR side instead —
`AppLayout` now names that element `main-scroll-container` — because making the
source's assumption true costs one line, where editing the copy costs a deviation
to re-apply forever.

Semantic colours — status chips, risk-level swatches, the heatmap — are **not**
touched. They carry meaning, not theming.

## 3a. Re-lifting a file: merge, never replace

A file refreshed from source by copying **silently reverts whatever deviation it
carried** — a mock-auth bypass comes back, a navigation path points outside
`/security` again, a dialog goes back to a hardcoded `#1e1e1e`. Nothing fails:
it compiles, the tests pass, and the bypass ships.

So refreshing is a three-step merge, not a copy:

1. Copy the file from source and re-apply the alias rewrite.
2. Re-apply its E-entry from the table above. Every deviation is written to be
   mechanically re-appliable for exactly this reason — E7 is a regex on
   `navigate(`/`href=`/`to=` string literals, E1 and E6 delete named symbols,
   E2 is one CSS variable substitution.
3. Re-run the drift check, which verifies both halves: that nothing ELSE differs
   from source, and that no navigation path escaped the prefix.

`AddRisk.tsx` has now been through this once (§4.5) and it worked.

### 3b. Forward-ported: ahead of the pin, not deviations

Two changes were written in grc-tools and copied here **before** they merged
there, so 14 Risk files are currently AHEAD of the pin rather than equal to it.
A drift check will flag them; that is expected, and the entry disappears once
grc-tools merges them and the pin moves. Neither needs re-applying on a refresh
— unlike E1–E8, the source will already contain them.

| Change | Files |
|---|---|
| **Chart animation at 400ms.** `CHART_ANIMATION_MS` in `dashboard/constants.ts`, replacing `isAnimationActive={false}` at all 14 of its sites with `animationDuration` at 13 — `RegisterTrendChart` set it per line AND chart-wide, and the wrapper already falls back (`line.animationDuration ?? animationDuration`). The charts had animation switched off entirely, which made Risk the only perspective here whose charts never moved | `dashboard/constants.ts` + 12 chart files under `dashboard/` and `analytics/` |
| **Residual Level filter widened** 130 → 170, so the unshrunk label clears the select's arrow (measured: they overlapped by 3px) | `RiskRegisters.tsx` |

If grc-tools changes either of them before merging, re-copy from source rather
than reconciling by hand — these files carry no E-deviation, so a plain refresh
is safe for them.

## 4. Issues the lift surfaced

The brief was to list what lifting found that a rewrite would also have found.
Split honestly: things a rewrite **would** have caught, and things the lift
caught that a rewrite **might not** have.

### 4.1 A rewrite would have caught these — reading every line is what finds them

**① The mock-auth bypass, in a file my own earlier survey missed.**
`AddRisk.tsx:136` read `window.config?.GRC_PLATFORM_MOCK_AUTH` and used it to let
data-loading effects run without a signed-in session. My earlier scan reported
"mock-auth: 0" for Add Risk because it scanned the `add-risk/` **directory**, and
this file sits one level up. Only `tsc` caught it here, and only because this
app's `window.config` is exhaustively typed — **had that type been
`Record<string, unknown>`, a config-driven auth bypass would have compiled and
shipped silently.** Removed.

**② Three identical `GET /me/privileges` per page load.** `useRiskPrivileges`,
`useAuditPrivileges` and `useAdminPrivileges` are separate hooks with separate
caches, all calling the same endpoint and all getting the same answer.

**③ The privilege cache is not keyed on the user.** All three hooks use a bare
module-level `let _promise`. Sign out, sign in as someone else in the same tab,
and the previous user's authorization decision can be served until a reload.
See ⑮ — the audit one is strictly worse than the other two.

**④ A failed privilege fetch resolves to an empty privilege set.** So a gateway
timeout is indistinguishable from "you have no grants" — it sends people to find
a permission they already hold.

**⑤ `allowAll` is honoured unconditionally.** The backend confines it to
`APP_ENV=local`, but nothing client-side stops a response opening every screen.

**⑥ `window.confirm`** for the destructive restore-a-disabled-user path.

**⑦ A clickable `<Box>` where a `<button>` belongs** — the gross-score grid in
`EditRiskDialog`. Not keyboard-reachable, not announced. The source's own
`RiskScoreGrid` gets this right; only this second inline grid does not.

**⑧ The Admin index redirect contradicts its own comment** — it tries Users →
Risk Hub → Audit Hub while claiming to follow the nav order, which is Users →
Audit Hub → Risk Hub. Reproduced as-is. Needs a ruling.

**⑨ Two retired `RISK_*` privileges** still listed, seeded INACTIVE server-side so
they resolve for nobody.

**⑩ Scoped privileges are flattened** into a union across every register, so the
UI renders controls the backend may 403. The source's design, not a gap —
per-risk decisions read `effective_privileges` instead. Nothing forces a future
editor to remember that.

②–⑩ are **live in production today**. Lifting does not create them; it imports
them into a codebase whose other perspectives don't have them.

### 4.2 The lift caught these — a rewrite might not have

**⑪ The React Compiler skips `AddRisk` entirely.** `react-hook-form`'s `watch()`
returns functions that cannot be memoized, so the compiler bails on that
component: *"Compilation Skipped: Use of incompatible library"*. This app
compiles everything through `babel-plugin-react-compiler`; GRC does not. A
rewrite would have hit the same wall, but only after the rewriting was done.

**⑫ `authFetch` is omitted from several effect dependency arrays**
(`RiskRegisters`, `RiskAnalytics`). Harmless while the shim's callback identity
is stable — but the shim's stability is now load-bearing for correctness in
files nobody edited, and nothing tests it. If `useAccessToken`'s identity ever
churns, adding the missing dep would cause a refetch loop and omitting it leaves
a stale closure.

**⑬ A missing asset alias** — the error pages import `@assets/error/*.svg`,
which only failed at bundle time, not typecheck.

**⑭ One `setState`-in-effect lint error** in `HighRisksTable`, the same class as
this app's ten pre-existing ones.

### 4.3 A correction to my own earlier finding

**MUI X `<DatePicker>` does NOT inherently break this app's production build.**

I previously isolated a `vite build` failure to rendering a `<DatePicker>`, and
on that basis replaced every one with a native date input on the
`security-perspective` branch, recorded it as a port-wide decision, and you
approved it on that evidence.

**On this branch all ten `<DatePicker>` elements are present, reachable and
routed, and the build passes** — `DesktopDatePicker` and `LocalizationProvider`
are both in the emitted bundle. The difference is that `react-hook-form` and
`@wso2/oxygen-ui-charts-react` are now installed, which changes how rollup
chunks the graph.

So the failure was real but **chunking-sensitive, not caused by DatePicker**. My
diagnosis named the wrong culprit. It could recur under a different graph, so it
is worth knowing about — but "pickers cannot be used here" was wrong, and the
native-date deviation on the other branch rests on a faulty premise.

### 4.4 Audit Hub — the bug register

Lifted after Risk and Admin, on the finding that the module is **mostly
internal**: four of its five roles are INTERNAL, and only
`grc-platform-audit-external-auditor` is not
(`shared_seed_data.sql:232`). Its external role holds 4 of the 12 `AUDIT_*`
privileges. The auditor-only surfaces are not external-only either —
`canManageControls`, an internal role, bypasses the assigned-auditor check
(`ControlDrawer.tsx:1511-1513`), so internal compliance admins use them too.

Recorded, not fixed — reproducing the source is the point of lifting, and these
are its behaviour in production today. Numbering continues §4.1–4.2.

**⑮ `useAuditPrivileges` never clears its promise cache.** The strict version of
③. Risk and admin clear `_promise` on both success and failure; audit clears it
only in `.catch`. So the first privilege answer of a tab is cached for that
tab's entire lifetime — sign out, sign back in as someone else without a full
reload, and the previous user's authorization still decides what renders. The
other two at least refetch on the next mount.

**⑯ Two mock-auth bypasses, both wider than ①.** `isAssignedAuditor` returned
`true` for **every** user, not just gating a data load — it showed the sampling
and evidence-validation surfaces to anyone. `useAuditPrivileges.can()` returned
true for every privilege with no API call. Removed (E6). Worth stating what this
means for the source: with the flag on, GRC's own UI grants every auditor-only
surface to everyone. That is intended for local development, but it is one
config line, and `window.config` is served as a plain file.

**⑰ A stale comment now describes a mode that no longer exists here.**
`ControlDrawer.tsx:1165` reasons about "any allowAll/mock-auth account". The
mock-auth half is gone in this copy. Left as-is rather than edited, to keep the
diff against the source honest — but a reader will find it misleading.

**⑱ `AIValidationCard` is unreachable by design-accident.** 417 lines rendered
inside the control drawer whose API the route guard denies —
`routeguard.go:97-99` calls this *"a pre-existing gap, not a decision"*. It
lifts, compiles, renders, and its data call is refused. Not introduced here.

**⑲ Create Audit is 2,226 lines in one file.** Not a defect, but it is the
largest single file in the port and the one most likely to be edited blind.

### 4.5 The copy is already drifting from source — measured

A full sweep diffed all 176 lifted files against the source with the alias
rewrite reversed. **161 were byte-identical**; 15 differed, and 14 of those are
exactly E1–E6.

The fifteenth was not an edit at all — `AddRisk.tsx` had gone **stale**. Upstream
`fb294fa` (2026-09-15) landed after the risk module was copied and improved the
attachment-failure message to name which files failed and why; our copy still
said only "one or more". Refreshed from source with E1 re-applied, and verified
by re-diffing: E1 is now the only difference.

**It then happened again, during review of this very PR.** grc-tools `#83`
merged three hours before the PR opened and moved four more Risk files: the
detail drawer's gross/residual `ScoreChip` header, and three tables where
"Level" became "Residual Level". A reviewer re-ran this section's own diff and
found them. None carried an E-deviation, so all four were straight refreshes —
but the lesson is the timing, not the content: **twice now, in one working day,
and neither time did anything fail.**

**A third refresh, grc-tools #84 (`8c002b9`, 2026-09-17),** moved 15 Risk files:
the Reassess dialog's previous-score marker, the amendment diff banner, and the
dashboard drill-down into filtered Risk Registers. Two needed more than a copy,
which is §3a working as intended: `ReassessmentDialog.tsx` had its E2 undone by
the copy and re-applied, and `RiskDashboard.tsx` gained a new absolute
`navigate("/risk/registers?…")` that took E7. A full diff of `modules/risk`
afterwards showed only E1/E2/E5/E7/E8 and the deleted `nav.ts` (E4).

This is the cost of lifting, arriving on schedule rather than in theory, and it
is worth naming precisely: **nothing warns you.** The copy compiles, tests pass,
and the screens work — they are just a little behind, silently, and the gap only
grows. That is also why the source commit is recorded at the top of this file:
without a baseline, a sweep can only answer "does this differ from whatever is
checked out right now", which is a different and much weaker question.

Only a diff finds it, so repeat this one while both apps are live: for each file
under `features/security/grc`, reverse the alias rewrite (`@features/security/grc/…`
back to `@modules/`, `@components/`, and the two `shim/` paths to `@config/apiConfig`
and `@hooks/useAuthApiClient`) and compare against the same path under
`grc-tools/apps/grc-platform/webapp/src`. Everything should match except the
files listed in §3 — those carry E1–E8. Anything else is drift.

### 4.6 What the Audit Hub lift got right that the others did not

**The source's own tests came across and pass.** `utils/frameworkRollup.test.ts`
— 17 cases — needed only the alias rewrite. It is the only lifted file under
test, and it corrects §5's claim for this module: some tests did transfer.

## 5. What this does not prove

**Nothing here has been run.** Build success proves it compiles, bundles and
tree-shakes; it does not prove a single screen renders, that the shimmed auth
behaves like GRC's at runtime, or that the rethemed dialogs look right.

The audience blocker is **gone** — grc-tools #82 merged and deployed, and
AUTH_AUDIENCE now names this app's client id. CORS was measured and never
applied (§1). What remains unverified is the `email` claim: the GRC backend
reads it off the token in two load-bearing places, and this app sends its access
token where the source sends the ID token. If that claim is absent, the symptom
is a 403 on every Risk and Admin route that looks exactly like a missing
permission — see §2 for the one-line swap.

**Almost no tests came across.** Of the 1,326 passing here, 1,303 are this app's
existing suite, 6 are `useSecurityGate.test.tsx` (written for E5, covering only
whether the gate fetches), and 17 are the audit module's own
`frameworkRollup.test.ts`, which transferred intact. That one pure-function file
is the only lifted code under test; no lifted screen is.

**The Audit Hub is now included.** The original objection — that porting its
internal half would split `ControlDrawer.tsx` across two codebases against one
backend — is answered by lifting the whole module, which avoids the split
entirely. The cost is carrying external-auditor code paths that cannot run here,
since external identities live in a separate Asgardeo organisation this app does
not authenticate against. Those paths stay dark because the UI is
privilege-driven and the backend re-derives every check independently.

**GRC keeps serving the Audit Hub regardless**, because external auditors stay
there. So this is a second copy of that workflow, not a move, for as long as
both run.
