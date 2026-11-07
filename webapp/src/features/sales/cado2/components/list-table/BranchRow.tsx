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

import type { JSX, ReactNode } from "react";
import { IconButton, Stack, TableCell, TableRow, Typography } from "@wso2/oxygen-ui";
import { ChevronDownIcon, ChevronRightIcon } from "@wso2/oxygen-ui-icons-react";
import { LIST_CELL } from "@features/sales/cado2/components/list-table/listTable";

/** A tree branch's row: a chevron that opens and closes it, and its name across the table. */
export default function BranchRow({
  depth,
  open,
  onToggle,
  title,
  detail,
  span,
}: {
  readonly depth: 0 | 1;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly title: string;
  readonly detail?: ReactNode;
  readonly span: number;
}): JSX.Element {
  return (
    <TableRow sx={{ bgcolor: depth === 0 ? "action.hover" : undefined }}>
      <TableCell colSpan={span} sx={{ ...LIST_CELL, pl: 1 + depth * 3 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton
            size="small"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
          >
            {open ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: depth === 0 ? 600 : 500 }} noWrap>
            {title}
          </Typography>
          {detail ? (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ pl: 1 }}>
              {detail}
            </Typography>
          ) : null}
        </Stack>
      </TableCell>
    </TableRow>
  );
}
