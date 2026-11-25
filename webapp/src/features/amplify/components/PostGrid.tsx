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

import { useMemo, useState, type ReactNode } from "react";
import { Box, Button } from "@wso2/oxygen-ui";
import { ChevronDownIcon, ChevronUpIcon } from "@wso2/oxygen-ui-icons-react";
import type { Campaign, Category } from "../api/amplifyTypes";
import {
  POST_GRID_SIZE,
  matchesPostFilter,
  postFilterOptions,
  postsToAmplifyTitle,
  sortForAmplify,
  type PostFilter,
} from "../util/postFilters";
import { AmplifyPanel } from "./AmplifyShell";
import FilterChips from "./FilterChips";

/**
 * Celebrate's posts to amplify: a grid of up to six cards, priority first then newest, under a title that says how
 * many are waiting. Chips filter by priority or category, each with its count; "Show all N posts" opens the rest on
 * the same page and "Show less" folds them back. One column on a phone, two on a tablet, three on a desktop.
 */
export default function PostGrid({
  items,
  categories,
  renderItem,
}: {
  items: readonly Campaign[];
  /** The post categories, in the order their chips appear. */
  categories: readonly Category[] | undefined;
  renderItem: (campaign: Campaign) => ReactNode;
}) {
  const [filter, setFilter] = useState<PostFilter>("all");
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => sortForAmplify(items), [items]);
  const options = useMemo(() => postFilterOptions(items, categories), [items, categories]);

  // A filter whose posts have all gone (shared or closed since) shows everything again.
  const active: PostFilter = options.some((o) => o.value === filter) ? filter : "all";
  const filtered = sorted.filter((c) => matchesPostFilter(c, active));
  const shown = expanded ? filtered : filtered.slice(0, POST_GRID_SIZE);

  const choose = (next: PostFilter) => {
    setFilter(next);
    setExpanded(false);
  };

  return (
    <AmplifyPanel title={postsToAmplifyTitle(items.length)}>
      {options.length > 1 && (
        <Box sx={{ mb: 1.5 }}>
          <FilterChips options={options} value={active} onChange={choose} ariaLabel="Filter posts" />
        </Box>
      )}
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        {shown.map((campaign) => (
          <Box key={campaign.id} sx={{ minWidth: 0 }}>
            {renderItem(campaign)}
          </Box>
        ))}
      </Box>
      {filtered.length > POST_GRID_SIZE && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
          <Button
            size="small"
            aria-expanded={expanded}
            endIcon={expanded ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? "Show less" : `Show all ${filtered.length} posts`}
          </Button>
        </Box>
      )}
    </AmplifyPanel>
  );
}
