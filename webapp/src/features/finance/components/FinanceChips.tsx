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

import { Chip } from "@wso2/oxygen-ui";

type ChipColor = "success" | "error" | "warning" | "info" | "default";

// One status pill shared by every finance table/card. Each app maps its own
// raw status string to a {label,color} via the maps below.
export function StatusChip({ label, color }: { label: string; color: ChipColor }) {
  return (
    <Chip
      label={label}
      color={color}
      size="small"
      variant="outlined"
      sx={{ height: 20, fontSize: 10.5, fontWeight: 600, borderWidth: 1.5 }}
    />
  );
}

// ---- OPD claim statuses ----------------------------------------------------
const OPD_STATUS: Record<string, { label: string; color: ChipColor }> = {
  PENDING: { label: "Pending Finance", color: "warning" },
  PENDING_OLD: { label: "Pending Finance", color: "warning" },
  APPROVED: { label: "Approved", color: "success" },
  REJECTED: { label: "Finance Rejected", color: "error" },
};

export function opdStatusMeta(status: string | null | undefined) {
  return OPD_STATUS[status ?? "PENDING"] ?? { label: status ?? "—", color: "default" as ChipColor };
}

// ---- Credit-card transaction statuses -------------------------------------
//
// The source's own words (`component/common/StatusChip.tsx:18-34`), and they
// are not the obvious ones: a `new` transaction is not "New" to the reader, it
// is one **pending submission** — nobody has sent it anywhere yet. And
// `submitted` is the END of the trail, once finance has booked it, so the
// source calls it **Completed**; "Submitted" reads like the first step rather
// than the last.
//
// One map for every card screen, as the source has one chip component.
const CC_STATUS: Record<string, { label: string; color: ChipColor }> = {
  new: { label: "Pending Submission", color: "default" },
  pending_lead: { label: "Pending Lead", color: "warning" },
  pending_finance: { label: "Pending Finance", color: "info" },
  submitted: { label: "Completed", color: "success" },
  invalid: { label: "Invalid", color: "error" },
};

export function ccStatusMeta(status: string | null | undefined) {
  return CC_STATUS[status ?? "new"] ?? { label: status ?? "—", color: "default" as ChipColor };
}

// ---- Expense claim statuses ------------------------------------------------
const EXPENSE_STATUS: Record<string, { label: string; color: ChipColor }> = {
  PENDING_LEAD: { label: "Pending Lead", color: "warning" },
  LEAD_REJECTED: { label: "Lead Rejected", color: "error" },
  PENDING_FINANCE: { label: "Pending Finance", color: "info" },
  APPROVED: { label: "Approved", color: "success" },
  FINANCE_REJECTED: { label: "Finance Rejected", color: "error" },
};

export function expenseStatusMeta(status: string | null | undefined) {
  return EXPENSE_STATUS[status ?? "PENDING_LEAD"] ?? { label: status ?? "—", color: "default" as ChipColor };
}
