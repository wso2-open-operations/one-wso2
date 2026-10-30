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

import type { JSX } from "react";
import { Box, ButtonBase, Stack, Typography } from "@wso2/oxygen-ui";
import type { ApprovalStep } from "@features/sales/cado2/approvals/api/approvalTypes";
import { roleLabel, STEP_STATUS } from "@features/sales/cado2/approvals/model/approvalText";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import SlaChip from "@features/sales/cado2/approvals/components/SlaChip";
import StatusChip from "@features/sales/cado2/components/status-chip/StatusChip";

interface ApprovalReasonsProps {
  readonly steps: readonly ApprovalStep[];
  /** The role picked in the graph; its entry is highlighted. */
  readonly selected?: string | null;
  readonly onSelect?: (role: string | null) => void;
}

const day = (iso: string) => formatDate(iso.slice(0, 10));

/**
 * Every approval in order, with why it is needed, its status, who
 * decided and their comment. The readable companion to the graph.
 */
export default function ApprovalReasons({ steps, selected = null, onSelect }: ApprovalReasonsProps): JSX.Element {
  return (
    <Box
      component="ol"
      aria-label="Approval chain"
      sx={{ m: 0, p: 0, listStyle: "none", display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 0.75 }}
    >
      {steps.map((s) => {
        const status = s.status ? STEP_STATUS[s.status] : null;
        const on = selected === s.role;
        return (
          <Box component="li" key={s.role} aria-label={s.roleLabel}>
            <ButtonBase
              onClick={() => onSelect?.(on ? null : s.role)}
              aria-pressed={on}
              sx={{
                display: "block",
                width: "100%",
                textAlign: "left",
                height: "100%",
                px: 1.25,
                py: 0.75,
                borderRadius: 1.5,
                borderLeft: 3,
                borderColor: on ? "primary.main" : "divider",
                bgcolor: on ? "action.selected" : "action.hover",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                  {s.roleLabel}
                </Typography>
                {s.dependsOn.length ? (
                  <Typography variant="caption" color="text.secondary">
                    after {s.dependsOn.map(roleLabel).join(" and ")}
                  </Typography>
                ) : null}
                {s.canAct ? (
                  <StatusChip color="primary" label="Your turn" />
                ) : s.carriedFrom ? (
                  // Approved in an earlier version, not asked again (D119).
                  <StatusChip color="success" label="Already approved" />
                ) : status ? (
                  <StatusChip color={status.color} label={status.label} />
                ) : null}
                {/* A pending step's deadline. */}
                {s.status === "PENDING" && s.slaState && s.dueAt ? <SlaChip state={s.slaState} dueAt={s.dueAt} /> : null}
              </Stack>
              <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.25 }}>
                {s.triggers.map((t, i) => (
                  <Typography key={i} component="li" variant="caption" color="text.secondary" display="list-item">
                    {t.reason}
                    {/* D119: already approved, or why it's asked again. */}
                    {t.carriedFromVersion != null && !s.carriedFrom ? (
                      <Box component="span" sx={{ color: "success.main" }}>{` · already approved in v${t.carriedFromVersion}`}</Box>
                    ) : null}
                    {t.note ? (
                      <Box component="span" display="block" sx={{ color: "primary.main", fontWeight: 600 }}>
                        {t.note}
                      </Box>
                    ) : null}
                  </Typography>
                ))}
              </Box>
              {s.carriedFrom ? (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Carried over from v{s.carriedFrom.versionNumber}
                  {s.carriedFrom.actedByEmail ? ` · approved by ${s.carriedFrom.actedByEmail}` : ""}
                  {s.carriedFrom.onBehalf ? " (Deal Desk, on behalf)" : ""}
                  {s.carriedFrom.actedAt ? ` · ${day(s.carriedFrom.actedAt)}` : ""}
                </Typography>
              ) : s.actedAt && s.status !== "CANCELLED" ? (
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  {/* D120: Deal Desk approved for the role's approver. */}
                  {s.approvedOnBehalf
                    ? `Approved by ${s.actedByEmail} (Deal Desk) on behalf of ${s.roleLabel} · ${day(s.actedAt)}`
                    : `${status?.label} by ${s.actedByEmail} · ${day(s.actedAt)}`}
                </Typography>
              ) : null}
              {s.comment ? (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: "italic" }}>
                  “{s.comment}”
                </Typography>
              ) : null}
              {s.cantActReason ? (
                <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.5 }}>
                  {s.cantActReason}
                </Typography>
              ) : null}
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}
