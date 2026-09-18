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

/**
 * Claim approval, under the Finance perspective.
 *
 * Approving is work you do for other people, so it sits here rather than under
 * Me with the things you do for yourself; filing a claim and looking up your
 * own stay there.
 *
 * One app today, OPD. Expense belongs beside it when it is migrated, which is
 * why this is a path with room under it rather than a single route.
 */
export const CLAIM_APPROVAL_PATH = "/finance/claim-approval";

export const claimApprovalPaths = {
  opd: `${CLAIM_APPROVAL_PATH}/opd`,
} as const;
