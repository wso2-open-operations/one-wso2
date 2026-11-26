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

import type { LedgerEntry, VerificationReason } from "../api/amplifyTypes";

const REASONS: Record<VerificationReason, string> = {
  NO_TOKEN: "Couldn't check: their LinkedIn isn't linked",
  TOKEN_EXPIRED: "Couldn't check: their LinkedIn link expired",
  NOT_PERMITTED: "Couldn't check: LinkedIn didn't allow it",
  NO_ACTIVITY: "Couldn't check: no LinkedIn activity to look for",
  SOURCE_NOT_FOUND: "Couldn't check: the post isn't on LinkedIn anymore",
  MEMBER_ERASED: "Couldn't check: their LinkedIn account is gone",
};

/** Why a row waits for the PO team: the reason the pre-coin check couldn't verify it, or that a PO held it back. */
export function actionRequiredReason(entry: Pick<LedgerEntry, "verification" | "verificationReason">): string {
  if (entry.verificationReason && REASONS[entry.verificationReason]) return REASONS[entry.verificationReason];
  if (entry.verification === "UNVERIFIABLE") return "Couldn't check it on LinkedIn";
  return "Held back by the PO team";
}
