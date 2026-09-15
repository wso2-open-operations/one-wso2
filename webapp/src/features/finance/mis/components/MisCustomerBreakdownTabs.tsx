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

import MisSegmentedControl from "./MisSegmentedControl";

// How Software/Cloud Customers breaks a customer's revenue down: by business
// unit, or by product across Software and Cloud.
//
// From the `BU only` checkbox in `DataGrid.js:1063-1105`. **BU only is the
// source's default** (`useState(true)`), so it is the default here — the
// twelve-column Software/Cloud breakdown is what the other option gets you.
// Both views read the same `POST /accounts` response, so switching costs no
// request; see `CUSTOMER_BU_SUB_COLUMNS`.
//
// A segmented control rather than the source's checkbox, because there are two
// named breakdowns and a checkbox only names one of them — "BU only" unticked
// says what the view is NOT. The source's own word is kept for the option it
// labels, so a reader who knows the checkbox finds it.
//
// Component state, and not in the address bar, for the same reason as
// `MisRegionTypeTabs`: the source keeps it in the table's own state, so it is
// in no link anyone holds, and moving it into the URL is an extension of the
// contract ticket 02 pinned rather than a side effect of building this. The
// same open question, recorded in `docs/ported-apps/mis.md` §11.

const BREAKDOWN_OPTIONS = [
  { value: "bu", label: "BU only" },
  { value: "books", label: "Software / Cloud" },
] as const;

export default function MisCustomerBreakdownTabs({
  buOnly,
  onChange,
}: {
  buOnly: boolean;
  onChange: (buOnly: boolean) => void;
}) {
  return (
    <MisSegmentedControl
      label="Breakdown"
      value={buOnly ? "bu" : "books"}
      options={BREAKDOWN_OPTIONS}
      onChange={(next) => onChange(next === "bu")}
    />
  );
}
