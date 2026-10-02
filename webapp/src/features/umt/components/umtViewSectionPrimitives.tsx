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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  DataGrid,
  Divider,
  Link,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";

const { DataGrid: DataGridComponent } = DataGrid;

export interface DenseColumn<Row> {
  key: string;
  label: string;
  render: (row: Row, index: number) => ReactNode;
  width?: number;
  // Share of the free width, relative to the default of 1.
  flex?: number;
  minWidth?: number;
}

export function TableSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack spacing={1.5}>
      <Typography component="h5" variant="h5" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {children}
    </Stack>
  );
}

export function EmptySectionText({ children }: { children: ReactNode }) {
  return (
    <Typography color="text.secondary" variant="body1">
      {children}
    </Typography>
  );
}

export function DividedTableSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Divider flexItem />
      <TableSection title={title}>{children}</TableSection>
    </>
  );
}

export function DenseTable<Row>({
  ariaLabel,
  columns,
  rows,
  rowKey,
  hideHeader = false,
}: {
  ariaLabel: string;
  columns: DenseColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  hideHeader?: boolean;
}) {
  // Carry the position through so a renderer can address a row by index, not
  // just by value — these lists can legitimately contain duplicates.
  const gridRows = rows.map((row, index) => ({ id: rowKey(row, index), value: row, index }));
  // Widths the user dragged to. The column definitions are rebuilt on every
  // render, and the grid re-applies `flex` whenever they change, so a resize
  // only sticks if it is fed back in as a fixed width.
  const [resizedWidths, setResizedWidths] = useState<Record<string, number>>({});
  const gridColumns: DataGrid.GridColDef[] = columns.map((column) => ({
    field: column.key,
    ...(resizedWidths[column.key] !== undefined
      ? { flex: 0, width: resizedWidths[column.key], minWidth: column.minWidth ?? 160 }
      : column.width === undefined
        ? { flex: column.flex ?? 1, minWidth: column.minWidth ?? 160 }
        : { flex: 0, width: column.width }),
    headerName: hideHeader ? "" : column.label,
    // Only tables with more than two columns have enough to rebalance; a
    // fixed-width column (e.g. a delete button) keeps its width.
    resizable: columns.length > 2 && column.width === undefined,
    sortable: false,
    renderCell: (params) => (
      <GridCellContent>
        {column.render(params.row.value as Row, params.row.index as number)}
      </GridCellContent>
    ),
  }));

  return (
    <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden", position: "relative" }}>
      <DataGridComponent
        autoHeight
        columnHeaderHeight={hideHeader ? 0 : 40}
        columns={gridColumns}
        disableColumnMenu
        disableRowSelectionOnClick
        getRowHeight={() => "auto"}
        hideFooter
        rows={gridRows}
        onColumnWidthChange={(params) =>
          setResizedWidths((widths) => ({ ...widths, [params.colDef.field]: params.width }))
        }
        aria-label={ariaLabel}
        sx={denseDataGridSx}
      />
    </Paper>
  );
}

// getRowHeight="auto" above only lets the ROW grow to fit its content — MUI
// DataGrid's own cell CSS still clips text with nowrap/ellipsis unless
// explicitly told to wrap. Long values (paths, URLs) were getting cut off
// with no way to read them; this lets them wrap and the auto row height
// then grows to fit the wrapped lines.

const denseDataGridSx = {
  border: 0,
  "& .MuiDataGrid-cell": {
    whiteSpace: "normal",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  },
} as const;

export function GridCellContent({ children }: { children: ReactNode }) {
  return (
    <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
      {children}
    </Stack>
  );
}

export function SectionSkeleton({ title }: { title: string }) {
  return (
    <DividedTableSection title={title}>
      <Skeleton variant="rounded" height={96} />
    </DividedTableSection>
  );
}

export function SectionError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <DividedTableSection title={title}>
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        Couldn&apos;t load this section.
      </Alert>
    </DividedTableSection>
  );
}

export interface ViewQueryState<Data> {
  data: Data | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: () => unknown;
}

export function renderLinkValue(value: string | null | undefined): ReactNode {
  const normalizedValue = displayValue(value);
  if (normalizedValue === "N/A") return normalizedValue;
  // Public Pull Requests / Integration Pull Requests accept any non-blank
  // text (EditableLinkSection has no `validate` for them), so this can't
  // assume normalizedValue is a URL — rendering it as an href unconditionally
  // would turn arbitrary text into a broken or misleading (or, for a
  // javascript: value, script-executing) link.
  if (!/^https?:\/\//i.test(normalizedValue)) return normalizedValue;

  return (
    <Link
      href={normalizedValue}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
    >
      {normalizedValue}
    </Link>
  );
}

export function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  const normalizedValue = String(value).trim();
  return normalizedValue || "N/A";
}
