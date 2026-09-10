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

import { expenseBackendUrl } from "@config/apiConfig";

// The two endpoints only this view calls, against the same expense-claims
// backend as `expenseServiceUrls`. They live here rather than in that shared
// map so the Me-side claim flow's URLs stay exactly as they were.
export const expenseSubmitterUrls = {
  /** GET — the job numbers belonging to the employee a claim is filed for. */
  employeeTravels: (email: string) =>
    `${expenseBackendUrl}/employees/${encodeURIComponent(email)}/travels`,

  /**
   * GET — the expense-type list. `onBehalfOfEmail` scopes it to that
   * employee's country rather than the caller's, which is what makes the
   * types offered correct when filing for someone in another subsidiary.
   */
  expenseTypes: (travelJobNumber?: string, onBehalfOfEmail?: string | null) => {
    const params = new URLSearchParams();
    if (travelJobNumber) params.set("travelJobNumber", travelJobNumber);
    if (onBehalfOfEmail) params.set("onBehalfOfEmail", onBehalfOfEmail);
    const qs = params.toString();
    return `${expenseBackendUrl}/user-configurations/expense-types${qs ? `?${qs}` : ""}`;
  },
};
