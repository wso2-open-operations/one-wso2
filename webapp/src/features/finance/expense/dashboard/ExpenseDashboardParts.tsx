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

import type { ReactNode } from "react";
import { Card, Typography } from "@wso2/oxygen-ui";
import { formatPercentage, percentageColor } from "./expenseDashboardUtils";

/**
 * A titled panel — `DashboardSection.tsx` in the source. Same `Card
 * variant="outlined"` shell `OpdDashboardPanel` already draws every other
 * finance dashboard's sections with, so the three dashboards read as one
 * family rather than three different visual languages.
 */
export function ExpenseDashboardPanel({
  title,
  aside,
  children,
}: {
  title: string;
  /** Sits beside the title in lighter type — the period/entity note under
   *  each breakdown table in the source. */
  aside?: string;
  children: ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography sx={{ fontSize: 14.5, fontWeight: 600, mb: 1 }}>
        {title}
        {aside && (
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 400, color: "text.secondary", ml: 1 }}>
            {aside}
          </Typography>
        )}
      </Typography>
      {children}
    </Card>
  );
}

/**
 * One of the top-row figures, or one status-breakdown tile — `StatTile.tsx`.
 * `value` takes a pre-formatted string rather than a number: the three top
 * tiles show money (via `money()`), the status tiles show a bare count, and
 * handing this component a currency code to format with would be one more
 * thing every caller has to know to pass.
 */
export function ExpenseStatTile({
  label,
  value,
  changePercentage,
  caption,
}: {
  label: string;
  value: string;
  /** Omitted entirely for an open-ended period, which has no prior period
   *  to compare against — not shown as 0%, which would claim no change
   *  rather than "nothing to compare". */
  changePercentage?: number;
  caption?: string;
}) {
  return (
    <Card variant="outlined" sx={{ p: 2, height: "100%", boxSizing: "border-box" }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary", letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Typography>
      <Typography
        sx={{ fontSize: 24, fontWeight: 700, color: "text.secondary", mt: 0.5, fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </Typography>
      {changePercentage !== undefined && (
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: percentageColor(changePercentage), mt: 0.5 }}>
          {formatPercentage(changePercentage)} vs prior period
        </Typography>
      )}
      {caption && (
        <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>{caption}</Typography>
      )}
    </Card>
  );
}
