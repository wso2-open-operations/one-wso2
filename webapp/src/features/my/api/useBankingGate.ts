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

import { describeError } from "@api/errors";
import { useAsgardeoGroups } from "@hooks/useAsgardeoGroups";
import { isConsultancyRestricted } from "./bankingRules";
import { useBankingConfig } from "./useBankingConfig";

// Decides whether the Consultancy panel is worth showing at all — same
// shape as useSubscriptionGate: group NAMES come from the banking
// backend's own /app-config (consultancyRestrictedRoles), the caller's
// MEMBERSHIPS come from the id_token via useAsgardeoGroups. Neither half is
// hard-coded, so a group rename on the backend never needs a frontend
// release.
//
// Presentation only, same as every gate in this app: /employee/accounts
// re-derives the same groups from the JWT and 403s a caller who submits a
// Consultancy request without holding the right one. Showing the panel to
// the wrong caller costs them a rejected request, not access to anything.

export interface BankingGate {
  /** True when the Consultancy panel should not render for this caller. */
  isConsultancyRestricted: boolean;
  /**
   * True while either half is still resolving. Hold gated UI until it
   * clears — deciding early hides Consultancy from an eligible employee on
   * every cold load, then corrects itself a moment later.
   */
  isResolving: boolean;
  /** The app-config request or the token decode failed. */
  isError: boolean;
  errorMessage?: string;
  retry: () => void;
}

export function useBankingGate(): BankingGate {
  const config = useBankingConfig();
  const identity = useAsgardeoGroups();

  return {
    isConsultancyRestricted: isConsultancyRestricted(
      identity.groups,
      config.data?.consultancyRestrictedRoles ?? [],
    ),
    isResolving: config.isPending || !identity.ready,
    isError: config.isError || Boolean(identity.error),
    errorMessage: config.isError
      ? describeError(config.error)
      : (identity.error ?? undefined),
    // Both halves, unconditionally — same reasoning as useSubscriptionGate:
    // the caller has no way to know which one actually failed, and
    // retrying the healthy half is a harmless no-op.
    retry: () => {
      void config.refetch();
      identity.retry();
    },
  };
}
