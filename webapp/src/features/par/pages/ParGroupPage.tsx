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
import { Navigate, Outlet } from "react-router";
import { Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { GaugeIcon } from "@wso2/oxygen-ui-icons-react";
import RoutedTabs, { type RoutedTabDef } from "@components/routed-tabs/RoutedTabs";
import { useMeProfile } from "@features/my/api/useMeProfile";
import ParShell from "../components/ParShell";
import { useActiveParCycle, useParHasActiveCycle, useParHasLead } from "../api/useParData";

// Tab labels and order match par-app's own OngoingCycleView.tsx tab bar
// (Employee Feedback / Request 360° / Provide 360° / F2F). History is
// folded in as a fifth tab (a separate top-level route in the source) and,
// unlike the first four, isn't gated by lead presence below.
const FULL_TABS: RoutedTabDef[] = [
  { segment: "employee-feedback", label: "Employee Feedback" },
  { segment: "request-360", label: "Request 360° Feedback" },
  { segment: "provide-360", label: "Provide 360° Feedback" },
  { segment: "f2f", label: "F2F" },
  { segment: "history", label: "PAR History" },
];

// OngoingCycleView.tsx:66-112 — an employee with no lead (`leadEmail ===
// null`) gets exactly ONE tab, Provide 360° Feedback: no self-review, no
// requesting reviewers for themselves, no F2F. History still shows (see
// above).
const LEADLESS_TABS: RoutedTabDef[] = [
  { segment: "provide-360", label: "Provide 360° Feedback" },
  { segment: "history", label: "PAR History" },
];

// No OPEN cycle: every other tab only makes sense mid-cycle, so History is
// the only one left, regardless of lead presence.
const HISTORY_ONLY_TABS: RoutedTabDef[] = [{ segment: "history", label: "PAR History" }];

// One page frame for everything an employee does with their own PAR — the
// shell, the tab bar, and an <Outlet /> for whichever tab the URL names.
export default function ParGroupPage() {
  // OngoingCycleView.tsx's own header: an icon before the cycle's name,
  // falling back to "Employee Portal" when there's no active cycle.
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycleName = activeCycles.data?.[0]?.parCycleName;
  const { hasLead, isLoading } = useParHasLead(workEmail, profile.isLoading);
  const { isActive, isLoading: isActiveLoading } = useParHasActiveCycle(workEmail, profile.isLoading);

  const tabs = !isActive ? HISTORY_ONLY_TABS : hasLead ? FULL_TABS : LEADLESS_TABS;

  return (
    <ParShell>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
        <GaugeIcon size={32} />
        <Typography variant="h4">{cycleName || "Employee Portal"}</Typography>
      </Stack>
      {isLoading || isActiveLoading ? (
        <Skeleton variant="rectangular" height={36} sx={{ borderRadius: 1, mb: 2, maxWidth: 640 }} />
      ) : (
        <>
          <RoutedTabs basePath="/me/performance" tabs={tabs} ariaLabel="Performance sections" />
          <Outlet />
        </>
      )}
    </ParShell>
  );
}

/** The index route of the group: sends a leadless employee straight to
 * Provide 360° Feedback (their only tab), an employee with no active cycle
 * to History (their only tab), and everyone else to Employee Feedback.
 * Waits for both questions rather than guessing, same reasoning as
 * LeaveGroupIndex. */
export function ParGroupIndex() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const { hasLead, isLoading } = useParHasLead(workEmail, profile.isLoading);
  const { isActive, isLoading: isActiveLoading } = useParHasActiveCycle(workEmail, profile.isLoading);
  if (isLoading || isActiveLoading) return null; // ParGroupPage already holds the Outlet behind its own gate
  if (!isActive) return <Navigate to="/me/performance/history" replace />;
  return <Navigate to={`/me/performance/${hasLead ? "employee-feedback" : "provide-360"}`} replace />;
}

/** Guards a route only a leadless employee should never reach by typing its
 * URL — Employee Feedback and Request 360° Feedback, per OngoingCycleView.tsx.
 * Hiding a tab is not access control; the route is what actually enforces it. */
export function ParRequiresLeadRoute({ children }: { children: ReactNode }) {
  const profile = useMeProfile();
  const { hasLead, isLoading } = useParHasLead(profile.data?.userInfo.workEmail, profile.isLoading);
  if (isLoading) return null;
  if (!hasLead) return <Navigate to="/me/performance/provide-360" replace />;
  return <>{children}</>;
}

/** Guards every tab but History from being reached by URL once there's no
 * OPEN cycle — Employee Feedback, Request/Provide 360°, and F2F all act on
 * an in-progress cycle, so none of them has anything to show without one.
 * Hiding the tab is not access control; the route is what actually enforces
 * it, same reasoning as ParRequiresLeadRoute. */
export function ParRequiresActiveCycleRoute({ children }: { children: ReactNode }) {
  const profile = useMeProfile();
  const { isActive, isLoading } = useParHasActiveCycle(profile.data?.userInfo.workEmail, profile.isLoading);
  if (isLoading) return null;
  if (!isActive) return <Navigate to="/me/performance/history" replace />;
  return <>{children}</>;
}
