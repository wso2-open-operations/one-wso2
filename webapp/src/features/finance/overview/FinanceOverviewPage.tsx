/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useState } from "react";
import { Alert, Button, MenuItem, Select } from "@wso2/oxygen-ui";
import { LayoutDashboardIcon } from "@wso2/oxygen-ui-icons-react";
import { useFinanceGate } from "../api/useFinanceGate";
import CcDashboardPage from "../cc/pages/CcDashboardPage";
import OpdDashboardScreen from "../opd/dashboard/OpdDashboardScreen";
import ExpenseDashboardScreen from "../expense/dashboard/ExpenseDashboardScreen";
import OverviewDefaultSummary from "./OverviewDefaultSummary";
import FinanceShell from "../components/FinanceShell";
import { isCcBackendConfigured } from "@config/apiConfig";

type OverviewTab = "default" | "cc" | "opd" | "expense";

// "Credit Card", not "Credit Card Expenses" — that name already belongs to
// the app-section entry in the Finance rail (Pending Submissions, Approve
// Submissions, ...), a different destination from this dashboard. Same
// label in two places meaning two different things is exactly the
// confusion this drops.
//
// "Default" is a quick, controls-free glance at Credit Card — the summary
// tiles, Cardholders Details and Submitted Expenses by Category, with no
// period/view-mode selectors — not the same thing as "Credit Card", which
// still opens the full dashboard. It exists so landing on Overview shows
// something meaningful immediately rather than silently defaulting to one
// of the full dashboards underneath.
const OVERVIEW_SECTIONS: { value: OverviewTab; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "opd", label: "OPD Claims" },
  { value: "expense", label: "Expense Claims" },
  { value: "cc", label: "Credit Card" },
];

/**
 * Finance → Overview. Used to be a rail group that expanded into separate
 * rows per dashboard, each its own click before you reached it. This is the
 * one screen the rail now sends you to; the dropdown does the switching that
 * used to be a second click in the sidebar.
 *
 * No header of its own — the dropdown TAKES THE PLACE of whichever
 * dashboard's own eyebrow chip would show, via `FinanceShell`'s `actions`
 * slot (see `headerActions` below; `FinanceShell` renders `actions ?? <Chip
 * .../>`, never both) — the dropdown already says which section is showing,
 * so the chip would only repeat it.
 *
 * No dashboard changed to get here — each is still the exact same
 * default-exported page (own eyebrow chip, title, config-gating, loading and
 * error states), just chosen by the dropdown instead of a route. Both
 * `OpdDashboardScreen` and `ExpenseDashboardScreen` still enforce their own
 * finance-approver role check internally, so someone without it sees that
 * screen's own notice, not a missing option.
 */
