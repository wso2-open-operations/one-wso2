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

import { useState, type ReactNode } from "react";
import { Box, IconButton, Typography } from "@wso2/oxygen-ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@wso2/oxygen-ui-icons-react";
import { AmplifyPanel } from "./AmplifyShell";

const PER_VIEW = 3;

/**
 * Three post cards at a time with prev/next arrows and an "1–3 of 5" count,
 * as on the wireframes. On a phone the grid drops to one column, so all three
 * stack rather than squeeze.
 */
export default function PostCarousel<T extends { id: string }>({
  title,
  items,
  renderItem,
}: {
  title: string;
  items: readonly T[];
  renderItem: (item: T) => ReactNode;
}) {
  const [start, setStart] = useState(0);
  // A list that shrank (a post shared, a post archived) can leave the window
  // past the end; pull it back during render so the empty view never paints.
  const lastStart = Math.max(0, Math.floor((items.length - 1) / PER_VIEW) * PER_VIEW);
  if (start > lastStart) setStart(lastStart);

  const visible = items.slice(start, start + PER_VIEW);
  const end = Math.min(start + PER_VIEW, items.length);
  const paged = items.length > PER_VIEW;

  return (
    <AmplifyPanel
      title={title}
      action={
        paged && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="caption" color="text.secondary" aria-live="polite">
              {start + 1}–{end} of {items.length}
            </Typography>
            <IconButton
              size="small"
              aria-label="Previous posts"
              disabled={start === 0}
              onClick={() => setStart(Math.max(0, start - PER_VIEW))}
              sx={{ border: "1px solid", borderColor: "primary.main" }}
            >
              <ChevronLeftIcon size={16} />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Next posts"
              disabled={end >= items.length}
              onClick={() => setStart(start + PER_VIEW)}
              sx={{ border: "1px solid", borderColor: "primary.main" }}
            >
              <ChevronRightIcon size={16} />
            </IconButton>
          </Box>
        )
      }
    >
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
        {visible.map((item) => (
          <Box key={item.id} sx={{ minWidth: 0 }}>
            {renderItem(item)}
          </Box>
        ))}
      </Box>
    </AmplifyPanel>
  );
}
