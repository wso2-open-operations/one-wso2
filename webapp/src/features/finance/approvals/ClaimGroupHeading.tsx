/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useCallback, useState } from "react";
import { Box, TableCell, TableRow, Typography } from "@wso2/oxygen-ui";
import { ChevronRightIcon } from "@wso2/oxygen-ui-icons-react";

/**
 * The two groups every claim list on this screen is split into. Both Needs you
 * and Decided show the same pair, so both collapse by the same keys.
 */
export type ClaimGroup = "opd" | "expense";

/**
 * Remembers which groups the reader has folded away.
 *
 * Per mount rather than persisted: this is a "get the long group out of my way
 * for a moment" choice, not a setting worth storing and later having to explain
 * when a group is missing on a fresh visit. Everything opens expanded, so a
 * reader who never touches a heading sees exactly what they saw before.
 */
export function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<ReadonlySet<ClaimGroup>>(new Set());

  const toggleGroup = useCallback((group: ClaimGroup) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  const isCollapsed = useCallback((group: ClaimGroup) => collapsed.has(group), [collapsed]);

  return { isCollapsed, toggleGroup };
}

/**
 * The heading above one group of claims, which folds that group away when
 * clicked.
 *
 * Finance can be sitting on fifty-odd OPD claims, and the Expense claims group
 * below them was reachable only by scrolling past every one. Collapsing leaves
 * the heading — and its count — in place and drops only the rows, so the groups
 * stay visible as a summary and the other one comes within a click.
 *
 * A real `<button>` rather than an onClick on the row: a `<tr>` takes no focus
 * and answers no key, so the fold would be mouse-only otherwise. `aria-expanded`
 * is what tells a screen reader this heading controls something, and whether
 * that something is currently open.
 */
export function ClaimGroupHeading({
  label,
  count,
  note,
  colSpan,
  collapsed,
  onToggle,
}: {
  label: string;
  count: number;
  /** Which stage decides this group, when the screen draws that distinction. */
  note?: string;
  colSpan: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ border: 0, pt: 2, pb: 0.75 }}>
        <Box
          component="button"
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            // The row is a plain heading until pointed at, so the button has
            // to shed every default a <button> brings with it.
            p: 0,
            border: 0,
            background: "none",
            font: "inherit",
            cursor: "pointer",
            color: "text.secondary",
            "&:hover": { color: "text.primary" },
          }}
        >
          <ChevronRightIcon
            size={16}
            style={{
              flexShrink: 0,
              transform: collapsed ? undefined : "rotate(90deg)",
              transition: "transform 120ms ease",
            }}
          />
          <Typography
            component="span"
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "inherit",
            }}
          >
            {label} · {count}
            {note ? ` · ${note}` : ""}
          </Typography>
        </Box>
      </TableCell>
    </TableRow>
  );
}
