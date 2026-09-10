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

import type {
  ExpenseAppData,
  ExpenseTransaction,
  ExpenseTransactionPayload,
} from "../expenseTypes";

/** A job number as `/employees/{email}/travels` returns it. */
export interface SubmitterTravel {
  jobNumber: string;
  customerName: string | null;
}

/**
 * `/app-data` carries two fields the Me-side claim form has no use for: the
 * employees this person may file a claim for, and — on a saved draft — who
 * that draft was being filed for. The shared `ExpenseAppData` does not
 * describe them, so this view names the same response's fuller shape rather
 * than widening the type the rest of the expense app depends on.
 */
export interface SubmitterAppData extends Omit<ExpenseAppData, "draft"> {
  /** Empty or absent for almost everyone — only finance/admin get a list. */
  onBehalfOfEmployees?: string[];
  draft: {
    transactions: ExpenseTransaction[];
    onBehalfOfEmail?: string | null;
  } | null;
}

/**
 * A line as the form holds it: the wire payload plus the figures the form
 * derives for display (the backend recomputes them on submit).
 */
export interface SubmitterDraftLine extends ExpenseTransactionPayload {
  reimbursementAmount: number;
  reimbursementCurrency: string;
  expenseType: string;
}

/** POST /claims and POST /claim-drafts body for this view. */
export interface SubmitterClaimPayload {
  transactions: ExpenseTransactionPayload[];
  /** Null files the claim for the signed-in person, as the Me-side form does. */
  onBehalfOfEmail: string | null;
}
