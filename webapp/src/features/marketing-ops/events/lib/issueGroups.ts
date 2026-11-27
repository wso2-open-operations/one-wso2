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

// Grouping a tab's issues by field. Pure, and in its own module so IssueBar.tsx exports
// only a component (Fast Refresh).

import type { GridRow } from "../rules/model";
import { labelOf, type EventsConfig, type Tab } from "../rules/schema";
import { NOT_ENGLISH } from "../rules/titles";

export interface FieldIssues {
  field: string;
  // Resolved where the group is built, not in the component: the display name is
  // CONFIGURATION now, and the bar shouldn't need to know where it comes from.
  label: string;
  /** Cells we have a suggestion for — what accept-all acts on. */
  suggested: { row_id: string; field: string }[];
  /** The suggested cells whose suggestion is a job-title translation, which are answered
   *  one title at a time rather than in bulk. A subset of `suggested`. */
  translations: { row_id: string; field: string }[];
  /** Cells only the user can resolve. */
  blocked: number;
}

/** Group a tab's issues by field, in column order. */
export function issuesByField(
  rows: GridRow[],
  columns: string[],
  config: EventsConfig,
  tab: Tab,
): FieldIssues[] {
  const out: FieldIssues[] = [];
  for (const field of columns) {
    const suggested: { row_id: string; field: string }[] = [];
    const translations: { row_id: string; field: string }[] = [];
    let blocked = 0;
    for (const row of rows) {
      const issue = row.issues.find((i) => i.field === field);
      if (!issue) continue;
      if (issue.suggestion) {
        suggested.push({ row_id: row.id, field });
        if (issue.code === NOT_ENGLISH) translations.push({ row_id: row.id, field });
      } else blocked++;
    }
    if (suggested.length || blocked) {
      out.push({ field, label: labelOf(config, tab, field), suggested, translations, blocked });
    }
  }
  return out;
}