export default function FinanceOverviewPage() {
  // Three single-backend asks, each independently scoped rather than one
  // three-wide gate — this is what lets every check below wait on only the
  // ONE backend it actually needs, instead of a slow backend nobody's
  // decision depends on holding up the page. Deduped against each other by
  // React Query's own query-key cache, so this costs no extra request over a
  // single combined call.
  const opdGate = useFinanceGate(true, ["opd"]);
  const expenseGate = useFinanceGate(true, ["expense"]);
  const ccGate = useFinanceGate(true, ["cc"]);

  // `picked` is null until someone chooses, or until the default below
  // settles and locks itself in (see the render-time adjustment further
  // down) — from then on this is the only thing `section` reads, and the
  // priority computation underneath it is never consulted again for this
  // mount.
  //
  // Declared before the access guard below, not after: React's Rules of
  // Hooks — every hook has to run on every render, so this can't follow an
  // early return.
  const [picked, setPicked] = useState<OverviewTab | null>(null);

  // Priority order: OPD, then Expense, then Default (the CC-centric landing
  // summary, shown whenever neither OPD nor Expense wins) — reviewed into
  // this order because OPD is the common case. Staged rather than flat, so a
  // role that ranks ABOVE another is never skipped just because it hasn't
  // answered yet: Expense is not consulted at all until OPD has definitively
  // said no, and the Default/CC tier (the last resort) not until Expense has
  // too.
  //
  // `defaultStable` is the second half of this, for a case "definitively
  // no" glossed over: OPD can also settle by ERRORING, which reads exactly
  // like "no role" to `opdFinance` but is NOT definitive — a retry could
  // still turn it into a yes, which would need to outrank whatever we
  // picked by falling through. A default reached by stepping over an
  // errored tier is marked unstable so it is shown (it is still the best
  // answer available right now) but never LOCKED — seen below, where only a
  // stable default gets written to `picked`. This is what stops the bug
  // reported as "after a successful retry, Overview shows the wrong
  // dashboard": the wrong tab was never actually committed, so the next
  // render's recomputed default (now OPD, say) is still free to replace it.
  let defaultSection: OverviewTab | null;
  let defaultStable: boolean;
  if (opdGate.isResolving) {
    defaultSection = null;
    defaultStable = false;
  } else if (opdGate.opdFinance) {
    defaultSection = "opd";
    defaultStable = true; // nothing outranks OPD, so nothing can un-decide this
  } else if (expenseGate.isResolving) {
    defaultSection = null;
    defaultStable = false;
  } else if (expenseGate.expenseFinance) {
    defaultSection = "expense";
    defaultStable = !opdGate.opdErrored;
  } else if (ccGate.isResolving) {
    defaultSection = null;
    defaultStable = false;
  } else {
    defaultSection = "default";
    defaultStable = !opdGate.opdErrored && !expenseGate.expenseErrored;
  }

  // Adjusting state during render rather than in an effect, the pattern
  // React's own docs recommend for "remember this, once" (no extra
  // render-commit-effect round trip, and nothing to clean up). Guarded by
  // `picked === null` so it only ever fires the one time: without this, a
  // role that resolves (or simply changes, on a background refetch) after a
  // lower-priority one already committed would silently swap what the
  // reader is looking at — reviewed as "Overview ... should never switch on
  // its own". `defaultStable` is the other half of that same guarantee —
  // see its own comment above.
  if (picked === null && defaultSection !== null && defaultStable) {
    setPicked(defaultSection);
  }
  const section = picked ?? defaultSection;

  // An OR across all three — true as soon as ANY one resolves and grants
  // access, without needing the other two to also answer first. A reader
  // whose own role already came back never waits on backends that were
  // never going to change their answer.
  const hasAccess = ccGate.ccHasOwnCard || opdGate.opdFinance || expenseGate.expenseFinance;
  const stillDeciding = opdGate.isResolving || expenseGate.isResolving || ccGate.isResolving;
  if (!hasAccess && stillDeciding) {
    return null;
  }

  // Every errored backend, not just the first found — `foldIdentityError`
  // marks all three failed together on an identity hiccup, so naming only
  // CC (say) would retry CC alone and leave the reader staring at the same
  // banner once OPD or Expense's own turn to be checked came up. Computed
  // whether or not the reader has access, because a failure is not only
  // worth reporting when it is the ONLY thing standing between them and the
  // page — see the non-blocking banner below for the other case.
  const failures = [
    ccGate.ccErrored && { label: "Credit Card", retry: ccGate.retryCc },
    opdGate.opdErrored && { label: "OPD Claims", retry: opdGate.retryOpd },
    expenseGate.expenseErrored && { label: "Expense Claims", retry: expenseGate.retryExpense },
  ].filter((f): f is { label: string; retry: () => void } => f !== false);

  const failureBanner = failures.length > 0 && (
    <Alert
      severity="error"
      sx={{ mb: 2 }}
      action={
        <Button size="small" onClick={() => failures.forEach((f) => f.retry())} sx={{ textTransform: "none" }}>
          Retry
        </Button>
      }
    >
      Couldn&apos;t check your{" "}
      {new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(failures.map((f) => f.label))}{" "}
      access.
    </Alert>
  );

  // The rail hides this entry when nobody has a role, but hiding a link is
  // not access control — the route is still reachable by a bookmark or a
  // typed URL, the same reasoning `ClaimApprovalTabRoute` guards each of ITS
  // routes on. No data exposure either way — same as any finance route
  // today — just a dead-end UI this closes off.
  if (!hasAccess) {
    // An error is not the same sentence as a refusal: a reader denied every
    // role fairly hears "not for you"; a reader whose lookup failed outright
    // hears that it failed, with a way back.
    if (failureBanner) return failureBanner;
    return <Alert severity="info">This isn&apos;t available for your role.</Alert>;
  }
  // Still deciding the default (every backend above the eventual answer has
  // to resolve first — see `defaultSection`) or picked but the picked tab's
  // own backend hasn't answered yet. Nothing rendered either way: a
  // placeholder would be the one thing left to blink on the way to the
  // dashboard underneath.
  const sectionGate =
    section === "opd"
      ? opdGate
      : section === "expense"
        ? expenseGate
        : section === "cc" || section === "default"
          ? ccGate
          : null;
  if (sectionGate === null || sectionGate.isResolving) {
    return null;
  }

  // Same access this page's own default above already reads — each tab
  // offered only when there's a real reason to open it. Without this the
  // dropdown offered every reader every tab whether they held the role or
  // not, and picking one landed them on that dashboard's own denial notice
  // instead of a filtered list.
  //
  // Never empty here specifically: `hasAccess` above is already true, and it
  // can only be true because one of these three flags is — so by this line
  // at least one of them is guaranteed true, even if the other two are still
  // resolving (and so, for now, read as the false they will settle into).
  const visibleSections = OVERVIEW_SECTIONS.filter((s) =>
    s.value === "cc" || s.value === "default"
      ? ccGate.ccHasOwnCard
      : s.value === "opd"
        ? opdGate.opdFinance
        : expenseGate.expenseFinance,
  );

  // Built from `visibleSections`, not a fixed "Credit Card, Expense Claims
  // and OPD Claims" string — a reader with only one or two of the three apps
  // would otherwise see the subtitle promise a dashboard the switcher never
  // actually offers them.
  const appNames = new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(
    visibleSections.filter((s) => s.value !== "default").map((s) => s.label),
  );

  const switcher = (
    <Select
      size="small"
      value={section}
      onChange={(e) => setPicked(e.target.value as OverviewTab)}
      inputProps={{ "aria-label": "Overview section" }}
      sx={{ minWidth: 220 }}
    >
      {visibleSections.map((s) => (
        <MenuItem key={s.value} value={s.value}>
          {s.label}
        </MenuItem>
      ))}
    </Select>
  );

  // `failureBanner` here is the case review asked for: a reader who DOES
  // have access (through some other role) still hears about a backend that
  // failed to check, instead of that backend just silently never appearing
  // in the dropdown — indistinguishable, until now, from genuinely holding
  // no role there.
  const page =
    section === "default" ? (
      <FinanceShell
        eyebrow={{ icon: LayoutDashboardIcon, label: "Overview" }}
        title="Finance Overview"
        subtitle={`A quick glance across ${appNames} — pick one by name above for its full dashboard.`}
        configured={isCcBackendConfigured()}
        configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
        actions={switcher}
      >
        <OverviewDefaultSummary />
      </FinanceShell>
    ) : section === "cc" ? (
      <CcDashboardPage headerActions={switcher} />
    ) : section === "opd" ? (
      <OpdDashboardScreen headerActions={switcher} />
    ) : (
      <ExpenseDashboardScreen headerActions={switcher} />
    );
  if (!failureBanner) return page;
  return (
    <>
      {failureBanner}
      {page}
    </>
  );
}
