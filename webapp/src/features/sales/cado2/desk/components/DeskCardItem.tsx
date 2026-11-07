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

import type { JSX, ReactNode } from "react";
import { useNavigate, Link as RouterLink } from "react-router";
import { Box, Chip, Link, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { cado2Paths } from "@features/sales/cado2/cado2Paths";
import { formatMoney } from "@features/sales/cado2/utils/money";
import type { DeskCard, DeskColumnKey } from "../api/deskTypes";
import { daysSince, dueText } from "../utils/deskBoard";

const DEAL_TYPE: Record<string, string> = { FIRST_SALE: "First Sale", RENEWAL: "Renewal", EXPANSION: "Expansion", OTHER: "Other" };

/** A small status pill in the card's top right. */
function Pill({ label, tone }: { readonly label: string; readonly tone: "late" | "soon" | "fine" | "ok" }): JSX.Element {
  const sx =
    tone === "late"
      ? { bgcolor: "error.main", color: "error.contrastText", borderColor: "transparent" }
      : tone === "soon"
        ? { bgcolor: "warning.light", color: "warning.contrastText", borderColor: "transparent" }
        : tone === "ok"
          ? { color: "success.main", borderColor: "success.light" }
          : {};
  return <Chip size="small" variant="outlined" label={label} sx={{ fontWeight: 600, height: 22, ...sx }} />;
}

const ago = (d: number) => (d === 0 ? "today" : `${d} d ago`);

/** A link in the card's footer, which mustn't also open the card. */
function Act({ to, children }: { readonly to: string; readonly children: ReactNode }): JSX.Element {
  return (
    <Link component={RouterLink} to={to} onClick={(e) => e.stopPropagation()} sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
      {children}
    </Link>
  );
}

/**
 * One quote on the board (D130): what kind of deal, where it stands, and how
 * Deal Desk can act: Approve when its own approval is pending, Revise when
 * it's back with the AM, Recall while it's with other approvers or approved
 * but not issued (then Revise), Approve on behalf when another approval is
 * overdue. Opens the quote; its back link returns here.
 */
export default function DeskCardItem({ card: c, column }: { readonly card: DeskCard; readonly column: DeskColumnKey }): JSX.Element {
  const navigate = useNavigate();
  const due = c.dueAt ? dueText(c.dueAt) : null;
  const idle = daysSince(c.changedAt);
  let pill: ReactNode = null;
  let line = `${c.opportunityName ?? "—"} · ${c.ownerEmail}`;
  let aside = c.submittedByYou ? "You submitted: a colleague approves" : c.resubmitted ? "Resubmitted" : DEAL_TYPE[c.dealType];
  // Recall while it's in approval or approved but not issued (D122, D127); then Revise.
  let note: ReactNode = null;
  const recall = <Act to={cado2Paths.quoteFromDesk(c.quoteId, "quote", "recall")}>Recall as Deal Desk</Act>;
  let act: ReactNode = recall;
  if (column === "review" || column === "others") {
    pill = due ? <Pill label={due.text} tone={due.tone} /> : null;
  }
  // Deal Desk's own approval: the quote page opens on its Approval card.
  // Who submitted it can't approve it, so Recall stays for them.
  if (column === "review" && !c.submittedByYou) {
    act = <Act to={cado2Paths.quoteFromDesk(c.quoteId)}>Approve</Act>;
  }
  if (column === "others") {
    line = `Waiting on ${c.waitingOn.join(", ") || "—"}`;
    aside = `${c.approvedSteps} of ${c.totalSteps} approved`;
    if (c.overdueOnBehalf) {
      act = (
        <Stack direction="row" spacing={1.5}>
          <Act to={cado2Paths.quoteFromDesk(c.quoteId, "approvals")}>Approve on behalf…</Act>
          {recall}
        </Stack>
      );
    }
  }
  if (column === "back") {
    pill = <Pill label={`${c.status === "RETURNED" ? "Returned" : "Recalled"} ${ago(idle)}`} tone="fine" />;
    line = `${c.status === "RETURNED" ? `Returned by ${c.returnedBy ?? "an approver"}` : "Recalled"} · ${c.ownerEmail}`;
    aside = idle >= 3 ? `No change in ${idle} days` : "AM is on it";
    note = c.returnComment ? `“${c.returnComment}”` : null;
    act = <Act to={cado2Paths.quoteFromDesk(c.quoteId, "quote", "revise")}>Revise as Deal Desk</Act>;
  }
  if (column === "approved") {
    pill = <Pill label={`Approved ${ago(daysSince(c.approvedAt))}`} tone="ok" />;
    line = `Order form not issued · ${c.ownerEmail}`;
    aside = DEAL_TYPE[c.dealType];
  }
  return (
    <Paper
      variant="outlined"
      role="link"
      tabIndex={0}
      aria-label={`${c.quoteNumber ?? "Quote"} · ${c.accountName ?? ""}`}
      onClick={() => navigate(cado2Paths.quoteFromDesk(c.quoteId))}
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate(cado2Paths.quoteFromDesk(c.quoteId));
      }}
      sx={{ p: 1.5, borderRadius: 2, cursor: "pointer", "&:hover, &:focus-visible": { borderColor: "text.secondary" } }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {c.quoteNumber ?? "Draft"} · v{c.versionNumber}
        </Typography>
        {pill}
      </Stack>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.5 }} noWrap>
        {c.accountName ?? "—"}
      </Typography>
      <Typography variant="body2" color="text.secondary" noWrap>
        {line}
      </Typography>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mt: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {c.currency ?? ""} {formatMoney(c.tcv)}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {aside}
        </Typography>
      </Stack>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: "divider", borderTopStyle: "dashed", color: "text.secondary", typography: "caption" }}
      >
        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {note}
        </Box>
        {act}
      </Stack>
    </Paper>
  );
}
