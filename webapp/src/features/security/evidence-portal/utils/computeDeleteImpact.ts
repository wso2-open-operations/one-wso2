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

import { timeAgo } from "./timeAgo";
import type { CascadeImpact } from "../components/ConfirmDeleteDialog";

/**
 * The three levels a delete can be confirmed at. A Product's deletion path
 * is every Control under every Framework of that Product; a Framework's is
 * its direct Controls; a Control's is itself.
 */
export type DeleteImpactLevel = "product" | "framework" | "control";

// Minimal shapes this module needs from each list. Kept structural (no id
// beyond what's read here) so the pickers' own, richer row types — which
// carry name, description and the rest — still satisfy these without a
// cast.
export type DeleteImpactFramework = { id: number; product_id: number };
export type DeleteImpactControl = { id: number; framework_id: number };
export type DeleteImpactEvidence = { id: number; control_id: number };
export type DeleteImpactSubmission = { id: number; evidence_id: number; status: string };
export type DeleteImpactTask = {
  status: string;
  control_id: number | null;
  started_at: string | null;
  user_email: string;
};

export type ComputeDeleteImpactArgs = {
  level: DeleteImpactLevel;
  targetId: number;
  frameworks: DeleteImpactFramework[];
  controls: DeleteImpactControl[];
  evidence: DeleteImpactEvidence[];
  submissions: DeleteImpactSubmission[];
  tasks: DeleteImpactTask[];
};

export type ComputeDeleteImpactResult = {
  impact: CascadeImpact[];
  warnings: string[];
};

/**
 * Works out what a delete at the given level would take with it: the
 * cascade counts shown in the amber block of ConfirmDeleteDialog, and the
 * red warnings for any Agent Task still marked as running against a Control
 * in the deletion path.
 *
 * Used to live as two near-identical copies inside each of ProductPicker,
 * FrameworkPicker and ControlPicker. Pulled out here so the counting rules
 * and the warning wording exist in exactly one place.
 */
export function computeDeleteImpact({
  level,
  targetId,
  frameworks,
  controls,
  evidence,
  submissions,
  tasks,
}: ComputeDeleteImpactArgs): ComputeDeleteImpactResult {
  const fwIds =
    level === "product" ? frameworks.filter((f) => f.product_id === targetId).map((f) => f.id) : [];

  // ctrlIds is the full deletion path's controls, whichever level we're at
  // — reused below for both the cascade counts and the running-task
  // warning, so the tree is only walked once.
  const ctrlIds =
    level === "control"
      ? [targetId]
      : level === "framework"
        ? controls.filter((c) => c.framework_id === targetId).map((c) => c.id)
        : controls.filter((c) => fwIds.includes(c.framework_id)).map((c) => c.id);

  const evIds = evidence.filter((e) => ctrlIds.includes(e.control_id)).map((e) => e.id);
  const subs = submissions.filter((s) => evIds.includes(s.evidence_id));
  const approvedCount = subs.filter((s) => s.status === "approved").length;

  const impact: CascadeImpact[] = [];
  if (level === "product") {
    impact.push({ label: "frameworks", count: fwIds.length });
  }
  if (level !== "control") {
    impact.push({ label: "controls", count: ctrlIds.length });
  }
  impact.push(
    { label: "evidence records", count: evIds.length },
    { label: "submission records", count: subs.length },
    { label: "approved submissions", count: approvedCount }
  );

  const scopeText =
    level === "product"
      ? "against controls in this product"
      : level === "framework"
        ? "against controls in this framework"
        : "against this control";

  // status = "running" isn't trustworthy on its own — a crashed Runner
  // leaves that row forever, and there's no heartbeat column. Showing how
  // long ago it started lets the Admin judge that instead of the system
  // claiming it.
  const activeRuns = tasks.filter(
    (t) => t.status === "running" && t.control_id !== null && ctrlIds.includes(t.control_id)
  );
  const warnings =
    activeRuns.length === 0
      ? []
      : [
          `${activeRuns.length} agent run${activeRuns.length === 1 ? "" : "s"} marked as in progress ${scopeText}.`,
          ...activeRuns.map((t) => `Started ${timeAgo(t.started_at)} by ${t.user_email}.`),
          "If it is still running, deleting now will leave its evidence unlinked.",
        ];

  return { impact, warnings };
}
