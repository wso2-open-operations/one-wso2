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

import { BarChart } from "@wso2/oxygen-ui-charts-react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import type { JSX } from "react";
import type { Widget, WidgetResult } from "./dashboardAgentApi";
import { visibleColumns } from "./columns";
import { cellText, toBarModel, toGridModel } from "./format";
import ControlLink from "./ControlLink";
import RiskLink from "./RiskLink";

interface WidgetPreviewProps {
  widget: Widget;
  result: WidgetResult;
  // The "showing the first N rows" note is left out when a summary already
  // says so.
  hideTruncatedNote?: boolean;
  // Called when a risk link in a table is followed.
  onNavigate?: () => void;
}

const SERIES_COLORS = ["#1976d2", "#ed6c02", "#2e7d32", "#9c27b0", "#d32f2f", "#0288d1"];
const HEAT_RGB = "25, 118, 210";

function DataTable({ result, onNavigate }: { result: WidgetResult; onNavigate?: () => void }): JSX.Element {
  const cols = visibleColumns(result);
  // A list can carry the id of each risk so its code can be a link.
  const idIndex = result.columns.findIndex((c) => c.id === "risk_id");
  // The same for controls: the audit and control ids, so a control number links.
  const auditIdIndex = result.columns.findIndex((c) => c.id === "audit_id");
  const controlIdIndex = result.columns.findIndex((c) => c.id === "control_id");
  return (
    <TableContainer sx={{ maxHeight: 420 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {cols.map(({ column }) => (
              <TableCell key={column.id} align={column.role === "measure" ? "right" : "left"} sx={{ fontWeight: 600 }}>
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {result.rows.map((row, i) => (
            <TableRow key={i}>
              {cols.map(({ column, index }) => {
                const id = idIndex >= 0 ? row[idIndex] : null;
                const auditId = auditIdIndex >= 0 ? row[auditIdIndex] : null;
                const controlId = controlIdIndex >= 0 ? row[controlIdIndex] : null;
                const text = cellText(column, row[index]);
                return (
                  <TableCell key={column.id} align={column.role === "measure" ? "right" : "left"}>
                    {column.id === "risk_code" && typeof id === "number" ? (
                      <RiskLink id={id} onNavigate={onNavigate}>
                        {text}
                      </RiskLink>
                    ) : column.id === "control_number" && typeof auditId === "number" && typeof controlId === "number" ? (
                      <ControlLink auditId={auditId} controlId={controlId} onNavigate={onNavigate}>
                        {text}
                      </ControlLink>
                    ) : (
                      text
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function Tile({ result }: { result: WidgetResult }): JSX.Element {
  const idx = result.columns.findIndex((c) => c.role === "measure");
  const col = result.columns[idx];
  return (
    <Box sx={{ textAlign: "center", py: 4 }}>
      <Typography variant="h2" fontWeight={700}>
        {cellText(col, result.rows[0][idx])}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {col.label}
      </Typography>
    </Box>
  );
}

function Grid({ result }: { result: WidgetResult }): JSX.Element | null {
  const g = toGridModel(result);
  if (!g) return null;
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Typography variant="caption" color="text.secondary">
        {g.valueTitle}
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: `auto repeat(${g.cols.length}, minmax(72px, 1fr))`, gap: 0.5, mt: 1 }}>
        <Box />
        {g.cols.map((c) => (
          <Typography key={c} variant="caption" align="center" fontWeight={600}>
            {g.colTitle}: {c}
          </Typography>
        ))}
        {g.rows.map((r) => (
          <Box key={r} sx={{ display: "contents" }}>
            <Typography variant="caption" fontWeight={600} sx={{ alignSelf: "center", pr: 1 }}>
              {g.rowTitle}: {r}
            </Typography>
            {g.cols.map((c) => {
              const strength = g.intensity(r, c);
              return (
                <Box
                  key={c}
                  data-testid={`cell-${r}-${c}`}
                  sx={{
                    height: 64,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 1,
                    border: 1,
                    borderColor: "divider",
                    fontWeight: 700,
                    bgcolor: strength > 0 ? `rgba(${HEAT_RGB}, ${0.12 + 0.68 * strength})` : "transparent",
                    color: strength > 0.55 ? "#fff" : "text.primary",
                  }}
                >
                  {g.text(r, c)}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// WidgetPreview draws a result the way its widget asks. A widget whose data
// does not fit its visual falls back to a table, so there is always something
// readable on screen.
export default function WidgetPreview({ widget, result, hideTruncatedNote, onNavigate }: WidgetPreviewProps): JSX.Element {
  if (result.rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        No data matches this view for the access you have.
      </Typography>
    );
  }

  let body: JSX.Element;
  const bar = widget.visual === "bar" ? toBarModel(result) : null;
  if (widget.visual === "kpi" && result.columns.some((c) => c.role === "measure")) {
    body = <Tile result={result} />;
  } else if (bar) {
    body = (
      <BarChart
        data={bar.data}
        xAxisDataKey={bar.xKey}
        bars={bar.series.map((s, i) => ({
          dataKey: s.key,
          name: s.name,
          fill: SERIES_COLORS[i % SERIES_COLORS.length],
          label: { position: "top" as const, fontSize: 12, fill: "#888888" },
        }))}
        height={380}
        maxBarSize={56}
        legend={{ show: bar.series.length > 1 }}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      />
    );
  } else if (widget.visual === "heatmap" && toGridModel(result)) {
    body = <Grid result={result} />;
  } else {
    body = <DataTable result={result} onNavigate={onNavigate} />;
  }

  return (
    <Box>
      {body}
      {result.truncated && !hideTruncatedNote && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Showing the first {result.rows.length} rows.
        </Typography>
      )}
    </Box>
  );
}
