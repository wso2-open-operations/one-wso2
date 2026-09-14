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

import { Stack, ToggleButton, ToggleButtonGroup, Typography } from "@wso2/oxygen-ui";

// Which geography Exit ARR by Region cuts its rows by.
//
// From the `Region Type` segmented control in `RegionSummaryTabs.js`. It
// commits on click, like the Table and unit tabs above it, because it is not a
// narrowing of the report — it is a different cut of it, and the backend
// computes it (`isSalesRegionSummary` in the request body).
//
// ---- why this is not in the address bar ------------------------------------
//
// Every other control on this screen is in the URL; this one is not, and the
// asymmetry is deliberate rather than an omission. In the source it is
// component state that dies with the table, so it is not in the Applied set, it
// is not serialised, and no link anyone holds carries it. Putting it in the
// query string would be the port promising something the source never did, and
// it would have to be added to the URL contract ticket 02 pinned — including
// what an unrecognised value degrades to and what a stale link means. Worth its
// own decision rather than a side effect of building the table. Recorded as an
// open question in `docs/ported-apps/mis.md` §11.
//
// The consequence, stated plainly so nobody has to discover it: a reader who
// shares a Sub Region view sends a Sales Region one.

export default function MisRegionTypeTabs({
  bySalesRegion,
  onChange,
}: {
  bySalesRegion: boolean;
  onChange: (bySalesRegion: boolean) => void;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
      {/* Hidden from assistive tech, because the group below carries the same
          words as its accessible name — the source hides its own the same way
          (`region-type-label`, `aria-hidden="true"`). */}
      <Typography variant="body2" color="text.secondary" aria-hidden>
        Region Type
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={bySalesRegion ? "sales" : "sub"}
        aria-label="Region Type"
        // `null` when the reader clicks the cut they are already on. Ignored
        // rather than treated as "neither": the rows are cut one way or the
        // other and there is no third state.
        onChange={(_event, next: string | null) => next && onChange(next === "sales")}
      >
        <ToggleButton value="sales" sx={{ textTransform: "none", px: 1.5 }}>
          Sales Region
        </ToggleButton>
        <ToggleButton value="sub" sx={{ textTransform: "none", px: 1.5 }}>
          Sub Region
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}
