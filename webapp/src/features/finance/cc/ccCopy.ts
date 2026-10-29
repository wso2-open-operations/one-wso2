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

/**
 * What the card-expense screens say when something succeeds.
 *
 * Verbatim from the source's `SnackMessage.success` (config/constant.ts). The
 * port had rewritten four of these and dropped three, which is how the same
 * action came to be announced differently in the two apps — "Transaction
 * updated" here against "Successfully saved the edited transaction" there.
 *
 * Errors are deliberately not listed. The source pairs each failure with a
 * fixed "Unable to …" line; this port surfaces the cause through
 * `describeError` instead, which is the choice the leave port already made
 * (`leaveCopy.ts:78-85` keeps its error strings but the screens do not use
 * them). One convention across the ported apps beats matching this one.
 *
 * Pinned character-for-character by ccCopy.test.ts — this wording is what
 * drifted, and nothing held it.
 */
export const CC_SNACK = {
  success: {
    updateCardLabel: "Successfully updated the label",
    saveEdit: "Successfully saved the edited transaction",
    uploadAttachment: "Successfully uploaded the attachment",
    removeAttachment: "Successfully removed the attachment",
    submitTransaction: "Successfully submitted the transaction",
    approveSubmission: "Successfully approved the submission",
    processBankStatement: "Successfully processed the bank statement",
    uploadNewTransactions: "Successfully saved the new transactions",
  },
} as const;

/** What the Autofill Rules screen says when a rule change succeeds. */
export const CC_RULE_SNACK = {
  created: "Rule added",
  updated: "Rule updated",
  deleted: "Rule deleted",
} as const;
