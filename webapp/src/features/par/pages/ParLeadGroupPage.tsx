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

import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { Box } from "@wso2/oxygen-ui";
import RoutedTabs, { type RoutedTabDef } from "@components/routed-tabs/RoutedTabs";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { isPreviewEnabled } from "@config/previewFeatures";
import ParShell from "../components/ParShell";
import { useParCanSeeLeadPortal, useParIsTeamLead } from "../api/useParData";
import { useLeadsALeader } from "../api/useLeadership360";

const BASE_PATH = "/people-ops/performance/lead";

// Tab labels match par-app's own LeadPortal.tsx tab bar, in Title Case rather
// than its literal ALL-CAPS label strings — same normalization ParGroupPage
// already applies to the Employee Portal's tabs. Only tabs with a real route
// in App.tsx are listed here — ported one at a time, same as the Employee
// Portal — so the bar never links to a screen that isn't built yet.
//
// "Top 5%/20% Allocation" carries the slash source's own tab bar omits
// (LeadPortal.tsx's literal label is "TOP 5%20% ALLOCATION") — every other
// occurrence in this feature (the cycle stepper, the roster column, the
// review panel, the PDF export) uses the slash, and a live nav label read
// daily is a weak place to preserve that one inconsistency.
const TABS: RoutedTabDef[] = [
  { segment: "direct-reports", label: "Direct Reports" },
  { segment: "additional-reports", label: "Additional Reports" },
  { segment: "report-chain", label: "Report Chain" },
  { segment: "employee-history", label: "Employee History" },
  { segment: "allocation", label: "Top 5%/20% Allocation" },
];

// No active cycle: every tab but Employee History acts on cycle data that
// doesn't exist without one (isTeamLead is itself scoped to the active
// cycle — see ParEmployeeInfo).
const HISTORY_ONLY_TABS: RoutedTabDef[] = [{ segment: "employee-history", label: "Employee History" }];

// Leadership 360° runs on its own survey dates, not a PAR cycle, so it joins
// either tab set above — but only for a lead with a member of the leadership
// group among their reports, the only people it has anything to show.
const LEADERSHIP_360_TAB: RoutedTabDef = { segment: "leadership-360", label: "Leadership 360°" };

// One page frame for everything a lead does for their reports — the
// employee-facing counterpart, ParGroupPage.tsx, now lives under the Me
// perspective (/me/performance); this page stays at
// /people-ops/performance/lead.
//
// The active-cycle tab gate lives HERE rather than in a per-route wrapper
// around each child <Route>, on purpose: this component mounts once per
// portal visit and stays mounted while switching tabs, so employeeInfo is
// resolved once and stays stable. A wrapper re-mounted on every tab click
// would re-run useMeProfile()/useParIsTeamLead() from scratch each time —
// and since useMeProfile's identity resolution (useAsgardeoSub) restarts
// from "loading" on every fresh mount, a disabled-but-not-yet-loading query
// can read isTeamLead as false for one render before identity catches up,
// firing a wrong redirect that then can't correct itself once the guard
// unmounts. Keeping the check on this persistent component sidesteps the
// remount race entirely.
export default function ParLeadGroupPage() {
  const profile = useMeProfile();
  const employeeInfo = useParIsTeamLead(profile.data?.userInfo.workEmail);
  const leadsALeader = useLeadsALeader(isPreviewEnabled("leadership360"));
  const { pathname } = useLocation();

  const currentSegment = pathname.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length).replace(/^\//, "").split("/")[0]
    : "";
  const needsActiveCycle =
    currentSegment !== "" && currentSegment !== "employee-history" && currentSegment !== "leadership-360";
  const cycleTabs = employeeInfo.isTeamLead ? TABS : HISTORY_ONLY_TABS;

  return (
    <ParShell
      title="Lead View"
      subtitle="Review and rate your reports' PAR, manage their 360° feedback and F2F and see their record from past cycles."
    >
      <RoutedTabs
        basePath={BASE_PATH}
        tabs={leadsALeader ? [...cycleTabs, LEADERSHIP_360_TAB] : cycleTabs}
        ariaLabel="Lead View sections"
      />
      {needsActiveCycle && !employeeInfo.isTeamLead ? (
        <Navigate to={`${BASE_PATH}/employee-history`} replace />
      ) : (
        <Outlet />
      )}
    </ParShell>
  );
}

/** The index route of the group: sends an active-cycle lead to Direct
 * Reports, and everyone else to Employee History (their only tab). */
export function ParLeadGroupIndex() {
  const profile = useMeProfile();
  const employeeInfo = useParIsTeamLead(profile.data?.userInfo.workEmail);
  return <Navigate to={`${BASE_PATH}/${employeeInfo.isTeamLead ? "direct-reports" : "employee-history"}`} replace />;
}

/** Guards the whole /people-ops/performance/lead subtree — par-app's own
 * Role.TEAM_LEAD gate on /lead-portal (route.ts), OR'd with the org-chart
 * signal (GET /employees?leadEmail=, the same lookup Employee History
 * itself uses) so a real lead keeps access once their cycle closes and
 * isTeamLead goes false. Hiding the nav item is not access control; the
 * route is what actually enforces it, same reasoning as ParRequiresLeadRoute.
 *
 * This component mounts once per portal visit and stays mounted while
 * switching tabs (only ParLeadGroupPage's own <Outlet /> content changes),
 * so it isn't exposed to the remount-per-click identity race described on
 * ParLeadGroupPage above. */
export function ParRequiresTeamLeadRoute({ children }: { children: ReactNode }) {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const gate = useParCanSeeLeadPortal(workEmail);
  const { employeeInfo, directReports } = gate;
  if (profile.isLoading || gate.isLoading) return null;
  // A failed lookup must not read as "not a lead" — that would silently
  // redirect an actual team lead away with no indication anything went
  // wrong, the same mistake the fail-closed default above already guards
  // against for the loading case.
  if (profile.isError) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
          Couldn't load your profile.
        </ErrorNotice>
      </Box>
    );
  }
  if (employeeInfo.isError) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorNotice
          error={employeeInfo.error}
          onRetry={() => employeeInfo.refetch()}
          retrying={employeeInfo.isFetching}
        >
          Couldn't check whether you're a team lead.
        </ErrorNotice>
      </Box>
    );
  }
  if (employeeInfo.isTeamLead) return <>{children}</>;
  if (directReports.isError) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorNotice
          error={directReports.error}
          onRetry={() => directReports.refetch()}
          retrying={directReports.isFetching}
        >
          Couldn't check whether you have any reports.
        </ErrorNotice>
      </Box>
    );
  }
  if (!gate.canSee) {
    return <Navigate to="/me/performance" replace />;
  }
  return <>{children}</>;
}
