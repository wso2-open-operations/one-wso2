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

import { useState, type JSX } from "react";
import { Alert, Button, Table, TableBody, TableCell, TableHead, TableRow } from "@wso2/oxygen-ui";
import EaDialog from "../../components/EaDialog";
import { TABLE_HEAD_SX } from "../../components/eaStyles";
import type { NotConverted } from "../../api/engagementTypes";
import { money } from "../../model/format";
import { COST_SOURCE_LABEL, notConvertedNote, notConvertedSorted } from "../travelCostText";

/** One line under the Travel Costs header about amounts left out of the totals, with the full list in a dialog. */
export default function NotConvertedNote({ rows, ratesPending = false }: { rows: readonly NotConverted[]; ratesPending?: boolean }): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const text = notConvertedNote(rows, ratesPending);
  if (!text) return null;
  return (
    <>
      <Alert
        severity={ratesPending ? "info" : "warning"}
        sx={{ mt: 1.5 }}
        action={
          rows.length ? (
            <Button color="inherit" size="small" onClick={() => setOpen(true)} aria-haspopup="dialog">
              View
            </Button>
          ) : undefined
        }
      >
        {text}
      </Alert>
      {open ? (
        <EaDialog title="Amounts Left Out of the Totals" subtitle="These amounts have no exchange rate, so they are not in any USD total." maxWidth="md" onClose={() => setOpen(false)}>
          <Table size="small" aria-label="Amounts left out of the totals">
            <TableHead sx={TABLE_HEAD_SX}>
              <TableRow>
                <TableCell>Currency</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Amounts</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {notConvertedSorted(rows).map((r) => (
                <TableRow key={`${r.source}|${r.currency}`}>
                  <TableCell>{r.currency || "Unknown"}</TableCell>
                  <TableCell>{COST_SOURCE_LABEL[r.source]}</TableCell>
                  <TableCell align="right">{money(r.amount, r.currency || undefined)}</TableCell>
                  <TableCell align="right">{(r.lines ?? 1).toLocaleString("en-US")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </EaDialog>
      ) : null}
    </>
  );
}
