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

// The words of a lens note (D129), from the rule sentences the backend sends.

import type { LensRole, ReviewNote } from "@features/sales/cado2/approvals/api/approvalTypes";
import { parseReason } from "./myApprovals";

/** What a note says: a short title, the detail, and who it concerns. */
export interface NoteText {
  readonly title: string;
  readonly detail: string;
  readonly who: string;
}

const joinRoles = (roles: readonly string[]) =>
  roles.length === 1 ? roles[0] : `${roles.slice(0, -1).join(", ")} and ${roles.at(-1)}`;

/**
 * A note's words. A line's discount reads "18% discount" / "Above the
 * Regional Director's 15% limit" / "Regional Director approves after you";
 * Deal Desk's own checks say so.
 */
export function noteText(n: ReviewNote, role: LensRole): NoteText {
  const first = n.reasons[0] ?? "";
  let title: string;
  let detail: string;
  switch (n.rule) {
    case "RENEWAL_START":
      title = "Start date";
      detail = first;
      break;
    case "SUPPORT_PLAN":
      // D155: the AM was warned, not stopped; Deal Desk checks.
      title = "Support plan";
      detail = first;
      break;
    case "LEGACY_SUPPORT":
      // D155: a Support line whose product isn't on Admin → Support Plans.
      title = "Legacy support";
      detail = first;
      break;
    case "SALES_PRICE":
      // D171: "Year 1 · line 3 · Product: sales price USD 71825.00, below the list price …"
      title = "Sales price changed";
      detail = first;
      break;
    case "SPECIAL_TERMS":
      if (role === "DEAL_DESK") {
        // D139: the AM wrote them; Deal Desk checks them.
        title = "Special terms from the AM";
        detail = "Check them, override if needed";
        break;
      }
      title = "Special terms";
      detail = first;
      break;
    default: {
      const row = parseReason(n.rule, n.lineNumber, first);
      title = row.figure ? `${row.figure} discount` : row.title;
      detail = row.detail;
    }
  }
  let who: string;
  if (n.yoursToWrite) who = "Yours to write";
  else if (n.roles.length) who = `${joinRoles(n.roles)} approve${n.roles.length === 1 ? "s" : ""} after you`;
  else if (role === "DEAL_DESK") who = "Only Deal Desk checks this";
  else who = "Why you're asked";
  return { title, detail, who };
}

/** A note's state in words: "Written" once a note to write is done; nothing otherwise (D140). */
export function stateLabel(n: ReviewNote): string {
  return n.yoursToWrite && n.state === "DONE" ? "Written" : "";
}
