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

import { Alert } from "@wso2/oxygen-ui";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import MisShell from "../components/MisShell";

// Flash Dashboard — the monthly P&L flash. The screen itself is ticket 15; this
// route exists from ticket 01 because the Flash privilege is INDEPENDENT of the
// ARR one, and "someone with ARR access is refused here" is a rule that has to
// hold from the first commit rather than from the last.
//
// It is also the only MIS screen that writes, and one of its two write paths
// (comments) points at a backend that is deprecated with its Production
// deployment suspended. Ticket 04 establishes whether that is still alive
// before anything is built against it.
export default function MisFlashPage() {
  useDocumentTitle("Flash Dashboard");

  return (
    <MisShell
      gateId="mis-flash"
      title="Flash Dashboard"
      subtitle="The monthly P&L flash: revenue, cost of sales, gross profit and margin."
    >
      <Alert severity="info" sx={{ mt: 1.5 }}>
        You have access to the Flash Dashboard. The screen itself is still being
        ported — the route is here first so that access to it can be proven
        separately from the ARR dashboards.
      </Alert>
    </MisShell>
  );
}
