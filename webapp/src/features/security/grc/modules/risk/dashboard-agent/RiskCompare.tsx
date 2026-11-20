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

import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import type { CompareTable } from "./dashboardAgentApi";
import ControlLink from "./ControlLink";
import RiskLink from "./RiskLink";

interface RiskCompareProps {
  compare: CompareTable;
  onNavigate?: () => void;
}

// RiskCompare shows two risks (or two controls) side by side. Rows where they differ are marked,
// so the differences stand out.
export default function RiskCompare({ compare, onNavigate }: RiskCompareProps): JSX.Element {
  return (
    <Box sx={{ mt: 1.5, overflowX: "auto" }}>
      <Table size="small" aria-label="Risk comparison">
        <TableHead>
          <TableRow>
            <TableCell />
            {compare.risks.map((r) => (
              <TableCell key={r.id}>
                {r.audit_id !== undefined ? (
                  <ControlLink auditId={r.audit_id} controlId={r.id} onNavigate={onNavigate}>
                    {r.code}
                  </ControlLink>
                ) : (
                  <RiskLink id={r.id} onNavigate={onNavigate}>
                    {r.code}
                  </RiskLink>
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {compare.rows.map((row) => (
            <TableRow key={row.label} data-differs={row.differs ? "true" : "false"} sx={row.differs ? { bgcolor: "action.hover" } : undefined}>
              <TableCell component="th" scope="row">
                <Typography variant="body2" sx={{ fontWeight: row.differs ? 600 : 400 }}>
                  {row.label}
                  {row.differs && (
                    <Typography component="span" variant="caption" color="text.secondary">
                      {" "}
                      · differs
                    </Typography>
                  )}
                </Typography>
              </TableCell>
              {row.values.map((v, i) => (
                <TableCell key={i}>
                  <Typography variant="body2">{v}</Typography>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
